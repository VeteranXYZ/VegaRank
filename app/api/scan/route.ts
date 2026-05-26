import { NextResponse } from "next/server";
import pLimit from "p-limit";
import { cacheKeys, cacheTtls } from "@/lib/cache/keys";
import { getCached, setCached } from "@/lib/cache/memory";
import { getTopUsdtMarkets } from "@/lib/exchanges/binance";
import { TIMEFRAMES, type Timeframe } from "@/lib/exchanges/types";
import {
  isCloudflareDeployTarget,
  isLocalPersistenceDisabled,
  localPersistenceUnavailableMessage,
} from "@/lib/runtime/localPersistence";
import { scanMarket } from "@/lib/scanner/scanMarket";
import type { ScanResult } from "@/lib/scanner/types";

export const runtime = "nodejs";

const DEFAULT_SCAN_LIMIT = 100;
const MAX_SCAN_LIMIT = 200;
const SCAN_CONCURRENCY = 5;
type ScanTimeframe = Timeframe;
const SUPPORTED_TIMEFRAMES = new Set<ScanTimeframe>(TIMEFRAMES);
const SUPPORTED_SOURCES = new Set<ScanSource>(["remote", "local"]);

type ScanSource = "remote" | "local";

type ScanPayload = {
  exchange: "binance";
  timeframe: ScanTimeframe;
  source: ScanSource;
  results: ScanResult[];
  itemCount: number;
  scannedMarketCount: number;
  displayLimit: number;
  errors?: { symbol: string; message: string }[];
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const timeframe = searchParams.get("timeframe") ?? "4h";
  const source = parseSource(searchParams.get("source"));
  const limit = parseLimit(searchParams.get("limit"), DEFAULT_SCAN_LIMIT, MAX_SCAN_LIMIT);

  if (!isTimeframe(timeframe)) {
    return NextResponse.json(
      { error: "timeframe must be one of 1h, 4h, 1d, 7d, or 1M." },
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
    const cacheKey = cacheKeys.scan(timeframe, limit.value);
    const cachedEntry =
      source.value === "remote" ? getCached<ScanPayload>(cacheKey) : null;

    if (cachedEntry) {
      return NextResponse.json({
        ...cachedEntry.value,
        cached: true,
        updatedAt: cachedEntry.updatedAt,
      });
    }

    const { settled, useLocal, scannedMarketCount } = await scanMarkets(
      timeframe,
      limit.value,
      source.value,
    );
    const results = settled
      .flatMap((item) => (item.result ? [item.result] : []))
      .sort((left, right) => right.rankScore - left.rankScore);
    const errors = settled.flatMap((item) => (item.error ? [item.error] : []));
    const payload: ScanPayload = {
      exchange: "binance",
      timeframe,
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
    await safePersistScanSnapshotIfAvailable({
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

async function scanMarkets(
  timeframe: ScanTimeframe,
  limit: number,
  source: ScanSource,
) {
  if (source === "remote") {
    const markets = await getTopUsdtMarkets(limit);
    const settled = await scanMarketBatch({
      markets,
      getResult: (symbol) => scanMarket(symbol, timeframe),
    });

    return {
      settled,
      useLocal: false,
      scannedMarketCount: markets.length,
    };
  }

  const [{ MarketDataStore }, { scanLocalMarket }] = await Promise.all([
    import("@/lib/storage/marketData"),
    import("@/lib/scanner/scanLocalMarket"),
  ]);
  const store = new MarketDataStore();

  try {
    const markets = store.getMarkets().slice(0, limit);
    const settled = await scanMarketBatch({
      markets,
      getResult: (symbol) => scanLocalMarket({ store, symbol, timeframe }),
    });

    return { settled, useLocal: true, scannedMarketCount: markets.length };
  } finally {
    store.close();
  }
}

type ScanSnapshotInput = {
  createdAt: string;
  exchange: "binance";
  mode: "single";
  timeframe: Timeframe;
  limit: number;
  itemCount: number;
  errorsCount: number;
  results: ScanResult[];
};

async function safePersistScanSnapshotIfAvailable(input: ScanSnapshotInput) {
  if (isCloudflareDeployTarget()) {
    const { safePersistScanSnapshotToD1 } = await import(
      "@/lib/storage/d1ScanSnapshots"
    );
    return safePersistScanSnapshotToD1(input);
  }

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

async function scanMarketBatch({
  markets,
  getResult,
}: {
  markets: Array<{ symbol: string }>;
  getResult: (symbol: string) => ScanResult | Promise<ScanResult>;
}) {
  const gate = pLimit(SCAN_CONCURRENCY);

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

function isTimeframe(value: string): value is ScanTimeframe {
  return SUPPORTED_TIMEFRAMES.has(value as ScanTimeframe);
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
