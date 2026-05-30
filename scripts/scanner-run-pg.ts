import { randomUUID } from "node:crypto";
import pLimit from "p-limit";
import type { Timeframe } from "@/lib/exchanges/types";
import { acquireRedisLock } from "@/lib/cache/redisLock";
import { scanCandles } from "@/lib/scanner/scanCandles";
import { PgMarketDataStore } from "@/lib/storage/postgres/marketDataPg";
import {
  PgScannerResultsStore,
  type InsertScanSignalInput,
} from "@/lib/storage/postgres/scannerResultsPg";

type ScannerRunOptions = {
  symbols: string[];
  timeframe: PgScannerTimeframe;
  candleLimit: number;
  marketLimit: number;
  concurrency: number;
};

type SkipStats = {
  insufficient_candles: number;
  scanner_returned_empty: number;
};

const DEFAULT_MARKET_LIMIT = 25;
const MAX_MARKET_LIMIT = 100;
const DEFAULT_CANDLE_LIMIT = 500;
const MAX_CANDLE_LIMIT = 1000;
const DEFAULT_CONCURRENCY = 3;
const MAX_CONCURRENCY = 5;
const MIN_SCAN_CANDLES = 200;
const LOCK_TTL_MS = 30 * 60 * 1000;
const SUPPORTED_PG_SCANNER_TIMEFRAMES = ["1h", "4h", "1d", "1w"] as const;
type PgScannerTimeframe = (typeof SUPPORTED_PG_SCANNER_TIMEFRAMES)[number];

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const lockKey = `lock:scanner:binance:spot:${options.timeframe}`;
  const lock = await acquireRedisLock({ key: lockKey, ttlMs: LOCK_TTL_MS });

  if (!lock) {
    console.warn(`scanner:run:pg refused: lock exists for timeframe=${options.timeframe}`);
    process.exitCode = 1;
    return;
  }

  const marketData = new PgMarketDataStore();
  const scannerResults = new PgScannerResultsStore();
  const scanRunId = randomUUID();
  let runCreated = false;
  let symbolsScanned = 0;
  let signalsCreated = 0;
  let symbolsSkipped = 0;
  let failedSymbols = 0;
  const skipStats: SkipStats = {
    insufficient_candles: 0,
    scanner_returned_empty: 0,
  };

  try {
    const symbols = await resolveSymbols({ store: marketData, options });

    if (symbols.length === 0) {
      throw new Error("No enabled PostgreSQL symbols matched the scanner request.");
    }

    await scannerResults.createScanRun({
      id: scanRunId,
      timeframe: options.timeframe,
      universe: options.symbols.length > 0 ? "explicit-symbols" : "top-enabled-symbols",
      status: "running",
      symbolsTotal: symbols.length,
      params: {
        candleLimit: options.candleLimit,
        marketLimit: options.symbols.length > 0 ? null : options.marketLimit,
        requestedSymbols: options.symbols,
        source: "postgres",
        scannerMode: "single",
        exchange: "binance",
        market: "spot",
        concurrency: options.concurrency,
        lockKey,
      },
    });
    runCreated = true;

    console.info(
      `scanner:run:pg started run=${scanRunId} timeframe=${options.timeframe} symbols=${symbols.length} candleLimit=${options.candleLimit}`,
    );

    const gate = pLimit(options.concurrency);
    const signals: InsertScanSignalInput[] = [];

    await Promise.all(
      symbols.map((symbol) =>
        gate(async () => {
          try {
            const candles = await marketData.listCandlesForScan({
              symbol: symbol.symbol,
              timeframe: options.timeframe,
              limit: options.candleLimit,
            });

            if (candles.length < MIN_SCAN_CANDLES) {
              symbolsSkipped += 1;
              skipStats.insufficient_candles += 1;
              console.info(
                `scanner:run:pg ${symbol.symbol} skipped insufficient_candles=${candles.length}/${MIN_SCAN_CANDLES}`,
              );
              return;
            }

            const result = scanCandles(
              symbol.symbol,
              options.timeframe as Timeframe,
              candles,
            );

            if (!result || !result.dataQuality.sufficientHistory) {
              symbolsSkipped += 1;
              skipStats.scanner_returned_empty += 1;
              console.info(`scanner:run:pg ${symbol.symbol} skipped scanner_returned_empty`);
              return;
            }

            const lastCandle = candles.at(-1);
            signals.push({
              id: randomUUID(),
              scanRunId,
              symbolId: symbol.id,
              symbol: symbol.symbol,
              timeframe: options.timeframe,
              candleOpenTimeMs: lastCandle?.openTime ?? null,
              result,
            });
            symbolsScanned += 1;
            console.info(
              `scanner:run:pg ${symbol.symbol} scanned rankScore=${result.rankScore.toFixed(2)} signal=${result.signalLabel}`,
            );
          } catch (error) {
            failedSymbols += 1;
            const message = error instanceof Error ? error.message : "Unknown error";
            console.warn(`scanner:run:pg ${symbol.symbol} failed: ${message}`);
          }
        }),
      ),
    );

    signals.sort((left, right) => right.result.rankScore - left.result.rankScore);
    await scannerResults.insertScanSignals(signals);
    signalsCreated = signals.length;

    const status =
      failedSymbols === 0
        ? "success"
        : failedSymbols === symbols.length
          ? "failed"
          : "partial_success";

    await scannerResults.finishScanRun({
      id: scanRunId,
      status,
      symbolsScanned,
      signalsCreated,
      symbolsSkipped,
      failedSymbols,
      errorMessage: failedSymbols > 0 ? "Some symbols failed to scan." : null,
      paramsPatch: {
        insufficient_candles: skipStats.insufficient_candles,
        scanner_returned_empty: skipStats.scanner_returned_empty,
        skipStats,
      },
    });

    console.info(
      `scanner:run:pg finished run=${scanRunId} status=${status} scanned=${symbolsScanned} skipped=${symbolsSkipped} failed=${failedSymbols} signals=${signalsCreated}`,
    );

    if (status === "failed") {
      process.exitCode = 1;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scanner run failed.";

    if (runCreated) {
      await scannerResults
        .finishScanRun({
          id: scanRunId,
          status: "failed",
          symbolsScanned,
          signalsCreated,
          symbolsSkipped,
          failedSymbols,
          errorMessage: message,
          paramsPatch: {
            insufficient_candles: skipStats.insufficient_candles,
            scanner_returned_empty: skipStats.scanner_returned_empty,
            skipStats,
          },
        })
        .catch(() => undefined);
    }

    console.error(message);
    process.exitCode = 1;
  } finally {
    await Promise.all([
      marketData.close().catch(() => undefined),
      scannerResults.close().catch(() => undefined),
      lock.release().catch(() => false),
    ]);
  }
}

