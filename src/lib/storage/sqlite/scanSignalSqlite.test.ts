import { writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ScanResult } from "@/lib/scanner/types";
import { scannerCodeVersions } from "@/lib/scanner-codebook/codeRegistry";
import { cleanupTestTempDir, createTestTempDir } from "@/lib/test/testTempDir";
import { safeJsonParse } from "../json";
import type { SignalForwardEvaluation } from "../scanEvaluation";
import { toScanSignalRecords, toScanSnapshotRecord } from "../scanSignalModel";
import { migrateJsonlResearchToSqlite } from "./migrateJsonlToSqlite";
import { ScanSignalSqliteStore } from "./scanSignalSqlite";

describe("SQLite scanner research storage", () => {
  it("initializes schema tables and indexes", async () => {
    const store = new ScanSignalSqliteStore(":memory:");
    try {
      const signals = await store.listScanSignals({ limit: 10 });
      expect(signals).toEqual([]);
    } finally {
      store.close();
    }
  });

  it("saves and reads scan signals without clamping scores", async () => {
    const store = new ScanSignalSqliteStore(":memory:");
    try {
      await store.persistScanResults({
        createdAt: "2026-05-25T00:00:00.000Z",
        timeframe: "4h",
        source: "local",
        results: [
          makeResult({
            symbol: "NEGUSDT",
            finalSignalScore: -25,
            riskScore: 125,
          }),
        ],
      });

      const [signal] = await store.listScanSignals({ limit: 10 });
      expect(signal.finalSignalScore).toBe(-25);
      expect(signal.riskScore).toBe(125);
      expect(signal.confirmationScore).toBe(85);
      expect(safeJsonParse(signal.detectedRiskTypesJson, [])).toEqual([]);
      expect(safeJsonParse(signal.rawMetricsJson, {})).toMatchObject({
        codeContract: {
          signalCodes: ["PX_501"],
          riskCodes: [],
        },
      });
    } finally {
      store.close();
    }
  });

  it("upserts duplicate evaluations by signalId and horizon", async () => {
    const store = new ScanSignalSqliteStore(":memory:");
    try {
      const signal = await seedSignal(store, "confirmed");
      const evaluation = makeEvaluation(signal.id, {
        outcomeLabel: "favorable",
        returnPct: 5,
      });
      await store.saveForwardEvaluations([evaluation, evaluation]);

      const rows = await store.listForwardEvaluations({ horizon: "24h" });
      expect(rows).toHaveLength(1);
      expect(rows[0].returnPct).toBe(5);
    } finally {
      store.close();
    }
  });

  it("aggregates performance by label with SQL", async () => {
    const store = new ScanSignalSqliteStore(":memory:");
    try {
      const confirmed = await seedSignal(store, "confirmed");
      const watch = await seedSignal(store, "watch", "WATCHUSDT");
      const distribution = await seedSignal(
        store,
        "distribution_risk",
        "DISTUSDT",
      );
      await store.saveForwardEvaluations([
        makeEvaluation(confirmed.id, { outcomeLabel: "favorable", returnPct: 4 }),
        makeEvaluation(watch.id, { outcomeLabel: "unfavorable", returnPct: -3 }),
        makeEvaluation(distribution.id, {
          outcomeLabel: "favorable",
          returnPct: -2,
        }),
      ]);

      const groups = await store.getSignalPerformanceByLabel({ horizon: "24h" });
      const confirmedGroup = groups.find((group) => group.group === "PX_501");
      expect(confirmedGroup).toMatchObject({
        count: 1,
        completedCount: 1,
        avgReturnPct: 4,
        favorableRate: 1,
        unfavorableRate: 0,
      });
    } finally {
      store.close();
    }
  });

  it("migrates JSONL fixtures into SQLite idempotently", async () => {
    const dir = await createTestTempDir("sqlite-research-migration");
    const dbPath = path.join(dir, "research.sqlite");
    const snapshotsFile = path.join(dir, "snapshots.jsonl");
    const signalsFile = path.join(dir, "signals.jsonl");
    const evaluationsFile = path.join(dir, "evaluations.jsonl");

    try {
      const snapshot = toScanSnapshotRecord({
        createdAt: "2026-05-25T00:00:00.000Z",
        timeframe: "4h",
        source: "local",
        results: [makeResult()],
      });
      const [signal] = toScanSignalRecords({
        snapshot,
        results: [makeResult()],
      });
      const evaluation = makeEvaluation(signal.id, { outcomeLabel: "favorable" });
      await writeFile(snapshotsFile, `${JSON.stringify(snapshot)}\n`, "utf8");
      await writeFile(signalsFile, `${JSON.stringify(signal)}\n`, "utf8");
      await writeFile(evaluationsFile, `${JSON.stringify(evaluation)}\n`, "utf8");

      await migrateJsonlResearchToSqlite({
        dbPath,
        snapshotsFile,
        signalsFile,
        evaluationsFile,
      });
      await migrateJsonlResearchToSqlite({
        dbPath,
        snapshotsFile,
        signalsFile,
        evaluationsFile,
      });

      const store = new ScanSignalSqliteStore(dbPath);
      try {
        expect(await store.listScanSignals({ limit: 10 })).toHaveLength(1);
        expect(await store.listForwardEvaluations({ horizon: "24h" })).toHaveLength(1);
      } finally {
        store.close();
      }
    } finally {
      await cleanupTestTempDir(dir);
    }
  });
});

async function seedSignal(
  store: ScanSignalSqliteStore,
  signalLabel: ScanResult["signalLabel"],
  symbol = `${signalLabel.toUpperCase()}USDT`,
) {
  const { signals } = await store.persistScanResults({
    createdAt: `2026-05-25T00:00:00.000Z-${symbol}`,
    timeframe: "4h",
    source: "local",
    results: [makeResult({ symbol, signalLabel })],
  });
  return signals[0];
}

