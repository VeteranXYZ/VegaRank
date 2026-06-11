"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  DataTable,
  DataTableCell,
  DataTableHeaderCell,
  DataTableScroll,
} from "@/components/table/DataTable";
import {
  getNextDataSortState,
  sortDataRows,
  type DataSortDirection,
  type DataSortState,
  type DataSortValue,
} from "@/components/table/dataTableSorting";
import {
  PageShell,
  RefreshIconButton,
  StatusBadge,
  type StatusTone,
} from "@/components/ui/workspace";
import { formatDisplayDateTime } from "@/lib/utils/format";
import { useAppLanguage } from "@/lib/i18n/AppLanguageProvider";
import type { Language } from "@/lib/i18n/dictionaries";
import { getVegaRankApiBaseUrl } from "@/lib/runtime/vegaRankApi";
import {
  formatDateTime,
  formatGroupLabel,
} from "@/components/scanner/latestScanUi";
import { explainCode } from "@/lib/scanner-codebook/explainCode";
import {
  buildMarketContextPanelView,
  fetchMarketContext,
  type MarketContextResponse,
} from "@/components/market-context/marketContextUi";
import {
  MTF_SCREENER_TIMEFRAMES,
  buildMtfScreenerRowsFromResponse,
  buildMtfSymbolResearchHref,
  countMtfResearchBuckets,
  defaultMtfScreenerFilters,
  doesMtfRowMatchResearchBucket,
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
  type MtfScreenerSnapshot,
  type MtfScreenerTimeframe,
} from "./multiTimeframeScreenerUi";
import type { ScannerDisplayDictionary } from "@/components/scanner/latestScanUi";

const assetClass = "crypto";

type MtfSemanticTone = StatusTone | "repair";

