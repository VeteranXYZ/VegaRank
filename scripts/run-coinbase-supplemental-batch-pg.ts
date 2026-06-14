import { randomUUID } from "node:crypto";
import pLimit from "p-limit";
import {
  createCcxtCoinbaseClient,
  createCcxtCoinbaseProvider,
} from "@/lib/market-data/providers/ccxtCoinbaseProvider";
import {
  backfillCoinbaseCandlesForSymbol,
  type CoinbaseBackfillTimeframe,
  type CoinbaseSymbolBackfillResult,
} from "@/lib/market-data/coinbaseSupplementalBackfill";
import { getSymbolQuality } from "@/lib/market-data/symbolClassification";
import type { MarketDataProvider } from "@/lib/market-data/marketDataProvider";
import { scanCandles } from "@/lib/ranking-engine/scanCandles";
import { calculateUniversePercentiles } from "@/lib/ranking-engine/scoring";
import type { Timeframe } from "@/lib/shared/timeframes";
import {
  PgMarketDataStore,
  type PgSymbol,
  type SymbolCandleCoverage,
} from "@/lib/storage/postgres/marketDataPg";
import {
  PgRankingResultsStore,
  type InsertScanSignalInput,
} from "@/lib/storage/postgres/rankingResultsPg";

const DEFAULT_LIMIT_SYMBOLS = 20;
const HARD_CAP_SYMBOLS = 50;
const MAX_ALLOWED_SYMBOLS = 500;
const DEFAULT_CONCURRENCY = 1;
const MAX_CONCURRENCY = 2;
const DEFAULT_PROVIDER_LIMIT = 300;
const MAX_PROVIDER_LIMIT = 1000;
const DEFAULT_SCANNER_CANDLE_LIMIT = 500;
const MIN_SCAN_CANDLES = 200;

const supportedBackfillTimeframes = ["1h", "4h", "1d", "1w"] as const;
const supportedScannerTimeframes = ["4h", "1d"] as const;

export type BatchBackfillTimeframe = (typeof supportedBackfillTimeframes)[number];
export type BatchScannerTimeframe = (typeof supportedScannerTimeframes)[number];
export type CoinbaseSupplementalSelectionMode =
  | "sample"
  | "full-universe"
  | "explicit-symbols";

export type CoinbaseSupplementalBatchOptions = {
  dryRun: boolean;
  skipImport: boolean;
  skipBackfill: boolean;
  skipScanner: boolean;
  selectionMode: CoinbaseSupplementalSelectionMode;
  symbols: string[];
  limitSymbols: number | null;
  allowLargeRun: boolean;
  timeframes: BatchBackfillTimeframe[];
  scannerTimeframes: BatchScannerTimeframe[];
  targetCandles: Record<BatchBackfillTimeframe, number>;
  providerMaxCandlesPerRequest: number;
  scannerCandleLimit: number;
  concurrency: number;
  stopOnError: boolean;
  endTimeMs: number;
};

export type CoinbaseBatchMarketDataStore = Pick<
  PgMarketDataStore,
  | "listSymbols"
  | "listSymbolsByNames"
  | "getCandleCoverageForSymbol"
  | "createMarketDataSyncJob"
  | "finishMarketDataSyncJob"
  | "listCandles"
  | "upsertCandles"
  | "listCandlesForScan"
>;

export type CoinbaseBatchRankingStore = Pick<
  PgRankingResultsStore,
  "createScanRun" | "finishScanRun" | "insertScanSignals"
>;

export type CoinbaseSupplementalBatchDeps = {
  marketDataStore: CoinbaseBatchMarketDataStore;
  rankingStore: CoinbaseBatchRankingStore;
  provider?: MarketDataProvider;
  createProvider?: () => Promise<MarketDataProvider>;
  backfillSymbol?: typeof backfillCoinbaseCandlesForSymbol;
  scanCandlesForSymbol?: typeof scanCandles;
  idFactory?: () => string;
  logger?: Pick<Console, "info" | "warn">;
  startedAtMs?: number;
};

export type CoinbaseBatchBackfillSummary = {
  status: "planned" | "success" | "failed" | "skipped";
  timeframe: BatchBackfillTimeframe;
  requestedWindows?: number;
  fetched?: number;
  normalized?: number;
  source1h?: number;
  generated4h?: number;
  dailyCandlesRead?: number;
  weeklyCandlesGenerated?: number;
  sourceTimeframe?: CoinbaseBackfillTimeframe;
  sourceCandles?: number;
  generatedCandles?: number;
  missingSourceCandles?: number;
  firstOpenTime?: number;
  lastOpenTime?: number;
  scannerEligible?: boolean;
  completeBuckets?: number;
  partialBuckets?: number;
  droppedPartialBuckets?: number;
  completeWeeks?: number;
  partialWeeks?: number;
  droppedPartialWeeks?: number;
  gapsDetected?: number;
  inserted?: number;
  updated?: number;
  error?: string;
};

