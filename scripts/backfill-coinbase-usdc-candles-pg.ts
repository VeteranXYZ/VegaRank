import { randomUUID } from "node:crypto";
import pLimit from "p-limit";
import {
  createCcxtCoinbaseClient,
  createCcxtCoinbaseProvider,
} from "@/lib/market-data/providers/ccxtCoinbaseProvider";
import {
  backfillCoinbaseCandlesForSymbol,
  type CoinbaseBackfillTimeframe,
} from "@/lib/market-data/coinbaseSupplementalBackfill";
import {
  PgMarketDataStore,
  type PgSymbol,
} from "@/lib/storage/postgres/marketDataPg";
import type { MarketDataProvider } from "@/lib/market-data/marketDataProvider";

export type BackfillOptions = {
  timeframe: CoinbaseBackfillTimeframe;
  symbols: string[];
  limitSymbols: number;
  targetCandles: number;
  providerMaxCandlesPerRequest: number;
  concurrency: number;
  endTimeMs: number;
};

const SUPPORTED_TIMEFRAMES = ["1h", "4h", "1d", "1w"] as const;
const DEFAULT_LIMIT_SYMBOLS = 5;
const MAX_LIMIT_SYMBOLS = 500;
const DEFAULT_TARGET_CANDLES = 300;
const MAX_TARGET_CANDLES = 50_000;
const DEFAULT_PROVIDER_LIMIT = 300;
const MAX_PROVIDER_LIMIT = 1000;
const DEFAULT_CONCURRENCY = 2;
const MAX_CONCURRENCY = 5;

