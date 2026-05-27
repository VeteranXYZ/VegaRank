"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { ScannerFilters, type ScannerSortKey } from "./ScannerFilters";
import { ScannerTable } from "./ScannerTable";
import { SelectedSymbolPanel } from "./SelectedSymbolPanel";
import { isLocalSourceEnabledInUi, SCANNER_BUILD_MARKER } from "./sourceUi";
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
  requestedAllSymbols?: boolean;
  effectiveMaxSymbols?: number;
  liveSymbolLimit?: number;
  liveSymbolLimitApplied?: boolean;
  truncatedForLiveScan?: boolean;
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
  batchWarnings?: Array<{
    code: string;
    message: string;
    cursor?: number;
  }>;
  cached: boolean;
  updatedAt: string;
};

type ResearchBucket = {
  count: number;
  completedCount: number;
  pendingCount: number;
  avgReturnPct: number | null;
  avgMaxDrawdownPct: number | null;
  favorableRate: number | null;
  unfavorableRate: number | null;
};

type ResearchEvaluationResponse = {
  storageMode: "jsonl" | "sqlite" | "disabled";
  horizon: "24h";
  itemCount: number;
  signalsCount: number;
  summary: {
    evaluationCount: number;
    completedCount: number;
    pendingCount: number;
    insufficientDataCount?: number;
    latestEvaluationTime?: string | null;
    bySignalLabel: Record<string, ResearchBucket>;
    byRiskType: Record<string, ResearchBucket>;
  };
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
export type TableSortKey =
  | "rank"
  | "symbol"
  | "phase"
  | "signal"
  | "score"
  | "ocr"
  | "rsi"
  | "bb"
  | "vol"
  | "macd"
  | "ma"
  | "warnings";
export type TableSortDirection = "asc" | "desc";
export type TableSortState = {
  key: TableSortKey;
  direction: TableSortDirection;
};

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
  maxSymbols: 100,
  sortBy: "rankScore",
  limit: 50,
};

export function ScannerPageClient() {
  const { dictionary: t } = useLanguage();
  const [filters, setFilters] =
    useState<ScannerFiltersState>(initialScannerFilters);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
  const [tableSort, setTableSort] = useState<TableSortState | null>(null);
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
    () => filterAndSortResults(scanQuery.data?.results ?? [], filters, tableSort),
    [scanQuery.data?.results, filters, tableSort],
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
  const researchQuery = useQuery({
    queryKey: ["scanner-research-evaluation", "24h"],
    queryFn: fetchResearchEvaluation,
    retry: false,
  });
  const selectedResult =
    rows.find((row) => row.symbol === selectedSymbol) ?? rows[0] ?? null;

  function updateFilters(nextFilters: ScannerFiltersState) {
    setFilters(normalizeFilters(nextFilters));
    setSelectedSymbol(null);
    setBatchProgress(null);
    setTableSort(null);
  }

  function selectSignal(signal: ScannerSignalState | "ALL") {
    updateFilters({ ...filters, signal });
  }

  function updateTableSort(key: TableSortKey) {
    setTableSort((current) => getNextColumnSort(current, key));
  }

  return (
    <section className="mx-auto flex min-h-[calc(100vh-1px)] max-w-[1800px] flex-col px-2 py-2">
      <div className="mb-1.5 border border-[var(--border)] bg-[#070b0f] px-2.5 py-1.5 font-mono shadow-[inset_3px_0_0_rgba(96,165,250,0.35)]">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] leading-5 text-[var(--muted)]">
          <h1 className="mr-1 text-sm font-semibold text-[var(--foreground)]">
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
            {formatInteger(scanQuery.data?.eligibleCount)}
          </span>
          <span>
            · {formatInteger(scanQuery.data?.itemCount ?? rows.length)}{" "}
            {t.scanner.resultsCompact}
          </span>
          <span>
            · {formatInteger(scanQuery.data?.failedCount)}{" "}
            {t.scanner.failedMarkets}
          </span>
          <span>
            · {scanQuery.data?.cached ? t.scanner.cached : t.scanner.live}
          </span>
          <span>· {formatDuration(scanQuery.data?.durationMs)}</span>
          <span>· {t.scanner.nextCompact} {formatTime(scanQuery.data?.cacheExpiresAt)}</span>
          <span className="text-[var(--muted-2)]">· {SCANNER_BUILD_MARKER}</span>
        </div>
        <ScanScopePanel data={scanQuery.data ?? null} progress={batchProgress} />
      </div>

      <div className="grid min-h-0 flex-1 gap-2 xl:h-[calc(100vh-72px)] xl:grid-cols-[252px_minmax(0,1fr)_330px]">
        <ScannerFilters filters={filters} onChange={updateFilters} />
        <div className="min-w-0 space-y-1.5 xl:flex xl:min-h-0 xl:flex-col">
          <MtfAlignmentSummary items={alignmentSummary} />
          <ResearchEvaluationPanel
            data={researchQuery.data ?? null}
            isLoading={researchQuery.isLoading || researchQuery.isFetching}
            isError={researchQuery.isError}
            onRefresh={() => void researchQuery.refetch()}
          />
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
            tableSort={tableSort}
            onRefresh={() => void scanQuery.refetch()}
            onSignalSelect={selectSignal}
            onSelect={setSelectedSymbol}
            onSortChange={updateTableSort}
          />
        </div>
        <SelectedSymbolPanel result={selectedResult} />
      </div>
    </section>
  );
}

