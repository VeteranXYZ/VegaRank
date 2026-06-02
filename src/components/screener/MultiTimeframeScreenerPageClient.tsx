"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  formatDateTime,
  formatGroupLabel,
} from "@/components/scanner/latestScanUi";
import { MarketContextPanel } from "@/components/market-context/MarketContextPanel";
import { fetchMarketContext } from "@/components/market-context/marketContextUi";
import { shortResearchDisclaimer } from "@/components/researchCopy";
import {
  MTF_SCREENER_TIMEFRAMES,
  buildMtfScreenerRowsFromResponse,
  buildMtfSymbolResearchHref,
  countMtfResearchBuckets,
  defaultMtfScreenerSort,
  defaultMtfScreenerFilters,
  filterMtfScreenerRowsBySearch,
  filterMtfScreenerRows,
  formatMtfScreenerRowsCsv,
  formatMtfCombinedRank,
  formatMtfGroup,
  formatMtfRank,
  getMtfScreenerExportFilename,
  getMtfScreenerExportRows,
  getMtfHigherTimeframeHealth,
  getMtfPrimarySignal,
  getMtfRiskNotesSummary,
  getMtfSymbolResearchTimeframe,
  mtfScreenerGroupFilterOptions,
  mtfScreenerSortOptions,
  type MtfLatestScreenerResponse,
  type MtfScreenerFilters,
  type MtfScreenerExportType,
  type MtfScreenerGroupFilter,
  type MtfScreenerPresetId,
  type MtfScreenerRow,
  type MtfScreenerSortDirection,
  type MtfScreenerSortField,
  type MtfScreenerSortState,
  type MtfScreenerTimeframe,
  sortMtfScreenerRows,
} from "./multiTimeframeScreenerUi";

const assetClass = "crypto";

