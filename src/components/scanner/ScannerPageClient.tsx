"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { ScannerFilters, type ScannerSortKey } from "./ScannerFilters";
import { ScannerTable } from "./ScannerTable";
import { SelectedSymbolPanel } from "./SelectedSymbolPanel";
import { TIMEFRAMES, type Timeframe } from "@/lib/exchanges/types";
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
  results: ScanResult[];
  itemCount: number;
  scannedMarketCount?: number;
  displayLimit?: number;
  errors?: { symbol: string; message: string }[];
  cached: boolean;
  updatedAt: string;
};

type MarketDataSummaryResponse = {
  summary: {
    marketCount: number;
    candleCount: number;
    syncedPairs: number;
    latestSyncedAt: string | null;
    failedPairs: number;
  };
};

type MarketDataSyncResponse = {
  mode: "recent" | "incremental";
  requestedMarkets: number;
  requestedPairs: number;
  syncedPairs: number;
  failedPairs: number;
  candlesFetched: number;
  startedAt: string;
  completedAt: string;
  summary: MarketDataSummaryResponse["summary"];
  errors: Array<{ symbol: string; timeframe: Timeframe; message: string }>;
};

type DataSyncControlsState = {
  mode: "recent" | "incremental";
  marketLimit: 50 | 100 | 200 | 500;
  timeframes: Timeframe[];
};

export type ScannerMode = "single" | "mtf";

export type ScannerFiltersState = {
  mode: ScannerMode;
  timeframe: Timeframe;
  mtfPreset: MtfPreset;
  signal: ScannerSignalState | "ALL";
  phase: MarketPhase | "ALL";
  minOpportunityScore: number;
  maxRiskScore: number;
  sortBy: ScannerSortKey;
  limit: 50 | 100 | 200 | "ALL";
};

const initialFilters: ScannerFiltersState = {
  mode: "single",
  timeframe: "4h",
  mtfPreset: "swing",
  signal: "ALL",
  phase: "ALL",
  minOpportunityScore: 0,
  maxRiskScore: 100,
  sortBy: "rankScore",
  limit: 50,
};

