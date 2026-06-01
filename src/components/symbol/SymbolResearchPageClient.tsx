"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useMemo, type ReactNode } from "react";
import { SymbolResearchChart } from "./SymbolResearchChart";
import { SymbolSignalTimeline } from "./SymbolSignalTimeline";
import {
  normalizeSymbolResearchCandles,
  type SymbolResearchCandles,
} from "./symbolChartUi";
import {
  buildSymbolResearchDiagnostics,
  buildSymbolResearchSummary,
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
  tradeApiBaseUrl?: string | null;
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
  candles: SymbolResearchCandles;
};

type SymbolResearchApiErrorBody = {
  ok?: false;
  error?: string | { code?: string; message?: string };
  code?: string;
  message?: string;
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
  const tradeApiBaseUrl = getTradeApiBaseUrl();
  const apiOrigin = getSymbolResearchApiOriginLabel(tradeApiBaseUrl);
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
        <ResearchState
          title={normalizedSymbol}
          message="Loading research view..."
          apiOrigin={apiOrigin}
        />
      </main>
    );
  }

  if (query.isError) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-6 text-[var(--foreground)]">
        <ResearchState
          title={normalizedSymbol}
          message={query.error.message || "Unable to load symbol research."}
          apiOrigin={apiOrigin}
        />
      </main>
    );
  }

  const data = query.data;

  if (!data) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-6 text-[var(--foreground)]">
        <ResearchState
          title={normalizedSymbol}
          message="No research data available."
          apiOrigin={apiOrigin}
        />
      </main>
    );
  }

  const latestSignal = data.latest.signal;
  const candles = normalizeSymbolResearchCandles(data.candles);
  const candleSummary = getSymbolResearchCandleSummary(candles);
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
  const researchSummary = buildSymbolResearchSummary(latestSignal);
  const diagnostics = buildSymbolResearchDiagnostics({
    selectedTimeframe: data.timeframe ?? timeframe,
    currentSelection: data.currentSelection,
    latestSignal,
    history: data.history,
  });
  const candleRowsNotice = getCandleRowsNotice(candles);

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

      <Panel title="Research Summary" className="mt-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div>
            <div className="text-[11px] uppercase text-[var(--muted)]">
              Current Stance
            </div>
            <div className="mt-1 text-lg font-semibold text-[var(--foreground)]">
              {researchSummary.stance}
            </div>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {researchSummary.runBasis}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <SummaryList title="Why" values={researchSummary.why} />
            <SummaryList
              title="Next Confirmation"
              values={researchSummary.nextConfirmation}
            />
            <SummaryList
              title="Invalidation / Caution"
              values={researchSummary.invalidation}
            />
          </div>
        </div>
      </Panel>

      <Panel title="Data Source" className="mt-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {diagnostics.rows.map((row) => (
            <Fact key={row.label} label={row.label} value={row.value} />
          ))}
        </div>
        <p
          className={`mt-3 border px-3 py-2 text-xs ${
            diagnostics.hasWarning
              ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
              : "border-[var(--border)] bg-[#080d12] text-[var(--muted)]"
          }`}
        >
          {diagnostics.notice}
        </p>
        <p className="mt-2 text-xs text-[var(--muted)]">API origin: {apiOrigin}</p>
      </Panel>

      <SymbolResearchChart
        symbol={data.symbol.symbol}
        timeframe={timeframe}
        candles={candles.rows}
        candleCount={candles.count}
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
          {candleRowsNotice ? (
            <p className="mb-3 text-xs text-[var(--muted)]">{candleRowsNotice}</p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Fact label="Candles" value={String(candles.count)} />
            <Fact
              label="First Open"
              value={formatSymbolResearchDateTime(candles.firstOpenTime)}
            />
            <Fact
              label="Last Open"
              value={formatSymbolResearchDateTime(candles.lastOpenTime)}
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
  const url = buildSymbolResearchUrl(params);
  let response: Response;

  try {
    response = await fetch(url, { signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    throw new Error(
      "Failed to reach trade API. Check NEXT_PUBLIC_TRADE_API_BASE_URL and CORS.",
    );
  }

  const body = (await response.json().catch(() => null)) as
    | SymbolResearchResponse
    | SymbolResearchApiErrorBody
    | null;

  if (!response.ok) {
    throw new Error(formatSymbolResearchApiError(response.status, body));
  }

  if (isSymbolResearchApiErrorBody(body)) {
    throw new Error(formatSymbolResearchApiError(null, body));
  }

  return body as SymbolResearchResponse;
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
  tradeApiBaseUrl,
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

  return `${getTradeApiBaseUrl(tradeApiBaseUrl)}/api/symbol/research?${params.toString()}`;
}

export function getTradeApiBaseUrl(
  value: string | null | undefined = process.env.NEXT_PUBLIC_TRADE_API_BASE_URL,
) {
  return value?.trim().replace(/\/+$/, "") ?? "";
}

export function getSymbolResearchApiOriginLabel(
  baseUrl?: string | null,
) {
  const normalizedBaseUrl = baseUrl?.trim();

  if (!normalizedBaseUrl) {
    return "same-origin";
  }

  try {
    return new URL(normalizedBaseUrl).origin;
  } catch {
    return "same-origin";
  }
}

function ResearchState({
  title,
  message,
  apiOrigin,
}: {
  title: string;
  message: string;
  apiOrigin?: string;
}) {
  return (
    <section className="border border-[var(--border)] bg-[var(--panel)] px-4 py-8">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">{message}</p>
      {apiOrigin ? (
        <p className="mt-3 text-xs text-[var(--muted)]">API origin: {apiOrigin}</p>
      ) : null}
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

function getCandleRowsNotice(candles: SymbolResearchCandles) {
  if (candles.rows.length > 0) {
    return null;
  }

  return candles.count > 0
    ? "Candle metadata exists, but no candle rows were returned."
    : "No candle rows available for this symbol/timeframe yet.";
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

function SummaryList({ title, values }: { title: string; values: string[] }) {
  return (
    <div>
      <h3 className="text-[11px] uppercase text-[var(--muted)]">{title}</h3>
      <ul className="mt-2 space-y-1.5 text-sm text-[var(--muted)]">
        {values.map((value) => (
          <li key={value}>{value}</li>
        ))}
      </ul>
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

export function formatSymbolResearchApiError(
  status: number | null,
  body: SymbolResearchApiErrorBody | SymbolResearchResponse | null,
) {
  const errorCode = getSymbolResearchErrorCode(body);
  const message = getSymbolResearchErrorMessage(body);
  const parts = [
    status === null ? null : `HTTP ${status}`,
    errorCode,
    message,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(": ") : "Unable to load symbol research.";
}

function isSymbolResearchApiErrorBody(
  body: SymbolResearchApiErrorBody | SymbolResearchResponse | null,
): body is SymbolResearchApiErrorBody {
  return Boolean(body && "ok" in body && body.ok === false);
}

function getSymbolResearchErrorCode(
  body: SymbolResearchApiErrorBody | SymbolResearchResponse | null,
) {
  if (!body) {
    return null;
  }

  if ("error" in body && typeof body.error === "string") {
    return body.error;
  }

  if ("error" in body && typeof body.error === "object") {
    return body.error.code ?? body.code ?? null;
  }

  return "code" in body ? body.code ?? null : null;
}

function getSymbolResearchErrorMessage(
  body: SymbolResearchApiErrorBody | SymbolResearchResponse | null,
) {
  if (!body) {
    return null;
  }

  if ("error" in body && typeof body.error === "object") {
    return body.error.message ?? null;
  }

  return "message" in body ? body.message ?? null : null;
}
