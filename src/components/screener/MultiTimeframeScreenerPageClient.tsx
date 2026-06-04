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
  PageShell,
  StatusBadge,
  type StatusTone,
} from "@/components/ui/workspace";
import {
  formatDateTime,
  formatGroupLabel,
} from "@/components/scanner/latestScanUi";
import { MarketContextPanel } from "@/components/market-context/MarketContextPanel";
import {
  fetchMarketContext,
  type MarketContextResponse,
} from "@/components/market-context/marketContextUi";
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
  mtfResearchBuckets,
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

export const mtfScreenerProductionCopy = {
  title: "Multi-Timeframe Screener",
  description: "Compare joined scanner signals across 1h, 4h, 1d, and 1w.",
};

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
  const activeFilterLabels = useMemo(
    () => getActiveMtfFilterLabels(filters, symbolSearch),
    [filters, symbolSearch],
  );

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
    <PageShell className="screener-terminal overflow-x-hidden">
      <MtfScreenerCommandBar
        title={mtfScreenerProductionCopy.title}
        datasetLabel="Latest joined rows"
        statusLabel={getMtfQueryStatusLabel({
          isLoading: latestQuery.isLoading,
          isError: latestQuery.isError,
          rowCount: rows.length,
        })}
        statusTone={getMtfQueryStatusTone({
          isLoading: latestQuery.isLoading,
          isError: latestQuery.isError,
          rowCount: rows.length,
        })}
        totalRows={rows.length}
        visibleRows={visibleRows.length}
        presetId={presetId}
        isFullTableActive={isFullTableActive}
        activeFilterCount={activeFilterLabels.length}
        sortState={tableSortState}
        sourceData={latestQuery.data}
        onRefresh={refreshData}
        isRefreshing={latestQuery.isFetching || marketContextQuery.isFetching}
        onExportVisible={() => exportRows("visible_rows")}
        onExportAll={() => exportRows("all_joined_rows")}
      />

      <MtfResearchBucketsPanel
        rows={rows}
        presetId={presetId}
        isFullTableActive={isFullTableActive}
        onBucketSelect={applyPreset}
        onClear={clearFilters}
      />

      <div className="grid min-h-0 flex-1 gap-2 xl:grid-cols-[190px_minmax(0,1fr)] 2xl:grid-cols-[190px_minmax(0,1fr)_226px]">
        <MtfScreenerControls
          filters={filters}
          symbolSearch={symbolSearch}
          onSymbolSearchChange={setSymbolSearch}
          onGroupChange={updateGroupFilter}
          onMinRankChange={updateMinRank}
          onExcludeRiskChange={updateExcludeRisk}
          onClear={clearFilters}
          marketContextData={marketContextQuery.data}
          marketContextIsLoading={marketContextQuery.isLoading}
          marketContextIsError={marketContextQuery.isError}
          className="order-2 xl:order-1"
        />

        <main className="order-1 min-w-0 space-y-2 xl:order-2">
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
              sourceData={latestQuery.data}
              totalRows={rows.length}
              filteredRows={visibleRows.length}
            />
          )}
        </main>

        <MtfScreenerDetailRail
          rows={visibleRows}
          totalRows={rows.length}
          filteredRows={visibleRows.length}
          presetId={presetId}
          isFullTableActive={isFullTableActive}
          activeFilterCount={activeFilterLabels.length}
          sortState={tableSortState}
          className="order-3"
        />
      </div>
    </PageShell>
  );
}

