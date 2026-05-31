import { randomUUID } from "node:crypto";
import pLimit from "p-limit";
import {
  fetchBinanceKlines,
  type BinanceKlineTimeframe,
} from "@/lib/market-data/binanceProvider";
import { getBinancePublicBaseUrl } from "@/lib/market-data/binanceConfig";
import {
  isSymbolAssetClassFilter,
  type SymbolAssetClassFilter,
} from "@/lib/market-data/symbolClassification";
import { acquireRedisLock } from "@/lib/cache/redisLock";
import {
  MARKET_DATA_TIMEFRAMES,
  PgMarketDataStore,
  type MarketDataTimeframe,
  type PgSymbol,
} from "@/lib/storage/postgres/marketDataPg";

type SyncOptions = {
  symbols: string[];
  timeframes: MarketDataTimeframe[];
  candleLimit: number;
  marketLimit: number;
  allSymbols: boolean;
  assetClass: SymbolAssetClassFilter;
  includeNonScanner: boolean;
  concurrency: number;
  confirmLargeSync: boolean;
  baseUrl: string;
};

type TimeframeSyncSummary = {
  timeframe: MarketDataTimeframe;
  status: "success" | "partial_success" | "failed" | "locked";
  symbolsTotal: number;
  symbolsDone: number;
  candlesInserted: number;
  candlesUpdated: number;
  candlesFetched: number;
  candlesSkippedOpen: number;
  errors: Array<{ symbol: string; message: string }>;
};

const DEFAULT_MARKET_LIMIT = 5;
const LARGE_SYNC_THRESHOLD = 25;
const MAX_MARKET_LIMIT = 500;
const DEFAULT_CANDLE_LIMIT = 100;
const MAX_CANDLE_LIMIT = 1000;
const DEFAULT_CONCURRENCY = 3;
const MAX_CONCURRENCY = 5;
const LOCK_TTL_MS = 30 * 60 * 1000;

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const store = new PgMarketDataStore();
  const summaries: TimeframeSyncSummary[] = [];

  try {
    const markets = await resolveMarkets({ store, options });

    if (markets.length === 0) {
      throw new Error("No PostgreSQL symbols matched the sync request.");
    }

    console.info(
      `market:sync:pg resolved symbols=${markets.length} timeframes=${options.timeframes.join(",")} limit=${options.candleLimit} assetClass=${options.assetClass} includeNonScanner=${options.includeNonScanner} allSymbols=${options.allSymbols} baseUrl=${options.baseUrl}`,
    );

    for (const timeframe of options.timeframes) {
      summaries.push(await syncTimeframe({ store, markets, options, timeframe }));
    }

    const failed = summaries.filter((summary) => summary.status !== "success");

    console.info(
      `market:sync:pg summary ${JSON.stringify({
        ok: failed.length === 0,
        timeframes: summaries.map((summary) => ({
          timeframe: summary.timeframe,
          status: summary.status,
          symbolsDone: summary.symbolsDone,
          symbolsTotal: summary.symbolsTotal,
          candlesInserted: summary.candlesInserted,
          candlesUpdated: summary.candlesUpdated,
          candlesFetched: summary.candlesFetched,
          candlesSkippedOpen: summary.candlesSkippedOpen,
          failed: summary.errors.length,
        })),
      })}`,
    );

    if (failed.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await store.close();
  }
}

