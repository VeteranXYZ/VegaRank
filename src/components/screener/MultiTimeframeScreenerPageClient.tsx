"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  DataTable,
  DataTableCell,
  DataTableChip,
  DataTableHeaderCell,
  DataTableScroll,
  type ChipTone,
} from "@/components/table/DataTable";
import {
  getNextDataSortState,
  sortDataRows,
  type DataSortDirection,
  type DataSortState,
  type DataSortValue,
} from "@/components/table/dataTableSorting";
import {
  ControlGroup,
  EmptyState,
  MetricCard,
  PageHeader,
  PageSection,
  PageShell,
  StatusBadge,
  type StatusTone,
} from "@/components/ui/workspace";
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
  defaultMtfScreenerFilters,
  filterMtfScreenerRowsBySearch,
  filterMtfScreenerRows,
  formatMtfScreenerRowsCsv,
  getMtfCombinedRank,
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
  type MtfLatestScreenerResponse,
  type MtfScreenerFilters,
  type MtfScreenerExportType,
  type MtfScreenerGroupFilter,
  type MtfScreenerPresetId,
  type MtfScreenerRow,
  type MtfScreenerTimeframe,
} from "./multiTimeframeScreenerUi";

const assetClass = "crypto";

export type MtfScreenerTableSortKey =
  | "symbol"
  | "combined_rank"
  | "higher_timeframe_safety"
  | "signal"
  | `${MtfScreenerTimeframe}_group`
  | `${MtfScreenerTimeframe}_rank`;