export function MtfScreenerTable({
  rows,
  sortState = null,
  onSortChange,
  sourceData,
  totalRows = rows.length,
  filteredRows = rows.length,
  onExportVisible,
  onExportAll,
}: {
  rows: MtfScreenerRow[];
  sortState?: DataSortState<MtfScreenerTableSortKey> | null;
  onSortChange?: (
    key: MtfScreenerTableSortKey,
    defaultDirection: DataSortDirection,
  ) => void;
  sourceData?: MtfLatestScreenerResponse;
  totalRows?: number;
  filteredRows?: number;
  onExportVisible?: () => void;
  onExportAll?: () => void;
}) {
  if (rows.length === 0) {
    return (
      <MtfStatePanel message="No symbols match the selected multi-timeframe filters." />
    );
  }

  return (
    <section className="overflow-hidden border border-[var(--border-medium)] bg-[var(--panel-data)] shadow-[var(--shadow-panel)]">
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2 border-b border-[var(--border-medium)] bg-[var(--table-header)] px-2 py-1">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <h2 className="text-[12px] font-semibold uppercase tracking-normal text-[var(--foreground)]">
            Joined Symbol Table
          </h2>
          <StatusBadge tone="accent" className="text-[10px]">
            Showing {filteredRows} of {totalRows} symbols
          </StatusBadge>
          {sourceData ? (
            <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">
              {sourceData.assetClass} / {sourceData.timeframes.join(" ")}
            </span>
          ) : null}
          <MtfScreenerIndicatorToolbar />
        </div>
        {onExportVisible && onExportAll ? (
          <MtfScreenerExportControls
            visibleRowsCount={filteredRows}
            allRowsCount={totalRows}
            onExportVisible={onExportVisible}
            onExportAll={onExportAll}
          />
        ) : null}
      </div>
      <DataTableScroll>
        <DataTable minWidth="min-w-[1440px]" className="table-fixed">
          <thead className="bg-[var(--table-header)] text-[10px] uppercase tracking-normal text-[var(--muted)]">
            <tr>
              <DataTableHeaderCell
                sortKey="symbol"
                sortState={sortState}
                onSortChange={onSortChange}
                rowSpan={2}
                className="sticky left-0 top-0 z-30 w-[148px] border-r border-[var(--border-medium)] bg-[var(--table-header)]"
              >
                Symbol
              </DataTableHeaderCell>
              <DataTableHeaderCell
                colSpan={2}
                align="center"
                className="sticky top-0 z-20 border-l border-[var(--table-group)] bg-[var(--table-header-strong)] text-[var(--foreground)]"
              >
                Aggregate
              </DataTableHeaderCell>
              {MTF_SCREENER_TIMEFRAMES.map((timeframe) => (
                <DataTableHeaderCell
                  key={timeframe}
                  colSpan={2}
                  align="center"
                  className="sticky top-0 z-20 border-l border-[var(--table-group)] bg-[var(--table-header-strong)] text-[var(--foreground)]"
                >
                  {timeframe}
                </DataTableHeaderCell>
              ))}
              <DataTableHeaderCell
                rowSpan={2}
                sortKey="signal"
                sortState={sortState}
                onSortChange={onSortChange}
                className="sticky top-0 z-20 w-[164px] border-l border-[var(--table-group)] bg-[var(--table-header)]"
              >
                Signal
              </DataTableHeaderCell>
              <DataTableHeaderCell
                rowSpan={2}
                className="sticky top-0 z-20 w-[176px] bg-[var(--table-header)]"
              >
                Notes
              </DataTableHeaderCell>
              <DataTableHeaderCell
                rowSpan={2}
                className="sticky top-0 z-20 w-[104px] bg-[var(--table-header)]"
              >
                Research
              </DataTableHeaderCell>
            </tr>
            <tr>
              <DataTableHeaderCell
                sortKey="combined_rank"
                sortState={sortState}
                defaultDirection="desc"
                onSortChange={onSortChange}
                align="right"
                className="sticky top-6 z-20 w-[66px] border-l border-[var(--table-group)] bg-[var(--table-header)]"
              >
                Rank
              </DataTableHeaderCell>
              <DataTableHeaderCell
                sortKey="higher_timeframe_safety"
                sortState={sortState}
                defaultDirection="desc"
                onSortChange={onSortChange}
                className="sticky top-6 z-20 w-[112px] bg-[var(--table-header)]"
              >
                Higher TF
              </DataTableHeaderCell>
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
                className="group border-t border-[var(--table-grid)] align-top odd:bg-[var(--panel-data)] even:bg-[var(--panel-muted)] hover:bg-[var(--row-hover)] hover:shadow-[inset_3px_0_0_var(--accent)] focus-within:bg-[var(--row-selected)] focus-within:shadow-[inset_3px_0_0_var(--accent)]"
              >
                <DataTableCell className="sticky left-0 z-10 border-r border-[var(--border-medium)] bg-inherit group-hover:bg-[var(--row-hover)]">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className={`h-2 w-2 shrink-0 ${getMtfRowStateDotClass(row)}`} />
                    <span className="min-w-0 truncate font-mono text-[12px] font-semibold text-[var(--foreground)]">
                      {row.symbol}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-[9px] uppercase text-[var(--muted)]">
                    {row.exchange} / {row.market}
                  </div>
                </DataTableCell>
                <DataTableCell
                  align="right"
                  className="border-l border-[var(--table-group)]"
                >
                  <span className={`font-mono tabular-nums ${getMtfRankValueClass(getMtfCombinedRank(row))}`}>
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
                  className="max-w-[164px] border-l border-[var(--table-group)] leading-4 text-[var(--foreground)]"
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
    </section>
  );
}

