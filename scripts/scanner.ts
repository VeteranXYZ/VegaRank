import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { MarketDataStore } from "../src/lib/storage/marketData";
import { getScannerStorageAdapter } from "../src/lib/storage/storageAdapter";
import { getResearchStats } from "../src/lib/storage/researchStats";
import { SCORING_VERSION } from "../src/lib/scanner/scoring";
import { scanLocalMarket } from "../src/lib/scanner/scanLocalMarket";
import { TIMEFRAMES, type Timeframe } from "../src/lib/exchanges/types";
import {
  normalizeSymbols,
  resolveCryptoUniverse,
} from "../src/lib/market-data/cryptoUniverse";
import type { ScanResult } from "../src/lib/scanner/types";
import { parseJsonArray, type ScanSignalRecord } from "../src/lib/storage/scanSignalModel";

type ScannerCommand = "run" | "export-latest";

async function main() {
  const [, , rawCommand, ...args] = process.argv;
  const command = parseCommand(rawCommand);

  switch (command) {
    case "run":
      await runLocalScan(args);
      return;
    case "export-latest":
      await exportLatest(args);
      return;
  }
}

async function runLocalScan(args: string[]) {
  const options = parseRunOptions(args);
  const marketData = new MarketDataStore();
  const researchStorage = await getScannerStorageAdapter();
  const results: ScanResult[] = [];
  const warnings: string[] = [];
  const startedAt = new Date().toISOString();

  try {
    for (const symbol of options.symbols) {
      try {
        results.push(
          await scanLocalMarket({
            store: marketData,
            symbol,
            timeframe: options.timeframe,
          }),
        );
      } catch (error) {
        warnings.push(error instanceof Error ? error.message : `Failed to scan ${symbol}.`);
      }
    }

    if (!options.dryRun && researchStorage.mode !== "disabled") {
      await researchStorage.persistScanResults({
        createdAt: startedAt,
        timeframe: options.timeframe,
        source: "local",
        results,
        marketContext: {
          source: "local-market-candles",
          symbolsRequested: options.symbols.length,
        },
        metadata: {
          scannerVersion: "oracle-vps-stage1",
          scoringVersion: SCORING_VERSION,
          warnings,
        },
      });
    }

    printJson({
      source: "local",
      timeframe: options.timeframe,
      dryRun: options.dryRun,
      symbolsRequested: options.symbols.length,
      symbolsScanned: results.length,
      symbolsSkipped: warnings.length,
      signalsSaved: options.dryRun || researchStorage.mode === "disabled" ? 0 : results.length,
      warnings,
    });
  } finally {
    marketData.close();
    await researchStorage.close?.();
  }
}

async function exportLatest(args: string[]) {
  parseExportOptions(args);
  const storage = await getScannerStorageAdapter();

  try {
    const allSignals = await storage.listScanSignals({ limit: 2000 });
    const researchStats = await getResearchStats();
    const latestByTimeframe = groupLatestSignalsByTimeframe(allSignals);
    const outputDir = path.join(process.cwd(), ".data", "public");
    await mkdir(outputDir, { recursive: true });

    const allPayload = buildLatestPayload({
      timeframe: "all",
      signals: latestByTimeframe.all,
      researchStats,
    });
    await writeJson(path.join(outputDir, "latest-scan.json"), allPayload);

    for (const timeframe of ["4h", "1d"] as const) {
      const payload = buildLatestPayload({
        timeframe,
        signals: latestByTimeframe.byTimeframe.get(timeframe) ?? [],
        researchStats,
      });
      await writeJson(path.join(outputDir, `latest-scan-${timeframe}.json`), payload);
    }

    printJson({
      outputDir: ".data/public",
      files: [
        ".data/public/latest-scan.json",
        ".data/public/latest-scan-4h.json",
        ".data/public/latest-scan-1d.json",
      ],
      itemCount: allPayload.results.length,
      storageMode: storage.mode,
      warnings:
        allPayload.results.length === 0
          ? ["No scan signals found; exported stable empty-state JSON."]
          : [],
    });
  } finally {
    await storage.close?.();
  }
}

function parseRunOptions(args: string[]) {
  const flags = parseFlags(args);
  const source = typeof flags.source === "string" ? flags.source : "local";

  if (source !== "local") {
    throw new Error("scanner:run currently supports --source=local only.");
  }

  const symbols = parseSymbols(flags);
  if (symbols.length === 0) {
    throw new Error("scanner:run requires --symbol, --symbols, or --universe=core.");
  }

  return {
    source,
    symbols,
    timeframe: parseTimeframe(flags.timeframe, "4h"),
    dryRun: Boolean(flags["dry-run"]),
  };
}

