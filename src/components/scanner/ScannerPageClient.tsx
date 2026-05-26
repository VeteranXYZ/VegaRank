"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { ScannerFilters, type ScannerSortKey } from "./ScannerFilters";
import { ScannerTable } from "./ScannerTable";
import { SelectedSymbolPanel } from "./SelectedSymbolPanel";
import { scannerSignalOrder } from "@/lib/shared/scannerConfig";
import type { MtfPreset } from "@/lib/shared/scannerConfig";
import type {
  MarketPhase,
  MultiTimeframeAlignment,
  ScannerSignalState,
  ScanResult,
} from "@/lib/shared/scannerTypes";
import type { Timeframe } from "@/lib/shared/timeframes";

type ScanApiResponse = {
  exchange: "binance";
  mode?: "mtf";
  timeframe?: Timeframe;
  preset?: MtfPreset;
  source?: "local" | "remote";
  universe?: string;
  eligibleCount?: number;
  scannedCount?: number;
  skippedCount?: number;
  failedCount?: number;
  minQuoteVolume?: number;
  maxSymbols?: number | null;
  capped?: boolean;
  concurrency?: number;
  durationMs?: number;
  cacheTtlSeconds?: number;
  cacheExpiresAt?: string;
  usesClosedCandles?: boolean;
  lastClosedCandleTime?: string | null;
  failureSummary?: {
    insufficientHistory: number;
    fetchFailed: number;
    indicatorFailed: number;
    subrequestLimitExceeded: number;
    filteredLowVolume: number;
    excludedStableOrLeveraged: number;
  };
  batchMode?: true;
  cursor?: number;
  nextCursor?: number | null;
  hasMore?: boolean;
  batchSize?: number;
  batchIndex?: number;
  totalBatches?: number;
  totalEligibleCount?: number;
  scannedInBatch?: number;
  results: ScanResult[];
  itemCount: number;
  scannedMarketCount?: number;
  displayLimit?: number;
  errors?: { symbol: string; message: string }[];
  cached: boolean;
  updatedAt: string;
};

type BatchProgress = {
  mode: ScannerMode;
  batchIndex: number;
  totalBatches: number;
  scannedCount: number;
  totalEligibleCount: number;
  failedCount: number;
};

type FetchScanOptions = {
  signal?: AbortSignal;
  onBatchProgress?: (progress: BatchProgress | null) => void;
};

export type ScannerMode = "single" | "mtf";
export type ScannerDataSource = "remote" | "local";

export type ScannerFiltersState = {
  mode: ScannerMode;
  source: ScannerDataSource;
  timeframe: Timeframe;
  mtfPreset: MtfPreset;
  signal: ScannerSignalState | "ALL";
  phase: MarketPhase | "ALL";
  minOpportunityScore: number;
  maxRiskScore: number;
  minQuoteVolume: number;
  maxSymbols: 100 | 200 | 400 | 600 | "ALL";
  sortBy: ScannerSortKey;
  limit: 50 | 100 | 200 | "ALL";
};

export const initialScannerFilters: ScannerFiltersState = {
  mode: "single",
  source: "remote",
  timeframe: "4h",
  mtfPreset: "short",
  signal: "ALL",
  phase: "ALL",
  minOpportunityScore: 0,
  maxRiskScore: 100,
  minQuoteVolume: 0,
  maxSymbols: "ALL",
  sortBy: "rankScore",
  limit: 50,
};

