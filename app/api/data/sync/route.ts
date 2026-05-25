import { NextResponse } from "next/server";
import { TIMEFRAMES, type Timeframe } from "@/lib/exchanges/types";
import { MarketDataStore } from "@/lib/storage/marketData";
import {
  syncMarketData,
  type MarketDataSyncMode,
} from "@/lib/storage/marketDataSync";

const MAX_MARKET_LIMIT = 500;
const DEFAULT_MARKET_LIMIT = 200;
const SUPPORTED_MODES = new Set<MarketDataSyncMode>(["recent", "incremental"]);
const SUPPORTED_TIMEFRAMES = new Set<Timeframe>(TIMEFRAMES);

type SyncRequestBody = {
  mode?: string;
  marketLimit?: number;
  timeframes?: string[];
};

export async function GET() {
  const store = new MarketDataStore();

  try {
    return NextResponse.json({
      summary: store.getSummary(),
    });
  } finally {
    store.close();
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as SyncRequestBody;
  const mode = parseMode(body.mode);
  const marketLimit = parseMarketLimit(body.marketLimit);
  const timeframes = parseTimeframes(body.timeframes);

  if (!mode.valid) {
    return NextResponse.json({ error: mode.error }, { status: 400 });
  }

  if (!marketLimit.valid) {
    return NextResponse.json({ error: marketLimit.error }, { status: 400 });
  }

  if (!timeframes.valid) {
    return NextResponse.json({ error: timeframes.error }, { status: 400 });
  }

  try {
    const result = await syncMarketData({
      mode: mode.value,
      marketLimit: marketLimit.value,
      timeframes: timeframes.value,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to sync local market data.",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 },
    );
  }
}

function parseMode(value: string | undefined) {
  const mode = value ?? "incremental";

  if (!SUPPORTED_MODES.has(mode as MarketDataSyncMode)) {
    return {
      valid: false as const,
      error: "mode must be recent or incremental.",
    };
  }

  return { valid: true as const, value: mode as MarketDataSyncMode };
}

function parseMarketLimit(value: number | undefined) {
  const marketLimit = value ?? DEFAULT_MARKET_LIMIT;

  if (
    !Number.isInteger(marketLimit) ||
    marketLimit < 1 ||
    marketLimit > MAX_MARKET_LIMIT
  ) {
    return {
      valid: false as const,
      error: `marketLimit must be an integer between 1 and ${MAX_MARKET_LIMIT}.`,
    };
  }

  return { valid: true as const, value: marketLimit };
}

function parseTimeframes(value: string[] | undefined) {
  const timeframes = value ?? [...TIMEFRAMES];

  if (
    !Array.isArray(timeframes) ||
    timeframes.length === 0 ||
    timeframes.some((timeframe) => !SUPPORTED_TIMEFRAMES.has(timeframe as Timeframe))
  ) {
    return {
      valid: false as const,
      error: "timeframes must be a non-empty array of 1h, 4h, 1d, 7d, or 1m.",
    };
  }

  return {
    valid: true as const,
    value: Array.from(new Set(timeframes)) as Timeframe[],
  };
}
