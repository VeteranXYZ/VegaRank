"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  formatDateTime,
  formatGroupLabel,
} from "@/components/scanner/latestScanUi";
import {
  MTF_SCREENER_TIMEFRAMES,
  buildMtfScreenerRows,
  buildMtfSymbolResearchHref,
  defaultMtfScreenerFilters,
  filterMtfScreenerRows,
  formatMtfGroup,
  formatMtfRank,
  getMtfPrimarySignal,
  getMtfRiskNotes,
  getMtfRunFinishedAt,
  mtfScreenerGroupFilterOptions,
  mtfScreenerPresets,
  type MtfLatestScanResponse,
  type MtfScreenerFilters,
  type MtfScreenerGroupFilter,
  type MtfScreenerPresetId,
  type MtfScreenerRow,
  type MtfScreenerTimeframe,
} from "./multiTimeframeScreenerUi";

type LatestScanResponsesByTimeframe = Partial<
  Record<MtfScreenerTimeframe, MtfLatestScanResponse>
>;

const assetClass = "crypto";

export function MultiTimeframeScreenerPageClient() {
  const [filters, setFilters] = useState<MtfScreenerFilters>(
    defaultMtfScreenerFilters,
  );
  const [presetId, setPresetId] = useState<MtfScreenerPresetId | "custom">(
    "custom",
  );
  const latestQuery = useQuery({
    queryKey: ["mtf-latest-screener", assetClass],
    queryFn: ({ signal }) => fetchMtfLatestScans({ signal }),
    staleTime: 60_000,
  });
  const rows = useMemo(
    () => buildMtfScreenerRows(latestQuery.data ?? {}),
    [latestQuery.data],
  );
  const filteredRows = useMemo(
    () => filterMtfScreenerRows(rows, filters, presetId),
    [filters, presetId, rows],
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
  const applyPreset = (nextPresetId: MtfScreenerPresetId) => {
    setPresetId(nextPresetId);
    setFilters(defaultMtfScreenerFilters);
  };
  const clearFilters = () => {
    setPresetId("custom");
    setFilters(defaultMtfScreenerFilters);
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
              Research-only view joining latest selected 1h, 4h, 1d, and 1w scan
              states for Binance USDT crypto symbols.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void latestQuery.refetch()}
            disabled={latestQuery.isFetching}
            className="h-7 border border-[var(--border)] px-2 text-[11px] font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {latestQuery.isFetching ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-2 xl:grid-cols-[270px_minmax(0,1fr)]">
        <MtfScreenerControls
          filters={filters}
          presetId={presetId}
          onGroupChange={updateGroupFilter}
          onMinRankChange={updateMinRank}
          onExcludeRiskChange={updateExcludeRisk}
          onPreset={applyPreset}
          onClear={clearFilters}
        />

        <main className="min-w-0 space-y-2">
          <MtfScreenerSourcePanel
            data={latestQuery.data}
            totalRows={rows.length}
            filteredRows={filteredRows.length}
          />

          {latestQuery.isLoading ? (
            <MtfStatePanel message="Loading multi-timeframe latest scan data..." />
          ) : latestQuery.isError ? (
            <MtfStatePanel message={getMtfErrorMessage(latestQuery.error)} />
          ) : rows.length === 0 ? (
            <MtfStatePanel message="No latest multi-timeframe rows are available yet." />
          ) : (
            <MtfScreenerTable rows={filteredRows} />
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
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
        <h2 className="text-xs font-semibold text-[var(--foreground)]">
          Matching Symbols
        </h2>
        <span className="text-[11px] text-[var(--muted)]">
          {rows.length} research rows
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[1220px] table-fixed text-left text-xs">
          <thead className="bg-[#080d12] text-[11px] uppercase text-[var(--muted)]">
            <tr>
              <HeaderCell className="w-[118px]">Symbol</HeaderCell>
              {MTF_SCREENER_TIMEFRAMES.map((timeframe) => (
                <HeaderCell key={`${timeframe}-group`} className="w-[92px]">
                  {timeframe} Group
                </HeaderCell>
              ))}
              {MTF_SCREENER_TIMEFRAMES.map((timeframe) => (
                <HeaderCell key={`${timeframe}-rank`} className="w-[78px]">
                  {timeframe} Rank
                </HeaderCell>
              ))}
              <HeaderCell className="w-[180px]">Primary Signal</HeaderCell>
              <HeaderCell className="w-[240px]">Risk Flags / Notes</HeaderCell>
              <HeaderCell className="w-[145px]">Research</HeaderCell>
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
                    {row.exchange} / {row.market}
                  </div>
                </BodyCell>
                {MTF_SCREENER_TIMEFRAMES.map((timeframe) => (
                  <BodyCell key={`${row.symbol}-${timeframe}-group`}>
                    <GroupBadge group={row.snapshots[timeframe]?.resultGroup}>
                      {formatMtfGroup(row.snapshots[timeframe])}
                    </GroupBadge>
                  </BodyCell>
                ))}
                {MTF_SCREENER_TIMEFRAMES.map((timeframe) => (
                  <BodyCell key={`${row.symbol}-${timeframe}-rank`}>
                    <span className="font-mono tabular-nums">
                      {formatMtfRank(row.snapshots[timeframe])}
                    </span>
                  </BodyCell>
                ))}
                <BodyCell>{getMtfPrimarySignal(row)}</BodyCell>
                <BodyCell>{getMtfRiskNotes(row)}</BodyCell>
                <BodyCell>
                  <Link
                    href={buildMtfSymbolResearchHref({ row })}
                    className="inline-flex border border-[var(--border)] px-2 py-1 text-[11px] font-semibold text-[var(--foreground)] hover:border-[var(--info)]"
                  >
                    Open Symbol Research
                  </Link>
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
}): Promise<LatestScanResponsesByTimeframe> {
  const entries = await Promise.all(
    MTF_SCREENER_TIMEFRAMES.map(async (timeframe) => {
      const response = await fetch(
        buildMtfLatestScanUrl({ timeframe, assetClass, limit: 500 }),
        { signal },
      );

      if (!response.ok) {
        throw new Error(
          `Failed to load ${timeframe} latest scan data (${response.status}).`,
        );
      }

      return [timeframe, (await response.json()) as MtfLatestScanResponse] as const;
    }),
  );

  return Object.fromEntries(entries) as LatestScanResponsesByTimeframe;
}

export function buildMtfLatestScanUrl({
  timeframe,
  assetClass,
  limit,
  tradeApiBaseUrl = process.env.NEXT_PUBLIC_TRADE_API_BASE_URL,
}: {
  timeframe: MtfScreenerTimeframe;
  assetClass: string;
  limit: number;
  tradeApiBaseUrl?: string;
}) {
  const params = new URLSearchParams({
    timeframe,
    assetClass,
    limit: String(limit),
  });
  const baseUrl = tradeApiBaseUrl?.trim().replace(/\/+$/, "") ?? "";

  return `${baseUrl}/api/scan/latest?${params.toString()}`;
}

function MtfScreenerControls({
  filters,
  presetId,
  onGroupChange,
  onMinRankChange,
  onExcludeRiskChange,
  onPreset,
  onClear,
}: {
  filters: MtfScreenerFilters;
  presetId: MtfScreenerPresetId | "custom";
  onGroupChange: (
    timeframe: MtfScreenerTimeframe,
    value: MtfScreenerGroupFilter,
  ) => void;
  onMinRankChange: (timeframe: MtfScreenerTimeframe, value: string) => void;
  onExcludeRiskChange: (key: "exclude1dRisk" | "exclude1wRisk") => void;
  onPreset: (presetId: MtfScreenerPresetId) => void;
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

      <section className="space-y-2">
        <h3 className="text-[11px] font-semibold uppercase text-[var(--muted)]">
          Presets
        </h3>
        <div className="space-y-1.5">
          {mtfScreenerPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              title={preset.description}
              onClick={() => onPreset(preset.id)}
              className={`w-full border px-2 py-1.5 text-left text-[11px] ${
                presetId === preset.id
                  ? "border-[var(--accent)] bg-[#0d1714] text-[var(--foreground)]"
                  : "border-[var(--border)] text-[var(--muted)]"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
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

function MtfScreenerSourcePanel({
  data,
  totalRows,
  filteredRows,
}: {
  data: LatestScanResponsesByTimeframe | undefined;
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
            Existing latest scan API, asset class crypto, limit 500 per timeframe.
          </p>
        </div>
        <div className="text-[11px] text-[var(--muted)]">
          Showing {filteredRows} of {totalRows} joined symbols
        </div>
      </div>
      <div className="mt-2 grid gap-2 md:grid-cols-4">
        {MTF_SCREENER_TIMEFRAMES.map((timeframe) => {
          const response = data?.[timeframe];

          return (
            <div
              key={timeframe}
              className="border border-[var(--border)] bg-[#080d12] px-2 py-1.5"
            >
              <div className="text-[11px] font-semibold text-[var(--foreground)]">
                {timeframe}
              </div>
              <div className="mt-1 text-[11px] text-[var(--muted)]">
                {response?.run
                  ? `${formatDateTime(getMtfRunFinishedAt(response))} - ${response.count} rows`
                  : "No selected latest run"}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MtfStatePanel({ message }: { message: string }) {
  return (
    <section className="border border-[var(--border)] bg-[var(--panel)] px-3 py-8 text-center text-sm text-[var(--muted)]">
      {message}
    </section>
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
  return <td className="px-2 py-2 text-[var(--muted)]">{children}</td>;
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

function getMtfErrorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Unable to load multi-timeframe screener data.";
}

const controlClass =
  "h-8 w-full border border-[var(--border)] bg-[#0b0f14] px-2 text-xs text-[var(--foreground)]";
