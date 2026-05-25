import pLimit from "p-limit";
import {
  fetchCandlesFromBinance,
  getTopUsdtMarkets,
} from "@/lib/exchanges/binance";
import { TIMEFRAMES, type Timeframe } from "@/lib/exchanges/types";
import { MarketDataStore, type MarketDataSummary } from "./marketData";

export type MarketDataSyncMode = "recent" | "incremental";

export type MarketDataSyncOptions = {
  mode?: MarketDataSyncMode;
  marketLimit?: number;
  timeframes?: Timeframe[];
  candlesPerTimeframe?: Partial<Record<Timeframe, number>>;
  concurrency?: number;
};

export type MarketDataSyncResult = {
  mode: MarketDataSyncMode;
  requestedMarkets: number;
  requestedPairs: number;
  syncedPairs: number;
  failedPairs: number;
  candlesFetched: number;
  startedAt: string;
  completedAt: string;
  summary: MarketDataSummary;
  errors: Array<{ symbol: string; timeframe: Timeframe; message: string }>;
};

const defaultCandlesPerTimeframe = {
  "1h": 1500,
  "4h": 1000,
  "1d": 1000,
  "7d": 500,
  "1m": 300,
} satisfies Record<Timeframe, number>;

const MAX_BINANCE_KLINES_LIMIT = 1000;
const DEFAULT_MARKET_LIMIT = 200;
const DEFAULT_SYNC_CONCURRENCY = 3;

export async function syncMarketData(options: MarketDataSyncOptions = {}) {
  const mode = options.mode ?? "incremental";
  const timeframes = options.timeframes ?? [...TIMEFRAMES];
  const marketLimit = options.marketLimit ?? DEFAULT_MARKET_LIMIT;
  const concurrency = options.concurrency ?? DEFAULT_SYNC_CONCURRENCY;
  const startedAt = new Date().toISOString();
  const store = new MarketDataStore();

  try {
    const markets = await getTopUsdtMarkets(marketLimit);
    store.upsertMarkets(markets);

    const gate = pLimit(concurrency);
    const jobs = markets.flatMap((market) =>
      timeframes.map((timeframe) =>
        gate(async () => {
          const symbol = market.symbol;

          try {
            const candles = await fetchCandlesForMode({
              mode,
              symbol,
              timeframe,
              store,
              limit: getWindowLimit(timeframe, options.candlesPerTimeframe),
            });
            store.upsertCandles({ symbol, timeframe, candles });
            const stats = store.getCandleStats({ symbol, timeframe });
            store.upsertSyncState({
              exchange: "binance",
              symbol,
              timeframe,
              status: "completed",
              firstOpenTime: stats.firstOpenTime,
              lastOpenTime: stats.lastOpenTime,
              lastCloseTime: stats.lastCloseTime,
              candleCount: stats.candleCount,
              lastSyncedAt: new Date().toISOString(),
              errorMessage: null,
            });

            return {
              ok: true as const,
              symbol,
              timeframe,
              candleCount: candles.length,
            };
          } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            const stats = store.getCandleStats({ symbol, timeframe });
            store.upsertSyncState({
              exchange: "binance",
              symbol,
              timeframe,
              status: "failed",
              firstOpenTime: stats.firstOpenTime,
              lastOpenTime: stats.lastOpenTime,
              lastCloseTime: stats.lastCloseTime,
              candleCount: stats.candleCount,
              lastSyncedAt: new Date().toISOString(),
              errorMessage: message,
            });

            return {
              ok: false as const,
              symbol,
              timeframe,
              message,
            };
          }
        }),
      ),
    );

    const settled = await Promise.all(jobs);
    const errors = settled.flatMap((item) =>
      item.ok ? [] : [{ symbol: item.symbol, timeframe: item.timeframe, message: item.message }],
    );
    const result: MarketDataSyncResult = {
      mode,
      requestedMarkets: markets.length,
      requestedPairs: markets.length * timeframes.length,
      syncedPairs: settled.filter((item) => item.ok).length,
      failedPairs: errors.length,
      candlesFetched: settled.reduce(
        (sum, item) => sum + (item.ok ? item.candleCount : 0),
        0,
      ),
      startedAt,
      completedAt: new Date().toISOString(),
      summary: store.getSummary(),
      errors,
    };

    return result;
  } finally {
    store.close();
  }
}

async function fetchCandlesForMode({
  mode,
  symbol,
  timeframe,
  store,
  limit,
}: {
  mode: MarketDataSyncMode;
  symbol: string;
  timeframe: Timeframe;
  store: MarketDataStore;
  limit: number;
}) {
  if (mode === "recent") {
    return fetchRecentCandles(symbol, timeframe, limit);
  }

  const latestOpenTime = store.getLatestCandleOpenTime({ symbol, timeframe });

  if (latestOpenTime === null) {
    return fetchRecentCandles(symbol, timeframe, limit);
  }

  return fetchCandlesFromBinance(symbol, timeframe, {
    limit: MAX_BINANCE_KLINES_LIMIT,
    startTime: latestOpenTime + 1,
  });
}

async function fetchRecentCandles(
  symbol: string,
  timeframe: Timeframe,
  limit: number,
) {
  const pages = Math.ceil(limit / MAX_BINANCE_KLINES_LIMIT);
  const candles = [];
  let endTime: number | undefined;

  for (let page = 0; page < pages; page += 1) {
    const remaining = limit - candles.length;
    const pageLimit = Math.min(MAX_BINANCE_KLINES_LIMIT, remaining);
    const pageCandles = await fetchCandlesFromBinance(symbol, timeframe, {
      limit: pageLimit,
      endTime,
    });

    if (pageCandles.length === 0) {
      break;
    }

    candles.unshift(...pageCandles);
    endTime = pageCandles[0].openTime - 1;

    if (pageCandles.length < pageLimit) {
      break;
    }
  }

  return candles.slice(-limit);
}

function getWindowLimit(
  timeframe: Timeframe,
  overrides: MarketDataSyncOptions["candlesPerTimeframe"],
) {
  return overrides?.[timeframe] ?? defaultCandlesPerTimeframe[timeframe];
}
