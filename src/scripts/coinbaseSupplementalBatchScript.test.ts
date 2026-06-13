import type { Candle } from "@/lib/shared/timeframes";
import type {
  CandleProviderResult,
  MarketDataProvider,
} from "@/lib/market-data/marketDataProvider";
import type { ScanResult } from "@/lib/ranking-engine/types";
import type { PgSymbol } from "@/lib/storage/postgres/marketDataPg";
import { describe, expect, it, vi } from "vitest";
import {
  parseCoinbaseSupplementalBatchOptions,
  runCoinbaseSupplementalBatch,
  selectCoinbaseBatchSymbols,
  type CoinbaseBatchMarketDataStore,
  type CoinbaseBatchRankingStore,
} from "../../scripts/run-coinbase-supplemental-batch-pg";

const hourMs = 60 * 60 * 1000;
const dayMs = 24 * hourMs;
const monday = Date.UTC(2026, 0, 5);

describe("Coinbase supplemental batch script", () => {
  it("parses safe defaults and refuses more than 50 symbols without approval", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    try {
      expect(parseCoinbaseSupplementalBatchOptions([])).toMatchObject({
        dryRun: false,
        skipImport: true,
        symbols: [],
        limitSymbols: 20,
        timeframes: ["4h", "1d", "1w"],
        scannerTimeframes: ["4h", "1d"],
        concurrency: 1,
        stopOnError: true,
        targetCandles: {
          "4h": 250,
          "1d": 250,
          "1w": 30,
        },
      });
    } finally {
      vi.useRealTimers();
    }

    expect(() =>
      parseCoinbaseSupplementalBatchOptions(["--limit-symbols=51"]),
    ).toThrow("capped at 50 symbols");
    expect(
      parseCoinbaseSupplementalBatchOptions([
        "--limit-symbols=51",
        "--allow-large-run",
      ]).limitSymbols,
    ).toBe(51);
  });

  it("selects only enabled Coinbase -USDC symbols in deterministic symbol order", async () => {
    const store = makeMarketDataStore({
      listSymbols: vi.fn(async () => [
        makeSymbol("B3-USDC"),
        makeSymbol("BTCUSDT", { exchange: "binance", quoteAsset: "USDT" }),
        makeSymbol("ABC-USD", { quoteAsset: "USD" }),
        makeSymbol("AERO-USDC"),
        makeSymbol("OLD-USDC", { status: "disabled" }),
      ]),
    });
    const options = parseCoinbaseSupplementalBatchOptions(["--limit-symbols=2"]);

    const symbols = await selectCoinbaseBatchSymbols({ store, options });

    expect(symbols.map((symbol) => symbol.symbol)).toEqual([
      "AERO-USDC",
      "B3-USDC",
    ]);
    expect(store.listSymbols).toHaveBeenCalledWith({
      exchange: "coinbase",
      market: "spot",
      limit: null,
      assetClass: "all",
      includeNonScanner: true,
    });
  });

  it("validates explicit Coinbase symbols and preserves request order", async () => {
    const store = makeMarketDataStore({
      listSymbolsByNames: vi.fn(async () => [
        makeSymbol("AIOZ-USDC"),
        makeSymbol("AERO-USDC"),
      ]),
    });
    const options = parseCoinbaseSupplementalBatchOptions([
      "--symbols=AERO-USDC,AIOZ-USDC",
    ]);

    const symbols = await selectCoinbaseBatchSymbols({ store, options });

    expect(symbols.map((symbol) => symbol.symbol)).toEqual([
      "AERO-USDC",
      "AIOZ-USDC",
    ]);
    expect(() =>
      parseCoinbaseSupplementalBatchOptions([
        `--symbols=${Array.from({ length: 51 }, (_, index) => `S${index}-USDC`).join(",")}`,
      ]),
    ).toThrow("capped at 50 symbols");
    await expect(
      selectCoinbaseBatchSymbols({
        store,
        options: parseCoinbaseSupplementalBatchOptions(["--symbols=BAD/USD"]),
      }),
    ).rejects.toThrow("BASE-USDC");
  });

  it("dry-run reports selected symbols and avoids writes or provider creation", async () => {
    const store = makeMarketDataStore({
      listSymbols: vi.fn(async () => [makeSymbol("AERO-USDC")]),
    });
    const rankingStore = makeRankingStore();
    const createProvider = vi.fn(async () => makeProvider());

    const report = await runCoinbaseSupplementalBatch(
      parseCoinbaseSupplementalBatchOptions(["--dry-run", "--limit-symbols=1"]),
      {
        marketDataStore: store,
        rankingStore,
        createProvider,
        logger: silentLogger(),
        startedAtMs: Date.now(),
      },
    );

    expect(report).toMatchObject({
      ok: true,
      dryRun: true,
      symbolsSelected: 1,
      symbols: ["AERO-USDC"],
    });
    expect(report.perSymbol[0]?.backfill["4h"]?.status).toBe("planned");
    expect(report.perSymbol[0]?.scanner["4h"]?.status).toBe("planned");
    expect(createProvider).not.toHaveBeenCalled();
    expect(store.createMarketDataSyncJob).not.toHaveBeenCalled();
    expect(rankingStore.createScanRun).not.toHaveBeenCalled();
  });

  it("orchestrates 4h from 1h, 1d direct, and 1w from stored daily candles", async () => {
    const fetchCandles = vi.fn(
      async (
        request: Parameters<MarketDataProvider["fetchCandles"]>[0],
      ): Promise<CandleProviderResult> => {
        if (request.timeframe === "1h") {
          return {
            provider: "ccxt" as const,
            exchange: "coinbase" as const,
            market: "spot",
            rawSymbol: "AERO-USDC",
            providerSymbol: "AERO/USDC",
            timeframe: request.timeframe,
            candles: makeHourlyCandles(0, 12),
          };
        }

        return {
          provider: "ccxt" as const,
          exchange: "coinbase" as const,
          market: "spot",
          rawSymbol: "AERO-USDC",
          providerSymbol: "AERO/USDC",
          timeframe: request.timeframe,
          candles: [makeDailyCandle(monday)],
        };
      },
    );
    const upsertCandles = vi.fn(async (input) => ({
      inserted: input.candles.length,
      updated: 0,
    }));
    const store = makeMarketDataStore({
      listSymbols: vi.fn(async () => [makeSymbol("AERO-USDC")]),
      listCandles: vi.fn(async () => makeDailyCandles(monday, 7)),
      upsertCandles,
    });

    const report = await runCoinbaseSupplementalBatch(
      parseCoinbaseSupplementalBatchOptions([
        "--skip-scanner",
        "--limit-symbols=1",
        "--target-candles-4h=1",
        "--target-candles-1d=1",
        "--target-candles-1w=1",
        "--max-candles-per-request=12",
        `--end-time-ms=${11 * hourMs}`,
      ]),
      {
        marketDataStore: store,
        rankingStore: makeRankingStore(),
        provider: makeProvider(fetchCandles),
        logger: silentLogger(),
        idFactory: sequentialIds(),
        startedAtMs: Date.now(),
      },
    );

    expect(fetchCandles.mock.calls.map(([request]) => request.timeframe)).toEqual([
      "1h",
      "1d",
    ]);
    expect(fetchCandles.mock.calls.map(([request]) => request.timeframe)).not.toContain(
      "4h",
    );
    expect(upsertCandles.mock.calls.map(([input]) => input.timeframe)).toEqual([
      "4h",
      "1d",
      "1w",
    ]);
    expect(report.perSymbol[0]?.backfill["4h"]).toMatchObject({
      status: "success",
      source1h: 12,
      generated4h: 1,
      droppedPartialBuckets: 0,
    });
    expect(report.perSymbol[0]?.backfill["1w"]).toMatchObject({
      status: "success",
      dailyCandlesRead: 7,
      weeklyCandlesGenerated: 1,
      droppedPartialWeeks: 0,
    });
  });

  it("runs scanner with Coinbase identity and reports scanned symbols", async () => {
    const insertScanSignals = vi.fn(async (signals: unknown[]) => {
      void signals;
    });
    const store = makeMarketDataStore({
      listSymbolsByNames: vi.fn(async () => [makeSymbol("AERO-USDC")]),
      listCandlesForScan: vi.fn(async () => makeHourlyCandles(0, 200)),
    });
    const rankingStore = makeRankingStore({ insertScanSignals });
    const scanCandlesForSymbol = vi.fn(() => makeScanResult());

    const report = await runCoinbaseSupplementalBatch(
      parseCoinbaseSupplementalBatchOptions([
        "--skip-backfill",
        "--symbols=AERO-USDC",
        "--scanner-timeframes=4h",
      ]),
      {
        marketDataStore: store,
        rankingStore,
        scanCandlesForSymbol,
        logger: silentLogger(),
        idFactory: sequentialIds(),
        startedAtMs: Date.now(),
      },
    );

    expect(store.listCandlesForScan).toHaveBeenCalledWith({
      exchange: "coinbase",
      market: "spot",
      symbol: "AERO-USDC",
      timeframe: "4h",
      limit: 500,
    });
    expect(scanCandlesForSymbol).toHaveBeenCalledWith(
      "AERO-USDC",
      "4h",
      expect.any(Array),
      { exchange: "coinbase" },
    );
    const insertedSignals = insertScanSignals.mock.calls[0]?.[0] as
      | Array<Record<string, unknown>>
      | undefined;

    expect(insertedSignals?.[0]).toMatchObject({
      exchange: "coinbase",
      market: "spot",
      symbol: "AERO-USDC",
      timeframe: "4h",
    });
    expect(report.perSymbol[0]?.scanner["4h"]).toMatchObject({
      status: "scanned",
      scanned: 1,
      signalsCreated: 1,
      rankScore: 48.94,
      groupCode: "GR_201",
    });
    expect(report.totals).toMatchObject({
      symbolsScanned: 1,
      signalsCreated: 1,
      failures: 0,
    });
  });

  it("captures per-symbol failures and stops by default", async () => {
    const backfillSymbol = vi.fn(async () => {
      throw new Error("rate limit");
    });
    const store = makeMarketDataStore({
      listSymbols: vi.fn(async () => [
        makeSymbol("AERO-USDC"),
        makeSymbol("AIOZ-USDC"),
      ]),
    });

    const report = await runCoinbaseSupplementalBatch(
      parseCoinbaseSupplementalBatchOptions([
        "--skip-scanner",
        "--limit-symbols=2",
        "--timeframes=1d",
      ]),
      {
        marketDataStore: store,
        rankingStore: makeRankingStore(),
        provider: makeProvider(),
        backfillSymbol,
        logger: silentLogger(),
        startedAtMs: Date.now(),
      },
    );

    expect(report.ok).toBe(false);
    expect(report.perSymbol[0]?.backfill["1d"]).toMatchObject({
      status: "failed",
      error: "rate limit",
    });
    expect(backfillSymbol).toHaveBeenCalledTimes(1);
    expect(store.finishMarketDataSyncJob).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        errorMessage: "rate limit",
      }),
    );
  });
});