async function resolveSymbols({
  store,
  options,
}: {
  store: PgMarketDataStore;
  options: ScannerRunOptions;
}) {
  if (options.symbols.length > 0) {
    return store.listSymbolsByNames(options.symbols);
  }

  return store.listSymbols({ limit: options.marketLimit });
}

function parseOptions(args: string[]): ScannerRunOptions {
  const flags = parseFlags(args);

  return {
    symbols: parseSymbols(flags.symbols ?? flags.symbol),
    timeframe: parseTimeframe(flags.timeframe),
    candleLimit: parseInteger({
      value: flags.limit,
      fallback: DEFAULT_CANDLE_LIMIT,
      min: MIN_SCAN_CANDLES,
      max: MAX_CANDLE_LIMIT,
      name: "limit",
    }),
    marketLimit: parseInteger({
      value: flags.marketLimit,
      fallback: DEFAULT_MARKET_LIMIT,
      min: 1,
      max: MAX_MARKET_LIMIT,
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

function parseTimeframe(value: string | undefined): PgScannerTimeframe {
  const timeframe = value ?? "4h";

  if (!SUPPORTED_PG_SCANNER_TIMEFRAMES.includes(timeframe as PgScannerTimeframe)) {
    throw new Error(
      `timeframe must be one of ${SUPPORTED_PG_SCANNER_TIMEFRAMES.join(", ")}.`,
    );
  }

  return timeframe as PgScannerTimeframe;
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
  console.error(error instanceof Error ? error.message : "scanner:run:pg failed");
  process.exitCode = 1;
});