function parseExportOptions(args: string[]) {
  parseFlags(args);
  return {};
}

function parseSymbols(flags: Record<string, string | boolean>) {
  const explicitSymbols = [
    ...(typeof flags.symbol === "string" ? [flags.symbol] : []),
    ...(typeof flags.symbols === "string" ? flags.symbols.split(",") : []),
  ];
  const universeSymbols = resolveCryptoUniverse(
    typeof flags.universe === "string" ? flags.universe : undefined,
  );

  return normalizeSymbols([...explicitSymbols, ...universeSymbols]);
}

function groupLatestSignalsByTimeframe(signals: ScanSignalRecord[]) {
  const byTimeframe = new Map<Timeframe, ScanSignalRecord[]>();

  for (const timeframe of TIMEFRAMES) {
    const signalsForTimeframe = signals.filter((signal) => signal.timeframe === timeframe);
    const latestTime = signalsForTimeframe[0]?.scanTime;
    byTimeframe.set(
      timeframe,
      latestTime
        ? signalsForTimeframe.filter((signal) => signal.scanTime === latestTime)
        : [],
    );
  }

  const all = Array.from(byTimeframe.values()).flat();
  return { byTimeframe, all };
}

function buildLatestPayload({
  timeframe,
  signals,
  researchStats,
}: {
  timeframe: Timeframe | "all";
  signals: ScanSignalRecord[];
  researchStats: Awaited<ReturnType<typeof getResearchStats>>;
}) {
  const generatedAt = new Date().toISOString();

  return {
    generatedAt,
    timeframe,
    scoringVersion: SCORING_VERSION,
    source: "local",
    results: signals.map(toExportSignal),
    summary: {
      itemCount: signals.length,
      signalLabels: countBy(signals.map((signal) => signal.signalLabel)),
      actionBiases: countBy(signals.map((signal) => signal.actionBias)),
    },
    warnings:
      signals.length === 0
        ? ["No scan results are available yet. Run scanner:run after market:sync."]
        : [],
    researchStats: {
      storageMode: researchStats.storageMode,
      totalSignals: researchStats.totalSignals,
      totalEvaluations: researchStats.totalEvaluations,
      latestScanTime: researchStats.latestScanTime,
      latestEvaluationTime: researchStats.latestEvaluationTime,
      scoringVersions: researchStats.scoringVersions,
    },
  };
}

function toExportSignal(signal: ScanSignalRecord) {
  return {
    id: signal.id,
    symbol: signal.symbol,
    timeframe: signal.timeframe,
    scanTime: signal.scanTime,
    priceAtSignal: signal.priceAtSignal,
    finalSignalScore: signal.finalSignalScore,
    opportunityScore: signal.opportunityScore,
    confirmationScore: signal.confirmationScore,
    riskScore: signal.riskScore,
    trendScore: signal.trendScore,
    momentumScore: signal.momentumScore,
    volumeScore: signal.volumeScore,
    structureScore: signal.structureScore,
    signalLabel: signal.signalLabel,
    actionBias: signal.actionBias,
    primaryStructure: signal.primaryStructure,
    secondaryStructures: parseJsonArray(signal.secondaryStructuresJson),
    detectedRiskTypes: parseJsonArray(signal.detectedRiskTypesJson),
  };
}

async function writeJson(filePath: string, value: unknown) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseCommand(value: string | undefined): ScannerCommand {
  if (value === "run" || value === "export-latest") {
    return value;
  }

  throw new Error("Scanner command must be run or export-latest.");
}

function parseTimeframe(
  value: string | boolean | undefined,
  fallback: Timeframe,
): Timeframe {
  const timeframe = value === undefined ? fallback : value;
  if (typeof timeframe !== "string" || !TIMEFRAMES.includes(timeframe as Timeframe)) {
    throw new Error(`timeframe must be one of ${TIMEFRAMES.join(", ")}.`);
  }

  return timeframe as Timeframe;
}

function parseFlags(args: string[]) {
  const flags: Record<string, string | boolean> = {};
  for (const arg of args) {
    if (!arg.startsWith("--")) {
      throw new Error(`Unsupported argument "${arg}". Use --name=value flags.`);
    }

    const [name, ...rawValue] = arg.slice(2).split("=");
    flags[name] = rawValue.length === 0 ? true : rawValue.join("=");
  }

  return flags;
}

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function printJson(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
