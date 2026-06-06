import { describe, expect, it } from "vitest";
import type { ScanResult } from "@/lib/scanner/types";
import { createDisabledStorageAdapter } from "./storageAdapter";
import { runResearchEvaluationJob } from "./researchEvaluationJob";
import { ScanSignalSqliteStore } from "./sqlite/scanSignalSqlite";

describe("research evaluation job", () => {
  it("returns a disabled result when research storage is disabled", async () => {
    const result = await runResearchEvaluationJob({
      storage: createDisabledStorageAdapter(),
      horizon: "24h",
    });

    expect(result.storageMode).toBe("disabled");
    expect(result.checked).toBe(0);
    expect(result.evaluated).toBe(0);
  });

  it("records insufficient data without throwing", async () => {
    const store = new ScanSignalSqliteStore(":memory:");

    try {
      await seedSignal(store);
      const result = await runResearchEvaluationJob({
        storage: store,
        horizon: "24h",
        getCandles: () => [],
      });
      const evaluations = await store.listForwardEvaluations({ horizon: "24h" });

      expect(result.checked).toBe(1);
      expect(result.insufficientData).toBe(1);
      expect(result.errors).toBe(0);
      expect(evaluations[0].outcomeLabel).toBe("insufficient_data");
    } finally {
      store.close();
    }
  });
});

async function seedSignal(store: ScanSignalSqliteStore) {
  await store.persistScanResults({
    createdAt: "2026-05-25T00:00:00.000Z",
    timeframe: "4h",
    source: "local",
    results: [makeResult()],
  });
}

function makeResult(): ScanResult {
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
  };
}