function makeMarketDataStore(
  overrides: Partial<Record<keyof CoinbaseBatchMarketDataStore, unknown>> = {},
): CoinbaseBatchMarketDataStore {
  return {
    listSymbols: vi.fn(async () => []),
    listSymbolsByNames: vi.fn(async () => []),
    getCandleCoverageForSymbol: vi.fn(async () => ({
      candleCount: 250,
      earliestOpenTimeMs: monday,
      latestOpenTimeMs: monday + 249 * dayMs,
      latestCloseTimeMs: monday + 250 * dayMs - 1,
    })),
    createMarketDataSyncJob: vi.fn(async () => undefined),
    finishMarketDataSyncJob: vi.fn(async () => undefined),
    listCandles: vi.fn(async () => []),
    upsertCandles: vi.fn(async (input: { candles: Candle[] }) => ({
      inserted: input.candles.length,
      updated: 0,
    })),
    listCandlesForScan: vi.fn(async () => []),
    ...overrides,
  } as CoinbaseBatchMarketDataStore;
}

function makeRankingStore(
  overrides: Partial<Record<keyof CoinbaseBatchRankingStore, unknown>> = {},
): CoinbaseBatchRankingStore {
  return {
    createScanRun: vi.fn(async () => undefined),
    finishScanRun: vi.fn(async () => undefined),
    insertScanSignals: vi.fn(async () => undefined),
    ...overrides,
  } as CoinbaseBatchRankingStore;
}

