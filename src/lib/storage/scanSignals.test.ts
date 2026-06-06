import { describe, expect, it } from "vitest";
import { toScanSignalRecords, toScanSnapshotRecord } from "./scanSignalModel";
import type { ScanResult } from "@/lib/scanner/types";

describe("scan signal persistence model", () => {
  it("serializes scores, labels, structures, risk types, and raw metrics", () => {
    const snapshot = toScanSnapshotRecord({
      createdAt: "2026-05-25T00:00:00.000Z",
      timeframe: "4h",
      source: "local",
      results: [makeResult()],
      marketContext: { universe: "test" },
    });
    const [signal] = toScanSignalRecords({
      snapshot,
      results: [makeResult()],
    });

    expect(snapshot.scoringVersion).toBe("explainable-v1");
    expect(signal.finalSignalScore).toBe(72.5);
    expect(signal.signalLabel).toBe("confirmed");
    expect(signal.actionBias).toBe("eligible");
    expect(signal.primaryStructure).toBe("strong_trend");
    expect(JSON.parse(signal.detectedRiskTypesJson)).toEqual(["overheat_risk"]);
    expect(JSON.parse(signal.rawMetricsJson)).toMatchObject({
      price: 100,
      rsi: 58,
      closeAboveMA20: true,
    });
    expect(JSON.parse(signal.bullishObservationsJson)).toEqual([
      { key: "factor.rsiHealthyRepair", severity: "positive", scope: "momentum" },
    ]);
    expect(JSON.parse(signal.riskObservationsJson)).toEqual([
      { key: "risk.overheat", severity: "risk", scope: "risk" },
    ]);
    expect(JSON.parse(signal.nextConfirmationObservationsJson)).toEqual([
      { key: "confirmation.reclaimMa50", severity: "neutral", scope: "confirmation" },
    ]);
    expect(signal.legacySignal).toBe("CONFIRMED");
    expect(signal.legacyRankScore).toBe(72.5);
  });
});

function makeResult(): ScanResult {
  return {
    exchange: "binance",
    symbol: "BTCUSDT",
    timeframe: "4h",
    price: 100,
    phase: "TRENDING",
    signal: {
      state: "CONFIRMED",
      label: "confirmed",
      summary: "confirmed / eligible",
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
    detectedRiskTypes: ["overheat_risk"],
    bullishObservations: [
      { key: "factor.rsiHealthyRepair", severity: "positive", scope: "momentum" },
    ],
    bearishObservations: [],
    riskObservations: [{ key: "risk.overheat", severity: "risk", scope: "risk" }],
    neutralObservations: [],
    nextConfirmationObservations: [
      { key: "confirmation.reclaimMa50", severity: "neutral", scope: "confirmation" },
    ],
    invalidationObservations: [
      {
        key: "invalidation.loseMa20Repair",
        severity: "warning",
        scope: "invalidation",
      },
    ],
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