async function syncTimeframe({
  store,
  markets,
  options,
  timeframe,
}: {
  store: PgMarketDataStore;
  markets: PgSymbol[];
  options: SyncOptions;
  timeframe: MarketDataTimeframe;
}): Promise<TimeframeSyncSummary> {
  const lockKey = `lock:market-sync:binance:spot:${timeframe}`;
  const lock = await acquireRedisLock({ key: lockKey, ttlMs: LOCK_TTL_MS }).catch(
    (error) => {
      const message = error instanceof Error ? error.message : "Redis lock failed.";
      console.warn(`market:sync:pg timeframe=${timeframe} lock failed: ${message}`);
      return "lock-error" as const;
    },
  );

  if (lock === "lock-error") {
    return {
      timeframe,
      status: "failed",
      symbolsTotal: markets.length,
      symbolsDone: 0,
      candlesInserted: 0,
      candlesUpdated: 0,
      candlesFetched: 0,
      candlesSkippedOpen: 0,
      errors: [{ symbol: "*", message: "Redis lock unavailable." }],
    };
  }

  if (!lock) {
    console.warn(`market:sync:pg refused: lock exists for timeframe=${timeframe}`);
    return {
      timeframe,
      status: "locked",
      symbolsTotal: markets.length,
      symbolsDone: 0,
      candlesInserted: 0,
      candlesUpdated: 0,
      candlesFetched: 0,
      candlesSkippedOpen: 0,
      errors: [{ symbol: "*", message: `lock exists: ${lockKey}` }],
    };
  }

  const jobId = randomUUID();
  const startedAt = Date.now();
  const gate = pLimit(options.concurrency);
  let symbolsDone = 0;
  let candlesInserted = 0;
  let candlesUpdated = 0;
  let candlesFetched = 0;
  let candlesSkippedOpen = 0;
  const errors: Array<{ symbol: string; message: string }> = [];

  try {
    await store.createMarketDataSyncJob({
      id: jobId,
      timeframe,
      status: "running",
      symbolsTotal: markets.length,
      params: {
        requestedSymbols: options.symbols,
        marketLimit: options.symbols.length === 0 ? options.marketLimit : null,
        allSymbols: options.symbols.length === 0 ? options.allSymbols : false,
        assetClass: options.assetClass,
        includeNonScanner: options.includeNonScanner,
        candleLimit: options.candleLimit,
        concurrency: options.concurrency,
        incremental: true,
        source: "binance",
        baseUrl: options.baseUrl,
        lockKey,
      },
    });

    console.info(
      `market:sync:pg started job=${jobId} timeframe=${timeframe} symbols=${markets.length} limit=${options.candleLimit}`,
    );

    await Promise.all(
      markets.map((market) =>
        gate(async () => {
          try {
            const latestOpenTime = await store.getLatestCandleOpenTime({
              symbol: market.symbol,
              timeframe,
            });
            const candles = await fetchBinanceKlines({
              symbol: market.symbol,
              timeframe: timeframe as BinanceKlineTimeframe,
              limit: options.candleLimit,
              startTime: latestOpenTime === null ? undefined : latestOpenTime + 1,
            });
            const closedCandles = filterClosedCandles(candles);
            const stats = await store.upsertCandles({
              symbol: market.symbol,
              timeframe,
              candles: closedCandles,
            });

            candlesFetched += candles.length;
            candlesSkippedOpen += candles.length - closedCandles.length;
            candlesInserted += stats.inserted;
            candlesUpdated += stats.updated;
            console.info(
              `market:sync:pg ${market.symbol} ${timeframe} done latestOpenTime=${latestOpenTime ?? "none"} fetched=${candles.length} closed=${closedCandles.length} inserted=${stats.inserted} updated=${stats.updated}`,
            );
          } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            errors.push({ symbol: market.symbol, message });
            console.warn(`market:sync:pg ${market.symbol} ${timeframe} failed: ${message}`);
          } finally {
            symbolsDone += 1;
            console.info(
              `market:sync:pg progress timeframe=${timeframe} ${symbolsDone}/${markets.length} inserted=${candlesInserted} updated=${candlesUpdated} failed=${errors.length}`,
            );
          }
        }),
      ),
    );

    const status =
      errors.length === 0
        ? "success"
        : errors.length === markets.length
          ? "failed"
          : "partial_success";

    await store.finishMarketDataSyncJob({
      id: jobId,
      status,
      symbolsDone,
      candlesInserted,
      candlesUpdated,
      errorMessage: errors[0]?.message ?? null,
    });

    console.info(
      `market:sync:pg finished job=${jobId} timeframe=${timeframe} status=${status} durationMs=${Date.now() - startedAt} inserted=${candlesInserted} updated=${candlesUpdated} fetched=${candlesFetched} skippedOpen=${candlesSkippedOpen} failed=${errors.length}`,
    );

    return {
      timeframe,
      status,
      symbolsTotal: markets.length,
      symbolsDone,
      candlesInserted,
      candlesUpdated,
      candlesFetched,
      candlesSkippedOpen,
      errors,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await store
      .finishMarketDataSyncJob({
        id: jobId,
        status: "failed",
        symbolsDone,
        candlesInserted,
        candlesUpdated,
        errorMessage: message,
      })
      .catch(() => undefined);
    console.warn(`market:sync:pg timeframe=${timeframe} failed: ${message}`);
    return {
      timeframe,
      status: "failed",
      symbolsTotal: markets.length,
      symbolsDone,
      candlesInserted,
      candlesUpdated,
      candlesFetched,
      candlesSkippedOpen,
      errors: [{ symbol: "*", message }],
    };
  } finally {
    await lock.release().catch(() => false);
  }
}

