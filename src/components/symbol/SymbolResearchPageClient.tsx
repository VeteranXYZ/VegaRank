"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useMemo, type ReactNode } from "react";
import { SymbolResearchChart } from "./SymbolResearchChart";
import { SymbolSignalTimeline } from "./SymbolSignalTimeline";
import {
  formatSymbolResearchAction,
  formatSymbolResearchDateTime,
  formatSymbolResearchGroup,
  formatSymbolResearchList,
  formatSymbolResearchPrice,
  formatSymbolResearchRunContext,
  formatSymbolResearchScore,
  formatSymbolResearchSetup,
  getSymbolResearchTimeframeSnapshots,
  getTimeframeSnapshotNote,
  getTimeframeSnapshotTitle,
  getSymbolResearchCandleSummary,
  getSymbolResearchScoreRows,
  hasNewerSymbolResearchHistoryRows,
  toTitleCase,
} from "./symbolResearchUi";

type BuildSymbolResearchUrlParams = {
  exchange: string;
  market?: string;
  symbol: string;
  timeframe?: string;
  historyLimit?: number;
  candleLimit?: number;
  includeCandles?: boolean;
  assetClass?: string;
  tradeApiBaseUrl?: string;
};

type SymbolResearchPageClientProps = {
  exchange: string;
  symbol: string;
};

type SymbolResearchRun = {
  id: string;
  status: string;
  timeframe: string;
  symbolsTotal: number;
  symbolsScanned: number;
  signalsCreated: number;
  finishedAt: string | null;
};

type SymbolResearchSignal = {
  id: string;
  scanRunId?: string;
  symbolId?: number;
  exchange?: string;
  market?: string;
  symbol: string;
  timeframe: string;
  scanTime: string;
  candleOpenTime: string | null;
  priceAtSignal: number | null;
  rankScore: number | null;
  finalSignalScore: number | null;
  opportunityScore?: number | null;
  confirmationScore?: number | null;
  riskScore?: number | null;
  trendScore?: number | null;
  momentumScore?: number | null;
  volumeScore?: number | null;
  structureScore?: number | null;
  signalLabel: string | null;
  actionBias: string | null;
  resultGroup?: string | null;
  reviewTier?: string | null;
  statusNote?: string | null;
  cautionLevel?: string | null;
  statusReasons?: string[];
  primaryStructure: string | null;
  secondaryStructures?: unknown[];
  detectedRiskTypes?: unknown[];
  nextConfirmation?: unknown;
  invalidation?: unknown;
  factors?: Record<string, unknown>;
  rawMetrics?: Record<string, unknown>;
  scoringVersion?: string | null;
  scannerVersion?: string | null;
  createdAt?: string;
  scanRunStartedAt?: string | null;
  scanRunFinishedAt?: string | null;
  sourceRunIsLikelyFullUniverse?: boolean | null;
  isSelectedCurrentRun?: boolean;
  isNewerThanSelectedCurrentRun?: boolean;
};

type SymbolResearchCurrentSelection = {
  selectedRunId: string | null;
  selectedSignalId: string | null;
  selectedTimeframe: string | null;
  selectedRunStartedAt: string | null;
  selectedRunFinishedAt: string | null;
  selectedSignalScanTime: string | null;
  preferredFullUniverse: boolean;
  isLikelyFullUniverse: boolean;
  minExpectedSymbols: number;
  fallbackUsed: boolean;
};

type SymbolResearchCandle = {
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume: number | null;
};

