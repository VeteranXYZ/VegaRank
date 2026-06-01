import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const useQueryMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());
const searchParamsMock = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-query", () => ({
  useQuery: useQueryMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => searchParamsMock(),
}));

import {
  buildSignalEvaluationUrl,
  buildScannerReturnHref,
  buildSymbolResearchSwitchHref,
  buildSymbolResearchTimeframeHref,
  buildSymbolResearchUrl,
  formatSymbolResearchApiError,
  getSymbolResearchApiOriginLabel,
  getTradeApiBaseUrl,
  normalizeSymbolResearchInputSymbol,
  SymbolResearchPageClient,
  SymbolWatchlistControl,
} from "./SymbolResearchPageClient";
import type { WatchlistStorage } from "@/components/watchlist/watchlistUi";

const ORIGINAL_ENV = { ...process.env };

describe("symbol research API URL builder", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    process.env = { ...ORIGINAL_ENV, NODE_ENV: "test" };
    delete process.env.NEXT_PUBLIC_TRADE_API_BASE_URL;
  });

  afterAll(() => {
    vi.unstubAllEnvs();
    process.env = ORIGINAL_ENV;
  });

  it("uses NEXT_PUBLIC_TRADE_API_BASE_URL when present", () => {
    vi.stubEnv("NEXT_PUBLIC_TRADE_API_BASE_URL", "https://api.auere.com");

    const url = buildSymbolResearchUrl({
      exchange: "binance",
      symbol: "SEIUSDT",
    });

    expect(url.startsWith("https://api.auere.com")).toBe(true);
    expect(url).toContain("/api/symbol/research?");
  });

  it("falls back to same-origin symbol research API when the env var is missing", () => {
    expect(
      buildSymbolResearchUrl({
        exchange: "binance",
        symbol: "SEIUSDT",
      }),
    ).toBe(
      "/api/symbol/research?exchange=binance&market=spot&symbol=SEIUSDT&timeframe=4h&historyLimit=30&candleLimit=120&includeCandles=true&assetClass=crypto",
    );
  });

  it("uppercases symbol and defaults timeframe to 4h", () => {
    const url = buildSymbolResearchUrl({
      exchange: "binance",
      market: "spot",
      symbol: "seiusdt",
      tradeApiBaseUrl: "https://api.auere.com/",
    });

    expect(url).toContain("symbol=SEIUSDT");
    expect(url).toContain("timeframe=4h");
    expect(url.startsWith("https://api.auere.com/api/symbol/research")).toBe(true);
  });

  it("normalizes trailing slashes from the API base URL", () => {
    expect(getTradeApiBaseUrl("https://api.auere.com///")).toBe(
      "https://api.auere.com",
    );
  });

  it("builds broad-market signal evaluation URLs without symbol filters", () => {
    const url = buildSignalEvaluationUrl({
      tradeApiBaseUrl: "https://api.auere.com/",
      timeframe: "1h",
      assetClass: "crypto",
      group: "risk",
      signalLabel: "breakdown_risk",
    });

    expect(url).toBe(
      "https://api.auere.com/api/signal/evaluation?exchange=binance&market=spot&timeframe=1h&assetClass=crypto&group=risk&signalLabel=breakdown_risk",
    );
    expect(url).not.toContain("symbol=");
  });

  it("reports only the API origin for diagnostics", () => {
    expect(getSymbolResearchApiOriginLabel("https://api.auere.com")).toBe(
      "https://api.auere.com",
    );
    expect(getSymbolResearchApiOriginLabel("https://api.auere.com/")).toBe(
      "https://api.auere.com",
    );
    expect(getSymbolResearchApiOriginLabel(undefined)).toBe("same-origin");
    expect(getSymbolResearchApiOriginLabel("")).toBe("same-origin");
    expect(getSymbolResearchApiOriginLabel("/api")).toBe("same-origin");
  });

  it("formats HTTP and API error details without needing the full URL", () => {
    expect(
      formatSymbolResearchApiError(503, {
        ok: false,
        error: { code: "POSTGRES_UNAVAILABLE", message: "Database unavailable" },
      }),
    ).toBe("HTTP 503: POSTGRES_UNAVAILABLE: Database unavailable");
    expect(
      formatSymbolResearchApiError(null, {
        ok: false,
        error: "NO_LATEST_SIGNAL",
      }),
    ).toBe(
      "No scanner signal is available for this symbol/timeframe from the selected latest run.",
    );
    expect(
      formatSymbolResearchApiError(404, {
        ok: false,
        error: "SYMBOL_NOT_FOUND",
      }),
    ).toBe("Symbol not found in scanner universe.");
    expect(
      formatSymbolResearchApiError(400, {
        ok: false,
        error: "INVALID_TIMEFRAME",
      }),
    ).toBe("Invalid timeframe. Try 1h, 4h, 1d, or 1w.");
  });
});

