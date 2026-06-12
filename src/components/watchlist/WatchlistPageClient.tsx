"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { shortResearchDisclaimer } from "@/components/researchCopy";
import { formatDateTime } from "@/components/rankings/latestRankingsUi";
import {
  DataTable,
  DataTableCell,
  DataTableChip,
  DataTableHeaderCell,
  DataTableScroll,
  type ChipTone,
} from "@/components/table/DataTable";
import {
  PageShell,
  RefreshIconButton,
  StatusBadge,
  type StatusTone,
} from "@/components/ui/workspace";
import {
  getNavigationQueryValue,
  type ResearchNavigationContext,
  type ResearchNavigationQueryState,
} from "@/lib/navigation/researchNavigation";
import { getVegaRankApiBaseUrl } from "@/lib/runtime/vegaRankApi";
import {
  MTF_SCREENER_TIMEFRAMES,
  buildMtfScreenerRowsFromResponse,
  getMtfHigherTimeframeHealth,
  type MtfLatestScreenerResponse,
} from "@/components/screener/multiTimeframeScreenerUi";
import {
  DEFAULT_WATCHLIST_SYMBOLS,
  applyWatchlistPreset,
  buildWatchlistExportText,
  buildWatchlistResearchSummary,
  buildWatchlistResearchHref,
  buildWatchlistRows,
  defaultWatchlistFilters,
  defaultWatchlistSort,
  filterWatchlistRows,
  formatWatchlistInput,
  getWatchlistActionLabel,
  getWatchlistConfidenceLabel,
  getWatchlistLatestSnapshotLabel,
  getWatchlistRankScoreLabel,
  getWatchlistResearchGroupLabel,
  getWatchlistResearchTimeframe,
  getWatchlistRiskContextLabel,
  getWatchlistSummary,
  getWatchlistUpdatedAt,
  importWatchlistSymbols,
  isHighPriorityWatchlistRow,
  loadWatchlistSymbols,
  parseWatchlistSymbols,
  removeWatchlistSymbol,
  saveWatchlistSymbols,
  sortWatchlistRows,
  watchlistResearchGroupOptions,
  watchlistRiskContextOptions,
  watchlistPresets,
  watchlistSortOptions,
  type WatchlistFilters,
  type WatchlistPresetId,
  type WatchlistResearchSummary,
  type WatchlistResearchSummaryItem,
  type WatchlistRow,
  type WatchlistSortField,
  type WatchlistSortState,
  type WatchlistSummary,
} from "./watchlistUi";
import type { WatchlistVisualCheckData } from "./watchlistPreviewData";

const assetClass = "crypto";
type WatchlistTableSortState = {
  key: WatchlistSortField;
  direction: WatchlistSortState["direction"];
};