type SymbolResearchResponse = {
  ok: true;
  timeframe?: string;
  symbol: {
    exchange: string;
    market: string;
    symbol: string;
    assetClass: string;
    qualityTier: string;
    isLowQuality: boolean;
    qualityFlags: string[];
  };
  latest: {
    scanRun: SymbolResearchRun | null;
    signal: SymbolResearchSignal;
  };
  currentSelection?: SymbolResearchCurrentSelection;
  scoreBreakdown: {
    rankScore: number | null;
    finalSignalScore: number | null;
    opportunityScore: number | null;
    confirmationScore: number | null;
    riskScore: number | null;
    trendScore: number | null;
    momentumScore: number | null;
    volumeScore: number | null;
    structureScore: number | null;
  };
  interpretation: {
    group: string;
    label: string;
    action: string;
    setupType: string;
    statusNote: string;
    reasons: string[];
    nextConfirmation: unknown;
    invalidation: unknown;
  };
  history: SymbolResearchSignal[];
  timeframes: SymbolResearchSignal[];
  candles: {
    timeframe: string;
    count: number;
    firstOpenTime: string | null;
    lastOpenTime: string | null;
    rows: SymbolResearchCandle[];
  };
};

const defaultHistoryLimit = 30;
const defaultCandleLimit = 120;
const defaultTimeframe = "4h";

