import { randomUUID } from "node:crypto";
import pLimit from "p-limit";
import { getEligibleUsdtMarkets } from "@/lib/exchanges/binance";
import type { Market } from "@/lib/exchanges/types";
import {
  fetchBinanceKlines,
  type BinanceKlineTimeframe,
} from "@/lib/market-data/binanceProvider";
import {
  MARKET_DATA_TIMEFRAMES,
  PgMarketDataStore,
  type MarketDataTimeframe,
} from "@/lib/storage/postgres/marketDataPg";

type SyncOptions = {
  symbols: string[];
  timeframe: MarketDataTimeframe;
  candleLimit: number;
  marketLimit: number;
  concurrency: number;
};

const DEFAULT_MARKET_LIMIT = 5;
const MAX_DEFAULT_MARKET_LIMIT = 25;
const DEFAULT_CANDLE_LIMIT = 100;
const MAX_CANDLE_LIMIT = 1000;
const DEFAULT_CONCURRENCY = 3;
const MAX_CONCURRENCY = 5;

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const store = new PgMarketDataStore();
  const jobId = randomUUID();
  const startedAt = Date.now();

  try {
    const markets = await resolveMarkets(options);

    if (markets.length === 0) {
      throw new Error("No Binance Spot USDT symbols matched the sync request.");
    }

    await store.upsertSymbols(markets);
    await store.createMarketDataSyncJob({
      id: jobId,
      timeframe: options.timeframe,
      status: "running",
      symbolsTotal: markets.length,
      params: {
        requestedSymbols: options.symbols,
        marketLimit: options.symbols.length === 0 ? options.marketLimit : null,
        candleLimit: options.candleLimit,
        concurrency: options.concurrency,
      },
    });

    console.info(
      `market:sync:pg started job=${jobId} timeframe=${options.timeframe} symbols=${markets.length} limit=${options.candleLimit}`,
    );

    const gate = pLimit(options.concurrency);
    let symbolsDone = 0;
    let candlesInserted = 0;
    let candlesUpdated = 0;
    const errors: Array<{ symbol: string; message: string }> = [];

    await Promise.all(
      markets.map((market) =>
        gate(async () => {
          try {
            const candles = await fetchBinanceKlines({
              symbol: market.symbol,
              timeframe: options.timeframe as BinanceKlineTimeframe,
              limit: options.candleLimit,
            });
            const stats = await store.upsertCandles({
              symbol: market.symbol,
              timeframe: options.timeframe,
              candles,
            });

            candlesInserted += stats.inserted;
            candlesUpdated += stats.updated;
            console.info(
              `market:sync:pg ${market.symbol} done inserted=${stats.inserted} updated=${stats.updated}`,
            );
          } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            errors.push({ symbol: market.symbol, message });
            console.warn(`market:sync:pg ${market.symbol} failed: ${message}`);
          } finally {
            symbolsDone += 1;
            console.info(
              `market:sync:pg progress ${symbolsDone}/${markets.length} inserted=${candlesInserted} updated=${candlesUpdated} failed=${errors.length}`,
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
      `market:sync:pg finished job=${jobId} status=${status} durationMs=${Date.now() - startedAt} inserted=${candlesInserted} updated=${candlesUpdated} failed=${errors.length}`,
    );

    if (status === "failed") {
      process.exitCode = 1;
    }
  } finally {
    await store.close();
  }
}

async function resolveMarkets(options: SyncOptions): Promise<Market[]> {
  if (options.symbols.length === 0) {
    const { markets } = await getEligibleUsdtMarkets({
      maxSymbols: options.marketLimit,
      safetyCap: options.marketLimit,
    });
    return markets;
  }

  const requested = new Set(options.symbols);
  const { markets } = await getEligibleUsdtMarkets({ maxSymbols: null });
  return markets.filter((market) => requested.has(market.symbol));
}

function parseOptions(args: string[]): SyncOptions {
  const flags = parseFlags(args);
  const symbols = parseSymbols(flags.symbols ?? flags.symbol);

  return {
    symbols,
    timeframe: parseTimeframe(flags.timeframe),
    candleLimit: parseInteger({
      value: flags.limit,
      fallback: DEFAULT_CANDLE_LIMIT,
      min: 1,
      max: MAX_CANDLE_LIMIT,
      name: "limit",
    }),
    marketLimit: parseInteger({
      value: flags.marketLimit,
      fallback: DEFAULT_MARKET_LIMIT,
      min: 1,
      max: MAX_DEFAULT_MARKET_LIMIT,
      name: "marketLimit",
    }),
    concurrency: parseInteger({
      value: flags.concurrency,
      fallback: DEFAULT_CONCURRENCY,
      min: 1,
      max: MAX_CONCURRENCY,
      name: "concurrency",
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

function parseTimeframe(value: string | undefined): MarketDataTimeframe {
  const timeframe = value ?? "1h";

  if (!MARKET_DATA_TIMEFRAMES.includes(timeframe as MarketDataTimeframe)) {
    throw new Error(`timeframe must be one of ${MARKET_DATA_TIMEFRAMES.join(", ")}.`);
  }

  return timeframe as MarketDataTimeframe;
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

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "market:sync:pg failed");
  process.exitCode = 1;
});