export function ScannerPageClient() {
  const { dictionary: t } = useLanguage();
  const [filters, setFilters] =
    useState<ScannerFiltersState>(initialScannerFilters);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
  const scanQuery = useQuery({
    queryKey: [
      "scan",
      filters.mode,
      filters.source,
      filters.timeframe,
      filters.mtfPreset,
      filters.maxSymbols,
      filters.minQuoteVolume,
    ],
    queryFn: ({ signal }) =>
      fetchScan(filters, {
        signal,
        onBatchProgress: setBatchProgress,
      }),
  });
  const filteredRows = useMemo(
    () => filterAndSortResults(scanQuery.data?.results ?? [], filters),
    [scanQuery.data?.results, filters],
  );
  const rows = useMemo(
    () => limitDisplayRows(filteredRows, filters.limit),
    [filteredRows, filters.limit],
  );
  const signalSummary = useMemo(
    () => getSignalSummary(scanQuery.data?.results ?? []),
    [scanQuery.data?.results],
  );
  const alignmentSummary = useMemo(
    () => getAlignmentSummary(scanQuery.data?.results ?? []),
    [scanQuery.data?.results],
  );
  const selectedResult =
    rows.find((row) => row.symbol === selectedSymbol) ?? rows[0] ?? null;

  function updateFilters(nextFilters: ScannerFiltersState) {
    setFilters(normalizeFilters(nextFilters));
    setSelectedSymbol(null);
    setBatchProgress(null);
  }

  function selectSignal(signal: ScannerSignalState | "ALL") {
    updateFilters({ ...filters, signal });
  }

  return (
    <section className="mx-auto flex min-h-[calc(100vh-1px)] max-w-[1800px] flex-col px-3 py-3">
      <div className="mb-2 rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--muted)]">
          <h1 className="mr-1 text-lg font-semibold text-[var(--foreground)]">
            {t.scanner.title}
          </h1>
          <span>· Binance Spot USDT</span>
          <span>· {filters.mode === "mtf" ? t.scanner.mtfMode : t.scanner.singleMode}</span>
          <span>
            ·{" "}
            {filters.mode === "mtf"
              ? t.mtfPreset[filters.mtfPreset]
              : t.timeframe[filters.timeframe]}
          </span>
          <span>
            ·{" "}
            {(scanQuery.data?.source ?? filters.source) === "local"
              ? t.scanner.localSource
              : t.scanner.remoteSource}
          </span>
          <span>
            · {formatInteger(scanQuery.data?.scannedCount)} /{" "}
            {formatInteger(scanQuery.data?.eligibleCount)} {t.scanner.scanned}
          </span>
          <span>
            · {formatInteger(scanQuery.data?.itemCount ?? rows.length)}{" "}
            {t.scanner.results}
          </span>
          <span>
            · {formatInteger(scanQuery.data?.failedCount)}{" "}
            {t.scanner.failedMarkets}
          </span>
          <span>
            · {scanQuery.data?.cached ? t.scanner.cached : t.scanner.live}
          </span>
          <span>· {formatDuration(scanQuery.data?.durationMs)}</span>
          <span>· {t.scanner.nextRefresh} {formatTime(scanQuery.data?.cacheExpiresAt)}</span>
        </div>
        <ScanScopePanel data={scanQuery.data ?? null} progress={batchProgress} />
      </div>

      <div className="grid min-h-0 flex-1 gap-3 xl:h-[calc(100vh-92px)] xl:grid-cols-[260px_minmax(0,1fr)_340px]">
        <ScannerFilters filters={filters} onChange={updateFilters} />
        <div className="min-w-0 space-y-2 xl:flex xl:min-h-0 xl:flex-col">
          <MtfAlignmentSummary items={alignmentSummary} />
          <ScannerTable
            rows={rows}
            signalSummary={signalSummary}
            activeSignal={filters.signal}
            selectedSymbol={selectedResult?.symbol ?? null}
            isLoading={scanQuery.isLoading}
            isFetching={scanQuery.isFetching}
            isError={scanQuery.isError}
            errorMessage={
              scanQuery.error instanceof Error
                ? scanQuery.error.message
                : "Unable to load scanner results."
            }
            cached={scanQuery.data?.cached ?? false}
            updatedAt={scanQuery.data?.updatedAt ?? null}
            sourceItemCount={
              scanQuery.data?.scannedMarketCount ?? scanQuery.data?.itemCount ?? 0
            }
            partialErrors={scanQuery.data?.errors ?? []}
            onRefresh={() => void scanQuery.refetch()}
            onSignalSelect={selectSignal}
            onSelect={setSelectedSymbol}
          />
        </div>
        <SelectedSymbolPanel result={selectedResult} />
      </div>
    </section>
  );
}

