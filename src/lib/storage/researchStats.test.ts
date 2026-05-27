import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ScanResult } from "@/lib/scanner/types";
import { cleanupTestTempDir, createTestTempDir } from "@/lib/test/testTempDir";
import type { SignalForwardEvaluation } from "./scanEvaluation";
import { getResearchStats } from "./researchStats";
import { ScanSignalSqliteStore } from "./sqlite/scanSignalSqlite";

describe("research stats", () => {
  it("handles an empty SQLite database", async () => {
    const dir = await createTestTempDir("research-stats-empty");

    try {
      const dbPath = path.join(dir, "research.sqlite");
      const stats = await getResearchStats({
        storageMode: "sqlite",
        sqliteDbPath: dbPath,
      });

      expect(stats.totalSignals).toBe(0);
      expect(stats.latestEvaluationTime).toBeUndefined();
      expect(stats.bySignalLabel).toEqual([]);
    } finally {
      await cleanupTestTempDir(dir);
    }
  });

  it("summarizes signals, evaluations, risk types, and scoring versions", async () => {
    const dir = await createTestTempDir("research-stats-records");
    const dbPath = path.join(dir, "research.sqlite");
    const store = new ScanSignalSqliteStore(dbPath);

    try {
      try {
        const confirmed = await seedSignal(store, "confirmed", "BTCUSDT", []);
        const distribution = await seedSignal(store, "distribution_risk", "ETHUSDT", [
          "distribution_risk",
        ]);
        await store.saveForwardEvaluations([
          makeEvaluation(confirmed.id, { outcomeLabel: "favorable" }),
          makeEvaluation(distribution.id, {
            outcomeLabel: "insufficient_data",
            evaluationTime: null,
            priceAtEvaluation: null,
            returnPct: null,
            maxReturnPct: null,
            maxDrawdownPct: null,
          }),
        ]);
      } finally {
        store.close();
      }

      const stats = await getResearchStats({
        storageMode: "sqlite",
        sqliteDbPath: dbPath,
      });

      expect(stats.totalSignals).toBe(2);
      expect(stats.totalEvaluations).toBe(2);
      expect(stats.insufficientDataCount).toBe(1);
      expect(stats.bySignalLabel).toEqual(
        expect.arrayContaining([
          { signalLabel: "confirmed", count: 1 },
          { signalLabel: "distribution_risk", count: 1 },
        ]),
      );
      expect(stats.byActionBias).toEqual(
        expect.arrayContaining([
          { actionBias: "eligible", count: 1 },
          { actionBias: "avoid", count: 1 },
        ]),
      );
      expect(stats.byRiskType).toEqual([
        { riskType: "distribution_risk", count: 1 },
      ]);
      expect(stats.scoringVersions[0]).toMatchObject({
        scoringVersion: "explainable-v1",
        count: 2,
      });
    } finally {
      await cleanupTestTempDir(dir);
    }
  });
});

async function seedSignal(
  store: ScanSignalSqliteStore,
  signalLabel: ScanResult["signalLabel"],
  symbol: string,
  detectedRiskTypes: ScanResult["detectedRiskTypes"],
) {
  const { signals } = await store.persistScanResults({
    createdAt: `2026-05-25T00:00:00.000Z-${symbol}`,
    timeframe: "4h",
    source: "local",
    results: [
      makeResult({
        symbol,
        signalLabel,
        detectedRiskTypes,
        actionBias: signalLabel === "distribution_risk" ? "avoid" : "eligible",
        primaryStructure:
          signalLabel === "distribution_risk" ? "distribution_risk" : "strong_trend",
      }),
    ],
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
    signalLabel: "confirmed",
    actionBias: "eligible",
    primaryStructure: "strong_trend",
    secondaryStructures: ["trend_aligned"],
    detectedRiskTypes: [],
    bullishFactors: [],
    bearishFactors: [],
    riskFactors: [],
    neutralFactors: [],
    nextConfirmationText: [],
    invalidationText: [],
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
    ...overrides,
  };
}
