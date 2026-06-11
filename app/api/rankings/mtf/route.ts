import { NextResponse } from "next/server";
import pLimit from "p-limit";
import { cacheKeys, cacheTtls } from "@/lib/cache/keys";
import { getCached, setCached } from "@/lib/cache/memory";
import { getEligibleUsdtMarkets } from "@/lib/exchanges/binance";
import {
  mtfPresetTimeframes,
  type MtfPreset,
} from "@/lib/ranking-engine/multiTimeframe";
import {
  isLocalPersistenceDisabled,
  localPersistenceUnavailableMessage,
} from "@/lib/runtime/localPersistence";
import {
  summarizeScanFailures,
  toPublicScanErrorSample,
  type ScanErrorSample,
  type ScanFailureSummary,
} from "@/lib/ranking-engine/diagnostics";
import { scanMarketMultiTimeframe } from "@/lib/ranking-engine/scanMarketMtf";
import { calculateUniversePercentiles, SCORING_VERSION } from "@/lib/ranking-engine/scoring";
import type { ScanResult } from "@/lib/ranking-engine/types";
import {
  serializeScanResultToCodeContract,
  type ScannerCodeContractResult,
} from "@/lib/vegarank-codebook/serializeScanResult";
import { getScannerStorageAdapter } from "@/lib/storage/storageAdapter";

export const runtime = "nodejs";

const MAX_ELIGIBLE_SCAN_SYMBOLS = 600;
const DEFAULT_MTF_BATCH_SIZE = 8;
const MAX_MTF_BATCH_SIZE = 10;
const MTF_SCAN_CONCURRENCY = 2;
const DEFAULT_MAX_LIVE_SYMBOLS = 100;
const SCAN_UNIVERSE = "all-eligible-usdt";
const SUPPORTED_PRESETS = new Set<MtfPreset>([
  "short",
  "swing",
  "position",
  "full",
]);
const SUPPORTED_SOURCES = new Set<ScanSource>(["remote", "local", "cached"]);

type ScanSource = "remote" | "local" | "cached";