export type CoinbaseBatchScannerSummary = {
  status: "planned" | "scanned" | "skipped" | "failed";
  timeframe: BatchScannerTimeframe;
  scanned: number;
  skipped: number;
  failed: number;
  signalsCreated: number;
  skipReason?: string;
  rankScore?: number;
  groupCode?: string;
  error?: string;
};

export type CoinbaseBatchSymbolReport = {
  symbol: string;
  exchange: "coinbase";
  market: "spot";
  baseAsset: string;
  quoteAsset: "USDC";
  assetClass: string;
  quality: {
    qualityTier: string;
    isLowQuality: boolean;
    qualityFlags: string[];
    candleCount?: number;
  };
  backfill: Partial<Record<BatchBackfillTimeframe, CoinbaseBatchBackfillSummary>>;
  scanner: Partial<Record<BatchScannerTimeframe, CoinbaseBatchScannerSummary>>;
};

export type CoinbaseSupplementalBatchReport = {
  ok: boolean;
  dryRun: boolean;
  skipImport: boolean;
  selectionMode: CoinbaseSupplementalSelectionMode;
  symbolsSelected: number;
  symbols: string[];
  timeframesBackfilled: BatchBackfillTimeframe[];
  scannerTimeframes: BatchScannerTimeframe[];
  perSymbol: CoinbaseBatchSymbolReport[];
  totals: {
    candlesInserted: number;
    candlesUpdated: number;
    gapsDetected: number;
    droppedPartialBuckets: number;
    droppedPartialWeeks: number;
    missingSourceCandles: number;
    symbolsScanned: number;
    symbolsSkipped: number;
    signalsCreated: number;
    failures: number;
    durationMs: number;
    qualityTierDistribution: Record<string, number>;
    qualityFlagDistribution: Record<string, number>;
  };
  sampledApiChecks: Array<{
    symbol: string;
    timeframe: BatchScannerTimeframe;
    curl: string;
  }>;
  nextRecommendedCommand: string | null;
};

type ScannerRunCounters = {
  symbolsScanned: number;
  symbolsSkipped: number;
  failedSymbols: number;
  signalsCreated: number;
  skipStats: Record<string, number>;
};

async function main() {
  const options = parseCoinbaseSupplementalBatchOptions(process.argv.slice(2));
  const marketDataStore = new PgMarketDataStore();
  const rankingStore = new PgRankingResultsStore();

  try {
    const report = await runCoinbaseSupplementalBatch(options, {
      marketDataStore,
      rankingStore,
      createProvider: async () => {
        const client = await createCcxtCoinbaseClient();
        return createCcxtCoinbaseProvider(client);
      },
      logger: console,
    });

    printJson(report);

    if (!report.ok) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "Coinbase supplemental batch failed.",
    );
    process.exitCode = 1;
  } finally {
    await Promise.all([
      marketDataStore.close().catch(() => undefined),
      rankingStore.close().catch(() => undefined),
    ]);
  }
}