describe("symbol research navigation helpers", () => {
  it("builds scanner return hrefs from preserved query state", () => {
    expect(
      buildScannerReturnHref(
        new URLSearchParams("from=scanner&timeframe=4h&assetClass=crypto&limit=100"),
      ),
    ).toBe("/scanner?timeframe=4h&assetClass=crypto&limit=100");
    expect(
      buildScannerReturnHref(
        new URLSearchParams(
          "timeframe=1d&assetClass=stable&includeLowQuality=true&limit=200",
        ),
      ),
    ).toBe(
      "/scanner?timeframe=1d&assetClass=stable&includeLowQuality=true&limit=200",
    );
    expect(buildScannerReturnHref(new URLSearchParams())).toBe("/scanner");
  });

  it("falls back to current symbol research context for scanner returns", () => {
    expect(
      buildScannerReturnHref(new URLSearchParams(), {
        timeframe: "1w",
        assetClass: "crypto",
      }),
    ).toBe("/scanner?timeframe=1w&assetClass=crypto");
    expect(
      buildScannerReturnHref(
        new URLSearchParams("limit=200&includeLowQuality=true"),
        {
          timeframe: "1d",
          assetClass: "stable",
        },
      ),
    ).toBe(
      "/scanner?timeframe=1d&assetClass=stable&includeLowQuality=true&limit=200",
    );
  });

  it("does not preserve false low-quality query state", () => {
    expect(
      buildScannerReturnHref(
        new URLSearchParams("timeframe=4h&includeLowQuality=false&limit=100"),
      ),
    ).toBe("/scanner?timeframe=4h&limit=100");
  });

  it("builds timeframe switch hrefs while preserving scanner context", () => {
    expect(
      buildSymbolResearchTimeframeHref({
        exchange: "binance",
        symbol: "seiusdt",
        timeframe: "1d",
        searchParams: new URLSearchParams(
          "timeframe=4h&assetClass=crypto&includeLowQuality=true&limit=100&from=scanner",
        ),
      }),
    ).toBe(
      "/symbol/binance/SEIUSDT?timeframe=1d&assetClass=crypto&includeLowQuality=true&limit=100&from=scanner",
    );
  });

  it("normalizes symbol input and builds symbol switch hrefs", () => {
    expect(normalizeSymbolResearchInputSymbol("  sei/usdt  ")).toBe("SEI/USDT");
    expect(normalizeSymbolResearchInputSymbol("   ")).toBe("");

    expect(
      buildSymbolResearchSwitchHref({
        exchange: "binance",
        symbol: "  ethusdt ",
        timeframe: "4h",
        searchParams: new URLSearchParams("assetClass=crypto&limit=100&from=scanner"),
      }),
    ).toBe("/symbol/binance/ETHUSDT?timeframe=4h&assetClass=crypto&limit=100&from=scanner");
  });
});