export function MultiTimeframeScreenerPageClient() {
  const [filters, setFilters] = useState<MtfScreenerFilters>(
    defaultMtfScreenerFilters,
  );
  const [presetId, setPresetId] = useState<MtfScreenerPresetId | "custom">(
    "custom",
  );
  const [symbolSearch, setSymbolSearch] = useState("");
  const [tableSortState, setTableSortState] =
    useState<DataSortState<MtfScreenerTableSortKey> | null>(null);
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
  const visibleRows = useMemo(
    () => sortDataRows(searchedRows, tableSortState, getMtfScreenerTableSortValue),
    [searchedRows, tableSortState],
  );
  const isFullTableActive =
    presetId === "custom" &&
    symbolSearch.trim() === "" &&
    areMtfScreenerFiltersDefault(filters) &&
    tableSortState === null;

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
  const updateTableSort = (
    key: MtfScreenerTableSortKey,
    defaultDirection: DataSortDirection,
  ) => {
    setTableSortState((current) =>
      getNextDataSortState({ current, key, defaultDirection }),
    );
  };
  const applyPreset = (nextPresetId: MtfScreenerPresetId) => {
    setPresetId(nextPresetId);
    setFilters(defaultMtfScreenerFilters);
  };
  const clearFilters = () => {
    setPresetId("custom");
    setFilters(defaultMtfScreenerFilters);
    setSymbolSearch("");
    setTableSortState(null);
  };
  const refreshData = () => {
    void latestQuery.refetch();
    void marketContextQuery.refetch();
  };
  const exportRows = (exportType: MtfScreenerExportType) => {
    const exportedAt = new Date().toISOString();
    const exportRows = getMtfScreenerExportRows({
      exportType,
      visibleRows,
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
    <PageShell>
      <PageHeader
        eyebrow="Research workspace"
        title="Multi-Timeframe Screener"
        tone="screener"
        description={`${shortResearchDisclaimer} Joined Binance USDT crypto scanner runs across 1h, 4h, 1d, and 1w. Full matching rows remain visible by default.`}
        actions={
          <button
            type="button"
            onClick={refreshData}
            disabled={latestQuery.isFetching || marketContextQuery.isFetching}
            className="ui-button h-8 px-3 text-[11px] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {latestQuery.isFetching || marketContextQuery.isFetching
              ? "Refreshing"
              : "Refresh"}
          </button>
        }
        metadata={[
          { label: "Dataset", value: "MTF latest joined", tone: "accent" },
          {
            label: "Visible rows",
            value: `${visibleRows.length} of ${rows.length}`,
            tone: visibleRows.length === rows.length ? "complete" : "info",
          },
          {
            label: "Sort",
            value: tableSortState
              ? `${tableSortState.key} ${tableSortState.direction}`
              : "Incoming order",
            tone: tableSortState ? "info" : "neutral",
          },
          {
            label: "Filters",
            value: isFullTableActive ? "Full table" : "Active",
            tone: isFullTableActive ? "complete" : "warning",
          },
        ]}
      />

      <div className="mb-2 max-w-[1120px]">
        <MarketContextPanel
          variant="compact"
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

      <div className="grid min-h-0 flex-1 gap-2 xl:grid-cols-[260px_minmax(0,1fr)]">
        <MtfScreenerControls
          filters={filters}
          symbolSearch={symbolSearch}
          onSymbolSearchChange={setSymbolSearch}
          onGroupChange={updateGroupFilter}
          onMinRankChange={updateMinRank}
          onExcludeRiskChange={updateExcludeRisk}
          onClear={clearFilters}
        />

        <main className="min-w-0 space-y-2">
          <MtfScreenerSourcePanel
            data={latestQuery.data}
            totalRows={rows.length}
            filteredRows={visibleRows.length}
            onExportVisible={() => exportRows("visible_rows")}
            onExportAll={() => exportRows("all_joined_rows")}
          />

          {latestQuery.isLoading ? (
            <MtfStatePanel message="Loading multi-timeframe latest scan data." />
          ) : latestQuery.isError ? (
            <MtfStatePanel message={getMtfErrorMessage(latestQuery.error)} />
          ) : rows.length === 0 ? (
            <MtfStatePanel message="No latest multi-timeframe rows are available yet." />
          ) : (
            <MtfScreenerTable
              rows={visibleRows}
              sortState={tableSortState}
              onSortChange={updateTableSort}
            />
          )}
        </main>
      </div>
    </PageShell>
  );
}

export function MtfScreenerTable({
  rows,
  sortState = null,
  onSortChange,
}: {
  rows: MtfScreenerRow[];
  sortState?: DataSortState<MtfScreenerTableSortKey> | null;
  onSortChange?: (
    key: MtfScreenerTableSortKey,
    defaultDirection: DataSortDirection,
  ) => void;
}) {
  if (rows.length === 0) {
    return (
      <MtfStatePanel message="No symbols match the selected multi-timeframe filters." />
    );
  }

  return (
    <PageSection
      title="Matching Symbols"
      description="Dense research table. Header buttons sort locally; clearing sort restores incoming API order."
      tone="rows"
      actions={
        <StatusBadge tone="accent" className="text-[11px]">
          {rows.length} research rows
        </StatusBadge>
      }
      className="overflow-hidden"
      bodyClassName="p-0"
    >
      <DataTableScroll>
        <DataTable minWidth="min-w-[1320px]" className="table-fixed">
          <thead className="bg-[var(--table-header)] text-[10px] uppercase tracking-normal text-[var(--muted)]">
            <tr>
              <DataTableHeaderCell
                rowSpan={2}
                sortKey="symbol"
                sortState={sortState}
                onSortChange={onSortChange}
                className="sticky left-0 z-20 w-[118px] bg-[var(--table-header)]"
              >
                Symbol
              </DataTableHeaderCell>
              <DataTableHeaderCell
                rowSpan={2}
                sortKey="combined_rank"
                sortState={sortState}
                defaultDirection="desc"
                onSortChange={onSortChange}
                align="right"
                className="w-[72px]"
              >
                Rank
              </DataTableHeaderCell>
              <DataTableHeaderCell
                rowSpan={2}
                sortKey="higher_timeframe_safety"
                sortState={sortState}
                defaultDirection="desc"
                onSortChange={onSortChange}
                className="w-[106px]"
              >
                Higher TF
              </DataTableHeaderCell>
              {MTF_SCREENER_TIMEFRAMES.map((timeframe) => (
                <DataTableHeaderCell
                  key={`${timeframe}-header`}
                  colSpan={2}
                  align="center"
                  className="border-l border-[var(--border)] text-center text-[var(--foreground)]"
                >
                  {timeframe}
                </DataTableHeaderCell>
              ))}
              <DataTableHeaderCell
                rowSpan={2}
                sortKey="signal"
                sortState={sortState}
                onSortChange={onSortChange}
                className="w-[156px]"
              >
                Signal
              </DataTableHeaderCell>
              <DataTableHeaderCell rowSpan={2} className="w-[230px]">
                Notes
              </DataTableHeaderCell>
              <DataTableHeaderCell rowSpan={2} className="w-[104px]">
                Research
              </DataTableHeaderCell>
            </tr>
            <tr>
              {MTF_SCREENER_TIMEFRAMES.map((timeframe) => (
                <TimeframeHeaderCells
                  key={timeframe}
                  timeframe={timeframe}
                  sortState={sortState}
                  onSortChange={onSortChange}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.symbol}
                className="group border-t border-[var(--border)] align-top odd:bg-[var(--panel-data)] even:bg-[var(--panel-muted)] hover:bg-[var(--row-hover)]"
              >
                <DataTableCell className="sticky left-0 z-10 bg-[var(--panel)] group-hover:bg-[var(--row-hover)]">
                  <div className="font-mono text-xs font-semibold text-[var(--foreground)]">
                    {row.symbol}
                  </div>
                  <div className="mt-0.5 text-[10px] uppercase text-[var(--muted)]">
                    {row.exchange} / {row.market}
                  </div>
                </DataTableCell>
                <DataTableCell align="right">
                  <span className="font-mono tabular-nums text-[var(--foreground)]">
                    {formatMtfCombinedRank(row)}
                  </span>
                </DataTableCell>
                <DataTableCell>
                  <HigherTimeframeHealthBadge row={row} />
                </DataTableCell>
                {MTF_SCREENER_TIMEFRAMES.map((timeframe) => (
                  <TimeframeCells
                    key={`${row.symbol}-${timeframe}`}
                    row={row}
                    timeframe={timeframe}
                  />
                ))}
                <DataTableCell
                  className="max-w-[156px] leading-4 text-[var(--foreground)]"
                  truncate
                  title={getMtfPrimarySignal(row)}
                >
                  {getMtfPrimarySignal(row)}
                </DataTableCell>
                <DataTableCell>
                  <RiskNotesCell row={row} />
                </DataTableCell>
                <DataTableCell>
                  <ResearchLink row={row} />
                </DataTableCell>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </DataTableScroll>
    </PageSection>
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
    <PageSection
      title="Research Buckets"
      description={`Triage groups for research starting points. Counts use the full joined universe before search or filter narrowing. ${shortResearchDisclaimer}`}
      className="mb-2"
      tone="screener"
      actions={
        <button
          type="button"
          onClick={onClear}
          aria-pressed={isFullTableActive}
          className={`min-h-8 border px-3 py-1.5 text-left text-[11px] transition ${
            isFullTableActive
              ? "border-[var(--accent)] bg-[var(--panel)] text-[var(--foreground)] shadow-[inset_0_-2px_0_var(--accent)]"
              : "border-[var(--border)] bg-[var(--control)] text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
          }`}
        >
          <span className="block font-semibold">Full Table</span>
          <span className="block font-mono tabular-nums">
            {rows.length} joined symbols
          </span>
        </button>
      }
    >

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        {buckets.map((bucket) => {
          const isActive = presetId === bucket.id;
          const tone = getMtfResearchBucketTone(bucket.id);

          return (
            <button
              key={bucket.id}
              type="button"
              title={bucket.implication}
              onClick={() => onBucketSelect(bucket.id)}
              aria-pressed={isActive}
              className={getMtfResearchBucketButtonClass(tone, isActive)}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="text-[11px] font-semibold text-[var(--foreground)]">
                  {bucket.label}
                </span>
                <span className="text-right">
                  <span className={`block font-mono text-sm tabular-nums ${getMtfResearchBucketValueClass(tone)}`}>
                    {bucket.count}
                  </span>
                  <span className="block text-[10px] leading-3 text-[var(--muted)]">
                    matching symbols
                  </span>
                </span>
              </span>
              <span className="mt-1 block text-[11px] leading-4 text-[var(--muted)]">
                {bucket.description}
              </span>
              <span className="mt-0.5 block truncate text-[10px] leading-4 text-[var(--muted)]">
                {bucket.implication}
              </span>
            </button>
          );
        })}
      </div>
    </PageSection>
  );
}

function MtfScreenerControls({
  filters,
  symbolSearch,
  onSymbolSearchChange,
  onGroupChange,
  onMinRankChange,
  onExcludeRiskChange,
  onClear,
}: {
  filters: MtfScreenerFilters;
  symbolSearch: string;
  onSymbolSearchChange: (value: string) => void;
  onGroupChange: (
    timeframe: MtfScreenerTimeframe,
    value: MtfScreenerGroupFilter,
  ) => void;
  onMinRankChange: (timeframe: MtfScreenerTimeframe, value: string) => void;
  onExcludeRiskChange: (key: "exclude1dRisk" | "exclude1wRisk") => void;
  onClear: () => void;
}) {
  return (
    <aside className="border border-[var(--border)] bg-[var(--panel)] p-2.5 shadow-[var(--shadow-panel)] xl:h-fit xl:max-h-[calc(100vh-5rem)] xl:overflow-y-auto">
      <div className="mb-2 flex items-center justify-between gap-2 border-b border-[var(--border)] pb-2">
        <h2 className="text-[13px] font-semibold">Screener Filters</h2>
        <button
          type="button"
          onClick={onClear}
          className="ui-button h-7 px-2 text-[11px]"
        >
          Clear
        </button>
      </div>

      <ControlGroup>
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
      </ControlGroup>

      <ControlGroup title="Group Filters" className="mt-3">
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
      </ControlGroup>

      <ControlGroup title="Minimum Rank" className="mt-3">
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
      </ControlGroup>

      <ControlGroup title="Risk Exclusions" className="mt-3">
        <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <input
            type="checkbox"
            checked={filters.exclude1dRisk}
            onChange={() => onExcludeRiskChange("exclude1dRisk")}
            className="accent-[var(--accent)]"
          />
          Exclude 1d risk
        </label>
        <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <input
            type="checkbox"
            checked={filters.exclude1wRisk}
            onChange={() => onExcludeRiskChange("exclude1wRisk")}
            className="accent-[var(--accent)]"
          />
          Exclude 1w risk
        </label>
      </ControlGroup>
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
    <PageSection
      title="Data Source / Run Freshness"
      description="Latest selected crypto scanner runs joined across 1h, 4h, 1d, and 1w."
      tone="summary"
      actions={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <StatusBadge tone={filteredRows === totalRows ? "complete" : "info"}>
            Showing {filteredRows} of {totalRows} joined symbols
          </StatusBadge>
          <MtfScreenerExportControls
            visibleRowsCount={filteredRows}
            allRowsCount={totalRows}
            onExportVisible={onExportVisible}
            onExportAll={onExportAll}
          />
        </div>
      }
      bodyClassName="px-3 py-2"
    >
      <div className="grid gap-x-4 gap-y-2 md:grid-cols-2 xl:grid-cols-4">
        {MTF_SCREENER_TIMEFRAMES.map((timeframe) => {
          const run = data?.runs[timeframe];
          const signalCount = data?.signalCounts[timeframe] ?? 0;
          const missingCount = data?.missingCounts[timeframe] ?? 0;

          return (
            <MetricCard
              key={timeframe}
              label={timeframe}
              value={run ? formatDateTime(run.finishedAt ?? run.startedAt) : "No run"}
              detail={
                run
                  ? `${signalCount} signals, ${missingCount} missing`
                  : "No selected latest run"
              }
              tone={!run ? "missing" : missingCount > 0 ? "warning" : "complete"}
            />
          );
        })}
      </div>
    </PageSection>
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
        className="ui-button h-7 px-2 text-[11px] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Export Visible Rows
      </button>
      <button
        type="button"
        onClick={onExportAll}
        disabled={allRowsCount === 0}
        className="ui-button h-7 px-2 text-[11px] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Export All Joined Rows
      </button>
    </div>
  );
}

function MtfStatePanel({ message }: { message: string }) {
  return (
    <EmptyState title="Screener state" message={message} />
  );
}

export function getMtfScreenerTableSortValue(
  row: MtfScreenerRow,
  key: MtfScreenerTableSortKey,
): DataSortValue {
  switch (key) {
    case "symbol":
      return row.symbol;
    case "combined_rank":
      return getMtfCombinedRank(row);
    case "higher_timeframe_safety":
      return getMtfHigherTimeframeHealth(row).sortRank;
    case "signal":
      return getMtfPrimarySignal(row);
  }

  const rankTimeframe = getMtfTableSortTimeframe(key, "_rank");

  if (rankTimeframe) {
    return row.snapshots[rankTimeframe]?.rankScore ?? null;
  }

  const groupTimeframe = getMtfTableSortTimeframe(key, "_group");

  if (groupTimeframe) {
    return getMtfGroupSortRank(row.snapshots[groupTimeframe]?.resultGroup);
  }

  return null;
}

function getMtfTableSortTimeframe(
  key: MtfScreenerTableSortKey,
  suffix: "_group" | "_rank",
) {
  if (!key.endsWith(suffix)) {
    return null;
  }

  const timeframe = key.slice(0, -suffix.length);

  return MTF_SCREENER_TIMEFRAMES.includes(timeframe as MtfScreenerTimeframe)
    ? (timeframe as MtfScreenerTimeframe)
    : null;
}

function getMtfGroupSortRank(group: string | null | undefined) {
  switch (group) {
    case "eligible":
      return 5;
    case "watch":
      return 4;
    case "neutral":
      return 3;
    case "overheated":
      return 2;
    case "risk":
      return 1;
    case "insufficient_history":
      return 0;
    default:
      return null;
  }
}

function TimeframeHeaderCells({
  timeframe,
  sortState,
  onSortChange,
}: {
  timeframe: MtfScreenerTimeframe;
  sortState: DataSortState<MtfScreenerTableSortKey> | null;
  onSortChange?: (
    key: MtfScreenerTableSortKey,
    defaultDirection: DataSortDirection,
  ) => void;
}) {
  return (
    <>
      <DataTableHeaderCell
        sortKey={`${timeframe}_group`}
        sortState={sortState}
        defaultDirection="desc"
        onSortChange={onSortChange}
        className="w-[78px] border-l border-[var(--border)]"
      >
        Group
        <span className="sr-only"> for {timeframe}</span>
      </DataTableHeaderCell>
      <DataTableHeaderCell
        sortKey={`${timeframe}_rank`}
        sortState={sortState}
        defaultDirection="desc"
        onSortChange={onSortChange}
        align="right"
        className="w-[52px]"
      >
        Rank
        <span className="sr-only"> for {timeframe}</span>
      </DataTableHeaderCell>
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
      <DataTableCell className="border-l border-[var(--border)]">
        <GroupBadge group={snapshot?.resultGroup}>{formatMtfGroup(snapshot)}</GroupBadge>
      </DataTableCell>
      <DataTableCell align="right">
        <span className="font-mono tabular-nums text-[var(--foreground)]">
          {formatMtfRank(snapshot)}
        </span>
      </DataTableCell>
    </>
  );
}

function GroupBadge({
  group,
  children,
}: {
  group?: string;
  children: React.ReactNode;
}) {
  return (
    <DataTableChip
      tone={getMtfGroupChipTone(group)}
      className="min-w-[72px] justify-center"
    >
      {children}
    </DataTableChip>
  );
}

function getMtfGroupChipTone(group: string | null | undefined): ChipTone {
  switch (group) {
    case "eligible":
      return "eligible";
    case "watch":
      return "watch";
    case "overheated":
      return "overheated";
    case "risk":
      return "risk";
    default:
      return "neutral";
  }
}

function getMtfResearchBucketTone(id: MtfScreenerPresetId): StatusTone {
  switch (id) {
    case "mtf_strength":
      return "eligible";
    case "short_term_repair":
    case "higher_timeframe_safe_watchlist":
      return "watch";
    case "overheated_caution":
      return "overheated";
    case "breakdown_risk":
      return "risk";
  }
}

function getMtfResearchBucketValueClass(tone: StatusTone) {
  switch (tone) {
    case "eligible":
      return "text-[var(--eligible)]";
    case "watch":
      return "text-[var(--watch)]";
    case "overheated":
      return "text-[var(--overheated)]";
    case "risk":
      return "text-[var(--risk)]";
    default:
      return "text-[var(--foreground)]";
  }
}

function getMtfResearchBucketButtonClass(tone: StatusTone, isActive: boolean) {
  const base =
    "min-h-[76px] border border-l-4 bg-[var(--panel)] px-2.5 py-2 text-left transition";
  const toneClass = getMtfResearchBucketBorderClass(tone);

  return isActive
    ? `${base} ${toneClass} border-[var(--accent)] shadow-[inset_0_-2px_0_var(--accent)]`
    : `${base} ${toneClass} border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--row-hover)]`;
}

function getMtfResearchBucketBorderClass(tone: StatusTone) {
  switch (tone) {
    case "eligible":
      return "border-l-[var(--eligible)]";
    case "watch":
      return "border-l-[var(--watch)]";
    case "overheated":
      return "border-l-[var(--overheated)]";
    case "risk":
      return "border-l-[var(--risk)]";
    default:
      return "border-l-[var(--neutral)]";
  }
}

function getHigherTimeframeHealthChipTone(code: string): ChipTone {
  switch (code) {
    case "higher_tf_ok":
      return "positive";
    case "limited_htf_data":
      return "info";
    case "higher_tf_risk":
    case "one_day_risk":
    case "one_week_risk":
      return "danger";
    default:
      return "warning";
  }
}

function HigherTimeframeHealthBadge({ row }: { row: MtfScreenerRow }) {
  const health = getMtfHigherTimeframeHealth(row);
  return (
    <DataTableChip tone={getHigherTimeframeHealthChipTone(health.code)}>
      {health.label}
    </DataTableChip>
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
          <DataTableChip key={note} title={note}>
            {note}
          </DataTableChip>
        ))}
        {summary.hiddenCount > 0 ? (
          <DataTableChip
            tone="warning"
            title={summary.hiddenNotes.join("; ")}
          >
            +{summary.hiddenCount} risk notes
          </DataTableChip>
        ) : null}
      </div>
    </div>
  );
}

function ResearchLink({ row }: { row: MtfScreenerRow }) {
  const timeframe = getMtfSymbolResearchTimeframe(row);

  return (
    <Link
      href={buildMtfSymbolResearchHref({ row, timeframe })}
      className="inline-flex min-w-[88px] justify-center border border-[var(--info)] bg-[var(--info-bg)] px-2 py-1 text-[11px] font-semibold text-[var(--info)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
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

const controlClass =
  "h-8 w-full border border-[var(--border)] bg-[var(--control)] px-2 text-xs text-[var(--foreground)] shadow-[inset_0_1px_0_rgba(15,23,42,0.03)] focus:border-[var(--accent)]";
