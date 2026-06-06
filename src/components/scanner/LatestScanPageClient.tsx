"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Fragment, useMemo, useState, type ReactNode } from "react";
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
  PageShell,
  RefreshIconButton,
  StatusBadge,
  type StatusTone,
} from "@/components/ui/workspace";
import { formatDisplayDateTime } from "@/lib/utils/format";
import {
  formatDateTime,
  formatGroupLabel,
  formatPrice,
  formatQualityTier,
  formatScore,
  formatSignalLabel,
  getDetectedRiskTypeLabels,
  getLatestScanGroupSummaryChips,
  getLatestScanScoreRows,
  getLatestScanActionDisplay,
  getReviewStatusNote,
  getReviewStatusReasons,
  latestScanGroupOrder,
  normalizeGroupKey,
  toTitleCase,
  type LatestScanGroupKey,
} from "./latestScanUi";

export type LatestScanAssetClass =
  | "crypto"
  | "stable"
  | "fiat"
  | "gold"
  | "special"
  | "all";
export type LatestScanTimeframe = "4h" | "1h" | "1d" | "1w";
export type LatestScanLimit = 100 | 200 | 300 | 500;

export type LatestScanRun = {
  id: string;
  timeframe: string;
  universe: string;
  status: string;
  symbolsTotal: number;
  symbolsScanned: number;
  signalsCreated: number;
  symbolsSkipped: number;
  failedSymbols: number;
  startedAt: string;
  finishedAt: string | null;
};

export type LatestScanSummary = {
  totalSignals: number;
  returnedItems: number;
  lowQualityExcluded: number;
  confirmed?: number;
  trend?: number;
  watchSignals?: number;
  overheatedSignals?: number;
  breakdownRisk?: number;
  distributionRisk?: number;
  avoid?: number;
  eligibleSignals?: number;
  doNotChase?: number;
  eligible?: number;
  watch?: number;
  overheated?: number;
  risk?: number;
  neutral?: number;
  insufficient_history?: number;
  visibleByGroup?: Partial<Record<LatestScanGroupKey, number>>;
  totalByGroup?: Partial<Record<LatestScanGroupKey, number>>;
  limitedGroups?: LatestScanGroupKey[];
  allocationStrategy?: string;
};

export type LatestScanItem = {
  id: string;
  scanRunId: string;
  exchange?: string | null;
  market?: string | null;
  symbol: string;
  timeframe: string;
  resultGroup?: string | null;
  rankScore: number | null;
  signalLabel: string | null;
  actionBias: string | null;
  reviewTier?: string | null;
  statusNote?: string | null;
  cautionLevel?: string | null;
  statusReasons?: string[];
  primaryStructure: string | null;
  qualityTier: string | null;
  isLowQuality: boolean;
  qualityFlags: string[];
  candleCount: number;
  priceAtSignal: number | null;
  candleOpenTime: string | null;
  opportunityScore: number | null;
  confirmationScore: number | null;
  riskScore: number | null;
  trendScore: number | null;
  momentumScore: number | null;
  volumeScore: number | null;
  structureScore: number | null;
  secondaryStructures?: unknown[];
  detectedRiskTypes?: unknown[];
  nextConfirmation?: unknown;
  invalidation?: unknown;
  factors?: Record<string, unknown>;
  rawMetrics?: Record<string, unknown>;
};

export type LatestScanGroups = Partial<
  Record<LatestScanGroupKey | "insufficientHistory", LatestScanItem[]>
>;

export type LatestScanResponse = {
  ok: boolean;
  run: LatestScanRun | null;
  summary: LatestScanSummary | null;
  groups: LatestScanGroups | null;
  items: LatestScanItem[];
  count: number;
  timeframe: string;
  assetClass: string;
  includeLowQuality: boolean;
  includeNonScanner?: boolean;
  includeMarketContext?: boolean;
  error?: string | { code?: string; message?: string };
  message?: string;
};

type BuildLatestScanUrlParams = {
  timeframe: LatestScanTimeframe;
  assetClass: LatestScanAssetClass;
  limit?: LatestScanLimit;
  includeLowQuality?: boolean;
  tradeApiBaseUrl?: string;
};

type BuildSymbolResearchHrefParams = {
  exchange?: string | null;
  symbol: string;
  timeframe?: string | null;
  assetClass?: string | null;
  includeLowQuality?: boolean | string | null;
  limit?: number | string | null;
  from?: string | null;
};

type LatestScanQueryStateInput =
  | { get(name: string): string | null }
  | Record<string, string | string[] | number | boolean | null | undefined>
  | null
  | undefined;

type LatestRunSummaryTextInput = {
  symbolsTotal: number | null | undefined;
  symbolsScanned: number | null | undefined;
  signalsCreated: number | null | undefined;
  symbolsSkipped: number | null | undefined;
  returnedItems: number | null | undefined;
  totalSignals: number | null | undefined;
  lowQualityExcluded: number | null | undefined;
};

type LatestLimitedViewWarningInput = {
  count: number | null | undefined;
  returnedItems: number | null | undefined;
  totalSignals: number | null | undefined;
};

const assetClassOptions: LatestScanAssetClass[] = [
  "crypto",
  "stable",
  "fiat",
  "gold",
  "special",
  "all",
];
const timeframeOptions: LatestScanTimeframe[] = ["4h", "1h", "1d", "1w"];
const limitOptions: LatestScanLimit[] = [100, 200, 300, 500];
type LatestScanSortKey =
  | "symbol"
  | "rank"
  | "signal"
  | "action"
  | "setup"
  | "quality"
  | "price";
type LatestScanTableRow = {
  item: LatestScanItem;
  sourceIndex: number;
};
type LatestScanTerminalTone =
  | "accent"
  | "complete"
  | "missing"
  | "neutral"
  | "risk"
  | "watch"
  | "overheated"
  | "eligible"
  | "warning";
