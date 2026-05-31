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

type BackfillOptions = {
  symbols: string[];
  timeframe: MarketDataTimeframe;
  targetCount: number;
  batchLimit: number;
  maxBatches: number;
  marketLimit: number;
  allSymbols: boolean;
  assetClass: SymbolAssetClassFilter;
  includeNonScanner: boolean;
  concurrency: number;
  confirmLargeSync: boolean;
  baseUrl: string;
};

type SymbolBackfillResult = {
  symbol: string;
  beforeCount: number;
  afterCount: number;
  inserted: number;
  updated: number;
  batches: number;
  status: "backfilled" | "skippedEnough" | "noMoreHistory" | "failed";
  message?: string;
};

const DEFAULT_MARKET_LIMIT = 5;
const LARGE_SYNC_THRESHOLD = 25;
const MAX_MARKET_LIMIT = 500;
const DEFAULT_TARGET_COUNT = 500;
const MAX_TARGET_COUNT = 50000;
const DEFAULT_BATCH_LIMIT = 1000;
const MAX_BATCH_LIMIT = 1000;
const DEFAULT_MAX_BATCHES = 20;
const MAX_BATCHES = 100;
const DEFAULT_CONCURRENCY = 3;
const MAX_CONCURRENCY = 5;
const LOCK_TTL_MS = 30 * 60 * 1000;

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const lockKey = `lock:market-backfill:binance:spot:${options.timeframe}`;
  const lock = await acquireRedisLock({ key: lockKey, ttlMs: LOCK_TTL_MS });

  if (!lock) {
    console.warn(`market:backfill:pg refused: lock exists for timeframe=${options.timeframe}`);
    process.exitCode = 1;
    return;
  }

  const store = new PgMarketDataStore();
  const jobId = randomUUID();
  let symbolsDone = 0;
  let candlesInserted = 0;
  let candlesUpdated = 0;
  const results: SymbolBackfillResult[] = [];

  try {
    const symbols = await resolveSymbols({ store, options });

    if (symbols.length === 0) {
      throw new Error("No enabled PostgreSQL symbols matched the backfill request.");
    }

    await store.createMarketDataSyncJob({
      id: jobId,
      timeframe: options.timeframe,
      status: "running",
      symbolsTotal: symbols.length,
      params: {
        mode: "backfill",
        targetCount: options.targetCount,
        requestedSymbols: options.symbols,
        marketLimit: options.symbols.length === 0 ? options.marketLimit : null,
        allSymbols: options.symbols.length === 0 ? options.allSymbols : false,
        assetClass: options.assetClass,
        includeNonScanner: options.includeNonScanner,
        concurrency: options.concurrency,
        batchLimit: options.batchLimit,
        maxBatches: options.maxBatches,
        source: "binance",
        baseUrl: options.baseUrl,
        lockKey,
      },
    });

    console.info(
      `market:backfill:pg started job=${jobId} timeframe=${options.timeframe} symbols=${symbols.length} targetCount=${options.targetCount}`,
    );

    const gate = pLimit(options.concurrency);

    await Promise.all(
      symbols.map((symbol) =>
        gate(async () => {
          const result = await backfillSymbol({ store, symbol, options });
          results.push(result);
          symbolsDone += 1;
          candlesInserted += result.inserted;
          candlesUpdated += result.updated;
          console.info(
            `market:backfill:pg ${result.symbol} beforeCount=${result.beforeCount} afterCount=${result.afterCount} inserted=${result.inserted} updated=${result.updated} batches=${result.batches} ${result.status}`,
          );
          console.info(
            `market:backfill:pg progress ${symbolsDone}/${symbols.length} inserted=${candlesInserted} updated=${candlesUpdated}`,
          );
        }),
      ),
    );

    const failed = results.filter((result) => result.status === "failed");
    const status =
      failed.length === 0
        ? "success"
        : failed.length === results.length
          ? "failed"
          : "partial_success";

    await store.finishMarketDataSyncJob({
      id: jobId,
      status,
      symbolsDone,
      candlesInserted,
      candlesUpdated,
      errorMessage: failed[0]?.message ?? null,
    });

    console.info(
      `market:backfill:pg finished job=${jobId} status=${status} inserted=${candlesInserted} updated=${candlesUpdated} failed=${failed.length}`,
    );

    if (status === "failed") {
      process.exitCode = 1;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Market backfill failed.";
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
    console.error(message);
    process.exitCode = 1;
  } finally {
    await Promise.all([
      store.close().catch(() => undefined),
      lock.release().catch(() => false),
    ]);
  }
}

