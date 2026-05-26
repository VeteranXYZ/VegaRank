import { describe, expect, it } from "vitest";
import {
  filterAndSortResults,
  getSignalSummary,
  initialScannerFilters,
  mergeBatchScanResponses,
  shouldUseBatchedMtfScan,
  shouldUseBatchedScan,
  type ScannerFiltersState,
} from "./ScannerPageClient";
import type {
  MarketPhase,
  ScannerSignal,
  ScannerSignalState,
  ScanResult,
} from "@/lib/shared/scannerTypes";

describe("scanner result filtering", () => {
  it("defaults the display count to 50 rows", () => {
    expect(initialScannerFilters.limit).toBe(50);
  });

  it("filters by signal before sorting the result set", () => {
    const rows = filterAndSortResults(
      [
        makeResult({
          symbol: "AAAUSDT",
          signalState: "HIGH_RISK",
          phase: "OVEREXTENDED",
          rankScore: 90,
        }),
        makeResult({
          symbol: "BBBUSDT",
          signalState: "WATCHLIST",
          phase: "SQUEEZE",
          rankScore: 50,
        }),
        makeResult({
          symbol: "CCCUSDT",
          signalState: "WATCHLIST",
          phase: "BASE_BUILDING",
          rankScore: 70,
        }),
      ],
      makeFilters({ signal: "WATCHLIST" }),
    );

    expect(rows.map((row) => row.symbol)).toEqual(["CCCUSDT", "BBBUSDT"]);
  });

  it("combines signal, phase, opportunity, and risk filters", () => {
    const rows = filterAndSortResults(
      [
        makeResult({
          symbol: "AAAUSDT",
          signalState: "WATCHLIST",
          phase: "SQUEEZE",
          opportunityScore: 80,
          riskScore: 20,
        }),
        makeResult({
          symbol: "BBBUSDT",
          signalState: "WATCHLIST",
          phase: "BASE_BUILDING",
          opportunityScore: 80,
          riskScore: 20,
        }),
        makeResult({
          symbol: "CCCUSDT",
          signalState: "WATCHLIST",
          phase: "SQUEEZE",
          opportunityScore: 60,
          riskScore: 20,
        }),
        makeResult({
          symbol: "DDDUSDT",
          signalState: "WATCHLIST",
          phase: "SQUEEZE",
          opportunityScore: 80,
          riskScore: 45,
        }),
      ],
      makeFilters({
        signal: "WATCHLIST",
        phase: "SQUEEZE",
        minOpportunityScore: 70,
        maxRiskScore: 30,
      }),
    );

    expect(rows.map((row) => row.symbol)).toEqual(["AAAUSDT"]);
  });

  it("sorts MTF rows by their confluence rank score", () => {
    const rows = filterAndSortResults(
      [
        makeResult({
          symbol: "AAAUSDT",
          signalState: "NEUTRAL",
          phase: "BASE_BUILDING",
          rankScore: 20,
        }),
        makeResult({
          symbol: "BBBUSDT",
          signalState: "TREND_CONTINUATION",
          phase: "TRENDING",
          rankScore: 80,
        }),
      ],
      makeFilters({ mode: "mtf", mtfPreset: "swing" }),
    );

    expect(rows.map((row) => row.symbol)).toEqual(["BBBUSDT", "AAAUSDT"]);
  });
});

describe("scanner signal summary", () => {
  it("counts all signal states in display order", () => {
    const summary = getSignalSummary([
      makeResult({
        symbol: "AAAUSDT",
        signalState: "WATCHLIST",
        phase: "SQUEEZE",
      }),
      makeResult({
        symbol: "BBBUSDT",
        signalState: "WATCHLIST",
        phase: "BASE_BUILDING",
      }),
      makeResult({
        symbol: "CCCUSDT",
        signalState: "HIGH_RISK",
        phase: "OVEREXTENDED",
      }),
    ]);

    expect(summary).toEqual([
      { signal: "ALL", count: 3 },
      { signal: "WATCHLIST", count: 2 },
      { signal: "CONFIRMED", count: 0 },
      { signal: "TREND_CONTINUATION", count: 0 },
      { signal: "HIGH_RISK", count: 1 },
      { signal: "WEAK", count: 0 },
      { signal: "NEUTRAL", count: 0 },
    ]);
  });
});