type LatestScanGroupTone = Extract<StatusTone, ChipTone>;

export function LatestScanPageClient({
  initialQueryState,
  visualCheckData,
}: {
  initialQueryState?: LatestScanQueryStateInput;
  visualCheckData?: LatestScanResponse;
} = {}) {
  const isVisualCheck = Boolean(visualCheckData);
  const initialFilters = getLatestScanInitialFilters(initialQueryState);
  const [timeframe, setTimeframe] = useState<LatestScanTimeframe>(
    initialFilters.timeframe,
  );
  const [assetClass, setAssetClass] = useState<LatestScanAssetClass>(
    initialFilters.assetClass,
  );
  const [limit, setLimit] = useState<LatestScanLimit>(initialFilters.limit);
  const [includeLowQuality, setIncludeLowQuality] = useState(
    initialFilters.includeLowQuality,
  );
  const [tableSort, setTableSort] =
    useState<DataSortState<LatestScanSortKey> | null>({
      key: "rank",
      direction: "desc",
    });
  const latestScanQuery = useQuery({
    queryKey: ["latest-scan", timeframe, assetClass, limit, includeLowQuality],
    queryFn: ({ signal }) =>
      fetchLatestScan({
        timeframe,
        assetClass,
        limit,
        includeLowQuality,
        signal,
      }),
    enabled: !isVisualCheck,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const data = visualCheckData ?? latestScanQuery.data ?? null;
  const tableRows = useMemo(() => buildLatestScanTableRows(data), [data]);
  const visibleRows = useMemo(
    () => sortDataRows(tableRows, tableSort, getLatestScanSortValue),
    [tableRows, tableSort],
  );
  const visibleItems = useMemo(
    () => visibleRows.map((row) => row.item),
    [visibleRows],
  );
  const finishedAt = data?.run?.finishedAt ?? data?.run?.startedAt ?? null;
  const totalSignals = data?.summary?.totalSignals ?? 0;
  const returnedItems = data?.summary?.returnedItems ?? data?.count ?? 0;
  const lowQualityExcluded = data?.summary?.lowQualityExcluded ?? 0;
  const hasUnavailableData = !isVisualCheck && latestScanQuery.isError;
  const isLoading = !isVisualCheck && latestScanQuery.isLoading;
  const updateTableSort = (
    key: LatestScanSortKey,
    defaultDirection: DataSortDirection,
  ) => {
    setTableSort((current) =>
      getNextDataSortState({ current, key, defaultDirection }),
    );
  };
  const downloadVisibleCsv = () => {
    if (visibleItems.length === 0 || typeof document === "undefined") {
      return;
    }

    const blob = new Blob([formatLatestScanCsv(visibleItems)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `scanner-${timeframe}-${assetClass}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageShell className="scanner-terminal max-w-none overflow-x-hidden xl:h-full xl:min-h-0 xl:overflow-hidden">
      <LatestScanCommandBar
        timeframe={timeframe}
        assetClass={assetClass}
        run={data?.run ?? null}
        finishedAt={finishedAt}
        returnedItems={returnedItems}
        totalSignals={totalSignals}
        isLoading={isLoading}
        isError={hasUnavailableData}
        isRefreshing={!isVisualCheck && latestScanQuery.isFetching}
        canExport={visibleItems.length > 0}
        onRefresh={() => {
          if (!isVisualCheck) {
            void latestScanQuery.refetch();
          }
        }}
        onExportCsv={downloadVisibleCsv}
      />

      <div className="grid min-h-0 flex-1 gap-2 xl:grid-cols-[208px_minmax(0,1fr)] xl:overflow-hidden 2xl:grid-cols-[216px_minmax(0,1fr)]">
        <LatestScanControls
          timeframe={timeframe}
          assetClass={assetClass}
          limit={limit}
          includeLowQuality={includeLowQuality}
          onTimeframeChange={setTimeframe}
          onAssetClassChange={setAssetClass}
          onLimitChange={setLimit}
          onIncludeLowQualityChange={setIncludeLowQuality}
        />

        <main className="min-h-0 min-w-0 space-y-1.5 xl:flex xl:flex-col xl:overflow-hidden">
          <LatestScanSummaryPanel
            data={data}
            timeframe={timeframe}
            assetClass={assetClass}
            includeLowQuality={includeLowQuality}
            finishedAt={finishedAt}
            totalSignals={totalSignals}
            returnedItems={returnedItems}
            lowQualityExcluded={lowQualityExcluded}
          />

          {hasUnavailableData ? (
            <StatePanel
              title="Scanner unavailable"
              message="API unavailable · latest scan not loaded. Try Refresh or check API."
            />
          ) : isLoading ? (
            <StatePanel
              title="Loading latest scan"
              message="Fetching latest scan results."
            />
          ) : !data?.run || returnedItems === 0 ? (
            <StatePanel
              title="No latest scan results"
              message="No signals matched the current latest-scan filters."
            />
          ) : (
            <LatestScanResultsTable
              rows={visibleRows}
              summary={data.summary}
              sortState={tableSort}
              onSortChange={updateTableSort}
              timeframe={timeframe}
              assetClass={assetClass}
              includeLowQuality={includeLowQuality}
              limit={limit}
            />
          )}
        </main>
      </div>
    </PageShell>
  );
}

function LatestScanCommandBar({
  timeframe,
  assetClass,
  run,
  finishedAt,
  returnedItems,
  totalSignals,
  isLoading,
  isError,
  isRefreshing,
  canExport,
  onRefresh,
  onExportCsv,
}: {
  timeframe: LatestScanTimeframe;
  assetClass: LatestScanAssetClass;
  run: LatestScanRun | null;
  finishedAt: string | null;
  returnedItems: number;
  totalSignals: number;
  isLoading: boolean;
  isError: boolean;
  isRefreshing: boolean;
  canExport: boolean;
  onRefresh: () => void;
  onExportCsv: () => void;
}) {
  const statusLabel = getLatestScanRunStatusLabel({ run, isLoading, isError });
  const statusTone = getLatestScanRunStatusTone({ run, isLoading, isError });

  return (
    <header className="terminal-command-bar mb-1">
      <div className="terminal-command-row text-[var(--terminal-bar-muted)]">
        <div className="terminal-command-brand">
          <h1 className="terminal-command-title">SCANNER</h1>
          <span className="shrink-0 font-mono text-[10px] text-[var(--terminal-bar-muted)]">
            latest output
          </span>
        </div>
        <div className="terminal-command-main">
          <LatestScanCommandStat
            label="Timeframe"
            value={timeframe.toUpperCase()}
            tone="accent"
          />
          <LatestScanCommandStat
            label="Asset"
            value={assetClass.toUpperCase()}
            tone="neutral"
          />
          <LatestScanCommandStat
            label="Status"
            value={statusLabel}
            tone={statusTone}
          />
          <LatestScanCommandStat
            label="Finished"
            value={formatCompactDateTime(finishedAt)}
            tone={run ? "complete" : "missing"}
          />
          <LatestScanCommandStat
            label="Shown"
            value={`${formatInteger(returnedItems)}/${formatInteger(totalSignals)}`}
            tone={returnedItems > 0 ? "complete" : "missing"}
          />
        </div>
        <div className="terminal-command-actions">
          <button
            type="button"
            onClick={onExportCsv}
            disabled={!canExport}
            className="terminal-command-action disabled:cursor-not-allowed disabled:opacity-55"
          >
            Export CSV
          </button>
          <RefreshIconButton
            onClick={onRefresh}
            disabled={isRefreshing}
            isRefreshing={isRefreshing}
            label="Refresh"
          />
        </div>
      </div>
    </header>
  );
}

function LatestScanCommandStat({
  label,
  value,
  tone = "neutral",
  title,
}: {
  label: string;
  value: string;
  tone?: LatestScanTerminalTone;
  title?: string;
}) {
  return (
    <div
      title={title ?? `${label}: ${value}`}
      className={`inline-flex h-6 max-w-[220px] shrink-0 items-center gap-1.5 overflow-hidden border border-l-2 border-white/10 bg-white/[0.04] px-1.5 ${getLatestScanTerminalToneBorderClass(tone)}`}
    >
      <span className="shrink-0 text-[9px] font-semibold uppercase text-[var(--terminal-bar-muted)]">
        {label}
      </span>
      <span
        className={`min-w-0 truncate font-mono text-[10px] font-semibold leading-4 ${getLatestScanTerminalToneTextClass(tone)}`}
      >
        {value}
      </span>
    </div>
  );
}

function LatestScanControls({
  timeframe,
  assetClass,
  limit,
  includeLowQuality,
  onTimeframeChange,
  onAssetClassChange,
  onLimitChange,
  onIncludeLowQualityChange,
}: {
  timeframe: LatestScanTimeframe;
  assetClass: LatestScanAssetClass;
  limit: LatestScanLimit;
  includeLowQuality: boolean;
  onTimeframeChange: (value: LatestScanTimeframe) => void;
  onAssetClassChange: (value: LatestScanAssetClass) => void;
  onLimitChange: (value: LatestScanLimit) => void;
  onIncludeLowQualityChange: (value: boolean) => void;
}) {
  return (
    <aside className="terminal-rail p-2 xl:h-full xl:min-h-0 xl:overflow-y-auto">
      <h2 className="terminal-panel-title mb-2">
        Controls
      </h2>
      <div className="grid gap-2 text-xs text-[var(--muted)] sm:grid-cols-2 xl:grid-cols-1">
        <ControlSection title="Scope">
          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-wide">
              Timeframe
            </span>
            <select
              value={timeframe}
              onChange={(event) =>
                onTimeframeChange(event.target.value as LatestScanTimeframe)
              }
              className={controlClass}
            >
              {timeframeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-wide">
              Asset Class
            </span>
            <select
              value={assetClass}
              onChange={(event) =>
                onAssetClassChange(event.target.value as LatestScanAssetClass)
              }
              className={controlClass}
            >
              {assetClassOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-wide">
              API Limit
            </span>
            <select
              value={limit}
              onChange={(event) =>
                onLimitChange(Number(event.target.value) as LatestScanLimit)
              }
              className={controlClass}
            >
              {limitOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </ControlSection>

        <ControlSection title="Quality">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeLowQuality}
              onChange={(event) => onIncludeLowQualityChange(event.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--accent)]"
            />
            <span>
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--foreground)]">
                Include low quality
              </span>
            </span>
          </label>
        </ControlSection>
      </div>
    </aside>
  );
}

function LatestScanSummaryPanel({
  data,
  timeframe,
  assetClass,
  includeLowQuality,
  finishedAt,
  totalSignals,
  returnedItems,
  lowQualityExcluded,
}: {
  data: LatestScanResponse | null;
  timeframe: string;
  assetClass: string;
  includeLowQuality: boolean;
  finishedAt: string | null;
  totalSignals: number;
  returnedItems: number;
  lowQualityExcluded: number;
}) {
  const run = data?.run;
  const showUniverseWarning = shouldShowIncompleteCryptoUniverseWarning({
    assetClass,
    symbolsTotal: run?.symbolsTotal,
  });
  return (
    <section className="terminal-panel px-2 py-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="terminal-command-label">Run Summary</span>
          <CompactMetric label="Universe" value={formatInteger(run?.symbolsTotal)} />
          <CompactMetric label="Scanned" value={formatInteger(run?.symbolsScanned)} />
          <CompactMetric
            label="Signals"
            value={formatInteger(run?.signalsCreated ?? totalSignals)}
          />
          <CompactMetric label="Skipped" value={formatInteger(run?.symbolsSkipped)} />
          <CompactMetric label="Low-quality" value={formatInteger(lowQualityExcluded)} />
          <CompactMetric
            label="Limited"
            value={`${formatInteger(returnedItems)}/${formatInteger(totalSignals)}`}
          />
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-1">
          <StatusBadge tone={run ? "complete" : "missing"}>
            {run?.status ?? "No run"}
          </StatusBadge>
          <StatusBadge tone="accent">{timeframe.toUpperCase()}</StatusBadge>
          <StatusBadge tone="neutral">{assetClass.toUpperCase()}</StatusBadge>
          {!includeLowQuality ? (
            <StatusBadge tone="neutral">Low quality excluded</StatusBadge>
          ) : null}
          <StatusBadge tone={finishedAt ? "neutral" : "missing"}>
            Finished {formatCompactDateTime(finishedAt)}
          </StatusBadge>
        </div>
      </div>
      {showUniverseWarning ? (
        <p className="mt-1 inline-flex border border-[var(--warning-border)] bg-[var(--warning-bg)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--warning)]">
          Scan universe incomplete: {formatInteger(run?.symbolsTotal)} crypto symbols.
        </p>
      ) : null}
    </section>
  );
}

function ControlSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2 border-t border-[var(--border)] pt-2 first:border-t-0 first:pt-0">
      <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
        {title}
      </h3>
      {children}
    </section>
  );
}

function LatestScanGroupSummaryChips({ summary }: { summary: LatestScanSummary }) {
  const chips = getLatestScanGroupSummaryChips(summary);

  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">
        Group Counts
      </span>
      {chips.map((chip) => (
        <StatusBadge key={chip.label} tone={getLatestScanGroupTone(chip.group)}>
          {chip.label} {formatInteger(chip.count)}
        </StatusBadge>
      ))}
    </div>
  );
}

function LatestScanResultsTable({
  rows,
  summary,
  sortState,
  onSortChange,
  timeframe,
  assetClass,
  includeLowQuality,
  limit,
}: {
  rows: LatestScanTableRow[];
  summary: LatestScanSummary | null;
  sortState: DataSortState<LatestScanSortKey> | null;
  onSortChange: (
    key: LatestScanSortKey,
    defaultDirection: DataSortDirection,
  ) => void;
  timeframe: LatestScanTimeframe;
  assetClass: LatestScanAssetClass;
  includeLowQuality: boolean;
  limit: LatestScanLimit;
}) {
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const sharedCandleTime = getSharedLatestScanCandleTime(rows);
  const showCandleTimeColumn = sharedCandleTime === null;
  const tableColumnCount = showCandleTimeColumn ? 9 : 8;

  return (
    <section className="terminal-panel-data min-h-0 overflow-hidden xl:flex xl:flex-1 xl:flex-col">
      <div className="terminal-panel-header gap-2">
        <div className="min-w-0 flex-1">
          {summary ? <LatestScanGroupSummaryChips summary={summary} /> : null}
        </div>
        <div className="min-w-0 shrink-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h2 className="terminal-panel-title">
              Latest Scan Rows
            </h2>
            <StatusBadge tone="accent" className="text-[10px]">
              {formatInteger(rows.length)} rows
            </StatusBadge>
            {sharedCandleTime ? (
              <StatusBadge tone="neutral" className="text-[10px]">
                Candle {formatDateTime(sharedCandleTime)}
              </StatusBadge>
            ) : null}
          </div>
        </div>
      </div>

      <DataTableScroll className="!overflow-x-auto !overflow-y-auto xl:min-h-0 xl:flex-1">
        <DataTable
          minWidth={showCandleTimeColumn ? "min-w-[900px]" : "min-w-[790px]"}
          className="table-fixed"
        >
          <thead className="sticky top-0 z-20 bg-[var(--table-header)]">
            <tr>
              <DataTableHeaderCell
                sortKey="symbol"
                sortState={sortState}
                onSortChange={onSortChange}
                className="w-[96px]"
              >
                Symbol
              </DataTableHeaderCell>
              <DataTableHeaderCell
                sortKey="rank"
                sortState={sortState}
                defaultDirection="desc"
                onSortChange={onSortChange}
                className="w-[72px]"
                align="right"
              >
                Rank
              </DataTableHeaderCell>
              <DataTableHeaderCell
                sortKey="signal"
                sortState={sortState}
                onSortChange={onSortChange}
                className="w-[146px]"
              >
                Signal
              </DataTableHeaderCell>
              <DataTableHeaderCell
                sortKey="action"
                sortState={sortState}
                onSortChange={onSortChange}
                className="w-[150px]"
              >
                Action
              </DataTableHeaderCell>
              <DataTableHeaderCell
                sortKey="setup"
                sortState={sortState}
                onSortChange={onSortChange}
                className="w-[138px]"
              >
                Setup Type
              </DataTableHeaderCell>
              <DataTableHeaderCell
                sortKey="quality"
                sortState={sortState}
                onSortChange={onSortChange}
                className="w-[92px]"
              >
                Quality
              </DataTableHeaderCell>
              <DataTableHeaderCell
                sortKey="price"
                sortState={sortState}
                defaultDirection="desc"
                onSortChange={onSortChange}
                className="w-[104px]"
                align="right"
              >
                Price
              </DataTableHeaderCell>
              {showCandleTimeColumn ? (
                <DataTableHeaderCell className="w-[154px]">
                  Candle Time
                </DataTableHeaderCell>
              ) : null}
              <DataTableHeaderCell className="w-[86px]">Details</DataTableHeaderCell>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ item }) => {
              const isExpanded = expandedItemId === item.id;

              return (
                <Fragment key={item.id}>
                  <LatestScanRow
                    item={item}
                    isExpanded={isExpanded}
                    onToggleDetails={() =>
                      setExpandedItemId(isExpanded ? null : item.id)
                    }
                    timeframe={timeframe}
                    assetClass={assetClass}
                    includeLowQuality={includeLowQuality}
                    limit={limit}
                    showCandleTimeColumn={showCandleTimeColumn}
                  />
                  {isExpanded ? (
                    <LatestScanDetailsRow item={item} colSpan={tableColumnCount} />
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </DataTable>
      </DataTableScroll>
    </section>
  );
}

function LatestScanRow({
  item,
  isExpanded,
  onToggleDetails,
  timeframe,
  assetClass,
  includeLowQuality,
  limit,
  showCandleTimeColumn,
}: {
  item: LatestScanItem;
  isExpanded: boolean;
  onToggleDetails: () => void;
  timeframe: LatestScanTimeframe;
  assetClass: LatestScanAssetClass;
  includeLowQuality: boolean;
  limit: LatestScanLimit;
  showCandleTimeColumn: boolean;
}) {
  const group = normalizeGroupKey(item.resultGroup);
  const groupTone = getLatestScanGroupTone(group);
  const signalLabel = formatSignalLabel(item.signalLabel);
  const actionLabel = getLatestScanActionDisplay(item);
  const statusNote = getReviewStatusNote(item);

  return (
    <tr
      className={
        isExpanded
          ? "border-t border-[var(--table-grid)] bg-[var(--row-selected)] align-middle"
          : "border-t border-[var(--table-grid)] align-middle hover:bg-[var(--row-hover)]"
      }
    >
      <DataTableCell className="font-semibold text-[var(--foreground)]">
        <Link
          className="text-[var(--info)] underline-offset-2 hover:underline"
          href={buildSymbolResearchHref({
            exchange: item.exchange ?? "binance",
            symbol: item.symbol,
            timeframe,
            assetClass,
            includeLowQuality,
            limit,
            from: "scanner",
          })}
        >
          {item.symbol}
        </Link>
      </DataTableCell>
      <DataTableCell align="right" className="font-mono tabular-nums text-[var(--foreground)]">
        {formatScore(item.rankScore)}
      </DataTableCell>
      <DataTableCell>
        <div
          className="flex min-w-0 items-center gap-1.5"
          title={`${formatGroupLabel(group)} · ${signalLabel}`}
        >
          <DataTableChip tone={groupTone} className="shrink-0">
            {formatGroupLabel(group)}
          </DataTableChip>
          <span className="min-w-0 truncate text-[10px] font-semibold text-[var(--muted)]">
            {signalLabel}
          </span>
        </div>
      </DataTableCell>
      <DataTableCell>
        <div
          className="flex min-w-0 items-center gap-1.5"
          title={`${actionLabel} · ${statusNote}`}
        >
          <DataTableChip tone={groupTone} className="shrink-0">
            {actionLabel}
          </DataTableChip>
          <span className="min-w-0 truncate text-[10px] font-semibold text-[var(--muted)]">
            {statusNote}
          </span>
        </div>
      </DataTableCell>
      <DataTableCell truncate title={formatStructure(item.primaryStructure)}>
        {formatStructure(item.primaryStructure)}
      </DataTableCell>
      <DataTableCell>
        <DataTableChip
          tone={item.isLowQuality ? "warning" : "neutral"}
          title={item.isLowQuality ? "Low quality" : formatQualityTier(item.qualityTier)}
        >
          {formatQualityTier(item.qualityTier)}
        </DataTableChip>
      </DataTableCell>
      <DataTableCell align="right" className="font-mono tabular-nums text-[var(--foreground)]">
        {formatPrice(item.priceAtSignal)}
      </DataTableCell>
      {showCandleTimeColumn ? (
        <DataTableCell className="text-[var(--muted)]">
          {formatDateTime(item.candleOpenTime)}
        </DataTableCell>
      ) : null}
      <DataTableCell>
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={onToggleDetails}
          className="terminal-mini-action is-accent h-6 px-2"
        >
          {isExpanded ? "Hide" : "Details"}
        </button>
      </DataTableCell>
    </tr>
  );
}

function LatestScanDetailsRow({
  item,
  colSpan,
}: {
  item: LatestScanItem;
  colSpan: number;
}) {
  return (
    <tr className="border-t border-[var(--border)] bg-[var(--panel-2)]">
      <td colSpan={colSpan} className="px-3 py-3">
        <LatestScanDetails item={item} />
      </td>
    </tr>
  );
}

function LatestScanDetails({ item }: { item: LatestScanItem }) {
  const factors = normalizeFactors(item.factors);
  const rawMetrics = pickRawMetrics(item.rawMetrics);
  const riskTypeLabels = getDetectedRiskTypeLabels(item.detectedRiskTypes);
  const statusReasons = getReviewStatusReasons(item);
  const metricsAndFactors = [...factors, ...rawMetrics];

  return (
    <div className="grid gap-3 text-[11px] leading-5 text-[var(--muted)] md:grid-cols-2 xl:grid-cols-3">
      <DetailBlock title="Grouping Reason">
        <TextList values={statusReasons} />
      </DetailBlock>
      <DetailBlock title="Candle Context">
        <TextList
          values={[
            `Candles: ${formatInteger(item.candleCount)}`,
            `Candle Time: ${formatDateTime(item.candleOpenTime)}`,
          ]}
        />
      </DetailBlock>
      <DetailBlock title="Score Breakdown">
        <ScoreBreakdown item={item} />
      </DetailBlock>
      <DetailBlock title="Quality Flags">
        <TokenList values={item.qualityFlags.map(formatQualityTier)} empty="None" />
      </DetailBlock>
      <DetailBlock title="Secondary Structures">
        <TokenList values={formatUnknownList(item.secondaryStructures)} empty="None" />
      </DetailBlock>
      <DetailBlock title="Detected Risks">
        <TokenList values={riskTypeLabels} empty="None" />
      </DetailBlock>
      <DetailBlock title="Next Confirmation">
        <TextList values={formatUnknownList(item.nextConfirmation)} />
      </DetailBlock>
      <DetailBlock title="Invalidation">
        <TextList values={formatUnknownList(item.invalidation)} />
      </DetailBlock>
      <DetailBlock title="Selected Metrics / Factors">
        <TextList values={metricsAndFactors} />
      </DetailBlock>
    </div>
  );
}

function ScoreBreakdown({ item }: { item: LatestScanItem }) {
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
      {getLatestScanScoreRows(item).map((score) => (
        <div
          key={score.label}
          className="flex items-center justify-between gap-2 border-b border-[var(--border)] pb-0.5"
        >
          <dt className="text-[var(--muted-2)]">{score.label}</dt>
          <dd className="font-mono tabular-nums text-[var(--foreground)]">
            {score.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function CompactMetric({ label, value }: { label: string; value: string }) {
  return (
    <span className="terminal-command-chip">
      <span className="text-[var(--terminal-bar-muted)]">{label}</span>
      {" "}
      <span className="font-mono font-semibold tabular-nums text-[var(--terminal-bar-foreground)]">
        {value}
      </span>
    </span>
  );
}

function StatePanel({ title, message }: { title: string; message: string }) {
  return (
    <section className="terminal-state-panel is-center xl:flex-1">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-1 max-w-md text-[12px] leading-5 text-[var(--muted)]">
        {message}
      </p>
    </section>
  );
}

function DetailBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-2)]">
        {title}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function TokenList({ values, empty }: { values: string[]; empty: string }) {
  if (values.length === 0) {
    return <span className="text-[var(--muted)]">{empty}</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {values.map((value) => (
        <span
          key={value}
          className="border border-[var(--border)] bg-[var(--control)] px-1 py-0.5 text-[10px]"
        >
          {value}
        </span>
      ))}
    </div>
  );
}

function TextList({ values }: { values: string[] }) {
  if (values.length === 0) {
    return <span className="text-[var(--muted)]">None</span>;
  }

  return (
    <ul className="space-y-0.5">
      {values.map((value) => (
        <li key={value}>{value}</li>
      ))}
    </ul>
  );
}

function getSharedLatestScanCandleTime(rows: LatestScanTableRow[]) {
  if (rows.length === 0) {
    return null;
  }

  const firstTime = rows[0]?.item.candleOpenTime ?? null;

  if (!firstTime) {
    return null;
  }

  return rows.every((row) => row.item.candleOpenTime === firstTime)
    ? firstTime
    : null;
}

function buildLatestScanTableRows(data: LatestScanResponse | null) {
  const groups = data?.groups ?? {};
  const rows: LatestScanTableRow[] = [];
  const seen = new Set<string>();

  latestScanGroupOrder.forEach((group) => {
    getGroupItems(groups, group).forEach((item) => {
      const key = item.id || `${item.symbol}-${item.timeframe}-${item.scanRunId}`;

      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      rows.push({ item, sourceIndex: rows.length });
    });
  });

  if (rows.length > 0) {
    return rows;
  }

  return (data?.items ?? []).map((item, sourceIndex) => ({
    item: {
      ...item,
      resultGroup: normalizeGroupKey(item.resultGroup),
    },
    sourceIndex,
  }));
}

function getGroupItems(groups: LatestScanGroups, group: LatestScanGroupKey) {
  const items =
    group === "insufficient_history"
      ? groups.insufficient_history ?? groups.insufficientHistory ?? []
      : groups[group] ?? [];

  return items.map((item) => ({
    ...item,
    resultGroup: normalizeGroupKey(item.resultGroup ?? group),
  }));
}

function getLatestScanSortValue(
  row: LatestScanTableRow,
  key: LatestScanSortKey,
): DataSortValue {
  const { item } = row;

  switch (key) {
    case "symbol":
      return item.symbol;
    case "rank":
      return item.rankScore;
    case "signal":
      return `${getLatestScanGroupSortRank(
        normalizeGroupKey(item.resultGroup),
      )}-${formatSignalLabel(item.signalLabel)}`;
    case "action":
      return getLatestScanActionDisplay(item);
    case "setup":
      return formatStructure(item.primaryStructure);
    case "quality":
      return `${getLatestScanQualitySortRank(item)}-${formatQualityTier(
        item.qualityTier,
      )}`;
    case "price":
      return item.priceAtSignal;
  }
}

function getLatestScanGroupSortRank(group: LatestScanGroupKey) {
  const index = latestScanGroupOrder.indexOf(group);

  return index === -1 ? latestScanGroupOrder.length : index;
}

function getLatestScanQualitySortRank(item: LatestScanItem) {
  if (item.isLowQuality) {
    return 2;
  }

  const tier = item.qualityTier?.trim().toLowerCase() ?? "";

  if (tier.includes("high")) {
    return 0;
  }

  if (tier.includes("medium") || tier.includes("standard")) {
    return 1;
  }

  return 1;
}

function formatLatestScanCsv(items: LatestScanItem[]) {
  const headers = [
    "Symbol",
    "Rank",
    "Signal",
    "Action",
    "Setup Type",
    "Quality",
    "Price",
    "Candle Time",
  ];
  const rows = items.map((item) => [
    item.symbol,
    formatScore(item.rankScore),
    formatSignalLabel(item.signalLabel),
    getLatestScanActionDisplay(item),
    formatStructure(item.primaryStructure),
    formatQualityTier(item.qualityTier),
    formatPrice(item.priceAtSignal),
    formatDateTime(item.candleOpenTime),
  ]);

  return [headers, ...rows]
    .map((row) => row.map(formatCsvCell).join(","))
    .join("\n");
}

function formatCsvCell(value: string) {
  return `"${value.replaceAll("\"", "\"\"")}"`;
}

async function fetchLatestScan({
  timeframe,
  assetClass,
  limit,
  includeLowQuality,
  signal,
}: {
  timeframe: LatestScanTimeframe;
  assetClass: LatestScanAssetClass;
  limit: LatestScanLimit;
  includeLowQuality: boolean;
  signal?: AbortSignal;
}) {
  const response = await fetch(
    buildLatestScanUrl({
      timeframe,
      assetClass,
      limit,
      includeLowQuality,
    }),
    { signal },
  );

  if (!response.ok) {
    throw new Error(
      await getLatestScanErrorMessage(response, "Failed to load latest scan results."),
    );
  }

  return (await response.json()) as LatestScanResponse;
}

export function buildLatestScanUrl({
  timeframe,
  assetClass,
  limit = 100,
  includeLowQuality = false,
  tradeApiBaseUrl = process.env.NEXT_PUBLIC_TRADE_API_BASE_URL,
}: BuildLatestScanUrlParams) {
  const params = new URLSearchParams({
    timeframe,
    assetClass,
    limit: String(limit),
  });

  if (includeLowQuality) {
    params.set("includeLowQuality", "true");
  }

  return `${getTradeApiBaseUrl(tradeApiBaseUrl)}/api/scan/latest?${params.toString()}`;
}

export function buildSymbolResearchPath({
  exchange,
  symbol,
  timeframe,
}: {
  exchange: string | null | undefined;
  symbol: string;
  timeframe: string;
}) {
  return buildSymbolResearchHref({ exchange, symbol, timeframe });
}

export function buildSymbolResearchHref({
  exchange,
  symbol,
  timeframe,
  assetClass,
  includeLowQuality,
  limit,
  from,
}: BuildSymbolResearchHrefParams) {
  const normalizedExchange = normalizeExchangePathSegment(exchange);
  const normalizedSymbol = symbol.trim().toUpperCase();
  const params = new URLSearchParams({
    timeframe: timeframe?.trim() || "4h",
  });
  const normalizedAssetClass = assetClass?.trim();
  const normalizedLimit = normalizePositiveInteger(limit);
  const normalizedFrom = from?.trim();

  if (normalizedAssetClass) {
    params.set("assetClass", normalizedAssetClass);
  }

  if (includeLowQuality === true || includeLowQuality === "true") {
    params.set("includeLowQuality", "true");
  }

  if (normalizedLimit !== null) {
    params.set("limit", String(normalizedLimit));
  }

  if (normalizedFrom) {
    params.set("from", normalizedFrom);
  }

  return `/symbol/${encodeURIComponent(normalizedExchange)}/${encodeURIComponent(
    normalizedSymbol,
  )}?${params.toString()}`;
}

export function buildLatestRunSummaryText({
  symbolsTotal,
  symbolsScanned,
  signalsCreated,
  symbolsSkipped,
  returnedItems,
  totalSignals,
  lowQualityExcluded,
}: LatestRunSummaryTextInput) {
  return [
    `Full universe size: ${formatInteger(symbolsTotal)}`,
    `Scanned: ${formatInteger(symbolsScanned)}`,
    `Signals created: ${formatInteger(signalsCreated)}`,
    `Skipped: ${formatInteger(symbolsSkipped)}`,
    `Filtered signals shown: ${formatInteger(returnedItems)} of ${formatInteger(totalSignals)}`,
    `Low-quality excluded: ${formatInteger(lowQualityExcluded)}`,
  ].join(" · ");
}

export function buildLimitedViewWarning({
  count,
  returnedItems,
  totalSignals,
}: LatestLimitedViewWarningInput) {
  const normalizedCount = typeof count === "number" ? count : 0;
  const normalizedReturnedItems =
    typeof returnedItems === "number" ? returnedItems : normalizedCount;
  const normalizedTotalSignals =
    typeof totalSignals === "number" ? totalSignals : 0;

  if (
    normalizedTotalSignals <= 0 ||
    (normalizedTotalSignals <= normalizedReturnedItems &&
      normalizedTotalSignals <= normalizedCount)
  ) {
    return null;
  }

  return `Limited view: showing the first ${formatInteger(
    normalizedReturnedItems,
  )} returned results from ${formatInteger(
    normalizedTotalSignals,
  )} filtered signals`;
}

export function shouldShowIncompleteCryptoUniverseWarning({
  assetClass,
  symbolsTotal,
}: {
  assetClass: string;
  symbolsTotal: number | null | undefined;
}) {
  const normalizedSymbolsTotal =
    typeof symbolsTotal === "number" ? symbolsTotal : 0;

  return (
    assetClass.toLowerCase() === "crypto" &&
    normalizedSymbolsTotal > 0 &&
    normalizedSymbolsTotal < 300
  );
}

export function getTradeApiBaseUrl(
  value = process.env.NEXT_PUBLIC_TRADE_API_BASE_URL,
) {
  return value?.trim().replace(/\/+$/, "") ?? "";
}

function getLatestScanInitialFilters(searchParams: LatestScanQueryStateInput) {
  return {
    timeframe: normalizeLatestScanTimeframe(
      getLatestScanQueryStateValue(searchParams, "timeframe"),
    ),
    assetClass: normalizeLatestScanAssetClass(
      getLatestScanQueryStateValue(searchParams, "assetClass"),
    ),
    limit: normalizeLatestScanLimit(getLatestScanQueryStateValue(searchParams, "limit")),
    includeLowQuality:
      getLatestScanQueryStateValue(searchParams, "includeLowQuality") === "true",
  };
}

function getLatestScanQueryStateValue(input: LatestScanQueryStateInput, key: string) {
  if (!input) {
    return null;
  }

  if ("get" in input && typeof input.get === "function") {
    return input.get(key);
  }

  const record = input as Record<
    string,
    string | string[] | number | boolean | null | undefined
  >;
  const value = record[key];

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value === null || value === undefined ? null : String(value);
}

function normalizeLatestScanTimeframe(value: string | null): LatestScanTimeframe {
  return timeframeOptions.includes(value as LatestScanTimeframe)
    ? (value as LatestScanTimeframe)
    : "4h";
}

function normalizeLatestScanAssetClass(value: string | null): LatestScanAssetClass {
  return assetClassOptions.includes(value as LatestScanAssetClass)
    ? (value as LatestScanAssetClass)
    : "crypto";
}

function normalizeLatestScanLimit(value: string | null): LatestScanLimit {
  const number = Number(value);

  return limitOptions.includes(number as LatestScanLimit)
    ? (number as LatestScanLimit)
    : 100;
}

function normalizeExchangePathSegment(value: string | null | undefined) {
  return value?.trim().toLowerCase() || "binance";
}

function normalizePositiveInteger(value: number | string | null | undefined) {
  const number = typeof value === "string" ? Number(value.trim()) : Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    return null;
  }

  return number;
}

async function getLatestScanErrorMessage(response: Response, fallback: string) {
  const errorBody = (await response.json().catch(() => null)) as
    | { error?: string | { message?: string }; message?: string }
    | null;

  if (typeof errorBody?.error === "string") {
    return errorBody.error;
  }

  return errorBody?.error?.message ?? errorBody?.message ?? fallback;
}

function formatStructure(value: string | null | undefined) {
  return value ? toTitleCase(value) : "Unknown";
}

function formatInteger(value: number | null | undefined) {
  return value === null || value === undefined
    ? "0"
    : new Intl.NumberFormat().format(value);
}

function formatUnknownList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(formatUnknownValue).filter(Boolean);
  }

  if (typeof value === "string") {
    return value ? [value] : [];
  }

  return [];
}