export function ScannerPageClient() {
  const { dictionary: t } = useLanguage();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<ScannerFiltersState>(initialFilters);
  const [syncControls, setSyncControls] = useState<DataSyncControlsState>({
    mode: "incremental",
    marketLimit: 200,
    timeframes: ["4h"],
  });
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const scanQuery = useQuery({
    queryKey: [
      "scan",
      filters.mode,
      filters.timeframe,
      filters.mtfPreset,
      getApiLimit(filters),
    ],
    queryFn: () => fetchScan(filters),
  });
  const dataSummaryQuery = useQuery({
    queryKey: ["market-data-summary"],
    queryFn: fetchMarketDataSummary,
  });
  const syncMutation = useMutation({
    mutationFn: () =>
      syncMarketData({
        mode: syncControls.mode,
        marketLimit: syncControls.marketLimit,
        timeframes: syncControls.timeframes,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["market-data-summary"] });
      void scanQuery.refetch();
    },
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
              scanQuery.data?.source === "local"
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

      <LocalDataPanel
        summary={dataSummaryQuery.data?.summary ?? null}
        isLoading={dataSummaryQuery.isLoading}
        isSyncing={syncMutation.isPending}
        controls={syncControls}
        syncResult={syncMutation.data ?? null}
        errorMessage={
          syncMutation.error instanceof Error ? syncMutation.error.message : null
        }
        onControlsChange={setSyncControls}
        onUseCurrentView={() =>
          setSyncControls((current) => ({
            ...current,
            timeframes: getSyncTimeframes(filters),
          }))
        }
        onUseAllTimeframes={() =>
          setSyncControls((current) => ({
            ...current,
            timeframes: [...TIMEFRAMES],
          }))
        }
        onSync={() => syncMutation.mutate()}
      />

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

function LocalDataPanel({
  summary,
  isLoading,
  isSyncing,
  controls,
  syncResult,
  errorMessage,
  onControlsChange,
  onUseCurrentView,
  onUseAllTimeframes,
  onSync,
}: {
  summary: MarketDataSummaryResponse["summary"] | null;
  isLoading: boolean;
  isSyncing: boolean;
  controls: DataSyncControlsState;
  syncResult: MarketDataSyncResponse | null;
  errorMessage: string | null;
  onControlsChange: (controls: DataSyncControlsState) => void;
  onUseCurrentView: () => void;
  onUseAllTimeframes: () => void;
  onSync: () => void;
}) {
  const { dictionary: t } = useLanguage();

  function updateControls(nextControls: Partial<DataSyncControlsState>) {
    onControlsChange({ ...controls, ...nextControls });
  }

  function toggleTimeframe(timeframe: Timeframe) {
    const nextTimeframes = controls.timeframes.includes(timeframe)
      ? controls.timeframes.filter((item) => item !== timeframe)
      : [...controls.timeframes, timeframe];

    updateControls({
      timeframes: nextTimeframes.length > 0 ? nextTimeframes : [timeframe],
    });
  }

  return (
    <section className="mb-5 rounded-md border border-[var(--border)] bg-[var(--panel)] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{t.scanner.localData}</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {summary?.latestSyncedAt
              ? `${t.scanner.latestSync}: ${new Date(
                  summary.latestSyncedAt,
                ).toLocaleString()}`
              : isLoading
                ? t.common.loading
                : t.scanner.noLocalData}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <HeaderMetric
          label={t.scanner.marketsSynced}
          value={formatInteger(summary?.marketCount)}
        />
        <HeaderMetric
          label={t.scanner.candlesStored}
          value={formatInteger(summary?.candleCount)}
        />
        <HeaderMetric
          label={t.scanner.syncedPairs}
          value={formatInteger(summary?.syncedPairs)}
        />
        <HeaderMetric
          label={t.scanner.syncErrors}
          value={formatInteger(summary?.failedPairs)}
        />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[180px_180px_minmax(0,1fr)_auto] lg:items-end">
        <label className="text-sm text-[var(--muted)]">
          <span className="mb-2 block">{t.scanner.syncMode}</span>
          <select
            value={controls.mode}
            onChange={(event) =>
              updateControls({
                mode: event.target.value as DataSyncControlsState["mode"],
              })
            }
            className="w-full rounded-md border border-[var(--border)] bg-[#0b0f14] px-3 py-2 text-[var(--foreground)]"
          >
            <option value="incremental">{t.scanner.incrementalSync}</option>
            <option value="recent">{t.scanner.recentSync}</option>
          </select>
        </label>

        <label className="text-sm text-[var(--muted)]">
          <span className="mb-2 block">{t.scanner.marketLimit}</span>
          <select
            value={controls.marketLimit}
            onChange={(event) =>
              updateControls({
                marketLimit: Number(
                  event.target.value,
                ) as DataSyncControlsState["marketLimit"],
              })
            }
            className="w-full rounded-md border border-[var(--border)] bg-[#0b0f14] px-3 py-2 text-[var(--foreground)]"
          >
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
          </select>
        </label>

        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
            <span>{t.scanner.syncScope}</span>
            <button
              type="button"
              onClick={onUseCurrentView}
              className="rounded-md border border-[var(--border)] bg-[#0b0f14] px-2 py-1 text-xs font-semibold text-[var(--foreground)]"
            >
              {t.scanner.currentViewScope}
            </button>
            <button
              type="button"
              onClick={onUseAllTimeframes}
              className="rounded-md border border-[var(--border)] bg-[#0b0f14] px-2 py-1 text-xs font-semibold text-[var(--foreground)]"
            >
              {t.scanner.allTimeframesScope}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {TIMEFRAMES.map((timeframe) => {
              const isActive = controls.timeframes.includes(timeframe);

              return (
                <button
                  key={timeframe}
                  type="button"
                  onClick={() => toggleTimeframe(timeframe)}
                  className={`rounded-md border px-3 py-2 text-xs font-semibold ${
                    isActive
                      ? "border-[var(--foreground)] bg-[#101923] text-[var(--foreground)]"
                      : "border-[var(--border)] bg-[#0b0f14] text-[var(--muted)]"
                  }`}
                >
                  {t.timeframe[timeframe]}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={onSync}
          disabled={isSyncing || controls.timeframes.length === 0}
          className="rounded-md border border-[var(--border)] bg-[#0b0f14] px-3 py-2 text-sm font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSyncing ? t.scanner.updatingData : t.scanner.updateLatestData}
        </button>
      </div>

      {syncResult && (
        <p className="mt-3 text-xs text-[var(--muted)]">
          {t.scanner.syncComplete}: {syncResult.candlesFetched}{" "}
          {t.scanner.candlesStored}, {syncResult.failedPairs}{" "}
          {t.scanner.syncErrors}
        </p>
      )}
      {errorMessage && (
        <p className="mt-3 text-xs text-[var(--danger)]">{errorMessage}</p>
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
      <div className="mt-1 max-w-36 truncate font-semibold">{value}</div>
    </div>
  );
}

async function fetchScan(filters: ScannerFiltersState) {
  if (filters.mode === "mtf") {
    return fetchMtfScan(filters.mtfPreset, getApiLimit(filters));
  }

  return fetchSingleTimeframeScan(filters.timeframe, getApiLimit(filters));
}

async function fetchMarketDataSummary() {
  const response = await fetch("/api/data/sync");

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as
      | { error?: string; message?: string }
      | null;
    throw new Error(
      errorBody?.message ?? errorBody?.error ?? "Market data request failed.",
    );
  }

  return (await response.json()) as MarketDataSummaryResponse;
}

async function syncMarketData({
  mode,
  marketLimit,
  timeframes,
}: {
  mode: "recent" | "incremental";
  marketLimit: number;
  timeframes: Timeframe[];
}) {
  const response = await fetch("/api/data/sync", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ mode, marketLimit, timeframes }),
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as
      | { error?: string; message?: string }
      | null;
    throw new Error(
      errorBody?.message ?? errorBody?.error ?? "Market data sync failed.",
    );
  }

  return (await response.json()) as MarketDataSyncResponse;
}

async function fetchSingleTimeframeScan(timeframe: Timeframe, limit: number) {
  const params = new URLSearchParams({
    timeframe,
    limit: String(limit),
  });
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

async function fetchMtfScan(preset: MtfPreset, limit: number) {
  const params = new URLSearchParams({
    preset,
    limit: String(limit),
  });
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

function getApiLimit(filters: ScannerFiltersState) {
  const maxRemoteLimit = filters.mode === "mtf" ? 100 : 200;

  if (filters.limit === "ALL") {
    return maxRemoteLimit;
  }

  return Math.min(filters.limit, maxRemoteLimit);
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

function getSyncTimeframes(filters: ScannerFiltersState): Timeframe[] {
  if (filters.mode === "mtf") {
    switch (filters.mtfPreset) {
      case "short":
        return ["1h", "4h", "1d"];
      case "position":
        return ["1d", "7d", "1m"];
      case "full":
        return ["1h", "4h", "1d", "7d", "1m"];
      case "swing":
      default:
        return ["4h", "1d", "7d"];
    }
  }

  return [filters.timeframe];
}

function formatInteger(value: number | undefined) {
  return value === undefined ? "0" : new Intl.NumberFormat().format(value);
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