describe("scanner batched fetch helpers", () => {
  it("uses batched scan mode for full remote single-timeframe scans only", () => {
    expect(shouldUseBatchedScan(makeFilters({ maxSymbols: "ALL" }))).toBe(true);
    expect(shouldUseBatchedScan(makeFilters({ maxSymbols: 100 }))).toBe(false);
    expect(shouldUseBatchedScan(makeFilters({ mode: "mtf" }))).toBe(false);
  });

  it("uses batched MTF scan mode for full remote MTF scans only", () => {
    expect(shouldUseBatchedMtfScan(makeFilters({ mode: "mtf" }))).toBe(true);
    expect(
      shouldUseBatchedMtfScan(makeFilters({ mode: "mtf", maxSymbols: 100 })),
    ).toBe(false);
    expect(shouldUseBatchedMtfScan(makeFilters({ mode: "single" }))).toBe(false);
  });

  it("combines, deduplicates, and sorts batch results by rank score", () => {
    const merged = mergeBatchScanResponses([
      {
        exchange: "binance",
        timeframe: "4h",
        source: "remote",
        universe: "all-eligible-usdt",
        eligibleCount: 4,
        scannedCount: 2,
        scannedInBatch: 2,
        failedCount: 1,
        skippedCount: 0,
        cached: true,
        cacheTtlSeconds: 3600,
        cacheExpiresAt: "2026-05-25T11:00:00.000Z",
        updatedAt: "2026-05-25T10:00:00.000Z",
        durationMs: 100,
        batchMode: true,
        batchIndex: 1,
        totalBatches: 2,
        totalEligibleCount: 4,
        hasMore: true,
        nextCursor: 2,
        failureSummary: {
          insufficientHistory: 0,
          fetchFailed: 1,
          indicatorFailed: 0,
          subrequestLimitExceeded: 0,
          filteredLowVolume: 2,
          excludedStableOrLeveraged: 1,
        },
        results: [
          makeResult({
            symbol: "AAAUSDT",
            signalState: "WATCHLIST",
            phase: "SQUEEZE",
            rankScore: 20,
          }),
          makeResult({
            symbol: "BBBUSDT",
            signalState: "WATCHLIST",
            phase: "SQUEEZE",
            rankScore: 80,
          }),
        ],
        itemCount: 2,
      },
      {
        exchange: "binance",
        timeframe: "4h",
        source: "remote",
        universe: "all-eligible-usdt",
        eligibleCount: 4,
        scannedCount: 2,
        scannedInBatch: 2,
        failedCount: 0,
        skippedCount: 0,
        cached: true,
        cacheTtlSeconds: 3600,
        cacheExpiresAt: "2026-05-25T11:00:00.000Z",
        updatedAt: "2026-05-25T10:01:00.000Z",
        durationMs: 150,
        batchMode: true,
        batchIndex: 2,
        totalBatches: 2,
        totalEligibleCount: 4,
        hasMore: false,
        nextCursor: null,
        failureSummary: {
          insufficientHistory: 1,
          fetchFailed: 0,
          indicatorFailed: 0,
          subrequestLimitExceeded: 0,
          filteredLowVolume: 2,
          excludedStableOrLeveraged: 1,
        },
        results: [
          makeResult({
            symbol: "CCCUSDT",
            signalState: "WATCHLIST",
            phase: "SQUEEZE",
            rankScore: 60,
          }),
          makeResult({
            symbol: "AAAUSDT",
            signalState: "WATCHLIST",
            phase: "SQUEEZE",
            rankScore: 40,
          }),
        ],
        itemCount: 2,
      },
    ]);

    expect(merged.results.map((result) => result.symbol)).toEqual([
      "BBBUSDT",
      "CCCUSDT",
      "AAAUSDT",
    ]);
    expect(merged.scannedCount).toBe(4);
    expect(merged.failedCount).toBe(1);
    expect(merged.durationMs).toBe(250);
    expect(merged.failureSummary).toMatchObject({
      insufficientHistory: 1,
      fetchFailed: 1,
      filteredLowVolume: 2,
      excludedStableOrLeveraged: 1,
    });
  });

  it("combines MTF batches by exchange and symbol before sorting", () => {
    const merged = mergeBatchScanResponses([
      {
        exchange: "binance",
        mode: "mtf",
        preset: "short",
        source: "remote",
        universe: "all-eligible-usdt",
        eligibleCount: 3,
        scannedCount: 2,
        scannedInBatch: 2,
        failedCount: 0,
        skippedCount: 0,
        cached: true,
        cacheTtlSeconds: 3600,
        cacheExpiresAt: "2026-05-25T11:00:00.000Z",
        updatedAt: "2026-05-25T10:00:00.000Z",
        durationMs: 100,
        batchMode: true,
        batchIndex: 1,
        totalBatches: 2,
        totalEligibleCount: 3,
        hasMore: true,
        nextCursor: 2,
        failureSummary: emptyFailureSummary(),
        results: [
          makeResult({
            symbol: "AAAUSDT",
            signalState: "WATCHLIST",
            phase: "SQUEEZE",
            rankScore: 30,
          }),
          makeResult({
            symbol: "BBBUSDT",
            signalState: "WATCHLIST",
            phase: "SQUEEZE",
            rankScore: 90,
          }),
        ],
        itemCount: 2,
      },
      {
        exchange: "binance",
        mode: "mtf",
        preset: "short",
        source: "remote",
        universe: "all-eligible-usdt",
        eligibleCount: 3,
        scannedCount: 1,
        scannedInBatch: 1,
        failedCount: 0,
        skippedCount: 0,
        cached: true,
        cacheTtlSeconds: 3600,
        cacheExpiresAt: "2026-05-25T11:00:00.000Z",
        updatedAt: "2026-05-25T10:01:00.000Z",
        durationMs: 100,
        batchMode: true,
        batchIndex: 2,
        totalBatches: 2,
        totalEligibleCount: 3,
        hasMore: false,
        nextCursor: null,
        failureSummary: emptyFailureSummary(),
        results: [
          makeResult({
            symbol: "AAAUSDT",
            signalState: "WATCHLIST",
            phase: "SQUEEZE",
            rankScore: 70,
          }),
        ],
        itemCount: 1,
      },
    ]);

    expect(merged.results.map((result) => result.symbol)).toEqual([
      "BBBUSDT",
      "AAAUSDT",
    ]);
    expect(merged.mode).toBe("mtf");
    expect(merged.scannedCount).toBe(3);
  });
});

