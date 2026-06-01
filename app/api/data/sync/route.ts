import { NextResponse } from "next/server";
import { TIMEFRAMES, type Timeframe } from "@/lib/exchanges/types";
import {
  isLocalPersistenceDisabled,
  localPersistenceUnavailableMessage,
} from "@/lib/runtime/localPersistence";
import { publicErrorMessage } from "@/lib/runtime/publicErrors";

export const runtime = "nodejs";

const MAX_MARKET_LIMIT = 500;
const DEFAULT_MARKET_LIMIT = 200;
const SUPPORTED_MODES = new Set<MarketDataSyncMode>(["recent", "incremental"]);
const SUPPORTED_TIMEFRAMES = new Set<Timeframe>(TIMEFRAMES);

type MarketDataSyncMode = "recent" | "incremental";

type SyncRequestBody = {
  mode?: string;
  marketLimit?: number;
  timeframes?: string[];
};

export async function GET() {
  if (isLocalPersistenceDisabled()) {
    return localPersistenceUnavailableResponse();
  }

  try {
    const store = await createMarketDataStore();

    try {
      return NextResponse.json({
        summary: await store.getSummary(),
      });
    } finally {
      await store.close?.();
    }
  } catch (error) {
    console.error("local data summary failed", error);
    return NextResponse.json(
      {
        error: "Failed to read local market data summary.",
        message: publicErrorMessage("Local market data summary failed."),
      },
      { status: 502 },
    );
  }
}

export async function POST(request: Request) {
  if (isLocalPersistenceDisabled()) {
    return localPersistenceUnavailableResponse();
  }

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
    const [{ syncMarketData }, store] = await Promise.all([
      import("@/lib/storage/marketDataSync"),
      createMarketDataStore(),
    ]);
    const result = await syncMarketData({
      mode: mode.value,
      marketLimit: marketLimit.value,
      timeframes: timeframes.value,
      store,
    });

    return NextResponse.json({
      ...result,
      errors: result.errors.map((error) => ({
        ...error,
        message: "Local market data fetch failed.",
      })),
    });
  } catch (error) {
    console.error("local data sync failed", error);
    return NextResponse.json(
      {
        error: "Failed to sync local market data.",
        message: publicErrorMessage("Local market data sync failed."),
      },
      { status: 502 },
    );
  }
}

async function createMarketDataStore() {
  const { MarketDataStore } = await import("@/lib/storage/marketData");
  return new MarketDataStore();
}

function localPersistenceUnavailableResponse() {
  return NextResponse.json(
    { error: localPersistenceUnavailableMessage },
    { status: 501 },
  );
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
      error: "timeframes must be a non-empty array of 4h, 1h, 1d, 1w, or 1M.",
    };
  }

  return {
    valid: true as const,
    value: Array.from(new Set(timeframes)) as Timeframe[],
  };
}
