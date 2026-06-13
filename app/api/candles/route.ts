import { NextResponse } from "next/server";
import { cacheKeys } from "@/lib/cache/keys";
import { getCached } from "@/lib/cache/memory";
import { getCandles } from "@/lib/exchanges/binance";
import {
  TIMEFRAMES,
  type Candle,
  type Exchange,
  type Timeframe,
} from "@/lib/exchanges/types";
import { calculateIndicatorSnapshot } from "@/lib/indicators";
import { publicErrorMessage } from "@/lib/runtime/publicErrors";
import {
  isLocalPersistenceDisabled,
  localPersistenceUnavailableMessage,
} from "@/lib/runtime/localPersistence";
import { scanCandles } from "@/lib/ranking-engine/scanCandles";
import {
  isValidMarketSymbol,
  normalizeMarketSymbolParam,
} from "@/lib/market-data/symbolValidation";

const DEFAULT_CANDLE_LIMIT = 300;
const MAX_CANDLE_LIMIT = 1000;
const SUPPORTED_TIMEFRAMES = new Set<Timeframe>(TIMEFRAMES);
const SUPPORTED_SOURCES = new Set<CandleSource>(["remote", "local"]);

type CandleSource = "remote" | "local";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const exchange = parseExchange(searchParams.get("exchange"));
  const symbol = normalizeMarketSymbolParam(searchParams.get("symbol") ?? "BTCUSDT");
  const timeframe = searchParams.get("timeframe") ?? "4h";
  const source = parseSource(searchParams.get("source"));
  const limit = parseLimit(
    searchParams.get("limit"),
    DEFAULT_CANDLE_LIMIT,
    MAX_CANDLE_LIMIT,
  );

  if (!isValidMarketSymbol(symbol)) {
    return NextResponse.json(
      { error: "symbol must be a market symbol such as BTCUSDT or BTC-USDC." },
      { status: 400 },
    );
  }

  if (!exchange) {
    return NextResponse.json({ error: "exchange is invalid." }, { status: 400 });
  }

  if (!isTimeframe(timeframe)) {
    return NextResponse.json(
      { error: "timeframe must be one of 4h, 1h, 1d, 1w, or 1M." },
      { status: 400 },
    );
  }

  if (!limit.valid) {
    return NextResponse.json({ error: limit.error }, { status: 400 });
  }

  if (!source.valid) {
    return NextResponse.json({ error: source.error }, { status: 400 });
  }

  if (
    source.value === "local" &&
    isLocalPersistenceDisabled()
  ) {
    return localPersistenceUnavailableResponse();
  }

  if (source.value === "remote" && exchange !== "binance") {
    return NextResponse.json(
      { error: "remote source is only available for Binance symbols." },
      { status: 400 },
    );
  }

  try {
    if (source.value === "local") {
      const store = await createMarketDataStore();

      try {
        const candles = await store.getCandles({
          exchange,
          symbol,
          timeframe,
          limit: limit.value,
        });

        return NextResponse.json({
          exchange,
          symbol,
          timeframe,
          source: "local",
          ...buildCandleAnalysis(symbol, timeframe, candles, exchange),
          cached: false,
          updatedAt: new Date().toISOString(),
        });
      } finally {
        await store.close?.();
      }
    }

    const cacheKey = cacheKeys.candlesWithRange(symbol, timeframe, limit.value);
    const cachedEntry = getCached<Candle[]>(cacheKey);

    if (cachedEntry) {
      return NextResponse.json({
        exchange,
        symbol,
        timeframe,
        source: "remote",
        ...buildCandleAnalysis(symbol, timeframe, cachedEntry.value, exchange),
        cached: true,
        updatedAt: cachedEntry.updatedAt,
      });
    }

    const candles = await getCandles(symbol, timeframe, limit.value);
    const storedEntry = getCached<Candle[]>(cacheKey);

    return NextResponse.json({
      exchange,
      symbol,
      timeframe,
      source: "remote",
      ...buildCandleAnalysis(symbol, timeframe, candles, exchange),
      cached: false,
      updatedAt: storedEntry?.updatedAt ?? new Date().toISOString(),
    });
  } catch (error) {
    console.error("candles route failed", error);
    return NextResponse.json(
      {
        error: "Failed to fetch Binance candles.",
        message: publicErrorMessage("Remote market data request failed."),
      },
      { status: 502 },
    );
  }
}

function buildCandleAnalysis(
  symbol: string,
  timeframe: Timeframe,
  candles: Candle[],
  exchange: Exchange,
) {
  if (candles.length === 0) {
    return {
      candles,
      snapshot: null,
      scanResult: null,
      itemCount: 0,
    };
  }

  return {
    candles,
    snapshot: calculateIndicatorSnapshot(candles),
    scanResult: scanCandles(symbol, timeframe, candles, { exchange }),
    itemCount: candles.length,
  };
}

function localPersistenceUnavailableResponse() {
  return NextResponse.json(
    { error: localPersistenceUnavailableMessage },
    { status: 501 },
  );
}

async function createMarketDataStore() {
  const { MarketDataStore } = await import("@/lib/storage/marketData");
  return new MarketDataStore();
}

function parseSource(value: string | null) {
  const source = value ?? "remote";

  if (!SUPPORTED_SOURCES.has(source as CandleSource)) {
    return {
      valid: false as const,
      error: "source must be remote or local.",
    };
  }

  return { valid: true as const, value: source as CandleSource };
}

function isTimeframe(value: string): value is Timeframe {
  return SUPPORTED_TIMEFRAMES.has(value as Timeframe);
}

function parseExchange(value: string | null): Exchange | null {
  const exchange = (value?.trim() || "binance").toLowerCase();

  if (exchange === "binance" || exchange === "coinbase") {
    return exchange;
  }

  return null;
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
