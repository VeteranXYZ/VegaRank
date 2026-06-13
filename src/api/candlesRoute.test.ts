import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../../app/api/candles/route";

const getCandlesMock = vi.hoisted(() => vi.fn(async () => []));

vi.mock("@/lib/exchanges/binance", () => ({
  getCandles: getCandlesMock,
}));

describe("candles API timeframe validation", () => {
  beforeEach(() => {
    getCandlesMock.mockClear();
    getCandlesMock.mockResolvedValue([]);
  });

  it.each(["15m", "5m", "1m"])(
    "rejects unsupported lower timeframe %s",
    async (timeframe) => {
      const response = await GET(
        new Request(
          `http://localhost/api/candles?symbol=BTCUSDT&timeframe=${timeframe}&limit=1`,
        ),
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain("4h, 1h, 1d, 1w, or 1M");
      expect(getCandlesMock).not.toHaveBeenCalled();
    },
  );

  it.each(["4h", "1h", "1d", "1w", "1M"])(
    "accepts supported candle timeframe %s",
    async (timeframe) => {
      const response = await GET(
        new Request(
          `http://localhost/api/candles?source=remote&symbol=BTCUSDT&timeframe=${timeframe}&limit=1`,
        ),
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.timeframe).toBe(timeframe);
      expect(getCandlesMock).toHaveBeenCalledWith("BTCUSDT", timeframe, 1);
    },
  );

  it("accepts dashed Coinbase symbols at validation and rejects remote Coinbase fetches calmly", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/candles?source=remote&exchange=coinbase&symbol=BTC-USDC&timeframe=4h&limit=1",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("remote source");
    expect(getCandlesMock).not.toHaveBeenCalled();
  });

  it("rejects invalid symbol punctuation", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/candles?source=remote&symbol=BTC_USDC&timeframe=4h&limit=1",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("symbol must be");
    expect(getCandlesMock).not.toHaveBeenCalled();
  });
});
