import type { Candle, Timeframe } from "@/lib/shared/timeframes";
import type {
  CandleProviderResult,
  MarketDataProvider,
} from "./marketDataProvider";
import { buildBackfillPlan, type BackfillPlan } from "./candleBackfillPlanner";
import {
  normalizeCandles,
  type CandleContinuityDiagnostics,
} from "./candleQuality";
import {
  aggregateDailyCandlesToWeekly,
  type WeeklyAggregationDiagnostics,
} from "./weeklyAggregation";
import { parseMarketSymbol, type MarketListing } from "./symbolIdentity";
import type {
  CandleUpsertStats,
  MarketDataTimeframe,
  PgSymbol,
  SymbolCandleCoverage,
} from "@/lib/storage/postgres/marketDataPg";

export type CoinbaseBackfillTimeframe = "1h" | "4h" | "1d" | "1w";

export type CoinbaseBackfillStore = {
  listCandles(input: {
    exchange?: string;
    market?: string;
    symbol: string;
    timeframe: string;
    limit: number;
  }): Promise<Candle[]>;
  upsertCandles(input: {
    exchange?: string;
    market?: string;
    symbol: string;
    timeframe: MarketDataTimeframe;
    candles: Candle[];
  }): Promise<CandleUpsertStats>;
  getCandleCoverageForSymbol(input: {
    exchange?: string;
    market?: string;
    symbol: string;
    timeframe: string;
  }): Promise<SymbolCandleCoverage>;
};

export type CoinbaseSymbolBackfillResult = {
  symbol: string;
  timeframe: CoinbaseBackfillTimeframe;
  requestedWindows: number;
  fetchedCandles: number;
  normalizedCandles: number;
  inserted: number;
  updated: number;
  gapCount: number;
  coverageBefore: SymbolCandleCoverage;
  coverageAfter: SymbolCandleCoverage;
  diagnostics?: CandleContinuityDiagnostics;
  weeklyDiagnostics?: WeeklyAggregationDiagnostics;
  plan?: BackfillPlan;
};

const coinbaseExchange = "coinbase";
const spotMarket = "spot";
const directCoinbaseTimeframes = new Set<Timeframe>(["1h", "4h", "1d"]);

export async function backfillCoinbaseCandlesForSymbol({
  store,
  provider,
  symbol,
  timeframe,
  targetCandles,
  providerMaxCandlesPerRequest,
  endTimeMs,
}: {
  store: CoinbaseBackfillStore;
  provider: MarketDataProvider;
  symbol: PgSymbol;
  timeframe: CoinbaseBackfillTimeframe;
  targetCandles: number;
  providerMaxCandlesPerRequest: number;
  endTimeMs: number;
}): Promise<CoinbaseSymbolBackfillResult> {
  if (timeframe === "1w") {
    return backfillCoinbaseWeeklyCandlesFromDaily({
      store,
      symbol,
      targetCandles,
    });
  }

  if (!directCoinbaseTimeframes.has(timeframe)) {
    throw new Error(`Unsupported Coinbase backfill timeframe: ${timeframe}.`);
  }

  return backfillCoinbaseDirectCandles({
    store,
    provider,
    symbol,
    timeframe,
    targetCandles,
    providerMaxCandlesPerRequest,
    endTimeMs,
  });
}

