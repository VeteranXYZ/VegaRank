import { cacheKeys, cacheTtls } from "@/lib/cache/keys";
import { getOrSetCached } from "@/lib/cache/memory";
import type { Candle, Market, Timeframe } from "./types";

const BINANCE_REST_BASE_URL = "https://data-api.binance.vision";

const EXCLUDED_BASE_ASSETS = new Set([
  "USDC",
  "FDUSD",
  "TUSD",
  "DAI",
  "USDP",
  "BUSD",
  "USD1",
  "USDE",
  "USDS",
  "USTC",
  "PYUSD",
  "EUR",
  "AEUR",
  "EURI",
  "PAX",
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

const timeframeToBinanceInterval = {
  "1h": "1h",
  "4h": "4h",
  "1d": "1d",
  "7d": "1w",
  "1m": "1M",
} satisfies Record<Timeframe, string>;

export async function getSpotMarkets(): Promise<Market[]> {
  const { entry } = await getOrSetCached(
    cacheKeys.markets,
    cacheTtls.markets,
    async (): Promise<Market[]> => {
      const data = await fetchBinance<BinanceExchangeInfo>("/api/v3/exchangeInfo");

      return data.symbols
        .filter((market) => {
          return (
            market.status === "TRADING" &&
            market.quoteAsset === "USDT" &&
            market.isSpotTradingAllowed !== false &&
            !isExcludedBaseAsset(market.baseAsset)
          );
        })
        .map((market) => ({
          exchange: "binance",
          symbol: market.symbol,
          baseAsset: market.baseAsset,
          quoteAsset: market.quoteAsset,
          status: market.status,
        }));
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
  const [markets, tickers] = await Promise.all([getSpotMarkets(), get24hTickers()]);

  return markets
    .map((market) => {
      const ticker = tickers[market.symbol];

      return {
        ...market,
        quoteVolume: ticker?.quoteVolume ?? 0,
        priceChangePercent: ticker?.priceChangePercent,
      };
    })
    .filter((market) => market.quoteVolume > 0)
    .sort((left, right) => (right.quoteVolume ?? 0) - (left.quoteVolume ?? 0))
    .slice(0, limit);
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
    cacheKeys.candles(normalizedSymbol, timeframe, limit),
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
  if (EXCLUDED_BASE_ASSETS.has(baseAsset)) {
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
    closeTime: Number(kline[6]),
  };
}