export function parseCoinbaseSupplementalBatchOptions(
  args: string[],
): CoinbaseSupplementalBatchOptions {
  const flags = parseFlags(args);
  const symbols = parseSymbols(flags.symbols ?? flags.symbol);
  const fullUniverse = parseBooleanFlag(flags.fullUniverse, false, "full-universe");

  if (fullUniverse && symbols.length > 0) {
    throw new Error("--full-universe cannot be combined with --symbols.");
  }

  if (fullUniverse && flags.limitSymbols !== undefined) {
    throw new Error("--full-universe cannot be combined with --limit-symbols.");
  }

  const allowLargeRun = parseBooleanFlag(flags.allowLargeRun, false, "allow-large-run");
  const selectionMode: CoinbaseSupplementalSelectionMode =
    symbols.length > 0 ? "explicit-symbols" : fullUniverse ? "full-universe" : "sample";
  const limitSymbols =
    selectionMode === "sample"
      ? parseInteger({
          value: flags.limitSymbols,
          fallback: DEFAULT_LIMIT_SYMBOLS,
          min: 1,
          max: MAX_ALLOWED_SYMBOLS,
          name: "limit-symbols",
        })
      : null;
  const requestedSymbolCount =
    selectionMode === "explicit-symbols"
      ? symbols.length
      : selectionMode === "sample"
        ? (limitSymbols ?? DEFAULT_LIMIT_SYMBOLS)
        : 0;

  if (
    selectionMode !== "full-universe" &&
    requestedSymbolCount > HARD_CAP_SYMBOLS &&
    !allowLargeRun
  ) {
    throw new Error(
      `Coinbase batch is capped at ${HARD_CAP_SYMBOLS} symbols unless --allow-large-run is set.`,
    );
  }

  const skipImport = parseBooleanFlag(flags.skipImport, true, "skip-import");

  if (!skipImport) {
    throw new Error(
      "Coinbase supplemental batch uses already-imported symbols; import is not part of this runner.",
    );
  }

  return {
    dryRun: parseBooleanFlag(flags.dryRun, false, "dry-run"),
    skipImport,
    skipBackfill: parseBooleanFlag(flags.skipBackfill, false, "skip-backfill"),
    skipScanner: parseBooleanFlag(flags.skipScanner, false, "skip-scanner"),
    selectionMode,
    symbols,
    limitSymbols,
    allowLargeRun,
    timeframes: parseBackfillTimeframes(flags.timeframes),
    scannerTimeframes: parseScannerTimeframes(flags.scannerTimeframes),
    targetCandles: {
      "1h": parseInteger({
        value: flags.targetCandles1h,
        fallback: 250,
        min: 1,
        max: 50_000,
        name: "target-candles-1h",
      }),
      "4h": parseInteger({
        value: flags.targetCandles4h,
        fallback: 250,
        min: 1,
        max: 50_000,
        name: "target-candles-4h",
      }),
      "1d": parseInteger({
        value: flags.targetCandles1d,
        fallback: 250,
        min: 1,
        max: 50_000,
        name: "target-candles-1d",
      }),
      "1w": parseInteger({
        value: flags.targetCandles1w,
        fallback: 30,
        min: 1,
        max: 10_000,
        name: "target-candles-1w",
      }),
    },
    providerMaxCandlesPerRequest: parseInteger({
      value: flags.maxCandlesPerRequest,
      fallback: DEFAULT_PROVIDER_LIMIT,
      min: 1,
      max: MAX_PROVIDER_LIMIT,
      name: "max-candles-per-request",
    }),
    scannerCandleLimit: parseInteger({
      value: flags.scannerCandleLimit ?? flags.limit,
      fallback: DEFAULT_SCANNER_CANDLE_LIMIT,
      min: MIN_SCAN_CANDLES,
      max: 1000,
      name: "scanner-candle-limit",
    }),
    concurrency: parseInteger({
      value: flags.concurrency,
      fallback: DEFAULT_CONCURRENCY,
      min: 1,
      max: MAX_CONCURRENCY,
      name: "concurrency",
    }),
    stopOnError: parseBooleanFlag(flags.stopOnError, true, "stop-on-error"),
    endTimeMs: parseInteger({
      value: flags.endTimeMs,
      fallback: Date.now(),
      min: 1,
      max: Number.MAX_SAFE_INTEGER,
      name: "end-time-ms",
    }),
  };
}

export async function runCoinbaseSupplementalBatch(
  options: CoinbaseSupplementalBatchOptions,
  deps: CoinbaseSupplementalBatchDeps,
): Promise<CoinbaseSupplementalBatchReport> {
  const startedAtMs = deps.startedAtMs ?? Date.now();
  const idFactory = deps.idFactory ?? randomUUID;
  const logger = deps.logger ?? console;
  const symbols = await selectCoinbaseBatchSymbols({
    store: deps.marketDataStore,
    options,
  });

  if (symbols.length === 0) {
    throw new Error("No Coinbase -USDC symbols matched the batch request.");
  }

  const perSymbol = await buildInitialSymbolReports({
    store: deps.marketDataStore,
    symbols,
    options,
  });
  const report = createInitialReport({ options, perSymbol, startedAtMs });

  if (options.dryRun) {
    markDryRunPlans({ report, options });
    report.totals.durationMs = Date.now() - startedAtMs;
    report.sampledApiChecks = buildSampledApiChecks(report.symbols);
    report.nextRecommendedCommand = buildNextRecommendedCommand(options, false);
    return report;
  }

  try {
    if (!options.skipBackfill) {
      const provider = await resolveProvider(deps);

      await runBackfillStage({
        options,
        report,
        symbols,
        marketDataStore: deps.marketDataStore,
        provider,
        idFactory,
        logger,
        backfillSymbol: deps.backfillSymbol ?? backfillCoinbaseCandlesForSymbol,
      });
    }

    if (!options.skipScanner) {
      await runScannerStage({
        options,
        report,
        symbols,
        marketDataStore: deps.marketDataStore,
        rankingStore: deps.rankingStore,
        idFactory,
        logger,
        scanCandlesForSymbol: deps.scanCandlesForSymbol ?? scanCandles,
      });
    }
  } catch (error) {
    report.ok = false;
    report.totals.failures += report.totals.failures === 0 ? 1 : 0;
    logger.warn(`coinbase:batch stopped: ${getErrorMessage(error)}`);
  } finally {
    report.totals.durationMs = Date.now() - startedAtMs;
    report.sampledApiChecks = buildSampledApiChecks(report.symbols);
    report.nextRecommendedCommand = buildNextRecommendedCommand(options, true);
    report.ok = report.totals.failures === 0;
  }

  return report;
}

