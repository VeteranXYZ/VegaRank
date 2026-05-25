import { describe, expect, it } from "vitest";
import { MarketDataStore } from "./marketData";
import type { Candle, Market } from "@/lib/exchanges/types";

describe("market data store", () => {
  it("upserts markets, candles, and sync state", () => {
    const store = new MarketDataStore(":memory:");

    try {
      store.upsertMarkets([makeMarket("BTCUSDT"), makeMarket("ETHUSDT")]);
      store.upsertCandles({
        symbol: "btcusdt",
        timeframe: "4h",
        candles: [makeCandle(2, 102), makeCandle(1, 101), makeCandle(3, 103)],
      });
      store.upsertCandles({
        symbol: "BTCUSDT",
        timeframe: "4h",
        candles: [makeCandle(2, 202)],
      });
      store.upsertSyncState({
        exchange: "binance",
        symbol: "BTCUSDT",
        timeframe: "4h",
        status: "completed",
        firstOpenTime: 1,
        lastOpenTime: 3,
        lastCloseTime: 3_999,
        candleCount: 3,
        lastSyncedAt: "2026-05-25T21:00:00.000Z",
        errorMessage: null,
      });

      expect(store.getMarkets().map((market) => market.symbol)).toEqual([
        "ETHUSDT",
        "BTCUSDT",
      ]);
      expect(store.getCandles({ symbol: "BTCUSDT", timeframe: "4h" })).toEqual([
        makeCandle(1, 101),
        makeCandle(2, 202),
        makeCandle(3, 103),
      ]);
      expect(
        store.getCandles({ symbol: "BTCUSDT", timeframe: "4h", limit: 2 }),
      ).toEqual([makeCandle(2, 202), makeCandle(3, 103)]);
      expect(
        store.getLatestCandleOpenTime({ symbol: "BTCUSDT", timeframe: "4h" }),
      ).toBe(3);
      expect(
        store.getSyncState({ symbol: "BTCUSDT", timeframe: "4h" }),
      ).toMatchObject({
        status: "completed",
        candleCount: 3,
        lastSyncedAt: "2026-05-25T21:00:00.000Z",
      });
      expect(store.getSummary()).toMatchObject({
        marketCount: 2,
        candleCount: 3,
        syncedPairs: 1,
        latestSyncedAt: "2026-05-25T21:00:00.000Z",
        failedPairs: 0,
      });
    } finally {
      store.close();
    }
  });
});

function makeMarket(symbol: string): Market {
  return {
    exchange: "binance",
    symbol,
    baseAsset: symbol.replace("USDT", ""),
    quoteAsset: "USDT",
    status: "TRADING",
    quoteVolume: symbol === "ETHUSDT" ? 200 : 100,
  };
}

function makeCandle(openTime: number, close: number): Candle {
  return {
    openTime,
    open: close - 1,
    high: close + 1,
    low: close - 2,
    close,
    volume: close * 10,
    closeTime: openTime + 999,
  };
}