export const mtfScreenerProductionCopy = {
  title: "Multi-Timeframe Screener",
  description:
    "Compare joined multi-timeframe research snapshots across symbols.",
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
    <PageShell className="screener-terminal max-w-none [--screener-sticky-offset:0rem] xl:h-full xl:min-h-0 xl:overflow-hidden">
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
      <p className="mb-1 text-[11px] leading-4 text-[var(--muted)]">
        Compare joined multi-timeframe research snapshots across symbols. Use the
        screener to review structure, confirmation, and risk context across
        timeframes.
      </p>

      <MtfResearchBucketsPanel
        rows={rows}
        presetId={presetId}
        isFullTableActive={isFullTableActive}
        onBucketSelect={applyPreset}
        onClear={clearFilters}
      />

      <div className="grid min-h-0 flex-1 gap-2 xl:grid-cols-[200px_minmax(0,1fr)_236px] xl:overflow-hidden 2xl:grid-cols-[204px_minmax(0,1fr)_252px]">
        <MtfScreenerControls
          filters={filters}
          symbolSearch={symbolSearch}
          onSymbolSearchChange={setSymbolSearch}
          onGroupChange={updateGroupFilter}
          onMinRankChange={updateMinRank}
          onExcludeRiskChange={updateExcludeRisk}
          onClear={clearFilters}
          className="order-2 xl:order-1"
        />

        <main className="order-1 min-h-0 min-w-0 xl:order-2 xl:flex xl:flex-col xl:overflow-hidden">
          {latestQuery.isLoading ? (
            <MtfStatePanel message="Loading multi-timeframe latest ranking data." />
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
          marketContextData={marketContextQuery.data}
          marketContextIsLoading={marketContextQuery.isLoading}
          marketContextIsError={marketContextQuery.isError}
          className="order-3 xl:order-3"
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
  const { dictionary, language } = useAppLanguage();

  if (rows.length === 0) {
    return (
      <MtfStatePanel message="No symbols match the selected multi-timeframe filters." />
    );
  }

  return (
    <section className="terminal-panel-data overflow-hidden xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
      <div className="terminal-panel-header">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <h2 className="terminal-panel-title">
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
      <DataTableScroll className="xl:min-h-0 xl:flex-1 xl:overflow-auto">
        <DataTable minWidth="min-w-[1420px]" className="table-fixed">
          <thead className="bg-[var(--table-header)] text-[10px] uppercase tracking-normal text-[var(--muted)]">
            <tr>
              <DataTableHeaderCell
                sortKey="symbol"
                sortState={sortState}
                onSortChange={onSortChange}
                rowSpan={2}
                className="sticky left-0 top-0 z-30 w-[150px] border-r border-[var(--border-medium)] bg-[var(--table-header)]"
              >
                Symbol
              </DataTableHeaderCell>
              <DataTableHeaderCell
                colSpan={2}
                align="center"
                className="sticky top-0 z-20 border-l border-[var(--table-group)] bg-[var(--table-header-strong)] text-[var(--foreground)]"
              >
                State
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
                className="sticky top-0 z-20 w-[166px] border-l border-[var(--table-group)] bg-[var(--table-header)]"
              >
                Primary
              </DataTableHeaderCell>
              <DataTableHeaderCell
                rowSpan={2}
                className="sticky top-0 z-20 w-[214px] bg-[var(--table-header)]"
              >
                Notes
              </DataTableHeaderCell>
              <DataTableHeaderCell
                rowSpan={2}
                align="center"
                className="sticky top-0 z-20 w-[88px] bg-[var(--table-header)]"
              >
                Action
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
                Score
              </DataTableHeaderCell>
              <DataTableHeaderCell
                sortKey="higher_timeframe_safety"
                sortState={sortState}
                defaultDirection="desc"
                onSortChange={onSortChange}
                className="sticky top-6 z-20 w-[112px] bg-[var(--table-header)]"
              >
                HTF
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
                    {row.exchange.toUpperCase()} · {row.market.toUpperCase()}
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
                  <HigherTimeframeHealthCell row={row} />
                </DataTableCell>
                {MTF_SCREENER_TIMEFRAMES.map((timeframe) => (
                  <TimeframeCells
                    key={`${row.symbol}-${timeframe}`}
                    row={row}
                    timeframe={timeframe}
                    dictionary={dictionary}
                    language={language}
                  />
                ))}
                <DataTableCell className="border-l border-[var(--table-group)]">
                  <PrimarySignalCell
                    row={row}
                    dictionary={dictionary}
                    language={language}
                  />
                </DataTableCell>
                <DataTableCell>
                  <RiskNotesCell
                    row={row}
                    dictionary={dictionary}
                    language={language}
                  />
                </DataTableCell>
                <DataTableCell align="center">
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
          className="shrink-0 border border-[var(--border)] bg-[var(--panel-muted)] px-1.5 py-0.5 font-mono font-semibold uppercase text-[var(--muted)]"
        >
          {timeframe}
        </span>
      ))}
      <span className="shrink-0 border-l border-[var(--border-medium)] pl-2 font-semibold uppercase text-[var(--muted)]">
        States
      </span>
      {[
        ["eligible", "Eligible"],
        ["watch", "Watch"],
        ["risk", "Risk"],
        ["overheated", "Hot"],
        ["neutral", "Neutral"],
      ].map(([tone, label]) => (
        <span
          key={tone}
          className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-[var(--muted)]"
        >
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 rounded-full ${getMtfResearchBucketMarkerClass(
              tone as MtfBucketTone | StatusTone,
            )}`}
          />
          {label}
        </span>
      ))}
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
      `Failed to load multi-timeframe latest ranking data (${response.status}).`,
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
  const baseUrl = getVegaRankApiBaseUrl(tradeApiBaseUrl);

  return `${baseUrl}/api/rankings/mtf-latest?${params.toString()}`;
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
  const activeBucketLabel = getMtfActiveBucketLabel(presetId, isFullTableActive);
  const filterStateLabel = getMtfFilterStateLabel({
    activeFilterCount,
    presetId,
    isFullTableActive,
  });
  const sortLabel = formatMtfTableSortState(sortState);

  return (
    <header className="terminal-command-bar mb-1">
      <div className="terminal-command-row text-[var(--terminal-bar-muted)]">
        <div
          className="terminal-command-brand"
          title={`${title} · ${datasetLabel}`}
        >
          <h1 className="terminal-command-title">Multi-Timeframe Screener</h1>
          <span className="shrink-0 font-mono text-[10px] text-[var(--terminal-bar-muted)]">
            Crypto
          </span>
          <span className="shrink-0 text-[9px] font-medium normal-case text-[var(--terminal-bar-muted)] opacity-75">
            research context
          </span>
        </div>

        <div className="terminal-command-main">
          <MtfCommandStat
            label="Data"
            value={statusLabel}
            tone={statusTone}
          />
          <MtfCommandStat
            label="Rows"
            value={`${visibleRows}/${totalRows}`}
            tone={visibleRows === totalRows ? "complete" : "accent"}
          />
          <MtfCommandStat
            label="Bucket"
            value={activeBucketLabel}
            tone={getMtfCommandBucketTone(presetId, isFullTableActive)}
          />
          <MtfCommandStat
            label="Filters"
            value={filterStateLabel}
            tone={activeFilterCount > 0 ? "accent" : "neutral"}
          />
          <MtfCommandStat
            label="Sort"
            value={sortLabel}
            tone={sortState ? "accent" : "neutral"}
          />
          <MtfFreshnessStrip sourceData={sourceData} />
        </div>

        <div className="terminal-command-actions">
          {onExportVisible && onExportAll ? (
            <MtfScreenerExportControls
              visibleRowsCount={visibleRows}
              allRowsCount={totalRows}
              onExportVisible={onExportVisible}
              onExportAll={onExportAll}
              variant="terminal"
            />
          ) : null}
          {onRefresh ? (
            <RefreshIconButton
              onClick={onRefresh}
              disabled={isRefreshing}
              isRefreshing={isRefreshing}
              label="Refresh"
            />
          ) : null}
        </div>
      </div>
    </header>
  );
}

function MtfCommandStat({
  label,
  value,
  tone,
  title,
}: {
  label: string;
  value: string;
  tone: MtfSemanticTone;
  title?: string;
}) {
  return (
    <div
      title={title ?? `${label}: ${value}`}
      className={`inline-flex h-6 max-w-[210px] shrink-0 items-center gap-1.5 overflow-hidden border border-l-2 border-white/10 bg-white/[0.04] px-1.5 ${getMtfTerminalToneBorderClass(tone)}`}
    >
      <span className="shrink-0 text-[9px] font-semibold uppercase text-[var(--terminal-bar-muted)]">
        {label}
      </span>
      <span
        className={`min-w-0 truncate font-mono text-[10px] font-semibold leading-4 ${getMtfTerminalToneTextClass(tone)}`}
      >
        {value}
      </span>
    </div>
  );
}

function MtfFreshnessStrip({
  sourceData,
}: {
  sourceData?: MtfLatestScreenerResponse;
}) {
  return (
    <div
      className={`inline-flex h-6 min-w-0 shrink-0 items-center gap-1 border border-l-2 border-white/10 bg-white/[0.04] px-1.5 ${getMtfTerminalToneBorderClass(
        getMtfFreshnessStripTone(sourceData),
      )}`}
      title={getMtfFreshnessTitle(sourceData)}
    >
      <span className="shrink-0 text-[9px] font-semibold uppercase text-[var(--terminal-bar-muted)]">
        Freshness
      </span>
      <div className="flex min-w-0 items-center gap-1 overflow-hidden">
        {MTF_SCREENER_TIMEFRAMES.map((timeframe) => (
          <MtfFreshnessPill
            key={timeframe}
            timeframe={timeframe}
            sourceData={sourceData}
          />
        ))}
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
  const compactTimestamp = run
    ? formatMtfFreshnessCompactTime(run.finishedAt ?? run.startedAt)
    : "missing";

  return (
    <StatusBadge
      tone={tone}
      title={
        run
          ? `${timeframe}: ${timestamp}; ${signalCount} signals, ${missingCount} missing`
          : `${timeframe}: no selected latest run`
      }
      className="shrink-0 gap-1 px-1 py-0 text-[9px]"
    >
      <span className="font-mono uppercase">{timeframe}</span>
      <span className="max-w-[44px] truncate">{compactTimestamp}</span>
      <span className="font-mono tabular-nums">
        {run ? `${signalCount}/${missingCount}` : "missing"}
      </span>
    </StatusBadge>
  );
}

function getMtfFreshnessStripTone(
  sourceData?: MtfLatestScreenerResponse,
): StatusTone {
  if (!sourceData) {
    return "missing";
  }

  const hasMissingRun = MTF_SCREENER_TIMEFRAMES.some(
    (timeframe) => !sourceData.runs[timeframe],
  );
  const hasMissingRows = MTF_SCREENER_TIMEFRAMES.some(
    (timeframe) => (sourceData.missingCounts[timeframe] ?? 0) > 0,
  );

  if (hasMissingRun) {
    return "missing";
  }

  return hasMissingRows ? "warning" : "complete";
}

function getMtfFreshnessTitle(sourceData?: MtfLatestScreenerResponse) {
  if (!sourceData) {
    return "Freshness: latest runs unavailable.";
  }

  return MTF_SCREENER_TIMEFRAMES.map((timeframe) => {
    const run = sourceData.runs[timeframe];
    const signalCount = sourceData.signalCounts[timeframe] ?? 0;
    const missingCount = sourceData.missingCounts[timeframe] ?? 0;

    return run
      ? `${timeframe}: ${formatDateTime(run.finishedAt ?? run.startedAt)}; ${signalCount} signals, ${missingCount} missing`
      : `${timeframe}: no selected latest run`;
  }).join(" / ");
}

function formatMtfFreshnessCompactTime(value: string | null | undefined) {
  return formatDisplayDateTime(value, { fallback: "n/a", mode: "time" });
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

function getMtfTerminalToneBorderClass(tone: MtfSemanticTone) {
  switch (tone) {
    case "eligible":
    case "positive":
    case "complete":
      return "border-l-[var(--eligible)]";
    case "info":
    case "accent":
      return "border-l-[var(--accent)]";
    case "observation":
      return "border-l-[var(--observation)]";
    case "repair":
      return "border-l-[var(--repair)]";
    case "watch":
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
      return "border-l-[var(--missing)]";
  }
}

function getMtfTerminalToneTextClass(tone: MtfSemanticTone) {
  switch (tone) {
    case "eligible":
    case "positive":
    case "complete":
      return "text-[var(--eligible)]";
    case "info":
    case "accent":
      return "text-[var(--accent)]";
    case "observation":
      return "text-[var(--observation)]";
    case "repair":
      return "text-[var(--repair)]";
    case "watch":
      return "text-[var(--watch)]";
    case "overheated":
    case "warning":
    case "partial":
      return "text-[var(--overheated)]";
    case "risk":
    case "negative":
    case "danger":
      return "text-[var(--risk)]";
    default:
      return "text-[var(--terminal-bar-muted)]";
  }
}

function getMtfCommandBucketTone(
  presetId: MtfScreenerPresetId | "custom",
  isFullTableActive: boolean,
): MtfSemanticTone {
  if (isFullTableActive) {
    return "accent";
  }

  if (presetId === "custom") {
    return "neutral";
  }

  return getMtfResearchBucketTone(presetId);
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
      className="terminal-panel-muted mb-1 min-w-0 shadow-[var(--shadow-panel)]"
    >
      <div className="flex min-w-0 items-center gap-0 overflow-x-auto px-1.5 py-1 [scrollbar-gutter:stable]">
        <div className="mr-1 shrink-0 border-r border-[var(--border)] px-1.5 pr-2 text-[10px] font-semibold uppercase text-[var(--muted)]">
          Buckets
        </div>
        <button
          type="button"
          title="Full Table: all joined rows before preset buckets."
          onClick={onClear}
          aria-pressed={isFullTableActive}
          className={getMtfResearchBucketButtonClass("accent", isFullTableActive)}
        >
          <MtfBucketMarker tone="accent" />
          <span className="min-w-0 truncate font-semibold">Full Table</span>
          <span className="font-mono tabular-nums text-[var(--muted)]">
            {rows.length}
          </span>
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
              <MtfBucketMarker tone={tone} />
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
  marketContextData,
  marketContextIsLoading = false,
  marketContextIsError = false,
  className = "",
}: {
  rows: MtfScreenerRow[];
  totalRows: number;
  filteredRows: number;
  presetId: MtfScreenerPresetId | "custom";
  isFullTableActive: boolean;
  activeFilterCount: number;
  sortState?: DataSortState<MtfScreenerTableSortKey> | null;
  marketContextData?: MarketContextResponse | null;
  marketContextIsLoading?: boolean;
  marketContextIsError?: boolean;
  className?: string;
}) {
  const { dictionary, language } = useAppLanguage();
  const focusRows = getMtfDetailFocusRows(
    rows,
    sortState,
    presetId,
    isFullTableActive,
  );

  return (
    <aside
      aria-label="Screener detail rail"
      className={`terminal-panel-data hidden min-w-0 xl:flex xl:h-full xl:min-h-0 xl:flex-col xl:overflow-hidden ${className}`}
    >
      <div className="terminal-panel-header">
        <h2 className="terminal-panel-title truncate">
          Detail Rail
        </h2>
        <StatusBadge tone="info" className="shrink-0 text-[10px]">
          Ready
        </StatusBadge>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase text-[var(--muted)]">
            View State
          </div>
          <div className="grid grid-cols-2 gap-1">
            <MtfDetailRailMetric
              label="Rows"
              value={`${filteredRows}/${totalRows}`}
              tone={filteredRows === totalRows ? "complete" : "accent"}
            />
            <MtfDetailRailMetric
              label="Bucket"
              value={getMtfActiveBucketLabel(presetId, isFullTableActive)}
              tone={getMtfCommandBucketTone(presetId, isFullTableActive)}
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
              tone={activeFilterCount > 0 ? "accent" : "neutral"}
            />
            <MtfDetailRailMetric
              label="Sort"
              value={formatMtfTableSortState(sortState)}
              tone={sortState ? "accent" : "neutral"}
            />
          </div>
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
            <StatusBadge tone="missing" className="text-[10px]">
              Missing
            </StatusBadge>
          </div>
        </div>

        <MtfDetailMarketBackdrop
          data={marketContextData}
          isLoading={marketContextIsLoading}
          isError={marketContextIsError}
        />

        <div className="border-t border-[var(--border)] pt-2">
          <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase text-[var(--muted)]">
            <span>Focus Rows</span>
            <span className="font-mono">{focusRows.length}</span>
          </div>
          <div className="space-y-1">
            {focusRows.length > 0 ? (
              focusRows.map((focusRow) => {
                const { row, reason, timeframe, tone } = focusRow;
                const notes = getMtfRiskNotesSummary(
                  row,
                  Number.MAX_SAFE_INTEGER,
                  language,
                ).notes;

                return (
                  <Link
                    key={`${reason}-${row.symbol}`}
                    href={buildMtfSymbolResearchHref({ row, timeframe })}
                    title={notes.length > 0 ? notes.join("; ") : undefined}
                    className={`group/detail block border border-l-2 border-[var(--border)] bg-[var(--panel-muted)] px-2 py-1.5 text-[11px] transition hover:border-[var(--accent-border)] hover:bg-[var(--row-hover)] ${getMtfResearchBucketBorderClass(tone)}`}
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
                    <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[10px] text-[var(--muted)]">
                      <span className={getMtfDetailFocusPillClass(tone)}>
                        {reason}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {getMtfPrimarySignal(row, language)}
                      </span>
                      <span className="shrink-0 font-mono uppercase text-[var(--accent)]">
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

function MtfDetailMarketBackdrop({
  data,
  isLoading,
  isError,
}: {
  data?: MarketContextResponse | null;
  isLoading: boolean;
  isError: boolean;
}) {
  const view = buildMarketContextPanelView({ data, isLoading, isError });
  const broadRegime =
    view.chips.find((chip) => chip.label === "Broad regime") ?? view.chips[0];
  const ethConfirmation = view.chips.find(
    (chip) => chip.label === "ETH confirmation",
  );
  const tone = getMtfMarketBackdropTone(broadRegime?.tone);

  return (
    <div className="border-t border-[var(--border)] pt-2">
      <div className="mb-1 text-[10px] font-semibold uppercase text-[var(--muted)]">
        Market Backdrop
      </div>
      <div
        className={`border border-l-2 border-[var(--border)] bg-[var(--panel-muted)] px-2 py-1.5 ${getMtfResearchBucketBorderClass(tone)}`}
        title={view.description}
      >
        <div className="flex min-w-0 items-center justify-between gap-2">
          <span className="min-w-0 truncate text-[11px] font-semibold text-[var(--foreground)]">
            {view.title}
          </span>
          <span className={getMtfDetailFocusPillClass(tone)}>
            {broadRegime?.value ?? "Unavailable"}
          </span>
        </div>
        <p className="mt-1 truncate text-[10px] leading-4 text-[var(--muted)]">
          {getMtfMarketBackdropLine(view.unavailable, ethConfirmation?.value)}
        </p>
      </div>
    </div>
  );
}

function getMtfMarketBackdropTone(
  tone: "constructive" | "risk" | "mixed" | "neutral" | undefined,
): MtfDetailFocusTone {
  switch (tone) {
    case "constructive":
      return "eligible";
    case "risk":
      return "risk";
    case "mixed":
      return "overheated";
    default:
      return "neutral";
  }
}

function getMtfMarketBackdropLine(
  unavailable: boolean,
  ethConfirmation: string | undefined,
) {
  if (unavailable) {
    return "Context unavailable; scanner states unchanged.";
  }

  return ethConfirmation
    ? `ETH: ${ethConfirmation}; scanner states unchanged.`
    : "BTC/ETH context only; scanner states unchanged.";
}

function MtfDetailRailMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: MtfSemanticTone;
}) {
  return (
    <div
      className={`min-w-0 border border-l-2 border-[var(--border)] bg-[var(--panel-muted)] px-2 py-1 ${getMtfResearchBucketBorderClass(tone)}`}
    >
      <div className="truncate text-[9px] font-semibold uppercase text-[var(--muted)]">
        {label}
      </div>
      <div
        className={`truncate font-mono text-[10px] font-semibold leading-4 ${getMtfTerminalToneTextClass(tone)}`}
      >
        {value}
      </div>
    </div>
  );
}

type MtfDetailFocusTone = MtfBucketTone | StatusTone;

type MtfDetailFocusRow = {
  row: MtfScreenerRow;
  reason: string;
  tone: MtfDetailFocusTone;
  timeframe: MtfScreenerTimeframe;
};

function getMtfDetailFocusRows(
  rows: MtfScreenerRow[],
  sortState?: DataSortState<MtfScreenerTableSortKey> | null,
  presetId: MtfScreenerPresetId | "custom" = "custom",
  isFullTableActive = false,
) {
  const focusRows: MtfDetailFocusRow[] = [];
  const seen = new Set<string>();
  const addFocusRow = (
    row: MtfScreenerRow | undefined,
    reason: string,
    tone: MtfDetailFocusTone,
    timeframe?: MtfScreenerTimeframe,
  ) => {
    if (!row || seen.has(row.symbol)) {
      return;
    }

    seen.add(row.symbol);
    focusRows.push({
      row,
      reason,
      tone,
      timeframe: timeframe ?? getMtfSymbolResearchTimeframe(row),
    });
  };
  const addFocusRows = (
    candidates: MtfScreenerRow[],
    reason: string,
    tone: MtfDetailFocusTone,
    timeframe: (row: MtfScreenerRow) => MtfScreenerTimeframe,
  ) => {
    for (const row of candidates) {
      if (focusRows.length >= 5) {
        break;
      }

      addFocusRow(row, reason, tone, timeframe(row));
    }
  };

  if (presetId === "breakdown_risk") {
    addFocusRows(getMtfRiskFocusRows(rows), "Risk", "risk", (row) =>
      getMtfFirstTimeframeWithGroup(row, ["risk"]),
    );
  } else if (presetId === "mtf_strength") {
    addFocusRows(getMtfStrengthFocusRows(rows), "Strength", "eligible", (row) =>
      getMtfFirstTimeframeWithGroup(row, ["eligible"]),
    );
  } else if (presetId === "short_term_repair") {
    addFocusRows(getMtfRepairFocusRows(rows), "Observation", "observation", () => "1h");
  } else if (presetId === "higher_timeframe_safe_watchlist") {
    addFocusRows(getMtfWatchFocusRows(rows), "Watch", "watch", (row) =>
      getMtfFirstTimeframeWithGroup(row, ["watch", "eligible"]),
    );
  } else if (presetId === "overheated_caution") {
    addFocusRows(getMtfOverheatedFocusRows(rows), "Hot", "overheated", (row) =>
      getMtfFirstTimeframeWithGroup(row, ["overheated"]),
    );
  } else {
    if (sortState?.key === "combined_rank" || sortState?.key.endsWith("_rank")) {
      addFocusRow(
        rows[0],
        sortState.direction === "asc" ? "Low Score" : "Top Score",
        sortState.direction === "asc" ? "risk" : "eligible",
      );
    }

    addFocusRow(
      getMtfStrengthFocusRows(rows)[0],
      "Constructive",
      "eligible",
      getMtfFirstTimeframeWithGroup(getMtfStrengthFocusRows(rows)[0], [
        "eligible",
      ]),
    );
    addFocusRow(getMtfRepairFocusRows(rows)[0], "Observation", "observation", "1h");
    addFocusRow(
      getMtfRiskFocusRows(rows)[0],
      "Risk",
      "risk",
      getMtfFirstTimeframeWithGroup(getMtfRiskFocusRows(rows)[0], ["risk"]),
    );
    addFocusRow(rows.find(isMtfMixedSignalRow), "Mixed", "watch");
    addFocusRow(
      rows.find(hasMtfMissingHigherTimeframe),
      "Missing HTF",
      "missing",
      "1d",
    );
  }

  for (const row of isFullTableActive
    ? sortMtfRowsByCombinedRank(rows, "desc")
    : rows) {
    if (focusRows.length >= 5) {
      break;
    }

    addFocusRow(
      row,
      "Visible",
      getMtfDetailFocusTone(row),
      getMtfSymbolResearchTimeframe(row),
    );
  }

  return focusRows.slice(0, 5);
}

function getMtfRiskFocusRows(rows: MtfScreenerRow[]) {
  return sortMtfRowsByCombinedRank(
    rows.filter((row) => hasMtfAnyGroup(row, ["risk"])),
    "asc",
  );
}

function getMtfStrengthFocusRows(rows: MtfScreenerRow[]) {
  return sortMtfRowsByCombinedRank(
    rows.filter(
      (row) =>
        doesMtfRowMatchResearchBucket(row, "mtf_strength") ||
        hasMtfAnyGroup(row, ["eligible"]),
    ),
    "desc",
  );
}

function getMtfRepairFocusRows(rows: MtfScreenerRow[]) {
  return [...rows]
    .filter((row) => doesMtfRowMatchResearchBucket(row, "short_term_repair"))
    .sort((left, right) =>
      compareMtfRankValues(
        getMtfTimeframeRank(right, "1h"),
        getMtfTimeframeRank(left, "1h"),
      ),
    );
}

function getMtfWatchFocusRows(rows: MtfScreenerRow[]) {
  return sortMtfRowsByCombinedRank(
    rows.filter(
      (row) =>
        doesMtfRowMatchResearchBucket(
          row,
          "higher_timeframe_safe_watchlist",
        ) || hasMtfAnyGroup(row, ["watch"]),
    ),
    "desc",
  );
}

function getMtfOverheatedFocusRows(rows: MtfScreenerRow[]) {
  return sortMtfRowsByCombinedRank(
    rows.filter((row) => hasMtfAnyGroup(row, ["overheated"])),
    "desc",
  );
}

function sortMtfRowsByCombinedRank(
  rows: MtfScreenerRow[],
  direction: "asc" | "desc",
) {
  return [...rows].sort((left, right) => {
    const leftRank = getMtfCombinedRank(left);
    const rightRank = getMtfCombinedRank(right);

    return direction === "asc"
      ? compareMtfRankValues(leftRank, rightRank)
      : compareMtfRankValues(rightRank, leftRank);
  });
}

function compareMtfRankValues(
  left: number | null | undefined,
  right: number | null | undefined,
) {
  const leftFinite = typeof left === "number" && Number.isFinite(left);
  const rightFinite = typeof right === "number" && Number.isFinite(right);

  if (!leftFinite && !rightFinite) {
    return 0;
  }

  if (!leftFinite) {
    return 1;
  }

  if (!rightFinite) {
    return -1;
  }

  return left - right;
}

function getMtfTimeframeRank(
  row: MtfScreenerRow,
  timeframe: MtfScreenerTimeframe,
) {
  return row.snapshots[timeframe]?.metrics.rankScore ?? null;
}

function isMtfMixedSignalRow(row: MtfScreenerRow) {
  return (
    hasMtfAnyGroup(row, ["risk", "overheated"]) &&
    hasMtfAnyGroup(row, ["eligible", "watch"])
  );
}

function hasMtfMissingHigherTimeframe(row: MtfScreenerRow) {
  return !row.snapshots["1d"] || !row.snapshots["1w"];
}

function hasMtfAnyGroup(row: MtfScreenerRow, groups: string[]) {
  return MTF_SCREENER_TIMEFRAMES.some((timeframe) =>
    groups.includes(row.snapshots[timeframe]?.resultGroup ?? ""),
  );
}

function getMtfFirstTimeframeWithGroup(
  row: MtfScreenerRow | undefined,
  groups: string[],
) {
  return (
    MTF_SCREENER_TIMEFRAMES.find((timeframe) =>
      groups.includes(row?.snapshots[timeframe]?.resultGroup ?? ""),
    ) ?? "4h"
  );
}

function getMtfDetailFocusTone(row: MtfScreenerRow): MtfDetailFocusTone {
  if (hasMtfAnyGroup(row, ["risk"])) {
    return "risk";
  }

  if (hasMtfAnyGroup(row, ["overheated"])) {
    return "overheated";
  }

  if (hasMtfAnyGroup(row, ["eligible"])) {
    return "eligible";
  }

  if (hasMtfAnyGroup(row, ["watch"])) {
    return "watch";
  }

  return "neutral";
}

function getMtfDetailFocusPillClass(tone: MtfDetailFocusTone) {
  const base =
    "shrink-0 border px-1 py-0 text-[9px] font-semibold uppercase leading-4";

  switch (tone) {
    case "repair":
      return `${base} border-[var(--repair-border)] bg-[var(--repair-bg)] text-[var(--repair)]`;
    case "eligible":
    case "positive":
    case "complete":
      return `${base} border-[var(--eligible-border)] bg-[var(--eligible-bg)] text-[var(--eligible)]`;
    case "watch":
      return `${base} border-[var(--watch-border)] bg-[var(--watch-bg)] text-[var(--watch)]`;
    case "overheated":
    case "warning":
    case "partial":
      return `${base} border-[var(--overheated-border)] bg-[var(--overheated-bg)] text-[var(--overheated)]`;
    case "risk":
    case "negative":
    case "danger":
      return `${base} border-[var(--risk-border)] bg-[var(--risk-bg)] text-[var(--risk)]`;
    case "accent":
    case "info":
      return `${base} border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]`;
    default:
      return `${base} border-[var(--neutral-border)] bg-[var(--neutral-bg)] text-[var(--neutral)]`;
  }
}

export function MtfScreenerControls({
  filters,
  symbolSearch,
  onSymbolSearchChange,
  onGroupChange,
  onMinRankChange,
  onExcludeRiskChange,
  onClear,
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
  className?: string;
}) {
  const activeFilterLabels = getActiveMtfFilterLabels(filters, symbolSearch);

  return (
    <aside
      aria-label="Screener filters"
      className={`terminal-rail xl:flex xl:h-full xl:min-h-0 xl:flex-col xl:overflow-hidden ${className}`}
    >
      <div className="terminal-panel-header">
        <div className="min-w-0">
          <h2 className="terminal-panel-title text-[11px]">
            Filters
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
          className="terminal-mini-action h-6 px-2"
        >
          Clear
        </button>
      </div>

      <div className="space-y-1.5 p-1.5 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
        <section>
          <label className="block">
            <span className="mb-0.5 block text-[9px] font-semibold uppercase text-[var(--muted)]">
              Symbol
            </span>
            <input
              type="search"
              value={symbolSearch}
              onChange={(event) => onSymbolSearchChange(event.target.value)}
              className={controlClass}
              placeholder="Search symbol"
            />
          </label>
        </section>

        {activeFilterLabels.length > 0 ? (
          <div
            title={activeFilterLabels.join("; ")}
            className="truncate border-l-2 border-[var(--accent)] bg-[var(--panel-muted)] px-1.5 py-1 text-[10px] text-[var(--muted)]"
          >
            {activeFilterLabels.join(" · ")}
          </div>
        ) : null}

        <section className="border-t border-[var(--border)] pt-1.5">
          <h3 className="mb-1 text-[9px] font-semibold uppercase text-[var(--muted)]">
            State
          </h3>
          <div className="grid grid-cols-2 gap-1">
            {MTF_SCREENER_TIMEFRAMES.map((timeframe) => (
              <label key={timeframe} className="block">
                <span className="mb-0.5 block font-mono text-[9px] uppercase text-[var(--muted-2)]">
                  {timeframe}
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
          </div>
        </section>

        <section className="border-t border-[var(--border)] pt-1.5">
          <h3 className="mb-1 text-[9px] font-semibold uppercase text-[var(--muted)]">
            Min Score
          </h3>
          <div className="grid grid-cols-2 gap-1">
            {MTF_SCREENER_TIMEFRAMES.map((timeframe) => (
              <label key={timeframe} className="block">
                <span className="mb-0.5 block font-mono text-[9px] uppercase text-[var(--muted-2)]">
                  {timeframe}
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
          </div>
        </section>

        <section className="border-t border-[var(--border)] pt-1.5">
          <h3 className="mb-1 text-[9px] font-semibold uppercase text-[var(--muted)]">
            Risk
          </h3>
          <label className="flex items-center gap-1.5 text-[10px] text-[var(--muted)]">
            <input
              type="checkbox"
              checked={filters.exclude1dRisk}
              onChange={() => onExcludeRiskChange("exclude1dRisk")}
              className="accent-[var(--accent)]"
            />
            Exclude 1d risk
          </label>
          <label className="mt-1 flex items-center gap-1.5 text-[10px] text-[var(--muted)]">
            <input
              type="checkbox"
              checked={filters.exclude1wRisk}
              onChange={() => onExcludeRiskChange("exclude1wRisk")}
              className="accent-[var(--accent)]"
            />
            Exclude 1w risk
          </label>
        </section>

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
      ? "terminal-command-action disabled:cursor-not-allowed disabled:opacity-50"
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
        {variant === "terminal" ? "Export Visible" : "Export Visible Rows"}
      </button>
      <button
        type="button"
        onClick={onExportAll}
        disabled={allRowsCount === 0}
        className={buttonClass}
      >
        {variant === "terminal" ? "Export All" : "Export All Joined Rows"}
      </button>
    </div>
  );
}

function MtfStatePanel({ message }: { message: string }) {
  return (
    <section className="terminal-state-panel is-center xl:flex-1">
      <h2 className="text-sm font-semibold text-[var(--foreground)]">
        Screener state
      </h2>
      <p className="mt-1 max-w-md text-[12px] leading-5 text-[var(--muted)]">
        {message}
      </p>
    </section>
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
    return row.snapshots[rankTimeframe]?.metrics.rankScore ?? null;
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
        className="sticky top-6 z-20 w-[84px] border-l border-[var(--table-group)] bg-[var(--table-header)]"
      >
        State
      </DataTableHeaderCell>
      <DataTableHeaderCell
        sortKey={`${timeframe}_rank`}
        sortState={sortState}
        defaultDirection="desc"
        onSortChange={onSortChange}
        align="right"
        className="sticky top-6 z-20 w-[58px] bg-[var(--table-header)]"
      >
        Score
      </DataTableHeaderCell>
    </>
  );
}

function TimeframeCells({
  row,
  timeframe,
  dictionary,
  language,
}: {
  row: MtfScreenerRow;
  timeframe: MtfScreenerTimeframe;
  dictionary: ScannerDisplayDictionary;
  language: Language;
}) {
  const snapshot = row.snapshots[timeframe];

  return (
    <>
      <DataTableCell className="border-l border-[var(--table-group)]">
        <TimeframeStateValue
          snapshot={snapshot}
          dictionary={dictionary}
          language={language}
        />
      </DataTableCell>
      <DataTableCell align="right">
        <span
          className={`font-mono tabular-nums ${getMtfSnapshotScoreClass(snapshot)}`}
        >
          {formatMtfRank(snapshot)}
        </span>
      </DataTableCell>
    </>
  );
}

function TimeframeStateValue({
  snapshot,
  dictionary,
  language,
}: {
  snapshot: MtfScreenerSnapshot | undefined;
  dictionary: ScannerDisplayDictionary;
  language: Language;
}) {
  const group = snapshot?.resultGroup;

  return (
    <div
      title={formatMtfGroup(snapshot, language)}
      className={`inline-flex max-w-full items-center gap-1.5 border-l-2 pl-1.5 ${getMtfResearchBucketBorderClass(
        getMtfStateTone(group),
      )}`}
    >
      <span
        className={`min-w-0 truncate text-[10px] font-semibold ${getMtfGroupTextClass(group)}`}
      >
        {snapshot
          ? formatMtfGroup(snapshot, language)
          : dictionary.scannerResultFallback.notReturned}
      </span>
    </div>
  );
}

function getMtfStateTone(
  group: string | null | undefined,
): MtfBucketTone | StatusTone {
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

function getMtfGroupTextClass(group: string | null | undefined) {
  switch (group) {
    case "eligible":
      return "text-[var(--eligible)]";
    case "watch":
      return "text-[var(--watch)]";
    case "overheated":
      return "text-[var(--overheated)]";
    case "risk":
      return "text-[var(--risk)]";
    case "neutral":
    case "insufficient_history":
      return "text-[var(--muted)]";
    case null:
    case undefined:
      return "text-[var(--muted-2)]";
    default:
      return "text-[var(--muted)]";
  }
}

function getMtfSnapshotScoreClass(snapshot: MtfScreenerSnapshot | undefined) {
  if (
    !snapshot ||
    typeof snapshot.metrics.rankScore !== "number" ||
    !Number.isFinite(snapshot.metrics.rankScore)
  ) {
    return "text-[var(--muted-2)]";
  }

  return getMtfGroupTextClass(snapshot.resultGroup);
}

function getMtfRankValueClass(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "text-[var(--muted-2)]";
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

type MtfBucketTone =
  | "accent"
  | "observation"
  | "repair"
  | "eligible"
  | "watch"
  | "overheated"
  | "risk";

function getMtfResearchBucketTone(id: MtfScreenerPresetId): MtfBucketTone {
  switch (id) {
    case "mtf_strength":
      return "eligible";
    case "short_term_repair":
      return "observation";
    case "higher_timeframe_safe_watchlist":
      return "watch";
    case "overheated_caution":
      return "overheated";
    case "breakdown_risk":
      return "risk";
  }
}

function getMtfResearchBucketValueClass(tone: MtfBucketTone | StatusTone) {
  switch (tone) {
    case "repair":
      return "text-[var(--repair)]";
    case "eligible":
      return "text-[var(--eligible)]";
    case "watch":
      return "text-[var(--watch)]";
    case "overheated":
      return "text-[var(--overheated)]";
    case "risk":
      return "text-[var(--risk)]";
    case "observation":
      return "text-[var(--observation)]";
    default:
      return "text-[var(--muted)]";
  }
}

function MtfBucketMarker({ tone }: { tone: MtfBucketTone | StatusTone }) {
  return (
    <span
      aria-hidden="true"
      className={`h-1.5 w-1.5 shrink-0 rounded-full ${getMtfResearchBucketMarkerClass(tone)}`}
    />
  );
}

function getMtfResearchBucketMarkerClass(tone: MtfBucketTone | StatusTone) {
  switch (tone) {
    case "accent":
    case "info":
      return "bg-[var(--accent)]";
    case "observation":
      return "bg-[var(--observation)]";
    case "repair":
      return "bg-[var(--repair)]";
    case "eligible":
    case "positive":
    case "complete":
      return "bg-[var(--eligible)]";
    case "watch":
      return "bg-[var(--watch)]";
    case "overheated":
    case "warning":
    case "partial":
      return "bg-[var(--overheated)]";
    case "risk":
    case "negative":
    case "danger":
      return "bg-[var(--risk)]";
    default:
      return "bg-[var(--neutral)]";
  }
}

function getMtfResearchBucketButtonClass(
  tone: MtfBucketTone | StatusTone,
  isActive: boolean,
) {
  const base =
    "inline-flex h-6 min-w-[118px] shrink-0 items-center gap-1.5 border border-[var(--border)] px-2 text-left text-[11px] text-[var(--muted)] transition -ml-px first:ml-0";

  return isActive
    ? `${base} border-[var(--accent-border)] bg-[var(--panel-data)] text-[var(--foreground)] shadow-[inset_0_-2px_0_var(--accent)]`
    : `${base} bg-transparent hover:border-[var(--border-strong)] hover:bg-[var(--panel-data)] hover:text-[var(--foreground)]`;
}

function getMtfResearchBucketBorderClass(tone: MtfBucketTone | StatusTone) {
  switch (tone) {
    case "accent":
      return "border-l-[var(--accent)]";
    case "repair":
      return "border-l-[var(--repair)]";
    case "eligible":
    case "positive":
    case "complete":
      return "border-l-[var(--eligible)]";
    case "info":
      return "border-l-[var(--accent)]";
    case "observation":
      return "border-l-[var(--observation)]";
    case "watch":
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

function getHigherTimeframeHealthTone(code: string): MtfBucketTone | StatusTone {
  switch (code) {
    case "higher_tf_ok":
      return "eligible";
    case "limited_htf_data":
      return "warning";
    case "higher_tf_risk":
    case "one_day_risk":
    case "one_week_risk":
      return "risk";
    default:
      return "warning";
  }
}

function HigherTimeframeHealthCell({ row }: { row: MtfScreenerRow }) {
  const health = getMtfHigherTimeframeHealth(row);
  const tone = getHigherTimeframeHealthTone(health.code);

  return (
    <div
      title={health.label}
      className={`inline-flex max-w-full items-center gap-1.5 border-l-2 pl-1.5 ${getMtfResearchBucketBorderClass(tone)}`}
    >
      <span
        className={`min-w-0 truncate text-[10px] font-semibold ${getMtfResearchBucketValueClass(tone)}`}
      >
        {formatMtfHigherTimeframeHealthLabel(health.label)}
      </span>
    </div>
  );
}

function formatMtfHigherTimeframeHealthLabel(label: string) {
  return label
    .replace("Higher TF ", "")
    .replace("Limited HTF Data", "Limited data");
}

function PrimarySignalCell({
  row,
  dictionary,
  language,
}: {
  row: MtfScreenerRow;
  dictionary: ScannerDisplayDictionary;
  language: Language;
}) {
  const snapshot = getMtfPrimarySignalSnapshot(row);

  if (!snapshot) {
    return (
      <div
        className="text-[11px] text-[var(--muted-2)]"
        title={dictionary.scannerResultFallback.noLatestSignal}
      >
        {dictionary.scannerResultFallback.noLatestSignal}
      </div>
    );
  }

  return (
    <div className="min-w-0" title={getMtfPrimarySignal(row, language)}>
      <div
        className={`truncate text-[11px] font-semibold ${getMtfGroupTextClass(snapshot.resultGroup)}`}
      >
        {explainCode(snapshot.signalCodes[0] ?? snapshot.phaseCode, language).label}
      </div>
      <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[9px] uppercase text-[var(--muted)]">
        <span className="shrink-0 font-mono">{snapshot.timeframe}</span>
        <span
          className={`min-w-0 truncate font-semibold ${getMtfGroupTextClass(snapshot.resultGroup)}`}
        >
          {explainCode(snapshot.groupCode, language).label}
        </span>
      </div>
    </div>
  );
}

function getMtfPrimarySignalSnapshot(row: MtfScreenerRow) {
  const preferredTimeframes: MtfScreenerTimeframe[] = ["4h", "1h", "1d", "1w"];

  return (
    preferredTimeframes
      .map((timeframe) => row.snapshots[timeframe])
      .find((item) => item && item.resultGroup !== "neutral") ??
    preferredTimeframes
      .map((timeframe) => row.snapshots[timeframe])
      .find(Boolean)
  );
}

function RiskNotesCell({
  row,
  dictionary,
  language,
}: {
  row: MtfScreenerRow;
  dictionary: ScannerDisplayDictionary;
  language: Language;
}) {
  const summary = getMtfPriorityRiskNotesSummary(row, language);

  if (summary.notes.length === 0) {
    return <span className="text-[var(--muted-2)]">-</span>;
  }

  const primaryNote = formatMtfRiskNoteDisplay(summary.visibleNotes[0]);

  return (
    <div
      className="flex min-w-0 max-w-[208px] items-center gap-1.5 overflow-hidden whitespace-nowrap leading-4"
      title={summary.notes.join("; ")}
    >
      <span className="min-w-0 truncate text-[11px] text-[var(--muted)]">
        {primaryNote.text}
      </span>
      {summary.hiddenCount > 0 ? (
        <span
          title={summary.hiddenNotes.join("; ")}
          className="shrink-0 border border-[var(--neutral-border)] bg-[var(--neutral-bg)] px-1 py-0 text-[9px] font-semibold leading-4 text-[var(--neutral)]"
        >
          +{summary.hiddenCount}
        </span>
      ) : null}
    </div>
  );
}

function formatMtfRiskNoteDisplay(note: string | undefined) {
  if (!note) {
    return { text: "" };
  }

  const [candidateTimeframe, ...rest] = note.split(":");
  const timeframe = MTF_SCREENER_TIMEFRAMES.includes(
    candidateTimeframe as MtfScreenerTimeframe,
  )
    ? candidateTimeframe
    : "";
  const text = (timeframe ? rest.join(":") : note)
    .trim()
    .replace(/,\s*/g, " · ");

  return { text: formatMtfRiskNoteReason(text) };
}

function formatMtfRiskNoteReason(text: string) {
  if (/^risk group$/i.test(text)) {
    return "Risk review";
  }

  if (/^overheated$/i.test(text)) {
    return "Extended setup";
  }

  return text;
}

function getMtfPriorityRiskNotesSummary(
  row: MtfScreenerRow,
  language: Language,
) {
  const summary = getMtfRiskNotesSummary(
    row,
    Number.MAX_SAFE_INTEGER,
    language,
  );
  const notes = prioritizeMtfRiskNotes(row, summary.notes);
  const visibleNotes = notes.slice(0, 1);
  const hiddenNotes = notes.slice(1);

  return {
    notes,
    visibleNotes,
    hiddenNotes,
    hiddenCount: hiddenNotes.length,
  };
}

function prioritizeMtfRiskNotes(row: MtfScreenerRow, notes: string[]) {
  const primaryTimeframe = getMtfSymbolResearchTimeframe(row);
  const ordered: string[] = [];
  const addMatching = (matches: (note: string) => boolean) => {
    for (const note of notes) {
      if (matches(note) && !ordered.includes(note)) {
        ordered.push(note);
      }
    }
  };
  const startsWithTimeframe = (timeframe: MtfScreenerTimeframe) =>
    (note: string) => note.startsWith(`${timeframe}:`);
  const isOverheatedNote = (note: string) => /overheat/i.test(note);
  const isRiskNote = (note: string) => !isOverheatedNote(note);

  addMatching(
    (note) => startsWithTimeframe(primaryTimeframe)(note) && isRiskNote(note),
  );
  addMatching((note) => startsWithTimeframe("4h")(note) && isRiskNote(note));
  addMatching(
    (note) =>
      (startsWithTimeframe("1d")(note) || startsWithTimeframe("1w")(note)) &&
      isRiskNote(note),
  );
  addMatching(isOverheatedNote);
  addMatching(() => true);

  return ordered;
}

function ResearchLink({ row }: { row: MtfScreenerRow }) {
  const timeframe = getMtfSymbolResearchTimeframe(row);

  return (
    <Link
      href={buildMtfSymbolResearchHref({ row, timeframe })}
      title={`Open ${timeframe} research for ${row.symbol}`}
      className="terminal-mini-action is-accent min-w-[64px] gap-1 px-1.5 py-0.5 underline-offset-2 hover:underline"
    >
      <span>Open</span>
      <span className="font-mono uppercase">{timeframe}</span>
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
  "terminal-control h-6";