export function WatchlistPageClient({
  visualCheckData,
  initialQueryState,
}: {
  visualCheckData?: WatchlistVisualCheckData;
  initialQueryState?: ResearchNavigationQueryState;
} = {}) {
  const isVisualCheck = Boolean(visualCheckData);
  const initialUrlState = getWatchlistInitialUrlState(initialQueryState);
  const initialSymbols =
    visualCheckData?.selectedSymbols ?? DEFAULT_WATCHLIST_SYMBOLS;
  const [symbols, setSymbols] = useState<string[]>(() => [...initialSymbols]);
  const [draftInput, setDraftInput] = useState(
    formatWatchlistInput(initialSymbols),
  );
  const [importInput, setImportInput] = useState("");
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [filters, setFilters] = useState<WatchlistFilters>(
    initialUrlState.filters,
  );
  const [sortState, setSortState] =
    useState<WatchlistSortState>(initialUrlState.sortState);
  const latestQuery = useQuery({
    queryKey: ["mtf-latest-watchlist", assetClass],
    queryFn: ({ signal }) => fetchWatchlistMtfLatestRankings({ signal }),
    enabled: !isVisualCheck,
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
  useEffect(() => {
    if (isVisualCheck) {
      return;
    }

    const loadedSymbols = loadWatchlistSymbols(getBrowserStorage());
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      setSymbols(loadedSymbols);
      setDraftInput(formatWatchlistInput(loadedSymbols));
    });

    return () => {
      cancelled = true;
    };
  }, [isVisualCheck]);

  const latestData = visualCheckData?.latestData ?? latestQuery.data;
  const latestIsLoading = !isVisualCheck && latestQuery.isLoading;
  const latestIsError = !isVisualCheck && latestQuery.isError;
  const latestError = latestIsError ? latestQuery.error : null;
  const latestIsFetching = !isVisualCheck && latestQuery.isFetching;
  const mtfRows = useMemo(
    () => buildMtfScreenerRowsFromResponse(latestData),
    [latestData],
  );
  const watchlistRows = useMemo(
    () => buildWatchlistRows(symbols, mtfRows),
    [mtfRows, symbols],
  );
  const summary = useMemo(
    () => getWatchlistSummary(watchlistRows),
    [watchlistRows],
  );
  const researchSummary = useMemo(
    () => buildWatchlistResearchSummary(watchlistRows),
    [watchlistRows],
  );
  const filteredRows = useMemo(
    () => filterWatchlistRows(watchlistRows, filters),
    [filters, watchlistRows],
  );
  const sortedRows = useMemo(
    () => sortWatchlistRows(filteredRows, sortState),
    [filteredRows, sortState],
  );
  const tableSortState = useMemo<WatchlistTableSortState>(
    () => ({ key: sortState.field, direction: sortState.direction }),
    [sortState],
  );
  const navigationContext = useMemo(
    () => buildWatchlistNavigationContext({ filters, sortState }),
    [filters, sortState],
  );
  const exportText = useMemo(
    () => buildWatchlistExportText(parseWatchlistSymbols(draftInput)),
    [draftInput],
  );
  const persistWatchlist = (nextSymbols: readonly string[]) => {
    if (!isVisualCheck) {
      saveWatchlistSymbols(getBrowserStorage(), nextSymbols);
    }
  };

  const saveWatchlist = () => {
    const nextSymbols = parseWatchlistSymbols(draftInput);

    setSymbols(nextSymbols);
    setDraftInput(formatWatchlistInput(nextSymbols));
    setImportStatus(null);
    setExportStatus(null);
    persistWatchlist(nextSymbols);
  };
  const resetDefault = () => {
    const nextSymbols = [
      ...(visualCheckData?.selectedSymbols ?? DEFAULT_WATCHLIST_SYMBOLS),
    ];

    setSymbols(nextSymbols);
    setDraftInput(formatWatchlistInput(nextSymbols));
    setImportInput("");
    setImportStatus(null);
    setExportStatus(null);
    persistWatchlist(nextSymbols);
  };
  const clearWatchlist = () => {
    setSymbols([]);
    setDraftInput("");
    setImportInput("");
    setImportStatus(null);
    setExportStatus(null);
    persistWatchlist([]);
  };
  const applyPreset = (presetId: WatchlistPresetId) => {
    const presetSymbols = applyWatchlistPreset(presetId);

    setDraftInput(formatWatchlistInput(presetSymbols));
    setImportStatus(
      "Preset loaded into the editor. Save Local Watchlist to apply.",
    );
    setExportStatus(null);
  };
  const importSymbols = () => {
    const importedSymbols = importWatchlistSymbols(importInput);

    if (importedSymbols.length === 0) {
      setImportStatus("Imported list has no valid symbols.");
      return;
    }

    setDraftInput(formatWatchlistInput(importedSymbols));
    setImportStatus(
      `Imported ${importedSymbols.length} normalized symbols into the editor. Save Local Watchlist to apply.`,
    );
    setExportStatus(null);
  };
  const copyExportText = async () => {
    if (!exportText) {
      setExportStatus("No valid symbols to copy.");
      return;
    }

    try {
      await navigator.clipboard.writeText(exportText);
      setExportStatus("Copied normalized watchlist symbols.");
    } catch {
      setExportStatus("Copy unavailable. Select and copy the watchlist symbols.");
    }
  };
  const removeSymbol = (symbol: string) => {
    const nextSymbols = removeWatchlistSymbol(symbols, symbol);

    setSymbols(nextSymbols);
    setDraftInput(formatWatchlistInput(nextSymbols));
    setImportStatus(null);
    setExportStatus(null);
    persistWatchlist(nextSymbols);
  };
  const updateFilter = <Key extends keyof WatchlistFilters>(
    key: Key,
    value: WatchlistFilters[Key],
  ) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };
  const updateTableSort = (
    field: WatchlistSortField,
    defaultDirection: WatchlistSortState["direction"],
  ) => {
    setSortState((current) =>
      current.field === field
        ? {
            field,
            direction: current.direction === "asc" ? "desc" : "asc",
          }
        : { field, direction: defaultDirection },
    );
  };
  const refreshData = () => {
    if (isVisualCheck) {
      return;
    }

    void latestQuery.refetch();
  };
  const clearFilters = () => {
    setFilters(defaultWatchlistFilters);
    setSortState(defaultWatchlistSort);
  };

  return (
    <PageShell className="watchlist-terminal max-w-none xl:h-full xl:min-h-0 xl:overflow-hidden">
      <WatchlistCommandBar
        summary={summary}
        sourceData={latestData}
        isLoading={latestIsLoading}
        isError={latestIsError}
        isRefreshing={latestIsFetching}
        isVisualCheck={isVisualCheck}
        visibleRows={sortedRows.length}
        totalRows={watchlistRows.length}
        onRefresh={refreshData}
        onSave={saveWatchlist}
        onResetDefault={resetDefault}
        onClear={clearWatchlist}
      />

      <div className="grid min-h-0 flex-1 gap-2 xl:grid-cols-[280px_minmax(0,1fr)] xl:overflow-hidden 2xl:grid-cols-[300px_minmax(0,1fr)]">
        <WatchlistControls
          draftInput={draftInput}
          importInput={importInput}
          importStatus={importStatus}
          exportText={exportText}
          exportStatus={exportStatus}
          filters={filters}
          onDraftInputChange={setDraftInput}
          onImportInputChange={setImportInput}
          onPreset={applyPreset}
          onImport={importSymbols}
          onCopyExport={copyExportText}
          onFilterChange={updateFilter}
          sortState={sortState}
          onSortStateChange={setSortState}
          onClearFilters={clearFilters}
          onRefresh={refreshData}
          isRefreshing={latestIsFetching}
          isVisualCheck={isVisualCheck}
          className="order-2 xl:order-1"
        />

        <main className="order-1 min-w-0 space-y-2 xl:order-2 xl:flex xl:min-h-0 xl:flex-col xl:overflow-hidden">
          <WatchlistSummaryCards
            summary={summary}
            researchSummary={researchSummary}
          />

          {!latestIsError ? (
            <WatchlistSourcePanel
              data={latestData}
              totalRows={watchlistRows.length}
              filteredRows={sortedRows.length}
            />
          ) : null}
          {latestIsError ? (
            <WatchlistApiNotice
              message={getWatchlistErrorMessage(latestError)}
              summary={summary}
            />
          ) : (
            <WatchlistStatusNotice
              summary={summary}
              isLoading={latestIsLoading}
            />
          )}

          {latestIsLoading ? (
            <WatchlistStatePanel message="Loading watchlist..." />
          ) : latestIsError ? (
            <WatchlistTable
              rows={sortedRows}
              onRemoveSymbol={removeSymbol}
              sourceData={latestData}
              totalRows={watchlistRows.length}
              filteredRows={sortedRows.length}
              sortState={tableSortState}
              onSortChange={updateTableSort}
              navigationContext={navigationContext}
            />
          ) : (
            <WatchlistTable
              rows={sortedRows}
              onRemoveSymbol={removeSymbol}
              sourceData={latestData}
              totalRows={watchlistRows.length}
              filteredRows={sortedRows.length}
              sortState={tableSortState}
              onSortChange={updateTableSort}
              navigationContext={navigationContext}
            />
          )}

          <WatchlistResearchSummaryPanel summary={researchSummary} />

          <footer className="terminal-panel px-3 py-1.5 text-[11px] text-[var(--muted)]">
            {shortResearchDisclaimer}
          </footer>
        </main>
      </div>
    </PageShell>
  );
}

