import { NextResponse } from "next/server";
import { cacheKeys } from "@/lib/cache/keys";
import { getCached } from "@/lib/cache/memory";
import { getCandles } from "@/lib/exchanges/binance";
import { TIMEFRAMES, type Candle, type Timeframe } from "@/lib/exchanges/types";

const DEFAULT_CANDLE_LIMIT = 300;
const MAX_CANDLE_LIMIT = 1000;
const SUPPORTED_TIMEFRAMES = new Set<Timeframe>(TIMEFRAMES);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") ?? "BTCUSDT").toUpperCase();
  const timeframe = searchParams.get("timeframe") ?? "4h";
  const limit = parseLimit(
    searchParams.get("limit"),
    DEFAULT_CANDLE_LIMIT,
    MAX_CANDLE_LIMIT,
  );

  if (!/^[A-Z0-9]{5,30}$/.test(symbol)) {
    return NextResponse.json(
      { error: "symbol must be a Binance symbol such as BTCUSDT." },
      { status: 400 },
    );
  }

  if (!isTimeframe(timeframe)) {
    return NextResponse.json(
      { error: "timeframe must be one of 1h, 4h, 1d, 7d, or 1M." },
      { status: 400 },
    );
  }

  if (!limit.valid) {
    return NextResponse.json({ error: limit.error }, { status: 400 });
  }

  try {
    const cacheKey = cacheKeys.candlesWithRange(symbol, timeframe, limit.value);
    const cachedEntry = getCached<Candle[]>(cacheKey);

    if (cachedEntry) {
      return NextResponse.json({
        exchange: "binance",
        symbol,
        timeframe,
        candles: cachedEntry.value,
        itemCount: cachedEntry.value.length,
        cached: true,
        updatedAt: cachedEntry.updatedAt,
      });
    }

    const candles = await getCandles(symbol, timeframe, limit.value);
    const storedEntry = getCached<Candle[]>(cacheKey);

    return NextResponse.json({
      exchange: "binance",
      symbol,
      timeframe,
      candles,
      itemCount: candles.length,
      cached: false,
      updatedAt: storedEntry?.updatedAt ?? new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch Binance candles.",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 },
    );
  }
}

function isTimeframe(value: string): value is Timeframe {
  return SUPPORTED_TIMEFRAMES.has(value as Timeframe);
}

function parseLimit(value: string | null, fallback: number, max: number) {
  if (value === null) {
    return { valid: true as const, value: fallback };
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    return {
      valid: false as const,
      error: `limit must be an integer between 1 and ${max}.`,
    };
  }

  return { valid: true as const, value: parsed };
}