export function MultiTimeframeScreenerPageClient() {
  const [filters, setFilters] = useState<MtfScreenerFilters>(
    defaultMtfScreenerFilters,
  );
  const [presetId, setPresetId] = useState<MtfScreenerPresetId | "custom">(
    "custom",
  );
  const [symbolSearch, setSymbolSearch] = useState("");
  const [sortState, setSortState] = useState<MtfScreenerSortState>(
    defaultMtfScreenerSort,
  );
  const latestQuery = useQuery({
    queryKey: ["mtf-latest-screener", assetClass],
    queryFn: ({ signal }) => fetchMtfLatestScans({ signal }),
    staleTime: 60_000,
  });
  const marketContextQuery = useQuery({
    queryKey: ["market-context", assetClass],
    queryFn: ({ signal }) => fetchMarketContext({ assetClass, signal }),
    retry: false,
    staleTime: 60_000,
  });
  const rows = useMemo(
    () => buildMtfScreenerRowsFromResponse(latestQuery.data),
    [latestQuery.data],
  );
  const filteredRows = useMemo(
    () => filterMtfScreenerRows(rows, filters, presetId),
    [filters, presetId, rows],
  );
  const searchedRows = useMemo(
    () => filterMtfScreenerRowsBySearch(filteredRows, symbolSearch),
    [filteredRows, symbolSearch],
  );
  const sortedRows = useMemo(
    () => sortMtfScreenerRows(searchedRows, sortState),
    [searchedRows, sortState],
  );
  const isFullTableActive =
    presetId === "custom" &&
    symbolSearch.trim() === "" &&
    areMtfScreenerFiltersDefault(filters) &&
    isMtfScreenerDefaultSort(sortState);

  const updateGroupFilter = (
    timeframe: MtfScreenerTimeframe,
    value: MtfScreenerGroupFilter,
  ) => {
    setPresetId("custom");
    setFilters((current) => ({
      ...current,
      groups: { ...current.groups, [timeframe]: value },
    }));
  };
  const updateMinRank = (timeframe: MtfScreenerTimeframe, value: string) => {
    const parsed = Number(value);

    setPresetId("custom");
    setFilters((current) => ({
      ...current,
      minRank: {
        ...current.minRank,
        [timeframe]: Number.isFinite(parsed) ? Math.max(0, parsed) : 0,
      },
    }));
  };
  const updateExcludeRisk = (key: "exclude1dRisk" | "exclude1wRisk") => {
    setPresetId("custom");
    setFilters((current) => ({ ...current, [key]: !current[key] }));
  };
  const updateSortField = (field: MtfScreenerSortField) => {
    setSortState((current) => ({ ...current, field }));
  };
  const updateSortDirection = (direction: MtfScreenerSortDirection) => {
    setSortState((current) => ({ ...current, direction }));
  };
  const applyPreset = (nextPresetId: MtfScreenerPresetId) => {
    setPresetId(nextPresetId);
    setFilters(defaultMtfScreenerFilters);
  };
  const clearFilters = () => {
    setPresetId("custom");
    setFilters(defaultMtfScreenerFilters);
    setSymbolSearch("");
    setSortState(defaultMtfScreenerSort);
  };
  const refreshData = () => {
    void latestQuery.refetch();
    void marketContextQuery.refetch();
  };
  const exportRows = (exportType: MtfScreenerExportType) => {
    const exportedAt = new Date().toISOString();
    const exportRows = getMtfScreenerExportRows({
      exportType,
      visibleRows: sortedRows,
      allRows: rows,
    });
    const csv = formatMtfScreenerRowsCsv({
      rows: exportRows,
      exportType,
      exportedAt,
      assetClass,
      runs: latestQuery.data?.runs,
    });

    downloadCsvFile({
      csv,
      filename: getMtfScreenerExportFilename({ exportType, exportedAt }),
    });
  };

  return (
    <section className="mx-auto flex min-h-[calc(100vh-1px)] max-w-[1800px] flex-col px-2 py-2">
      <header className="mb-2 border border-[var(--border)] bg-[#070b0f] px-3 py-3 shadow-[inset_3px_0_0_rgba(45,212,191,0.35)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-sm font-semibold text-[var(--foreground)]">
              Multi-Timeframe Screener
            </h1>
          <p className="mt-1 max-w-3xl text-[11px] leading-5 text-[var(--muted)]">
              {shortResearchDisclaimer} MTF view for Binance USDT crypto
              symbols. All matching rows remain visible by default.
            </p>
          </div>
          <button
            type="button"
            onClick={refreshData}
            disabled={latestQuery.isFetching || marketContextQuery.isFetching}
            className="h-7 border border-[var(--border)] px-2 text-[11px] font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {latestQuery.isFetching || marketContextQuery.isFetching
              ? "Refreshing"
              : "Refresh"}
          </button>
        </div>
      </header>

      <div className="mb-2">
        <MarketContextPanel
          data={marketContextQuery.data}
          isLoading={marketContextQuery.isLoading}
          isError={marketContextQuery.isError}
        />
      </div>

      <MtfResearchBucketsPanel
        rows={rows}
        presetId={presetId}
        isFullTableActive={isFullTableActive}
        onBucketSelect={applyPreset}
        onClear={clearFilters}
      />

      <div className="grid min-h-0 flex-1 gap-2 xl:grid-cols-[270px_minmax(0,1fr)]">
        <MtfScreenerControls
          filters={filters}
          symbolSearch={symbolSearch}
          sortState={sortState}
          onSymbolSearchChange={setSymbolSearch}
          onSortFieldChange={updateSortField}
          onSortDirectionChange={updateSortDirection}
          onGroupChange={updateGroupFilter}
          onMinRankChange={updateMinRank}
          onExcludeRiskChange={updateExcludeRisk}
          onClear={clearFilters}
        />

        <main className="min-w-0 space-y-2">
          <MtfScreenerSourcePanel
            data={latestQuery.data}
            totalRows={rows.length}
            filteredRows={sortedRows.length}
            onExportVisible={() => exportRows("visible_rows")}
            onExportAll={() => exportRows("all_joined_rows")}
          />

          {latestQuery.isLoading ? (
            <MtfStatePanel message="Loading multi-timeframe latest scan data..." />
          ) : latestQuery.isError ? (
            <MtfStatePanel message={getMtfErrorMessage(latestQuery.error)} />
          ) : rows.length === 0 ? (
            <MtfStatePanel message="No latest multi-timeframe rows are available yet." />
          ) : (
            <MtfScreenerTable rows={sortedRows} />
          )}
        </main>
      </div>
    </section>
  );
}