export async function backfillCoinbaseDirectCandles({
  store,
  provider,
  symbol,
  timeframe,
  targetCandles,
  providerMaxCandlesPerRequest,
  endTimeMs,
}: {
  store: CoinbaseBackfillStore;
  provider: MarketDataProvider;
  symbol: PgSymbol;
  timeframe: Exclude<CoinbaseBackfillTimeframe, "1w">;
  targetCandles: number;
  providerMaxCandlesPerRequest: number;
  endTimeMs: number;
}): Promise<CoinbaseSymbolBackfillResult> {
  const coverageBefore = await store.getCandleCoverageForSymbol({
    exchange: coinbaseExchange,
    market: spotMarket,
    symbol: symbol.symbol,
    timeframe,
  });
  const listing = pgSymbolToCoinbaseListing(symbol);
  const plan = buildBackfillPlan({
    timeframe,
    targetCandles,
    maxCandlesPerRequest: providerMaxCandlesPerRequest,
    endTimeMs,
  });
  const fetchedCandles: Candle[] = [];

  for (const window of plan.windows) {
    const result = await provider.fetchCandles({
      listing,
      timeframe,
      startTime: window.startTimeMs,
      endTime: window.endTimeMs,
      limit: window.requestLimit,
    });

    fetchedCandles.push(...filterCandlesToWindow(result, window));
  }

  const normalized = normalizeCandles(fetchedCandles, timeframe);
  const stats = await store.upsertCandles({
    exchange: coinbaseExchange,
    market: spotMarket,
    symbol: symbol.symbol,
    timeframe,
    candles: normalized.candles,
  });
  const coverageAfter = await store.getCandleCoverageForSymbol({
    exchange: coinbaseExchange,
    market: spotMarket,
    symbol: symbol.symbol,
    timeframe,
  });

  return {
    symbol: symbol.symbol,
    timeframe,
    requestedWindows: plan.windows.length,
    fetchedCandles: fetchedCandles.length,
    normalizedCandles: normalized.candles.length,
    inserted: stats.inserted,
    updated: stats.updated,
    gapCount: normalized.diagnostics.gapCount,
    coverageBefore,
    coverageAfter,
    diagnostics: normalized.diagnostics,
    plan,
  };
}

export async function backfillCoinbaseWeeklyCandlesFromDaily({
  store,
  symbol,
  targetCandles,
}: {
  store: CoinbaseBackfillStore;
  symbol: PgSymbol;
  targetCandles: number;
}): Promise<CoinbaseSymbolBackfillResult> {
  const coverageBefore = await store.getCandleCoverageForSymbol({
    exchange: coinbaseExchange,
    market: spotMarket,
    symbol: symbol.symbol,
    timeframe: "1w",
  });
  const dailyCandles = await store.listCandles({
    exchange: coinbaseExchange,
    market: spotMarket,
    symbol: symbol.symbol,
    timeframe: "1d",
    limit: Math.max(targetCandles * 7 + 7, 7),
  });
  const aggregated = aggregateDailyCandlesToWeekly(dailyCandles);
  const weeklyCandles = aggregated.weeklyCandles.slice(-targetCandles);
  const stats = await store.upsertCandles({
    exchange: coinbaseExchange,
    market: spotMarket,
    symbol: symbol.symbol,
    timeframe: "1w",
    candles: weeklyCandles,
  });
  const coverageAfter = await store.getCandleCoverageForSymbol({
    exchange: coinbaseExchange,
    market: spotMarket,
    symbol: symbol.symbol,
    timeframe: "1w",
  });

  return {
    symbol: symbol.symbol,
    timeframe: "1w",
    requestedWindows: 0,
    fetchedCandles: dailyCandles.length,
    normalizedCandles: weeklyCandles.length,
    inserted: stats.inserted,
    updated: stats.updated,
    gapCount: aggregated.diagnostics.gapsDetected,
    coverageBefore,
    coverageAfter,
    weeklyDiagnostics: aggregated.diagnostics,
  };
}

export function pgSymbolToCoinbaseListing(symbol: PgSymbol): MarketListing {
  if (symbol.exchange !== coinbaseExchange || symbol.market !== spotMarket) {
    throw new Error(`Expected Coinbase spot symbol, received ${symbol.exchange}:${symbol.symbol}.`);
  }

  return parseMarketSymbol({
    assetClass: "crypto",
    exchange: "coinbase",
    market: "spot",
    rawSymbol: symbol.symbol,
    baseAsset: symbol.baseAsset,
    quoteAsset: symbol.quoteAsset,
    provider: "ccxt",
    providerSymbol: `${symbol.baseAsset}/${symbol.quoteAsset}`,
    sourcePriority: 2,
    quoteVolume: symbol.quoteVolume ?? undefined,
    priceChangePercent: symbol.priceChangePercent ?? undefined,
    status: symbol.status,
  });
}

function filterCandlesToWindow(
  result: CandleProviderResult,
  window: { startTimeMs: number; endTimeMs: number },
) {
  return result.candles.filter(
    (candle) =>
      candle.openTime >= window.startTimeMs && candle.openTime <= window.endTimeMs,
  );
}