function makeEvaluation(
  signalId: string,
  overrides: Partial<SignalForwardEvaluation> = {},
): SignalForwardEvaluation {
  return {
    id: `${signalId}:24h`,
    signalId,
    symbol: "BTCUSDT",
    timeframe: "4h",
    signalTime: "2026-05-25T00:00:00.000Z",
    evaluationTime: "2026-05-26T00:00:00.000Z",
    horizon: "24h",
    priceAtSignal: 100,
    priceAtEvaluation: 104,
    returnPct: 4,
    maxReturnPct: 6,
    maxDrawdownPct: -2,
    stillAboveMA20: true,
    stillAboveMA50: true,
    stillAboveMA200: true,
    rsiAtEvaluation: 58,
    riskScoreAtEvaluation: 20,
    confirmationScoreAtEvaluation: 80,
    signalLabelAtEvaluation: "confirmed",
    actionBiasAtEvaluation: "eligible",
    outcomeLabel: "favorable",
    notesJson: "[]",
    metricsJson: "{}",
    ...overrides,
  };
}

function makeResult(overrides: Partial<ScanResult> = {}): ScanResult {
  const signalLabel = overrides.signalLabel ?? "confirmed";
  const isRiskSignal = signalLabel === "distribution_risk";
  const signalCode = isRiskSignal
    ? "RK_302"
    : signalLabel === "watch"
      ? "MO_202"
      : "PX_501";
  const actionCode = isRiskSignal
    ? "AC_302"
    : signalLabel === "watch"
      ? "AC_101"
      : "AC_501";
  const setupCode = isRiskSignal ? "ST_302" : "TR_601";
  const riskCodes = isRiskSignal ? ["RK_302"] : [];

  return {
    exchange: "binance",
    symbol: "BTCUSDT",
    timeframe: "4h",
    price: 100,
    phase: "TRENDING",
    signal: {
      state: "CONFIRMED",
      label: "Confirmed",
      summary: "Confirmed",
    },
    opportunityScore: 70,
    confirmationScore: 85,
    riskScore: 20,
    trendScore: 110,
    momentumScore: 45,
    volumeScore: 20,
    structureScore: 90,
    finalSignalScore: 72.5,
    rankScore: 72.5,
    signalLabel,
    actionBias: signalLabel === "distribution_risk" ? "avoid" : "eligible",
    primaryStructure:
      signalLabel === "distribution_risk" ? "distribution_risk" : "strong_trend",
    secondaryStructures: ["trend_aligned"],
    detectedRiskTypes: isRiskSignal ? ["distribution_risk"] : [],
    bullishObservations: [],
    bearishObservations: [],
    riskObservations: [],
    neutralObservations: [],
    nextConfirmationObservations: [],
    invalidationObservations: [],
    rawMetrics: {
      price: 100,
      rsi: 58,
      bbPercent: 65,
      volumeRatio: 1.2,
      macdState: "improving",
      closeAboveMA20: true,
      closeAboveMA50: true,
      closeAboveMA200: true,
      ma20AboveMA50: true,
      ma50AboveMA200: true,
    },
    rsi14: 58,
    bbPercent: 65,
    bbWidthPercentile: 50,
    volumeRatio: 1.2,
    volume: {
      latest: 1000,
      ma20: 900,
      ma50: 850,
      ratio20: 1.2,
      ratio50: 1.3,
      dryUp: false,
      expanding: false,
      abnormalSpike: false,
      breakoutConfirmed: false,
      pullbackHealthy: false,
      distributionWarning: false,
    },
    maStatus: {
      aboveMA20: true,
      aboveMA50: true,
      aboveMA200: true,
      ma20AboveMA50: true,
      ma50AboveMA200: true,
    },
    reasons: [],
    warnings: [],
    nextConfirmation: [],
    invalidation: [],
    dataQuality: {
      candleCount: 300,
      sufficientHistory: true,
      missingIndicators: [],
    },
    codeContract: {
      exchange: "binance",
      symbol: overrides.symbol ?? "BTCUSDT",
      timeframe: "4h",
      groupCode: isRiskSignal ? "GR_301" : "GR_501",
      actionCode,
      riskCode: riskCodes[0] ?? null,
      riskCodes,
      setupCode,
      phaseCode: "TR_202",
      reasonCodes: [],
      signalCodes: [signalCode],
      qualityCodes: ["QH_001"],
      metrics: {
        rankScore: overrides.rankScore ?? 72.5,
        riskAdjustedScore: overrides.finalSignalScore ?? 72.5,
        setupQualityScore: 70,
        confidenceScore: 85,
        absoluteSetupScore: 70,
        universePercentile: null,
        trendScore: 110,
        momentumScore: 45,
        structureScore: 90,
        volatilityScore: 50,
        volumeScore: 20,
        mtfAgreementScore: 50,
        riskPenalty: overrides.riskScore ?? 20,
        qualityPenalty: 0,
        historyBars: 300,
        volumeRank: 1.2,
        volatilityPercentile: 50,
        atrExtension: null,
        distanceFromBase: null,
        scoringModelVersion: "quant-factor-v1",
        scoringCalibrationVersion: "deterministic-baseline-1",
        score: overrides.rankScore ?? 72.5,
        finalSignalScore: overrides.finalSignalScore ?? 72.5,
        opportunityScore: 70,
        confirmationScore: 85,
        riskScore: overrides.riskScore ?? 20,
        qualityScore: 100,
        price: 100,
        rsi14: 58,
        bbPercent: 65,
        bbWidthPercentile: 50,
        volumeRatio: 1.2,
      },
      ...scannerCodeVersions,
    },
    ...overrides,
  };
}