function WatchlistCommandBar({
  summary,
  sourceData,
  isLoading,
  isError,
  isRefreshing,
  isVisualCheck,
  visibleRows,
  totalRows,
  onRefresh,
  onSave,
  onResetDefault,
  onClear,
}: {
  summary: WatchlistSummary;
  sourceData?: MtfLatestScreenerResponse;
  isLoading: boolean;
  isError: boolean;
  isRefreshing: boolean;
  isVisualCheck: boolean;
  visibleRows: number;
  totalRows: number;
  onRefresh: () => void;
  onSave: () => void;
  onResetDefault: () => void;
  onClear: () => void;
}) {
  const statusTone = getWatchlistStatusTone({ isLoading, isError, summary });
  const statusLabel = getWatchlistStatusLabel({ isLoading, isError, summary });
  const contextLabel = sourceData
    ? `${isVisualCheck ? "visual check " : ""}${sourceData.assetClass} ${sourceData.timeframes.join(" ")}`
    : `${assetClass} ${MTF_SCREENER_TIMEFRAMES.join(" ")}`;
  const commandStats = [
    ["Selected Symbols", summary.totalSelectedSymbols, "accent"],
    ["High Priority", summary.highPrioritySymbols, "warning"],
    ["Risk Context", summary.riskContextSymbols, "risk"],
    ["Missing Snapshot", summary.missingSymbols, "missing"],
  ] as const satisfies ReadonlyArray<readonly [string, number, StatusTone]>;

  return (
    <section className="terminal-command-bar mb-2">
      <div className="terminal-command-row text-[var(--terminal-bar-muted)]">
        <div className="terminal-command-brand">
          <h1 className="terminal-command-title">Local Watchlist</h1>
        </div>
        <div className="terminal-command-main">
          <StatusBadge tone={statusTone}>{statusLabel}</StatusBadge>
          <span className="terminal-command-chip">Saved locally in this browser</span>
          <span className="terminal-command-chip">Latest Snapshot</span>
          <span className="terminal-command-chip">{contextLabel.toUpperCase()}</span>
          <span className="terminal-command-chip">
            Visible {visibleRows}/{totalRows}
          </span>
          {commandStats.map(([label, value, tone]) => (
            <span key={label} className="terminal-command-chip">
              <span className="text-[var(--terminal-bar-muted)]">{label}</span>{" "}
              <span
                className={`font-mono font-semibold tabular-nums ${getStatusValueClass(tone)}`}
              >
                {value}
              </span>
            </span>
          ))}
        </div>
        <div className="terminal-command-actions">
          <button type="button" onClick={onSave} className={commandButtonClass}>
            Save Local Watchlist
          </button>
          <button
            type="button"
            onClick={onResetDefault}
            className={commandButtonClass}
          >
            Reset View
          </button>
          <button type="button" onClick={onClear} className={commandButtonClass}>
            Clear Watchlist
          </button>
          <RefreshIconButton
            onClick={onRefresh}
            disabled={isRefreshing || isVisualCheck}
            isRefreshing={isRefreshing}
            label={isVisualCheck ? "Visual Check Data" : "Refresh Watchlist"}
          />
        </div>
      </div>
    </section>
  );
}