function MtfScreenerIndicatorToolbar() {
  return (
    <div
      aria-label="MTF indicator toolbar"
      className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-[10px] [scrollbar-gutter:stable]"
    >
      <span className="shrink-0 border-l border-[var(--border-medium)] pl-2 font-semibold uppercase text-[var(--muted)]">
        MTF
      </span>
      {MTF_SCREENER_TIMEFRAMES.map((timeframe) => (
        <span
          key={timeframe}
          className="shrink-0 border border-[var(--border)] bg-[var(--panel-muted)] px-1.5 py-0.5 font-mono font-semibold uppercase text-[var(--foreground)]"
        >
          {timeframe}
        </span>
      ))}
      <span className="shrink-0 border-l border-[var(--border-medium)] pl-2 font-semibold uppercase text-[var(--muted)]">
        States
      </span>
      <StatusBadge tone="eligible" className="shrink-0 text-[10px]">
        Eligible
      </StatusBadge>
      <StatusBadge tone="watch" className="shrink-0 text-[10px]">
        Watch
      </StatusBadge>
      <StatusBadge tone="risk" className="shrink-0 text-[10px]">
        Risk
      </StatusBadge>
      <StatusBadge tone="overheated" className="shrink-0 text-[10px]">
        Hot
      </StatusBadge>
      <StatusBadge tone="neutral" className="shrink-0 text-[10px]">
        Neutral
      </StatusBadge>
    </div>
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

export function MtfScreenerCommandBar({
  title,
  datasetLabel,
  statusLabel,
  statusTone = "neutral",
  totalRows,
  visibleRows,
  presetId,
  isFullTableActive,
  activeFilterCount,
  sortState,
  sourceData,
  onRefresh,
  isRefreshing = false,
  onExportVisible,
  onExportAll,
}: {
  title: string;
  datasetLabel: string;
  statusLabel: string;
  statusTone?: StatusTone;
  totalRows: number;
  visibleRows: number;
  presetId: MtfScreenerPresetId | "custom";
  isFullTableActive: boolean;
  activeFilterCount: number;
  sortState?: DataSortState<MtfScreenerTableSortKey> | null;
  sourceData?: MtfLatestScreenerResponse;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onExportVisible?: () => void;
  onExportAll?: () => void;
}) {
  return (
    <header className="mb-1.5 overflow-hidden border border-[var(--terminal-bar-border)] bg-[var(--terminal-bar)] text-[var(--terminal-bar-foreground)] shadow-[var(--shadow-panel)]">
      <div className="flex min-w-0 items-center gap-1 overflow-x-auto border-b border-white/10 bg-white/[0.035] px-2 py-1 text-[10px] font-semibold uppercase text-[var(--terminal-bar-muted)] [scrollbar-gutter:stable]">
        <span className="shrink-0 border-b border-[var(--accent)] px-1.5 py-0.5 text-[var(--terminal-bar-foreground)]">
          Screener
        </span>
        <span className="shrink-0 px-1.5 py-0.5">Crypto</span>
        <span className="shrink-0 px-1.5 py-0.5">MTF Joined</span>
        <span className="shrink-0 px-1.5 py-0.5">Research</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-2 py-1.5">
        <div className="min-w-[230px] flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h1 className="text-[14px] font-semibold leading-5">{title}</h1>
            <span className="border border-white/15 bg-white/[0.08] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--terminal-bar-muted)]">
              Research only
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] uppercase text-[var(--terminal-bar-muted)]">
            <span>{datasetLabel}</span>
            <span aria-hidden="true">/</span>
            <span>Joined MTF universe</span>
          </div>
        </div>

        <div className="grid min-w-0 flex-[3_1_560px] grid-cols-2 gap-1 md:grid-cols-4">
          <MtfCommandStat
            label="Dataset"
            value={statusLabel}
            tone={statusTone}
          />
          <MtfCommandStat
            label="Visible"
            value={`${visibleRows}/${totalRows}`}
            tone={visibleRows === totalRows ? "complete" : "info"}
          />
          <MtfCommandStat
            label="Bucket / filters"
            value={`${getMtfActiveBucketLabel(presetId, isFullTableActive)} · ${getMtfFilterStateLabel({
              activeFilterCount,
              presetId,
              isFullTableActive,
            })}`}
            tone={isFullTableActive ? "complete" : "warning"}
          />
          <MtfCommandStat
            label="Sort"
            value={formatMtfTableSortState(sortState)}
            tone={sortState ? "info" : "neutral"}
          />
        </div>

        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1">
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="inline-flex h-7 items-center justify-center border border-white/20 bg-white/[0.08] px-2 text-[11px] font-semibold text-[var(--terminal-bar-foreground)] transition hover:border-white/35 hover:bg-white/[0.14] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {isRefreshing ? "Refreshing" : "Refresh"}
            </button>
          ) : null}
          {onExportVisible && onExportAll ? (
            <MtfScreenerExportControls
              visibleRowsCount={visibleRows}
              allRowsCount={totalRows}
              onExportVisible={onExportVisible}
              onExportAll={onExportAll}
              variant="terminal"
            />
          ) : null}
        </div>
      </div>

      <div className="border-t border-white/10 bg-[#12303c] px-2 py-1">
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto text-[10px] [scrollbar-gutter:stable]">
          <span className="shrink-0 font-semibold uppercase text-[var(--terminal-bar-muted)]">
            Freshness
          </span>
          {MTF_SCREENER_TIMEFRAMES.map((timeframe) => (
            <MtfFreshnessPill
              key={timeframe}
              timeframe={timeframe}
              sourceData={sourceData}
            />
          ))}
        </div>
      </div>
    </header>
  );
}

function MtfCommandStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: StatusTone;
}) {
  return (
    <div
      className={`min-w-0 border border-white/10 border-l-2 bg-white/[0.055] px-2 py-1 ${getMtfTerminalToneBorderClass(tone)}`}
    >
      <div className="truncate text-[9px] font-semibold uppercase text-[var(--terminal-bar-muted)]">
        {label}
      </div>
      <div className="truncate font-mono text-[11px] font-semibold leading-4 text-[var(--terminal-bar-foreground)]">
        {value}
      </div>
    </div>
  );
}

function MtfFreshnessPill({
  timeframe,
  sourceData,
}: {
  timeframe: MtfScreenerTimeframe;
  sourceData?: MtfLatestScreenerResponse;
}) {
  const run = sourceData?.runs[timeframe];
  const signalCount = sourceData?.signalCounts[timeframe] ?? 0;
  const missingCount = sourceData?.missingCounts[timeframe] ?? 0;
  const tone: StatusTone = !run
    ? "missing"
    : missingCount > 0
      ? "warning"
      : "complete";
  const timestamp = run ? formatDateTime(run.finishedAt ?? run.startedAt) : "No run";

  return (
    <StatusBadge
      tone={tone}
      title={
        run
          ? `${timeframe}: ${timestamp}; ${signalCount} signals, ${missingCount} missing`
          : `${timeframe}: no selected latest run`
      }
      className="shrink-0 gap-1 text-[10px]"
    >
      <span className="font-mono uppercase">{timeframe}</span>
      <span className="max-w-[138px] truncate">{timestamp}</span>
      <span className="font-mono tabular-nums">
        {run ? `${signalCount}/${missingCount}` : "missing"}
      </span>
    </StatusBadge>
  );
}

function getMtfQueryStatusLabel({
  isLoading,
  isError,
  rowCount,
}: {
  isLoading: boolean;
  isError: boolean;
  rowCount: number;
}) {
  if (isLoading) {
    return "Loading";
  }

  if (isError) {
    return "API error";
  }

  return rowCount > 0 ? "Loaded" : "Empty";
}

function getMtfQueryStatusTone({
  isLoading,
  isError,
  rowCount,
}: {
  isLoading: boolean;
  isError: boolean;
  rowCount: number;
}): StatusTone {
  if (isError) {
    return "risk";
  }

  if (isLoading) {
    return "info";
  }

  return rowCount > 0 ? "complete" : "missing";
}

function getMtfTerminalToneBorderClass(tone: StatusTone) {
  switch (tone) {
    case "eligible":
    case "positive":
    case "complete":
      return "border-l-[var(--eligible)]";
    case "watch":
    case "info":
      return "border-l-[var(--watch)]";
    case "overheated":
    case "warning":
    case "partial":
      return "border-l-[var(--overheated)]";
    case "risk":
    case "negative":
    case "danger":
      return "border-l-[var(--risk)]";
    case "accent":
      return "border-l-[var(--accent)]";
    default:
      return "border-l-[var(--missing)]";
  }
}

function getMtfActiveBucketLabel(
  presetId: MtfScreenerPresetId | "custom",
  isFullTableActive: boolean,
) {
  if (isFullTableActive) {
    return "Full Table";
  }

  if (presetId === "custom") {
    return "Custom";
  }

  return (
    mtfResearchBuckets.find((bucket) => bucket.id === presetId)?.label ??
    "Custom"
  );
}