function makeProvider(fetchCandles?: MarketDataProvider["fetchCandles"]): MarketDataProvider {
  return {
    provider: "ccxt",
    listMarkets: async () => [],
    fetchCandles:
      fetchCandles ??
      vi.fn(async (request) => ({
        provider: "ccxt" as const,
        exchange: "coinbase" as const,
        market: "spot",
        rawSymbol: request.listing.rawSymbol,
        providerSymbol: request.listing.providerSymbol,
        timeframe: request.timeframe,
        candles: [],
      })),
  };
}

function makeSymbol(
  symbol: string,
  overrides: Partial<PgSymbol> & { quoteAsset?: string } = {},
): PgSymbol {
  const quoteAsset = overrides.quoteAsset ?? "USDC";
  const baseAsset =
    overrides.baseAsset ??
    (symbol.endsWith(`-${quoteAsset}`)
      ? symbol.slice(0, -`-${quoteAsset}`.length)
      : symbol.replace(/USDT$/, ""));

  return {
    id: overrides.id ?? 1,
    exchange: overrides.exchange ?? "coinbase",
    market: overrides.market ?? "spot",
    symbol,
    baseAsset,
    quoteAsset,
    status: overrides.status ?? "active",
    quoteVolume: overrides.quoteVolume ?? null,
    priceChangePercent: overrides.priceChangePercent ?? null,
    isEnabled: overrides.isEnabled ?? true,
    assetClass: overrides.assetClass ?? "crypto",
    isScannerEligible: overrides.isScannerEligible ?? true,
    isBacktestEligible: overrides.isBacktestEligible ?? true,
    isMarketContext: overrides.isMarketContext ?? false,
    metadata: overrides.metadata ?? {},
    updatedAt: overrides.updatedAt ?? "2026-01-01T00:00:00.000Z",
  };
}

