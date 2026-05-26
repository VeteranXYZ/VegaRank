import { NextResponse } from "next/server";
import pLimit from "p-limit";
import { cacheKeys, cacheTtls } from "@/lib/cache/keys";
import { getCached, setCached } from "@/lib/cache/memory";
import { getEligibleUsdtMarkets } from "@/lib/exchanges/binance";
import { TIMEFRAMES, type Timeframe } from "@/lib/exchanges/types";
import {
  isLocalPersistenceDisabled,
  localPersistenceUnavailableMessage,
} from "@/lib/runtime/localPersistence";
import {
  summarizeScanFailures,
  type ScanErrorSample,
  type ScanFailureSummary,
} from "@/lib/scanner/diagnostics";
import { scanMarket } from "@/lib/scanner/scanMarket";
import type { ScanResult } from "@/lib/scanner/types";

export const runtime = "nodejs";

const MAX_ELIGIBLE_SCAN_SYMBOLS = 600;
const SCAN_CONCURRENCY = 5;
const SCAN_UNIVERSE = "all-eligible-usdt";
type ScanTimeframe = Timeframe;
const SUPPORTED_TIMEFRAMES = new Set<ScanTimeframe>(TIMEFRAMES);
const SUPPORTED_SOURCES = new Set<ScanSource>(["remote", "local"]);

type ScanSource = "remote" | "local";