function getMtfFilterStateLabel({
  activeFilterCount,
  presetId,
  isFullTableActive,
}: {
  activeFilterCount: number;
  presetId: MtfScreenerPresetId | "custom";
  isFullTableActive: boolean;
}) {
  if (isFullTableActive) {
    return "No filters";
  }

  if (activeFilterCount > 0) {
    return `${activeFilterCount} manual`;
  }

  return presetId === "custom" ? "Adjusted" : "Preset";
}

function formatMtfTableSortState(
  sortState?: DataSortState<MtfScreenerTableSortKey> | null,
) {
  if (!sortState) {
    return "Incoming order";
  }

  return `${formatMtfSortKeyLabel(sortState.key)} ${sortState.direction.toUpperCase()}`;
}

function formatMtfSortKeyLabel(key: MtfScreenerTableSortKey) {
  switch (key) {
    case "symbol":
      return "Symbol";
    case "combined_rank":
      return "Rank";
    case "higher_timeframe_safety":
      return "Higher TF";
    case "signal":
      return "Signal";
  }

  const rankTimeframe = getMtfTableSortTimeframe(key, "_rank");

  if (rankTimeframe) {
    return `${rankTimeframe} rank`;
  }

  const groupTimeframe = getMtfTableSortTimeframe(key, "_group");

  if (groupTimeframe) {
    return `${groupTimeframe} group`;
  }

  return key;
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
    <section
      aria-label="Research Buckets"
      className="mb-1.5 min-w-0 border border-[var(--border-medium)] bg-[var(--panel-data)] shadow-[var(--shadow-panel)]"
    >
      <div className="flex min-w-0 items-center gap-1 overflow-x-auto px-1.5 py-1 [scrollbar-gutter:stable]">
        <div className="shrink-0 px-1.5 text-[10px] font-semibold uppercase text-[var(--muted)]">
          Buckets
        </div>
        <button
          type="button"
          title="Full Table: all joined rows before preset buckets."
          onClick={onClear}
          aria-pressed={isFullTableActive}
          className={getMtfResearchBucketButtonClass("accent", isFullTableActive)}
        >
          <span className="min-w-0 truncate font-semibold">Full Table</span>
          <span className="font-mono tabular-nums">{rows.length}</span>
        </button>
        {buckets.map((bucket) => {
          const isActive = presetId === bucket.id;
          const tone = getMtfResearchBucketTone(bucket.id);

          return (
            <button
              key={bucket.id}
              type="button"
              title={`${bucket.label}: ${bucket.description}`}
              onClick={() => onBucketSelect(bucket.id)}
              aria-pressed={isActive}
              className={getMtfResearchBucketButtonClass(tone, isActive)}
            >
              <span className="min-w-0 truncate font-semibold">{bucket.label}</span>
              <span className={`font-mono tabular-nums ${getMtfResearchBucketValueClass(tone)}`}>
                {bucket.count}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function MtfScreenerDetailRail({
  rows,
  totalRows,
  filteredRows,
  presetId,
  isFullTableActive,
  activeFilterCount,
  sortState,
  className = "",
}: {
  rows: MtfScreenerRow[];
  totalRows: number;
  filteredRows: number;
  presetId: MtfScreenerPresetId | "custom";
  isFullTableActive: boolean;
  activeFilterCount: number;
  sortState?: DataSortState<MtfScreenerTableSortKey> | null;
  className?: string;
}) {
  const focusRows = rows.slice(0, 4);

  return (
    <aside
      aria-label="Screener detail rail"
      className={`hidden min-w-0 border border-[var(--border-medium)] bg-[var(--panel-data)] shadow-[var(--shadow-panel)] 2xl:block 2xl:h-fit 2xl:max-h-[calc(100vh-6rem)] 2xl:overflow-y-auto ${className}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border-medium)] bg-[var(--table-header)] px-2 py-1.5">
        <h2 className="truncate text-[12px] font-semibold uppercase text-[var(--foreground)]">
          Detail Rail
        </h2>
        <StatusBadge tone="info" className="shrink-0 text-[10px]">
          Ready
        </StatusBadge>
      </div>

      <div className="space-y-2 p-2">
        <div className="grid grid-cols-2 gap-1">
          <MtfDetailRailMetric
            label="Rows"
            value={`${filteredRows}/${totalRows}`}
            tone={filteredRows === totalRows ? "complete" : "info"}
          />
          <MtfDetailRailMetric
            label="Bucket"
            value={getMtfActiveBucketLabel(presetId, isFullTableActive)}
            tone={isFullTableActive ? "complete" : "warning"}
          />
          <MtfDetailRailMetric
            label="Filters"
            value={
              getMtfFilterStateLabel({
                activeFilterCount,
                presetId,
                isFullTableActive,
              })
            }
            tone={activeFilterCount > 0 ? "watch" : "neutral"}
          />
          <MtfDetailRailMetric
            label="Sort"
            value={formatMtfTableSortState(sortState)}
            tone={sortState ? "info" : "neutral"}
          />
        </div>

        <div className="border-t border-[var(--border)] pt-2">
          <div className="mb-1 text-[10px] font-semibold uppercase text-[var(--muted)]">
            State Key
          </div>
          <div className="flex flex-wrap gap-1">
            <StatusBadge tone="eligible" className="text-[10px]">
              Eligible
            </StatusBadge>
            <StatusBadge tone="watch" className="text-[10px]">
              Watch
            </StatusBadge>
            <StatusBadge tone="risk" className="text-[10px]">
              Risk
            </StatusBadge>
            <StatusBadge tone="overheated" className="text-[10px]">
              Hot
            </StatusBadge>
            <StatusBadge tone="neutral" className="text-[10px]">
              Neutral
            </StatusBadge>
          </div>
        </div>

        <div className="border-t border-[var(--border)] pt-2">
          <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase text-[var(--muted)]">
            <span>Focus Rows</span>
            <span className="font-mono">{focusRows.length}</span>
          </div>
          <div className="space-y-1">
            {focusRows.length > 0 ? (
              focusRows.map((row) => {
                const timeframe = getMtfSymbolResearchTimeframe(row);

                return (
                  <Link
                    key={row.symbol}
                    href={buildMtfSymbolResearchHref({ row, timeframe })}
                    className="group/detail block border border-[var(--border)] bg-[var(--panel-muted)] px-2 py-1.5 text-[11px] transition hover:border-[var(--accent-border)] hover:bg-[var(--row-hover)]"
                  >
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span
                          className={`h-2 w-2 shrink-0 ${getMtfRowStateDotClass(row)}`}
                        />
                        <span className="truncate font-mono font-semibold text-[var(--foreground)]">
                          {row.symbol}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 font-mono tabular-nums ${getMtfRankValueClass(getMtfCombinedRank(row))}`}
                      >
                        {formatMtfCombinedRank(row)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[var(--muted)]">
                      <span className="truncate">{getMtfPrimarySignal(row)}</span>
                      <span className="shrink-0 font-mono uppercase text-[var(--info)] group-hover/detail:text-[var(--accent)]">
                        {timeframe}
                      </span>
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="border border-[var(--border)] bg-[var(--panel-muted)] px-2 py-2 text-[11px] text-[var(--muted)]">
                No rows
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

function MtfDetailRailMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: StatusTone;
}) {
  return (
    <div
      className={`min-w-0 border border-l-2 border-[var(--border)] bg-[var(--panel-muted)] px-2 py-1 ${getMtfResearchBucketBorderClass(tone)}`}
    >
      <div className="truncate text-[9px] font-semibold uppercase text-[var(--muted)]">
        {label}
      </div>
      <div className="truncate font-mono text-[10px] font-semibold leading-4 text-[var(--foreground)]">
        {value}
      </div>
    </div>
  );
}

export function MtfScreenerControls({
  filters,
  symbolSearch,
  onSymbolSearchChange,
  onGroupChange,
  onMinRankChange,
  onExcludeRiskChange,
  onClear,
  marketContextData,
  marketContextIsLoading = false,
  marketContextIsError = false,
  className = "",
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
  marketContextData?: MarketContextResponse | null;
  marketContextIsLoading?: boolean;
  marketContextIsError?: boolean;
  className?: string;
}) {
  const activeFilterLabels = getActiveMtfFilterLabels(filters, symbolSearch);

  return (
    <aside className={`border border-[var(--border-medium)] bg-[var(--panel-data)] shadow-[var(--shadow-panel)] xl:h-fit xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto ${className}`}>
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border-medium)] bg-[var(--table-header)] px-2 py-1.5">
        <div className="min-w-0">
          <h2 className="text-[12px] font-semibold uppercase text-[var(--foreground)]">
            Tool Panel
          </h2>
          <p className="text-[10px] text-[var(--muted)]">
            {activeFilterLabels.length === 0
              ? "Full dataset"
              : `${activeFilterLabels.length} active`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="ui-button h-6 px-2 text-[10px]"
        >
          Clear
        </button>
      </div>

      <div className="space-y-2 p-2">
        <ControlGroup>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
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

        {activeFilterLabels.length > 0 ? (
          <div className="mt-2 flex max-h-[66px] flex-wrap gap-1 overflow-y-auto">
            {activeFilterLabels.map((label) => (
              <StatusBadge key={label} tone="info" className="text-[10px]">
                {label}
              </StatusBadge>
            ))}
          </div>
        ) : null}

        <ControlGroup title="Group Filters" className="mt-2">
          {MTF_SCREENER_TIMEFRAMES.map((timeframe) => (
            <label key={timeframe} className="block">
              <span className="mb-1 block text-[10px] uppercase text-[var(--muted)]">
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

        <ControlGroup title="Minimum Rank" className="mt-2">
          {MTF_SCREENER_TIMEFRAMES.map((timeframe) => (
            <label key={timeframe} className="block">
              <span className="mb-1 block text-[10px] uppercase text-[var(--muted)]">
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

        <ControlGroup title="Risk Exclusions" className="mt-2">
          <label className="flex items-center gap-2 text-[11px] text-[var(--muted)]">
            <input
              type="checkbox"
              checked={filters.exclude1dRisk}
              onChange={() => onExcludeRiskChange("exclude1dRisk")}
              className="accent-[var(--accent)]"
            />
            Exclude 1d risk
          </label>
          <label className="flex items-center gap-2 text-[11px] text-[var(--muted)]">
            <input
              type="checkbox"
              checked={filters.exclude1wRisk}
              onChange={() => onExcludeRiskChange("exclude1wRisk")}
              className="accent-[var(--accent)]"
            />
            Exclude 1w risk
          </label>
        </ControlGroup>

        <details className="mt-2 border-t border-[var(--border)] pt-2">
          <summary className="cursor-pointer text-[10px] font-semibold uppercase text-[var(--muted)]">
            Market backdrop
          </summary>
          <MarketContextPanel
            variant="compact"
            data={marketContextData}
            isLoading={marketContextIsLoading}
            isError={marketContextIsError}
            implication="Context only; table rows and classifications stay unchanged."
            className="mt-2 border-l-2 px-2 py-2 shadow-none"
          />
        </details>
      </div>
    </aside>
  );
}

export function MtfScreenerExportControls({
  visibleRowsCount,
  allRowsCount,
  onExportVisible,
  onExportAll,
  variant = "default",
}: {
  visibleRowsCount: number;
  allRowsCount: number;
  onExportVisible: () => void;
  onExportAll: () => void;
  variant?: "default" | "terminal";
}) {
  const buttonClass =
    variant === "terminal"
      ? "inline-flex h-7 items-center justify-center border border-white/20 bg-white/[0.08] px-2 text-[11px] font-semibold text-[var(--terminal-bar-foreground)] transition hover:border-white/35 hover:bg-white/[0.14] disabled:cursor-not-allowed disabled:opacity-50"
      : "ui-button h-7 px-2 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div
      aria-label="Screener CSV export"
      className="flex flex-wrap items-center gap-1"
    >
      <button
        type="button"
        onClick={onExportVisible}
        disabled={visibleRowsCount === 0}
        className={buttonClass}
      >
        Export Visible Rows
      </button>
      <button
        type="button"
        onClick={onExportAll}
        disabled={allRowsCount === 0}
        className={buttonClass}
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
        className="sticky top-6 z-20 w-[82px] border-l border-[var(--table-group)] bg-[var(--table-header)]"
      >
        Group
      </DataTableHeaderCell>
      <DataTableHeaderCell
        sortKey={`${timeframe}_rank`}
        sortState={sortState}
        defaultDirection="desc"
        onSortChange={onSortChange}
        align="right"
        className="sticky top-6 z-20 w-[58px] bg-[var(--table-header)]"
      >
        Rank
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
      <DataTableCell className="border-l border-[var(--table-group)]">
        <GroupBadge
          group={snapshot?.resultGroup}
          title={formatMtfGroup(snapshot)}
        >
          {snapshot ? formatMtfGroup(snapshot) : "Missing"}
        </GroupBadge>
      </DataTableCell>
      <DataTableCell align="right">
        <span className={`font-mono tabular-nums ${getMtfRankValueClass(snapshot?.rankScore ?? null)}`}>
          {formatMtfRank(snapshot)}
        </span>
      </DataTableCell>
    </>
  );
}

function GroupBadge({
  group,
  children,
  title,
}: {
  group?: string;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <DataTableChip
      tone={getMtfGroupChipTone(group)}
      title={title}
      className="min-w-[70px] justify-center"
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
    case null:
    case undefined:
      return "missing";
    default:
      return "neutral";
  }
}

function getMtfRankValueClass(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "text-[var(--muted-2)]";
  }

  if (value >= 75) {
    return "text-[var(--eligible)]";
  }

  if (value >= 55) {
    return "text-[var(--watch)]";
  }

  if (value < 30) {
    return "text-[var(--risk)]";
  }

  return "text-[var(--foreground)]";
}

function getMtfRowStateDotClass(row: MtfScreenerRow) {
  const primaryGroup =
    ["4h", "1h", "1d", "1w"]
      .map((timeframe) => row.snapshots[timeframe as MtfScreenerTimeframe]?.resultGroup)
      .find((group) => group && group !== "neutral") ??
    MTF_SCREENER_TIMEFRAMES.map((timeframe) => row.snapshots[timeframe]?.resultGroup)
      .find(Boolean);

  switch (primaryGroup) {
    case "eligible":
      return "bg-[var(--eligible)]";
    case "watch":
      return "bg-[var(--watch)]";
    case "overheated":
      return "bg-[var(--overheated)]";
    case "risk":
      return "bg-[var(--risk)]";
    default:
      return "bg-[var(--missing)]";
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
    "inline-flex h-8 min-w-[132px] shrink-0 items-center justify-between gap-2 border border-l-2 bg-[var(--panel)] px-2 text-left text-[11px] text-[var(--foreground)] transition";
  const toneClass = getMtfResearchBucketBorderClass(tone);

  return isActive
    ? `${base} ${toneClass} border-[var(--accent)] bg-[var(--accent-soft)] shadow-[inset_0_-2px_0_var(--accent)]`
    : `${base} ${toneClass} border-[var(--border)] bg-[var(--panel-data)] hover:border-[var(--border-strong)] hover:bg-[var(--row-hover)]`;
}

function getMtfResearchBucketBorderClass(tone: StatusTone) {
  switch (tone) {
    case "accent":
      return "border-l-[var(--accent)]";
    case "eligible":
    case "positive":
    case "complete":
      return "border-l-[var(--eligible)]";
    case "watch":
    case "info":
      return "border-l-[var(--watch)]";
    case "overheated":
    case "warning":
    case "partial":
      return "border-l-[var(--overheated)]";
    case "risk":
    case "negative":
    case "danger":
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
  const summary = getMtfRiskNotesSummary(row, 2);

  if (summary.notes.length === 0) {
    return <span className="text-[var(--muted-2)]">-</span>;
  }

  return (
    <div className="flex min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap leading-4">
      {summary.visibleNotes.map((note) => (
        <DataTableChip
          key={note}
          title={note}
          tone="neutral"
          className="max-w-[76px] truncate"
        >
          {note}
        </DataTableChip>
      ))}
      {summary.hiddenCount > 0 ? (
        <DataTableChip
          tone="warning"
          title={summary.hiddenNotes.join("; ")}
          className="shrink-0"
        >
          +{summary.hiddenCount}
        </DataTableChip>
      ) : null}
    </div>
  );
}

function ResearchLink({ row }: { row: MtfScreenerRow }) {
  const timeframe = getMtfSymbolResearchTimeframe(row);

  return (
    <Link
      href={buildMtfSymbolResearchHref({ row, timeframe })}
      className="inline-flex min-w-[78px] justify-center border border-[var(--info-border)] bg-[var(--info-bg)] px-1.5 py-1 text-[10px] font-semibold text-[var(--info)] underline-offset-2 hover:border-[var(--accent-border)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] hover:underline"
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

export function areMtfScreenerFiltersDefault(filters: MtfScreenerFilters) {
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

export function getActiveMtfFilterLabels(
  filters: MtfScreenerFilters,
  symbolSearch: string,
) {
  const labels: string[] = [];
  const normalizedSearch = symbolSearch.trim();

  if (normalizedSearch) {
    labels.push(`Search ${normalizedSearch}`);
  }

  for (const timeframe of MTF_SCREENER_TIMEFRAMES) {
    const group = filters.groups[timeframe];
    const minRank = filters.minRank[timeframe];

    if (
      group !== defaultMtfScreenerFilters.groups[timeframe] &&
      group !== "any"
    ) {
      labels.push(`${timeframe} ${formatGroupLabel(group)}`);
    }

    if (minRank > 0) {
      labels.push(`${timeframe} rank >= ${minRank}`);
    }
  }

  if (filters.exclude1dRisk) {
    labels.push("Exclude 1d risk");
  }

  if (filters.exclude1wRisk) {
    labels.push("Exclude 1w risk");
  }

  return labels;
}

const controlClass =
  "h-7 w-full border border-[var(--border-medium)] bg-[var(--control)] px-2 text-[11px] text-[var(--foreground)] shadow-[inset_0_1px_0_rgba(15,23,42,0.03)] focus:border-[var(--accent)]";