export async function selectCoinbaseBatchSymbols({
  store,
  options,
}: {
  store: CoinbaseBatchMarketDataStore;
  options: Pick<
    CoinbaseSupplementalBatchOptions,
    "selectionMode" | "symbols" | "limitSymbols"
  >;
}): Promise<PgSymbol[]> {
  if (options.symbols.length > 0) {
    for (const symbol of options.symbols) {
      assertCoinbaseUsdcSymbolName(symbol);
    }

    const rows = await store.listSymbolsByNames(options.symbols, {
      exchange: "coinbase",
      market: "spot",
    });
    const bySymbol = new Map(rows.map((row) => [row.symbol, row]));
    const missing = options.symbols.filter((symbol) => !bySymbol.has(symbol));

    if (missing.length > 0) {
      throw new Error(
        `Coinbase symbols are not available in Postgres: ${missing.join(", ")}.`,
      );
    }

    return options.symbols.map((symbol) =>
      validateCoinbaseUsdcSymbolRow(bySymbol.get(symbol)!),
    );
  }

  const rows = await store.listSymbols({
    exchange: "coinbase",
    market: "spot",
    limit: null,
    assetClass: "all",
    includeNonScanner: true,
  });

  return rows
    .filter(isSelectableCoinbaseUsdcSymbol)
    .sort((left, right) => left.symbol.localeCompare(right.symbol))
    .slice(
      0,
      options.selectionMode === "full-universe"
        ? undefined
        : (options.limitSymbols ?? DEFAULT_LIMIT_SYMBOLS),
    );
}

async function runBackfillStage({
  options,
  report,
  symbols,
  marketDataStore,
  provider,
  idFactory,
  logger,
  backfillSymbol,
}: {
  options: CoinbaseSupplementalBatchOptions;
  report: CoinbaseSupplementalBatchReport;
  symbols: PgSymbol[];
  marketDataStore: CoinbaseBatchMarketDataStore;
  provider: MarketDataProvider;
  idFactory: () => string;
  logger: Pick<Console, "info" | "warn">;
  backfillSymbol: typeof backfillCoinbaseCandlesForSymbol;
}) {
  for (const timeframe of options.timeframes) {
    const jobId = idFactory();
    let inserted = 0;
    let updated = 0;
    let symbolsDone = 0;
    let stageError: Error | null = null;

    await marketDataStore.createMarketDataSyncJob({
      id: jobId,
      exchange: "coinbase",
      market: "spot",
      timeframe,
      status: "running",
      symbolsTotal: symbols.length,
      params: {
        mode: "manual-coinbase-supplemental-batch",
        selectionMode: options.selectionMode,
        timeframes: options.timeframes,
        requestedSymbols: options.symbols,
        limitSymbols: options.selectionMode === "sample" ? options.limitSymbols : null,
        targetCandles: options.targetCandles[timeframe],
        providerMaxCandlesPerRequest: options.providerMaxCandlesPerRequest,
        concurrency: options.concurrency,
        source: "ccxt",
      },
    });

    try {
      await runWithConcurrency(symbols, options.concurrency, async (symbol) => {
        const symbolReport = findSymbolReport(report, symbol.symbol);

        try {
          const result = await backfillSymbol({
            store: marketDataStore,
            provider,
            symbol,
            timeframe: timeframe as CoinbaseBackfillTimeframe,
            targetCandles: options.targetCandles[timeframe],
            providerMaxCandlesPerRequest: options.providerMaxCandlesPerRequest,
            endTimeMs: options.endTimeMs,
          });
          const summary = summarizeBackfillResult(result);

          symbolReport.backfill[timeframe] = summary;
          inserted += result.inserted;
          updated += result.updated;
          symbolsDone += 1;
          report.totals.candlesInserted += result.inserted;
          report.totals.candlesUpdated += result.updated;
          report.totals.gapsDetected += result.gapCount;
          report.totals.droppedPartialBuckets +=
            result.fourHourDiagnostics?.droppedPartialBuckets ?? 0;
          report.totals.droppedPartialWeeks +=
            result.weeklyDiagnostics?.droppedPartialWeeks ?? 0;
          report.totals.missingSourceCandles += result.missingSourceCandles;
          logger.info(
            `coinbase:batch backfill ${symbol.symbol} ${timeframe} status=success inserted=${result.inserted} updated=${result.updated}`,
          );
        } catch (error) {
          const message = getErrorMessage(error);
          symbolReport.backfill[timeframe] = {
            status: "failed",
            timeframe,
            error: message,
          };
          report.totals.failures += 1;
          logger.warn(
            `coinbase:batch backfill ${symbol.symbol} ${timeframe} failed: ${message}`,
          );

          if (options.stopOnError) {
            throw error;
          }
        }
      });
    } catch (error) {
      stageError = error instanceof Error ? error : new Error(getErrorMessage(error));
    }

    await marketDataStore.finishMarketDataSyncJob({
      id: jobId,
      status: stageError ? "failed" : "success",
      symbolsDone,
      candlesInserted: inserted,
      candlesUpdated: updated,
      errorMessage: stageError?.message ?? null,
    });

    if (stageError && options.stopOnError) {
      throw stageError;
    }
  }
}

