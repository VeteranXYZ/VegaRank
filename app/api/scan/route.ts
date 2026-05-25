import { NextResponse } from "next/server";
import pLimit from "p-limit";
import { cacheKeys, cacheTtls } from "@/lib/cache/keys";
import { getCached, setCached } from "@/lib/cache/memory";
import { getTopUsdtMarkets } from "@/lib/exchanges/binance";
import { TIMEFRAMES, type Timeframe } from "@/lib/exchanges/types";
import { scanMarket } from "@/lib/scanner/scanMarket";
import type { ScanResult } from "@/lib/scanner/types";
import { safePersistScanSnapshot } from "@/lib/storage/scanSnapshots";

const DEFAULT_SCAN_LIMIT = 100;
const MAX_SCAN_LIMIT = 200;
const SCAN_CONCURRENCY = 5;
type ScanTimeframe = Timeframe;
const SUPPORTED_TIMEFRAMES = new Set<ScanTimeframe>(TIMEFRAMES);
type ScanPayload = {
  exchange: "binance";
  timeframe: ScanTimeframe;
  results: ScanResult[];
  itemCount: number;
  errors?: { symbol: string; message: string }[];
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const timeframe = searchParams.get("timeframe") ?? "4h";
  const limit = parseLimit(searchParams.get("limit"), DEFAULT_SCAN_LIMIT, MAX_SCAN_LIMIT);

  if (!isTimeframe(timeframe)) {
    return NextResponse.json(
      { error: "timeframe must be one of 1h, 4h, 1d, 7d, or 1m." },
      { status: 400 },
    );
  }

  if (!limit.valid) {
    return NextResponse.json({ error: limit.error }, { status: 400 });
  }

  try {
    const cacheKey = cacheKeys.scan(timeframe, limit.value);
    const cachedEntry = getCached<ScanPayload>(cacheKey);

    if (cachedEntry) {
      return NextResponse.json({
        ...cachedEntry.value,
        cached: true,
        updatedAt: cachedEntry.updatedAt,
      });
    }

    const markets = await getTopUsdtMarkets(limit.value);
    const gate = pLimit(SCAN_CONCURRENCY);
    const settled = await Promise.all(
      markets.map((market) =>
        gate(async () => {
          try {
            return {
              result: await scanMarket(market.symbol, timeframe),
              error: null,
            };
          } catch (error) {
            return {
              result: null,
              error: {
                symbol: market.symbol,
                message: error instanceof Error ? error.message : "Unknown error",
              },
            };
          }
        }),
      ),
    );
    const results = settled
      .flatMap((item) => (item.result ? [item.result] : []))
      .sort((left, right) => right.rankScore - left.rankScore);
    const errors = settled.flatMap((item) => (item.error ? [item.error] : []));
    const payload: ScanPayload = {
      exchange: "binance",
      timeframe,
      results,
      itemCount: results.length,
      errors: errors.length > 0 ? errors : undefined,
    };

    if (errors.length > 0) {
      const updatedAt = new Date().toISOString();
      await safePersistScanSnapshot({
        createdAt: updatedAt,
        exchange: "binance",
        mode: "single",
        timeframe,
        limit: limit.value,
        itemCount: results.length,
        errorsCount: errors.length,
        results,
      });

      return NextResponse.json({
        ...payload,
        cached: false,
        updatedAt,
      });
    }

    const entry = setCached(cacheKey, payload, cacheTtls.scan[timeframe]);
    await safePersistScanSnapshot({
      createdAt: entry.updatedAt,
      exchange: "binance",
      mode: "single",
      timeframe,
      limit: limit.value,
      itemCount: results.length,
      errorsCount: 0,
      results,
    });

    return NextResponse.json({
      ...entry.value,
      cached: false,
      updatedAt: entry.updatedAt,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to scan Binance markets.",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 },
    );
  }
}

function isTimeframe(value: string): value is ScanTimeframe {
  return SUPPORTED_TIMEFRAMES.has(value as ScanTimeframe);
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
