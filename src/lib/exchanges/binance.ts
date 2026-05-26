import { cacheKeys, cacheTtls } from "@/lib/cache/keys";
import { getOrSetCached } from "@/lib/cache/memory";
import type { Candle, Market, Timeframe } from "./types";

const BINANCE_REST_BASE_URL = "https://data-api.binance.vision";

const EXCLUDED_BASE_ASSETS = new Set([
  "USDC",
  "FDUSD",
  "TUSD",
  "BUSD",
  "DAI",
  "USDP",
  "USDD",
  "RLUSD",
  "BFUSD",
  "XUSD",
  "USD1",
  "USDE",
  "SUSDE",
  "USDS",
  "USTC",
  "PYUSD",
  "FRAX",
  "PAXG",
  "XAUT",
  "EUR",
  "EURI",
  "AEUR",
  "BRL",
  "TRY",
  "UAH",
  "ZAR",
  "IDRT",
  "BIDR",
  "U",
  "PAX",
  "WBTC",
  "WBETH",
  "BNSOL",
]);

const EXCLUDED_FAN_TOKEN_BASE_ASSETS = new Set([
  "PSG",
  "ATM",
  "PORTO",
  "LAZIO",
  "SANTOS",
  "ASR",
  "ACM",
  "BAR",
  "JUV",
  "CITY",
  "ALPINE",
]);

const LEVERAGED_SUFFIXES = ["DOWN", "BULL", "BEAR", "3L", "3S", "5L", "5S"];
const LEVERAGED_UP_EXCEPTIONS = new Set(["JUP"]);

type BinanceExchangeInfo = {
  symbols: BinanceExchangeSymbol[];
};

type BinanceExchangeSymbol = {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
  isSpotTradingAllowed?: boolean;
};

type BinanceTicker24h = {
  symbol: string;
  quoteVolume: string;
  priceChangePercent: string;
};

type BinanceKline = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string,
];

export type GetCandlesOptions = {
  limit?: number;
  startTime?: number;
  endTime?: number;
};

export type EligibleMarketsOptions = {
  maxSymbols?: number | null;
  minQuoteVolume?: number;
  safetyCap?: number;
};

export type EligibleMarketsResult = {
  markets: Market[];
  totalUsdtPairs: number;
  eligibleCount: number;
  filteredLowVolume: number;
  excludedStableOrLeveraged: number;
  capped: boolean;
};

const timeframeToBinanceInterval = {
  "4h": "4h",
  "1d": "1d",
  "1w": "1w",
  "1M": "1M",
} satisfies Record<Timeframe, string>;

type SpotMarketUniverse = {
  markets: Market[];
  totalUsdtPairs: number;
  excludedStableOrLeveraged: number;
};

export async function getSpotMarkets(): Promise<Market[]> {
  const universe = await getSpotMarketUniverse();

  return universe.markets;
}

async function getSpotMarketUniverse(): Promise<SpotMarketUniverse> {
  const { entry } = await getOrSetCached(
    cacheKeys.markets,
    cacheTtls.markets,
    async (): Promise<SpotMarketUniverse> => {
      const data = await fetchBinance<BinanceExchangeInfo>("/api/v3/exchangeInfo");
      const usdtSpotMarkets = data.symbols.filter((market) => {
        return (
          market.status === "TRADING" &&
          market.quoteAsset === "USDT" &&
          market.isSpotTradingAllowed !== false
        );
      });
      const markets = usdtSpotMarkets
        .filter((market) => !isExcludedBaseAsset(market.baseAsset))
        .map((market) => ({
          exchange: "binance" as const,
          symbol: market.symbol,
          baseAsset: market.baseAsset,
          quoteAsset: market.quoteAsset,
          status: market.status,
        }));

      return {
        markets,
        totalUsdtPairs: usdtSpotMarkets.length,
        excludedStableOrLeveraged: usdtSpotMarkets.length - markets.length,
      };
    },
  );

  return entry.value;
}

export async function get24hTickers(): Promise<
  Record<string, { symbol: string; quoteVolume: number; priceChangePercent: number }>
> {
  const { entry } = await getOrSetCached(
    cacheKeys.tickers,
    cacheTtls.tickers,
    async () => {
      const tickers = await fetchBinance<BinanceTicker24h[]>("/api/v3/ticker/24hr");

      return Object.fromEntries(
        tickers.map((ticker) => [
          ticker.symbol,
          {
            symbol: ticker.symbol,
            quoteVolume: Number(ticker.quoteVolume),
            priceChangePercent: Number(ticker.priceChangePercent),
          },
        ]),
      );
    },
  );

  return entry.value;
}

