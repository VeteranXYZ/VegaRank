import { describe, expect, it } from "vitest";
import { MarketDataStore } from "./marketData";
import type { Candle, Market } from "@/lib/exchanges/types";

describe("market data store", () => {
  it("upserts markets, candles, and sync state", () => {
    const store = new MarketDataStore(":memory:");

    try {
      store.upsertMarkets([makeMarket("BTCUSDT"), makeMarket("ETHUSDT")]);
      const firstUpsert = store.upsertCandles({
        symbol: "btcusdt",
        timeframe: "4h",
        candles: [makeCandle(2, 102), makeCandle(1, 101), makeCandle(3, 103)],
      });
      const secondUpsert = store.upsertCandles({
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
      expect(firstUpsert).toEqual({ received: 3, inserted: 3, updated: 0 });
      expect(secondUpsert).toEqual({ received: 1, inserted: 0, updated: 1 });
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
        store.getLatestCandleTime({ symbol: "BTCUSDT", timeframe: "4h" }),
      ).toBe(3);
      expect(store.getCandleStats({ symbol: "BTCUSDT", timeframe: "4h" })).toEqual(
        {
          firstOpenTime: 1,
          lastOpenTime: 3,
          lastCloseTime: 1_002,
          candleCount: 3,
        },
      );
      expect(
        store.getCandleCoverage({ symbol: "BTCUSDT", timeframe: "4h" }),
      ).toEqual({
        firstOpenTime: 1,
        lastOpenTime: 3,
        lastCloseTime: 1_002,
        candleCount: 3,
      });
      const job = store.createMarketDataSyncJob({
        symbols: ["BTCUSDT"],
        timeframe: "4h",
        universe: "core",
      });
      expect(job.status).toBe("running");
      const finishedJob = store.finishMarketDataSyncJob({
        id: job.id,
        status: "success",
        syncedSymbols: 1,
        candlesFetched: 3,
        candlesInserted: 3,
        candlesUpdated: 0,
        errors: [],
      });
      expect(finishedJob).toMatchObject({
        id: job.id,
        status: "success",
        syncedSymbols: 1,
        candlesFetched: 3,
        candlesInserted: 3,
        candlesUpdated: 0,
        errors: [],
      });
      expect(store.listMarketDataSyncJobs({ limit: 1 })[0]).toMatchObject({
        id: job.id,
        universe: "core",
      });
      const partialJob = store.createMarketDataSyncJob({
        symbols: ["BTCUSDT", "ETHUSDT"],
        timeframe: "4h",
      });
      const finishedPartialJob = store.finishMarketDataSyncJob({
        id: partialJob.id,
        status: "partial_success",
        syncedSymbols: 1,
        failedSymbols: 1,
        candlesFetched: 3,
        candlesInserted: 0,
        candlesUpdated: 3,
        errors: [
          {
            symbol: "ETHUSDT",
            timeframe: "4h",
            message: "Temporary market data error.",
          },
        ],
      });
      expect(finishedPartialJob).toMatchObject({
        status: "partial_success",
        syncedSymbols: 1,
        failedSymbols: 1,
        errors: [
          {
            symbol: "ETHUSDT",
            timeframe: "4h",
            message: "Temporary market data error.",
          },
        ],
      });
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