describe("SymbolResearchPageClient unavailable state", () => {
  beforeEach(() => {
    pushMock.mockReset();
    searchParamsMock.mockReset();
    searchParamsMock.mockReturnValue(
      new URLSearchParams("timeframe=1w&assetClass=crypto&from=scanner"),
    );
    useQueryMock.mockReset();
  });

  it("renders insufficient-history unavailable copy with navigation controls", () => {
    useQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
      data: {
        ok: false,
        error: "NO_LATEST_SIGNAL",
        errorCode: "NO_LATEST_SIGNAL",
        unavailableReason: "insufficient_history",
        message:
          "No 1w scanner signal for SEIUSDT. The latest full-universe 1w scan ran successfully, but SEIUSDT was skipped because it has only 145 weekly candles. The scanner currently requires 200 candles.",
        timeframe: "1w",
        symbol: {
          exchange: "binance",
          market: "spot",
          symbol: "SEIUSDT",
          assetClass: "crypto",
        },
        selectedRun: {
          id: "full-1w",
          timeframe: "1w",
          status: "success",
          symbolsTotal: 413,
          symbolsScanned: 192,
          symbolsSkipped: 221,
          signalsCreated: 192,
          finishedAt: "2026-06-01T04:00:00.000Z",
          isLikelyFullUniverse: true,
        },
        symbolCoverage: {
          timeframe: "1w",
          candleCount: 145,
          requiredCandles: 200,
          firstOpenTime: "2023-08-14T00:00:00.000Z",
          lastOpenTime: "2026-05-25T00:00:00.000Z",
        },
        behavior: null,
        behaviorDiagnostics: {
          available: false,
          reason: "no_latest_signal",
          message:
            "Historical behavior is unavailable because no latest scanner signal exists for this symbol/timeframe.",
        },
      },
    });

    const html = renderToStaticMarkup(
      createElement(SymbolResearchPageClient, {
        exchange: "binance",
        symbol: "SEIUSDT",
      }),
    );

    expect(html).toContain("Timeframe unavailable for this symbol");
    expect(html).toContain("No 1w scanner signal for SEIUSDT");
    expect(html).toContain("145 / 200 required");
    expect(html).toContain("1w full-universe run, success, scanned 192 / 413, skipped 221");
    expect(html).toContain("Timeframe Availability");
    expect(html).toContain("1w (selected)");
    expect(html).toContain("Insufficient history");
    expect(html).toContain("Not returned");
    expect(html).toContain("Open timeframe to check");
    expect(html).toContain("Try 4h or 1d for SEIUSDT.");
    expect(html).toContain(
      "Refresh after the next scanner run; 1w coverage updates as more weekly candles accrue.",
    );
    expect(html).toContain("Back to Scanner");
    expect(html).toContain("Refresh");
    expect(html).toContain("Open Symbol");
    expect(html).toContain('href="/scanner?timeframe=1w&amp;assetClass=crypto');
    expect(html).toContain('href="/symbol/binance/SEIUSDT?timeframe=4h');
    expect(html).toContain('href="/symbol/binance/SEIUSDT?timeframe=1d');
    expect(html).toContain('href="/symbol/binance/SEIUSDT?timeframe=1w');
    expect(html).toContain('href="/symbol/binance/SEIUSDT?timeframe=1h');
    expect(html).toContain("Historical Behavior");
    expect(html).toContain(
      "Current coverage: 145 / 200 required candles.",
    );
  });
});

describe("SymbolResearchPageClient success state", () => {
  beforeEach(() => {
    pushMock.mockReset();
    searchParamsMock.mockReset();
    searchParamsMock.mockReturnValue(
      new URLSearchParams("timeframe=4h&assetClass=crypto&from=scanner"),
    );
    useQueryMock.mockReset();
  });

  it("renders the historical behavior section from the research response", () => {
    useQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
      data: makeSuccessResponse(),
    });

    const html = renderToStaticMarkup(
      createElement(SymbolResearchPageClient, {
        exchange: "binance",
        symbol: "SEIUSDT",
      }),
    );

    expect(html).toContain("Research Decision Summary");
    expect(html).toContain("Constructive research context");
    expect(html).toContain("Suggested Research Posture");
    expect(html).toContain("Candidate for deeper research");
    expect(html).toContain("Historical Behavior");
    expect(html).toContain("Historical Follow-through Evaluation");
    expect(html).toContain("How similar prior signals behaved");
    expect(html).toContain("Sample size");
    expect(html).toContain("Forward horizon observations");
    expect(html).toContain("Current context");
    expect(html).toContain("Recent outcomes");
    expect(html).toContain("Most recent prior observations with available forward returns.");
    expect(html).toContain("In Watchlist");
    expect(html).toContain('href="/watchlist"');
  });

  it("renders the Signal Evaluation card from the broad-market response", () => {
    useQueryMock.mockImplementation(
      ({ queryKey }: { queryKey: [string, unknown] }) => ({
        isLoading: false,
        isError: false,
        isFetching: false,
        refetch: vi.fn(),
        data:
          queryKey[0] === "signal-evaluation"
            ? makeSignalEvaluationResponse()
            : makeSuccessResponse({
                latestSignal: makeSymbolResearchSignal({
                  resultGroup: "risk",
                  signalLabel: "breakdown_risk",
                  actionBias: "avoid",
                  primaryStructure: "trend_breakdown",
                }),
              }),
      }),
    );

    const html = renderToStaticMarkup(
      createElement(SymbolResearchPageClient, {
        exchange: "binance",
        symbol: "SEIUSDT",
      }),
    );
    const signalEvaluationCall = useQueryMock.mock.calls.find(
      ([options]) => options.queryKey[0] === "signal-evaluation",
    );

    expect(html).toContain("Signal Evaluation");
    expect(html).toContain(
      "How this type of scanner signal behaved across the broader market",
    );
    expect(html).toContain("Expected Direction");
    expect(html).toContain("Risk follow-through observed");
    expect(html).toContain(
      "Historical evaluation supports caution for this risk label.",
    );
    expect(signalEvaluationCall?.[0].queryKey[1]).toMatchObject({
      timeframe: "4h",
      assetClass: "crypto",
      group: "risk",
      signalLabel: "breakdown_risk",
    });
    expect(signalEvaluationCall?.[0].queryKey[1]).not.toHaveProperty("symbol");
  });
});