export function ScanScopePanel({
  data,
  progress,
}: {
  data: ScanApiResponse | null;
  progress?: BatchProgress | null;
}) {
  const { dictionary: t } = useLanguage();

  return (
    <div className="mt-1 border-t border-[var(--border)] pt-1.5">
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] leading-5 text-[var(--muted)]">
        <span>{t.scanner.marketUniverse}: {t.scanner.allEligible}</span>
        <span>{t.scanner.cachePolicyNote}</span>
        <span>{t.scanner.cloudflareBatchNote}</span>
      </div>

      {data?.capped && (
        <div className="mt-1 rounded border border-[var(--warning)]/50 bg-[#2b2111]/70 px-2 py-1 text-[11px] font-semibold text-[var(--warning)]">
          {t.scanner.cappedWarning}
        </div>
      )}

      {progress && (
        <div className="mt-1 rounded border border-[var(--border)] bg-[#0b0f14] px-2 py-1 text-[11px] text-[var(--muted)]">
          <span className="font-semibold text-[var(--foreground)]">
            {progress.mode === "mtf"
              ? t.scanner.scanningMtfBatch
              : t.scanner.scanningBatch}{" "}
            {progress.batchIndex} /{" "}
            {progress.totalBatches}
          </span>
          <span className="ml-2">
            {t.scanner.scanned}: {formatInteger(progress.scannedCount)} /{" "}
            {formatInteger(progress.totalEligibleCount)}
          </span>
          <span className="ml-2">
            {t.scanner.failedMarkets}: {formatInteger(progress.failedCount)}
          </span>
        </div>
      )}

      {data?.failureSummary && (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--muted)]">
          <span>
            {t.scanner.insufficientHistory}:{" "}
            {formatInteger(data.failureSummary.insufficientHistory)}
          </span>
          <span>
            {t.scanner.fetchFailed}: {formatInteger(data.failureSummary.fetchFailed)}
          </span>
          <span>
            {t.scanner.indicatorFailed}:{" "}
            {formatInteger(data.failureSummary.indicatorFailed)}
          </span>
          <span>
            {t.scanner.subrequestLimitExceeded}:{" "}
            {formatInteger(data.failureSummary.subrequestLimitExceeded)}
          </span>
          <span>
            {t.scanner.filteredLowVolume}:{" "}
            {formatInteger(data.failureSummary.filteredLowVolume)}
          </span>
          <span>
            {t.scanner.excludedStableOrLeveraged}:{" "}
            {formatInteger(data.failureSummary.excludedStableOrLeveraged)}
          </span>
        </div>
      )}
    </div>
  );
}

