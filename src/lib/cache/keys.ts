import type { Timeframe } from "@/lib/exchanges/types";

const minute = 60 * 1000;
const hour = 60 * minute;

export type ScanCacheKeyOptions = {
  source: string;
  timeframe?: Timeframe;
  preset?: string;
  primaryTimeframe?: Timeframe;
  confirmationTimeframe?: Timeframe;
  universe: string;
  maxSymbols: number | null;
  minQuoteVolume: number;
  filters?: string;
  batchMode?: boolean;
  cursor?: number;
  batchSize?: number;
};

export const cacheKeys = {
  markets: "markets:binance:spot:usdt",
  tickers: "tickers:binance:24h",
  candles: (symbol: string, timeframe: Timeframe, limit: number) =>
    `candles:binance:${symbol}:${timeframe}:${limit}`,
  candlesWithRange: (
    symbol: string,
    timeframe: Timeframe,
    limit: number,
    startTime?: number,
    endTime?: number,
  ) =>
    `candles:binance:${symbol}:${timeframe}:${limit}:start:${startTime ?? "latest"}:end:${endTime ?? "latest"}`,
  scan: ({
    source,
    timeframe,
    universe,
    maxSymbols,
    minQuoteVolume,
    filters = "none",
    batchMode = false,
    cursor,
    batchSize,
  }: ScanCacheKeyOptions) =>
    [
      "scan",
      "binance",
      source,
      timeframe,
      universe,
      `max:${maxSymbols ?? "all"}`,
      `minQuote:${minQuoteVolume}`,
      batchMode ? `batch:${cursor ?? 0}:${batchSize ?? "default"}` : "batch:none",
      `filters:${filters}`,
    ].join(":"),
  mtfScan: ({
    source,
    preset,
    primaryTimeframe,
    confirmationTimeframe,
    universe,
    maxSymbols,
    minQuoteVolume,
    filters = "none",
    batchMode = false,
    cursor,
    batchSize,
  }: ScanCacheKeyOptions) =>
    [
      "scan",
      "binance",
      "mtf",
      source,
      preset,
      `primary:${primaryTimeframe ?? "preset"}`,
      `confirm:${confirmationTimeframe ?? "preset"}`,
      universe,
      `max:${maxSymbols ?? "all"}`,
      `minQuote:${minQuoteVolume}`,
      batchMode ? `batch:${cursor ?? 0}:${batchSize ?? "default"}` : "batch:none",
      `filters:${filters}`,
    ].join(":"),
};

export const cacheTtls = {
  markets: 12 * hour,
  tickers: 30 * minute,
  candles: {
    "4h": 60 * minute,
    "1h": 30 * minute,
    "1d": 6 * hour,
    "1w": 24 * hour,
    "1M": 72 * hour,
  } satisfies Record<Timeframe, number>,
  scan: {
    "4h": 60 * minute,
    "1h": 30 * minute,
    "1d": 6 * hour,
    "1w": 24 * hour,
    "1M": 72 * hour,
  } satisfies Record<Timeframe, number>,
  mtfScan: 60 * minute,
};