export function SymbolResearchPageClient({
  exchange,
  symbol,
}: SymbolResearchPageClientProps) {
  const searchParams = useSearchParams();
  const market = searchParams.get("market")?.trim() || "spot";
  const timeframe = searchParams.get("timeframe")?.trim() || defaultTimeframe;
  const normalizedSymbol = symbol.toUpperCase();
  const queryParams = useMemo(
    () => ({
      exchange,
      market,
      symbol: normalizedSymbol,
      timeframe,
      historyLimit: defaultHistoryLimit,
      candleLimit: defaultCandleLimit,
    }),
    [exchange, market, normalizedSymbol, timeframe],
  );
  const query = useQuery({
    queryKey: ["symbol-research", queryParams],
    queryFn: ({ signal }) => fetchSymbolResearch({ ...queryParams, signal }),
    staleTime: 60_000,
  });

  if (query.isLoading) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-6 text-[var(--foreground)]">
        <ResearchState title={normalizedSymbol} message="Loading research view..." />
      </main>
    );
  }

  if (query.isError) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-6 text-[var(--foreground)]">
        <ResearchState
          title={normalizedSymbol}
          message={query.error.message || "Unable to load symbol research."}
        />
      </main>
    );
  }

  const data = query.data;

  if (!data) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-6 text-[var(--foreground)]">
        <ResearchState title={normalizedSymbol} message="No research data available." />
      </main>
    );
  }

  const latestSignal = data.latest.signal;
  const candleSummary = getSymbolResearchCandleSummary(data.candles);
  const riskTypes = formatSymbolResearchList(latestSignal.detectedRiskTypes);
  const secondaryStructures = formatSymbolResearchList(
    latestSignal.secondaryStructures,
  );
  const timeframeSnapshots = getSymbolResearchTimeframeSnapshots({
    timeframes: data.timeframes,
    latestSignal,
    requestedTimeframe: data.timeframe ?? timeframe,
  });
  const timeframeSnapshotTitle = getTimeframeSnapshotTitle(timeframeSnapshots.length);
  const timeframeSnapshotNote = getTimeframeSnapshotNote(timeframeSnapshots);
  const showHistorySelectionNotice = hasNewerSymbolResearchHistoryRows([
    ...data.history,
    ...data.timeframes,
  ]);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 text-[var(--foreground)]">
      <header className="mb-4 border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
              Symbol Research
            </p>
            <h1 className="mt-1 text-2xl font-semibold">{data.symbol.symbol}</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {data.symbol.exchange} · {data.symbol.market} · {timeframe} ·{" "}
              {toTitleCase(data.symbol.assetClass)}
            </p>
          </div>
          <div className="text-left text-sm text-[var(--muted)] md:text-right">
            <div>
              Quality:{" "}
              <span className="font-semibold text-[var(--foreground)]">
                {toTitleCase(data.symbol.qualityTier)}
              </span>
            </div>
            <div>
              Latest scan:{" "}
              <span className="text-[var(--foreground)]">
                {formatSymbolResearchDateTime(data.latest.scanRun?.finishedAt)}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <Panel title="Current Classification">
          <div className="grid gap-3 sm:grid-cols-2">
            <Fact label="Group" value={formatSymbolResearchGroup(data.interpretation.group)} />
            <Fact label="Signal" value={data.interpretation.label} />
            <Fact
              label="Action"
              value={formatSymbolResearchAction(data.interpretation.action)}
            />
            <Fact
              label="Setup Type"
              value={formatSymbolResearchSetup(data.interpretation.setupType)}
            />
            <Fact label="Status Note" value={data.interpretation.statusNote} />
            <Fact
              label="Price"
              value={formatSymbolResearchPrice(latestSignal.priceAtSignal)}
            />
          </div>
          <TextList title="Status Reasons" values={data.interpretation.reasons} />
        </Panel>

        <Panel title="Score Breakdown">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {getSymbolResearchScoreRows(data.scoreBreakdown).map((row) => (
              <div
                key={row.label}
                className="border border-[var(--border)] bg-[#080d12] px-3 py-2"
              >
                <div className="text-[11px] uppercase text-[var(--muted)]">
                  {row.label}
                </div>
                <div className="mt-1 font-mono text-sm tabular-nums">
                  {row.value}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <SymbolResearchChart
        symbol={data.symbol.symbol}
        timeframe={timeframe}
        candles={data.candles.rows}
        candleCount={data.candles.count}
        latestSignal={{
          candleOpenTime: latestSignal.candleOpenTime,
          resultGroup: latestSignal.resultGroup,
          statusNote: latestSignal.statusNote,
        }}
      />

      <SymbolSignalTimeline
        history={data.history}
        showSelectionNotice={showHistorySelectionNotice}
      />

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Panel title={timeframeSnapshotTitle}>
          {timeframeSnapshotNote ? (
            <p className="mb-3 text-xs text-[var(--muted)]">{timeframeSnapshotNote}</p>
          ) : null}
          <ResponsiveTable
            headers={["Timeframe", "Group", "Action", "Rank", "Scan Time", "Run Context"]}
            rows={timeframeSnapshots.map((item) => [
              item.timeframe,
              formatSymbolResearchGroup(item.resultGroup),
              formatSymbolResearchAction(item.actionBias ?? item.statusNote),
              formatSymbolResearchScore(item.rankScore),
              formatSymbolResearchDateTime(item.scanTime),
              formatSymbolResearchRunContext(item),
            ])}
            emptyText="No timeframe snapshots available."
          />
        </Panel>

        <Panel title="Recent Candles Summary">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Fact label="Candles" value={String(data.candles.count)} />
            <Fact
              label="First Open"
              value={formatSymbolResearchDateTime(data.candles.firstOpenTime)}
            />
            <Fact
              label="Last Open"
              value={formatSymbolResearchDateTime(data.candles.lastOpenTime)}
            />
            <Fact
              label="Latest Close"
              value={formatSymbolResearchPrice(candleSummary.latestClose)}
            />
            <Fact
              label="Recent High"
              value={formatSymbolResearchPrice(candleSummary.recentHigh)}
            />
            <Fact
              label="Recent Low"
              value={formatSymbolResearchPrice(candleSummary.recentLow)}
            />
          </div>
        </Panel>
      </div>

      <Panel title="Raw Details" className="mt-4">
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-[var(--info)]">
            Show selected details
          </summary>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <TextList title="Secondary Structures" values={secondaryStructures} />
            <TextList title="Detected Risks" values={riskTypes} />
            <JsonBlock title="Next Confirmation" value={latestSignal.nextConfirmation} />
            <JsonBlock title="Invalidation" value={latestSignal.invalidation} />
            <JsonBlock title="Factors" value={latestSignal.factors} />
            <JsonBlock title="Selected Metrics" value={latestSignal.rawMetrics} />
          </div>
        </details>
      </Panel>

      <footer className="mt-5 text-xs text-[var(--muted)]">
        Research output only. Not financial advice.
      </footer>
    </main>
  );
}

async function fetchSymbolResearch({
  signal,
  ...params
}: BuildSymbolResearchUrlParams & { signal?: AbortSignal }) {
  const response = await fetch(buildSymbolResearchUrl(params), { signal });

  if (!response.ok) {
    throw new Error(
      await getSymbolResearchErrorMessage(
        response,
        "Unable to load symbol research.",
      ),
    );
  }

  return (await response.json()) as SymbolResearchResponse;
}

export function buildSymbolResearchUrl({
  exchange,
  market = "spot",
  symbol,
  timeframe = defaultTimeframe,
  historyLimit = defaultHistoryLimit,
  candleLimit = defaultCandleLimit,
  includeCandles = true,
  assetClass = "crypto",
  tradeApiBaseUrl = process.env.NEXT_PUBLIC_TRADE_API_BASE_URL,
}: BuildSymbolResearchUrlParams) {
  const params = new URLSearchParams({
    exchange: exchange.toLowerCase(),
    market: market.toLowerCase(),
    symbol: symbol.toUpperCase(),
    timeframe,
    historyLimit: String(historyLimit),
    candleLimit: String(candleLimit),
    includeCandles: String(includeCandles),
    assetClass,
  });

  return `${getSymbolResearchApiBaseUrl(tradeApiBaseUrl)}/api/symbol/research?${params.toString()}`;
}

export function getSymbolResearchApiBaseUrl(
  value = process.env.NEXT_PUBLIC_TRADE_API_BASE_URL,
) {
  return value?.trim().replace(/\/+$/, "") ?? "";
}

function ResearchState({ title, message }: { title: string; message: string }) {
  return (
    <section className="border border-[var(--border)] bg-[var(--panel)] px-4 py-8">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">{message}</p>
    </section>
  );
}

function Panel({
  title,
  className = "",
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`border border-[var(--border)] bg-[var(--panel)] px-4 py-4 ${className}`}
    >
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase text-[var(--muted)]">{label}</div>
      <div className="mt-1 text-sm text-[var(--foreground)]">{value}</div>
    </div>
  );
}