async function runScannerStage({
  options,
  report,
  symbols,
  marketDataStore,
  rankingStore,
  idFactory,
  logger,
  scanCandlesForSymbol,
}: {
  options: CoinbaseSupplementalBatchOptions;
  report: CoinbaseSupplementalBatchReport;
  symbols: PgSymbol[];
  marketDataStore: CoinbaseBatchMarketDataStore;
  rankingStore: CoinbaseBatchRankingStore;
  idFactory: () => string;
  logger: Pick<Console, "info" | "warn">;
  scanCandlesForSymbol: typeof scanCandles;
}) {
  for (const timeframe of options.scannerTimeframes) {
    const scanRunId = idFactory();
    const signals: InsertScanSignalInput[] = [];
    const counters: ScannerRunCounters = {
      symbolsScanned: 0,
      symbolsSkipped: 0,
      failedSymbols: 0,
      signalsCreated: 0,
      skipStats: {},
    };
    let stageError: Error | null = null;

    await rankingStore.createScanRun({
      id: scanRunId,
      timeframe,
      universe: "explicit-symbols",
      status: "running",
      symbolsTotal: symbols.length,
      params: {
        mode: "manual-coinbase-supplemental-batch",
        selectionMode: options.selectionMode,
        candleLimit: options.scannerCandleLimit,
        requestedSymbols: symbols.map((symbol) => symbol.symbol),
        source: "postgres",
        scannerMode: "single",
        exchange: "coinbase",
        market: "spot",
        concurrency: options.concurrency,
      },
      exchange: "coinbase",
      market: "spot",
    });

    try {
      await runWithConcurrency(symbols, options.concurrency, async (symbol) => {
        const symbolReport = findSymbolReport(report, symbol.symbol);

        try {
          const candles = await marketDataStore.listCandlesForScan({
            exchange: "coinbase",
            market: "spot",
            symbol: symbol.symbol,
            timeframe,
            limit: options.scannerCandleLimit,
          });

          if (candles.length < MIN_SCAN_CANDLES) {
            recordScannerSkip({
              report,
              symbolReport,
              timeframe,
              counters,
              reason: `insufficient_candles:${candles.length}/${MIN_SCAN_CANDLES}`,
            });
            return;
          }

          const result = scanCandlesForSymbol(
            symbol.symbol,
            timeframe as Timeframe,
            candles,
            { exchange: "coinbase" },
          );

          if (!result || !result.dataQuality.sufficientHistory) {
            recordScannerSkip({
              report,
              symbolReport,
              timeframe,
              counters,
              reason: "scanner_returned_empty",
            });
            return;
          }

          const candleOpenTimeMs = result.dataQuality.lastClosedCandleOpenTime ?? null;

          if (candleOpenTimeMs === null) {
            recordScannerSkip({
              report,
              symbolReport,
              timeframe,
              counters,
              reason: "missing_signal_anchor",
            });
            return;
          }

          signals.push({
            id: idFactory(),
            scanRunId,
            symbolId: symbol.id,
            exchange: "coinbase",
            market: "spot",
            symbol: symbol.symbol,
            timeframe,
            candleOpenTimeMs,
            result,
          });
          counters.symbolsScanned += 1;
          report.totals.symbolsScanned += 1;
          symbolReport.scanner[timeframe] = {
            status: "scanned",
            timeframe,
            scanned: 1,
            skipped: 0,
            failed: 0,
            signalsCreated: 1,
            rankScore: result.rankScore,
            groupCode: result.codeContract?.groupCode ?? "NX_801",
          };
          logger.info(
            `coinbase:batch scanner ${symbol.symbol} ${timeframe} scanned rankScore=${result.rankScore.toFixed(2)} group=${result.codeContract?.groupCode ?? "NX_801"}`,
          );
        } catch (error) {
          const message = getErrorMessage(error);
          counters.failedSymbols += 1;
          report.totals.failures += 1;
          symbolReport.scanner[timeframe] = {
            status: "failed",
            timeframe,
            scanned: 0,
            skipped: 0,
            failed: 1,
            signalsCreated: 0,
            error: message,
          };
          logger.warn(
            `coinbase:batch scanner ${symbol.symbol} ${timeframe} failed: ${message}`,
          );

          if (options.stopOnError) {
            throw error;
          }
        }
      });
    } catch (error) {
      stageError = error instanceof Error ? error : new Error(getErrorMessage(error));
    }

    calculateUniversePercentiles(signals.map((signal) => signal.result));
    signals.sort((left, right) => right.result.rankScore - left.result.rankScore);
    await rankingStore.insertScanSignals(signals);
    counters.signalsCreated = signals.length;
    report.totals.signalsCreated += signals.length;
    const status =
      stageError || counters.failedSymbols > 0
        ? counters.failedSymbols === symbols.length
          ? "failed"
          : "partial_success"
        : "success";

    await rankingStore.finishScanRun({
      id: scanRunId,
      status,
      symbolsScanned: counters.symbolsScanned,
      signalsCreated: counters.signalsCreated,
      symbolsSkipped: counters.symbolsSkipped,
      failedSymbols: counters.failedSymbols,
      errorMessage: stageError?.message ?? null,
      paramsPatch: {
        skipStats: counters.skipStats,
      },
    });

    if (stageError && options.stopOnError) {
      throw stageError;
    }
  }
}

