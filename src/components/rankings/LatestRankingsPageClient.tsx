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
  FilterBar,
  PageShell,
  RefreshIconButton,
  StatCell,
  StatStrip,
  StatusBadge,
  type StatusTone,
} from "@/components/ui/workspace";
import { formatDisplayDateTime } from "@/lib/utils/format";
import {
  firstFiniteResearchMetric,
  formatResearchMetricLabel,
} from "@/lib/research-state/formatResearchState";
import { useAppLanguage } from "@/lib/i18n/AppLanguageProvider";
import type { Language } from "@/lib/i18n/dictionaries";
import { buildSymbolResearchHref } from "@/lib/navigation/researchNavigation";
import { getVegaRankApiBaseUrl } from "@/lib/runtime/vegaRankApi";
import { explainCode, explainCodes } from "@/lib/vegarank-codebook/explainCode";
import { groupCodeByResultGroup } from "@/lib/vegarank-codebook/codeRegistry";
import type { PublicStoredScannerSignal } from "@/lib/vegarank-codebook/serializeStoredSignal";
import {
  formatDateTime,
  formatPrice,
  formatScore,
  getLatestRankingsGroupCount,
  getLatestRankingsScoreRows,
  latestRankingsGroupOrder,
  normalizeGroupKey,
  type LatestRankingsGroupKey,
  type ScannerDisplayDictionary,
} from "./latestRankingsUi";

export { buildSymbolResearchHref };

export type LatestRankingsAssetClass =
  | "crypto"
  | "stable"
  | "fiat"
  | "gold"
  | "special"
  | "all";
export type LatestRankingsTimeframe = "4h" | "1h" | "1d" | "1w";
export type LatestRankingsLimit = 100 | 200 | 300 | 500;