export function WatchlistTable({
  rows,
  onRemoveSymbol,
  sourceData,
  totalRows = rows.length,
  filteredRows = rows.length,
  sortState = null,
  onSortChange,
  navigationContext,
}: {
  rows: WatchlistRow[];
  onRemoveSymbol?: (symbol: string) => void;
  sourceData?: MtfLatestScreenerResponse;
  totalRows?: number;
  filteredRows?: number;
  sortState?: WatchlistTableSortState | null;
  onSortChange?: (
    field: WatchlistSortField,
    defaultDirection: WatchlistSortState["direction"],
  ) => void;
  navigationContext?: ResearchNavigationContext;
}) {
  if (rows.length === 0) {
    return (
      <WatchlistEmptyState />
    );
  }

  return (
    <section className="terminal-panel-data overflow-hidden xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
      <div className="terminal-panel-header">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="terminal-panel-title">
            Latest Snapshot Monitor
          </h2>
          <StatusBadge tone="neutral" className="text-[10px]">
            Selected Symbols
          </StatusBadge>
          <StatusBadge tone="accent" className="text-[10px]">
            Showing {filteredRows} of {totalRows}
          </StatusBadge>
          {sourceData ? (
            <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">
              {sourceData.assetClass} / {sourceData.timeframes.join(" ")}
            </span>
          ) : null}
        </div>
        <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">
          Current Research State
        </span>
      </div>
      <DataTableScroll className="xl:min-h-0 xl:flex-1 xl:overflow-auto">
        <DataTable minWidth="min-w-[1120px]" className="table-fixed">
          <thead className="bg-[var(--table-header)] text-[10px] uppercase text-[var(--muted)]">
            <tr>
              <DataTableHeaderCell<WatchlistSortField>
                sortKey="symbol"
                sortState={sortState}
                onSortChange={onSortChange}
                defaultDirection="asc"
                className="sticky left-0 top-0 z-30 w-[136px] border-r border-[var(--border-medium)] bg-[var(--table-header)]"
              >
                Symbol
              </DataTableHeaderCell>
              <DataTableHeaderCell<WatchlistSortField>
                sortKey="latest_snapshot"
                sortState={sortState}
                onSortChange={onSortChange}
                defaultDirection="desc"
                className="sticky top-0 z-20 w-[140px] border-l border-[var(--table-group)] bg-[var(--table-header-strong)]"
              >
                Latest Snapshot
              </DataTableHeaderCell>
              <DataTableHeaderCell<WatchlistSortField>
                sortKey="research_group"
                sortState={sortState}
                onSortChange={onSortChange}
                defaultDirection="desc"
                className="sticky top-0 z-20 w-[136px] bg-[var(--table-header)]"
              >
                Research Group
              </DataTableHeaderCell>
              <DataTableHeaderCell
                className="sticky top-0 z-20 w-[140px] bg-[var(--table-header)]"
              >
                Action
              </DataTableHeaderCell>
              <DataTableHeaderCell
                className="sticky top-0 z-20 w-[220px] bg-[var(--table-header)]"
              >
                Risk Context
              </DataTableHeaderCell>
              <DataTableHeaderCell<WatchlistSortField>
                sortKey="rank_score"
                sortState={sortState}
                onSortChange={onSortChange}
                defaultDirection="desc"
                align="right"
                className="sticky top-0 z-20 w-[104px] bg-[var(--table-header)]"
              >
                Rank Score
              </DataTableHeaderCell>
              <DataTableHeaderCell<WatchlistSortField>
                sortKey="confidence"
                sortState={sortState}
                onSortChange={onSortChange}
                defaultDirection="desc"
                align="right"
                className="sticky top-0 z-20 w-[104px] bg-[var(--table-header)]"
              >
                Confidence
              </DataTableHeaderCell>
              <DataTableHeaderCell<WatchlistSortField>
                sortKey="updated"
                sortState={sortState}
                onSortChange={onSortChange}
                defaultDirection="desc"
                className="sticky top-0 z-20 w-[156px] bg-[var(--table-header)]"
              >
                Updated
              </DataTableHeaderCell>
              <DataTableHeaderCell
                align="center"
                className="sticky top-0 z-20 w-[116px] bg-[var(--table-header)]"
              >
                Open Research
              </DataTableHeaderCell>
              {onRemoveSymbol ? (
                <DataTableHeaderCell
                  align="center"
                  className="sticky top-0 z-20 w-[132px] bg-[var(--table-header)]"
                >
                  remove
                </DataTableHeaderCell>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.symbol}
                className="group border-t border-[var(--table-grid)] align-top odd:bg-[var(--panel-data)] even:bg-[var(--panel-muted)] hover:bg-[var(--row-hover)] hover:shadow-[inset_3px_0_0_var(--accent)]"
              >
                <DataTableCell className="sticky left-0 z-10 border-r border-[var(--border-medium)] bg-inherit group-hover:bg-[var(--row-hover)]">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className={`h-2 w-2 shrink-0 ${getWatchlistRowDotClass(row)}`} />
                    <span className="min-w-0 truncate font-mono text-[12px] font-semibold text-[var(--foreground)]">
                      {row.symbol}
                    </span>
                    {isHighPriorityWatchlistRow(row) ? (
                      <StatusBadge tone="warning" className="text-[9px]">
                        High Priority
                      </StatusBadge>
                    ) : null}
                  </div>
                  <div className="mt-0.5 truncate text-[9px] uppercase text-[var(--muted)]">
                    {row.mtfRow
                      ? `${row.mtfRow.exchange} / ${row.mtfRow.market}`
                      : "Missing Snapshot"}
                  </div>
                </DataTableCell>
                <DataTableCell className="border-l border-[var(--table-group)]">
                  <WatchlistLatestSnapshotCell row={row} />
                </DataTableCell>
                <DataTableCell
                  className="border-l border-[var(--table-group)]"
                >
                  <WatchlistResearchGroupCell row={row} />
                </DataTableCell>
                <DataTableCell>
                  <span className="block truncate" title={getWatchlistActionLabel(row)}>
                    {getWatchlistActionLabel(row)}
                  </span>
                </DataTableCell>
                <DataTableCell>
                  <RiskNotesCell row={row} />
                </DataTableCell>
                <DataTableCell align="right">
                  <span className="font-mono tabular-nums">
                    {getWatchlistRankScoreLabel(row)}
                  </span>
                </DataTableCell>
                <DataTableCell align="right">
                  <span className="font-mono tabular-nums">
                    {getWatchlistConfidenceLabel(row)}
                  </span>
                </DataTableCell>
                <DataTableCell>
                  <span className="text-[11px] text-[var(--muted)]">
                    {formatDateTime(getWatchlistUpdatedAt(row))}
                  </span>
                </DataTableCell>
                <DataTableCell align="center">
                  <ResearchLink row={row} context={navigationContext} />
                </DataTableCell>
                {onRemoveSymbol ? (
                  <DataTableCell align="center">
                    <button
                      type="button"
                      onClick={() => onRemoveSymbol(row.symbol)}
                      className="terminal-mini-action h-5 min-w-[118px] px-1.5"
                    >
                      remove
                    </button>
                  </DataTableCell>
                ) : null}
              </tr>
            ))}
          </tbody>
        </DataTable>
      </DataTableScroll>
    </section>
  );
}

export function WatchlistSummaryCards({
  summary,
  researchSummary: _researchSummary,
}: {
  summary: WatchlistSummary;
  researchSummary?: WatchlistResearchSummary;
}) {
  const cards = [
    ["Selected Symbols", String(summary.totalSelectedSymbols), "accent"],
    ["High Priority", String(summary.highPrioritySymbols), "warning"],
    ["Risk Context", String(summary.riskContextSymbols), "risk"],
    ["Missing Snapshot", String(summary.missingSymbols), "missing"],
    ["Latest Snapshot", formatDateTime(summary.latestSnapshotAt), "neutral"],
  ] as const satisfies ReadonlyArray<readonly [string, string, StatusTone]>;

  return (
    <section className="terminal-panel flex min-w-0 items-center gap-1.5 overflow-x-auto px-2 py-1 [scrollbar-gutter:stable] xl:shrink-0">
      <span className="shrink-0 border-r border-[var(--border)] pr-2 text-[10px] font-semibold uppercase text-[var(--muted)]">
        Summary
      </span>
      {cards.map(([label, value, tone]) => (
        <div
          key={label}
          className="terminal-panel-muted inline-flex h-6 shrink-0 items-center gap-1.5 px-1.5 text-[10px]"
        >
          <span className="font-semibold uppercase text-[var(--muted)]">
            {label}
          </span>
          <span className={`font-mono font-semibold tabular-nums ${getStatusValueClass(tone)}`}>
            {value}
          </span>
        </div>
      ))}
    </section>
  );
}

