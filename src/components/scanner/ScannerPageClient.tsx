"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { ScannerFilters, type ScannerSortKey } from "./ScannerFilters";
import { ScannerTable } from "./ScannerTable";
import { SelectedSymbolPanel } from "./SelectedSymbolPanel";
import type { Timeframe } from "@/lib/exchanges/types";
import type { MtfPreset } from "@/lib/scanner/multiTimeframe";
import { scannerSignalOrder } from "@/lib/scanner/signal";
import type {
  MarketPhase,
  MultiTimeframeAlignment,
  ScannerSignalState,
  ScanResult,
} from "@/lib/scanner/types";

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
  failureSummary?: {
    insufficientHistory: number;
    fetchFailed: number;
    indicatorFailed: number;
    filteredLowVolume: number;
    excludedStableOrLeveraged: number;
  };
  results: ScanResult[];
  itemCount: number;
  scannedMarketCount?: number;
  displayLimit?: number;
  errors?: { symbol: string; message: string }[];
  cached: boolean;
  updatedAt: string;
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

const initialFilters: ScannerFiltersState = {
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
  const [filters, setFilters] = useState<ScannerFiltersState>(initialFilters);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
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
    queryFn: () => fetchScan(filters),
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
  }

  function selectSignal(signal: ScannerSignalState | "ALL") {
    updateFilters({ ...filters, signal });
  }

  function applyQuickFilter(nextFilters: ScannerFiltersState) {
    updateFilters(nextFilters);
  }

  return (
    <section className="mx-auto max-w-[1600px] px-4 py-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-[var(--muted)]">
            {t.scanner.source}: Binance spot USDT
          </p>
          <h1 className="mt-1 text-3xl font-semibold">{t.scanner.title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            {t.scanner.subtitle}
          </p>
        </div>
        <div className="grid w-full grid-cols-1 gap-2 text-sm sm:w-auto sm:grid-cols-3">
          <HeaderMetric
            label={t.scanner.mode}
            value={
              filters.mode === "mtf" ? t.scanner.mtfMode : t.scanner.singleMode
            }
          />
          <HeaderMetric
            label={t.scanner.timeframe}
            value={
              filters.mode === "mtf"
                ? t.mtfPreset[filters.mtfPreset]
                : t.timeframe[filters.timeframe]
            }
          />
          <HeaderMetric
            label={t.scanner.source}
            value={
              (scanQuery.data?.source ?? filters.source) === "local"
                ? t.scanner.localSource
                : t.scanner.remoteSource
            }
          />
          <HeaderMetric
            label={t.scanner.results}
            value={formatDisplayCount(
              rows.length,
              scanQuery.data?.itemCount ?? rows.length,
            )}
          />
        </div>
      </div>

      <ScanScopePanel data={scanQuery.data ?? null} />

      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)_380px]">
        <ScannerFilters filters={filters} onChange={updateFilters} />
        <div className="min-w-0 space-y-4">
          <QuickFilterBar
            filters={filters}
            onSelect={applyQuickFilter}
          />
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