function formatUnknownValue(value: unknown) {
  if (typeof value === "string") {
    return toTitleCase(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return "";
}

function normalizeFactors(factors: Record<string, unknown> | undefined) {
  const rows: string[] = [];

  for (const key of ["bullish", "bearish", "risk", "neutral"]) {
    const values = formatUnknownList(factors?.[key]);

    if (values.length > 0) {
      rows.push(`${toTitleCase(key)}: ${values.slice(0, 3).join(", ")}`);
    }
  }

  return rows;
}

function pickRawMetrics(metrics: Record<string, unknown> | undefined) {
  if (!metrics) {
    return [];
  }

  const keys = [
    "rsi",
    "bbPercent",
    "volumeRatio",
    "macdState",
    "closeAboveMA20",
    "closeAboveMA50",
    "closeAboveMA200",
  ];

  return keys
    .filter((key) => metrics[key] !== null && metrics[key] !== undefined)
    .map((key) => `${toTitleCase(key)}: ${String(metrics[key])}`);
}

const controlClass =
  "terminal-control h-7";

function getLatestScanRunStatusLabel({
  run,
  isLoading,
  isError,
}: {
  run: LatestScanRun | null;
  isLoading: boolean;
  isError: boolean;
}) {
  if (isError) {
    return "API unavailable";
  }

  if (isLoading) {
    return "Loading";
  }

  return run?.status ? run.status.toUpperCase() : "No run";
}

function getLatestScanRunStatusTone({
  run,
  isLoading,
  isError,
}: {
  run: LatestScanRun | null;
  isLoading: boolean;
  isError: boolean;
}): LatestScanTerminalTone {
  if (isError) {
    return "risk";
  }

  if (isLoading) {
    return "warning";
  }

  if (!run) {
    return "missing";
  }

  return run.status.toLowerCase() === "success" ? "complete" : "warning";
}

function getLatestScanGroupTone(group: LatestScanGroupKey): LatestScanGroupTone {
  if (group === "insufficient_history") {
    return "missing";
  }

  return group;
}

function getLatestScanTerminalToneBorderClass(tone: LatestScanTerminalTone) {
  const classes = {
    accent: "border-l-[var(--accent)]",
    complete: "border-l-[var(--complete)]",
    missing: "border-l-[var(--missing)]",
    neutral: "border-l-[var(--neutral-border)]",
    risk: "border-l-[var(--risk)]",
    watch: "border-l-[var(--watch)]",
    overheated: "border-l-[var(--overheated)]",
    eligible: "border-l-[var(--eligible)]",
    warning: "border-l-[var(--warning)]",
  } satisfies Record<LatestScanTerminalTone, string>;

  return classes[tone];
}

function getLatestScanTerminalToneTextClass(tone: LatestScanTerminalTone) {
  const classes = {
    accent: "text-[var(--accent)]",
    complete: "text-[var(--complete)]",
    missing: "text-[var(--missing)]",
    neutral: "text-[var(--terminal-bar-foreground)]",
    risk: "text-[var(--risk)]",
    watch: "text-[var(--watch)]",
    overheated: "text-[var(--overheated)]",
    eligible: "text-[var(--eligible)]",
    warning: "text-[var(--warning)]",
  } satisfies Record<LatestScanTerminalTone, string>;

  return classes[tone];
}

function formatCompactDateTime(value: string | null | undefined) {
  return formatDisplayDateTime(value, { fallback: "Not loaded" });
}
