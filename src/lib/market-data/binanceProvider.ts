import { fetchWithTimeout } from "@/lib/exchanges/binance";
import type { Candle, Timeframe } from "@/lib/exchanges/types";

const BINANCE_REST_BASE_URL = "https://data-api.binance.vision";
const DEFAULT_KLINE_LIMIT = 500;
const MAX_KLINE_LIMIT = 1000;

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

const timeframeToBinanceInterval = {
  "4h": "4h",
  "1d": "1d",
  "1w": "1w",
  "1M": "1M",
} satisfies Record<Timeframe, string>;

export type FetchBinanceKlinesOptions = {
  symbol: string;
  timeframe: Timeframe;
  limit?: number;
  startTime?: number;
  endTime?: number;
  timeoutMs?: number;
};

export async function fetchBinanceKlines({
  symbol,
  timeframe,
  limit = DEFAULT_KLINE_LIMIT,
  startTime,
  endTime,
  timeoutMs,
}: FetchBinanceKlinesOptions): Promise<Candle[]> {
  const params = new URLSearchParams({
    symbol: symbol.toUpperCase(),
    interval: timeframeToBinanceInterval[timeframe],
    limit: String(Math.min(Math.max(1, limit), MAX_KLINE_LIMIT)),
  });

  if (startTime !== undefined) {
    params.set("startTime", String(startTime));
  }

  if (endTime !== undefined) {
    params.set("endTime", String(endTime));
  }

  const response = await fetchWithTimeout(
    `${BINANCE_REST_BASE_URL}/api/v3/klines?${params.toString()}`,
    {
      headers: { Accept: "application/json" },
      cache: "no-store",
    },
    timeoutMs,
  );

  if (!response.ok) {
    const body = await response.text();
    const detail = body || response.statusText;

    if (response.status === 429 || response.status === 418) {
      throw new Error(`Binance rate limit error ${response.status}: ${detail}`);
    }

    if (response.status >= 500) {
      throw new Error(`Binance temporary error ${response.status}: ${detail}`);
    }

    throw new Error(`Binance kline request failed with ${response.status}: ${detail}`);
  }

  const rows = (await response.json()) as BinanceKline[];
  return rows.map(mapBinanceKlineToCandle);
}

export function mapBinanceKlineToCandle(row: BinanceKline): Candle {
  return {
    openTime: Number(row[0]),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
    closeTime: Number(row[6]),
    quoteVolume: Number(row[7]),
  };
}