async function backfillSymbol({
  store,
  symbol,
  options,
}: {
  store: PgMarketDataStore;
  symbol: PgSymbol;
  options: BackfillOptions;
}): Promise<SymbolBackfillResult> {
  try {
    let coverage = await store.getCandleCoverageForSymbol({
      symbol: symbol.symbol,
      timeframe: options.timeframe,
    });
    const beforeCount = coverage.candleCount;

    if (coverage.candleCount >= options.targetCount) {
      return {
        symbol: symbol.symbol,
        beforeCount,
        afterCount: coverage.candleCount,
        inserted: 0,
        updated: 0,
        batches: 0,
        status: "skippedEnough",
      };
    }

    let inserted = 0;
    let updated = 0;
    let batches = 0;
    let noMoreHistory = false;

    while (coverage.candleCount < options.targetCount && batches < options.maxBatches) {
      const previousEarliest = coverage.earliestOpenTimeMs;
      const endTime = previousEarliest === null ? undefined : previousEarliest - 1;
      const candles = await fetchBinanceKlines({
        symbol: symbol.symbol,
        timeframe: options.timeframe as BinanceKlineTimeframe,
        limit: options.batchLimit,
        endTime,
      });
      const closedCandles = filterClosedCandles(candles);

      batches += 1;

      if (closedCandles.length === 0) {
        noMoreHistory = true;
        break;
      }

      const earliestReturned = Math.min(...closedCandles.map((candle) => candle.openTime));

      if (previousEarliest !== null && earliestReturned >= previousEarliest) {
        noMoreHistory = true;
        break;
      }

      const stats = await store.upsertCandles({
        symbol: symbol.symbol,
        timeframe: options.timeframe,
        candles: closedCandles,
      });
      inserted += stats.inserted;
      updated += stats.updated;

      coverage = await store.getCandleCoverageForSymbol({
        symbol: symbol.symbol,
        timeframe: options.timeframe,
      });

      if (coverage.earliestOpenTimeMs === previousEarliest) {
        noMoreHistory = true;
        break;
      }
    }

    coverage = await store.getCandleCoverageForSymbol({
      symbol: symbol.symbol,
      timeframe: options.timeframe,
    });

    return {
      symbol: symbol.symbol,
      beforeCount,
      afterCount: coverage.candleCount,
      inserted,
      updated,
      batches,
      status: noMoreHistory ? "noMoreHistory" : "backfilled",
    };
  } catch (error) {
    return {
      symbol: symbol.symbol,
      beforeCount: 0,
      afterCount: 0,
      inserted: 0,
      updated: 0,
      batches: 0,
      status: "failed",
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function resolveSymbols({
  store,
  options,
}: {
  store: PgMarketDataStore;
  options: BackfillOptions;
}) {
  if (options.symbols.length > 0) {
    return store.listSymbolsByNames(options.symbols);
  }

  return store.listSymbols({
    limit: options.allSymbols ? null : options.marketLimit,
    assetClass: options.assetClass,
    includeNonScanner: options.includeNonScanner,
  });
}

function parseOptions(args: string[]): BackfillOptions {
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
  const targetCount = parseInteger({
    value: flags.targetCount,
    fallback: DEFAULT_TARGET_COUNT,
    min: 1,
    max: MAX_TARGET_COUNT,
    name: "targetCount",
  });

  if (symbols.length === 0 && allSymbols && !confirmLargeSync) {
    throw new Error("--all-symbols requires --confirm-large-sync.");
  }

  if (symbols.length === 0 && marketLimit > LARGE_SYNC_THRESHOLD && !confirmLargeSync) {
    throw new Error(
      `marketLimit above ${LARGE_SYNC_THRESHOLD} requires --confirm-large-sync.`,
    );
  }

  if (targetCount > 5000 && !confirmLargeSync) {
    throw new Error("targetCount above 5000 requires --confirm-large-sync.");
  }

  return {
    symbols,
    timeframe: parseTimeframe(flags.timeframe),
    targetCount,
    batchLimit: parseInteger({
      value: flags.batchLimit ?? flags.limit,
      fallback: DEFAULT_BATCH_LIMIT,
      min: 1,
      max: MAX_BATCH_LIMIT,
      name: "batchLimit",
    }),
    maxBatches: parseInteger({
      value: flags.maxBatches,
      fallback: DEFAULT_MAX_BATCHES,
      min: 1,
      max: MAX_BATCHES,
      name: "maxBatches",
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

function parseTimeframe(value: string | undefined): MarketDataTimeframe {
  const timeframe = value ?? "4h";

  if (!MARKET_DATA_TIMEFRAMES.includes(timeframe as MarketDataTimeframe)) {
    throw new Error(`timeframe must be one of ${MARKET_DATA_TIMEFRAMES.join(", ")}.`);
  }

  return timeframe as MarketDataTimeframe;
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

function filterClosedCandles<T extends { closeTime: number }>(candles: T[]) {
  const now = Date.now();
  return candles.filter((candle) => candle.closeTime <= now);
}

function toCamelCase(value: string) {
  return value.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "market:backfill:pg failed");
  process.exitCode = 1;
});
