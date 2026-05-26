import { NextResponse } from "next/server";
import pLimit from "p-limit";
import { cacheKeys, cacheTtls } from "@/lib/cache/keys";
import { getCached, setCached } from "@/lib/cache/memory";
import { getTopUsdtMarkets } from "@/lib/exchanges/binance";
import {
  mtfPresetTimeframes,
  type MtfPreset,
} from "@/lib/scanner/multiTimeframe";
import {
  isLocalPersistenceDisabled,
  localPersistenceUnavailableMessage,
} from "@/lib/runtime/localPersistence";
import { scanMarketMultiTimeframe } from "@/lib/scanner/scanMarketMtf";
import type { ScanResult } from "@/lib/scanner/types";

export const runtime = "nodejs";

const DEFAULT_MTF_SCAN_LIMIT = 50;
const MAX_MTF_SCAN_LIMIT = 100;
const MTF_SCAN_CONCURRENCY = 3;
const SUPPORTED_PRESETS = new Set<MtfPreset>([
  "short",
  "swing",
  "position",
  "full",
]);
const SUPPORTED_SOURCES = new Set<ScanSource>(["remote", "local"]);

type ScanSource = "remote" | "local";

type MtfScanPayload = {
  exchange: "binance";
  mode: "mtf";
  preset: MtfPreset;
  timeframes: typeof mtfPresetTimeframes[MtfPreset];
  source: ScanSource;
  results: ScanResult[];
  itemCount: number;
  scannedMarketCount: number;
  displayLimit: number;
  errors?: { symbol: string; message: string }[];
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const preset = searchParams.get("preset") ?? "swing";
  const source = parseSource(searchParams.get("source"));
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

  if (!source.valid) {
    return NextResponse.json({ error: source.error }, { status: 400 });
  }

  if (!limit.valid) {
    return NextResponse.json({ error: limit.error }, { status: 400 });
  }

  if (source.value === "local" && isLocalPersistenceDisabled()) {
    return localPersistenceUnavailableResponse();
  }

  try {
    const cacheKey = cacheKeys.mtfScan(preset, limit.value);
    const cachedEntry =
      source.value === "remote" ? getCached<MtfScanPayload>(cacheKey) : null;

    if (cachedEntry) {
      return NextResponse.json({
        ...cachedEntry.value,
        cached: true,
        updatedAt: cachedEntry.updatedAt,
      });
    }

    const { settled, useLocal, scannedMarketCount } = await scanMtfMarkets(
      preset,
      limit.value,
      source.value,
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
      source: useLocal ? "local" : "remote",
      results,
      itemCount: results.length,
      scannedMarketCount,
      displayLimit: limit.value,
      errors: errors.length > 0 ? errors : undefined,
    };

    if (errors.length > 0 || useLocal) {
      const updatedAt = new Date().toISOString();
      await safePersistScanSnapshotIfAvailable({
        createdAt: updatedAt,
        exchange: "binance",
        mode: "mtf",
        preset,
        timeframes: mtfPresetTimeframes[preset],
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

    const entry = setCached(cacheKey, payload, cacheTtls.mtfScan);
    await safePersistScanSnapshotIfAvailable({
      createdAt: entry.updatedAt,
      exchange: "binance",
      mode: "mtf",
      preset,
      timeframes: mtfPresetTimeframes[preset],
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
        error: "Failed to scan Binance markets across timeframes.",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 },
    );
  }
}

async function scanMtfMarkets(
  preset: MtfPreset,
  limit: number,
  source: ScanSource,
) {
  if (source === "remote") {
    const markets = await getTopUsdtMarkets(limit);
    const settled = await scanMtfMarketBatch({
      markets,
      getResult: (symbol) => scanMarketMultiTimeframe(symbol, preset),
    });

    return {
      settled,
      useLocal: false,
      scannedMarketCount: markets.length,
    };
  }

  const [{ MarketDataStore }, { scanLocalMarketMultiTimeframe }] = await Promise.all([
    import("@/lib/storage/marketData"),
    import("@/lib/scanner/scanLocalMarket"),
  ]);
  const store = new MarketDataStore();

  try {
    const markets = store.getMarkets().slice(0, limit);
    const settled = await scanMtfMarketBatch({
      markets,
      getResult: (symbol) =>
        scanLocalMarketMultiTimeframe({
          store,
          symbol,
          preset,
        }),
    });

    return { settled, useLocal: true, scannedMarketCount: markets.length };
  } finally {
    store.close();
  }
}

type MtfScanSnapshotInput = {
  createdAt: string;
  exchange: "binance";
  mode: "mtf";
  preset: MtfPreset;
  timeframes: typeof mtfPresetTimeframes[MtfPreset];
  limit: number;
  itemCount: number;
  errorsCount: number;
  results: ScanResult[];
};

async function safePersistScanSnapshotIfAvailable(input: MtfScanSnapshotInput) {
  if (isLocalPersistenceDisabled()) {
    return null;
  }

  const { safePersistScanSnapshot } = await import("@/lib/storage/scanSnapshots");
  return safePersistScanSnapshot(input);
}

function localPersistenceUnavailableResponse() {
  return NextResponse.json(
    { error: localPersistenceUnavailableMessage },
    { status: 501 },
  );
}

async function scanMtfMarketBatch({
  markets,
  getResult,
}: {
  markets: Array<{ symbol: string }>;
  getResult: (symbol: string) => ScanResult | Promise<ScanResult>;
}) {
  const gate = pLimit(MTF_SCAN_CONCURRENCY);

  return Promise.all(
    markets.map((market) =>
      gate(async () => {
        try {
          return {
            result: await getResult(market.symbol),
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
}

function isPreset(value: string): value is MtfPreset {
  return SUPPORTED_PRESETS.has(value as MtfPreset);
}

function parseSource(value: string | null) {
  const source = value ?? "remote";

  if (!SUPPORTED_SOURCES.has(source as ScanSource)) {
    return {
      valid: false as const,
      error: "source must be remote or local.",
    };
  }

  return { valid: true as const, value: source as ScanSource };
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
