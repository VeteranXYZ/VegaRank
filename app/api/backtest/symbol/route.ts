import { NextResponse } from "next/server";
import { getCandles } from "@/lib/exchanges/binance";
import type { Timeframe } from "@/lib/exchanges/types";
import { getOrSetCached } from "@/lib/cache/memory";
import {
  reviewHistoricalBehavior,
  type BacktestMatchMode,
  type HistoricalBehaviorResult,
} from "@/lib/backtest/symbolBehavior";

export const runtime = "nodejs";

const supportedBacktestTimeframes = ["4h", "1d", "1w", "1M"] as const satisfies
  readonly Timeframe[];
type BacktestTimeframe = (typeof supportedBacktestTimeframes)[number];
const supportedTimeframes = new Set<string>(supportedBacktestTimeframes);
const supportedMatchModes = new Set(["broad", "standard", "similar"]);
const symbolPattern = /^[A-Z0-9]+USDT$/;
const minLimit = 300;
const maxLimit = 1000;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const symbol = url.searchParams.get("symbol")?.trim().toUpperCase() ?? "";
    const timeframeParam = url.searchParams.get("timeframe") ?? "";
    const requestedLimit = Number(url.searchParams.get("limit") ?? maxLimit);
    const matchModeParam = url.searchParams.get("matchMode") ?? "standard";

    if (!symbol) {
      return NextResponse.json({ error: "Missing required symbol." }, { status: 400 });
    }

    if (!symbolPattern.test(symbol)) {
      return NextResponse.json(
        { error: "Invalid symbol. Use an uppercase Binance USDT symbol." },
        { status: 400 },
      );
    }

    if (!isBacktestTimeframe(timeframeParam)) {
      return NextResponse.json(
        { error: "Unsupported timeframe. Use 4h, 1d, 1w, or 1M." },
        { status: 400 },
      );
    }

    if (!supportedMatchModes.has(matchModeParam)) {
      return NextResponse.json(
        { error: "Unsupported matchMode. Use broad, standard, or similar." },
        { status: 400 },
      );
    }

    const limit = clampLimit(requestedLimit);
    const timeframe = timeframeParam;
    const matchMode = matchModeParam as BacktestMatchMode;
    const cacheKey = [
      "backtest",
      "symbol",
      symbol,
      timeframe,
      `limit:${limit}`,
      `match:${matchMode}`,
    ].join(":");
    const ttlMs = getBacktestTtl(timeframe);
    const { entry, cached } = await getOrSetCached<HistoricalBehaviorResult>(
      cacheKey,
      ttlMs,
      async () => {
        const candles = await getCandles(symbol, timeframe, limit);

        return reviewHistoricalBehavior({
          symbol,
          timeframe,
          limit,
          matchMode,
          candles,
        });
      },
    );

    return NextResponse.json({
      ...entry.value,
      cached,
      updatedAt: entry.updatedAt,
      cacheExpiresAt: new Date(entry.expiresAt).toISOString(),
    });
  } catch (error) {
    console.error("symbol historical behavior failed", error);
    return NextResponse.json(
      {
        error: "Failed to review historical behavior for this symbol.",
        message: "Historical behavior request failed.",
      },
      { status: 502 },
    );
  }
}

function clampLimit(value: number) {
  if (!Number.isFinite(value)) {
    return maxLimit;
  }

  return Math.min(maxLimit, Math.max(minLimit, Math.trunc(value)));
}

function isBacktestTimeframe(value: string): value is BacktestTimeframe {
  return supportedTimeframes.has(value);
}

function getBacktestTtl(timeframe: BacktestTimeframe) {
  const minute = 60 * 1000;
  const hour = 60 * minute;

  switch (timeframe) {
    case "4h":
      return 60 * minute;
    case "1d":
      return 6 * hour;
    case "1w":
      return 24 * hour;
    case "1M":
      return 72 * hour;
  }
}
