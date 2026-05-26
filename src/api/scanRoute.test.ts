import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../../app/api/scan/route";

const getTopUsdtMarketsMock = vi.hoisted(() => vi.fn(async () => []));
const scanLocalMarketMock = vi.hoisted(() =>
  vi.fn(async () => ({
    exchange: "binance",
    symbol: "BTCUSDT",
    timeframe: "4h",
    price: 100,
    phase: "BASE_BUILDING",
    signal: {
      state: "NEUTRAL",
      label: "Neutral",
      summary: "No clear edge from the current scanner rules.",
    },
    opportunityScore: 50,
    confirmationScore: 30,
    riskScore: 10,
    rankScore: 42,
    rsi14: 55,
    bbWidthPercentile: 20,
    volumeRatio: 1,
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
  })),
);
const d1StoreMock = vi.hoisted(() => ({
  getMarkets: vi.fn(async () => [{ symbol: "BTCUSDT" }]),
  close: vi.fn(async () => undefined),
}));

vi.mock("@/lib/exchanges/binance", () => ({
  getTopUsdtMarkets: getTopUsdtMarketsMock,
}));

vi.mock("@/lib/scanner/scanMarket", () => ({
  scanMarket: vi.fn(),
}));

vi.mock("@/lib/scanner/scanLocalMarket", () => ({
  scanLocalMarket: scanLocalMarketMock,
}));

vi.mock("@/lib/storage/marketData", () => {
  throw new Error("Local SQLite storage was imported");
});

vi.mock("@/lib/storage/scanSnapshots", () => {
  throw new Error("Local scan snapshot storage was imported");
});

vi.mock("@/lib/storage/d1MarketData", () => ({
  createD1MarketDataStore: vi.fn(async () => d1StoreMock),
}));

vi.mock("@/lib/storage/d1ScanSnapshots", () => ({
  safePersistScanSnapshotToD1: vi.fn(async () => null),
}));

describe("scan API Cloudflare safety", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("DISABLE_LOCAL_SQLITE", "true");
    getTopUsdtMarketsMock.mockClear();
    getTopUsdtMarketsMock.mockResolvedValue([]);
    scanLocalMarketMock.mockClear();
    d1StoreMock.getMarkets.mockClear();
    d1StoreMock.close.mockClear();
  });

  it("keeps source=remote independent from local SQLite storage", async () => {
    const response = await GET(
      new Request("http://localhost/api/scan?source=remote&timeframe=4h&limit=1"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.source).toBe("remote");
    expect(body.scannedMarketCount).toBe(0);
    expect(getTopUsdtMarketsMock).toHaveBeenCalledWith(1);
  });

  it("blocks source=local when local SQLite is disabled", async () => {
    const response = await GET(
      new Request("http://localhost/api/scan?source=local&timeframe=4h&limit=1"),
    );
    const body = await response.json();

    expect(response.status).toBe(501);
    expect(body.error).toContain("Local SQLite storage is only available");
  });

  it("uses D1 synced market data for source=local on Cloudflare", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEPLOY_TARGET", "cloudflare");

    const response = await GET(
      new Request("http://localhost/api/scan?source=local&timeframe=4h&limit=1"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.source).toBe("local");
    expect(body.scannedMarketCount).toBe(1);
    expect(d1StoreMock.getMarkets).toHaveBeenCalled();
    expect(scanLocalMarketMock).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: "BTCUSDT", timeframe: "4h" }),
    );
  });

  it("rejects the ambiguous 1m timeframe", async () => {
    const response = await GET(
      new Request("http://localhost/api/scan?source=remote&timeframe=1m&limit=1"),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("1M");
  });

  it("accepts the 1M monthly timeframe", async () => {
    const response = await GET(
      new Request("http://localhost/api/scan?source=remote&timeframe=1M&limit=1"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.timeframe).toBe("1M");
  });
});
