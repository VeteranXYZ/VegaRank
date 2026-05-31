"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import {
  formatActionBias,
  formatDateTime,
  formatGroupHint,
  formatGroupLabel,
  formatPrice,
  formatQualityTier,
  formatScore,
  formatSignalLabel,
  latestScanGroupOrder,
  normalizeGroupKey,
  toTitleCase,
  type LatestScanGroupKey,
} from "./latestScanUi";

type LatestScanAssetClass = "crypto" | "stable" | "fiat" | "gold" | "special" | "all";
type LatestScanTimeframe = "4h" | "1h" | "1d" | "1w";
type LatestScanLimit = 50 | 100 | 200;

type LatestScanRun = {
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

type LatestScanSummary = {
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
};

type LatestScanItem = {
  id: string;
  scanRunId: string;
  symbol: string;
  timeframe: string;
  resultGroup?: string | null;
  rankScore: number | null;
  signalLabel: string | null;
  actionBias: string | null;
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

type LatestScanGroups = Partial<
  Record<LatestScanGroupKey | "insufficientHistory", LatestScanItem[]>
>;

type LatestScanResponse = {
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

const assetClassOptions: LatestScanAssetClass[] = [
  "crypto",
  "stable",
  "fiat",
  "gold",
  "special",
  "all",
];
const timeframeOptions: LatestScanTimeframe[] = ["4h", "1h", "1d", "1w"];
const limitOptions: LatestScanLimit[] = [50, 100, 200];

export function LatestScanPageClient() {
  const [timeframe, setTimeframe] = useState<LatestScanTimeframe>("4h");
  const [assetClass, setAssetClass] = useState<LatestScanAssetClass>("crypto");
  const [limit, setLimit] = useState<LatestScanLimit>(100);
  const [includeLowQuality, setIncludeLowQuality] = useState(false);
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
  });
  const data = latestScanQuery.data ?? null;
  const groupSections = useMemo(() => buildGroupSections(data), [data]);
  const finishedAt = data?.run?.finishedAt ?? data?.run?.startedAt ?? null;
  const totalSignals = data?.summary?.totalSignals ?? 0;
  const returnedItems = data?.summary?.returnedItems ?? data?.count ?? 0;
  const runSignalsCreated = data?.run?.signalsCreated ?? 0;
  const lowQualityExcluded = data?.summary?.lowQualityExcluded ?? 0;

  return (
    <section className="mx-auto flex min-h-[calc(100vh-1px)] max-w-[1800px] flex-col px-2 py-2">
      <header className="mb-2 border border-[var(--border)] bg-[#070b0f] px-3 py-2 shadow-[inset_3px_0_0_rgba(96,165,250,0.35)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-sm font-semibold text-[var(--foreground)]">
              Latest Scan Results
            </h1>
            <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">
              Research scanner view based on the latest successful scan run.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void latestScanQuery.refetch()}
            disabled={latestScanQuery.isFetching}
            className="h-7 border border-[var(--border)] px-2 text-[11px] font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {latestScanQuery.isFetching ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-2 xl:grid-cols-[260px_minmax(0,1fr)]">
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

        <main className="min-w-0 space-y-2">
          <LatestScanSummaryPanel
            data={data}
            timeframe={timeframe}
            assetClass={assetClass}
            includeLowQuality={includeLowQuality}
            finishedAt={finishedAt}
            totalSignals={totalSignals}
            returnedItems={returnedItems}
            runSignalsCreated={runSignalsCreated}
            lowQualityExcluded={lowQualityExcluded}
          />

          {latestScanQuery.isError ? (
            <StatePanel
              title="Failed to load latest scan results."
              message={
                latestScanQuery.error instanceof Error
                  ? latestScanQuery.error.message
                  : "Latest scan request failed."
              }
            />
          ) : latestScanQuery.isLoading ? (
            <StatePanel
              title="Loading latest scan..."
              message="Fetching the latest successful persisted scan run."
            />
          ) : !data?.run || returnedItems === 0 ? (
            <StatePanel
              title="No latest scan results found."
              message="No signals matched the current latest-scan filters."
            />
          ) : (
            <div className="space-y-2">
              {groupSections.map((section) => (
                <LatestScanGroupSection
                  key={section.group}
                  group={section.group}
                  items={section.items}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </section>
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
    <aside className="border border-[var(--border)] bg-[var(--panel)] p-2.5 xl:h-full xl:overflow-y-auto">
      <h2 className="mb-2 text-sm font-semibold leading-none">Latest Scan Filters</h2>
      <div className="space-y-3 text-xs text-[var(--muted)]">
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
            <p className="mt-1 text-[10px] leading-4 text-[var(--muted-2)]">
              Coverage varies by timeframe.
            </p>
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
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={includeLowQuality}
              onChange={(event) => onIncludeLowQualityChange(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
            />
            <span>
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--foreground)]">
                Include low-quality symbols
              </span>
              <span className="mt-1 block text-[10px] leading-4 text-[var(--muted-2)]">
                Default view excludes symbols flagged as low-quality, suspicious,
                special, very new, low-history, stable-like, fan token, or
                wrapped/staked assets.
              </span>
            </span>
          </label>
        </ControlSection>

        <ControlSection title="Interpretation">
          <GroupHintList />
          <p className="text-[10px] leading-4 text-[var(--muted-2)]">
            This is research output for manual review, not financial advice.
          </p>
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
  runSignalsCreated,
  lowQualityExcluded,
}: {
  data: LatestScanResponse | null;
  timeframe: string;
  assetClass: string;
  includeLowQuality: boolean;
  finishedAt: string | null;
  totalSignals: number;
  returnedItems: number;
  runSignalsCreated: number;
  lowQualityExcluded: number;
}) {
  const run = data?.run;

  return (
    <section className="border border-[var(--border)] bg-[var(--panel)] px-3 py-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Latest Successful Scan Run</h2>
          <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">
            Showing {formatInteger(returnedItems)} of {formatInteger(totalSignals)}{" "}
            filtered signals · {formatInteger(runSignalsCreated)} signals created in
            latest scan run · {formatInteger(lowQualityExcluded)} low-quality symbols
            excluded
          </p>
        </div>
        <div className="text-right text-[11px] text-[var(--muted)]">
          <div>{timeframe} · {assetClass}</div>
          <div>{includeLowQuality ? "Low-quality included" : "Low-quality excluded"}</div>
        </div>
      </div>

      <div className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <SummaryMetric label="Finished" value={formatDateTime(finishedAt)} />
        <SummaryMetric label="Universe" value={run?.universe ?? "Unknown"} />
        <SummaryMetric label="Symbols Total" value={formatInteger(run?.symbolsTotal)} />
        <SummaryMetric label="Scanned" value={formatInteger(run?.symbolsScanned)} />
        <SummaryMetric label="Signals Created" value={formatInteger(run?.signalsCreated)} />
        <SummaryMetric label="Skipped" value={formatInteger(run?.symbolsSkipped)} />
        <SummaryMetric label="Failed" value={formatInteger(run?.failedSymbols)} />
        <SummaryMetric label="Filtered Signals" value={formatInteger(totalSignals)} />
        <SummaryMetric label="Returned Items" value={formatInteger(returnedItems)} />
        <SummaryMetric label="Low Quality Excluded" value={formatInteger(lowQualityExcluded)} />
        <SummaryMetric label="Confirmed" value={formatInteger(data?.summary?.confirmed)} />
        <SummaryMetric label="Risk" value={formatInteger(data?.summary?.risk)} />
      </div>
    </section>
  );
}

function LatestScanGroupSection({
  group,
  items,
}: {
  group: LatestScanGroupKey;
  items: LatestScanItem[];
}) {
  if (items.length === 0 && group === "insufficient_history") {
    return null;
  }

  return (
    <section className="border border-[var(--border)] bg-[var(--panel)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
        <div>
          <h2 className="text-sm font-semibold">
            {formatGroupLabel(group)}{" "}
            <span className="text-[var(--muted)]">({formatInteger(items.length)})</span>
          </h2>
          <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">
            {formatGroupHint(group)}
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="px-3 py-4 text-sm text-[var(--muted)]">
          No results in this group.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] table-fixed border-collapse text-left text-xs">
            <thead className="bg-[#090f15] text-[10px] uppercase text-[var(--muted)]">
              <tr>
                <th className="w-[88px] px-2 py-1.5">Symbol</th>
                <th className="w-[64px] px-2 py-1.5">Rank</th>
                <th className="w-[92px] px-2 py-1.5">Signal</th>
                <th className="w-[96px] px-2 py-1.5">Action</th>
                <th className="w-[120px] px-2 py-1.5">Structure</th>
                <th className="w-[118px] px-2 py-1.5">Quality</th>
                <th className="w-[150px] px-2 py-1.5">Flags</th>
                <th className="w-[76px] px-2 py-1.5">Candles</th>
                <th className="w-[96px] px-2 py-1.5">Price</th>
                <th className="w-[148px] px-2 py-1.5">Candle</th>
                <th className="w-[190px] px-2 py-1.5">Scores</th>
                <th className="w-[76px] px-2 py-1.5">Details</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <LatestScanRow key={item.id} item={item} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function LatestScanRow({ item }: { item: LatestScanItem }) {
  return (
    <tr className="border-t border-[var(--border)] align-top hover:bg-[#101923]/75">
      <td className="px-2 py-1.5 font-semibold text-[var(--foreground)]">
        {item.symbol}
      </td>
      <td className="px-2 py-1.5 font-mono tabular-nums">
        {formatScore(item.rankScore)}
      </td>
      <td className="px-2 py-1.5">{formatSignalLabel(item.signalLabel)}</td>
      <td className="px-2 py-1.5">{formatActionBias(item.actionBias)}</td>
      <td className="px-2 py-1.5">{formatStructure(item.primaryStructure)}</td>
      <td className="px-2 py-1.5">{formatQualityTier(item.qualityTier)}</td>
      <td className="px-2 py-1.5">
        <TokenList values={item.qualityFlags.map(formatQualityTier)} empty="-" />
      </td>
      <td className="px-2 py-1.5 font-mono tabular-nums">
        {formatInteger(item.candleCount)}
      </td>
      <td className="px-2 py-1.5 font-mono tabular-nums">
        {formatPrice(item.priceAtSignal)}
      </td>
      <td className="px-2 py-1.5 text-[11px] text-[var(--muted)]">
        {formatDateTime(item.candleOpenTime)}
      </td>
      <td className="px-2 py-1.5">
        <ScoreStrip item={item} />
      </td>
      <td className="px-2 py-1.5">
        <details className="group">
          <summary className="cursor-pointer list-none text-[var(--info)]">
            Details
          </summary>
          <LatestScanDetails item={item} />
        </details>
      </td>
    </tr>
  );
}

function LatestScanDetails({ item }: { item: LatestScanItem }) {
  const factors = normalizeFactors(item.factors);
  const rawMetrics = pickRawMetrics(item.rawMetrics);

  return (
    <div className="mt-2 w-[300px] space-y-2 rounded-none border border-[var(--border)] bg-[#080d12] p-2 text-[11px] leading-5 text-[var(--muted)]">
      <DetailBlock title="Secondary Structures">
        <TokenList values={formatUnknownList(item.secondaryStructures)} empty="None" />
      </DetailBlock>
      <DetailBlock title="Detected Risks">
        <TokenList values={formatUnknownList(item.detectedRiskTypes)} empty="None" />
      </DetailBlock>
      <DetailBlock title="Next Confirmation">
        <TextList values={formatUnknownList(item.nextConfirmation)} />
      </DetailBlock>
      <DetailBlock title="Invalidation">
        <TextList values={formatUnknownList(item.invalidation)} />
      </DetailBlock>
      {factors.length > 0 && (
        <DetailBlock title="Factors">
          <TextList values={factors} />
        </DetailBlock>
      )}
      {rawMetrics.length > 0 && (
        <DetailBlock title="Selected Metrics">
          <TextList values={rawMetrics} />
        </DetailBlock>
      )}
    </div>
  );
}

function ScoreStrip({ item }: { item: LatestScanItem }) {
  const scores = [
    ["O", item.opportunityScore],
    ["C", item.confirmationScore],
    ["R", item.riskScore],
    ["T", item.trendScore],
    ["M", item.momentumScore],
    ["V", item.volumeScore],
    ["S", item.structureScore],
  ] as const;

  return (
    <div className="flex flex-wrap gap-x-1.5 gap-y-0.5 font-mono text-[10px] tabular-nums">
      {scores.map(([label, value]) => (
        <span key={label}>
          <span className="text-[var(--muted)]">{label}</span> {formatScore(value, 0)}
        </span>
      ))}
    </div>
  );
}

function GroupHintList() {
  return (
    <dl className="space-y-1 text-[10px] leading-4">
      {latestScanGroupOrder.map((group) => (
        <div key={group}>
          <dt className="inline font-semibold text-[var(--foreground)]">
            {formatGroupLabel(group)}:
          </dt>{" "}
          <dd className="inline text-[var(--muted-2)]">{formatGroupHint(group)}</dd>
        </div>
      ))}
    </dl>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[var(--border)] bg-[#0b0f14]/60 px-2 py-1">
      <div className="truncate text-[10px] text-[var(--muted)]">{label}</div>
      <div className="mt-0.5 truncate text-xs font-semibold tabular-nums">
        {value}
      </div>
    </div>
  );
}

function StatePanel({ title, message }: { title: string; message: string }) {
  return (
    <section className="flex min-h-80 flex-col items-center justify-center border border-[var(--border)] bg-[var(--panel)] px-6 py-10 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
        {message}
      </p>
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
    <section className="space-y-1.5 border-t border-[var(--border)] pt-2 first:border-t-0 first:pt-0">
      <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-2)]">
        {title}
      </h3>
      {children}
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
          className="border border-[var(--border)] bg-[#0b0f14] px-1 py-0.5 text-[10px]"
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

function buildGroupSections(data: LatestScanResponse | null) {
  const groups = data?.groups ?? {};

  return latestScanGroupOrder
    .map((group) => ({
      group,
      items: getGroupItems(groups, group),
    }))
    .filter((section) => section.items.length > 0 || section.group !== "insufficient_history");
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

export function getTradeApiBaseUrl(
  value = process.env.NEXT_PUBLIC_TRADE_API_BASE_URL,
) {
  return value?.trim().replace(/\/+$/, "") ?? "";
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
  "h-7 w-full border border-[var(--border)] bg-[#0b0f14] px-2 text-xs text-[var(--foreground)]";