function TextList({ title, values }: { title: string; values: string[] }) {
  return (
    <div className="mt-3">
      <h3 className="text-[11px] uppercase text-[var(--muted)]">{title}</h3>
      {values.length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm text-[var(--muted)]">
          {values.map((value) => (
            <li key={value}>{value}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-[var(--muted)]">None noted.</p>
      )}
    </div>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <div>
      <h3 className="text-[11px] uppercase text-[var(--muted)]">{title}</h3>
      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap border border-[var(--border)] bg-[#080d12] p-3 text-[11px] leading-5 text-[var(--muted)]">
        {JSON.stringify(value ?? null, null, 2)}
      </pre>
    </div>
  );
}

function ResponsiveTable({
  headers,
  rows,
  emptyText,
}: {
  headers: string[];
  rows: string[][];
  emptyText: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--muted)]">{emptyText}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left text-xs">
        <thead className="bg-[#090f15] text-[10px] uppercase text-[var(--muted)]">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-2 py-1.5">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row[0]}-${index}`} className="border-t border-[var(--border)]">
              {row.map((cell, cellIndex) => (
                <td key={`${headers[cellIndex]}-${cell}`} className="px-2 py-1.5">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function getSymbolResearchErrorMessage(response: Response, fallback: string) {
  const errorBody = (await response.json().catch(() => null)) as
    | { error?: string | { message?: string }; message?: string }
    | null;

  if (typeof errorBody?.error === "string") {
    return errorBody.error;
  }

  return errorBody?.error?.message ?? errorBody?.message ?? fallback;
}