type ScanPayload = {
  exchange: "binance";
  timeframe: ScanTimeframe;
  source: ScanSource;
  universe: typeof SCAN_UNIVERSE;
  totalUsdtPairs: number;
  eligibleCount: number;
  scannedCount: number;
  scannedMarketCount: number;
  skippedCount: number;
  failedCount: number;
  minQuoteVolume: number;
  maxSymbols: number | null;
  capped: boolean;
  concurrency: number;
  durationMs: number;
  cacheTtlSeconds: number;
  cacheExpiresAt: string;
  usesClosedCandles: true;
  lastClosedCandleTime: string | null;
  failureSummary: ScanFailureSummary;
  results: ScanResult[];
  itemCount: number;
  errors?: ScanErrorSample[];
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startedAt = Date.now();
  const timeframe = searchParams.get("timeframe") ?? "4h";
  const source = parseSource(searchParams.get("source"));
  const maxSymbols = parseOptionalMaxSymbols(
    searchParams.get("maxSymbols") ?? searchParams.get("limit"),
  );
  const minQuoteVolume = parseMinQuoteVolume(searchParams.get("minQuoteVolume"));

  if (!isTimeframe(timeframe)) {
    return NextResponse.json(
      { error: "timeframe must be one of 4h, 1d, 1w, or 1M." },
      { status: 400 },
    );
  }

  if (!source.valid) {
    return NextResponse.json({ error: source.error }, { status: 400 });
  }

  if (!maxSymbols.valid) {
    return NextResponse.json({ error: maxSymbols.error }, { status: 400 });
  }

  if (!minQuoteVolume.valid) {
    return NextResponse.json({ error: minQuoteVolume.error }, { status: 400 });
  }

  if (source.value === "local" && isLocalPersistenceDisabled()) {
    return localPersistenceUnavailableResponse();
  }

  try {
    const ttlMs = cacheTtls.scan[timeframe];
    const cacheTtlSeconds = Math.floor(ttlMs / 1000);
    const cacheKey = cacheKeys.scan({
      source: source.value,
      timeframe,
      universe: SCAN_UNIVERSE,
      maxSymbols: maxSymbols.value,
      minQuoteVolume: minQuoteVolume.value,
      filters: "none",
    });
    const cachedEntry =
      source.value === "remote" ? getCached<ScanPayload>(cacheKey) : null;

    if (cachedEntry) {
      logScanDiagnostics(cachedEntry.value, true, Date.now() - startedAt);
      return NextResponse.json({
        ...cachedEntry.value,
        cached: true,
        updatedAt: cachedEntry.updatedAt,
        cacheExpiresAt: new Date(cachedEntry.expiresAt).toISOString(),
        durationMs: Date.now() - startedAt,
      });
    }

    const { settled, useLocal, marketStats } = await scanMarkets(
      timeframe,
      source.value,
      maxSymbols.value,
      minQuoteVolume.value,
    );
    const successful = settled.flatMap((item) => (item.result ? [item.result] : []));
    const results = successful
      .filter((result) => result.dataQuality.sufficientHistory)
      .sort((left, right) => right.rankScore - left.rankScore);
    const errors = settled.flatMap((item) => (item.error ? [item.error] : []));
    const skippedCount = successful.length - results.length;
    const durationMs = Date.now() - startedAt;
    const failureSummary = summarizeScanFailures({
      scannedResults: successful,
      errors,
      filteredLowVolume: marketStats.filteredLowVolume,
      excludedStableOrLeveraged: marketStats.excludedStableOrLeveraged,
    });
    const payload: ScanPayload = {
      exchange: "binance",
      timeframe,
      source: useLocal ? "local" : "remote",
      universe: SCAN_UNIVERSE,
      totalUsdtPairs: marketStats.totalUsdtPairs,
      eligibleCount: marketStats.eligibleCount,
      scannedCount: marketStats.scannedCount,
      scannedMarketCount: marketStats.scannedCount,
      skippedCount,
      failedCount: errors.length,
      minQuoteVolume: minQuoteVolume.value,
      maxSymbols: maxSymbols.value,
      capped: marketStats.capped,
      concurrency: SCAN_CONCURRENCY,
      durationMs,
      cacheTtlSeconds,
      cacheExpiresAt: new Date(Date.now() + ttlMs).toISOString(),
      usesClosedCandles: true,
      lastClosedCandleTime: getLatestClosedCandleTime(results),
      failureSummary,
      results,
      itemCount: results.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    };

    if (errors.length > 0 || useLocal) {
      const updatedAt = new Date().toISOString();
      logScanDiagnostics(payload, false, durationMs);
      return NextResponse.json({
        ...payload,
        cached: false,
        updatedAt,
      });
    }

    const entry = setCached(cacheKey, payload, ttlMs);
    logScanDiagnostics(payload, false, durationMs);

    return NextResponse.json({
      ...entry.value,
      cached: false,
      updatedAt: entry.updatedAt,
      cacheExpiresAt: new Date(entry.expiresAt).toISOString(),
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
  source: ScanSource,
  maxSymbols: number | null,
  minQuoteVolume: number,
) {
  if (source === "remote") {
    const marketResult = await getEligibleUsdtMarkets({
      maxSymbols,
      minQuoteVolume,
      safetyCap: MAX_ELIGIBLE_SCAN_SYMBOLS,
    });
    const settled = await scanMarketBatch({
      markets: marketResult.markets,
      getResult: (symbol) => scanMarket(symbol, timeframe),
    });

    return {
      settled,
      useLocal: false,
      marketStats: {
        totalUsdtPairs: marketResult.totalUsdtPairs,
        eligibleCount: marketResult.eligibleCount,
        scannedCount: marketResult.markets.length,
        filteredLowVolume: marketResult.filteredLowVolume,
        excludedStableOrLeveraged: marketResult.excludedStableOrLeveraged,
        capped: marketResult.capped,
      },
    };
  }

  const [{ scanLocalMarket }, store] = await Promise.all([
    import("@/lib/scanner/scanLocalMarket"),
    createMarketDataStore(),
  ]);

  try {
    const markets = (await store.getMarkets()).slice(
      0,
      maxSymbols ?? MAX_ELIGIBLE_SCAN_SYMBOLS,
    );
    const settled = await scanMarketBatch({
      markets,
      getResult: (symbol) => scanLocalMarket({ store, symbol, timeframe }),
    });

    return {
      settled,
      useLocal: true,
      marketStats: {
        totalUsdtPairs: markets.length,
        eligibleCount: markets.length,
        scannedCount: markets.length,
        filteredLowVolume: 0,
        excludedStableOrLeveraged: 0,
        capped: false,
      },
    };
  } finally {
    await store.close?.();
  }
}

function getLatestClosedCandleTime(results: ScanResult[]) {
  const latest = Math.max(
    ...results
      .map((result) => result.dataQuality.lastClosedCandleTime)
      .filter((value): value is number => typeof value === "number"),
  );

  return Number.isFinite(latest) ? new Date(latest).toISOString() : null;
}

function logScanDiagnostics(
  payload: ScanPayload,
  cached: boolean,
  durationMs: number,
) {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  console.info("scan diagnostics", {
    timeframe: payload.timeframe,
    eligibleCount: payload.eligibleCount,
    scannedCount: payload.scannedCount,
    failedCount: payload.failedCount,
    durationMs,
    cached,
  });
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

function parseOptionalMaxSymbols(value: string | null) {
  if (value === null || value === "" || value.toLowerCase() === "all") {
    return { valid: true as const, value: null };
  }

  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < 1 ||
    parsed > MAX_ELIGIBLE_SCAN_SYMBOLS
  ) {
    return {
      valid: false as const,
      error: `maxSymbols must be an integer between 1 and ${MAX_ELIGIBLE_SCAN_SYMBOLS}.`,
    };
  }

  return { valid: true as const, value: parsed };
}

function parseMinQuoteVolume(value: string | null) {
  if (value === null || value === "") {
    return { valid: true as const, value: 0 };
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return {
      valid: false as const,
      error: "minQuoteVolume must be a non-negative number.",
    };
  }

  return { valid: true as const, value: parsed };
}