type MtfScanPayload = {
  exchange: "binance";
  mode: "mtf";
  preset: MtfPreset;
  timeframes: typeof mtfPresetTimeframes[MtfPreset];
  primaryTimeframe: string;
  confirmationTimeframe: string | null;
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
  requestedAllSymbols?: boolean;
  effectiveMaxSymbols?: number;
  liveSymbolLimit?: number;
  liveSymbolLimitApplied?: boolean;
  truncatedForLiveScan?: boolean;
  capped: boolean;
  concurrency: number;
  durationMs: number;
  cacheTtlSeconds: number;
  cacheExpiresAt: string;
  usesClosedCandles: true;
  lastClosedCandleTime: string | null;
  failureSummary: ScanFailureSummary;
  results: ScannerCodeContractResult[];
  itemCount: number;
  errors?: ScanErrorSample[];
  batchMode?: true;
  cursor?: number;
  nextCursor?: number | null;
  hasMore?: boolean;
  batchSize?: number;
  batchIndex?: number;
  totalBatches?: number;
  totalEligibleCount?: number;
  scannedInBatch?: number;
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
  const batchMode = parseBatchMode(searchParams.get("batchMode"));
  const batchSize = parseBatchSize(searchParams.get("batchSize"));
  const cursor = parseCursor(searchParams.get("cursor"));

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

  if (!cursor.valid) {
    return NextResponse.json({ error: cursor.error }, { status: 400 });
  }

  if (source.value === "cached") {
    return cachedSourceUnavailableResponse();
  }

  if (source.value === "local" && isLocalPersistenceDisabled()) {
    return localPersistenceUnavailableResponse();
  }

  try {
    const ttlMs = getMtfCacheTtl(preset);
    const cacheTtlSeconds = Math.floor(ttlMs / 1000);
    const timeframes = mtfPresetTimeframes[preset];
    const liveLimit = getLiveSymbolLimitMeta({
      source: source.value,
      requestedMaxSymbols: maxSymbols.value,
    });
    const cacheKey = cacheKeys.mtfScan({
      source: source.value,
      preset,
      primaryTimeframe: timeframes[0],
      confirmationTimeframe: timeframes[1],
      universe: SCAN_UNIVERSE,
      maxSymbols: liveLimit.effectiveMaxSymbols,
      minQuoteVolume: minQuoteVolume.value,
      batchMode,
      cursor: batchMode ? cursor.value : undefined,
      batchSize: batchMode ? batchSize : undefined,
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

    const { settled, useLocal, marketStats, batch } = await scanMtfMarkets(
      preset,
      source.value,
      liveLimit.effectiveMaxSymbols,
      minQuoteVolume.value,
      batchMode ? { cursor: cursor.value, batchSize } : null,
    );
    const successful = settled.flatMap((item) => (item.result ? [item.result] : []));
    const results = calculateUniversePercentiles(successful).sort(
      (left, right) => right.rankScore - left.rankScore,
    );
    const publicResults = results.map(serializeScanResultToCodeContract);
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
      timeframes,
      primaryTimeframe: timeframes[0],
      confirmationTimeframe: timeframes[1] ?? null,
      source: useLocal ? "local" : "remote",
      universe: SCAN_UNIVERSE,
      totalUsdtPairs: marketStats.totalUsdtPairs,
      eligibleCount: marketStats.eligibleCount,
      scannedCount: marketStats.scannedCount,
      scannedMarketCount: marketStats.scannedCount,
      skippedCount,
      failedCount: errors.length,
      minQuoteVolume: minQuoteVolume.value,
      maxSymbols: liveLimit.effectiveMaxSymbols,
      requestedAllSymbols: liveLimit.requestedAllSymbols,
      effectiveMaxSymbols: liveLimit.effectiveMaxSymbols ?? undefined,
      liveSymbolLimit: liveLimit.liveSymbolLimit,
      liveSymbolLimitApplied: liveLimit.liveSymbolLimitApplied,
      truncatedForLiveScan: liveLimit.truncatedForLiveScan,
      capped: marketStats.capped,
      concurrency: MTF_SCAN_CONCURRENCY,
      durationMs,
      cacheTtlSeconds,
      cacheExpiresAt: new Date(Date.now() + ttlMs).toISOString(),
      usesClosedCandles: true,
      lastClosedCandleTime: getLatestClosedCandleTime(results),
      failureSummary,
      results: publicResults,
      itemCount: results.length,
      errors:
        errors.length > 0
          ? errors.slice(0, 10).map(toPublicScanErrorSample)
          : undefined,
      ...(batch
        ? {
            batchMode: true,
            cursor: batch.cursor,
            nextCursor: batch.nextCursor,
            hasMore: batch.hasMore,
            batchSize: batch.batchSize,
            batchIndex: batch.batchIndex,
            totalBatches: batch.totalBatches,
            totalEligibleCount: batch.totalEligibleCount,
            scannedInBatch: batch.scannedInBatch,
          }
        : {}),
    };

    if (errors.length > 0 || useLocal) {
      const updatedAt = new Date().toISOString();
      await persistResearchSignals({
        payload,
        results,
        updatedAt,
        source: useLocal ? "local" : "remote",
      });
      logMtfScanDiagnostics(payload, false, durationMs);
      return NextResponse.json({
        ...payload,
        cached: false,
        updatedAt,
      });
    }

    const entry = setCached(cacheKey, payload, ttlMs);
    await persistResearchSignals({
      payload,
      results,
      updatedAt: entry.updatedAt,
      source: "remote",
    });
    logMtfScanDiagnostics(payload, false, durationMs);

    return NextResponse.json({
      ...entry.value,
      cached: false,
      updatedAt: entry.updatedAt,
      cacheExpiresAt: new Date(entry.expiresAt).toISOString(),
    });
  } catch (error) {
    console.error("mtf scan route failed", error);
    return NextResponse.json(
      {
        error: "Failed to scan Binance markets across timeframes.",
        message:
          error instanceof Error ? error.message : "Remote MTF ranking request failed.",
        errorCode: "SCANNER_ROUTE_FAILED",
        details: {
          route: "/api/rankings/mtf",
          source: source.valid ? source.value : undefined,
          preset,
          maxSymbols: maxSymbols.valid ? maxSymbols.value : undefined,
          minQuoteVolume: minQuoteVolume.valid ? minQuoteVolume.value : undefined,
          batchMode,
          cursor: cursor.valid ? cursor.value : undefined,
          batchSize,
          durationMs: Date.now() - startedAt,
        },
      },
      { status: 502 },
    );
  }
}

async function persistResearchSignals({
  payload,
  results,
  updatedAt,
  source,
}: {
  payload: MtfScanPayload;
  results: ScanResult[];
  updatedAt: string;
  source: Exclude<ScanSource, "cached">;
}) {
  if (isLocalPersistenceDisabled()) {
    return;
  }

  const storage = await getScannerStorageAdapter();
  if (storage.mode === "disabled") {
    return;
  }

  try {
    await storage.persistScanResults({
    createdAt: updatedAt,
    timeframe: "mtf",
    source,
    results,
    marketContext: {
      exchange: payload.exchange,
      universe: payload.universe,
      totalSymbols: payload.scannedCount,
      minQuoteVolume: payload.minQuoteVolume,
      maxSymbols: payload.maxSymbols,
      preset: payload.preset,
      timeframes: payload.timeframes,
    },
    metadata: {
      scannerVersion: "scanner-research-v1",
      scoringVersion: SCORING_VERSION,
      batchMode: payload.batchMode ?? false,
      batchIndex: payload.batchIndex,
      totalBatches: payload.totalBatches,
      failureSummary: payload.failureSummary,
    },
  });
  } catch (error) {
    console.warn(
      "Failed to persist MTF research signals:",
      error instanceof Error ? error.message : error,
    );
  } finally {
    await storage.close?.();
  }
}

async function scanMtfMarkets(
  preset: MtfPreset,
  source: ScanSource,
  maxSymbols: number | null,
  minQuoteVolume: number,
  batch: { cursor: number; batchSize: number } | null,
) {
  if (source === "remote") {
    const marketResult = await getEligibleUsdtMarkets({
      maxSymbols,
      minQuoteVolume,
      safetyCap: MAX_ELIGIBLE_SCAN_SYMBOLS,
    });
    const batchMeta = getBatchMeta({
      batch,
      totalEligibleCount: marketResult.eligibleCount,
      availableCount: marketResult.markets.length,
    });
    const markets = batchMeta
      ? marketResult.markets.slice(batchMeta.cursor, batchMeta.nextCursor ?? undefined)
      : marketResult.markets;
    const settled = await scanMtfMarketBatch({
      markets,
      getResult: (symbol) => scanMarketMultiTimeframe(symbol, preset),
    });

    return {
      settled,
      useLocal: false,
      batch: batchMeta
        ? {
            ...batchMeta,
            scannedInBatch: markets.length,
          }
        : null,
      marketStats: {
        totalUsdtPairs: marketResult.totalUsdtPairs,
        eligibleCount: marketResult.eligibleCount,
        scannedCount: markets.length,
        filteredLowVolume: marketResult.filteredLowVolume,
        excludedStableOrLeveraged: marketResult.excludedStableOrLeveraged,
        capped: marketResult.capped,
      },
    };
  }

  const [{ scanLocalMarketMultiTimeframe }, store] = await Promise.all([
    import("@/lib/ranking-engine/scanLocalMarket"),
    createMarketDataStore(),
  ]);

  try {
    const allMarkets = (await store.getMarkets()).slice(
      0,
      maxSymbols ?? MAX_ELIGIBLE_SCAN_SYMBOLS,
    );
    const batchMeta = getBatchMeta({
      batch,
      totalEligibleCount: allMarkets.length,
      availableCount: allMarkets.length,
    });
    const markets = batchMeta
      ? allMarkets.slice(batchMeta.cursor, batchMeta.nextCursor ?? undefined)
      : allMarkets;
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
      batch: batchMeta
        ? {
            ...batchMeta,
            scannedInBatch: markets.length,
          }
        : null,
      marketStats: {
        totalUsdtPairs: allMarkets.length,
        eligibleCount: allMarkets.length,
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

function getBatchMeta({
  batch,
  totalEligibleCount,
  availableCount,
}: {
  batch: { cursor: number; batchSize: number } | null;
  totalEligibleCount: number;
  availableCount: number;
}) {
  if (!batch) {
    return null;
  }

  const totalBatches = Math.max(1, Math.ceil(availableCount / batch.batchSize));
  const nextCursor = Math.min(batch.cursor + batch.batchSize, availableCount);

  return {
    cursor: batch.cursor,
    nextCursor: nextCursor < availableCount ? nextCursor : null,
    hasMore: nextCursor < availableCount,
    batchSize: batch.batchSize,
    batchIndex: Math.min(
      totalBatches,
      Math.floor(batch.cursor / batch.batchSize) + 1,
    ),
    totalBatches,
    totalEligibleCount,
  };
}

function getLatestClosedCandleTime(results: ScanResult[]) {
  const latest = Math.max(
    ...results
      .map((result) => result.dataQuality.lastClosedCandleTime)
      .filter((value): value is number => typeof value === "number"),
  );

  return Number.isFinite(latest) ? new Date(latest).toISOString() : null;
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
      error: "source must be remote, local, or cached.",
    };
  }

  return { valid: true as const, value: source as ScanSource };
}

function cachedSourceUnavailableResponse() {
  return NextResponse.json(
    {
      error: "Cached ranking source is not available.",
      message:
        "source=cached is feature-gated and no latest-rankings JSON reader is configured in this deployment yet.",
      errorCode: "CACHED_SOURCE_UNAVAILABLE",
      source: "cached",
      mode: "mtf",
      results: [],
      itemCount: 0,
      cached: false,
      updatedAt: new Date().toISOString(),
    },
    { status: 501 },
  );
}

function getMtfCacheTtl(preset: MtfPreset) {
  return Math.min(
    ...mtfPresetTimeframes[preset].map((timeframe) => cacheTtls.scan[timeframe]),
  );
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

function parseBatchMode(value: string | null) {
  return value === "true" || value === "1";
}

function parseBatchSize(value: string | null) {
  if (value === null || value === "") {
    return DEFAULT_MTF_BATCH_SIZE;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return DEFAULT_MTF_BATCH_SIZE;
  }

  return Math.min(parsed, MAX_MTF_BATCH_SIZE);
}

function parseCursor(value: string | null) {
  if (value === null || value === "") {
    return { valid: true as const, value: 0 };
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return {
      valid: false as const,
      error: "cursor must be a non-negative integer.",
    };
  }

  return { valid: true as const, value: parsed };
}

function getLiveSymbolLimitMeta({
  source,
  requestedMaxSymbols,
}: {
  source: ScanSource;
  requestedMaxSymbols: number | null;
}) {
  const liveSymbolLimit = getMaxLiveSymbols();
  const requestedAllSymbols = requestedMaxSymbols === null;
  const liveSymbolLimitApplied = source === "remote" && requestedAllSymbols;
  const effectiveMaxSymbols = liveSymbolLimitApplied
    ? liveSymbolLimit
    : requestedMaxSymbols;

  return {
    requestedAllSymbols,
    effectiveMaxSymbols,
    liveSymbolLimit,
    liveSymbolLimitApplied,
    truncatedForLiveScan: liveSymbolLimitApplied,
  };
}

function getMaxLiveSymbols() {
  const parsed = Number(process.env.SCANNER_MAX_LIVE_SYMBOLS);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return DEFAULT_MAX_LIVE_SYMBOLS;
  }

  return Math.min(parsed, MAX_ELIGIBLE_SCAN_SYMBOLS);
}