function recordScannerSkip({
  report,
  symbolReport,
  timeframe,
  counters,
  reason,
}: {
  report: CoinbaseSupplementalBatchReport;
  symbolReport: CoinbaseBatchSymbolReport;
  timeframe: BatchScannerTimeframe;
  counters: ScannerRunCounters;
  reason: string;
}) {
  counters.symbolsSkipped += 1;
  counters.skipStats[reason] = (counters.skipStats[reason] ?? 0) + 1;
  report.totals.symbolsSkipped += 1;
  symbolReport.scanner[timeframe] = {
    status: "skipped",
    timeframe,
    scanned: 0,
    skipped: 1,
    failed: 0,
    signalsCreated: 0,
    skipReason: reason,
  };
}

function summarizeBackfillResult(
  result: CoinbaseSymbolBackfillResult,
): CoinbaseBatchBackfillSummary {
  if (result.timeframe === "4h") {
    return {
      status: "success",
      timeframe: "4h",
      requestedWindows: result.requestedWindows,
      source1h: result.fetchedCandles,
      generated4h: result.normalizedCandles,
      sourceTimeframe: result.sourceTimeframe,
      sourceCandles: result.sourceCandles,
      generatedCandles: result.generatedCandles,
      missingSourceCandles: result.missingSourceCandles,
      firstOpenTime: result.firstOpenTime,
      lastOpenTime: result.lastOpenTime,
      scannerEligible: result.scannerEligible,
      completeBuckets: result.fourHourDiagnostics?.completeBuckets,
      partialBuckets: result.fourHourDiagnostics?.partialBuckets,
      droppedPartialBuckets: result.fourHourDiagnostics?.droppedPartialBuckets,
      gapsDetected: result.gapCount,
      inserted: result.inserted,
      updated: result.updated,
    };
  }

  if (result.timeframe === "1w") {
    return {
      status: "success",
      timeframe: "1w",
      dailyCandlesRead: result.fetchedCandles,
      weeklyCandlesGenerated: result.normalizedCandles,
      sourceTimeframe: result.sourceTimeframe,
      sourceCandles: result.sourceCandles,
      generatedCandles: result.generatedCandles,
      missingSourceCandles: result.missingSourceCandles,
      firstOpenTime: result.firstOpenTime,
      lastOpenTime: result.lastOpenTime,
      scannerEligible: result.scannerEligible,
      completeWeeks: result.weeklyDiagnostics?.completeWeeks,
      partialWeeks: result.weeklyDiagnostics?.partialWeeks,
      droppedPartialWeeks: result.weeklyDiagnostics?.droppedPartialWeeks,
      gapsDetected: result.gapCount,
      inserted: result.inserted,
      updated: result.updated,
    };
  }

  return {
    status: "success",
    timeframe: result.timeframe,
    requestedWindows: result.requestedWindows,
    fetched: result.fetchedCandles,
    normalized: result.normalizedCandles,
    sourceTimeframe: result.sourceTimeframe,
    sourceCandles: result.sourceCandles,
    generatedCandles: result.generatedCandles,
    missingSourceCandles: result.missingSourceCandles,
    firstOpenTime: result.firstOpenTime,
    lastOpenTime: result.lastOpenTime,
    scannerEligible: result.scannerEligible,
    gapsDetected: result.gapCount,
    inserted: result.inserted,
    updated: result.updated,
  };
}

