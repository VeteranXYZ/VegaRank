import { describe, expect, it } from "vitest";
import type {
  LatestScanSignalRecord,
  ScanRunRecord,
} from "@/lib/storage/postgres/scannerResultsPg";
import { buildLatestScanResponse } from "./latestScanResponse";

describe("latest scan response", () => {
  it("filters low-quality symbols by default and preserves one scan run", () => {
    const response = buildLatestScanResponse({
      run: makeRun("run-1"),
      signals: [
        makeSignal({ id: "1", scanRunId: "run-1", symbol: "BTCUSDT", rankScore: 70 }),
        makeSignal({ id: "2", scanRunId: "run-1", symbol: "UUSDT", rankScore: 120 }),
      ],
      limit: 100,
      includeLowQuality: false,
    });

    expect(response.summary.totalSignals).toBe(1);
    expect(response.summary.lowQualityExcluded).toBe(1);
    expect(response.items.map((item) => item.symbol)).toEqual(["BTCUSDT"]);
    expect(new Set(response.items.map((item) => item.scanRunId))).toEqual(
      new Set(["run-1"]),
    );
  });

  it("groups results by trading semantics before rank score", () => {
    const response = buildLatestScanResponse({
      run: makeRun("run-2"),
      signals: [
        makeSignal({
          id: "1",
          scanRunId: "run-2",
          symbol: "SEIUSDT",
          signalLabel: "breakdown_risk",
          actionBias: "avoid",
          primaryStructure: "trend_breakdown",
          rankScore: 120,
        }),
        makeSignal({
          id: "2",
          scanRunId: "run-2",
          symbol: "ETHUSDT",
          signalLabel: "confirmed",
          actionBias: "eligible",
          primaryStructure: "strong_trend",
          rankScore: 80,
        }),
      ],
      limit: 100,
      includeLowQuality: true,
    });

    expect(response.items.map((item) => item.symbol)).toEqual(["ETHUSDT", "SEIUSDT"]);
    expect(response.groups.eligible).toHaveLength(1);
    expect(response.groups.risk).toHaveLength(1);
    expect(response.summary.breakdownRisk).toBe(1);
    expect(response.summary.confirmed).toBe(1);
  });
});

function makeRun(id: string): ScanRunRecord {
  return {
    id,
    exchange: "binance",
    market: "spot",
    mode: "single",
    timeframe: "4h",
    universe: "all-symbols",
    status: "success",
    symbolsTotal: 2,
    symbolsScanned: 2,
    signalsCreated: 2,
    symbolsSkipped: 0,
    failedSymbols: 0,
    params: {},
    errorMessage: null,
    startedAt: "2026-05-31T00:00:00.000Z",
    finishedAt: "2026-05-31T00:01:00.000Z",
  };
}

function makeSignal(
  overrides: Partial<LatestScanSignalRecord> & {
    id: string;
    scanRunId: string;
    symbol: string;
  },
): LatestScanSignalRecord {
  return {
    id: overrides.id,
    scanRunId: overrides.scanRunId,
    symbolId: 1,
    exchange: "binance",
    market: "spot",
    symbol: overrides.symbol,
    timeframe: "4h",
    scanTime: "2026-05-31T00:00:00.000Z",
    candleOpenTime: "2026-05-30T20:00:00.000Z",
    priceAtSignal: 1,
    rankScore: overrides.rankScore ?? 50,
    finalSignalScore: overrides.finalSignalScore ?? overrides.rankScore ?? 50,
    opportunityScore: 50,
    confirmationScore: 50,
    riskScore: 0,
    trendScore: 50,
    momentumScore: 50,
    volumeScore: 50,
    structureScore: 50,
    signalLabel: overrides.signalLabel ?? "confirmed",
    actionBias: overrides.actionBias ?? "eligible",
    primaryStructure: overrides.primaryStructure ?? "strong_trend",
    secondaryStructures: [],
    detectedRiskTypes: [],
    factors: {},
    nextConfirmation: null,
    invalidation: null,
    rawMetrics: {},
    scoringVersion: "test",
    scannerVersion: "test",
    createdAt: "2026-05-31T00:00:00.000Z",
    assetClass: overrides.assetClass ?? "crypto",
    isScannerEligible: overrides.isScannerEligible ?? true,
    isBacktestEligible: overrides.isBacktestEligible ?? true,
    isMarketContext: overrides.isMarketContext ?? false,
    candleCount: overrides.candleCount ?? 1000,
    firstOpenTime: overrides.firstOpenTime ?? "2024-01-01T00:00:00.000Z",
  };
}