function MtfAlignmentSummary({
  items,
}: {
  items: Array<{ alignment: MultiTimeframeAlignment; count: number }>;
}) {
  const { dictionary: t } = useLanguage();
  const total = items.reduce((sum, item) => sum + item.count, 0);

  return (
    <section className="rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-2">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          {t.scanner.mtfAlignmentSummary}
        </h2>
        <span className="text-xs text-[var(--muted)]">
          {total > 0 ? `${total} ${t.scanner.scanned}` : t.scanner.noMtfAlignment}
        </span>
      </div>
      {total > 0 ? (
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-5">
          {items.map((item) => (
            <div
              key={item.alignment}
              className="rounded border border-[var(--border)] bg-[#0b0f14]/80 px-2 py-1.5"
            >
              <div className="truncate text-xs text-[var(--muted)]">
                {t.alignment[item.alignment]}
              </div>
              <div className="mt-0.5 text-sm font-semibold tabular-nums">
                {item.count}
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-[#111820]">
                <div
                  className="h-full rounded-full bg-[var(--accent)]"
                  style={{ width: `${(item.count / total) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

async function fetchScan(
  filters: ScannerFiltersState,
  options: FetchScanOptions = {},
) {
  options.onBatchProgress?.(null);

  if (filters.mode === "mtf") {
    return fetchMtfScan(filters, options);
  }

  return fetchSingleTimeframeScan(filters, options);
}

export async function fetchSingleTimeframeScan(
  filters: ScannerFiltersState,
  options: FetchScanOptions = {},
) {
  if (shouldUseBatchedScan(filters)) {
    return fetchBatchedSingleTimeframeScan(filters, options);
  }

  const params = new URLSearchParams({
    timeframe: filters.timeframe,
    source: filters.source,
    minQuoteVolume: String(filters.minQuoteVolume),
  });
  const maxSymbols = getApiMaxSymbols(filters);

  if (maxSymbols !== null) {
    params.set("maxSymbols", String(maxSymbols));
  }

  const response = await fetch(`/api/scan?${params.toString()}`, {
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(
      await getScannerErrorMessage({
        response,
        fallback: "Scanner request failed.",
        subrequestMessage:
          "Cloudflare Free subrequest limit reached. Try a smaller batch size.",
      }),
    );
  }

  return (await response.json()) as ScanApiResponse;
}

async function fetchBatchedSingleTimeframeScan(
  filters: ScannerFiltersState,
  options: FetchScanOptions,
) {
  const batchSize = 35;
  let cursor = 0;
  let response: ScanApiResponse | null = null;
  const responses: ScanApiResponse[] = [];

  try {
    do {
      const params = new URLSearchParams({
        timeframe: filters.timeframe,
        source: filters.source,
        minQuoteVolume: String(filters.minQuoteVolume),
        batchMode: "true",
        batchSize: String(batchSize),
        cursor: String(cursor),
      });
      const batchResponse = await fetch(`/api/scan?${params.toString()}`, {
        signal: options.signal,
      });

      if (!batchResponse.ok) {
        throw new Error(
          await getScannerErrorMessage({
            response: batchResponse,
            fallback: "Scanner batch request failed.",
            subrequestMessage:
              "Cloudflare Free subrequest limit reached. Try a smaller batch size.",
          }),
        );
      }

      response = (await batchResponse.json()) as ScanApiResponse;
      responses.push(response);
      options.onBatchProgress?.({
        mode: "single",
        batchIndex: response.batchIndex ?? responses.length,
        totalBatches: response.totalBatches ?? responses.length,
        scannedCount: responses.reduce(
          (sum, item) => sum + (item.scannedInBatch ?? item.scannedCount ?? 0),
          0,
        ),
        totalEligibleCount:
          response.totalEligibleCount ?? response.eligibleCount ?? response.itemCount,
        failedCount: responses.reduce((sum, item) => sum + (item.failedCount ?? 0), 0),
      });
      cursor = response.nextCursor ?? 0;
    } while (response.hasMore && response.nextCursor !== null);

    return mergeBatchScanResponses(responses);
  } finally {
    options.onBatchProgress?.(null);
  }
}

async function fetchMtfScan(
  filters: ScannerFiltersState,
  options: FetchScanOptions = {},
) {
  if (shouldUseBatchedMtfScan(filters)) {
    return fetchBatchedMtfScan(filters, options);
  }

  const params = new URLSearchParams({
    preset: filters.mtfPreset,
    source: filters.source,
    minQuoteVolume: String(filters.minQuoteVolume),
  });
  const maxSymbols = getApiMaxSymbols(filters);

  if (maxSymbols !== null) {
    params.set("maxSymbols", String(maxSymbols));
  }

  const response = await fetch(`/api/scan/mtf?${params.toString()}`, {
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(
      await getScannerErrorMessage({
        response,
        fallback: "MTF scanner request failed.",
        subrequestMessage:
          "Cloudflare Free subrequest limit reached. Try a smaller MTF batch size.",
      }),
    );
  }

  return (await response.json()) as ScanApiResponse;
}

async function fetchBatchedMtfScan(
  filters: ScannerFiltersState,
  options: FetchScanOptions,
) {
  const batchSize = 15;
  let cursor = 0;
  let response: ScanApiResponse | null = null;
  const responses: ScanApiResponse[] = [];

  try {
    do {
      const params = new URLSearchParams({
        preset: filters.mtfPreset,
        source: filters.source,
        minQuoteVolume: String(filters.minQuoteVolume),
        batchMode: "true",
        batchSize: String(batchSize),
        cursor: String(cursor),
      });
      const batchResponse = await fetch(`/api/scan/mtf?${params.toString()}`, {
        signal: options.signal,
      });

      if (!batchResponse.ok) {
        throw new Error(
          await getScannerErrorMessage({
            response: batchResponse,
            fallback: "MTF scanner batch request failed.",
            subrequestMessage:
              "Cloudflare Free subrequest limit reached. Try a smaller MTF batch size.",
          }),
        );
      }

      response = (await batchResponse.json()) as ScanApiResponse;
      responses.push(response);
      options.onBatchProgress?.({
        mode: "mtf",
        batchIndex: response.batchIndex ?? responses.length,
        totalBatches: response.totalBatches ?? responses.length,
        scannedCount: responses.reduce(
          (sum, item) => sum + (item.scannedInBatch ?? item.scannedCount ?? 0),
          0,
        ),
        totalEligibleCount:
          response.totalEligibleCount ?? response.eligibleCount ?? response.itemCount,
        failedCount: responses.reduce((sum, item) => sum + (item.failedCount ?? 0), 0),
      });
      cursor = response.nextCursor ?? 0;
    } while (response.hasMore && response.nextCursor !== null);

    return mergeBatchScanResponses(responses);
  } finally {
    options.onBatchProgress?.(null);
  }
}

export function shouldUseBatchedScan(filters: ScannerFiltersState) {
  return (
    filters.mode === "single" &&
    filters.source === "remote" &&
    filters.maxSymbols === "ALL"
  );
}

export function shouldUseBatchedMtfScan(filters: ScannerFiltersState) {
  return (
    filters.mode === "mtf" &&
    filters.source === "remote" &&
    filters.maxSymbols === "ALL"
  );
}

export function mergeBatchScanResponses(responses: ScanApiResponse[]) {
  if (responses.length === 0) {
    throw new Error("No scanner batches returned.");
  }

  const [first] = responses;
  const resultMap = new Map<string, ScanResult>();
  const isMtf = first.mode === "mtf";

  for (const response of responses) {
    for (const result of response.results) {
      resultMap.set(
        isMtf
          ? `${result.exchange}:${result.symbol}`
          : `${result.exchange}:${result.symbol}:${result.timeframe}`,
        result,
      );
    }
  }

  const results = Array.from(resultMap.values()).sort(
    (left, right) => right.rankScore - left.rankScore,
  );
  const failedCount = responses.reduce(
    (sum, response) => sum + (response.failedCount ?? 0),
    0,
  );
  const scannedCount = responses.reduce(
    (sum, response) =>
      sum + (response.scannedInBatch ?? response.scannedCount ?? 0),
    0,
  );

  return {
    ...first,
    batchMode: true as const,
    hasMore: false,
    nextCursor: null,
    batchIndex: responses.at(-1)?.batchIndex,
    totalBatches: responses.at(-1)?.totalBatches,
    totalEligibleCount:
      responses.at(-1)?.totalEligibleCount ??
      first.totalEligibleCount ??
      first.eligibleCount,
    scannedInBatch: responses.at(-1)?.scannedInBatch,
    cached: responses.every((response) => response.cached),
    durationMs: responses.reduce(
      (sum, response) => sum + (response.durationMs ?? 0),
      0,
    ),
    scannedCount,
    scannedMarketCount: scannedCount,
    failedCount,
    skippedCount: responses.reduce(
      (sum, response) => sum + (response.skippedCount ?? 0),
      0,
    ),
    failureSummary: mergeFailureSummaries(responses),
    errors: responses.flatMap((response) => response.errors ?? []).slice(0, 10),
    results,
    itemCount: results.length,
    updatedAt: responses.at(-1)?.updatedAt ?? first.updatedAt,
    cacheExpiresAt: responses.at(-1)?.cacheExpiresAt ?? first.cacheExpiresAt,
    lastClosedCandleTime: getLatestIsoTime(
      responses.map((response) => response.lastClosedCandleTime),
    ),
  } satisfies ScanApiResponse;
}

function mergeFailureSummaries(responses: ScanApiResponse[]) {
  return responses.reduce(
    (summary, response) => ({
      insufficientHistory:
        summary.insufficientHistory +
        (response.failureSummary?.insufficientHistory ?? 0),
      fetchFailed: summary.fetchFailed + (response.failureSummary?.fetchFailed ?? 0),
      indicatorFailed:
        summary.indicatorFailed + (response.failureSummary?.indicatorFailed ?? 0),
      subrequestLimitExceeded:
        summary.subrequestLimitExceeded +
        (response.failureSummary?.subrequestLimitExceeded ?? 0),
      filteredLowVolume: response.failureSummary?.filteredLowVolume ?? 0,
      excludedStableOrLeveraged:
        response.failureSummary?.excludedStableOrLeveraged ?? 0,
    }),
    {
      insufficientHistory: 0,
      fetchFailed: 0,
      indicatorFailed: 0,
      subrequestLimitExceeded: 0,
      filteredLowVolume: 0,
      excludedStableOrLeveraged: 0,
    },
  );
}

async function getScannerErrorMessage({
  response,
  fallback,
  subrequestMessage,
}: {
  response: Response;
  fallback: string;
  subrequestMessage: string;
}) {
  const errorBody = (await response.json().catch(() => null)) as
    | { error?: string; message?: string }
    | null;
  const message = errorBody?.message ?? errorBody?.error ?? fallback;

  if (/too many subrequests|subrequests|single worker invocation/i.test(message)) {
    return subrequestMessage;
  }

  return message;
}

function normalizeFilters(filters: ScannerFiltersState): ScannerFiltersState {
  return filters;
}

function getApiMaxSymbols(filters: ScannerFiltersState) {
  return filters.maxSymbols === "ALL" ? null : filters.maxSymbols;
}

function limitDisplayRows(
  rows: ScanResult[],
  displayLimit: ScannerFiltersState["limit"],
) {
  if (displayLimit === "ALL") {
    return rows;
  }

  return rows.slice(0, displayLimit);
}

function formatInteger(value: number | undefined) {
  return value === undefined ? "0" : new Intl.NumberFormat().format(value);
}

function formatDuration(value: number | undefined) {
  if (value === undefined) {
    return "0 ms";
  }

  if (value < 1000) {
    return `${value} ms`;
  }

  return `${(value / 1000).toFixed(1)} s`;
}

function formatTime(value: string | undefined) {
  if (!value) {
    return "--";
  }

  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getLatestIsoTime(values: Array<string | null | undefined>) {
  const latest = Math.max(
    ...values
      .map((value) => (value ? Date.parse(value) : Number.NaN))
      .filter(Number.isFinite),
  );

  return Number.isFinite(latest) ? new Date(latest).toISOString() : null;
}

export function getSignalSummary(results: ScanResult[]) {
  const counts = new Map<ScannerSignalState, number>(
    scannerSignalOrder.map((signal) => [signal, 0]),
  );

  for (const result of results) {
    counts.set(result.signal.state, (counts.get(result.signal.state) ?? 0) + 1);
  }

  return [
    { signal: "ALL" as const, count: results.length },
    ...scannerSignalOrder.map((signal) => ({
      signal,
      count: counts.get(signal) ?? 0,
    })),
  ];
}

export function getAlignmentSummary(results: ScanResult[]) {
  const counts = new Map<MultiTimeframeAlignment, number>();

  for (const result of results) {
    const alignment = result.multiTimeframe?.alignment;
    if (alignment) {
      counts.set(alignment, (counts.get(alignment) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([alignment, count]) => ({ alignment, count }))
    .sort((left, right) => right.count - left.count);
}

export function filterAndSortResults(
  results: ScanResult[],
  filters: ScannerFiltersState,
) {
  const filtered = results.filter((result) => {
    return (
      (filters.signal === "ALL" || result.signal.state === filters.signal) &&
      (filters.phase === "ALL" || result.phase === filters.phase) &&
      result.opportunityScore >= filters.minOpportunityScore &&
      result.riskScore <= filters.maxRiskScore
    );
  });

  return filtered.sort((left, right) => {
    switch (filters.sortBy) {
      case "opportunityScore":
        return right.opportunityScore - left.opportunityScore;
      case "confirmationScore":
        return right.confirmationScore - left.confirmationScore;
      case "lowestRiskScore":
        return left.riskScore - right.riskScore;
      case "rankScore":
      default:
        return right.rankScore - left.rankScore;
    }
  });
}