function makeHourlyCandles(startTimeMs: number, count: number): Candle[] {
  return Array.from({ length: count }, (_, index) => ({
    openTime: startTimeMs + index * hourMs,
    closeTime: startTimeMs + (index + 1) * hourMs - 1,
    open: 100 + index,
    high: 110 + index,
    low: 90 - index,
    close: 101 + index,
    volume: 10 + index,
  }));
}

function makeDailyCandles(startTimeMs: number, count: number): Candle[] {
  return Array.from({ length: count }, (_, index) =>
    makeDailyCandle(startTimeMs + index * dayMs, { close: 101 + index }),
  );
}

function makeDailyCandle(
  openTime: number,
  overrides: Partial<Candle> = {},
): Candle {
  return {
    openTime,
    closeTime: openTime + dayMs - 1,
    open: 100,
    high: 110,
    low: 90,
    close: 101,
    volume: 10,
    ...overrides,
  };
}

function makeScanResult(): ScanResult {
  return {
    rankScore: 48.94,
    dataQuality: {
      sufficientHistory: true,
      lastClosedCandleOpenTime: 199 * hourMs,
    },
    codeContract: {
      groupCode: "GR_201",
      metrics: {
        riskAdjustedScore: 48.94,
      },
    },
  } as unknown as ScanResult;
}

function sequentialIds() {
  let index = 0;

  return () => {
    index += 1;
    return `id-${index}`;
  };
}

function silentLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
  };
}
