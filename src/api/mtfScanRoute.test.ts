import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../../app/api/scan/mtf/route";
import { clearMemoryCache } from "@/lib/cache/memory";

const getEligibleUsdtMarketsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/exchanges/binance", () => ({
  getEligibleUsdtMarkets: getEligibleUsdtMarketsMock,
}));

vi.mock("@/lib/scanner/scanMarketMtf", () => ({
  scanMarketMultiTimeframe: vi.fn(),
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
    expect(body.failureSummary).toEqual({
      insufficientHistory: 0,
      fetchFailed: 0,
      indicatorFailed: 0,
      filteredLowVolume: 0,
      excludedStableOrLeveraged: 0,
    });
  });
});