async function buildInitialSymbolReports({
  store,
  symbols,
  options,
}: {
  store: CoinbaseBatchMarketDataStore;
  symbols: PgSymbol[];
  options: CoinbaseSupplementalBatchOptions;
}): Promise<CoinbaseBatchSymbolReport[]> {
  const rows: CoinbaseBatchSymbolReport[] = [];

  for (const symbol of symbols) {
    const coverage = await loadQualityCoverage(store, symbol);
    const quality = getSymbolQuality(symbol.symbol, {
      exchange: symbol.exchange,
      baseAsset: symbol.baseAsset,
      quoteAsset: symbol.quoteAsset,
      assetClass: symbol.assetClass,
      candleCount: coverage?.candleCount,
      firstOpenTime: coverage?.earliestOpenTimeMs
        ? new Date(coverage.earliestOpenTimeMs).toISOString()
        : null,
    });
    const backfill = Object.fromEntries(
      options.timeframes.map((timeframe) => [
        timeframe,
        { status: "skipped", timeframe },
      ]),
    ) as Partial<Record<BatchBackfillTimeframe, CoinbaseBatchBackfillSummary>>;
    const scanner = Object.fromEntries(
      options.scannerTimeframes.map((timeframe) => [
        timeframe,
        {
          status: "skipped",
          timeframe,
          scanned: 0,
          skipped: 0,
          failed: 0,
          signalsCreated: 0,
        },
      ]),
    ) as Partial<Record<BatchScannerTimeframe, CoinbaseBatchScannerSummary>>;

    rows.push({
      symbol: symbol.symbol,
      exchange: "coinbase",
      market: "spot",
      baseAsset: symbol.baseAsset,
      quoteAsset: "USDC",
      assetClass: symbol.assetClass,
      quality: {
        qualityTier: quality.qualityTier,
        isLowQuality: quality.isLowQuality,
        qualityFlags: quality.qualityFlags,
        candleCount: coverage?.candleCount,
      },
      backfill,
      scanner,
    });
  }

  return rows;
}

async function loadQualityCoverage(
  store: CoinbaseBatchMarketDataStore,
  symbol: PgSymbol,
): Promise<SymbolCandleCoverage | null> {
  try {
    return await store.getCandleCoverageForSymbol({
      exchange: "coinbase",
      market: "spot",
      symbol: symbol.symbol,
      timeframe: "1d",
    });
  } catch {
    return null;
  }
}

function createInitialReport({
  options,
  perSymbol,
  startedAtMs,
}: {
  options: CoinbaseSupplementalBatchOptions;
  perSymbol: CoinbaseBatchSymbolReport[];
  startedAtMs: number;
}): CoinbaseSupplementalBatchReport {
  const qualityTierDistribution: Record<string, number> = {};
  const qualityFlagDistribution: Record<string, number> = {};

  for (const symbol of perSymbol) {
    qualityTierDistribution[symbol.quality.qualityTier] =
      (qualityTierDistribution[symbol.quality.qualityTier] ?? 0) + 1;

    for (const flag of symbol.quality.qualityFlags) {
      qualityFlagDistribution[flag] = (qualityFlagDistribution[flag] ?? 0) + 1;
    }
  }

  return {
    ok: true,
    dryRun: options.dryRun,
    skipImport: options.skipImport,
    selectionMode: options.selectionMode,
    symbolsSelected: perSymbol.length,
    symbols: perSymbol.map((symbol) => symbol.symbol),
    timeframesBackfilled: options.skipBackfill ? [] : options.timeframes,
    scannerTimeframes: options.skipScanner ? [] : options.scannerTimeframes,
    perSymbol,
    totals: {
      candlesInserted: 0,
      candlesUpdated: 0,
      gapsDetected: 0,
      droppedPartialBuckets: 0,
      droppedPartialWeeks: 0,
      missingSourceCandles: 0,
      symbolsScanned: 0,
      symbolsSkipped: 0,
      signalsCreated: 0,
      failures: 0,
      durationMs: Date.now() - startedAtMs,
      qualityTierDistribution,
      qualityFlagDistribution,
    },
    sampledApiChecks: [],
    nextRecommendedCommand: null,
  };
}

function markDryRunPlans({
  report,
  options,
}: {
  report: CoinbaseSupplementalBatchReport;
  options: CoinbaseSupplementalBatchOptions;
}) {
  for (const symbol of report.perSymbol) {
    if (!options.skipBackfill) {
      for (const timeframe of options.timeframes) {
        symbol.backfill[timeframe] = {
          status: "planned",
          timeframe,
        };
      }
    }

    if (!options.skipScanner) {
      for (const timeframe of options.scannerTimeframes) {
        symbol.scanner[timeframe] = {
          status: "planned",
          timeframe,
          scanned: 0,
          skipped: 0,
          failed: 0,
          signalsCreated: 0,
        };
      }
    }
  }
}

function findSymbolReport(
  report: CoinbaseSupplementalBatchReport,
  symbol: string,
) {
  const row = report.perSymbol.find((item) => item.symbol === symbol);

  if (!row) {
    throw new Error(`Internal batch report missing symbol ${symbol}.`);
  }

  return row;
}