export function ScanScopePanel({ data }: { data: ScanApiResponse | null }) {
  const { dictionary: t } = useLanguage();

  return (
    <section className="mb-5 rounded-md border border-[var(--border)] bg-[var(--panel)] px-4 py-3">
      <h2 className="text-sm font-semibold">{t.scanner.marketUniverse}</h2>
      <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
        {t.scanner.cachePolicyNote}
      </p>

      {data?.capped && (
        <div className="mt-3 rounded-md border border-[var(--warning)] bg-[#2b2111] px-3 py-2 text-xs font-semibold text-[var(--warning)]">
          {t.scanner.cappedWarning}
        </div>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <HeaderMetric
          label={t.scanner.eligibleMarkets}
          value={formatInteger(data?.eligibleCount)}
        />
        <HeaderMetric
          label={t.scanner.scannedMarkets}
          value={formatInteger(data?.scannedCount)}
        />
        <HeaderMetric
          label={t.scanner.failedMarkets}
          value={formatInteger(data?.failedCount)}
        />
        <HeaderMetric
          label={t.scanner.cacheStatus}
          value={data?.cached ? t.scanner.cached : t.scanner.live}
        />
        <HeaderMetric
          label={t.scanner.duration}
          value={formatDuration(data?.durationMs)}
        />
        <HeaderMetric
          label={t.scanner.updatedAt}
          value={formatDateTime(data?.updatedAt)}
        />
        <HeaderMetric
          label={t.scanner.nextRefresh}
          value={formatDateTime(data?.cacheExpiresAt)}
        />
      </div>

      {data?.failureSummary && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
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
            {t.scanner.filteredLowVolume}:{" "}
            {formatInteger(data.failureSummary.filteredLowVolume)}
          </span>
          <span>
            {t.scanner.excludedStableOrLeveraged}:{" "}
            {formatInteger(data.failureSummary.excludedStableOrLeveraged)}
          </span>
        </div>
      )}
    </section>
  );
}

function QuickFilterBar({
  filters,
  onSelect,
}: {
  filters: ScannerFiltersState;
  onSelect: (filters: ScannerFiltersState) => void;
}) {
  const { dictionary: t } = useLanguage();
  const presets: Array<{ label: string; filters: ScannerFiltersState }> = [
    { label: t.scanner.resetView, filters: initialFilters },
    {
      label: t.scanner.quickWatchlist,
      filters: {
        ...initialFilters,
        mode: "single",
        timeframe: "4h",
        signal: "WATCHLIST",
        minOpportunityScore: 60,
        maxRiskScore: 40,
        sortBy: "opportunityScore",
      },
    },
    {
      label: t.scanner.quickMtfSwing,
      filters: {
        ...initialFilters,
        mode: "mtf",
        mtfPreset: "swing",
        maxRiskScore: 60,
      },
    },
    {
      label: t.scanner.quickDailyTrend,
      filters: {
        ...initialFilters,
        mode: "single",
        timeframe: "1d",
        signal: "TREND_CONTINUATION",
        maxRiskScore: 45,
      },
    },
    {
      label: t.scanner.quickCleanRisk,
      filters: {
        ...filters,
        signal: "ALL",
        phase: "ALL",
        maxRiskScore: 35,
        sortBy: "lowestRiskScore",
      },
    },
  ];

  return (
    <section className="rounded-md border border-[var(--border)] bg-[var(--panel)] px-4 py-3">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {t.scanner.quickFilters}
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => onSelect(preset.filters)}
            className="rounded-md border border-[var(--border)] bg-[#0b0f14] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:border-[var(--foreground)]"
          >
            {preset.label}
          </button>
        ))}
      </div>
    </section>
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
    <section className="rounded-md border border-[var(--border)] bg-[var(--panel)] px-4 py-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t.scanner.mtfAlignmentSummary}</h2>
        <span className="text-xs text-[var(--muted)]">
          {total > 0 ? `${total} ${t.scanner.scanned}` : t.scanner.noMtfAlignment}
        </span>
      </div>
      {total > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {items.map((item) => (
            <div
              key={item.alignment}
              className="rounded-md border border-[var(--border)] bg-[#0b0f14] p-3"
            >
              <div className="truncate text-xs text-[var(--muted)]">
                {t.alignment[item.alignment]}
              </div>
              <div className="mt-1 text-lg font-semibold tabular-nums">
                {item.count}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#111820]">
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

function HeaderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-2 sm:min-w-28">
      <div className="text-xs text-[var(--muted)]">{label}</div>
      <div className="mt-1 break-words text-sm font-semibold">{value}</div>
    </div>
  );
}

async function fetchScan(filters: ScannerFiltersState) {
  if (filters.mode === "mtf") {
    return fetchMtfScan(filters);
  }

  return fetchSingleTimeframeScan(filters);
}

async function fetchSingleTimeframeScan(filters: ScannerFiltersState) {
  const params = new URLSearchParams({
    timeframe: filters.timeframe,
    source: filters.source,
    minQuoteVolume: String(filters.minQuoteVolume),
  });
  const maxSymbols = getApiMaxSymbols(filters);

  if (maxSymbols !== null) {
    params.set("maxSymbols", String(maxSymbols));
  }

  const response = await fetch(`/api/scan?${params.toString()}`);

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as
      | { error?: string; message?: string }
      | null;
    throw new Error(
      errorBody?.message ?? errorBody?.error ?? "Scanner request failed.",
    );
  }

  return (await response.json()) as ScanApiResponse;
}

async function fetchMtfScan(filters: ScannerFiltersState) {
  const params = new URLSearchParams({
    preset: filters.mtfPreset,
    source: filters.source,
    minQuoteVolume: String(filters.minQuoteVolume),
  });
  const maxSymbols = getApiMaxSymbols(filters);

  if (maxSymbols !== null) {
    params.set("maxSymbols", String(maxSymbols));
  }

  const response = await fetch(`/api/scan/mtf?${params.toString()}`);

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as
      | { error?: string; message?: string }
      | null;
    throw new Error(
      errorBody?.message ?? errorBody?.error ?? "MTF scanner request failed.",
    );
  }

  return (await response.json()) as ScanApiResponse;
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

function formatDateTime(value: string | undefined) {
  if (!value) {
    return "--";
  }

  return new Date(value).toLocaleString();
}

function formatDisplayCount(displayed: number, total: number) {
  const formatter = new Intl.NumberFormat();

  if (displayed === total) {
    return formatter.format(total);
  }

  return `${formatter.format(displayed)} / ${formatter.format(total)}`;
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
