import { MarketDataStore } from "../src/lib/storage/marketData";
import { TIMEFRAMES, type Timeframe } from "../src/lib/exchanges/types";
import { fetchBinanceKlines } from "../src/lib/market-data/binanceProvider";
import {
  normalizeSymbols,
  resolveCryptoUniverse,
} from "../src/lib/market-data/cryptoUniverse";
import type { Market } from "../src/lib/exchanges/types";

type MarketCommand = "sync" | "stats" | "inspect";

const MAX_LOOKBACK = 1000;
const DEFAULT_LOOKBACK = 500;

async function main() {
  const [, , rawCommand, ...args] = process.argv;
  const command = parseCommand(rawCommand);

  switch (command) {
    case "sync":
      await runSync(args);
      return;
    case "stats":
      await runStats();
      return;
    case "inspect":
      await runInspect(args);
      return;
  }
}

async function runSync(args: string[]) {
  const options = parseSyncOptions(args);

  if (options.dryRun) {
    printJson({
      dryRun: true,
      message: "Dry run only. No Binance requests were made and no candles were saved.",
      symbols: options.symbols,
      timeframes: options.timeframes,
      lookback: options.lookback,
    });
    return;
  }

  const store = new MarketDataStore();
  const jobs = options.timeframes.map((timeframe) =>
    store.createMarketDataSyncJob({
      universe: options.universe ?? null,
      symbols: options.symbols,
      timeframe,
      metadata: { lookback: options.lookback },
    }),
  );
  let candlesFetched = 0;
  let candlesInserted = 0;
  let candlesUpdated = 0;
  let syncedPairs = 0;
  const errors: Array<{ symbol: string; timeframe: Timeframe; message: string }> = [];

  try {
    store.upsertMarkets(options.symbols.map(toMarket));

    for (const timeframe of options.timeframes) {
      let syncedForTimeframe = 0;
      let failedForTimeframe = 0;
      let candlesForTimeframe = 0;
      let insertedForTimeframe = 0;
      let updatedForTimeframe = 0;

      for (const symbol of options.symbols) {
        try {
          const candles = await fetchBinanceKlines({
            symbol,
            timeframe,
            limit: options.lookback,
          });
          const upsertStats = store.saveCandles({ symbol, timeframe, candles });
          candlesFetched += candles.length;
          candlesInserted += upsertStats.inserted;
          candlesUpdated += upsertStats.updated;
          candlesForTimeframe += candles.length;
          insertedForTimeframe += upsertStats.inserted;
          updatedForTimeframe += upsertStats.updated;
          syncedPairs += 1;
          syncedForTimeframe += 1;
        } catch (error) {
          failedForTimeframe += 1;
          errors.push({
            symbol,
            timeframe,
            message: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      const job = jobs.find((item) => item.timeframe === timeframe);
      if (job) {
        const timeframeErrors = errors.filter((error) => error.timeframe === timeframe);
        store.finishMarketDataSyncJob({
          id: job.id,
          status:
            syncedForTimeframe === 0
              ? "failed"
              : failedForTimeframe > 0
                ? "partial_success"
                : "success",
          syncedSymbols: syncedForTimeframe,
          failedSymbols: failedForTimeframe,
          candlesFetched: candlesForTimeframe,
          candlesInserted: insertedForTimeframe,
          candlesUpdated: updatedForTimeframe,
          errors: timeframeErrors,
          errorMessage:
            syncedForTimeframe > 0
              ? null
              : timeframeErrors[0]?.message ?? "All symbols failed.",
        });
      }
    }

    const result = {
      requestedSymbols: options.symbols.length,
      requestedPairs: options.symbols.length * options.timeframes.length,
      syncedPairs,
      failedPairs: errors.length,
      candlesFetched,
      candlesInserted,
      candlesUpdated,
      summary: store.getSummary(),
      jobs: store.listMarketDataSyncJobs({ limit: options.timeframes.length }),
      errors,
    };

    printJson(result);

    if (syncedPairs === 0 && errors.length > 0) {
      throw new Error("All requested market sync pairs failed.");
    }
  } finally {
    store.close();
  }
}

async function runStats() {
  const store = new MarketDataStore();
  try {
    printJson({
      summary: store.getSummary(),
      latestJobs: store.listMarketDataSyncJobs({ limit: 10 }),
    });
  } finally {
    store.close();
  }
}

async function runInspect(args: string[]) {
  const flags = parseFlags(args);
  const symbol =
    typeof flags.symbol === "string" ? flags.symbol.toUpperCase() : undefined;
  const timeframe = parseTimeframe(flags.timeframe, "4h");
  const limit = parseInteger(flags.limit, 20, 1, 500, "limit");

  if (!symbol) {
    throw new Error("market:inspect requires --symbol=BTCUSDT.");
  }

  const store = new MarketDataStore();
  try {
    printJson({
      symbol,
      timeframe,
      coverage: store.getCandleCoverage({ symbol, timeframe }),
      latestOpenTime: store.getLatestCandleTime({ symbol, timeframe }),
      candles: store.getCandles({ symbol, timeframe, limit }),
    });
  } finally {
    store.close();
  }
}

function parseSyncOptions(args: string[]) {
  const flags = parseFlags(args);
  const explicitSymbols = [
    ...(typeof flags.symbol === "string" ? [flags.symbol] : []),
    ...(typeof flags.symbols === "string" ? flags.symbols.split(",") : []),
  ];
  const universeSymbols = resolveCryptoUniverse(
    typeof flags.universe === "string" ? flags.universe : undefined,
  );
  const symbols = normalizeSymbols([...explicitSymbols, ...universeSymbols]);

  if (symbols.length === 0) {
    throw new Error(
      "market:sync requires --symbol, --symbols, or --universe=core. It will not default to all markets.",
    );
  }

  return {
    dryRun: Boolean(flags["dry-run"]),
    universe: typeof flags.universe === "string" ? flags.universe : undefined,
    symbols,
    timeframes: parseTimeframes(flags.timeframe ?? flags.timeframes),
    lookback: parseInteger(flags.lookback, DEFAULT_LOOKBACK, 1, MAX_LOOKBACK, "lookback"),
  };
}

function parseCommand(value: string | undefined): MarketCommand {
  if (value === "sync" || value === "stats" || value === "inspect") {
    return value;
  }

  throw new Error("Market command must be one of sync, stats, or inspect.");
}

function parseTimeframes(value: string | boolean | undefined): Timeframe[] {
  if (value === undefined || value === "") {
    return ["4h"];
  }

  if (typeof value !== "string") {
    throw new Error(`timeframe must be one of ${TIMEFRAMES.join(", ")}.`);
  }

  const timeframes = Array.from(new Set(value.split(",")));
  if (timeframes.some((timeframe) => !TIMEFRAMES.includes(timeframe as Timeframe))) {
    throw new Error(`timeframe must be one of ${TIMEFRAMES.join(", ")}.`);
  }

  return timeframes as Timeframe[];
}

function parseTimeframe(
  value: string | boolean | undefined,
  fallback: Timeframe,
): Timeframe {
  const [timeframe] = parseTimeframes(value ?? fallback);
  return timeframe;
}

function parseInteger(
  value: string | boolean | undefined,
  fallback: number,
  min: number,
  max: number,
  name: string,
) {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }

  return parsed;
}

function parseFlags(args: string[]) {
  const flags: Record<string, string | boolean> = {};
  for (const arg of args) {
    if (!arg.startsWith("--")) {
      throw new Error(`Unsupported argument "${arg}". Use --name=value flags.`);
    }

    const [name, ...rawValue] = arg.slice(2).split("=");
    flags[name] = rawValue.length === 0 ? true : rawValue.join("=");
  }

  return flags;
}

function toMarket(symbol: string): Market {
  return {
    exchange: "binance",
    symbol,
    baseAsset: symbol.replace(/USDT$/, ""),
    quoteAsset: "USDT",
    status: "TRADING",
  };
}

function printJson(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
