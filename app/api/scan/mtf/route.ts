import { NextResponse } from "next/server";
import pLimit from "p-limit";
import { cacheKeys, cacheTtls } from "@/lib/cache/keys";
import { getCached, setCached } from "@/lib/cache/memory";
import { getTopUsdtMarkets } from "@/lib/exchanges/binance";
import {
  mtfPresetTimeframes,
  type MtfPreset,
} from "@/lib/scanner/multiTimeframe";
import { scanMarketMultiTimeframe } from "@/lib/scanner/scanMarketMtf";
import type { ScanResult } from "@/lib/scanner/types";

const DEFAULT_MTF_SCAN_LIMIT = 50;
const MAX_MTF_SCAN_LIMIT = 100;
const MTF_SCAN_CONCURRENCY = 3;
const SUPPORTED_PRESETS = new Set<MtfPreset>([
  "short",
  "swing",
  "position",
  "full",
]);

type MtfScanPayload = {
  exchange: "binance";
  mode: "mtf";
  preset: MtfPreset;
  timeframes: typeof mtfPresetTimeframes[MtfPreset];
  results: ScanResult[];
  itemCount: number;
  errors?: { symbol: string; message: string }[];
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const preset = searchParams.get("preset") ?? "swing";
  const limit = parseLimit(
    searchParams.get("limit"),
    DEFAULT_MTF_SCAN_LIMIT,
    MAX_MTF_SCAN_LIMIT,
  );

  if (!isPreset(preset)) {
    return NextResponse.json(
      { error: "preset must be one of short, swing, position, or full." },
      { status: 400 },
    );
  }

  if (!limit.valid) {
    return NextResponse.json({ error: limit.error }, { status: 400 });
  }

  try {
    const cacheKey = cacheKeys.mtfScan(preset, limit.value);
    const cachedEntry = getCached<MtfScanPayload>(cacheKey);

    if (cachedEntry) {
      return NextResponse.json({
        ...cachedEntry.value,
        cached: true,
        updatedAt: cachedEntry.updatedAt,
      });
    }

    const markets = await getTopUsdtMarkets(limit.value);
    const gate = pLimit(MTF_SCAN_CONCURRENCY);
    const settled = await Promise.all(
      markets.map((market) =>
        gate(async () => {
          try {
            return {
              result: await scanMarketMultiTimeframe(market.symbol, preset),
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
    const payload: MtfScanPayload = {
      exchange: "binance",
      mode: "mtf",
      preset,
      timeframes: mtfPresetTimeframes[preset],
      results,
      itemCount: results.length,
      errors: errors.length > 0 ? errors : undefined,
    };

    if (errors.length > 0) {
      return NextResponse.json({
        ...payload,
        cached: false,
        updatedAt: new Date().toISOString(),
      });
    }

    const entry = setCached(cacheKey, payload, cacheTtls.mtfScan);

    return NextResponse.json({
      ...entry.value,
      cached: false,
      updatedAt: entry.updatedAt,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to scan Binance markets across timeframes.",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 },
    );
  }
}

function isPreset(value: string): value is MtfPreset {
  return SUPPORTED_PRESETS.has(value as MtfPreset);
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
