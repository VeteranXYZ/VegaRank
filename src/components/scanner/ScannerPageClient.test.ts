import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchBatchedMtfScan,
  fetchBatchedSingleTimeframeScan,
  fetchSingleTimeframeScan,
  filterAndSortResults,
  getSignalSummary,
  getNextColumnSort,
  initialScannerFilters,
  mergeBatchScanResponses,
  sortResultsByColumn,
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
import {
  serializeScanResultToCodeContract,
  type ScannerCodeContractResult,
} from "@/lib/scanner-codebook/serializeScanResult";
import {
  phaseCodeByMarketPhase,
  scannerCodeVersions,
} from "@/lib/scanner-codebook/codeRegistry";

describe("scanner result filtering", () => {
  it("defaults the display count to 50 rows", () => {
    expect(initialScannerFilters.limit).toBe(50);
  });

  it("defaults the live scan range to 100 symbols instead of ALL", () => {
    expect(initialScannerFilters.maxSymbols).toBe(100);
  });

  it("keeps the default scanner source remote", () => {
    expect(initialScannerFilters.source).toBe("remote");
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

  it("sorts by score descending and ascending through column sort", () => {
    const rows = [
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
    ];

    expect(
      sortResultsByColumn(rows, { key: "score", direction: "desc" }).map(
        (row) => row.symbol,
      ),
    ).toEqual(["BBBUSDT", "AAAUSDT"]);
    expect(
      sortResultsByColumn(rows, { key: "score", direction: "asc" }).map(
        (row) => row.symbol,
      ),
    ).toEqual(["AAAUSDT", "BBBUSDT"]);
  });

  it("sorts symbol, RSI, volume, and warnings by column values", () => {
    const rows = [
      makeResult({
        symbol: "CCCUSDT",
        signalState: "WATCHLIST",
        phase: "SQUEEZE",
        rsi14: 40,
        volumeRatio: 0.8,
        warningCount: 2,
      }),
      makeResult({
        symbol: "AAAUSDT",
        signalState: "WATCHLIST",
        phase: "SQUEEZE",
        rsi14: 70,
        volumeRatio: 2.1,
        warningCount: 0,
      }),
      makeResult({
        symbol: "BBBUSDT",
        signalState: "WATCHLIST",
        phase: "SQUEEZE",
        rsi14: 55,
        volumeRatio: 1.4,
        warningCount: 1,
      }),
    ];

    expect(
      sortResultsByColumn(rows, { key: "symbol", direction: "asc" }).map(
        (row) => row.symbol,
      ),
    ).toEqual(["AAAUSDT", "BBBUSDT", "CCCUSDT"]);
    expect(
      sortResultsByColumn(rows, { key: "rsi", direction: "desc" }).map(
        (row) => row.symbol,
      ),
    ).toEqual(["AAAUSDT", "BBBUSDT", "CCCUSDT"]);
    expect(
      sortResultsByColumn(rows, { key: "vol", direction: "desc" }).map(
        (row) => row.symbol,
      ),
    ).toEqual(["AAAUSDT", "BBBUSDT", "CCCUSDT"]);
    expect(
      sortResultsByColumn(rows, { key: "warnings", direction: "desc" }).map(
        (row) => row.symbol,
      ),
    ).toEqual(["CCCUSDT", "BBBUSDT", "AAAUSDT"]);
  });

  it("cycles column sorting from default direction to opposite and back to preset sort", () => {
    const scoreDesc = getNextColumnSort(null, "score");
    expect(scoreDesc).toEqual({ key: "score", direction: "desc" });
    expect(getNextColumnSort(scoreDesc, "score")).toEqual({
      key: "score",
      direction: "asc",
    });
    expect(
      getNextColumnSort({ key: "score", direction: "asc" }, "score"),
    ).toBeNull();
    expect(getNextColumnSort(null, "symbol")).toEqual({
      key: "symbol",
      direction: "asc",
    });
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
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses batched scan mode for full remote single-timeframe scans only", () => {
    expect(shouldUseBatchedScan(makeFilters({ maxSymbols: "ALL" }))).toBe(true);
    expect(shouldUseBatchedScan(makeFilters({ maxSymbols: 100 }))).toBe(false);
    expect(shouldUseBatchedScan(makeFilters({ mode: "mtf" }))).toBe(false);
  });

  it("requests maxSymbols=100 for the default single-timeframe scan", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        exchange: "binance",
        timeframe: "4h",
        source: "remote",
        results: [],
        itemCount: 0,
        cached: false,
        updatedAt: "2026-05-25T10:00:00.000Z",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchSingleTimeframeScan(initialScannerFilters, {});

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("/api/rankings?");
    expect(url).toContain("maxSymbols=100");
    expect(url).not.toContain("batchMode=true");
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

  it("returns partial single-timeframe batch results when a later batch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse(
            makeBatchResponse({
              results: [
                makeResult({
                  symbol: "AAAUSDT",
                  signalState: "WATCHLIST",
                  phase: "SQUEEZE",
                  rankScore: 80,
                }),
              ],
              hasMore: true,
              nextCursor: 20,
              batchIndex: 1,
              totalBatches: 2,
            }),
          ),
        )
        .mockResolvedValueOnce(
          jsonResponse({ message: "Second batch failed." }, 502),
        ),
    );

    const result = await fetchBatchedSingleTimeframeScan(
      makeFilters({ maxSymbols: "ALL" }),
      {},
    );

    expect(result.results.map((item) => item.symbol)).toEqual(["AAAUSDT"]);
    expect(result.batchWarnings).toEqual([
      {
        code: "BATCH_REQUEST_FAILED",
        message: "Second batch failed.",
        cursor: 20,
      },
    ]);
  });

  it("throws when the first single-timeframe batch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(jsonResponse({ message: "First batch failed." }, 502)),
    );

    await expect(
      fetchBatchedSingleTimeframeScan(makeFilters({ maxSymbols: "ALL" }), {}),
    ).rejects.toThrow("First batch failed.");
  });

  it("returns partial MTF batch results when a later batch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse(
            makeBatchResponse({
              mode: "mtf",
              preset: "short",
              results: [
                makeResult({
                  symbol: "AAAUSDT",
                  signalState: "WATCHLIST",
                  phase: "SQUEEZE",
                  rankScore: 80,
                }),
              ],
              hasMore: true,
              nextCursor: 8,
              batchIndex: 1,
              totalBatches: 2,
            }),
          ),
        )
        .mockResolvedValueOnce(
          jsonResponse({ message: "Second MTF batch failed." }, 502),
        ),
    );

    const result = await fetchBatchedMtfScan(
      makeFilters({ mode: "mtf", maxSymbols: "ALL" }),
      {},
    );

    expect(result.results.map((item) => item.symbol)).toEqual(["AAAUSDT"]);
    expect(result.batchWarnings).toEqual([
      {
        code: "BATCH_REQUEST_FAILED",
        message: "Second MTF batch failed.",
        cursor: 8,
      },
    ]);
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
  rsi14 = 55,
  volumeRatio = 1,
  warningCount = 0,
}: {
  symbol: string;
  signalState: ScannerSignalState;
  phase: MarketPhase;
  opportunityScore?: number;
  confirmationScore?: number;
  riskScore?: number;
  rankScore?: number;
  rsi14?: number;
  volumeRatio?: number;
  warningCount?: number;
}): ScannerCodeContractResult {
  const signalSemantics = getSignalSemantics(signalState);
  const warningReasonCodes = ["NX_101", "NX_302"].slice(0, warningCount);
  const result: ScanResult = {
    exchange: "binance",
    symbol,
    timeframe: "4h",
    price: 100,
    phase,
    signal: makeSignal(signalState),
    opportunityScore,
    confirmationScore,
    riskScore,
    trendScore: 75,
    momentumScore: 45,
    volumeScore: 25,
    structureScore: 60,
    finalSignalScore: rankScore,
    rankScore,
    signalLabel: signalSemantics.signalLabel,
    actionBias: signalSemantics.actionBias,
    primaryStructure: signalSemantics.primaryStructure,
    secondaryStructures: [],
    detectedRiskTypes: signalSemantics.detectedRiskTypes,
    bullishObservations: [],
    bearishObservations: [],
    riskObservations: [],
    neutralObservations: [],
    nextConfirmationObservations: [],
    invalidationObservations: [],
    rawMetrics: {
      price: 100,
      rsi: rsi14,
      bbPercent: 55,
      volumeRatio,
      macdState: "improving",
      closeAboveMA20: true,
      closeAboveMA50: true,
      closeAboveMA200: true,
      ma20AboveMA50: true,
      ma50AboveMA200: true,
    },
    rsi14,
    bbPercent: 55,
    bbWidthPercentile: 20,
    volumeRatio,
    volume: makeVolume(volumeRatio),
    maStatus: {
      aboveMA20: true,
      aboveMA50: true,
      aboveMA200: true,
      ma20AboveMA50: true,
      ma50AboveMA200: true,
    },
    reasons: [],
    warnings: Array.from({ length: warningCount }, () => ({
      key: "warning.breakoutWithoutVolume" as const,
    })),
    nextConfirmation: [],
    invalidation: [],
    dataQuality: {
      candleCount: 300,
      sufficientHistory: true,
      missingIndicators: [],
    },
    codeContract: {
      exchange: "binance",
      symbol,
      timeframe: "4h",
      groupCode: signalSemantics.groupCode,
      actionCode: signalSemantics.actionCode,
      riskCode: signalSemantics.riskCodes[0] ?? null,
      riskCodes: signalSemantics.riskCodes,
      setupCode: signalSemantics.setupCode,
      phaseCode: phaseCodeByMarketPhase[phase],
      reasonCodes: warningReasonCodes,
      signalCodes: signalSemantics.signalCodes,
      qualityCodes: ["QH_001"],
      metrics: {
        rankScore,
        riskAdjustedScore: rankScore,
        setupQualityScore: opportunityScore,
        confidenceScore: confirmationScore,
        absoluteSetupScore: opportunityScore,
        universePercentile: null,
        trendScore: 75,
        momentumScore: 45,
        structureScore: 60,
        volatilityScore: 50,
        volumeScore: 25,
        mtfAgreementScore: 50,
        riskPenalty: riskScore,
        qualityPenalty: 0,
        historyBars: 300,
        volumeRank: volumeRatio,
        volatilityPercentile: 20,
        atrExtension: null,
        distanceFromBase: null,
        scoringModelVersion: "quant-factor-v1",
        scoringCalibrationVersion: "deterministic-baseline-1",
        score: rankScore,
        finalSignalScore: rankScore,
        opportunityScore,
        confirmationScore,
        riskScore,
        qualityScore: 100,
        price: 100,
        rsi14,
        bbPercent: 55,
        bbWidthPercentile: 20,
        volumeRatio,
      },
      ...scannerCodeVersions,
    },
  };

  return serializeScanResultToCodeContract(result);
}