export function MtfScreenerTable({ rows }: { rows: MtfScreenerRow[] }) {
  if (rows.length === 0) {
    return (
      <MtfStatePanel message="No symbols match the selected multi-timeframe filters." />
    );
  }

  return (
    <section className="overflow-hidden border border-[var(--border)] bg-[var(--panel)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-1.5">
        <h2 className="text-xs font-semibold text-[var(--foreground)]">
          Matching Symbols
        </h2>
        <span className="text-[11px] text-[var(--muted)]">
          {rows.length} research rows
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[1320px] table-fixed text-left text-[11px]">
          <thead className="bg-[#080d12] text-[10px] uppercase tracking-normal text-[var(--muted)]">
            <tr>
              <HeaderCell
                rowSpan={2}
                className="sticky left-0 z-20 w-[118px] bg-[#080d12]"
              >
                Symbol
              </HeaderCell>
              <HeaderCell rowSpan={2} className="w-[72px] text-right">
                Rank
              </HeaderCell>
              <HeaderCell rowSpan={2} className="w-[106px]">
                Higher TF
              </HeaderCell>
              {MTF_SCREENER_TIMEFRAMES.map((timeframe) => (
                <HeaderCell
                  key={`${timeframe}-header`}
                  colSpan={2}
                  className="border-l border-[var(--border)] text-center text-[var(--foreground)]"
                >
                  {timeframe}
                </HeaderCell>
              ))}
              <HeaderCell rowSpan={2} className="w-[156px]">
                Signal
              </HeaderCell>
              <HeaderCell rowSpan={2} className="w-[230px]">
                Notes
              </HeaderCell>
              <HeaderCell rowSpan={2} className="w-[104px]">
                Research
              </HeaderCell>
            </tr>
            <tr>
              {MTF_SCREENER_TIMEFRAMES.map((timeframe) => (
                <TimeframeHeaderCells key={timeframe} timeframe={timeframe} />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.symbol}
                className="group border-t border-[var(--border)] align-top hover:bg-[#0b1118]"
              >
                <BodyCell className="sticky left-0 z-10 bg-[var(--panel)] group-hover:bg-[#0b1118]">
                  <div className="font-mono text-xs font-semibold text-[var(--foreground)]">
                    {row.symbol}
                  </div>
                  <div className="mt-0.5 text-[10px] uppercase text-[var(--muted)]">
                    {row.exchange} / {row.market}
                  </div>
                </BodyCell>
                <BodyCell className="text-right">
                  <span className="font-mono tabular-nums text-[var(--foreground)]">
                    {formatMtfCombinedRank(row)}
                  </span>
                </BodyCell>
                <BodyCell>
                  <HigherTimeframeHealthBadge row={row} />
                </BodyCell>
                {MTF_SCREENER_TIMEFRAMES.map((timeframe) => (
                  <TimeframeCells
                    key={`${row.symbol}-${timeframe}`}
                    row={row}
                    timeframe={timeframe}
                  />
                ))}
                <BodyCell className="leading-4 text-[var(--foreground)]">
                  {getMtfPrimarySignal(row)}
                </BodyCell>
                <BodyCell>
                  <RiskNotesCell row={row} />
                </BodyCell>
                <BodyCell>
                  <ResearchLink row={row} />
                </BodyCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

async function fetchMtfLatestScans({
  signal,
}: {
  signal?: AbortSignal;
}): Promise<MtfLatestScreenerResponse> {
  const response = await fetch(buildMtfLatestScanUrl({ assetClass }), { signal });

  if (!response.ok) {
    throw new Error(
      `Failed to load multi-timeframe latest scan data (${response.status}).`,
    );
  }

  return (await response.json()) as MtfLatestScreenerResponse;
}

export function buildMtfLatestScanUrl({
  assetClass,
  tradeApiBaseUrl = process.env.NEXT_PUBLIC_TRADE_API_BASE_URL,
}: {
  assetClass: string;
  tradeApiBaseUrl?: string;
}) {
  const params = new URLSearchParams({
    assetClass,
  });
  const baseUrl = tradeApiBaseUrl?.trim().replace(/\/+$/, "") ?? "";

  return `${baseUrl}/api/scan/mtf-latest?${params.toString()}`;
}

function downloadCsvFile({
  csv,
  filename,
}: {
  csv: string;
  filename: string;
}) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export function MtfResearchBucketsPanel({
  rows,
  presetId,
  isFullTableActive,
  onBucketSelect,
  onClear,
}: {
  rows: MtfScreenerRow[];
  presetId: MtfScreenerPresetId | "custom";
  isFullTableActive: boolean;
  onBucketSelect: (presetId: MtfScreenerPresetId) => void;
  onClear: () => void;
}) {
  const buckets = countMtfResearchBuckets(rows);

  return (
    <section className="mb-2 border border-[var(--border)] bg-[var(--panel)] px-3 py-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold text-[var(--foreground)]">
            Research Buckets
          </h2>
          <p className="mt-1 max-w-4xl text-[11px] leading-5 text-[var(--muted)]">
            Triage groups for research starting points. Counts use the full
            joined screener universe before search or filter narrowing.
            {shortResearchDisclaimer}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          aria-pressed={isFullTableActive}
          className={`min-h-9 border px-3 py-1.5 text-left text-[11px] ${
            isFullTableActive
              ? "border-[var(--accent)] bg-[#0d1714] text-[var(--foreground)]"
              : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--info)] hover:text-[var(--foreground)]"
          }`}
        >
          <span className="block font-semibold">Full Table</span>
          <span className="block font-mono tabular-nums">
            {rows.length} joined symbols
          </span>
        </button>
      </div>

      <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        {buckets.map((bucket) => {
          const isActive = presetId === bucket.id;

          return (
            <button
              key={bucket.id}
              type="button"
              title={bucket.implication}
              onClick={() => onBucketSelect(bucket.id)}
              aria-pressed={isActive}
              className={`min-h-[104px] border px-2.5 py-2 text-left ${
                isActive
                  ? "border-[var(--accent)] bg-[#0d1714] text-[var(--foreground)]"
                  : "border-[var(--border)] bg-[#080d12] text-[var(--muted)] hover:border-[var(--info)] hover:text-[var(--foreground)]"
              }`}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="text-[11px] font-semibold text-[var(--foreground)]">
                  {bucket.label}
                </span>
                <span className="text-right">
                  <span className="block font-mono text-sm tabular-nums text-[var(--foreground)]">
                    {bucket.count}
                  </span>
                  <span className="block text-[10px] leading-3 text-[var(--muted)]">
                    matching symbols
                  </span>
                </span>
              </span>
              <span className="mt-1 block text-[11px] leading-4">
                {bucket.description}
              </span>
              <span className="mt-1 block text-[10px] leading-4 text-[var(--muted)]">
                {bucket.implication}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function MtfScreenerControls({
  filters,
  symbolSearch,
  sortState,
  onSymbolSearchChange,
  onSortFieldChange,
  onSortDirectionChange,
  onGroupChange,
  onMinRankChange,
  onExcludeRiskChange,
  onClear,
}: {
  filters: MtfScreenerFilters;
  symbolSearch: string;
  sortState: MtfScreenerSortState;
  onSymbolSearchChange: (value: string) => void;
  onSortFieldChange: (field: MtfScreenerSortField) => void;
  onSortDirectionChange: (direction: MtfScreenerSortDirection) => void;
  onGroupChange: (
    timeframe: MtfScreenerTimeframe,
    value: MtfScreenerGroupFilter,
  ) => void;
  onMinRankChange: (timeframe: MtfScreenerTimeframe, value: string) => void;
  onExcludeRiskChange: (key: "exclude1dRisk" | "exclude1wRisk") => void;
  onClear: () => void;
}) {
  return (
    <aside className="border border-[var(--border)] bg-[var(--panel)] p-3 xl:h-full xl:overflow-y-auto">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Filters</h2>
        <button
          type="button"
          onClick={onClear}
          className="border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--foreground)]"
        >
          Clear
        </button>
      </div>

      <section className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase text-[var(--muted)]">
            Symbol Search
          </span>
          <input
            type="search"
            value={symbolSearch}
            onChange={(event) => onSymbolSearchChange(event.target.value)}
            className={controlClass}
            placeholder="BTC, ETH, SEI..."
          />
        </label>
      </section>

      <section className="mt-4 space-y-3">
        <h3 className="text-[11px] font-semibold uppercase text-[var(--muted)]">
          Sort
        </h3>
        <label className="block">
          <span className="mb-1 block text-[11px] text-[var(--muted)]">
            Field
          </span>
          <select
            value={sortState.field}
            onChange={(event) =>
              onSortFieldChange(event.target.value as MtfScreenerSortField)
            }
            className={controlClass}
          >
            {mtfScreenerSortOptions.map((option) => (
              <option key={option.field} value={option.field}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-[var(--muted)]">
            Direction
          </span>
          <select
            value={sortState.direction}
            onChange={(event) =>
              onSortDirectionChange(
                event.target.value as MtfScreenerSortDirection,
              )
            }
            className={controlClass}
          >
            <option value="desc">High to low</option>
            <option value="asc">Low to high</option>
          </select>
        </label>
      </section>

      <section className="mt-4 space-y-3">
        <h3 className="text-[11px] font-semibold uppercase text-[var(--muted)]">
          Group Filters
        </h3>
        {MTF_SCREENER_TIMEFRAMES.map((timeframe) => (
          <label key={timeframe} className="block">
            <span className="mb-1 block text-[11px] text-[var(--muted)]">
              {timeframe} group
            </span>
            <select
              value={filters.groups[timeframe]}
              onChange={(event) =>
                onGroupChange(
                  timeframe,
                  event.target.value as MtfScreenerGroupFilter,
                )
              }
              className={controlClass}
            >
              {mtfScreenerGroupFilterOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "any" ? "Any" : formatGroupLabel(option)}
                </option>
              ))}
            </select>
          </label>
        ))}
      </section>

      <section className="mt-4 space-y-3">
        <h3 className="text-[11px] font-semibold uppercase text-[var(--muted)]">
          Minimum Rank
        </h3>
        {MTF_SCREENER_TIMEFRAMES.map((timeframe) => (
          <label key={timeframe} className="block">
            <span className="mb-1 block text-[11px] text-[var(--muted)]">
              {timeframe} rank
            </span>
            <input
              type="number"
              min={0}
              step={1}
              value={filters.minRank[timeframe] || ""}
              onChange={(event) => onMinRankChange(timeframe, event.target.value)}
              className={controlClass}
              placeholder="0"
            />
          </label>
        ))}
      </section>

      <section className="mt-4 space-y-2">
        <h3 className="text-[11px] font-semibold uppercase text-[var(--muted)]">
          Risk Exclusions
        </h3>
        <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <input
            type="checkbox"
            checked={filters.exclude1dRisk}
            onChange={() => onExcludeRiskChange("exclude1dRisk")}
          />
          Exclude 1d risk
        </label>
        <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <input
            type="checkbox"
            checked={filters.exclude1wRisk}
            onChange={() => onExcludeRiskChange("exclude1wRisk")}
          />
          Exclude 1w risk
        </label>
      </section>
    </aside>
  );
}

export function MtfScreenerSourcePanel({
  data,
  totalRows,
  filteredRows,
  onExportVisible,
  onExportAll,
}: {
  data: MtfLatestScreenerResponse | undefined;
  totalRows: number;
  filteredRows: number;
  onExportVisible: () => void;
  onExportAll: () => void;
}) {
  return (
    <section className="border border-[var(--border)] bg-[var(--panel)] px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold text-[var(--foreground)]">
            Data Source / Run Freshness
          </h2>
          <p className="mt-1 text-[11px] text-[var(--muted)]">
            Latest selected crypto scanner runs joined across 1h, 4h, 1d, and
            1w.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="text-[11px] text-[var(--muted)]">
            Showing {filteredRows} of {totalRows} joined symbols
          </div>
          <MtfScreenerExportControls
            visibleRowsCount={filteredRows}
            allRowsCount={totalRows}
            onExportVisible={onExportVisible}
            onExportAll={onExportAll}
          />
        </div>
      </div>
      <div className="mt-2 grid gap-2 md:grid-cols-4">
        {MTF_SCREENER_TIMEFRAMES.map((timeframe) => {
          const run = data?.runs[timeframe];
          const signalCount = data?.signalCounts[timeframe] ?? 0;
          const missingCount = data?.missingCounts[timeframe] ?? 0;

          return (
            <div
              key={timeframe}
              className="border border-[var(--border)] bg-[#080d12] px-2 py-1.5"
            >
              <div className="text-[11px] font-semibold text-[var(--foreground)]">
                {timeframe}
              </div>
              <div className="mt-1 text-[11px] text-[var(--muted)]">
                {run
                  ? `${formatDateTime(run.finishedAt ?? run.startedAt)} - ${signalCount} signals, ${missingCount} missing`
                  : "No selected latest run"}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function MtfScreenerExportControls({
  visibleRowsCount,
  allRowsCount,
  onExportVisible,
  onExportAll,
}: {
  visibleRowsCount: number;
  allRowsCount: number;
  onExportVisible: () => void;
  onExportAll: () => void;
}) {
  return (
    <div
      aria-label="Screener CSV export"
      className="flex flex-wrap items-center gap-1.5"
    >
      <button
        type="button"
        onClick={onExportVisible}
        disabled={visibleRowsCount === 0}
        className="h-7 border border-[var(--border)] px-2 text-[11px] font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Export Visible Rows
      </button>
      <button
        type="button"
        onClick={onExportAll}
        disabled={allRowsCount === 0}
        className="h-7 border border-[var(--border)] px-2 text-[11px] font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Export All Joined Rows
      </button>
    </div>
  );
}

function MtfStatePanel({ message }: { message: string }) {
  return (
    <section className="border border-[var(--border)] bg-[var(--panel)] px-3 py-8 text-center text-sm text-[var(--muted)]">
      {message}
    </section>
  );
}

function TimeframeHeaderCells({
  timeframe,
}: {
  timeframe: MtfScreenerTimeframe;
}) {
  return (
    <>
      <HeaderCell className="w-[78px] border-l border-[var(--border)]">
        Group
        <span className="sr-only"> for {timeframe}</span>
      </HeaderCell>
      <HeaderCell className="w-[52px] text-right">
        Rank
        <span className="sr-only"> for {timeframe}</span>
      </HeaderCell>
    </>
  );
}

function TimeframeCells({
  row,
  timeframe,
}: {
  row: MtfScreenerRow;
  timeframe: MtfScreenerTimeframe;
}) {
  const snapshot = row.snapshots[timeframe];

  return (
    <>
      <BodyCell className="border-l border-[var(--border)]">
        <GroupBadge group={snapshot?.resultGroup}>{formatMtfGroup(snapshot)}</GroupBadge>
      </BodyCell>
      <BodyCell className="text-right">
        <span className="font-mono tabular-nums text-[var(--foreground)]">
          {formatMtfRank(snapshot)}
        </span>
      </BodyCell>
    </>
  );
}

function HeaderCell({
  children,
  className = "",
  colSpan,
  rowSpan,
}: {
  children: React.ReactNode;
  className?: string;
  colSpan?: number;
  rowSpan?: number;
}) {
  return (
    <th
      colSpan={colSpan}
      rowSpan={rowSpan}
      className={`px-2 py-1.5 font-semibold ${className}`}
    >
      {children}
    </th>
  );
}

function BodyCell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-2 py-1.5 text-[11px] text-[var(--muted)] ${className}`}>
      {children}
    </td>
  );
}

function GroupBadge({
  group,
  children,
}: {
  group?: string;
  children: React.ReactNode;
}) {
  const tone =
    group === "eligible"
      ? "border-emerald-500/40 text-emerald-200"
      : group === "watch"
        ? "border-sky-500/40 text-sky-200"
        : group === "overheated"
          ? "border-amber-500/40 text-amber-200"
          : group === "risk"
            ? "border-rose-500/40 text-rose-200"
            : "border-[var(--border)] text-[var(--muted)]";

  return (
    <span
      className={`inline-flex min-w-[72px] justify-center whitespace-nowrap border px-1.5 py-0.5 text-[10px] ${tone}`}
    >
      {children}
    </span>
  );
}

function HigherTimeframeHealthBadge({ row }: { row: MtfScreenerRow }) {
  const health = getMtfHigherTimeframeHealth(row);
  const tone =
    health.code === "higher_tf_ok"
      ? "border-emerald-500/40 text-emerald-200"
      : health.code === "limited_htf_data"
        ? "border-sky-500/40 text-sky-200"
        : health.code === "higher_tf_risk"
          ? "border-rose-500/60 text-rose-200"
          : "border-amber-500/50 text-amber-200";

  return (
    <span className={`inline-flex whitespace-nowrap border px-1.5 py-0.5 text-[10px] ${tone}`}>
      {health.label}
    </span>
  );
}

function RiskNotesCell({ row }: { row: MtfScreenerRow }) {
  const summary = getMtfRiskNotesSummary(row, 3);

  if (summary.notes.length === 0) {
    return <span>-</span>;
  }

  return (
    <div className="space-y-1 leading-4">
      <div className="flex flex-wrap gap-1">
        {summary.visibleNotes.map((note) => (
          <span
            key={note}
            className="border border-[var(--border)] bg-[#080d12] px-1.5 py-px text-[10px]"
          >
            {note}
          </span>
        ))}
      </div>
      {summary.hiddenCount > 0 ? (
        <details className="text-[10px] text-[var(--muted)]">
          <summary className="cursor-pointer text-[var(--foreground)]">
            +{summary.hiddenCount} more
          </summary>
          <div className="mt-1">{summary.hiddenNotes.join("; ")}</div>
        </details>
      ) : null}
    </div>
  );
}

function ResearchLink({ row }: { row: MtfScreenerRow }) {
  const timeframe = getMtfSymbolResearchTimeframe(row);

  return (
    <Link
      href={buildMtfSymbolResearchHref({ row, timeframe })}
      className="inline-flex min-w-[82px] justify-center border border-[var(--info)] bg-[#0b1118] px-2 py-1 text-[11px] font-semibold text-[var(--foreground)] hover:bg-[#101821]"
    >
      {timeframe} Research
    </Link>
  );
}

function getMtfErrorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Unable to load multi-timeframe screener data.";
}

function areMtfScreenerFiltersDefault(filters: MtfScreenerFilters) {
  return (
    MTF_SCREENER_TIMEFRAMES.every(
      (timeframe) =>
        filters.groups[timeframe] === defaultMtfScreenerFilters.groups[timeframe] &&
        filters.minRank[timeframe] === defaultMtfScreenerFilters.minRank[timeframe],
    ) &&
    filters.exclude1dRisk === defaultMtfScreenerFilters.exclude1dRisk &&
    filters.exclude1wRisk === defaultMtfScreenerFilters.exclude1wRisk
  );
}

function isMtfScreenerDefaultSort(sortState: MtfScreenerSortState) {
  return (
    sortState.field === defaultMtfScreenerSort.field &&
    sortState.direction === defaultMtfScreenerSort.direction
  );
}

const controlClass =
  "h-8 w-full border border-[var(--border)] bg-[#0b0f14] px-2 text-xs text-[var(--foreground)]";
