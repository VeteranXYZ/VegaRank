import type { Candle, Exchange, Market, Timeframe } from "@/lib/exchanges/types";

export type MarketDataSyncStatus = "idle" | "running" | "completed" | "failed";

export type MarketDataSyncState = {
  exchange: Exchange;
  symbol: string;
  timeframe: Timeframe;
  status: MarketDataSyncStatus;
  firstOpenTime: number | null;
  lastOpenTime: number | null;
  lastCloseTime: number | null;
  candleCount: number;
  lastSyncedAt: string | null;
  errorMessage: string | null;
};

export type MarketDataSummary = {
  marketCount: number;
  candleCount: number;
  syncedPairs: number;
  latestSyncedAt: string | null;
  failedPairs: number;
};

export type MarketCandleStats = {
  firstOpenTime: number | null;
  lastOpenTime: number | null;
  lastCloseTime: number | null;
  candleCount: number;
};

export type MarketDataStoreLike = {
  upsertMarkets(markets: Market[]): void | Promise<void>;
  getMarkets(exchange?: Exchange): Market[] | Promise<Market[]>;
  upsertCandles(input: {
    exchange?: Exchange;
    symbol: string;
    timeframe: Timeframe;
    candles: Candle[];
  }): void | Promise<void>;
  getCandles(input: {
    exchange?: Exchange;
    symbol: string;
    timeframe: Timeframe;
    limit?: number;
  }): Candle[] | Promise<Candle[]>;
  getLatestCandleOpenTime(input: {
    exchange?: Exchange;
    symbol: string;
    timeframe: Timeframe;
  }): number | null | Promise<number | null>;
  getCandleStats(input: {
    exchange?: Exchange;
    symbol: string;
    timeframe: Timeframe;
  }): MarketCandleStats | Promise<MarketCandleStats>;
  upsertSyncState(state: MarketDataSyncState): void | Promise<void>;
  getSyncState(input: {
    exchange?: Exchange;
    symbol: string;
    timeframe: Timeframe;
  }): MarketDataSyncState | null | Promise<MarketDataSyncState | null>;
  getSummary(): MarketDataSummary | Promise<MarketDataSummary>;
  close?(): void | Promise<void>;
};

export const emptyMarketDataSummary: MarketDataSummary = {
  marketCount: 0,
  candleCount: 0,
  syncedPairs: 0,
  latestSyncedAt: null,
  failedPairs: 0,
};
