import type { Candle, Exchange, Market, Timeframe } from "@/lib/exchanges/types";

export type MarketDataSyncStatus = "idle" | "running" | "completed" | "failed";
export type MarketDataSyncJobStatus =
  | "running"
  | "success"
  | "partial_success"
  | "failed"
  | "skipped";

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

export type MarketCandleUpsertStats = {
  received: number;
  inserted: number;
  updated: number;
};

export type MarketDataSyncJobError = {
  symbol: string;
  timeframe: Timeframe;
  message: string;
};

export type MarketDataSyncJobInput = {
  id?: string;
  source?: string;
  universe?: string | null;
  symbols: string[];
  timeframe: Timeframe;
  status?: MarketDataSyncJobStatus;
  errors?: MarketDataSyncJobError[];
  metadata?: Record<string, unknown>;
};

export type MarketDataSyncJobUpdate = {
  id: string;
  status: MarketDataSyncJobStatus;
  syncedSymbols?: number;
  failedSymbols?: number;
  candlesFetched?: number;
  candlesInserted?: number;
  candlesUpdated?: number;
  errors?: MarketDataSyncJobError[];
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
};

export type MarketDataSyncJob = {
  id: string;
  source: string;
  universe: string | null;
  symbols: string[];
  timeframe: Timeframe;
  status: MarketDataSyncJobStatus;
  startedAt: string;
  finishedAt: string | null;
  requestedSymbols: number;
  syncedSymbols: number;
  failedSymbols: number;
  candlesFetched: number;
  candlesInserted: number;
  candlesUpdated: number;
  errors: MarketDataSyncJobError[];
  errorMessage: string | null;
  metadata: Record<string, unknown>;
};

export type MarketDataStoreLike = {
  upsertMarkets(markets: Market[]): void | Promise<void>;
  getMarkets(exchange?: Exchange): Market[] | Promise<Market[]>;
  upsertCandles(input: {
    exchange?: Exchange;
    symbol: string;
    timeframe: Timeframe;
    candles: Candle[];
  }): MarketCandleUpsertStats | Promise<MarketCandleUpsertStats>;
  saveCandles(input: {
    exchange?: Exchange;
    symbol: string;
    timeframe: Timeframe;
    candles: Candle[];
  }): MarketCandleUpsertStats | Promise<MarketCandleUpsertStats>;
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
  getLatestCandleTime(input: {
    exchange?: Exchange;
    symbol: string;
    timeframe: Timeframe;
  }): number | null | Promise<number | null>;
  getCandleStats(input: {
    exchange?: Exchange;
    symbol: string;
    timeframe: Timeframe;
  }): MarketCandleStats | Promise<MarketCandleStats>;
  getCandleCoverage(input: {
    exchange?: Exchange;
    symbol: string;
    timeframe: Timeframe;
  }): MarketCandleStats | Promise<MarketCandleStats>;
  createMarketDataSyncJob(
    input: MarketDataSyncJobInput,
  ): MarketDataSyncJob | Promise<MarketDataSyncJob>;
  finishMarketDataSyncJob(
    input: MarketDataSyncJobUpdate,
  ): MarketDataSyncJob | null | Promise<MarketDataSyncJob | null>;
  listMarketDataSyncJobs(input?: {
    limit?: number;
    status?: MarketDataSyncJobStatus;
  }): MarketDataSyncJob[] | Promise<MarketDataSyncJob[]>;
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