export async function getTopUsdtMarkets(limit = 100): Promise<Market[]> {
  const { markets } = await getEligibleUsdtMarkets({
    maxSymbols: limit,
    safetyCap: limit,
  });

  return markets;
}

export async function getEligibleUsdtMarkets({
  maxSymbols = null,
  minQuoteVolume = 0,
  safetyCap,
}: EligibleMarketsOptions = {}): Promise<EligibleMarketsResult> {
  const [marketUniverse, tickers] = await Promise.all([
    getSpotMarketUniverse(),
    get24hTickers(),
  ]);

  const marketsWithTicker = marketUniverse.markets
    .map((market) => {
      const ticker = tickers[market.symbol];

      return {
        ...market,
        quoteVolume: ticker?.quoteVolume ?? 0,
        priceChangePercent: ticker?.priceChangePercent,
      };
    })
    .sort((left, right) => (right.quoteVolume ?? 0) - (left.quoteVolume ?? 0));
  const eligible = marketsWithTicker
    .filter((market) => market.quoteVolume > 0)
    .filter((market) => market.quoteVolume >= minQuoteVolume)
    .sort((left, right) => (right.quoteVolume ?? 0) - (left.quoteVolume ?? 0));
  const cap = maxSymbols ?? safetyCap ?? eligible.length;
  const capped = eligible.length > cap;

  return {
    markets: eligible.slice(0, cap),
    totalUsdtPairs: marketUniverse.totalUsdtPairs,
    eligibleCount: eligible.length,
    filteredLowVolume: marketsWithTicker.length - eligible.length,
    excludedStableOrLeveraged: marketUniverse.excludedStableOrLeveraged,
    capped,
  };
}

export async function getCandles(
  symbol: string,
  timeframe: Timeframe,
  limitOrOptions: number | GetCandlesOptions = 300,
): Promise<Candle[]> {
  const normalizedSymbol = symbol.toUpperCase();
  const options =
    typeof limitOrOptions === "number" ? { limit: limitOrOptions } : limitOrOptions;
  const limit = options.limit ?? 300;
  const { entry } = await getOrSetCached(
    cacheKeys.candlesWithRange(
      normalizedSymbol,
      timeframe,
      limit,
      options.startTime,
      options.endTime,
    ),
    cacheTtls.candles[timeframe],
    async () => {
      return fetchCandlesFromBinance(normalizedSymbol, timeframe, options);
    },
  );

  return entry.value;
}

export async function fetchCandlesFromBinance(
  symbol: string,
  timeframe: Timeframe,
  options: GetCandlesOptions = {},
): Promise<Candle[]> {
  const params = new URLSearchParams({
    symbol: symbol.toUpperCase(),
    interval: timeframeToBinanceInterval[timeframe],
    limit: String(options.limit ?? 300),
  });

  if (options.startTime !== undefined) {
    params.set("startTime", String(options.startTime));
  }

  if (options.endTime !== undefined) {
    params.set("endTime", String(options.endTime));
  }

  const klines = await fetchBinance<BinanceKline[]>(
    `/api/v3/klines?${params.toString()}`,
  );

  return klines.map(toCandle);
}

function isExcludedBaseAsset(baseAsset: string) {
  if (
    EXCLUDED_BASE_ASSETS.has(baseAsset) ||
    EXCLUDED_FAN_TOKEN_BASE_ASSETS.has(baseAsset)
  ) {
    return true;
  }

  if (baseAsset.endsWith("UP") && !LEVERAGED_UP_EXCEPTIONS.has(baseAsset)) {
    return true;
  }

  return LEVERAGED_SUFFIXES.some((suffix) => baseAsset.endsWith(suffix));
}

async function fetchBinance<T>(path: string): Promise<T> {
  const response = await fetch(`${BINANCE_REST_BASE_URL}${path}`, {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Binance request failed with ${response.status}: ${body || response.statusText}`,
    );
  }

  return response.json() as Promise<T>;
}

function toCandle(kline: BinanceKline): Candle {
  return {
    openTime: Number(kline[0]),
    open: Number(kline[1]),
    high: Number(kline[2]),
    low: Number(kline[3]),
    close: Number(kline[4]),
    volume: Number(kline[5]),
    quoteVolume: Number(kline[7]),
    closeTime: Number(kline[6]),
  };
}