describe("SymbolWatchlistControl", () => {
  it("renders Add to Watchlist when the symbol is not saved", () => {
    const html = renderToStaticMarkup(
      createElement(SymbolWatchlistControl, {
        symbol: "SEIUSDT",
        storage: makeWatchlistStorage(JSON.stringify(["BTCUSDT"])),
      }),
    );

    expect(html).toContain("Add to Watchlist");
    expect(html).toContain("Open Watchlist");
    expect(html).toContain('href="/watchlist"');
    expect(html).not.toContain("In Watchlist");
  });

  it("renders In Watchlist when the symbol is already saved", () => {
    const html = renderToStaticMarkup(
      createElement(SymbolWatchlistControl, {
        symbol: "sei",
        storage: makeWatchlistStorage(JSON.stringify(["SEIUSDT"])),
      }),
    );

    expect(html).toContain("In Watchlist");
    expect(html).toContain("Open Watchlist");
    expect(html).not.toContain("Add to Watchlist");
  });

  it("fails gracefully when storage is unavailable", () => {
    expect(() =>
      renderToStaticMarkup(
        createElement(SymbolWatchlistControl, {
          symbol: "AAVEUSDT",
          storage: makeThrowingWatchlistStorage(),
        }),
      ),
    ).not.toThrow();
  });
});

function makeSuccessResponse({
  latestSignal = makeSymbolResearchSignal(),
}: {
  latestSignal?: ReturnType<typeof makeSymbolResearchSignal>;
} = {}) {
  return {
    ok: true,
    timeframe: "4h",
    symbol: {
      exchange: "binance",
      market: "spot",
      symbol: "SEIUSDT",
      assetClass: "crypto",
      qualityTier: "core",
      isLowQuality: false,
      qualityFlags: [],
    },
    latest: {
      scanRun: {
        id: "full-run",
        status: "success",
        timeframe: "4h",
        symbolsTotal: 413,
        symbolsScanned: 409,
        signalsCreated: 409,
        finishedAt: "2026-06-01T00:01:00.000Z",
      },
      signal: latestSignal,
    },
    currentSelection: {
      selectedRunId: "full-run",
      selectedSignalId: "signal-latest",
      selectedTimeframe: "4h",
      selectedRunStartedAt: "2026-06-01T00:00:00.000Z",
      selectedRunFinishedAt: "2026-06-01T00:01:00.000Z",
      selectedSignalScanTime: "2026-06-01T00:00:30.000Z",
      preferredFullUniverse: true,
      isLikelyFullUniverse: true,
      minExpectedSymbols: 300,
      fallbackUsed: false,
    },
    scoreBreakdown: {
      rankScore: 82,
      finalSignalScore: 76,
      opportunityScore: 74,
      confirmationScore: 68,
      riskScore: 14,
      trendScore: 72,
      momentumScore: 64,
      volumeScore: 54,
      structureScore: 80,
    },
    interpretation: {
      group: "eligible",
      label: "Confirmed",
      action: "Manual review",
      setupType: "Strong Trend",
      statusNote: "Manual review",
      reasons: ["Clean candidate."],
      nextConfirmation: ["Hold above range."],
      invalidation: ["Loses recent support."],
    },
    history: [makeSymbolResearchSignal()],
    timeframes: [makeSymbolResearchSignal()],
    behavior: {
      sampleSize: 12,
      horizons: {
        "1": {
          sampleSize: 11,
          avgReturnPct: 1.2,
          medianReturnPct: 0.8,
          winRatePct: 63.6,
          bestReturnPct: 5.3,
          worstReturnPct: -3.2,
        },
        "3": {
          sampleSize: 11,
          avgReturnPct: 2.2,
          medianReturnPct: 1.8,
          winRatePct: 72.7,
          bestReturnPct: 8.3,
          worstReturnPct: -4.2,
        },
        "5": {
          sampleSize: 11,
          avgReturnPct: 3.2,
          medianReturnPct: 2.8,
          winRatePct: 72.7,
          bestReturnPct: 10.3,
          worstReturnPct: -6.2,
        },
      },
      byResultGroup: [],
      bySignalLabel: [],
      recentOutcomes: [
        {
          scanTime: "2026-05-31T00:00:00.000Z",
          signalLabel: "confirmed",
          resultGroup: "eligible",
          priceAtSignal: 1.23,
          rankScore: 82,
          forwardReturnPct: { "1": 1.2, "3": 2.1, "5": 3.4 },
        },
      ],
      currentContext: {
        signalLabel: "confirmed",
        resultGroup: "eligible",
        primaryStructure: "strong_trend",
        timeframe: "4h",
      },
      warnings: [],
    },
    behaviorDiagnostics: {
      available: true,
      reason: "ok",
      message:
        "Historical behavior is available from prior scanner signals with forward candles.",
    },
    candles: {
      timeframe: "4h",
      count: 0,
      firstOpenTime: null,
      lastOpenTime: null,
      rows: [],
    },
  };
}

