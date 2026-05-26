import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../../app/api/backtest/symbol/route";
import { clearMemoryCache } from "@/lib/cache/memory";

const getCandlesMock = vi.hoisted(() => vi.fn());
const reviewHistoricalBehaviorMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/exchanges/binance", () => ({
  getCandles: getCandlesMock,
}));

vi.mock("@/lib/backtest/symbolBehavior", () => ({
  reviewHistoricalBehavior: reviewHistoricalBehaviorMock,
}));

describe("symbol historical behavior API", () => {
  beforeEach(() => {
    clearMemoryCache();
    getCandlesMock.mockReset();
    getCandlesMock.mockResolvedValue([]);
    reviewHistoricalBehaviorMock.mockReset();
    reviewHistoricalBehaviorMock.mockReturnValue({
      symbol: "BTCUSDT",
      timeframe: "4h",
      limit: 1000,
      matchMode: "standard",
      current: {},
      sampleCount: 0,
      sampleQuality: "none",
      summaryKey: "backtest.summary.noSamples",
      horizons: [],
      falseBreakoutRatePct: null,
      warnings: [],
      notes: [],
      recentSamples: [],
    });
  });

  it("rejects missing symbol", async () => {
    const response = await GET(
      new Request("http://localhost/api/backtest/symbol?timeframe=4h"),
    );

    expect(response.status).toBe(400);
  });

  it("rejects invalid symbols and unsupported timeframes", async () => {
    const invalidSymbol = await GET(
      new Request(
        "http://localhost/api/backtest/symbol?symbol=测试USDT&timeframe=4h",
      ),
    );
    const invalidTimeframe = await GET(
      new Request(
        "http://localhost/api/backtest/symbol?symbol=BTCUSDT&timeframe=1h",
      ),
    );

    expect(invalidSymbol.status).toBe(400);
    expect(invalidTimeframe.status).toBe(400);
  });

  it("clamps limit and passes validated parameters into the review", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/backtest/symbol?symbol=btcusdt&timeframe=4h&limit=100&matchMode=standard",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getCandlesMock).toHaveBeenCalledWith("BTCUSDT", "4h", 300);
    expect(reviewHistoricalBehaviorMock).toHaveBeenCalledWith({
      symbol: "BTCUSDT",
      timeframe: "4h",
      limit: 300,
      matchMode: "standard",
      candles: [],
    });
    expect(body.cached).toBe(false);
  });

  it("accepts similar mode and caps limit at 1000", async () => {
    await GET(
      new Request(
        "http://localhost/api/backtest/symbol?symbol=BTCUSDT&timeframe=1d&limit=5000&matchMode=similar",
      ),
    );

    expect(getCandlesMock).toHaveBeenCalledWith("BTCUSDT", "1d", 1000);
    expect(reviewHistoricalBehaviorMock).toHaveBeenCalledWith(
      expect.objectContaining({ matchMode: "similar", limit: 1000 }),
    );
  });
});
