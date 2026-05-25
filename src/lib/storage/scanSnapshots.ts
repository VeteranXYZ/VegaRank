import { mkdir, readFile, appendFile } from "node:fs/promises";
import path from "node:path";
import type { Timeframe } from "@/lib/exchanges/types";
import type { MtfPreset } from "@/lib/scanner/multiTimeframe";
import type {
  MarketPhase,
  MultiTimeframeAlignment,
  ScanResult,
  ScannerSignalState,
} from "@/lib/scanner/types";

export type ScanSnapshotMode = "single" | "mtf";

export type StoredScanSnapshot = {
  id: string;
  createdAt: string;
  exchange: "binance";
  mode: ScanSnapshotMode;
  timeframe?: Timeframe;
  preset?: MtfPreset;
  timeframes?: Timeframe[];
  limit: number;
  itemCount: number;
  errorsCount: number;
  results: StoredScanResult[];
};

export type StoredScanResult = {
  symbol: string;
  timeframe: Timeframe;
  price: number;
  phase: MarketPhase;
  signalState: ScannerSignalState;
  signalLabel: string;
  rankScore: number;
  opportunityScore: number;
  confirmationScore: number;
  riskScore: number;
  multiTimeframe?: {
    alignment: MultiTimeframeAlignment;
    label: string;
    rankScore: number;
    constructiveCount: number;
    riskCount: number;
    timeframes: Timeframe[];
  };
};

type PersistScanSnapshotInput = Omit<StoredScanSnapshot, "id" | "results"> & {
  results: ScanResult[];
};

const snapshotsFile = path.join(process.cwd(), ".data", "scan-snapshots.jsonl");

export async function persistScanSnapshot(input: PersistScanSnapshotInput) {
  const snapshot: StoredScanSnapshot = {
    ...input,
    id: `${input.createdAt}-${input.mode}-${input.timeframe ?? input.preset}`,
    results: input.results.map(toStoredResult),
  };

  await mkdir(path.dirname(snapshotsFile), { recursive: true });
  await appendFile(snapshotsFile, `${JSON.stringify(snapshot)}\n`, "utf8");

  return snapshot;
}

export async function safePersistScanSnapshot(input: PersistScanSnapshotInput) {
  try {
    return await persistScanSnapshot(input);
  } catch (error) {
    console.warn(
      "Failed to persist scan snapshot:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export async function getRecentScanSnapshots(limit = 20) {
  try {
    const content = await readFile(snapshotsFile, "utf8");
    const snapshots = content
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as StoredScanSnapshot);

    return snapshots.slice(-limit).reverse();
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

export function summarizeScanSnapshots(snapshots: StoredScanSnapshot[]) {
  const summary = {
    snapshotCount: snapshots.length,
    resultCount: 0,
    latestAt: snapshots[0]?.createdAt ?? null,
    byMode: {} as Record<ScanSnapshotMode, number>,
    bySignal: {} as Partial<Record<ScannerSignalState, number>>,
    byPhase: {} as Partial<Record<MarketPhase, number>>,
    byAlignment: {} as Partial<Record<MultiTimeframeAlignment, number>>,
  };

  for (const snapshot of snapshots) {
    summary.byMode[snapshot.mode] = (summary.byMode[snapshot.mode] ?? 0) + 1;
    summary.resultCount += snapshot.results.length;

    for (const result of snapshot.results) {
      summary.bySignal[result.signalState] =
        (summary.bySignal[result.signalState] ?? 0) + 1;
      summary.byPhase[result.phase] = (summary.byPhase[result.phase] ?? 0) + 1;

      const alignment = result.multiTimeframe?.alignment;
      if (alignment) {
        summary.byAlignment[alignment] =
          (summary.byAlignment[alignment] ?? 0) + 1;
      }
    }
  }

  return summary;
}

function toStoredResult(result: ScanResult): StoredScanResult {
  return {
    symbol: result.symbol,
    timeframe: result.timeframe,
    price: result.price,
    phase: result.phase,
    signalState: result.signal.state,
    signalLabel: result.signal.label,
    rankScore: result.rankScore,
    opportunityScore: result.opportunityScore,
    confirmationScore: result.confirmationScore,
    riskScore: result.riskScore,
    multiTimeframe: result.multiTimeframe
      ? {
          alignment: result.multiTimeframe.alignment,
          label: result.multiTimeframe.label,
          rankScore: result.multiTimeframe.rankScore,
          constructiveCount: result.multiTimeframe.constructiveCount,
          riskCount: result.multiTimeframe.riskCount,
          timeframes: result.multiTimeframe.timeframes,
        }
      : undefined,
  };
}
