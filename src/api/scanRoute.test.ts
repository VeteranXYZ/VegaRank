import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../../app/api/scan/route";
import { clearMemoryCache } from "@/lib/cache/memory";

const getEligibleUsdtMarketsMock = vi.hoisted(() => vi.fn());
const scanMarketMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/exchanges/binance", () => ({
  getEligibleUsdtMarkets: getEligibleUsdtMarketsMock,
}));

vi.mock("@/lib/scanner/scanMarket", () => ({
  scanMarket: scanMarketMock,
}));

vi.mock("@/lib/storage/marketData", () => {
  throw new Error("Local SQLite storage was imported");
});

vi.mock("@/lib/storage/scanSnapshots", () => {
  throw new Error("Local scan snapshot storage was imported");
});

describe("scan API remote market universe", () => {
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
    scanMarketMock.mockReset();
  });

  it("keeps source=remote independent from local SQLite storage", async () => {
    const response = await GET(
      new Request("http://localhost/api/scan?source=remote&timeframe=4h"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.source).toBe("remote");
    expect(body.universe).toBe("all-eligible-usdt");
    expect(body.scannedMarketCount).toBe(0);
    expect(getEligibleUsdtMarketsMock).toHaveBeenCalledWith({
      maxSymbols: 100,
      minQuoteVolume: 0,
      safetyCap: 600,
    });
    expect(body).toMatchObject({
      requestedAllSymbols: true,
      effectiveMaxSymbols: 100,
      liveSymbolLimit: 100,
      liveSymbolLimitApplied: true,
      truncatedForLiveScan: true,
    });
  });

  it("limits remote ALL live scans to the configured top symbol count", async () => {
    vi.stubEnv("SCANNER_MAX_LIVE_SYMBOLS", "75");
    await GET(new Request("http://localhost/api/scan?timeframe=4h"));

    expect(getEligibleUsdtMarketsMock).toHaveBeenCalledWith(
      expect.objectContaining({ maxSymbols: 75 }),
    );
  });

  it("applies maxSymbols only when explicitly provided", async () => {
    const response = await GET(
      new Request("http://localhost/api/scan?timeframe=4h&maxSymbols=20"),
    );

    expect(response.status).toBe(200);
    expect(getEligibleUsdtMarketsMock).toHaveBeenCalledWith(
      expect.objectContaining({ maxSymbols: 20 }),
    );
  });

  it("marks maxSymbols=all as truncated for Cloudflare live scan safety", async () => {
    const response = await GET(
      new Request("http://localhost/api/scan?timeframe=4h&maxSymbols=all"),
    );
    const body = await response.json();

    expect(getEligibleUsdtMarketsMock).toHaveBeenCalledWith(
      expect.objectContaining({ maxSymbols: 100 }),
    );
    expect(body.requestedAllSymbols).toBe(true);
    expect(body.effectiveMaxSymbols).toBe(100);
    expect(body.liveSymbolLimitApplied).toBe(true);
  });

  it("passes minQuoteVolume into the remote universe filter", async () => {
    await GET(
      new Request(
        "http://localhost/api/scan?timeframe=4h&minQuoteVolume=10000000",
      ),
    );

    expect(getEligibleUsdtMarketsMock).toHaveBeenCalledWith(
      expect.objectContaining({ minQuoteVolume: 10000000 }),
    );
  });

  it("blocks source=local when local SQLite is disabled", async () => {
    const response = await GET(
      new Request("http://localhost/api/scan?source=local&timeframe=4h"),
    );
    const body = await response.json();

    expect(response.status).toBe(501);
    expect(body.error).toContain("Local SQLite storage is only available");
  });

  it("returns a controlled response for feature-gated cached source", async () => {
    const response = await GET(
      new Request("http://localhost/api/scan?source=cached&timeframe=4h"),
    );
    const body = await response.json();

    expect(response.status).toBe(501);
    expect(body.errorCode).toBe("CACHED_SOURCE_UNAVAILABLE");
    expect(body.results).toEqual([]);
    expect(getEligibleUsdtMarketsMock).not.toHaveBeenCalled();
  });

  it.each(["15m", "5m", "1m"])(
    "rejects unsupported lower timeframe %s",
    async (timeframe) => {
      const response = await GET(
        new Request(
          `http://localhost/api/scan?source=remote&timeframe=${timeframe}`,
        ),
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain("4h, 1h, 1d, 1w, or 1M");
    },
  );

  it.each(["4h", "1h", "1d", "1w", "1M"])(
    "accepts supported scanner timeframe %s",
    async (timeframe) => {
      const response = await GET(
        new Request(
          `http://localhost/api/scan?source=remote&timeframe=${timeframe}`,
        ),
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.timeframe).toBe(timeframe);
    },
  );

  it("defaults to 4h and includes cache metadata", async () => {
    const response = await GET(new Request("http://localhost/api/scan?source=remote"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.timeframe).toBe("4h");
    expect(body.cached).toBe(false);
    expect(body.cacheTtlSeconds).toBeGreaterThanOrEqual(60 * 60);
    expect(body.cacheExpiresAt).toEqual(expect.any(String));
    expect(body.usesClosedCandles).toBe(true);
    expect(body.lastClosedCandleTime).toBe(null);
    expect(body.durationMs).toEqual(expect.any(Number));
  });

  it("includes production diagnostics and a bounded failed-symbol sample", async () => {
    getEligibleUsdtMarketsMock.mockResolvedValue({
      markets: [
        { exchange: "binance", symbol: "AAAUSDT" },
        { exchange: "binance", symbol: "BBBUSDT" },
        { exchange: "binance", symbol: "CCCUSDT" },
        { exchange: "binance", symbol: "DDDUSDT" },
      ],
      totalUsdtPairs: 10,
      eligibleCount: 6,
      filteredLowVolume: 2,
      excludedStableOrLeveraged: 2,
      capped: true,
    });
    scanMarketMock.mockImplementation((symbol: string) => {
      if (symbol === "AAAUSDT") {
        return makeResult({ symbol, sufficientHistory: true });
      }

      if (symbol === "BBBUSDT") {
        return makeResult({ symbol, sufficientHistory: false });
      }

      if (symbol === "CCCUSDT") {
        throw new Error("Binance request failed with 429");
      }

      throw new Error("Indicator calculation failed");
    });

    const response = await GET(new Request("http://localhost/api/scan?timeframe=4h"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      source: "remote",
      timeframe: "4h",
      universe: "all-eligible-usdt",
      totalUsdtPairs: 10,
      eligibleCount: 6,
      scannedCount: 4,
      skippedCount: 1,
      failedCount: 2,
      cached: false,
      concurrency: 3,
      capped: true,
      minQuoteVolume: 0,
      usesClosedCandles: true,
      lastClosedCandleTime: "2026-05-25T00:00:00.000Z",
      failureSummary: {
        insufficientHistory: 1,
        fetchFailed: 1,
        indicatorFailed: 1,
        subrequestLimitExceeded: 0,
        filteredLowVolume: 2,
        excludedStableOrLeveraged: 2,
      },
    });
    expect(body.cacheTtlSeconds).toBeGreaterThanOrEqual(60 * 60);
    expect(body.cacheExpiresAt).toEqual(expect.any(String));
    expect(body.updatedAt).toEqual(expect.any(String));
    expect(body.durationMs).toEqual(expect.any(Number));
    expect(body.results).toHaveLength(1);
    expect(body.errors).toHaveLength(2);
  });

  it("returns batch metadata and scans only the requested batch slice", async () => {
    const markets = Array.from({ length: 80 }, (_, index) => ({
      exchange: "binance",
      symbol: `COIN${index.toString().padStart(2, "0")}USDT`,
    }));
    getEligibleUsdtMarketsMock.mockResolvedValue({
      markets,
      totalUsdtPairs: 90,
      eligibleCount: 80,
      filteredLowVolume: 5,
      excludedStableOrLeveraged: 5,
      capped: false,
    });
    scanMarketMock.mockImplementation((symbol: string) =>
      makeResult({ symbol, sufficientHistory: true }),
    );

    const response = await GET(
      new Request(
        "http://localhost/api/scan?timeframe=4h&batchMode=true&batchSize=20&cursor=20",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      batchMode: true,
      cursor: 20,
      nextCursor: 40,
      hasMore: true,
      batchSize: 20,
      batchIndex: 2,
      totalBatches: 4,
      totalEligibleCount: 80,
      scannedInBatch: 20,
      scannedCount: 20,
      eligibleCount: 80,
    });
    expect(scanMarketMock).toHaveBeenCalledTimes(20);
    expect(scanMarketMock).toHaveBeenCalledWith("COIN20USDT", "4h");
    expect(scanMarketMock).toHaveBeenLastCalledWith("COIN39USDT", "4h");
  });

  it("defaults batchSize to 20 in batch mode", async () => {
    const markets = Array.from({ length: 36 }, (_, index) => ({
      exchange: "binance",
      symbol: `DEF${index}USDT`,
    }));
    getEligibleUsdtMarketsMock.mockResolvedValue({
      markets,
      totalUsdtPairs: 36,
      eligibleCount: 36,
      filteredLowVolume: 0,
      excludedStableOrLeveraged: 0,
      capped: false,
    });
    scanMarketMock.mockImplementation((symbol: string) =>
      makeResult({ symbol, sufficientHistory: true }),
    );

    const response = await GET(
      new Request("http://localhost/api/scan?timeframe=4h&batchMode=true"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.batchSize).toBe(20);
    expect(body.nextCursor).toBe(20);
    expect(body.hasMore).toBe(true);
    expect(scanMarketMock).toHaveBeenCalledTimes(20);
  });

  it("clamps batchSize above 25 to the Cloudflare Free safe maximum", async () => {
    const markets = Array.from({ length: 50 }, (_, index) => ({
      exchange: "binance",
      symbol: `SAFE${index}USDT`,
    }));
    getEligibleUsdtMarketsMock.mockResolvedValue({
      markets,
      totalUsdtPairs: 50,
      eligibleCount: 50,
      filteredLowVolume: 0,
      excludedStableOrLeveraged: 0,
      capped: false,
    });
    scanMarketMock.mockImplementation((symbol: string) =>
      makeResult({ symbol, sufficientHistory: true }),
    );

    const response = await GET(
      new Request(
        "http://localhost/api/scan?timeframe=4h&batchMode=true&batchSize=99",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.batchSize).toBe(25);
    expect(body.scannedInBatch).toBe(25);
    expect(scanMarketMock).toHaveBeenCalledTimes(25);
  });

  it("classifies platform subrequest failures separately from indicator failures", async () => {
    getEligibleUsdtMarketsMock.mockResolvedValue({
      markets: [{ exchange: "binance", symbol: "AAAUSDT" }],
      totalUsdtPairs: 1,
      eligibleCount: 1,
      filteredLowVolume: 0,
      excludedStableOrLeveraged: 0,
      capped: false,
    });
    scanMarketMock.mockImplementation(() => {
      throw new Error("Too many subrequests by single Worker invocation.");
    });

    const response = await GET(
      new Request("http://localhost/api/scan?timeframe=4h&batchMode=true"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.failureSummary.subrequestLimitExceeded).toBe(1);
    expect(body.failureSummary.indicatorFailed).toBe(0);
    expect(body.failureSummary.fetchFailed).toBe(0);
  });
});

function makeResult({
  symbol,
  sufficientHistory,
  rankScore = 80,
}: {
  symbol: string;
  sufficientHistory: boolean;
  rankScore?: number;
}) {
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
    opportunityScore: 70,
    confirmationScore: 50,
    riskScore: 20,
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
      candleCount: sufficientHistory ? 300 : 20,
      sufficientHistory,
      missingIndicators: sufficientHistory ? [] : ["sma200"],
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