async function resolveMarkets({
  store,
  options,
}: {
  store: PgMarketDataStore;
  options: SyncOptions;
}): Promise<PgSymbol[]> {
  if (options.symbols.length > 0) {
    return store.listSymbolsByNames(options.symbols);
  }

  return store.listSymbols({
    limit: options.allSymbols ? null : options.marketLimit,
    assetClass: options.assetClass,
    includeNonScanner: options.includeNonScanner,
  });
}

function parseOptions(args: string[]): SyncOptions {
  const flags = parseFlags(args);
  const symbols = parseSymbols(flags.symbols ?? flags.symbol);
  const marketLimit = parseInteger({
    value: flags.marketLimit,
    fallback: DEFAULT_MARKET_LIMIT,
    min: 1,
    max: MAX_MARKET_LIMIT,
    name: "marketLimit",
  });
  const confirmLargeSync = flags.confirmLargeSync === "true";
  const allSymbols = flags.allSymbols === "true";
  const assetClass = parseAssetClass(flags.assetClass);
  const includeNonScanner = flags.includeNonScanner === "true";

  if (symbols.length === 0 && allSymbols && !confirmLargeSync) {
    throw new Error("--all-symbols requires --confirm-large-sync.");
  }

  if (symbols.length === 0 && marketLimit > LARGE_SYNC_THRESHOLD && !confirmLargeSync) {
    throw new Error(
      `marketLimit above ${LARGE_SYNC_THRESHOLD} requires --confirm-large-sync.`,
    );
  }

  return {
    symbols,
    timeframes: parseTimeframes(flags.timeframes ?? flags.timeframe),
    candleLimit: parseInteger({
      value: flags.limit,
      fallback: DEFAULT_CANDLE_LIMIT,
      min: 1,
      max: MAX_CANDLE_LIMIT,
      name: "limit",
    }),
    marketLimit,
    allSymbols,
    assetClass,
    includeNonScanner,
    concurrency: parseInteger({
      value: flags.concurrency,
      fallback: DEFAULT_CONCURRENCY,
      min: 1,
      max: MAX_CONCURRENCY,
      name: "concurrency",
    }),
    confirmLargeSync,
    baseUrl: getBinancePublicBaseUrl(),
  };
}

function parseFlags(args: string[]) {
  const flags: Record<string, string | undefined> = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg.startsWith("--")) {
      continue;
    }

    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    const nextValue = args[index + 1];

    if (inlineValue !== undefined) {
      flags[toCamelCase(rawKey)] = inlineValue;
      continue;
    }

    if (nextValue && !nextValue.startsWith("--")) {
      flags[toCamelCase(rawKey)] = nextValue;
      index += 1;
      continue;
    }

    flags[toCamelCase(rawKey)] = "true";
  }

  return flags;
}

function parseSymbols(value: string | undefined) {
  if (!value) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .split(",")
        .map((symbol) => symbol.trim().toUpperCase())
        .filter(Boolean),
    ),
  );
}

function parseTimeframes(value: string | undefined): MarketDataTimeframe[] {
  const requested = (value ?? "1h").split(",").map((item) => item.trim());
  const timeframes = Array.from(new Set(requested)).filter(Boolean);

  if (
    timeframes.length === 0 ||
    timeframes.some(
      (timeframe) => !MARKET_DATA_TIMEFRAMES.includes(timeframe as MarketDataTimeframe),
    )
  ) {
    throw new Error(`timeframe must be one of ${MARKET_DATA_TIMEFRAMES.join(", ")}.`);
  }

  return timeframes as MarketDataTimeframe[];
}

function parseAssetClass(value: string | undefined): SymbolAssetClassFilter {
  const assetClass = value?.trim().toLowerCase() ?? "crypto";

  if (!isSymbolAssetClassFilter(assetClass)) {
    throw new Error("asset-class must be one of crypto, stable, fiat, gold, special, all.");
  }

  return assetClass;
}

function parseInteger({
  value,
  fallback,
  min,
  max,
  name,
}: {
  value: string | undefined;
  fallback: number;
  min: number;
  max: number;
  name: string;
}) {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }

  return parsed;
}

function toCamelCase(value: string) {
  return value.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function filterClosedCandles<T extends { closeTime: number }>(candles: T[]) {
  const now = Date.now();
  return candles.filter((candle) => candle.closeTime <= now);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "market:sync:pg failed");
  process.exitCode = 1;
});