function ResearchEvaluationPanel({
  data,
  isLoading,
  isError,
  onRefresh,
}: {
  data: ResearchEvaluationResponse | null;
  isLoading: boolean;
  isError: boolean;
  onRefresh: () => void;
}) {
  const enoughData = data !== null && data.summary.completedCount > 0;
  const confirmed = data?.summary.bySignalLabel.confirmed;
  const overheated = data?.summary.bySignalLabel.overheated;
  const distribution = data?.summary.bySignalLabel.distribution_risk;
  const weakBounce = data?.summary.bySignalLabel.weak_bounce;
  const topLabel = getTopLabel(data?.summary.bySignalLabel, "best");
  const worstRiskType = getTopLabel(data?.summary.byRiskType, "worst");
  const storageLabel = data ? formatStorageMode(data.storageMode) : "n/a";

  return (
    <section className="border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h2 className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          Research / Evaluation
        </h2>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="h-6 border border-[var(--border)] px-2 text-[10px] font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Evaluating" : "Refresh"}
        </button>
      </div>
      {isError || !enoughData ? (
        <div className="flex flex-wrap gap-2 text-[11px] text-[var(--muted)]">
          <span>Storage: {storageLabel}</span>
          <span>Not enough evaluated data yet.</span>
        </div>
      ) : (
        <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          <ResearchMetric
            label="Storage"
            value={storageLabel}
          />
          <ResearchMetric
            label="Recorded"
            value={String(data.signalsCount)}
          />
          <ResearchMetric
            label="Evaluated"
            value={String(data.summary.completedCount)}
          />
          <ResearchMetric
            label="Pending"
            value={String(data.summary.pendingCount)}
          />
          <ResearchMetric
            label="Insufficient"
            value={String(data.summary.insufficientDataCount ?? 0)}
          />
          <ResearchMetric
            label="Latest Eval"
            value={formatShortDateTime(data.summary.latestEvaluationTime)}
          />
          <ResearchMetric
            label="Scoring"
            value="explainable-v1"
          />
          <ResearchMetric
            label="Confirmed 24h Avg"
            value={formatSignedPercent(confirmed?.avgReturnPct)}
          />
          <ResearchMetric
            label="Overheated DD"
            value={formatSignedPercent(overheated?.avgMaxDrawdownPct)}
          />
          <ResearchMetric
            label="Distribution Unfav"
            value={formatPercentRatio(distribution?.unfavorableRate)}
          />
          <ResearchMetric
            label="Weak Bounce MA50"
            value={formatPercentRatio(weakBounce?.unfavorableRate)}
          />
          <ResearchMetric label="Top Label" value={topLabel} />
          <ResearchMetric label="Worst Risk" value={worstRiskType} />
        </div>
      )}
    </section>
  );
}

function ResearchMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[var(--border)] bg-[#0b0f14]/60 px-1.5 py-1">
      <div className="truncate text-[10px] text-[var(--muted)]">{label}</div>
      <div className="mt-0.5 truncate text-xs font-semibold tabular-nums">
        {value}
      </div>
    </div>
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
    <div className="mt-1 border-t border-[var(--border)] pt-1">
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] leading-4 text-[var(--muted-2)]">
        <span>{t.scanner.scopeCompact} {t.scanner.allEligible}</span>
        <span>
          {t.scanner.historyCompact}{" "}
          {formatInteger(data?.failureSummary?.insufficientHistory)}
        </span>
        <span>
          {t.scanner.fetchCompact} {formatInteger(data?.failureSummary?.fetchFailed)}
        </span>
        <span>
          {t.scanner.indicatorCompact}{" "}
          {formatInteger(data?.failureSummary?.indicatorFailed)}
        </span>
        <span>
          {t.scanner.subrequestCompact}{" "}
          {formatInteger(data?.failureSummary?.subrequestLimitExceeded)}
        </span>
        <span>
          {t.scanner.lowVolumeCompact}{" "}
          {formatInteger(data?.failureSummary?.filteredLowVolume)}
        </span>
        <span>
          {t.scanner.excludedCompact}{" "}
          {formatInteger(data?.failureSummary?.excludedStableOrLeveraged)}
        </span>
        <details className="inline-block">
          <summary className="cursor-pointer list-none text-[var(--info)]">
            {t.scanner.notes}
          </summary>
          <div className="mt-1 max-w-3xl whitespace-normal text-[10px] leading-4 text-[var(--muted)]">
            {t.scanner.cachePolicyNote} {t.scanner.cloudflareBatchNote}
          </div>
        </details>
      </div>

      {data?.capped && (
        <div className="mt-1 border border-[var(--warning)]/40 bg-[#1b1710] px-2 py-0.5 text-[10px] font-semibold text-[var(--warning)]">
          {t.scanner.cappedWarning}
        </div>
      )}

      {data?.liveSymbolLimitApplied && (
        <div className="mt-1 border border-[var(--warning)]/40 bg-[#1b1710] px-2 py-0.5 text-[10px] font-semibold text-[var(--warning)]">
          Live scan limited to top {formatInteger(data.liveSymbolLimit)} symbols for
          Cloudflare stability.
        </div>
      )}

      {data?.batchWarnings && data.batchWarnings.length > 0 && (
        <div className="mt-1 border border-[var(--warning)]/40 bg-[#1b1710] px-2 py-0.5 text-[10px] font-semibold text-[var(--warning)]">
          Some later batches failed. Showing partial results from completed batches.
        </div>
      )}

      {progress && (
        <div className="mt-0.5 border border-[var(--border)] bg-[#0b0f14] px-2 py-0.5 text-[10px] text-[var(--muted)]">
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
    <section className="border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          {t.scanner.mtfAlignmentSummary}
        </h2>
        <span className="text-[11px] text-[var(--muted)]">
          {total > 0 ? `${total} ${t.scanner.scanned}` : t.scanner.noMtfAlignment}
        </span>
      </div>
      {total > 0 ? (
        <div className="mt-1.5 grid gap-1 sm:grid-cols-2 lg:grid-cols-5">
          {items.map((item) => (
            <div
              key={item.alignment}
              className="border border-[var(--border)] bg-[#0b0f14]/60 px-1.5 py-1"
            >
              <div className="truncate text-[10px] text-[var(--muted)]">
                {t.alignment[item.alignment]}
              </div>
              <div className="mt-0.5 text-xs font-semibold tabular-nums">
                {item.count}
              </div>
              <div className="mt-1 h-0.5 overflow-hidden bg-[#111820]">
                <div
                  className="h-full bg-[var(--accent)]"
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

async function fetchResearchEvaluation() {
  const response = await fetch("/api/history/evaluate?horizon=24h&limit=500");

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as ResearchEvaluationResponse;
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

export async function fetchBatchedSingleTimeframeScan(
  filters: ScannerFiltersState,
  options: FetchScanOptions,
) {
  const batchSize = 20;
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
      let batchResponse: Response;

      try {
        batchResponse = await fetch(`/api/scan?${params.toString()}`, {
          signal: options.signal,
        });
      } catch (error) {
        if (isAbortError(error) || responses.length === 0) {
          throw error;
        }

        return mergeBatchScanResponses(responses, [
          {
            code: "BATCH_REQUEST_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Scanner batch request failed.",
            cursor,
          },
        ]);
      }

      if (!batchResponse.ok) {
        const message = await getScannerErrorMessage({
          response: batchResponse,
          fallback: "Scanner batch request failed.",
          subrequestMessage:
            "Cloudflare Free subrequest limit reached. Try a smaller batch size.",
        });

        if (responses.length === 0) {
          throw new Error(message);
        }

        return mergeBatchScanResponses(responses, [
          {
            code: "BATCH_REQUEST_FAILED",
            message,
            cursor,
          },
        ]);
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

export async function fetchBatchedMtfScan(
  filters: ScannerFiltersState,
  options: FetchScanOptions,
) {
  const batchSize = 8;
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
      let batchResponse: Response;

      try {
        batchResponse = await fetch(`/api/scan/mtf?${params.toString()}`, {
          signal: options.signal,
        });
      } catch (error) {
        if (isAbortError(error) || responses.length === 0) {
          throw error;
        }

        return mergeBatchScanResponses(responses, [
          {
            code: "BATCH_REQUEST_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "MTF scanner batch request failed.",
            cursor,
          },
        ]);
      }

      if (!batchResponse.ok) {
        const message = await getScannerErrorMessage({
          response: batchResponse,
          fallback: "MTF scanner batch request failed.",
          subrequestMessage:
            "Cloudflare Free subrequest limit reached. Try a smaller MTF batch size.",
        });

        if (responses.length === 0) {
          throw new Error(message);
        }

        return mergeBatchScanResponses(responses, [
          {
            code: "BATCH_REQUEST_FAILED",
            message,
            cursor,
          },
        ]);
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

export function mergeBatchScanResponses(
  responses: ScanApiResponse[],
  batchWarnings: ScanApiResponse["batchWarnings"] = [],
) {
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
    batchWarnings: [
      ...responses.flatMap((response) => response.batchWarnings ?? []),
      ...batchWarnings,
    ],
    results,
    itemCount: results.length,
    updatedAt: responses.at(-1)?.updatedAt ?? first.updatedAt,
    cacheExpiresAt: responses.at(-1)?.cacheExpiresAt ?? first.cacheExpiresAt,
    lastClosedCandleTime: getLatestIsoTime(
      responses.map((response) => response.lastClosedCandleTime),
    ),
  } satisfies ScanApiResponse;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
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
  if (isLocalSourceEnabledInUi()) {
    return filters;
  }

  return { ...filters, source: "remote" };
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

function formatSignedPercent(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "n/a";
  }

  const formatted = `${value.toFixed(2)}%`;
  return value > 0 ? `+${formatted}` : formatted;
}

function formatPercentRatio(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "n/a";
  }

  return `${(value * 100).toFixed(1)}%`;
}

function getTopLabel(
  buckets: Record<string, ResearchBucket> | undefined,
  mode: "best" | "worst",
) {
  const rows = Object.entries(buckets ?? {}).filter(
    ([, bucket]) => bucket.completedCount > 0 && bucket.avgReturnPct !== null,
  );

  if (rows.length === 0) {
    return "n/a";
  }

  rows.sort((left, right) =>
    mode === "best"
      ? (right[1].avgReturnPct ?? 0) - (left[1].avgReturnPct ?? 0)
      : (left[1].avgReturnPct ?? 0) - (right[1].avgReturnPct ?? 0),
  );

  return rows[0][0];
}

function formatStorageMode(mode: ResearchEvaluationResponse["storageMode"]) {
  switch (mode) {
    case "sqlite":
      return "SQLite";
    case "jsonl":
      return "JSONL";
    case "disabled":
      return "Disabled";
  }
}

function formatShortDateTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : "n/a";
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
  tableSort: TableSortState | null = null,
) {
  const filtered = results.filter((result) => {
    return (
      (filters.signal === "ALL" || result.signal.state === filters.signal) &&
      (filters.phase === "ALL" || result.phase === filters.phase) &&
      result.opportunityScore >= filters.minOpportunityScore &&
      result.riskScore <= filters.maxRiskScore
    );
  });

  if (tableSort) {
    return sortResultsByColumn(filtered, tableSort);
  }

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

export function getNextColumnSort(
  current: TableSortState | null,
  key: TableSortKey,
): TableSortState | null {
  if (!current || current.key !== key) {
    return { key, direction: getDefaultColumnSortDirection(key) };
  }

  if (current.direction === "desc") {
    return { key, direction: "asc" };
  }

  return null;
}

export function sortResultsByColumn(
  results: ScanResult[],
  tableSort: TableSortState,
) {
  return [...results].sort((left, right) => {
    const primary = compareColumnValue(left, right, tableSort);

    if (primary !== 0) {
      return primary;
    }

    return right.rankScore - left.rankScore;
  });
}

function compareColumnValue(
  left: ScanResult,
  right: ScanResult,
  tableSort: TableSortState,
) {
  const direction = tableSort.direction === "asc" ? 1 : -1;

  switch (tableSort.key) {
    case "symbol":
      return direction * left.symbol.localeCompare(right.symbol);
    case "phase":
      return direction * (getPhaseSortValue(left.phase) - getPhaseSortValue(right.phase));
    case "signal":
      return (
        direction *
        (getSignalSortValue(left.signal.state) -
          getSignalSortValue(right.signal.state))
      );
    case "score":
    case "rank":
      return direction * (left.rankScore - right.rankScore);
    case "ocr":
      return direction * (left.opportunityScore - right.opportunityScore);
    case "rsi":
      return direction * (nullableNumber(left.rsi14) - nullableNumber(right.rsi14));
    case "bb":
      return (
        direction *
        (nullableNumber(left.bbWidthPercentile) -
          nullableNumber(right.bbWidthPercentile))
      );
    case "vol":
      return (
        direction *
        (nullableNumber(left.volume.ratio20) - nullableNumber(right.volume.ratio20))
      );
    case "macd":
      return direction * (getMacdSortValue(left) - getMacdSortValue(right));
    case "ma":
      return direction * (getMaSortValue(left) - getMaSortValue(right));
    case "warnings":
      return direction * (left.warnings.length - right.warnings.length);
  }
}

function getDefaultColumnSortDirection(key: TableSortKey): TableSortDirection {
  return key === "symbol" ? "asc" : "desc";
}

function getPhaseSortValue(phase: MarketPhase) {
  const values: Record<MarketPhase, number> = {
    BREAKOUT_CONFIRMED: 9,
    BREAKOUT_ATTEMPT: 8,
    TRENDING: 7,
    PULLBACK_HEALTHY: 6,
    SQUEEZE: 5,
    BASE_BUILDING: 4,
    DISTRIBUTION: 3,
    OVEREXTENDED: 2,
    BREAKDOWN: 1,
  };

  return values[phase] ?? 0;
}

function getSignalSortValue(signal: ScannerSignalState) {
  const values: Record<ScannerSignalState, number> = {
    CONFIRMED: 6,
    TREND_CONTINUATION: 5,
    WATCHLIST: 4,
    NEUTRAL: 3,
    HIGH_RISK: 2,
    WEAK: 1,
  };

  return values[signal] ?? 0;
}

function getMacdSortValue(result: ScanResult) {
  if (!result.macd) {
    return 0;
  }

  if (result.macd.bearishCross) {
    return 1;
  }

  if (!result.macd.histogramRising) {
    return 2;
  }

  if (result.macd.bullishCross) {
    return 5;
  }

  if (result.macd.aboveZero) {
    return 3;
  }

  return 4;
}

function getMaSortValue(result: ScanResult) {
  return [
    result.maStatus.aboveMA20,
    result.maStatus.aboveMA50,
    result.maStatus.aboveMA200,
    result.maStatus.ma20AboveMA50,
    result.maStatus.ma50AboveMA200,
  ].filter(Boolean).length;
}

function nullableNumber(value: number | null | undefined) {
  return value ?? Number.NEGATIVE_INFINITY;
}