export function WatchlistResearchSummaryPanel({
  summary,
}: {
  summary: WatchlistResearchSummary;
}) {
  if (summary.counts.foundSymbols === 0) {
    return null;
  }

  return (
    <section className="space-y-1.5 xl:shrink-0">
      <div className="terminal-panel flex flex-wrap items-center justify-between gap-2 px-2 py-1.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="terminal-panel-title">
            Research Watch
          </h2>
          <StatusBadge tone={getConditionTone(summary.conditionLabel)}>
            {summary.conditionLabel}
          </StatusBadge>
          <span className="truncate text-[11px] text-[var(--muted)]">
            {summary.conditionText}
          </span>
        </div>
        <StatusBadge tone="neutral">{summary.researchPosture}</StatusBadge>
      </div>
      <div className="grid items-start gap-1.5 lg:grid-cols-3">
        <ResearchSummaryList
          title="Risk First"
          emptyText="No concentrated risk flags."
          items={summary.highestRiskSymbols}
        />
        <ResearchSummaryList
          title="Watch / Repair"
          emptyText="No short-term watch states."
          items={summary.bestResearchCandidates}
        />
        <ResearchSummaryList
          title="Data Gaps"
          emptyText="No important 1d or 1w gaps."
          items={summary.missingDataSymbols}
        />
      </div>
    </section>
  );
}

async function fetchWatchlistMtfLatestRankings({
  signal,
}: {
  signal?: AbortSignal;
}): Promise<MtfLatestScreenerResponse> {
  const response = await fetch(buildWatchlistMtfLatestRankingsUrl({ assetClass }), {
    signal,
  });

  if (!response.ok) {
    throw new Error(
      `Unable to load watchlist (${response.status}).`,
    );
  }

  return (await response.json()) as MtfLatestScreenerResponse;
}

export function buildWatchlistMtfLatestRankingsUrl({
  assetClass,
  tradeApiBaseUrl = process.env.NEXT_PUBLIC_TRADE_API_BASE_URL,
}: {
  assetClass: string;
  tradeApiBaseUrl?: string;
}) {
  const params = new URLSearchParams({ assetClass });
  const baseUrl = getVegaRankApiBaseUrl(tradeApiBaseUrl);

  return `${baseUrl}/api/rankings/mtf-latest?${params.toString()}`;
}