function makeBatchResponse(
  overrides: Partial<{
    mode: "mtf";
    preset: "short";
    results: ScannerCodeContractResult[];
    hasMore: boolean;
    nextCursor: number | null;
    batchIndex: number;
    totalBatches: number;
  }> = {},
) {
  return {
    exchange: "binance" as const,
    timeframe: "4h" as const,
    source: "remote" as const,
    universe: "all-eligible-usdt",
    eligibleCount: 2,
    scannedCount: overrides.results?.length ?? 0,
    scannedInBatch: overrides.results?.length ?? 0,
    failedCount: 0,
    skippedCount: 0,
    cached: false,
    cacheTtlSeconds: 3600,
    cacheExpiresAt: "2026-05-25T11:00:00.000Z",
    updatedAt: "2026-05-25T10:00:00.000Z",
    durationMs: 100,
    batchMode: true as const,
    batchSize: 20,
    batchIndex: overrides.batchIndex ?? 1,
    totalBatches: overrides.totalBatches ?? 1,
    totalEligibleCount: 2,
    hasMore: overrides.hasMore ?? false,
    nextCursor: overrides.nextCursor ?? null,
    failureSummary: emptyFailureSummary(),
    results: overrides.results ?? [],
    itemCount: overrides.results?.length ?? 0,
    ...(overrides.mode
      ? {
          mode: overrides.mode,
          preset: overrides.preset,
        }
      : {}),
  };
}

