import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../../app/api/scan/mtf/route";
import { clearMemoryCache } from "@/lib/cache/memory";

const getEligibleUsdtMarketsMock = vi.hoisted(() => vi.fn());
const scanMarketMultiTimeframeMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/exchanges/binance", () => ({
  getEligibleUsdtMarkets: getEligibleUsdtMarketsMock,
}));

vi.mock("@/lib/scanner/scanMarketMtf", () => ({
  scanMarketMultiTimeframe: scanMarketMultiTimeframeMock,
}));

vi.mock("@/lib/storage/scanSnapshots", () => {
  throw new Error("Local scan snapshot storage was imported");
});

describe("MTF scan API timeframe defaults", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("DISABLE_LOCAL_SQLITE", "true");
    clearMemoryCache();
    getEligibleUsdtMarketsMock.mockReset();
    getEligibleUsdtMarketsMock.mockResolvedValue({
      markets: [],
      totalUsdtPairs: 420,
      eligibleCount: 420,
      filteredLowVolume: 0,
      excludedStableOrLeveraged: 0,
      capped: false,
    });
    scanMarketMultiTimeframeMock.mockReset();
  });

  it("defaults to the 4h + 1d core scan", async () => {
    const response = await GET(
      new Request("http://localhost/api/scan/mtf?source=remote"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.preset).toBe("short");
    expect(body.timeframes).toEqual(["4h", "1d"]);
    expect(body.timeframes).not.toContain("1h");
    expect(body.cacheTtlSeconds).toBeGreaterThanOrEqual(60 * 60);
    expect(body.usesClosedCandles).toBe(true);
    expect(body.lastClosedCandleTime).toBe(null);
    expect(body).toMatchObject({
      requestedAllSymbols: true,
      effectiveMaxSymbols: 100,
      liveSymbolLimit: 100,
      liveSymbolLimitApplied: true,
      truncatedForLiveScan: true,
    });
    expect(body.failureSummary).toEqual({
      insufficientHistory: 0,
      fetchFailed: 0,
      indicatorFailed: 0,
      subrequestLimitExceeded: 0,
      filteredLowVolume: 0,
      excludedStableOrLeveraged: 0,
    });
  });

  it("returns a controlled response for feature-gated cached source", async () => {
    const response = await GET(
      new Request("http://localhost/api/scan/mtf?source=cached&preset=short"),
    );
    const body = await response.json();

    expect(response.status).toBe(501);
    expect(body.errorCode).toBe("CACHED_SOURCE_UNAVAILABLE");
    expect(body.results).toEqual([]);
    expect(getEligibleUsdtMarketsMock).not.toHaveBeenCalled();
  });

  it("returns MTF batch metadata and scans only the requested slice", async () => {
    const markets = Array.from({ length: 40 }, (_, index) => ({
      exchange: "binance",
      symbol: `MTF${index.toString().padStart(2, "0")}USDT`,
    }));
    getEligibleUsdtMarketsMock.mockResolvedValue({
      markets,
      totalUsdtPairs: 44,
      eligibleCount: 40,
      filteredLowVolume: 2,
      excludedStableOrLeveraged: 2,
      capped: false,
    });
    scanMarketMultiTimeframeMock.mockImplementation((symbol: string) =>
      makeResult(symbol),
    );

    const response = await GET(
      new Request(
        "http://localhost/api/scan/mtf?source=remote&preset=short&batchMode=true&batchSize=8&cursor=8",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      mode: "mtf",
      preset: "short",
      primaryTimeframe: "4h",
      confirmationTimeframe: "1d",
      batchMode: true,
      cursor: 8,
      nextCursor: 16,
      hasMore: true,
      batchSize: 8,
      batchIndex: 2,
      totalBatches: 5,
      totalEligibleCount: 40,
      scannedInBatch: 8,
      scannedCount: 8,
    });
    expect(scanMarketMultiTimeframeMock).toHaveBeenCalledTimes(8);
    expect(scanMarketMultiTimeframeMock).toHaveBeenCalledWith("MTF08USDT", "short");
    expect(scanMarketMultiTimeframeMock).toHaveBeenLastCalledWith(
      "MTF15USDT",
      "short",
    );
  });

  it("defaults MTF batchSize to 8", async () => {
    const markets = Array.from({ length: 16 }, (_, index) => ({
      exchange: "binance",
      symbol: `DEFAULT${index}USDT`,
    }));
    getEligibleUsdtMarketsMock.mockResolvedValue({
      markets,
      totalUsdtPairs: 16,
      eligibleCount: 16,
      filteredLowVolume: 0,
      excludedStableOrLeveraged: 0,
      capped: false,
    });
    scanMarketMultiTimeframeMock.mockImplementation((symbol: string) =>
      makeResult(symbol),
    );

    const response = await GET(
      new Request("http://localhost/api/scan/mtf?source=remote&batchMode=true"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.batchSize).toBe(8);
    expect(body.nextCursor).toBe(8);
    expect(body.hasMore).toBe(true);
    expect(scanMarketMultiTimeframeMock).toHaveBeenCalledTimes(8);
  });

  it("clamps MTF batchSize above 10 to the safe maximum", async () => {
    const markets = Array.from({ length: 30 }, (_, index) => ({
      exchange: "binance",
      symbol: `SAFE${index}USDT`,
    }));
    getEligibleUsdtMarketsMock.mockResolvedValue({
      markets,
      totalUsdtPairs: 30,
      eligibleCount: 30,
      filteredLowVolume: 0,
      excludedStableOrLeveraged: 0,
      capped: false,
    });
    scanMarketMultiTimeframeMock.mockImplementation((symbol: string) =>
      makeResult(symbol),
    );

    const response = await GET(
      new Request(
        "http://localhost/api/scan/mtf?source=remote&batchMode=true&batchSize=99",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.batchSize).toBe(10);
    expect(body.scannedInBatch).toBe(10);
    expect(scanMarketMultiTimeframeMock).toHaveBeenCalledTimes(10);
  });

  it("classifies MTF subrequest limit failures separately", async () => {
    getEligibleUsdtMarketsMock.mockResolvedValue({
      markets: [{ exchange: "binance", symbol: "AAAUSDT" }],
      totalUsdtPairs: 1,
      eligibleCount: 1,
      filteredLowVolume: 0,
      excludedStableOrLeveraged: 0,
      capped: false,
    });
    scanMarketMultiTimeframeMock.mockImplementation(() => {
      throw new Error("Too many subrequests by single Worker invocation.");
    });

    const response = await GET(
      new Request("http://localhost/api/scan/mtf?source=remote&batchMode=true"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.failureSummary.subrequestLimitExceeded).toBe(1);
    expect(body.failureSummary.indicatorFailed).toBe(0);
    expect(body.failureSummary.fetchFailed).toBe(0);
  });
});

function makeResult(symbol: string) {
  return {
    exchange: "binance",
    symbol,
    timeframe: "4h",
    price: 100,
    phase: "SQUEEZE",
    signal: {
      state: "WATCHLIST",
      label: "WATCHLIST",
      summary: "WATCHLIST",
    },
    multiTimeframe: {
      alignment: "EARLY_4H_SIGNAL",
      label: "Early Signal",
      summary: "4H structure is improving before full daily confirmation.",
      constructiveCount: 1,
      riskCount: 0,
      rankScore: 80,
      timeframes: ["4h", "1d"],
      timeframeResults: [],
    },
    opportunityScore: 70,
    confirmationScore: 50,
    riskScore: 20,
    rankScore: 80,
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
      usesClosedCandles: true,
      lastClosedCandleTime: Date.parse("2026-05-25T00:00:00.000Z"),
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