export function WatchlistControls({
  draftInput,
  importInput,
  importStatus,
  exportText,
  exportStatus,
  filters,
  onDraftInputChange,
  onImportInputChange,
  onPreset,
  onImport,
  onCopyExport,
  onFilterChange,
  sortState,
  onSortStateChange,
  onClearFilters,
  onRefresh,
  isRefreshing,
  isVisualCheck,
  className = "",
}: {
  draftInput: string;
  importInput: string;
  importStatus: string | null;
  exportText: string;
  exportStatus: string | null;
  filters: WatchlistFilters;
  onDraftInputChange: (value: string) => void;
  onImportInputChange: (value: string) => void;
  onPreset: (presetId: WatchlistPresetId) => void;
  onImport: () => void;
  onCopyExport: () => void;
  onFilterChange: <Key extends keyof WatchlistFilters>(
    key: Key,
    value: WatchlistFilters[Key],
  ) => void;
  sortState: WatchlistSortState;
  onSortStateChange: (value: WatchlistSortState) => void;
  onClearFilters: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  isVisualCheck: boolean;
  className?: string;
}) {
  return (
    <aside
      aria-label="Watchlist controls"
      className={`terminal-rail xl:flex xl:h-full xl:min-h-0 xl:flex-col xl:overflow-hidden ${className}`}
    >
      <div className="terminal-panel-header">
        <div className="min-w-0">
          <h2 className="terminal-panel-title text-[11px]">Watchlist Controls</h2>
          <p className="text-[10px] text-[var(--muted)]">Filters and symbols</p>
        </div>
        <RefreshIconButton
          onClick={onRefresh}
          disabled={isRefreshing || isVisualCheck}
          isRefreshing={isRefreshing}
          label={isVisualCheck ? "Visual Check Data" : "Refresh Watchlist"}
        />
      </div>

      <div className="space-y-1.5 p-1.5 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
        <label className="block">
          <span className={railFieldLabelClass}>
            Search Symbol
          </span>
          <input
            type="search"
            value={filters.symbolSearch}
            onChange={(event) =>
              onFilterChange("symbolSearch", event.target.value)
            }
            className={controlClass}
            placeholder="BTC"
          />
        </label>
        <label className="block">
          <span className={railFieldLabelClass}>
            Research Group
          </span>
          <select
            value={filters.researchGroup}
            onChange={(event) =>
              onFilterChange(
                "researchGroup",
                event.target.value as WatchlistFilters["researchGroup"],
              )
            }
            className={controlClass}
          >
            {watchlistResearchGroupOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={railFieldLabelClass}>
            Risk Context
          </span>
          <select
            value={filters.riskContext}
            onChange={(event) =>
              onFilterChange(
                "riskContext",
                event.target.value as WatchlistFilters["riskContext"],
              )
            }
            className={controlClass}
          >
            {watchlistRiskContextOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={railFieldLabelClass}>
            Sort By
          </span>
          <select
            value={`${sortState.field}:${sortState.direction}`}
            onChange={(event) => {
              const [field, direction] = event.target.value.split(":");

              onSortStateChange({
                field: field as WatchlistSortField,
                direction: direction as WatchlistSortState["direction"],
              });
            }}
            className={controlClass}
          >
            {watchlistSortOptions.map((option) => (
              <option
                key={`${option.field}-desc`}
                value={`${option.field}:desc`}
              >
                {option.label} desc
              </option>
            ))}
            {watchlistSortOptions.map((option) => (
              <option key={`${option.field}-asc`} value={`${option.field}:asc`}>
                {option.label} asc
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={onClearFilters}
          className="terminal-mini-action h-6 px-2 text-[10px]"
        >
          Clear Filters
        </button>

      <details open className={railDetailsClass}>
        <summary className={railSummaryClass}>
          <span>Selected Symbols</span>
        </summary>
        <div className="space-y-2 border-t border-[var(--border)] p-1.5">
          <section className="space-y-1">
            <h2 className={railSectionLabelClass}>
              Symbols
            </h2>
            <textarea
              value={draftInput}
              onChange={(event) => onDraftInputChange(event.target.value)}
              className={`${controlClass} h-[76px] resize-none py-1.5 leading-4`}
              placeholder="BTC, ETH, SOL"
            />
          </section>
          <section className="space-y-1">
            <h2 className={railSectionLabelClass}>
              Presets
            </h2>
            <div className="grid grid-cols-2 gap-1">
              {watchlistPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onPreset(preset.id)}
                  className="terminal-mini-action is-left min-h-6 justify-start px-1.5 py-0.5 text-[10px] leading-4 text-[var(--foreground)]"
                  title={preset.symbols.join(", ")}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </section>
          <section className="space-y-1.5">
            <div className="mb-0.5 flex items-center justify-between gap-2">
              <span className={railFieldLabelClass}>Paste Symbols</span>
              <button type="button" onClick={onImport} className={railMiniButtonClass}>
                Import Symbols
              </button>
            </div>
            <textarea
              value={importInput}
              onChange={(event) => onImportInputChange(event.target.value)}
              className={`${controlClass} h-12 resize-none py-1.5 leading-4`}
              placeholder="BTC, ETH, SEI"
            />
            {importStatus ? (
              <p className="text-[11px] leading-4 text-[var(--muted)]">
                {importStatus}
              </p>
            ) : null}
            <div className="mb-0.5 flex items-center justify-between gap-2">
              <span className={railFieldLabelClass}>Selected Symbols</span>
              <button
                type="button"
                onClick={onCopyExport}
                className={railMiniButtonClass}
              >
                Copy Watchlist
              </button>
            </div>
            <textarea
              readOnly
              value={exportText}
              className={`${controlClass} h-9 resize-none py-1.5 leading-4`}
              placeholder="No valid symbols to copy"
            />
            {exportStatus ? (
              <p className="text-[11px] leading-4 text-[var(--muted)]">
                {exportStatus}
              </p>
            ) : null}
          </section>
        </div>
      </details>
      </div>
    </aside>
  );
}

function WatchlistSourcePanel({
  data,
  totalRows,
  filteredRows,
}: {
  data: MtfLatestScreenerResponse | undefined;
  totalRows: number;
  filteredRows: number;
}) {
  return (
    <section className="terminal-panel-muted px-2 py-1.5">
      <div className="flex min-w-0 flex-nowrap items-center gap-1.5 overflow-hidden">
        <span className="shrink-0 border-r border-[var(--border)] pr-2 text-[10px] font-semibold uppercase text-[var(--muted)]">
          Latest Snapshot Source
        </span>
        <span className="shrink-0 text-[10px] font-semibold uppercase text-[var(--muted)]">
          {filteredRows}/{totalRows} selected
        </span>
        {MTF_SCREENER_TIMEFRAMES.map((timeframe) => {
          const run = data?.runs[timeframe];
          const signalCount = data?.signalCounts[timeframe] ?? 0;
          const missingCount = data?.missingCounts[timeframe] ?? 0;

          return (
            <div
              key={timeframe}
              className="terminal-panel inline-flex shrink-0 items-center gap-1.5 px-1.5 py-0.5 text-[10px]"
            >
              <span className="font-mono font-semibold uppercase text-[var(--foreground)]">
                {timeframe}
              </span>
              <span className="text-[var(--muted)]">
                {run
                  ? `${formatDateTime(run.finishedAt ?? run.startedAt)} · ${signalCount}/${missingCount}`
                  : "No latest snapshot"}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ResearchSummaryList({
  title,
  emptyText,
  items,
}: {
  title: string;
  emptyText: string;
  items: WatchlistResearchSummaryItem[];
}) {
  const visibleItems = items.slice(0, 2);

  return (
    <section className="terminal-panel-muted min-w-0 px-2 py-1.5">
      <h3 className="text-[11px] font-semibold uppercase text-[var(--muted)]">
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="mt-1 text-[11px] text-[var(--muted)]">{emptyText}</p>
      ) : (
        <ul className="mt-1 divide-y divide-[var(--border)]">
          {visibleItems.map((item) => (
            <li key={item.symbol} className="py-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-[var(--foreground)]">
                  {item.symbol}
                </span>
                <span className="text-[10px] uppercase text-[var(--muted)]">
                  {item.timeframe ?? "Data"}
                </span>
              </div>
              <p
                className="mt-0.5 truncate text-[11px] leading-4 text-[var(--muted)]"
                title={item.reason}
              >
                {item.reason}
              </p>
              {item.rankScore !== null ? (
                <div className="mt-0.5 font-mono text-[10px] tabular-nums text-[var(--muted)]">
                  Rank Score {formatSummaryRank(item.rankScore)}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function WatchlistStatusNotice({
  summary,
  isLoading,
}: {
  summary: WatchlistSummary;
  isLoading: boolean;
}) {
  if (summary.totalSelectedSymbols === 0) {
    return (
      <CompactNotice
        tone="missing"
        message="No watchlist symbols yet. Add symbols from Market Rankings or Symbol Research to monitor them against the latest snapshot."
      />
    );
  }

  if (isLoading) {
    return null;
  }

  if (summary.foundSymbols === 0) {
    return (
      <CompactNotice
        tone="missing"
        message={`Insufficient data · latest research snapshot unavailable for selected symbols · ${summary.totalSelectedSymbols} selected / 0 found / ${summary.missingSymbols} missing`}
      />
    );
  }

  if (summary.missingSymbols > 0) {
    return (
      <CompactNotice
        tone="missing"
        message={`${summary.missingSymbols} selected symbols have no latest research snapshot available yet.`}
      />
    );
  }

  return null;
}

function WatchlistApiNotice({
  message,
  summary,
}: {
  message: string;
  summary: WatchlistSummary;
}) {
  return (
    <CompactNotice
      tone="risk"
      message={`Unable to load watchlist. Latest research snapshot unavailable · ${summary.totalSelectedSymbols} selected / ${summary.foundSymbols} found / ${summary.missingSymbols} missing · ${message}`}
    />
  );
}

function CompactNotice({
  message,
  tone = "neutral",
}: {
  message: string;
  tone?: StatusTone;
}) {
  return (
    <section
      className={`terminal-state-panel px-3 py-2 text-[11px] leading-4 text-[var(--muted)] ${getNoticeToneClass(tone)}`}
    >
      {message}
    </section>
  );
}

function WatchlistStatePanel({ message }: { message: string }) {
  return (
    <section className="terminal-state-panel px-3 py-3 text-center text-xs text-[var(--muted)]">
      {message}
    </section>
  );
}

function WatchlistEmptyState() {
  return (
    <section className="terminal-state-panel px-3 py-5 text-center text-xs text-[var(--muted)]">
      <h2 className="text-sm font-semibold text-[var(--foreground)]">
        No watchlist symbols yet.
      </h2>
      <p className="mx-auto mt-1 max-w-[520px] leading-5">
        Add symbols from Market Rankings or Symbol Research to monitor them
        against the latest snapshot.
      </p>
      <p className="mt-1 text-[11px]">Saved locally in this browser.</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <Link href="/rankings" className="terminal-mini-action is-accent h-6 px-2">
          Open Rankings
        </Link>
        <Link href="/screener" className="terminal-mini-action h-6 px-2">
          Open Screener
        </Link>
      </div>
    </section>
  );
}

function WatchlistLatestSnapshotCell({ row }: { row: WatchlistRow }) {
  return (
    <DataTableChip
      tone={row.mtfRow ? "neutral" : "missing"}
      className="justify-center"
      title={
        row.mtfRow
          ? getWatchlistLatestSnapshotLabel(row)
          : "No latest research snapshot available."
      }
    >
      <span className="truncate">{getWatchlistLatestSnapshotLabel(row)}</span>
    </DataTableChip>
  );
}

function WatchlistResearchGroupCell({ row }: { row: WatchlistRow }) {
  const groupLabel = getWatchlistResearchGroupLabel(row);

  return (
    <DataTableChip
      tone={getResearchGroupTone(groupLabel)}
      className="justify-center"
      title={groupLabel === "N/A" ? "No latest research snapshot available." : groupLabel}
    >
      <span className="truncate">{groupLabel}</span>
    </DataTableChip>
  );
}

function RiskNotesCell({ row }: { row: WatchlistRow }) {
  const label = getWatchlistRiskContextLabel(row);

  return (
    <div
      className="flex min-w-0 items-center gap-1 leading-4"
      title={label}
    >
      <span className="min-w-0 truncate text-[var(--muted)]">
        {label}
      </span>
    </div>
  );
}

function ResearchLink({
  row,
  context,
}: {
  row: WatchlistRow;
  context?: ResearchNavigationContext;
}) {
  const timeframe = getWatchlistResearchTimeframe(row);
  const href = buildWatchlistResearchHref({ row, timeframe, context });

  if (!href || !timeframe) {
    return (
      <span
        aria-disabled="true"
        className="terminal-mini-action h-5 px-1.5 opacity-70"
        title={
          row.mtfRow
            ? "No latest research snapshot is available for a supported timeframe."
            : "No latest research snapshot available."
        }
      >
        {row.mtfRow ? "No Timeframe" : "Missing Snapshot"}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className="terminal-mini-action is-accent h-5 min-w-[104px] px-1.5"
    >
      Open Research
    </Link>
  );
}

function getWatchlistPrimaryState(row: WatchlistRow): {
  label: string;
  tone: ChipTone;
  title: string;
} {
  if (!row.mtfRow) {
    return {
      label: "Missing Snapshot",
      tone: "missing",
      title: "No latest research snapshot available for this selected symbol.",
    };
  }

  const health = getMtfHigherTimeframeHealth(row.mtfRow);

  switch (health.code) {
    case "higher_tf_risk":
      return {
        label: "Higher Timeframe Risk",
        tone: "risk",
        title: health.label,
      };
    case "one_day_risk":
      return {
        label: "1d Risk",
        tone: "risk",
        title: health.label,
      };
    case "one_week_risk":
      return {
        label: "1w Risk",
        tone: "risk",
        title: health.label,
      };
    case "limited_htf_data":
      return {
        label: "Data gap",
        tone: "warning",
        title: health.label,
      };
    case "higher_tf_ok":
      return {
        label: "Higher Timeframe OK",
        tone: "eligible",
        title: health.label,
      };
  }
}

function getWatchlistGroupTone(group: string | null | undefined): ChipTone {
  if (group === "eligible") {
    return "eligible";
  }

  if (group === "watch") {
    return "warning";
  }

  if (group === "overheated") {
    return "warning";
  }

  if (group === "risk") {
    return "risk";
  }

  return "neutral";
}

function getResearchGroupTone(groupLabel: string): ChipTone {
  switch (groupLabel) {
    case "Eligible":
      return "eligible";
    case "Watch":
    case "Hot":
      return "warning";
    case "Risk":
      return "risk";
    case "N/A":
      return "missing";
    default:
      return "neutral";
  }
}

function getWatchlistRowDotClass(row: WatchlistRow) {
  if (!row.mtfRow) {
    return "bg-[var(--missing)]";
  }

  const groups = MTF_SCREENER_TIMEFRAMES.map(
    (timeframe) => row.mtfRow?.snapshots[timeframe]?.resultGroup,
  );

  if (groups.includes("risk")) {
    return "bg-[var(--risk)]";
  }

  if (groups.includes("overheated")) {
    return "bg-[var(--warning)]";
  }

  if (groups.includes("watch")) {
    return "bg-[var(--warning)]";
  }

  if (groups.includes("eligible")) {
    return "bg-[var(--eligible)]";
  }

  return "bg-[var(--neutral)]";
}

function getWatchlistStatusTone({
  isLoading,
  isError,
  summary,
}: {
  isLoading: boolean;
  isError: boolean;
  summary: WatchlistSummary;
}): StatusTone {
  if (isError) {
    return "danger";
  }

  if (isLoading) {
    return "warning";
  }

  if (summary.totalSelectedSymbols === 0 || summary.foundSymbols === 0) {
    return "missing";
  }

  if (summary.riskContextSymbols > 0) {
    return "risk";
  }

  if (summary.highPrioritySymbols > 0) {
    return "warning";
  }

  return "neutral";
}

function getWatchlistStatusLabel({
  isLoading,
  isError,
  summary,
}: {
  isLoading: boolean;
  isError: boolean;
  summary: WatchlistSummary;
}) {
  if (isError) {
    return "Unable";
  }

  if (isLoading) {
    return "Loading";
  }

  if (summary.totalSelectedSymbols === 0) {
    return "Empty";
  }

  if (summary.foundSymbols === 0) {
    return "Missing Snapshot";
  }

  return "Monitoring";
}

function getConditionTone(
  conditionLabel: WatchlistResearchSummary["conditionLabel"],
): StatusTone {
  if (conditionLabel === "Broad risk") {
    return "risk";
  }

  if (conditionLabel === "Short-term repair inside higher-timeframe risk") {
    return "warning";
  }

  if (conditionLabel === "Higher-timeframe improving") {
    return "eligible";
  }

  if (conditionLabel === "Insufficient data") {
    return "missing";
  }

  return "warning";
}

function getStatusValueClass(tone: StatusTone) {
  switch (tone) {
    case "eligible":
    case "complete":
    case "positive":
      return "text-[var(--eligible)]";
    case "watch":
      return "text-[var(--warning)]";
    case "risk":
    case "danger":
    case "negative":
      return "text-[var(--risk)]";
    case "overheated":
    case "warning":
    case "partial":
      return "text-[var(--overheated)]";
    case "accent":
    case "info":
      return "text-[var(--accent)]";
    case "observation":
      return "text-[var(--observation)]";
    case "missing":
    case "neutral":
      return "text-[var(--neutral)]";
  }
}

function getNoticeToneClass(tone: StatusTone) {
  switch (tone) {
    case "eligible":
    case "complete":
    case "positive":
      return "border-l-[var(--eligible)]";
    case "watch":
      return "border-l-[var(--warning)]";
    case "risk":
    case "danger":
    case "negative":
      return "border-l-[var(--risk)]";
    case "overheated":
    case "warning":
    case "partial":
      return "border-l-[var(--overheated)]";
    case "accent":
    case "info":
      return "border-l-[var(--accent)]";
    case "observation":
      return "border-l-[var(--observation)]";
    case "missing":
    case "neutral":
      return "border-l-[var(--missing)]";
  }
}

function getWatchlistErrorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Unable to load watchlist.";
}

function getWatchlistInitialUrlState(
  queryState?: ResearchNavigationQueryState,
): {
  filters: WatchlistFilters;
  sortState: WatchlistSortState;
} {
  const filters = {
    ...defaultWatchlistFilters,
    symbolSearch: getNavigationQueryValue(queryState, "q")?.trim() ?? "",
  };

  applyWatchlistGroupContext(filters, getNavigationQueryValue(queryState, "group"));
  applyWatchlistRiskContext(filters, getNavigationQueryValue(queryState, "risk"));

  return {
    filters,
    sortState:
      parseWatchlistSortState(getNavigationQueryValue(queryState, "sort")) ??
      defaultWatchlistSort,
  };
}

function buildWatchlistNavigationContext({
  filters,
  sortState,
}: {
  filters: WatchlistFilters;
  sortState: WatchlistSortState;
}): ResearchNavigationContext {
  return {
    q: filters.symbolSearch.trim() || null,
    group: filters.researchGroup === "any" ? null : filters.researchGroup,
    risk: encodeWatchlistRiskContext(filters),
    sort: `${sortState.field}:${sortState.direction}`,
  };
}

function encodeWatchlistRiskContext(filters: WatchlistFilters) {
  return filters.riskContext === "any" ? null : filters.riskContext;
}

function applyWatchlistGroupContext(
  filters: WatchlistFilters,
  value: string | null,
) {
  if (
    watchlistResearchGroupOptions.some((option) => option.value === value)
  ) {
    filters.researchGroup = value as WatchlistFilters["researchGroup"];
  }
}

function applyWatchlistRiskContext(
  filters: WatchlistFilters,
  value: string | null,
) {
  if (watchlistRiskContextOptions.some((option) => option.value === value)) {
    filters.riskContext = value as WatchlistFilters["riskContext"];
  }
}

function parseWatchlistSortState(value: string | null): WatchlistSortState | null {
  const [field, direction] = value?.split(":").map((part) => part.trim()) ?? [];

  if (
    watchlistSortOptions.some((option) => option.field === field) &&
    (direction === "asc" || direction === "desc")
  ) {
    return { field: field as WatchlistSortField, direction };
  }

  return null;
}

function getBrowserStorage() {
  return typeof window === "undefined" ? null : window.localStorage;
}

function formatSummaryRank(value: number) {
  return Number.isFinite(value) ? value.toFixed(1) : "N/A";
}

const controlClass =
  "terminal-control h-6 text-[10px]";
const commandButtonClass =
  "terminal-command-action disabled:cursor-not-allowed disabled:opacity-60";
const railSectionLabelClass =
  "text-[10px] font-semibold uppercase leading-4 text-[var(--muted)]";
const railFieldLabelClass =
  "mb-0.5 block text-[9px] font-semibold uppercase leading-3 text-[var(--muted)]";
const railCheckboxLabelClass =
  "flex min-h-5 items-center gap-1.5 text-[10px] leading-4 text-[var(--muted)]";
const railCheckboxClass = "h-3 w-3 shrink-0 accent-[var(--accent)]";
const railMiniButtonClass =
  "terminal-mini-action h-5 px-1.5 text-[9px] text-[var(--foreground)]";
const railDetailsClass =
  "mt-2 border border-[var(--border)] bg-[var(--panel-2)]";
const railSummaryClass =
  "flex min-h-6 cursor-pointer list-none items-center justify-between gap-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-4 text-[var(--muted)] marker:hidden";