export type LatestRankingsRun = {
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

export type LatestRankingsSummary = {
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
  visibleByGroup?: Partial<Record<LatestRankingsGroupKey, number>>;
  totalByGroup?: Partial<Record<LatestRankingsGroupKey, number>>;
  limitedGroups?: LatestRankingsGroupKey[];
  allocationStrategy?: string;
};

export type LatestRankingItem = {
  id: string;
  scanRunId: string;
  exchange?: string | null;
  market?: string | null;
  symbol: string;
  timeframe: string;
  assetClass?: string | null;
  scanTime?: string | null;
  groupCode: string;
  actionCode: string;
  riskCode: string | null;
  riskCodes: string[];
  setupCode: string;
  phaseCode: string;
  reasonCodes: string[];
  signalCodes: string[];
  qualityCodes: string[];
  metrics: PublicStoredScannerSignal["metrics"];
  scannerVersion: string;
  codeSchemaVersion: string;
  dictionaryVersion: string;
  candleOpenTime: string | null;
};

type LatestRankingsRowItem = LatestRankingItem & {
  resultGroup: LatestRankingsGroupKey;
};

export type LatestRankingsGroups = Partial<
  Record<LatestRankingsGroupKey | "insufficientHistory", LatestRankingItem[]>
>;

export type LatestRankingsResponse = {
  ok: boolean;
  run: LatestRankingsRun | null;
  summary: LatestRankingsSummary | null;
  groups: LatestRankingsGroups | null;
  items: LatestRankingItem[];
  count: number;
  timeframe: string;
  assetClass: string;
  includeLowQuality: boolean;
  includeNonScanner?: boolean;
  includeMarketContext?: boolean;
  error?: string | { code?: string; message?: string };
  message?: string;
};

type BuildLatestRankingsUrlParams = {
  timeframe: LatestRankingsTimeframe;
  assetClass: LatestRankingsAssetClass;
  limit?: LatestRankingsLimit;
  includeLowQuality?: boolean;
  tradeApiBaseUrl?: string;
};

type LatestRankingsQueryStateInput =
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

const assetClassOptions: LatestRankingsAssetClass[] = [
  "crypto",
  "stable",
  "fiat",
  "gold",
  "special",
  "all",
];
const timeframeOptions: LatestRankingsTimeframe[] = ["4h", "1h", "1d", "1w"];
const limitOptions: LatestRankingsLimit[] = [100, 200, 300, 500];
type LatestRankingsSortKey =
  | "symbol"
  | "rank"
  | "signal"
  | "action"
  | "setup"
  | "quality"
  | "price";
type LatestRankingsTableRow = {
  item: LatestRankingsRowItem;
  sourceIndex: number;
};
type LatestRankingsTerminalTone =
  | "accent"
  | "complete"
  | "missing"
  | "neutral"
  | "risk"
  | "watch"
  | "overheated"
  | "eligible"
  | "warning";
type LatestRankingsGroupTone = Extract<StatusTone, ChipTone>;
const latestRankingsSortKeys = [
  "symbol",
  "rank",
  "signal",
  "action",
  "setup",
  "quality",
  "price",
] as const satisfies readonly LatestRankingsSortKey[];

export function LatestRankingsPageClient({
  initialQueryState,
  visualCheckData,
}: {
  initialQueryState?: LatestRankingsQueryStateInput;
  visualCheckData?: LatestRankingsResponse;
} = {}) {
  const { dictionary, language } = useAppLanguage();
  const isVisualCheck = Boolean(visualCheckData);
  const initialFilters = getLatestRankingsInitialFilters(initialQueryState);
  const [timeframe, setTimeframe] = useState<LatestRankingsTimeframe>(
    initialFilters.timeframe,
  );
  const [assetClass, setAssetClass] = useState<LatestRankingsAssetClass>(
    initialFilters.assetClass,
  );
  const [limit, setLimit] = useState<LatestRankingsLimit>(initialFilters.limit);
  const [includeLowQuality, setIncludeLowQuality] = useState(
    initialFilters.includeLowQuality,
  );
  const [tableSort, setTableSort] =
    useState<DataSortState<LatestRankingsSortKey> | null>(
      initialFilters.sortState,
    );
  const latestRankingsQuery = useQuery({
    queryKey: ["latest-rankings", timeframe, assetClass, limit, includeLowQuality],
    queryFn: ({ signal }) =>
      fetchLatestRankings({
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
  const data = visualCheckData ?? latestRankingsQuery.data ?? null;
  const tableRows = useMemo(() => buildLatestRankingsTableRows(data), [data]);
  const visibleRows = useMemo(
    () => sortDataRows(tableRows, tableSort, getLatestRankingsSortValue),
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
  const hasUnavailableData = !isVisualCheck && latestRankingsQuery.isError;
  const isLoading = !isVisualCheck && latestRankingsQuery.isLoading;
  const updateTableSort = (
    key: LatestRankingsSortKey,
    defaultDirection: DataSortDirection,
  ) => {
    setTableSort((current) =>
      getNextDataSortState({ current, key, defaultDirection }),
    );
  };
  const clearFilters = () => {
    setTimeframe("4h");
    setAssetClass("crypto");
    setLimit(100);
    setIncludeLowQuality(false);
    setTableSort({ key: "rank", direction: "desc" });
  };
  const downloadVisibleCsv = () => {
    if (visibleItems.length === 0 || typeof document === "undefined") {
      return;
    }

    const blob = new Blob([formatLatestRankingsCsv(visibleItems, language)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `vegarank-rankings-${getCsvDateStamp()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageShell className="rankings-terminal max-w-none overflow-x-hidden xl:h-full xl:min-h-0 xl:overflow-hidden">
      <LatestRankingsCommandBar
        timeframe={timeframe}
        assetClass={assetClass}
        run={data?.run ?? null}
        finishedAt={finishedAt}
        returnedItems={returnedItems}
        totalSignals={totalSignals}
        isLoading={isLoading}
        isError={hasUnavailableData}
        isRefreshing={!isVisualCheck && latestRankingsQuery.isFetching}
        canExport={visibleItems.length > 0}
        onRefresh={() => {
          if (!isVisualCheck) {
            void latestRankingsQuery.refetch();
          }
        }}
        onExportCsv={downloadVisibleCsv}
      />
      <p className="mb-1 text-[11px] leading-4 text-[var(--muted)]">
        Review the latest ranked research results across the current market
        universe. Rankings reflect technical structure, confirmation strength,
        evidence quality, and risk context.
      </p>

      <main className="min-h-0 min-w-0 flex-1 space-y-1.5 xl:flex xl:flex-col xl:overflow-hidden">
        <LatestRankingsSummaryPanel
          data={data}
          timeframe={timeframe}
          assetClass={assetClass}
          includeLowQuality={includeLowQuality}
          finishedAt={finishedAt}
          totalSignals={totalSignals}
          returnedItems={returnedItems}
          lowQualityExcluded={lowQualityExcluded}
        />

        <LatestRankingsControls
          timeframe={timeframe}
          assetClass={assetClass}
          limit={limit}
          includeLowQuality={includeLowQuality}
          onTimeframeChange={setTimeframe}
          onAssetClassChange={setAssetClass}
          onLimitChange={setLimit}
          onIncludeLowQualityChange={setIncludeLowQuality}
          onClear={clearFilters}
        />

        {hasUnavailableData ? (
          <StatePanel
            title="Unable to load rankings."
            message="Try refreshing the page or adjusting filters."
          />
        ) : isLoading ? (
          <StatePanel
            title="Loading rankings..."
            message="Loading the latest ranking results."
          />
        ) : !data?.run || returnedItems === 0 ? (
          <StatePanel
            title="No latest research snapshot available."
            message="No symbols match the current filters."
          />
        ) : (
          <LatestRankingsResultsTable
            rows={visibleRows}
            summary={data.summary}
            sortState={tableSort}
            onSortChange={updateTableSort}
            timeframe={timeframe}
            assetClass={assetClass}
            includeLowQuality={includeLowQuality}
            limit={limit}
            dictionary={dictionary}
            language={language}
          />
        )}
      </main>
    </PageShell>
  );
}

function LatestRankingsCommandBar({
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
  timeframe: LatestRankingsTimeframe;
  assetClass: LatestRankingsAssetClass;
  run: LatestRankingsRun | null;
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
  const statusLabel = getLatestRankingsRunStatusLabel({ run, isLoading, isError });
  const statusTone = getLatestRankingsRunStatusTone({ run, isLoading, isError });

  return (
    <header className="terminal-command-bar mb-1">
      <div className="terminal-command-row text-[var(--terminal-bar-muted)]">
        <div className="terminal-command-brand">
          <h1 className="terminal-command-title">Market Rankings</h1>
          <span className="shrink-0 font-mono text-[10px] text-[var(--terminal-bar-muted)]">
            latest rankings
          </span>
        </div>
        <div className="terminal-command-main">
          <LatestRankingsCommandStat
            label="Timeframe"
            value={timeframe.toUpperCase()}
            tone="accent"
          />
          <LatestRankingsCommandStat
            label="Asset Class"
            value={assetClass.toUpperCase()}
            tone="neutral"
          />
          <LatestRankingsCommandStat
            label="Status"
            value={statusLabel}
            tone={statusTone}
          />
          <LatestRankingsCommandStat
            label="Latest Snapshot"
            value={formatCompactDateTime(finishedAt)}
            tone={run ? "complete" : "missing"}
          />
          <LatestRankingsCommandStat
            label="Ranked Universe"
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
            Export Rankings
          </button>
          <RefreshIconButton
            onClick={onRefresh}
            disabled={isRefreshing}
            isRefreshing={isRefreshing}
            label="Refresh Rankings"
          />
        </div>
      </div>
    </header>
  );
}

function LatestRankingsCommandStat({
  label,
  value,
  tone = "neutral",
  title,
}: {
  label: string;
  value: string;
  tone?: LatestRankingsTerminalTone;
  title?: string;
}) {
  return (
    <div
      title={title ?? `${label}: ${value}`}
      className={`inline-flex h-6 max-w-[220px] shrink-0 items-center gap-1.5 overflow-hidden border border-l-2 border-white/10 bg-white/[0.04] px-1.5 ${getLatestRankingsTerminalToneBorderClass(tone)}`}
    >
      <span className="shrink-0 text-[9px] font-semibold uppercase text-[var(--terminal-bar-muted)]">
        {label}
      </span>
      <span
        className={`min-w-0 truncate font-mono text-[10px] font-semibold leading-4 ${getLatestRankingsTerminalToneTextClass(tone)}`}
      >
        {value}
      </span>
    </div>
  );
}

function LatestRankingsControls({
  timeframe,
  assetClass,
  limit,
  includeLowQuality,
  onTimeframeChange,
  onAssetClassChange,
  onLimitChange,
  onIncludeLowQualityChange,
  onClear,
}: {
  timeframe: LatestRankingsTimeframe;
  assetClass: LatestRankingsAssetClass;
  limit: LatestRankingsLimit;
  includeLowQuality: boolean;
  onTimeframeChange: (value: LatestRankingsTimeframe) => void;
  onAssetClassChange: (value: LatestRankingsAssetClass) => void;
  onLimitChange: (value: LatestRankingsLimit) => void;
  onIncludeLowQualityChange: (value: boolean) => void;
  onClear: () => void;
}) {
  const hasActiveFilters =
    timeframe !== "4h" ||
    assetClass !== "crypto" ||
    limit !== 100 ||
    includeLowQuality;

  return (
    <FilterBar
      label="Active Filters"
      actions={
        <button
          type="button"
          onClick={onClear}
          disabled={!hasActiveFilters}
          className="terminal-mini-action h-6 px-2 disabled:cursor-not-allowed disabled:opacity-55"
        >
          Clear Filters
        </button>
      }
    >
      <CompactSelect
        label="Timeframe"
        value={timeframe}
        onChange={(value) => onTimeframeChange(value as LatestRankingsTimeframe)}
        options={timeframeOptions}
      />
      <CompactSelect
        label="Asset Class"
        value={assetClass}
        onChange={(value) => onAssetClassChange(value as LatestRankingsAssetClass)}
        options={assetClassOptions}
      />
      <CompactSelect
        label="Rows"
        value={String(limit)}
        onChange={(value) => onLimitChange(Number(value) as LatestRankingsLimit)}
        options={limitOptions.map(String)}
      />
      <label className="flex h-7 items-center gap-1.5 border border-[var(--border-medium)] bg-[var(--control)] px-2 text-[10px] font-semibold uppercase text-[var(--muted)]">
        <input
          type="checkbox"
          checked={includeLowQuality}
          onChange={(event) => onIncludeLowQualityChange(event.target.checked)}
          className="h-3 w-3 shrink-0 accent-[var(--accent)]"
        />
        <span className="whitespace-nowrap text-[var(--foreground)]">
          Show Low Quality
        </span>
      </label>
    </FilterBar>
  );
}

function CompactSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex min-w-[116px] items-center gap-1.5">
      <span className="shrink-0 text-[10px] font-semibold uppercase text-[var(--muted)]">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${controlClass} min-w-[64px]`}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function LatestRankingsSummaryPanel({
  data,
  timeframe,
  assetClass,
  includeLowQuality,
  finishedAt,
  totalSignals,
  returnedItems,
  lowQualityExcluded,
}: {
  data: LatestRankingsResponse | null;
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
    <section className="space-y-1">
      <StatStrip
        label="Ranking Summary"
        actions={
          <>
            <StatusBadge tone={run ? "complete" : "missing"}>
              {run?.status ?? "No run"}
            </StatusBadge>
            <StatusBadge tone="accent">{timeframe.toUpperCase()}</StatusBadge>
            <StatusBadge tone="neutral">{assetClass.toUpperCase()}</StatusBadge>
            {!includeLowQuality ? (
              <StatusBadge tone="neutral">Low Quality Excluded</StatusBadge>
            ) : null}
            <StatusBadge tone={finishedAt ? "neutral" : "missing"}>
              Latest Snapshot {formatCompactDateTime(finishedAt)}
            </StatusBadge>
          </>
        }
      >
        <StatCell label="Universe" value={formatInteger(run?.symbolsTotal)} />
        <StatCell label="Reviewed" value={formatInteger(run?.symbolsScanned)} />
        <StatCell
          label="Results"
          value={formatInteger(run?.signalsCreated ?? totalSignals)}
          tone="complete"
        />
        <StatCell label="Skipped" value={formatInteger(run?.symbolsSkipped)} />
        <StatCell label="Low-quality" value={formatInteger(lowQualityExcluded)} />
        <StatCell
          label="Limited"
          value={`${formatInteger(returnedItems)}/${formatInteger(totalSignals)}`}
          tone={returnedItems < totalSignals ? "accent" : "neutral"}
        />
      </StatStrip>
      {showUniverseWarning ? (
        <p className="mt-1 inline-flex border border-[var(--warning-border)] bg-[var(--warning-bg)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--warning)]">
          Ranking universe incomplete: {formatInteger(run?.symbolsTotal)} crypto symbols.
        </p>
      ) : null}
    </section>
  );
}

function LatestRankingsGroupSummaryChips({
  summary,
  language,
}: {
  summary: LatestRankingsSummary;
  language: Language;
}) {
  const chips = latestRankingsGroupOrder.map((group) => ({
    group,
    label: explainCode(groupCodeByResultGroup[group], language).label,
    count: getLatestRankingsGroupCount(summary, group),
  }));

  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">
        Group Counts
      </span>
      {chips.map((chip) => (
        <StatusBadge key={chip.label} tone={getLatestRankingsGroupTone(chip.group)}>
          {chip.label} {formatInteger(chip.count)}
        </StatusBadge>
      ))}
    </div>
  );
}

function LatestRankingsResultsTable({
  rows,
  summary,
  sortState,
  onSortChange,
  timeframe,
  assetClass,
  includeLowQuality,
  limit,
  dictionary,
  language,
}: {
  rows: LatestRankingsTableRow[];
  summary: LatestRankingsSummary | null;
  sortState: DataSortState<LatestRankingsSortKey> | null;
  onSortChange: (
    key: LatestRankingsSortKey,
    defaultDirection: DataSortDirection,
  ) => void;
  timeframe: LatestRankingsTimeframe;
  assetClass: LatestRankingsAssetClass;
  includeLowQuality: boolean;
  limit: LatestRankingsLimit;
  dictionary: ScannerDisplayDictionary;
  language: Language;
}) {
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const sharedCandleTime = getSharedLatestRankingsCandleTime(rows);
  const tableColumnCount = 9;

  return (
    <section className="terminal-panel-data min-h-0 overflow-hidden xl:flex xl:flex-1 xl:flex-col">
      <div className="terminal-panel-header gap-2">
        <div className="min-w-0 flex-1">
          {summary ? (
            <LatestRankingsGroupSummaryChips
              summary={summary}
              language={language}
            />
          ) : null}
        </div>
        <div className="min-w-0 shrink-0">
          <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="terminal-panel-title">
              Ranking Results
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
          minWidth="min-w-[900px]"
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
                Research Group
              </DataTableHeaderCell>
              <DataTableHeaderCell
                sortKey="action"
                sortState={sortState}
                onSortChange={onSortChange}
                className="w-[150px]"
              >
                Research Priority
              </DataTableHeaderCell>
              <DataTableHeaderCell
                sortKey="setup"
                sortState={sortState}
                onSortChange={onSortChange}
                className="w-[138px]"
              >
                Setup
              </DataTableHeaderCell>
              <DataTableHeaderCell
                sortKey="quality"
                sortState={sortState}
                onSortChange={onSortChange}
                className="w-[92px]"
              >
                Evidence Quality
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
              <DataTableHeaderCell className="w-[154px]">
                Updated
              </DataTableHeaderCell>
              <DataTableHeaderCell className="w-[96px]">View Details</DataTableHeaderCell>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ item }) => {
              const isExpanded = expandedItemId === item.id;

              return (
                <Fragment key={item.id}>
                  <LatestRankingsRow
                    item={item}
                    isExpanded={isExpanded}
                    onToggleDetails={() =>
                      setExpandedItemId(isExpanded ? null : item.id)
                    }
                    timeframe={timeframe}
                    assetClass={assetClass}
                    includeLowQuality={includeLowQuality}
                    limit={limit}
                    sortState={sortState}
                    dictionary={dictionary}
                    language={language}
                  />
                  {isExpanded ? (
                    <LatestRankingsDetailsRow
                      item={item}
                      colSpan={tableColumnCount}
                      dictionary={dictionary}
                      language={language}
                    />
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

function LatestRankingsRow({
  item,
  isExpanded,
  onToggleDetails,
  timeframe,
  assetClass,
  includeLowQuality,
  limit,
  sortState,
  dictionary,
  language,
}: {
  item: LatestRankingsRowItem;
  isExpanded: boolean;
  onToggleDetails: () => void;
  timeframe: LatestRankingsTimeframe;
  assetClass: LatestRankingsAssetClass;
  includeLowQuality: boolean;
  limit: LatestRankingsLimit;
  sortState: DataSortState<LatestRankingsSortKey> | null;
  dictionary: ScannerDisplayDictionary;
  language: Language;
}) {
  const group = item.resultGroup;
  const groupTone = getLatestRankingsGroupTone(group);
  const groupText = explainCode(item.groupCode, language);
  const signalText = explainCode(item.signalCodes[0] ?? item.phaseCode, language);
  const actionText = explainCode(item.actionCode, language);
  const setupText = explainCode(item.setupCode, language);
  const qualityText = explainCode(getPrimaryLatestRankingsQualityCode(item), language);

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
            from: "rankings",
            sort: encodeLatestRankingsSortState(sortState),
          })}
        >
          {item.symbol}
        </Link>
      </DataTableCell>
      <DataTableCell align="right" className="font-mono tabular-nums text-[var(--foreground)]">
        {formatScore(item.metrics.rankScore)}
      </DataTableCell>
      <DataTableCell>
        <div
          className="flex min-w-0 items-center gap-1.5"
          title={`${groupText.label} · ${signalText.short}`}
        >
          <DataTableChip tone={groupTone} className="shrink-0">
            {groupText.label}
          </DataTableChip>
          <span className="min-w-0 truncate text-[10px] font-semibold text-[var(--muted)]">
            {signalText.label}
          </span>
        </div>
      </DataTableCell>
      <DataTableCell>
        <div
          className="flex min-w-0 items-center gap-1.5"
          title={`${actionText.label} · ${actionText.short}`}
        >
          <DataTableChip tone={groupTone} className="shrink-0">
            {actionText.label}
          </DataTableChip>
          <span className="min-w-0 truncate text-[10px] font-semibold text-[var(--muted)]">
            {actionText.short}
          </span>
        </div>
      </DataTableCell>
      <DataTableCell truncate title={setupText.short}>
        {setupText.label}
      </DataTableCell>
      <DataTableCell>
        <DataTableChip
          tone={getLatestRankingsQualityTone(item)}
          title={`${qualityText.label} · ${qualityText.short}`}
        >
          {qualityText.label}
        </DataTableChip>
      </DataTableCell>
      <DataTableCell align="right" className="font-mono tabular-nums text-[var(--foreground)]">
        {formatPrice(item.metrics.price)}
      </DataTableCell>
      <DataTableCell className="font-mono text-[var(--muted)]">
        {formatDateTime(item.candleOpenTime)}
      </DataTableCell>
      <DataTableCell>
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={onToggleDetails}
          className="terminal-mini-action is-accent h-6 px-2"
        >
          {isExpanded ? "Close" : "View Details"}
        </button>
      </DataTableCell>
    </tr>
  );
}

function LatestRankingsDetailsRow({
  item,
  colSpan,
  dictionary,
  language,
}: {
  item: LatestRankingsRowItem;
  colSpan: number;
  dictionary: ScannerDisplayDictionary;
  language: Language;
}) {
  return (
    <tr className="border-t border-[var(--border)] bg-[var(--panel-2)]">
      <td colSpan={colSpan} className="px-3 py-3">
        <LatestRankingsDetails item={item} dictionary={dictionary} language={language} />
      </td>
    </tr>
  );
}

function LatestRankingsDetails({
  item,
  dictionary,
  language,
}: {
  item: LatestRankingsRowItem;
  dictionary: ScannerDisplayDictionary;
  language: Language;
}) {
  const reasonLines = formatCodeExplanationLines(item.reasonCodes, language);
  const signalLabels = explainCodes(item.signalCodes, language).map(
    (entry) => entry.label,
  );
  const riskLabels = explainCodes(item.riskCodes, language).map(
    (entry) => entry.label,
  );
  const qualityLabels = explainCodes(item.qualityCodes, language).map(
    (entry) => entry.label,
  );
  const metricLines = formatLatestRankingsMetricLines(item.metrics);

  return (
    <div className="grid gap-3 text-[11px] leading-5 text-[var(--muted)] md:grid-cols-2 xl:grid-cols-3">
      <DetailBlock title="Research Reasons">
        <TextList values={reasonLines} />
      </DetailBlock>
      <DetailBlock title="Snapshot Context">
        <TextList
          values={[
            `Candles: ${formatInteger(item.metrics.historyBars)}`,
            `Updated: ${formatDateTime(item.candleOpenTime)}`,
          ]}
        />
      </DetailBlock>
      <DetailBlock title="Score Breakdown">
        <ScoreBreakdown item={item} />
      </DetailBlock>
      <DetailBlock title="Evidence Quality">
        <TokenList values={qualityLabels} empty="None" />
      </DetailBlock>
      <DetailBlock title="Research Codes">
        <TokenList values={signalLabels} empty="None" />
      </DetailBlock>
      <DetailBlock title="Risk Context">
        <TokenList values={riskLabels} empty="None" />
      </DetailBlock>
      <DetailBlock title="Quality Codes">
        <TokenList values={qualityLabels} empty="None" />
      </DetailBlock>
      <DetailBlock title="Versions">
        <TextList
          values={[
            `Engine: ${item.scannerVersion}`,
            `Code schema: ${item.codeSchemaVersion}`,
            `Dictionary: ${item.dictionaryVersion}`,
          ]}
        />
      </DetailBlock>
      <DetailBlock title="Selected Metrics">
        <TextList values={metricLines} />
      </DetailBlock>
    </div>
  );
}

function ScoreBreakdown({ item }: { item: LatestRankingsRowItem }) {
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
      {getLatestRankingsScoreRows(item.metrics).map((score) => (
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

function formatCodeExplanationLines(codes: string[], language: Language) {
  return explainCodes(codes, language).map(
    (entry) => `${entry.label}: ${entry.short}`,
  );
}

function formatLatestRankingsMetricLines(metrics: LatestRankingItem["metrics"]) {
  return [
    [formatResearchMetricLabel("rankScore"), formatScore(metrics.rankScore)],
    [
      formatResearchMetricLabel("riskAdjustedScore"),
      formatScore(
        firstFiniteResearchMetric(
          metrics.riskAdjustedScore,
          metrics.finalSignalScore,
        ),
      ),
    ],
    [
      formatResearchMetricLabel("setupQualityScore"),
      formatScore(
        firstFiniteResearchMetric(
          metrics.setupQualityScore,
          metrics.opportunityScore,
        ),
      ),
    ],
    [
      formatResearchMetricLabel("confidenceScore"),
      formatScore(
        firstFiniteResearchMetric(
          metrics.confidenceScore,
          metrics.confirmationScore,
        ),
      ),
    ],
    [formatResearchMetricLabel("trendScore"), formatScore(metrics.trendScore)],
    [formatResearchMetricLabel("momentumScore"), formatScore(metrics.momentumScore)],
    [formatResearchMetricLabel("structureScore"), formatScore(metrics.structureScore)],
    [formatResearchMetricLabel("volatilityScore"), formatScore(metrics.volatilityScore)],
    [formatResearchMetricLabel("volumeScore"), formatScore(metrics.volumeScore)],
    [
      formatResearchMetricLabel("riskPenalty"),
      formatScore(firstFiniteResearchMetric(metrics.riskPenalty, metrics.riskScore)),
    ],
    [formatResearchMetricLabel("qualityPenalty"), formatScore(metrics.qualityPenalty)],
    [
      formatResearchMetricLabel("universePercentile"),
      formatScore(metrics.universePercentile),
    ],
    ["RSI", formatScore(metrics.rsi14)],
    ["BB %", formatScore(metrics.bbPercent)],
    ["BB Width", formatScore(metrics.bbWidthPercentile)],
    ["Liquidity Ratio", formatScore(metrics.volumeRatio)],
  ].map(([label, value]) => `${label}: ${value}`);
}

function getCsvDateStamp(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function getSharedLatestRankingsCandleTime(rows: LatestRankingsTableRow[]) {
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

function buildLatestRankingsTableRows(data: LatestRankingsResponse | null) {
  const groups = data?.groups ?? {};
  const rows: LatestRankingsTableRow[] = [];
  const seen = new Set<string>();

  latestRankingsGroupOrder.forEach((group) => {
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
    item: withLatestRankingResultGroup(item),
    sourceIndex,
  }));
}

function getGroupItems(groups: LatestRankingsGroups, group: LatestRankingsGroupKey) {
  const items =
    group === "insufficient_history"
      ? groups.insufficient_history ?? groups.insufficientHistory ?? []
      : groups[group] ?? [];

  return items.map((item) => withLatestRankingResultGroup(item, group));
}

function withLatestRankingResultGroup(
  item: LatestRankingItem,
  group?: LatestRankingsGroupKey,
): LatestRankingsRowItem {
  return {
    ...item,
    resultGroup: group ?? getLatestRankingsGroupFromCode(item.groupCode),
  };
}

function getLatestRankingsGroupFromCode(
  code: string | null | undefined,
): LatestRankingsGroupKey {
  const entry = Object.entries(groupCodeByResultGroup).find(
    ([, groupCode]) => groupCode === code,
  );

  return normalizeGroupKey(entry?.[0]);
}

function getLatestRankingsSortValue(
  row: LatestRankingsTableRow,
  key: LatestRankingsSortKey,
): DataSortValue {
  const { item } = row;

  switch (key) {
    case "symbol":
      return item.symbol;
    case "rank":
      return item.metrics.rankScore;
    case "signal":
      return `${getLatestRankingsGroupSortRank(
        item.resultGroup,
      )}-${explainCode(item.signalCodes[0] ?? item.phaseCode).label}`;
    case "action":
      return explainCode(item.actionCode).label;
    case "setup":
      return explainCode(item.setupCode).label;
    case "quality":
      return `${getLatestRankingsQualitySortRank(item)}-${getPrimaryLatestRankingsQualityCode(item)}`;
    case "price":
      return item.metrics.price;
  }
}

function getLatestRankingsGroupSortRank(group: LatestRankingsGroupKey) {
  const index = latestRankingsGroupOrder.indexOf(group);

  return index === -1 ? latestRankingsGroupOrder.length : index;
}

function getLatestRankingsQualitySortRank(item: LatestRankingItem) {
  const qualityCodes = item.qualityCodes;

  if (
    qualityCodes.includes("QH_101") ||
    qualityCodes.includes("QH_201") ||
    qualityCodes.includes("QH_202")
  ) {
    return 2;
  }

  if (qualityCodes.includes("QH_601") || qualityCodes.includes("QH_501")) {
    return 0;
  }

  return 1;
}

function getLatestRankingsQualityTone(item: LatestRankingItem): ChipTone {
  return getLatestRankingsQualitySortRank(item) >= 2 ? "warning" : "neutral";
}

function getPrimaryLatestRankingsQualityCode(item: LatestRankingItem) {
  return item.qualityCodes[0] ?? "QH_001";
}

function formatLatestRankingsCsv(
  items: LatestRankingItem[],
  language: Language = "en",
) {
  const headers = [
    "Symbol",
    "Rank Score",
    "Group Code",
    "Research Codes",
    "Research Priority Code",
    "Setup Code",
    "Risk Codes",
    "Reason Codes",
    "Quality Codes",
    "Price",
    "Updated",
    "Ranking Engine Version",
    "Code Schema Version",
    "Dictionary Version",
  ];
  const rows = items.map((item) => [
    item.symbol,
    formatScore(item.metrics.rankScore),
    item.groupCode,
    item.signalCodes.join("|"),
    item.actionCode,
    item.setupCode,
    item.riskCodes.join("|"),
    item.reasonCodes.join("|"),
    item.qualityCodes.join("|"),
    formatPrice(item.metrics.price),
    formatDateTime(item.candleOpenTime),
    item.scannerVersion,
    item.codeSchemaVersion,
    item.dictionaryVersion,
  ]);

  return [headers, ...rows]
    .map((row) => row.map(formatCsvCell).join(","))
    .join("\n");
}

function formatCsvCell(value: string) {
  return `"${value.replaceAll("\"", "\"\"")}"`;
}

async function fetchLatestRankings({
  timeframe,
  assetClass,
  limit,
  includeLowQuality,
  signal,
}: {
  timeframe: LatestRankingsTimeframe;
  assetClass: LatestRankingsAssetClass;
  limit: LatestRankingsLimit;
  includeLowQuality: boolean;
  signal?: AbortSignal;
}) {
  const response = await fetch(
    buildLatestRankingsUrl({
      timeframe,
      assetClass,
      limit,
      includeLowQuality,
    }),
    { signal },
  );

  if (!response.ok) {
    throw new Error(
      await getLatestRankingsErrorMessage(response, "Failed to load latest ranking results."),
    );
  }

  return (await response.json()) as LatestRankingsResponse;
}

export function buildLatestRankingsUrl({
  timeframe,
  assetClass,
  limit = 100,
  includeLowQuality = false,
  tradeApiBaseUrl = process.env.NEXT_PUBLIC_TRADE_API_BASE_URL,
}: BuildLatestRankingsUrlParams) {
  const params = new URLSearchParams({
    timeframe,
    assetClass,
    limit: String(limit),
  });

  if (includeLowQuality) {
    params.set("includeLowQuality", "true");
  }

  return `${getVegaRankApiBaseUrl(tradeApiBaseUrl)}/api/rankings/latest?${params.toString()}`;
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
    `Reviewed: ${formatInteger(symbolsScanned)}`,
    `Snapshot rows created: ${formatInteger(signalsCreated)}`,
    `Skipped: ${formatInteger(symbolsSkipped)}`,
    `Filtered ranking rows shown: ${formatInteger(returnedItems)} of ${formatInteger(totalSignals)}`,
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
  )} returned ranking rows from ${formatInteger(
    normalizedTotalSignals,
  )} filtered rows`;
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

function getLatestRankingsInitialFilters(searchParams: LatestRankingsQueryStateInput) {
  return {
    timeframe: normalizeLatestRankingsTimeframe(
      getLatestRankingsQueryStateValue(searchParams, "timeframe"),
    ),
    assetClass: normalizeLatestRankingsAssetClass(
      getLatestRankingsQueryStateValue(searchParams, "assetClass"),
    ),
    limit: normalizeLatestRankingsLimit(getLatestRankingsQueryStateValue(searchParams, "limit")),
    includeLowQuality:
      getLatestRankingsQueryStateValue(searchParams, "includeLowQuality") === "true",
    sortState:
      parseLatestRankingsSortState(
        getLatestRankingsQueryStateValue(searchParams, "sort"),
      ) ?? { key: "rank" as const, direction: "desc" as const },
  };
}

function getLatestRankingsQueryStateValue(input: LatestRankingsQueryStateInput, key: string) {
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

function normalizeLatestRankingsTimeframe(value: string | null): LatestRankingsTimeframe {
  return timeframeOptions.includes(value as LatestRankingsTimeframe)
    ? (value as LatestRankingsTimeframe)
    : "4h";
}

function normalizeLatestRankingsAssetClass(value: string | null): LatestRankingsAssetClass {
  return assetClassOptions.includes(value as LatestRankingsAssetClass)
    ? (value as LatestRankingsAssetClass)
    : "crypto";
}

function normalizeLatestRankingsLimit(value: string | null): LatestRankingsLimit {
  const number = Number(value);

  return limitOptions.includes(number as LatestRankingsLimit)
    ? (number as LatestRankingsLimit)
    : 100;
}

function encodeLatestRankingsSortState(
  sortState: DataSortState<LatestRankingsSortKey> | null,
) {
  return sortState ? `${sortState.key}:${sortState.direction}` : null;
}

function parseLatestRankingsSortState(
  value: string | null,
): DataSortState<LatestRankingsSortKey> | null {
  const [key, direction] = value?.split(":").map((part) => part.trim()) ?? [];

  if (
    latestRankingsSortKeys.includes(key as LatestRankingsSortKey) &&
    (direction === "asc" || direction === "desc")
  ) {
    return { key: key as LatestRankingsSortKey, direction };
  }

  return null;
}


async function getLatestRankingsErrorMessage(response: Response, fallback: string) {
  const errorBody = (await response.json().catch(() => null)) as
    | { error?: string | { message?: string }; message?: string }
    | null;

  if (typeof errorBody?.error === "string") {
    return errorBody.error;
  }

  return errorBody?.error?.message ?? errorBody?.message ?? fallback;
}

function formatInteger(value: number | null | undefined) {
  return value === null || value === undefined
    ? "0"
    : new Intl.NumberFormat().format(value);
}

const controlClass =
  "terminal-control h-7";

function getLatestRankingsRunStatusLabel({
  run,
  isLoading,
  isError,
}: {
  run: LatestRankingsRun | null;
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

function getLatestRankingsRunStatusTone({
  run,
  isLoading,
  isError,
}: {
  run: LatestRankingsRun | null;
  isLoading: boolean;
  isError: boolean;
}): LatestRankingsTerminalTone {
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

function getLatestRankingsGroupTone(group: LatestRankingsGroupKey): LatestRankingsGroupTone {
  if (group === "insufficient_history") {
    return "missing";
  }

  return group;
}

function getLatestRankingsTerminalToneBorderClass(tone: LatestRankingsTerminalTone) {
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
  } satisfies Record<LatestRankingsTerminalTone, string>;

  return classes[tone];
}

function getLatestRankingsTerminalToneTextClass(tone: LatestRankingsTerminalTone) {
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
  } satisfies Record<LatestRankingsTerminalTone, string>;

  return classes[tone];
}

function formatCompactDateTime(value: string | null | undefined) {
  return formatDisplayDateTime(value, { fallback: "Not loaded" });
}