async function main() {
  const options = parseCoinbaseBackfillOptions(process.argv.slice(2));
  const provider = await createProviderForTimeframe(options.timeframe);
  const store = new PgMarketDataStore();
  const jobId = randomUUID();
  const results: Awaited<ReturnType<typeof backfillCoinbaseCandlesForSymbol>>[] = [];
  let symbolsDone = 0;
  let candlesInserted = 0;
  let candlesUpdated = 0;

  try {
    const symbols = await resolveCoinbaseSymbols({ store, options });

    if (symbols.length === 0) {
      throw new Error("No Coinbase PostgreSQL symbols matched the backfill request.");
    }

    await store.createMarketDataSyncJob({
      id: jobId,
      exchange: "coinbase",
      market: "spot",
      timeframe: options.timeframe,
      status: "running",
      symbolsTotal: symbols.length,
      params: {
        mode: "manual-coinbase-usdc-backfill",
        requestedSymbols: options.symbols,
        limitSymbols: options.symbols.length === 0 ? options.limitSymbols : null,
        targetCandles: options.targetCandles,
        providerMaxCandlesPerRequest: options.providerMaxCandlesPerRequest,
        concurrency: options.concurrency,
        endTimeMs: options.endTimeMs,
        source: "ccxt",
      },
    });

    console.info(
      `coinbase:backfill started job=${jobId} timeframe=${options.timeframe} symbols=${symbols.length} targetCandles=${options.targetCandles}`,
    );

    const gate = pLimit(options.concurrency);

    await Promise.all(
      symbols.map((symbol) =>
        gate(async () => {
          const result = await backfillCoinbaseCandlesForSymbol({
            store,
            provider,
            symbol,
            timeframe: options.timeframe,
            targetCandles: options.targetCandles,
            providerMaxCandlesPerRequest: options.providerMaxCandlesPerRequest,
            endTimeMs: options.endTimeMs,
          });

          results.push(result);
          symbolsDone += 1;
          candlesInserted += result.inserted;
          candlesUpdated += result.updated;
          console.info(
            `coinbase:backfill ${result.symbol} ${result.timeframe} windows=${result.requestedWindows} fetched=${result.fetchedCandles} normalized=${result.normalizedCandles} gaps=${result.gapCount} inserted=${result.inserted} updated=${result.updated}`,
          );

          if (result.weeklyDiagnostics) {
            console.info(
              `coinbase:backfill ${result.symbol} weekly completeWeeks=${result.weeklyDiagnostics.completeWeeks} partialWeeks=${result.weeklyDiagnostics.partialWeeks} droppedPartialWeeks=${result.weeklyDiagnostics.droppedPartialWeeks} gapsDetected=${result.weeklyDiagnostics.gapsDetected}`,
            );
          }
        }),
      ),
    );

    await store.finishMarketDataSyncJob({
      id: jobId,
      status: "success",
      symbolsDone,
      candlesInserted,
      candlesUpdated,
      errorMessage: null,
    });

    printJson({
      ok: true,
      jobId,
      timeframe: options.timeframe,
      symbolsDone,
      candlesInserted,
      candlesUpdated,
      results: results.map((result) => ({
        symbol: result.symbol,
        timeframe: result.timeframe,
        windows: result.requestedWindows,
        fetched: result.fetchedCandles,
        normalized: result.normalizedCandles,
        inserted: result.inserted,
        updated: result.updated,
        gaps: result.gapCount,
        droppedPartialWeeks: result.weeklyDiagnostics?.droppedPartialWeeks,
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Coinbase candle backfill failed.";
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
    await store.close().catch(() => undefined);
  }
}

async function createProviderForTimeframe(
  timeframe: CoinbaseBackfillTimeframe,
): Promise<MarketDataProvider> {
  if (timeframe === "1w") {
    return {
      provider: "ccxt",
      listMarkets: async () => [],
      fetchCandles: async () => {
        throw new Error("Coinbase weekly aggregation reads stored daily candles.");
      },
    };
  }

  const client = await createCcxtCoinbaseClient();
  return createCcxtCoinbaseProvider(client);
}

async function resolveCoinbaseSymbols({
  store,
  options,
}: {
  store: PgMarketDataStore;
  options: BackfillOptions;
}): Promise<PgSymbol[]> {
  if (options.symbols.length > 0) {
    return store.listSymbolsByNames(options.symbols, {
      exchange: "coinbase",
      market: "spot",
    });
  }

  return store.listSymbols({
    exchange: "coinbase",
    market: "spot",
    limit: options.limitSymbols,
    assetClass: "all",
    includeNonScanner: true,
  });
}

export function parseCoinbaseBackfillOptions(args: string[]): BackfillOptions {
  const flags = parseFlags(args);

  return {
    timeframe: parseTimeframe(flags.timeframe),
    symbols: parseSymbols(flags.symbols ?? flags.symbol),
    limitSymbols: parseInteger({
      value: flags.limitSymbols,
      fallback: DEFAULT_LIMIT_SYMBOLS,
      min: 1,
      max: MAX_LIMIT_SYMBOLS,
      name: "limit-symbols",
    }),
    targetCandles: parseInteger({
      value: flags.targetCandles,
      fallback: DEFAULT_TARGET_CANDLES,
      min: 1,
      max: MAX_TARGET_CANDLES,
      name: "target-candles",
    }),
    providerMaxCandlesPerRequest: parseInteger({
      value: flags.maxCandlesPerRequest,
      fallback: DEFAULT_PROVIDER_LIMIT,
      min: 1,
      max: MAX_PROVIDER_LIMIT,
      name: "max-candles-per-request",
    }),
    concurrency: parseInteger({
      value: flags.concurrency,
      fallback: DEFAULT_CONCURRENCY,
      min: 1,
      max: MAX_CONCURRENCY,
      name: "concurrency",
    }),
    endTimeMs: parseInteger({
      value: flags.endTimeMs,
      fallback: Date.now(),
      min: 1,
      max: Number.MAX_SAFE_INTEGER,
      name: "end-time-ms",
    }),
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

function parseTimeframe(value: string | undefined): CoinbaseBackfillTimeframe {
  const timeframe = value ?? "1h";

  if (!SUPPORTED_TIMEFRAMES.includes(timeframe as CoinbaseBackfillTimeframe)) {
    throw new Error(`timeframe must be one of ${SUPPORTED_TIMEFRAMES.join(", ")}.`);
  }

  return timeframe as CoinbaseBackfillTimeframe;
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

function printJson(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

if (process.argv[1]?.endsWith("backfill-coinbase-usdc-candles-pg.ts")) {
  main().catch((error) => {
    console.error(
      error instanceof Error
        ? error.message
        : "Coinbase candle backfill failed.",
    );
    process.exitCode = 1;
  });
}
