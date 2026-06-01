"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatDateTime } from "@/components/scanner/latestScanUi";
import {
  MTF_SCREENER_TIMEFRAMES,
  buildMtfScreenerRowsFromResponse,
  formatMtfGroup,
  formatMtfRank,
  getMtfPrimarySignal,
  getMtfRiskNotesSummary,
  type MtfLatestScreenerResponse,
  type MtfScreenerSnapshot,
  type MtfScreenerTimeframe,
} from "@/components/screener/multiTimeframeScreenerUi";
import {
  DEFAULT_WATCHLIST_SYMBOLS,
  buildWatchlistResearchHref,
  buildWatchlistRows,
  defaultWatchlistFilters,
  defaultWatchlistSort,
  filterWatchlistRows,
  formatWatchlistInput,
  getWatchlistResearchTimeframe,
  getWatchlistSummary,
  loadWatchlistSymbols,
  parseWatchlistSymbols,
  saveWatchlistSymbols,
  sortWatchlistRows,
  watchlistSortOptions,
  type WatchlistFilters,
  type WatchlistRow,
  type WatchlistSortDirection,
  type WatchlistSortField,
  type WatchlistSortState,
  type WatchlistSummary,
} from "./watchlistUi";

const assetClass = "crypto";

export function WatchlistPageClient() {
  const [symbols, setSymbols] = useState<string[]>([
    ...DEFAULT_WATCHLIST_SYMBOLS,
  ]);
  const [draftInput, setDraftInput] = useState(
    formatWatchlistInput(DEFAULT_WATCHLIST_SYMBOLS),
  );
  const [filters, setFilters] = useState<WatchlistFilters>(
    defaultWatchlistFilters,
  );
  const [sortState, setSortState] =
    useState<WatchlistSortState>(defaultWatchlistSort);
  const latestQuery = useQuery({
    queryKey: ["mtf-latest-watchlist", assetClass],
    queryFn: ({ signal }) => fetchWatchlistMtfLatestScans({ signal }),
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });

  useEffect(() => {
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
  }, []);

  const mtfRows = useMemo(
    () => buildMtfScreenerRowsFromResponse(latestQuery.data),
    [latestQuery.data],
  );
  const watchlistRows = useMemo(
    () => buildWatchlistRows(symbols, mtfRows),
    [mtfRows, symbols],
  );
  const summary = useMemo(
    () => getWatchlistSummary(watchlistRows),
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

  const saveWatchlist = () => {
    const nextSymbols = parseWatchlistSymbols(draftInput);

    setSymbols(nextSymbols);
    setDraftInput(formatWatchlistInput(nextSymbols));
    saveWatchlistSymbols(getBrowserStorage(), nextSymbols);
  };
  const resetDefault = () => {
    const nextSymbols = [...DEFAULT_WATCHLIST_SYMBOLS];

    setSymbols(nextSymbols);
    setDraftInput(formatWatchlistInput(nextSymbols));
    saveWatchlistSymbols(getBrowserStorage(), nextSymbols);
  };
  const clearWatchlist = () => {
    setSymbols([]);
    setDraftInput("");
    saveWatchlistSymbols(getBrowserStorage(), []);
  };
  const updateFilter = <Key extends keyof WatchlistFilters>(
    key: Key,
    value: WatchlistFilters[Key],
  ) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };
  const updateSortField = (field: WatchlistSortField) => {
    setSortState((current) => ({ ...current, field }));
  };
  const updateSortDirection = (direction: WatchlistSortDirection) => {
    setSortState((current) => ({ ...current, direction }));
  };

  return (
    <section className="mx-auto flex min-h-[calc(100vh-1px)] max-w-[1800px] flex-col px-2 py-2">
      <header className="mb-2 border border-[var(--border)] bg-[#070b0f] px-3 py-3 shadow-[inset_3px_0_0_rgba(45,212,191,0.35)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-sm font-semibold text-[var(--foreground)]">
              Watchlist Multi-Timeframe
            </h1>
            <p className="mt-1 max-w-3xl text-[11px] leading-5 text-[var(--muted)]">
              Research-only view for selected Binance USDT crypto symbols
              across 1h, 4h, 1d, and 1w latest scan states.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void latestQuery.refetch()}
            disabled={latestQuery.isFetching}
            className="h-7 border border-[var(--border)] px-2 text-[11px] font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {latestQuery.isFetching ? "Refreshing" : "Refresh Data"}
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-2 xl:grid-cols-[300px_minmax(0,1fr)]">
        <WatchlistControls
          draftInput={draftInput}
          filters={filters}
          sortState={sortState}
          onDraftInputChange={setDraftInput}
          onSave={saveWatchlist}
          onResetDefault={resetDefault}
          onClear={clearWatchlist}
          onFilterChange={updateFilter}
          onSortFieldChange={updateSortField}
          onSortDirectionChange={updateSortDirection}
        />

        <main className="min-w-0 space-y-2">
          <WatchlistSummaryCards summary={summary} />
          <WatchlistSourcePanel
            data={latestQuery.data}
            totalRows={watchlistRows.length}
            filteredRows={sortedRows.length}
          />

          {latestQuery.isLoading ? (
            <WatchlistStatePanel message="Loading watchlist multi-timeframe data..." />
          ) : latestQuery.isError ? (
            <>
              <WatchlistStatePanel
                message={getWatchlistErrorMessage(latestQuery.error)}
              />
              <WatchlistTable rows={sortedRows} />
            </>
          ) : (
            <WatchlistTable rows={sortedRows} />
          )}

          <footer className="border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-[11px] text-[var(--muted)]">
            Research output only. Not financial advice.
          </footer>
        </main>
      </div>
    </section>
  );
}