function getSignalSemantics(signalState: ScannerSignalState) {
  switch (signalState) {
    case "CONFIRMED":
      return {
        signalLabel: "confirmed" as const,
        actionBias: "eligible" as const,
        primaryStructure: "strong_trend" as const,
        detectedRiskTypes: [],
        groupCode: "GR_501",
        actionCode: "AC_501",
        setupCode: "TR_601",
        signalCodes: ["PX_501"],
        reasonCodes: ["TR_501"],
        riskCodes: [],
      };
    case "TREND_CONTINUATION":
      return {
        signalLabel: "trend" as const,
        actionBias: "eligible" as const,
        primaryStructure: "strong_trend" as const,
        detectedRiskTypes: [],
        groupCode: "GR_601",
        actionCode: "AC_601",
        setupCode: "TR_601",
        signalCodes: ["TR_601"],
        reasonCodes: ["TR_501"],
        riskCodes: [],
      };
    case "HIGH_RISK":
      return {
        signalLabel: "overheated" as const,
        actionBias: "do_not_chase" as const,
        primaryStructure: "overextended" as const,
        detectedRiskTypes: ["overheat_risk" as const],
        groupCode: "GR_302",
        actionCode: "AC_301",
        setupCode: "ST_301",
        signalCodes: ["MO_340"],
        reasonCodes: ["MO_201"],
        riskCodes: ["RK_303"],
      };
    case "WEAK":
      return {
        signalLabel: "weak" as const,
        actionBias: "avoid" as const,
        primaryStructure: "trend_breakdown" as const,
        detectedRiskTypes: ["trend_breakdown_risk" as const],
        groupCode: "GR_301",
        actionCode: "AC_302",
        setupCode: "PX_303",
        signalCodes: ["PX_101"],
        reasonCodes: ["TR_301"],
        riskCodes: ["RK_302"],
      };
    case "NEUTRAL":
      return {
        signalLabel: "neutral" as const,
        actionBias: "ignore" as const,
        primaryStructure: "neutral" as const,
        detectedRiskTypes: [],
        groupCode: "GR_101",
        actionCode: "AC_101",
        setupCode: "ST_001",
        signalCodes: ["MO_001"],
        reasonCodes: [],
        riskCodes: [],
      };
    case "WATCHLIST":
    default:
      return {
        signalLabel: "watch" as const,
        actionBias: "watch_only" as const,
        primaryStructure: "breakout_attempt" as const,
        detectedRiskTypes: [],
        groupCode: "GR_201",
        actionCode: "AC_102",
        setupCode: "PX_201",
        signalCodes: ["MO_202"],
        reasonCodes: ["TR_501"],
        riskCodes: [],
      };
  }
}

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function makeVolume(ratio20 = 1) {
  return {
    latest: 1000,
    ma20: 1000,
    ma50: 1000,
    ratio20,
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
