import type { Timeframe } from "@/lib/exchanges/types";

const minute = 60 * 1000;

export const cacheKeys = {
  markets: "markets:binance:spot:usdt",
  tickers: "tickers:binance:24h",
  candles: (symbol: string, timeframe: Timeframe, limit: number) =>
    `candles:binance:${symbol}:${timeframe}:${limit}`,
  scan: (timeframe: Timeframe, limit: number) =>
    `scan:binance:${timeframe}:${limit}`,
  mtfScan: (preset: string, limit: number) => `scan:binance:mtf:${preset}:${limit}`,
};

export const cacheTtls = {
  markets: 60 * minute,
  tickers: minute,
  candles: {
    "1h": 2 * minute,
    "4h": 5 * minute,
    "1d": 15 * minute,
    "7d": 60 * minute,
    "1m": 6 * 60 * minute,
  } satisfies Record<Timeframe, number>,
  scan: {
    "1h": 2 * minute,
    "4h": 5 * minute,
    "1d": 15 * minute,
    "7d": 60 * minute,
    "1m": 6 * 60 * minute,
  } satisfies Record<Timeframe, number>,
  mtfScan: 15 * minute,
};