function makeFilters(
  overrides: Partial<ScannerFiltersState> = {},
): ScannerFiltersState {
  return {
    mode: "single",
    source: "remote",
    timeframe: "4h",
    mtfPreset: "swing",
    signal: "ALL",
    phase: "ALL",
    minOpportunityScore: 0,
    maxRiskScore: 100,
    minQuoteVolume: 0,
    maxSymbols: "ALL",
    sortBy: "rankScore",
    limit: 50,
    ...overrides,
  };
}

function makeResult({
  symbol,
  signalState,
  phase,
  opportunityScore = 50,
  confirmationScore = 30,
  riskScore = 0,
  rankScore = 50,
}: {
  symbol: string;
  signalState: ScannerSignalState;
  phase: MarketPhase;
  opportunityScore?: number;
  confirmationScore?: number;
  riskScore?: number;
  rankScore?: number;
}): ScanResult {
  return {
    exchange: "binance",
    symbol,
    timeframe: "4h",
    price: 100,
    phase,
    signal: makeSignal(signalState),
    opportunityScore,
    confirmationScore,
    riskScore,
    rankScore,
    rsi14: 55,
    bbWidthPercentile: 20,
    volumeRatio: 1,
    volume: makeVolume(),
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

function makeVolume() {
  return {
    latest: 1000,
    ma20: 1000,
    ma50: 1000,
    ratio20: 1,
    ratio50: 1,
    quoteVolumeLatest: 100_000,
    quoteVolumeMA20: 100_000,
    dryUp: false,
    expanding: false,
    abnormalSpike: false,
    breakoutConfirmed: false,
    pullbackHealthy: false,
    distributionWarning: false,
    quietCompression: false,
  };
}

function makeSignal(state: ScannerSignalState): ScannerSignal {
  return {
    state,
    label: state,
    summary: state,
  };
}

function emptyFailureSummary() {
  return {
    insufficientHistory: 0,
    fetchFailed: 0,
    indicatorFailed: 0,
    subrequestLimitExceeded: 0,
    filteredLowVolume: 0,
    excludedStableOrLeveraged: 0,
  };
}
