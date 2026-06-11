import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../../app/api/rankings/route";
import { clearMemoryCache } from "@/lib/cache/memory";
import { scannerCodeVersions } from "@/lib/vegarank-codebook/codeRegistry";

const getEligibleUsdtMarketsMock = vi.hoisted(() => vi.fn());
const scanMarketMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/exchanges/binance", () => ({
  getEligibleUsdtMarkets: getEligibleUsdtMarketsMock,
}));

vi.mock("@/lib/ranking-engine/scanMarket", () => ({
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
      new Request("http://localhost/api/rankings?source=remote&timeframe=4h"),
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
    await GET(new Request("http://localhost/api/rankings?timeframe=4h"));

    expect(getEligibleUsdtMarketsMock).toHaveBeenCalledWith(
      expect.objectContaining({ maxSymbols: 75 }),
    );
  });

  it("applies maxSymbols only when explicitly provided", async () => {
    const response = await GET(
      new Request("http://localhost/api/rankings?timeframe=4h&maxSymbols=20"),
    );

    expect(response.status).toBe(200);
    expect(getEligibleUsdtMarketsMock).toHaveBeenCalledWith(
      expect.objectContaining({ maxSymbols: 20 }),
    );
  });

  it("marks maxSymbols=all as truncated for Cloudflare live scan safety", async () => {
    const response = await GET(
      new Request("http://localhost/api/rankings?timeframe=4h&maxSymbols=all"),
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
        "http://localhost/api/rankings?timeframe=4h&minQuoteVolume=10000000",
      ),
    );

    expect(getEligibleUsdtMarketsMock).toHaveBeenCalledWith(
      expect.objectContaining({ minQuoteVolume: 10000000 }),
    );
  });

  it("blocks source=local when local SQLite is disabled", async () => {
    const response = await GET(
      new Request("http://localhost/api/rankings?source=local&timeframe=4h"),
    );
    const body = await response.json();

    expect(response.status).toBe(501);
    expect(body.error).toContain("Local SQLite storage is only available");
  });

  it("returns a controlled response for feature-gated cached source", async () => {
    const response = await GET(
      new Request("http://localhost/api/rankings?source=cached&timeframe=4h"),
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
          `http://localhost/api/rankings?source=remote&timeframe=${timeframe}`,
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
          `http://localhost/api/rankings?source=remote&timeframe=${timeframe}`,
        ),
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.timeframe).toBe(timeframe);
    },
  );

  it("defaults to 4h and includes cache metadata", async () => {
    const response = await GET(new Request("http://localhost/api/rankings?source=remote"));
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

    const response = await GET(new Request("http://localhost/api/rankings?timeframe=4h"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      source: "remote",
      timeframe: "4h",
      universe: "all-eligible-usdt",
      totalUsdtPairs: 10,
      eligibleCount: 6,
      scannedCount: 4,
      skippedCount: 0,
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
    expect(body.results).toHaveLength(2);
    expectPublicScannerResultItem(body.results[0]);
    expect(body.results.some((item: Record<string, unknown>) => item.groupCode === "GR_401")).toBe(true);
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
        "http://localhost/api/rankings?timeframe=4h&batchMode=true&batchSize=20&cursor=20",
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
      new Request("http://localhost/api/rankings?timeframe=4h&batchMode=true"),
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
        "http://localhost/api/rankings?timeframe=4h&batchMode=true&batchSize=99",
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
      new Request("http://localhost/api/rankings?timeframe=4h&batchMode=true"),
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
  const groupCode = sufficientHistory ? "GR_501" : "GR_401";
  const actionCode = sufficientHistory ? "AC_501" : "AC_401";

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
    finalSignalScore: rankScore,
    rankScore,
    riskAdjustedScore: rankScore,
    setupQualityScore: 70,
    confidenceScore: sufficientHistory ? 70 : 20,
    absoluteSetupScore: 70,
    universePercentile: null,
    volatilityScore: 50,
    mtfAgreementScore: 50,
    riskPenalty: 20,
    qualityPenalty: sufficientHistory ? 0 : 100,
    codeContract: {
      exchange: "binance",
      symbol,
      timeframe: "4h",
      groupCode,
      actionCode,
      riskCode: null,
      riskCodes: [],
      setupCode: "VO_501",
      phaseCode: "VO_501",
      reasonCodes: ["VO_202"],
      signalCodes: ["VO_501"],
      qualityCodes: sufficientHistory ? ["QH_001"] : ["QH_401"],
      metrics: {
        score: rankScore,
        rankScore,
        riskAdjustedScore: rankScore,
        setupQualityScore: 70,
        confidenceScore: sufficientHistory ? 70 : 20,
        absoluteSetupScore: 70,
        universePercentile: null,
        finalSignalScore: rankScore,
        opportunityScore: 70,
        confirmationScore: sufficientHistory ? 70 : 20,
        riskScore: 20,
        qualityScore: sufficientHistory ? 100 : 20,
        trendScore: 60,
        momentumScore: 55,
        structureScore: 60,
        volatilityScore: 50,
        volumeScore: 55,
        mtfAgreementScore: 50,
        riskPenalty: 20,
        qualityPenalty: sufficientHistory ? 0 : 100,
        historyBars: sufficientHistory ? 300 : 20,
        volumeRank: 1,
        volatilityPercentile: 20,
        atrExtension: null,
        distanceFromBase: null,
        scoringModelVersion: "quant-factor-v1",
        scoringCalibrationVersion: "deterministic-baseline-1",
        price: 100,
        rsi14: 55,
        bbPercent: null,
        bbWidthPercentile: 20,
        volumeRatio: 1,
      },
      ...scannerCodeVersions,
    },
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

const scannerCodePattern = /^(GR|QH|VL|PX|MO|TR|VO|RK|ST|AC|NX)_\d{3}$/;
const legacyPublicFields = [
  "signalLabel",
  "actionBias",
  "primaryStructure",
  "detectedRiskTypes",
  "factors",
  "rawMetrics",
  "observations",
  "reviewReason",
  "reviewStatus",
  "nextConfirmation",
  "invalidation",
] as const;

function expectPublicScannerResultItem(item: Record<string, unknown>) {
  for (const field of legacyPublicFields) {
    expect(item).not.toHaveProperty(field);
  }

  expect(item.groupCode).toMatch(scannerCodePattern);
  expect(item.actionCode).toMatch(scannerCodePattern);
  expect(item.setupCode).toMatch(scannerCodePattern);
  expect(item.phaseCode).toMatch(scannerCodePattern);

  if (item.riskCode !== null) {
    expect(item.riskCode).toMatch(scannerCodePattern);
  }

  for (const field of [
    "riskCodes",
    "reasonCodes",
    "signalCodes",
    "qualityCodes",
  ] as const) {
    expect(Array.isArray(item[field])).toBe(true);
    for (const code of item[field] as unknown[]) {
      expect(code).not.toBeUndefined();
      expect(code).toMatch(scannerCodePattern);
    }
  }

  expect(item.metrics).toEqual(expect.any(Object));
  const metrics = item.metrics as Record<string, unknown>;
  for (const field of [
    "rankScore",
    "riskAdjustedScore",
    "setupQualityScore",
    "confidenceScore",
    "absoluteSetupScore",
    "universePercentile",
    "trendScore",
    "momentumScore",
    "structureScore",
    "volatilityScore",
    "volumeScore",
    "mtfAgreementScore",
    "riskPenalty",
    "qualityPenalty",
    "historyBars",
    "volumeRank",
    "volatilityPercentile",
    "atrExtension",
    "distanceFromBase",
  ] as const) {
    expect(metrics).toHaveProperty(field);
    expect(metrics[field] === null || typeof metrics[field] === "number").toBe(
      true,
    );
  }
  expect(metrics.scoringModelVersion).toBe("quant-factor-v1");
  expect(metrics.scoringCalibrationVersion).toBe("deterministic-baseline-1");
  expect(item.scannerVersion).toEqual(expect.any(String));
  expect(item.codeSchemaVersion).toEqual(expect.any(String));
  expect(item.dictionaryVersion).toEqual(expect.any(String));
}
