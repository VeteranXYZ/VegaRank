import { NextResponse } from "next/server";
import pLimit from "p-limit";
import { cacheKeys, cacheTtls } from "@/lib/cache/keys";
import { getCached, setCached } from "@/lib/cache/memory";
import { getEligibleUsdtMarkets } from "@/lib/exchanges/binance";
import {
  mtfPresetTimeframes,
  type MtfPreset,
} from "@/lib/scanner/multiTimeframe";
import {
  isLocalPersistenceDisabled,
  localPersistenceUnavailableMessage,
} from "@/lib/runtime/localPersistence";
import {
  summarizeScanFailures,
  type ScanErrorSample,
  type ScanFailureSummary,
} from "@/lib/scanner/diagnostics";
import { scanMarketMultiTimeframe } from "@/lib/scanner/scanMarketMtf";
import type { ScanResult } from "@/lib/scanner/types";

export const runtime = "nodejs";

const MAX_ELIGIBLE_SCAN_SYMBOLS = 600;
const MTF_SCAN_CONCURRENCY = 3;
const SCAN_UNIVERSE = "all-eligible-usdt";
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
  failureSummary: ScanFailureSummary;
  results: ScanResult[];
  itemCount: number;
  errors?: ScanErrorSample[];
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startedAt = Date.now();
  const preset = searchParams.get("preset") ?? "short";
  const source = parseSource(searchParams.get("source"));
  const maxSymbols = parseOptionalMaxSymbols(
    searchParams.get("maxSymbols") ?? searchParams.get("limit"),
  );
  const minQuoteVolume = parseMinQuoteVolume(searchParams.get("minQuoteVolume"));

  if (!isPreset(preset)) {
    return NextResponse.json(
      { error: "preset must be one of short, swing, position, or full." },
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
    const ttlMs = getMtfCacheTtl(preset);
    const cacheTtlSeconds = Math.floor(ttlMs / 1000);
    const cacheKey = cacheKeys.mtfScan({
      source: source.value,
      preset,
      universe: SCAN_UNIVERSE,
      maxSymbols: maxSymbols.value,
      minQuoteVolume: minQuoteVolume.value,
      filters: "none",
    });
    const cachedEntry =
      source.value === "remote" ? getCached<MtfScanPayload>(cacheKey) : null;

    if (cachedEntry) {
      logMtfScanDiagnostics(cachedEntry.value, true, Date.now() - startedAt);
      return NextResponse.json({
        ...cachedEntry.value,
        cached: true,
        updatedAt: cachedEntry.updatedAt,
        cacheExpiresAt: new Date(cachedEntry.expiresAt).toISOString(),
        durationMs: Date.now() - startedAt,
      });
    }

    const { settled, useLocal, marketStats } = await scanMtfMarkets(
      preset,
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
    const payload: MtfScanPayload = {
      exchange: "binance",
      mode: "mtf",
      preset,
      timeframes: mtfPresetTimeframes[preset],
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
      concurrency: MTF_SCAN_CONCURRENCY,
      durationMs,
      cacheTtlSeconds,
      cacheExpiresAt: new Date(Date.now() + ttlMs).toISOString(),
      failureSummary,
      results,
      itemCount: results.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    };

    if (errors.length > 0 || useLocal) {
      const updatedAt = new Date().toISOString();
      logMtfScanDiagnostics(payload, false, durationMs);
      return NextResponse.json({
        ...payload,
        cached: false,
        updatedAt,
      });
    }

    const entry = setCached(cacheKey, payload, ttlMs);
    logMtfScanDiagnostics(payload, false, durationMs);

    return NextResponse.json({
      ...entry.value,
      cached: false,
      updatedAt: entry.updatedAt,
      cacheExpiresAt: new Date(entry.expiresAt).toISOString(),
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
    const settled = await scanMtfMarketBatch({
      markets: marketResult.markets,
      getResult: (symbol) => scanMarketMultiTimeframe(symbol, preset),
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

  const [{ scanLocalMarketMultiTimeframe }, store] = await Promise.all([
    import("@/lib/scanner/scanLocalMarket"),
    createMarketDataStore(),
  ]);

  try {
    const markets = (await store.getMarkets()).slice(
      0,
      maxSymbols ?? MAX_ELIGIBLE_SCAN_SYMBOLS,
    );
    const settled = await scanMtfMarketBatch({
      markets,
      getResult: (symbol) =>
        scanLocalMarketMultiTimeframe({
          store,
          symbol,
          preset,
        }),
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

function logMtfScanDiagnostics(
  payload: MtfScanPayload,
  cached: boolean,
  durationMs: number,
) {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  console.info("mtf scan diagnostics", {
    timeframe: payload.timeframes.join("+"),
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

function getMtfCacheTtl(preset: MtfPreset) {
  return Math.min(
    ...mtfPresetTimeframes[preset].map((timeframe) => cacheTtls.scan[timeframe]),
  );
}

function parseOptionalMaxSymbols(value: string | null) {
  if (value === null || value === "" || value === "ALL") {
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