function makeSymbolResearchSignal(
  overrides: Partial<Record<string, unknown>> = {},
) {
  return {
    id: "signal-latest",
    scanRunId: "full-run",
    symbolId: 1,
    exchange: "binance",
    market: "spot",
    symbol: "SEIUSDT",
    timeframe: "4h",
    scanTime: "2026-06-01T00:00:30.000Z",
    candleOpenTime: "2026-05-31T20:00:00.000Z",
    priceAtSignal: 1.23,
    rankScore: 82,
    finalSignalScore: 76,
    opportunityScore: 74,
    confirmationScore: 68,
    riskScore: 14,
    trendScore: 72,
    momentumScore: 64,
    volumeScore: 54,
    structureScore: 80,
    signalLabel: "confirmed",
    actionBias: "eligible",
    resultGroup: "eligible",
    reviewTier: "eligible",
    statusNote: "Manual review",
    cautionLevel: "none",
    statusReasons: ["Clean candidate."],
    primaryStructure: "strong_trend",
    secondaryStructures: [],
    detectedRiskTypes: [],
    nextConfirmation: ["Hold above range."],
    invalidation: ["Loses recent support."],
    factors: {},
    rawMetrics: {},
    scoringVersion: "test",
    scannerVersion: "test",
    createdAt: "2026-06-01T00:00:31.000Z",
    scanRunStartedAt: "2026-06-01T00:00:00.000Z",
    scanRunFinishedAt: "2026-06-01T00:01:00.000Z",
    sourceRunIsLikelyFullUniverse: true,
    isSelectedCurrentRun: true,
    isNewerThanSelectedCurrentRun: false,
    ...overrides,
  };
}

function makeSignalEvaluationResponse() {
  return {
    ok: true,
    filters: {
      assetClass: "crypto",
      exchange: "binance",
      market: "spot",
      timeframe: "4h",
      symbol: null,
      group: "risk",
      signalLabel: "breakdown_risk",
      primaryStructure: null,
      setupType: null,
      horizons: [1, 3, 5, 10],
    },
    sample: {
      sourceSignals: 128,
      completedSignals: 120,
      skippedSignals: 8,
      sampleQuality: "strong",
      warnings: [],
    },
    expectedDirection: "down",
    horizons: {
      "1": makeSignalEvaluationHorizon({
        sampleSize: 128,
        medianReturnPct: -0.2,
        directionMatchRatePct: 58,
      }),
      "3": makeSignalEvaluationHorizon({
        sampleSize: 124,
        medianReturnPct: -0.6,
        directionMatchRatePct: 61,
      }),
      "5": makeSignalEvaluationHorizon({
        sampleSize: 120,
        avgReturnPct: -1.2,
        medianReturnPct: -0.9,
        positiveRatePct: 36,
        directionMatchRatePct: 64,
      }),
      "10": makeSignalEvaluationHorizon({
        sampleSize: 100,
        medianReturnPct: -1.1,
        directionMatchRatePct: 62,
      }),
    },
    interpretation: {
      summary: "Risk label historically leaned lower across the broader market.",
      confidence: "strong",
      researchOnly: true,
    },
  };
}

function makeSignalEvaluationHorizon(
  overrides: Partial<Record<string, number | null>> = {},
) {
  return {
    sampleSize: 120,
    avgReturnPct: -0.4,
    medianReturnPct: -0.3,
    positiveRatePct: 42,
    directionMatchRatePct: 58,
    bestReturnPct: 8,
    worstReturnPct: -12,
    ...overrides,
  };
}

function makeWatchlistStorage(initialValue: string | null): WatchlistStorage {
  let value = initialValue;

  return {
    getItem: () => value,
    setItem: (_key: string, nextValue: string) => {
      value = nextValue;
    },
  };
}

function makeThrowingWatchlistStorage(): WatchlistStorage {
  return {
    getItem: () => {
      throw new Error("Storage unavailable");
    },
    setItem: () => {
      throw new Error("Storage unavailable");
    },
  };
}
