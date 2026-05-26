import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../../app/api/scan/route";

const getTopUsdtMarketsMock = vi.hoisted(() => vi.fn(async () => []));

vi.mock("@/lib/exchanges/binance", () => ({
  getTopUsdtMarkets: getTopUsdtMarketsMock,
}));

vi.mock("@/lib/scanner/scanMarket", () => ({
  scanMarket: vi.fn(),
}));

vi.mock("@/lib/storage/marketData", () => {
  throw new Error("Local SQLite storage was imported");
});

vi.mock("@/lib/storage/scanSnapshots", () => {
  throw new Error("Local scan snapshot storage was imported");
});

describe("scan API Cloudflare safety", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("DISABLE_LOCAL_SQLITE", "true");
    getTopUsdtMarketsMock.mockClear();
    getTopUsdtMarketsMock.mockResolvedValue([]);
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
