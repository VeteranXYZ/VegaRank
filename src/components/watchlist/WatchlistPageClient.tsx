"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MarketContextPanel } from "@/components/market-context/MarketContextPanel";
import {
  fetchMarketContext,
  type MarketContextPanelState,
} from "@/components/market-context/marketContextUi";
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
  formatMtfGroup,
  formatMtfRank,
  getMtfHigherTimeframeHealth,
  getMtfRiskNotesSummary,
  type MtfLatestScreenerResponse,
  type MtfScreenerSnapshot,
  type MtfScreenerTimeframe,
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
  getWatchlistResearchTimeframe,
  getWatchlistSummary,
  importWatchlistSymbols,
  loadWatchlistSymbols,
  parseWatchlistSymbols,
  removeWatchlistSymbol,
  saveWatchlistSymbols,
  sortWatchlistRows,
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
  const marketContextQuery = useQuery({
    queryKey: ["market-context", assetClass],
    queryFn: ({ signal }) => fetchMarketContext({ assetClass, signal }),
    enabled: !isVisualCheck,
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: 60_000,
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
  const marketContextData =
    visualCheckData?.marketContextData ?? marketContextQuery.data;
  const marketContextIsLoading =
    !isVisualCheck && marketContextQuery.isLoading;
  const marketContextIsError = !isVisualCheck && marketContextQuery.isError;
  const marketContextIsFetching =
    !isVisualCheck && marketContextQuery.isFetching;

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
    void marketContextQuery.refetch();
  };

  return (
    <PageShell className="watchlist-terminal max-w-none xl:h-full xl:min-h-0 xl:overflow-hidden">
      <WatchlistCommandBar
        summary={summary}
        researchSummary={researchSummary}
        sourceData={latestData}
        isLoading={latestIsLoading}
        isError={latestIsError}
        isRefreshing={latestIsFetching || marketContextIsFetching}
        isVisualCheck={isVisualCheck}
        visibleRows={sortedRows.length}
        totalRows={watchlistRows.length}
        onRefresh={refreshData}
        onSave={saveWatchlist}
        onResetDefault={resetDefault}
        onClear={clearWatchlist}
      />
      <p className="mb-1 text-[11px] leading-4 text-[var(--muted)]">
        Local Watchlist stores selected symbols in this browser and displays
        each row against the latest available research snapshot.
      </p>

      <div className="grid min-h-0 flex-1 gap-2 xl:grid-cols-[232px_minmax(0,1fr)] xl:overflow-hidden">
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

          <WatchlistBackdropDisclosure
            data={marketContextData}
            isLoading={marketContextIsLoading}
            isError={marketContextIsError}
          />

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
  researchSummary,
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
  researchSummary: WatchlistResearchSummary;
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
    ["Selected", summary.totalSelectedSymbols, "accent"],
    ["Found", summary.foundSymbols, "neutral"],
    ["Missing", summary.missingSymbols, "missing"],
    ["Higher Timeframe Risk", summary.higherTimeframeRiskSymbols, "risk"],
    ["Broad Risk", researchSummary.counts.broadRiskSymbols, "risk"],
  ] as const satisfies ReadonlyArray<readonly [string, number, StatusTone]>;

  return (
    <section className="terminal-command-bar mb-2">
      <div className="terminal-command-row text-[var(--terminal-bar-muted)]">
        <div className="terminal-command-brand">
          <h1 className="terminal-command-title">Local Watchlist</h1>
        </div>
        <div className="terminal-command-main">
          <StatusBadge tone={statusTone}>{statusLabel}</StatusBadge>
          <span className="terminal-command-chip">Saved in this browser</span>
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
      <WatchlistStatePanel message="No local watchlist symbols yet." />
    );
  }

  return (
    <section className="terminal-panel-data overflow-hidden xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
      <div className="terminal-panel-header">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="terminal-panel-title">
            Latest Snapshot
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
        <DataTable minWidth="min-w-[990px]" className="table-fixed">
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
              {MTF_SCREENER_TIMEFRAMES.map((timeframe) => (
                <DataTableHeaderCell<WatchlistSortField>
                  key={timeframe}
                  sortKey={`${timeframe}_rank` as WatchlistSortField}
                  sortState={sortState}
                  onSortChange={onSortChange}
                  defaultDirection="desc"
                  align="center"
                  className="sticky top-0 z-20 w-[86px] border-l border-[var(--table-group)] bg-[var(--table-header-strong)]"
                >
                  {timeframe}
                </DataTableHeaderCell>
              ))}
              <DataTableHeaderCell<WatchlistSortField>
                sortKey="higher_timeframe_safety"
                sortState={sortState}
                onSortChange={onSortChange}
                defaultDirection="asc"
                className="sticky top-0 z-20 w-[140px] border-l border-[var(--table-group)] bg-[var(--table-header)]"
              >
                Latest Group
              </DataTableHeaderCell>
              <DataTableHeaderCell<WatchlistSortField>
                sortKey="best_short_term_rank"
                sortState={sortState}
                onSortChange={onSortChange}
                defaultDirection="desc"
                className="sticky top-0 z-20 w-[210px] bg-[var(--table-header)]"
              >
                Risk Context
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
                  Remove from Watchlist
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
                  </div>
                  <div className="mt-0.5 truncate text-[9px] uppercase text-[var(--muted)]">
                    {row.mtfRow
                      ? `${row.mtfRow.exchange} / ${row.mtfRow.market}`
                      : "Missing Snapshot"}
                  </div>
                </DataTableCell>
                {MTF_SCREENER_TIMEFRAMES.map((timeframe) => (
                  <DataTableCell
                    key={`${row.symbol}-${timeframe}`}
                    align="center"
                    className="border-l border-[var(--table-group)]"
                  >
                    <WatchlistTimeframeCell row={row} timeframe={timeframe} />
                  </DataTableCell>
                ))}
                <DataTableCell
                  className="border-l border-[var(--table-group)]"
                >
                  <WatchlistPrimaryCell row={row} />
                </DataTableCell>
                <DataTableCell>
                  {row.mtfRow ? (
                    <RiskNotesCell row={row} />
                  ) : (
                    "No latest research snapshot available"
                  )}
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
                      Remove from Watchlist
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
  researchSummary,
}: {
  summary: WatchlistSummary;
  researchSummary?: WatchlistResearchSummary;
}) {
  const cards = [
    ["Selected", summary.totalSelectedSymbols, "accent"],
    ["Active Candidates", summary.foundSymbols, "accent"],
    ["Found", summary.foundSymbols, "neutral"],
    ["Missing", summary.missingSymbols, "missing"],
    ["Higher Timeframe Risk", summary.higherTimeframeRiskSymbols, "risk"],
    ["Watch", summary.shortTermWatchSymbols, "warning"],
    ...(researchSummary
      ? ([
          ["Broad Risk", researchSummary.counts.broadRiskSymbols, "risk"],
          ["Repair", researchSummary.counts.repairInsideRiskSymbols, "warning"],
          ["Data Gaps", researchSummary.counts.missingImportantDataSymbols, "warning"],
        ] as const)
      : []),
  ] as const satisfies ReadonlyArray<readonly [string, number, StatusTone]>;

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
  className?: string;
}) {
  return (
    <aside className={`terminal-rail p-1.5 xl:min-h-0 xl:overflow-hidden ${className}`}>
      <section className="space-y-1">
        <h2 className={railSectionLabelClass}>
          Symbols
        </h2>
        <label className="block">
          <textarea
            value={draftInput}
            onChange={(event) => onDraftInputChange(event.target.value)}
            className={`${controlClass} h-[76px] resize-none py-1.5 leading-4`}
            placeholder="BTC, ETH, SOL"
          />
        </label>
      </section>

      <section className="mt-2 space-y-1">
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

      <section className="mt-2 space-y-1">
        <h2 className={railSectionLabelClass}>
          Filters
        </h2>
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
        <label className={railCheckboxLabelClass}>
          <input
            type="checkbox"
            checked={filters.hideMissing}
            onChange={() => onFilterChange("hideMissing", !filters.hideMissing)}
            className={railCheckboxClass}
          />
          Show Found Only
        </label>
        <label className={railCheckboxLabelClass}>
          <input
            type="checkbox"
            checked={filters.exclude1dRisk}
            onChange={() =>
              onFilterChange("exclude1dRisk", !filters.exclude1dRisk)
            }
            className={railCheckboxClass}
          />
          Exclude 1d risk context
        </label>
        <label className={railCheckboxLabelClass}>
          <input
            type="checkbox"
            checked={filters.exclude1wRisk}
            onChange={() =>
              onFilterChange("exclude1wRisk", !filters.exclude1wRisk)
            }
            className={railCheckboxClass}
          />
          Exclude 1w risk context
        </label>
        <label className={railCheckboxLabelClass}>
          <input
            type="checkbox"
            checked={filters.onlyShortTermWatch}
            onChange={() =>
              onFilterChange(
                "onlyShortTermWatch",
                !filters.onlyShortTermWatch,
              )
            }
            className={railCheckboxClass}
          />
          Show High Priority
        </label>
      </section>

      <details className={railDetailsClass}>
        <summary className={railSummaryClass}>
          <span>Import / Export Watchlist</span>
        </summary>
        <div className="space-y-1.5 border-t border-[var(--border)] p-1.5">
          <div>
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
          </div>
          {importStatus ? (
            <p className="text-[11px] leading-4 text-[var(--muted)]">
              {importStatus}
            </p>
          ) : null}
          <div>
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
          </div>
          {exportStatus ? (
            <p className="text-[11px] leading-4 text-[var(--muted)]">
              {exportStatus}
            </p>
          ) : null}
        </div>
      </details>
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
      <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto [scrollbar-gutter:stable]">
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
                  ? `Latest Snapshot ${formatDateTime(run.finishedAt ?? run.startedAt)} / ${signalCount} ranking results / ${missingCount} missing`
                  : "No latest snapshot"}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function WatchlistBackdropDisclosure({
  data,
  isLoading,
  isError,
}: MarketContextPanelState) {
  return (
    <details className="terminal-panel xl:shrink-0">
      <summary className="flex min-h-7 cursor-pointer list-none items-center justify-between gap-2 px-2 py-1 text-[11px] font-semibold uppercase text-[var(--muted)] marker:hidden">
        <span>Market Context</span>
        <span className="text-[9px] text-[var(--muted-2)]">
          Secondary research context
        </span>
      </summary>
      <MarketContextPanel
        variant="compact"
        data={data}
        isLoading={isLoading}
        isError={isError}
        className="border-x-0 border-b-0 shadow-none"
      />
    </details>
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
        message="Local Watchlist is empty. Add symbols, use a preset, or import a list to begin research."
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

function WatchlistTimeframeCell({
  row,
  timeframe,
}: {
  row: WatchlistRow;
  timeframe: MtfScreenerTimeframe;
}) {
  if (!row.mtfRow) {
    return (
      <DataTableChip tone="missing" title="No latest research snapshot available.">
        No Snapshot
      </DataTableChip>
    );
  }

  const snapshot = row.mtfRow.snapshots[timeframe];

  if (!snapshot) {
    return (
      <DataTableChip tone="missing" title="No latest research snapshot available.">
        N/A
      </DataTableChip>
    );
  }

  const tone = getWatchlistGroupTone(snapshot.resultGroup);

  return (
    <DataTableChip
      tone={tone}
      className="justify-center gap-1"
      title={`${timeframe} ${formatWatchlistGroup(snapshot)} rank score ${formatMtfRank(snapshot)}`}
    >
      <span className="truncate">{formatWatchlistGroup(snapshot)}</span>
      <span className="font-mono tabular-nums">{formatMtfRank(snapshot)}</span>
    </DataTableChip>
  );
}

function WatchlistPrimaryCell({ row }: { row: WatchlistRow }) {
  const primary = getWatchlistPrimaryState(row);

  return (
    <DataTableChip
      tone={primary.tone}
      className="justify-center"
      title={primary.title}
    >
      <span className="truncate">{primary.label}</span>
    </DataTableChip>
  );
}

function RiskNotesCell({ row }: { row: WatchlistRow }) {
  if (!row.mtfRow) {
    return <span>No latest research snapshot available</span>;
  }

  const summary = getMtfRiskNotesSummary(row.mtfRow, 2);
  const visibleNotes = summary.visibleNotes.map(formatWatchlistAttentionNote);

  if (summary.notes.length === 0) {
    return <span className="text-[var(--muted-2)]">No notes</span>;
  }

  return (
    <div
      className="flex min-w-0 items-center gap-1 leading-4"
      title={summary.notes.join("; ")}
    >
      <span className="min-w-0 truncate text-[var(--muted)]">
        {visibleNotes.join("; ")}
      </span>
      {summary.hiddenCount > 0 ? (
        <span className="shrink-0 rounded-[3px] border border-[var(--border)] bg-[var(--panel)] px-1 text-[10px] font-semibold text-[var(--muted)]">
          +{summary.hiddenCount}
        </span>
      ) : null}
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

function formatWatchlistAttentionNote(note: string) {
  const compact = note
    .replace(/:\s*Risk group\b/gi, " risk")
    .replace(/:\s*Overheated\b/gi, " hot")
    .replace(/:\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return compact.length > 34 ? `${compact.slice(0, 31).trim()}...` : compact;
}

function formatWatchlistGroup(snapshot: MtfScreenerSnapshot | undefined) {
  if (!snapshot) {
    return "N/A";
  }

  return snapshot.resultGroup === "overheated" ? "Hot" : formatMtfGroup(snapshot);
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

  if (summary.higherTimeframeRiskSymbols > 0) {
    return "risk";
  }

  if (summary.shortTermWatchSymbols > 0) {
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
    risk: encodeWatchlistRiskContext(filters),
    sort: `${sortState.field}:${sortState.direction}`,
  };
}

function encodeWatchlistRiskContext(filters: WatchlistFilters) {
  const entries = [
    filters.hideMissing ? "foundOnly" : null,
    filters.exclude1dRisk ? "exclude1d" : null,
    filters.exclude1wRisk ? "exclude1w" : null,
    filters.onlyShortTermWatch ? "shortTermWatch" : null,
  ].filter(Boolean);

  return entries.length > 0 ? entries.join(",") : null;
}

function applyWatchlistRiskContext(
  filters: WatchlistFilters,
  value: string | null,
) {
  const tokens = new Set(
    value
      ?.split(",")
      .map((token) => token.trim().toLowerCase())
      .filter(Boolean) ?? [],
  );

  filters.hideMissing = tokens.has("foundonly");
  filters.exclude1dRisk = tokens.has("exclude1d");
  filters.exclude1wRisk = tokens.has("exclude1w");
  filters.onlyShortTermWatch = tokens.has("shorttermwatch");
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