async function resolveProvider(deps: CoinbaseSupplementalBatchDeps) {
  if (deps.provider) {
    return deps.provider;
  }

  if (deps.createProvider) {
    return deps.createProvider();
  }

  const client = await createCcxtCoinbaseClient();
  return createCcxtCoinbaseProvider(client);
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
) {
  if (concurrency === 1) {
    for (const item of items) {
      await worker(item);
    }
    return;
  }

  const gate = pLimit(concurrency);
  await Promise.all(items.map((item) => gate(() => worker(item))));
}

function validateCoinbaseUsdcSymbolRow(symbol: PgSymbol): PgSymbol {
  if (!isSelectableCoinbaseUsdcSymbol(symbol)) {
    throw new Error(
      `Symbol ${symbol.symbol} is not an enabled Coinbase spot -USDC symbol.`,
    );
  }

  return symbol;
}

function isSelectableCoinbaseUsdcSymbol(symbol: PgSymbol) {
  return (
    symbol.exchange === "coinbase" &&
    symbol.market === "spot" &&
    symbol.isEnabled &&
    symbol.symbol.endsWith("-USDC") &&
    symbol.quoteAsset === "USDC" &&
    !isDisabledStatus(symbol.status)
  );
}

function assertCoinbaseUsdcSymbolName(symbol: string) {
  if (!/^[A-Z0-9]+-USDC$/.test(symbol)) {
    throw new Error(`Coinbase batch symbol must be uppercase BASE-USDC: ${symbol}.`);
  }
}

function isDisabledStatus(status: string) {
  const normalized = status.trim().toLowerCase();
  return ["disabled", "delisted", "inactive", "offline"].includes(normalized);
}

function buildSampledApiChecks(symbols: string[]) {
  return symbols.slice(0, 3).map((symbol) => ({
    symbol,
    timeframe: "4h" as const,
    curl: `curl -s "https://api.vegarank.com/api/symbol/research?exchange=coinbase&symbol=${encodeURIComponent(symbol)}&timeframe=4h&assetClass=crypto"`,
  }));
}

function buildNextRecommendedCommand(
  options: CoinbaseSupplementalBatchOptions,
  completedRun: boolean,
) {
  if (options.dryRun) {
    if (options.selectionMode === "full-universe") {
      return `pnpm coinbase:supplemental:production -- --timeframes=${options.timeframes.join(",")} --scanner-timeframes=${options.scannerTimeframes.join(",")}`;
    }

    return `pnpm coinbase:supplemental:batch -- --limit-symbols=${options.limitSymbols ?? DEFAULT_LIMIT_SYMBOLS} --timeframes=${options.timeframes.join(",")} --scanner-timeframes=${options.scannerTimeframes.join(",")}`;
  }

  if (!completedRun) {
    return null;
  }

  if (
    options.selectionMode === "sample" &&
    (options.limitSymbols ?? DEFAULT_LIMIT_SYMBOLS) < HARD_CAP_SYMBOLS
  ) {
    return `pnpm coinbase:supplemental:batch -- --limit-symbols=${HARD_CAP_SYMBOLS} --timeframes=${options.timeframes.join(",")} --scanner-timeframes=${options.scannerTimeframes.join(",")}`;
  }

  return null;
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

function parseBackfillTimeframes(value: string | undefined) {
  return parseTimeframeList({
    value,
    fallback: ["4h", "1d", "1w"],
    supported: supportedBackfillTimeframes,
    name: "timeframes",
  });
}

function parseScannerTimeframes(value: string | undefined) {
  return parseTimeframeList({
    value,
    fallback: ["4h", "1d"],
    supported: supportedScannerTimeframes,
    name: "scanner-timeframes",
  });
}

function parseTimeframeList<T extends string>({
  value,
  fallback,
  supported,
  name,
}: {
  value: string | undefined;
  fallback: T[];
  supported: readonly T[];
  name: string;
}) {
  const parsed = value
    ? value
        .split(",")
        .map((timeframe) => timeframe.trim())
        .filter(Boolean)
    : fallback;
  const unique = Array.from(new Set(parsed));

  if (unique.length === 0) {
    throw new Error(`${name} must include at least one timeframe.`);
  }

  for (const timeframe of unique) {
    if (!supported.includes(timeframe as T)) {
      throw new Error(`${name} must be one of ${supported.join(", ")}.`);
    }
  }

  return unique as T[];
}

function parseBooleanFlag(
  value: string | undefined,
  fallback: boolean,
  name: string,
) {
  if (value === undefined) {
    return fallback;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(`${name} must be true or false.`);
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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

function toCamelCase(value: string) {
  return value.replace(/-([a-z0-9])/g, (_, letter: string) =>
    letter.toUpperCase(),
  );
}

function printJson(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

if (process.argv[1]?.endsWith("run-coinbase-supplemental-batch-pg.ts")) {
  main().catch((error) => {
    console.error(
      error instanceof Error
        ? error.message
        : "Coinbase supplemental batch failed.",
    );
    process.exitCode = 1;
  });
}
