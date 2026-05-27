import { describe, expect, it } from "vitest";
import { mapBinanceKlineToCandle } from "./binanceProvider";

describe("Binance market data provider", () => {
  it("maps public kline rows to local candles", () => {
    expect(
      mapBinanceKlineToCandle([
        1,
        "100",
        "110",
        "90",
        "105",
        "123.45",
        999,
        "12345.67",
        42,
        "10",
        "1000",
        "0",
      ]),
    ).toEqual({
      openTime: 1,
      open: 100,
      high: 110,
      low: 90,
      close: 105,
      volume: 123.45,
      closeTime: 999,
      quoteVolume: 12345.67,
    });
  });
});