export function WatchlistTable({ rows }: { rows: WatchlistRow[] }) {
  if (rows.length === 0) {
    return (
      <WatchlistStatePanel message="No watchlist symbols match the selected filters." />
    );
  }

  return (
    <section className="overflow-hidden border border-[var(--border)] bg-[var(--panel)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
        <h2 className="text-xs font-semibold text-[var(--foreground)]">
          Selected Symbols
        </h2>
        <span className="text-[11px] text-[var(--muted)]">
          {rows.length} watchlist rows
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[1320px] table-fixed text-left text-xs">
          <thead className="bg-[#080d12] text-[11px] uppercase text-[var(--muted)]">
            <tr>
              <HeaderCell className="w-[118px]">Symbol</HeaderCell>
              {MTF_SCREENER_TIMEFRAMES.map((timeframe) => (
                <HeaderCell key={`${timeframe}-group`} className="w-[86px]">
                  {timeframe} Group
                </HeaderCell>
              ))}
              {MTF_SCREENER_TIMEFRAMES.map((timeframe) => (
                <HeaderCell key={`${timeframe}-rank`} className="w-[68px]">
                  {timeframe} Rank
                </HeaderCell>
              ))}
              <HeaderCell className="w-[180px]">Primary Signal</HeaderCell>
              <HeaderCell className="w-[275px]">Risk Notes</HeaderCell>
              <HeaderCell className="w-[132px]">Research</HeaderCell>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.symbol}
                className="border-t border-[var(--border)] align-top hover:bg-[#0b1118]"
              >
                <BodyCell>
                  <div className="font-mono text-sm font-semibold text-[var(--foreground)]">
                    {row.symbol}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[var(--muted)]">
                    {row.mtfRow
                      ? `${row.mtfRow.exchange} / ${row.mtfRow.market}`
                      : "Not found"}
                  </div>
                </BodyCell>
                {MTF_SCREENER_TIMEFRAMES.map((timeframe) => (
                  <BodyCell key={`${row.symbol}-${timeframe}-group`}>
                    <WatchlistGroupCell row={row} timeframe={timeframe} />
                  </BodyCell>
                ))}
                {MTF_SCREENER_TIMEFRAMES.map((timeframe) => (
                  <BodyCell key={`${row.symbol}-${timeframe}-rank`}>
                    <span className="font-mono tabular-nums">
                      {row.mtfRow
                        ? formatMtfRank(row.mtfRow.snapshots[timeframe])
                        : "-"}
                    </span>
                  </BodyCell>
                ))}
                <BodyCell>
                  {row.mtfRow ? getMtfPrimarySignal(row.mtfRow) : "Not found"}
                </BodyCell>
                <BodyCell>
                  {row.mtfRow ? <RiskNotesCell row={row} /> : "Not found"}
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

export function WatchlistSummaryCards({
  summary,
}: {
  summary: WatchlistSummary;
}) {
  const cards = [
    ["Total selected symbols", summary.totalSelectedSymbols],
    ["Found symbols", summary.foundSymbols],
    ["Missing symbols", summary.missingSymbols],
    ["Higher-timeframe risk", summary.higherTimeframeRiskSymbols],
    ["Short-term watch / repair", summary.shortTermWatchSymbols],
  ] as const;

  return (
    <section className="grid gap-2 md:grid-cols-5">
      {cards.map(([label, value]) => (
        <div
          key={label}
          className="border border-[var(--border)] bg-[var(--panel)] px-3 py-2"
        >
          <div className="text-[11px] text-[var(--muted)]">{label}</div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-[var(--foreground)]">
            {value}
          </div>
        </div>
      ))}
    </section>
  );
}

async function fetchWatchlistMtfLatestScans({
  signal,
}: {
  signal?: AbortSignal;
}): Promise<MtfLatestScreenerResponse> {
  const response = await fetch(buildWatchlistMtfLatestScanUrl({ assetClass }), {
    signal,
  });

  if (!response.ok) {
    throw new Error(
      `Failed to load watchlist multi-timeframe data (${response.status}).`,
    );
  }

  return (await response.json()) as MtfLatestScreenerResponse;
}

export function buildWatchlistMtfLatestScanUrl({
  assetClass,
  tradeApiBaseUrl = process.env.NEXT_PUBLIC_TRADE_API_BASE_URL,
}: {
  assetClass: string;
  tradeApiBaseUrl?: string;
}) {
  const params = new URLSearchParams({ assetClass });
  const baseUrl = tradeApiBaseUrl?.trim().replace(/\/+$/, "") ?? "";

  return `${baseUrl}/api/scan/mtf-latest?${params.toString()}`;
}

function WatchlistControls({
  draftInput,
  filters,
  sortState,
  onDraftInputChange,
  onSave,
  onResetDefault,
  onClear,
  onFilterChange,
  onSortFieldChange,
  onSortDirectionChange,
}: {
  draftInput: string;
  filters: WatchlistFilters;
  sortState: WatchlistSortState;
  onDraftInputChange: (value: string) => void;
  onSave: () => void;
  onResetDefault: () => void;
  onClear: () => void;
  onFilterChange: <Key extends keyof WatchlistFilters>(
    key: Key,
    value: WatchlistFilters[Key],
  ) => void;
  onSortFieldChange: (field: WatchlistSortField) => void;
  onSortDirectionChange: (direction: WatchlistSortDirection) => void;
}) {
  return (
    <aside className="border border-[var(--border)] bg-[var(--panel)] p-3 xl:h-full xl:overflow-y-auto">
      <section className="space-y-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase text-[var(--muted)]">
            Symbols
          </span>
          <textarea
            value={draftInput}
            onChange={(event) => onDraftInputChange(event.target.value)}
            className={`${controlClass} h-36 resize-y py-2 leading-5`}
            placeholder="BTC, ETH, SOL"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onSave} className={buttonClass}>
            Save Watchlist
          </button>
          <button type="button" onClick={onResetDefault} className={buttonClass}>
            Reset Default
          </button>
          <button type="button" onClick={onClear} className={buttonClass}>
            Clear
          </button>
        </div>
      </section>

      <section className="mt-4 space-y-3">
        <h2 className="text-[11px] font-semibold uppercase text-[var(--muted)]">
          Filters
        </h2>
        <label className="block">
          <span className="mb-1 block text-[11px] text-[var(--muted)]">
            Symbol Search
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
        <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <input
            type="checkbox"
            checked={filters.hideMissing}
            onChange={() => onFilterChange("hideMissing", !filters.hideMissing)}
          />
          Hide missing symbols
        </label>
        <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <input
            type="checkbox"
            checked={filters.exclude1dRisk}
            onChange={() =>
              onFilterChange("exclude1dRisk", !filters.exclude1dRisk)
            }
          />
          Exclude 1d risk
        </label>
        <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <input
            type="checkbox"
            checked={filters.exclude1wRisk}
            onChange={() =>
              onFilterChange("exclude1wRisk", !filters.exclude1wRisk)
            }
          />
          Exclude 1w risk
        </label>
        <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <input
            type="checkbox"
            checked={filters.onlyShortTermWatch}
            onChange={() =>
              onFilterChange(
                "onlyShortTermWatch",
                !filters.onlyShortTermWatch,
              )
            }
          />
          Show only 1h or 4h eligible/watch
        </label>
      </section>

      <section className="mt-4 space-y-3">
        <h2 className="text-[11px] font-semibold uppercase text-[var(--muted)]">
          Sort
        </h2>
        <label className="block">
          <span className="mb-1 block text-[11px] text-[var(--muted)]">
            Field
          </span>
          <select
            value={sortState.field}
            onChange={(event) =>
              onSortFieldChange(event.target.value as WatchlistSortField)
            }
            className={controlClass}
          >
            {watchlistSortOptions.map((option) => (
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
              onSortDirectionChange(event.target.value as WatchlistSortDirection)
            }
            className={controlClass}
          >
            <option value="asc">
              {sortState.field === "symbol" ? "A to Z" : "Low to high"}
            </option>
            <option value="desc">
              {sortState.field === "symbol" ? "Z to A" : "High to low"}
            </option>
          </select>
        </label>
      </section>
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
    <section className="border border-[var(--border)] bg-[var(--panel)] px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold text-[var(--foreground)]">
            Data Source
          </h2>
          <p className="mt-1 text-[11px] text-[var(--muted)]">
            Latest multi-timeframe API, asset class crypto, filtered to the
            saved watchlist.
          </p>
        </div>
        <div className="text-[11px] text-[var(--muted)]">
          Showing {filteredRows} of {totalRows} selected symbols
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

function WatchlistStatePanel({ message }: { message: string }) {
  return (
    <section className="border border-[var(--border)] bg-[var(--panel)] px-3 py-8 text-center text-sm text-[var(--muted)]">
      {message}
    </section>
  );
}

function WatchlistGroupCell({
  row,
  timeframe,
}: {
  row: WatchlistRow;
  timeframe: MtfScreenerTimeframe;
}) {
  if (!row.mtfRow) {
    return <MissingBadge>Not found</MissingBadge>;
  }

  const snapshot = row.mtfRow.snapshots[timeframe];

  return (
    <GroupBadge group={snapshot?.resultGroup}>
      {formatWatchlistGroup(snapshot)}
    </GroupBadge>
  );
}

function RiskNotesCell({ row }: { row: WatchlistRow }) {
  if (!row.mtfRow) {
    return <span>Not found</span>;
  }

  const summary = getMtfRiskNotesSummary(row.mtfRow, 3);

  if (summary.notes.length === 0) {
    return <span>Manual review</span>;
  }

  return (
    <div className="space-y-1 leading-4">
      <span>{summary.visibleNotes.join("; ")}</span>
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

function ResearchLink({ row }: { row: WatchlistRow }) {
  const timeframe = getWatchlistResearchTimeframe(row);
  const href = buildWatchlistResearchHref({ row, timeframe });

  if (!href || !timeframe) {
    return (
      <span
        aria-disabled="true"
        className="inline-flex border border-[var(--border)] px-2 py-1 text-[11px] font-semibold text-[var(--muted)] opacity-70"
      >
        {row.mtfRow ? "Not returned" : "Not found"}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className="inline-flex border border-[var(--border)] px-2 py-1 text-[11px] font-semibold text-[var(--foreground)] hover:border-[var(--info)]"
    >
      Open {timeframe} Research
    </Link>
  );
}

function HeaderCell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <th className={`px-2 py-2 font-semibold ${className}`}>{children}</th>;
}

function BodyCell({ children }: { children: React.ReactNode }) {
  return <td className="px-2 py-2 text-[11px] text-[var(--muted)]">{children}</td>;
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
    <span className={`inline-flex border px-1.5 py-0.5 text-[11px] ${tone}`}>
      {children}
    </span>
  );
}

function MissingBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex border border-[var(--border)] px-1.5 py-0.5 text-[11px] text-[var(--muted)]">
      {children}
    </span>
  );
}

function formatWatchlistGroup(snapshot: MtfScreenerSnapshot | undefined) {
  return snapshot ? formatMtfGroup(snapshot) : "Not returned";
}

function getWatchlistErrorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Unable to load watchlist multi-timeframe data.";
}

function getBrowserStorage() {
  return typeof window === "undefined" ? null : window.localStorage;
}

const controlClass =
  "h-8 w-full border border-[var(--border)] bg-[#0b0f14] px-2 text-xs text-[var(--foreground)]";
const buttonClass =
  "h-8 border border-[var(--border)] px-2 text-[11px] font-semibold text-[var(--foreground)] hover:border-[var(--info)]";
