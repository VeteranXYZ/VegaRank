"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { SymbolBehaviorPanel } from "./SymbolBehaviorPanel";
import { SymbolResearchChart } from "./SymbolResearchChart";
import { SymbolSignalTimeline } from "./SymbolSignalTimeline";
import {
  addWatchlistSymbol,
  isSymbolInWatchlist,
  loadWatchlistSymbols,
  normalizeWatchlistSymbol,
  saveWatchlistSymbols,
  type WatchlistStorage,
} from "@/components/watchlist/watchlistUi";
import {
  buildBehaviorReadout,
  buildBehaviorSampleQuality,
  type SymbolBehavior,
  type SymbolBehaviorDiagnostics,
} from "./symbolBehaviorUi";
import {
  normalizeSymbolResearchCandles,
  type SymbolResearchCandles,
} from "./symbolChartUi";
import {
  buildSignalEvaluationReadout,
  buildResearchDecisionSummary,
  buildSymbolResearchDiagnostics,
  buildSymbolResearchSummary,
  buildSymbolResearchTimeframeAvailability,
  buildSymbolResearchTimeframeNavigation,
  buildSymbolResearchUnavailableContent,
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
  type SignalEvaluationReadout,
  type SignalEvaluationResponse,
  type SymbolResearchTimeframeAvailabilityRow,
  type SymbolResearchTimeframeNavigationOption,
  type SymbolResearchUnavailableReason,
  type ResearchDecisionSummary,
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

type BuildSignalEvaluationUrlParams = {
  exchange?: string;
  market?: string;
  timeframe?: string;
  assetClass?: string;
  group?: string | null;
  signalLabel?: string | null;
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

type SymbolResearchSelectedRun = {
  id?: string;
  timeframe?: string;
  status?: string;
  symbolsTotal?: number;
  symbolsScanned?: number;
  symbolsSkipped?: number;
  signalsCreated?: number;
  startedAt?: string | null;
  finishedAt?: string | null;
  isLikelyFullUniverse?: boolean;
};

type SymbolResearchSymbolCoverage = {
  timeframe: string;
  candleCount: number;
  requiredCandles: number;
  firstOpenTime?: string | null;
  lastOpenTime?: string | null;
};

type SymbolResearchSuccessResponse = {
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
  latest?: {
    scanRun: SymbolResearchRun | null;
    signal?: SymbolResearchSignal | null;
  } | null;
  currentSelection?: SymbolResearchCurrentSelection;
  scoreBreakdown?: {
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
  interpretation?: {
    group: string;
    label: string;
    action: string;
    setupType: string;
    statusNote: string;
    reasons: string[];
    nextConfirmation: unknown;
    invalidation: unknown;
  };
  history?: SymbolResearchSignal[];
  timeframes?: SymbolResearchSignal[];
  behavior: SymbolBehavior | null;
  behaviorDiagnostics: SymbolBehaviorDiagnostics;
  candles?: SymbolResearchCandles;
};

type SymbolResearchUnavailableResponse = {
  ok: false;
  error?: string;
  errorCode?: string;
  unavailableReason?: SymbolResearchUnavailableReason | string | null;
  message?: string;
  timeframe?: string;
  symbol?: {
    exchange?: string;
    market?: string;
    symbol: string;
    assetClass?: string;
  };
  latest?: {
    scanRun: SymbolResearchRun | null;
    signal?: null;
  } | null;
  currentSelection?: SymbolResearchCurrentSelection;
  selectedRun?: SymbolResearchSelectedRun | null;
  symbolCoverage?: SymbolResearchSymbolCoverage | null;
  behavior?: null;
  behaviorDiagnostics?: SymbolBehaviorDiagnostics;
};

type SymbolResearchResponse =
  | SymbolResearchSuccessResponse
  | SymbolResearchUnavailableResponse;

type SymbolResearchApiErrorBody = {
  ok?: false;
  error?: string | { code?: string; message?: string };
  code?: string;
  errorCode?: string;
  message?: string;
  unavailableReason?: string | null;
};

type QueryStateInput =
  | { get(name: string): string | null }
  | Record<string, string | number | boolean | null | undefined>
  | null
  | undefined;

const defaultHistoryLimit = 30;
const defaultCandleLimit = 120;
const defaultTimeframe = "4h";
const symbolResearchTimeframes = ["4h", "1d", "1w", "1h"] as const;

export function SymbolResearchPageClient({
  exchange,
  symbol,
}: SymbolResearchPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const market = searchParams.get("market")?.trim() || "spot";
  const timeframe = searchParams.get("timeframe")?.trim() || defaultTimeframe;
  const assetClass = searchParams.get("assetClass")?.trim() || "crypto";
  const normalizedSymbol = symbol.toUpperCase();
  const tradeApiBaseUrl = getTradeApiBaseUrl();
  const apiOrigin = getSymbolResearchApiOriginLabel(tradeApiBaseUrl);
  const scannerReturnHref = buildScannerReturnHref(searchParams, {
    timeframe,
    assetClass,
  });
  const queryParams = useMemo(
    () => ({
      exchange,
      market,
      symbol: normalizedSymbol,
      timeframe,
      assetClass,
      historyLimit: defaultHistoryLimit,
      candleLimit: defaultCandleLimit,
    }),
    [assetClass, exchange, market, normalizedSymbol, timeframe],
  );
  const query = useQuery({
    queryKey: ["symbol-research", queryParams],
    queryFn: ({ signal }) => fetchSymbolResearch({ ...queryParams, signal }),
    staleTime: 60_000,
  });
  const signalEvaluationParams = useMemo(
    () => buildSignalEvaluationParams(query.data, {
      exchange,
      market,
      fallbackTimeframe: timeframe,
      fallbackAssetClass: assetClass,
      tradeApiBaseUrl,
    }),
    [assetClass, exchange, market, query.data, timeframe, tradeApiBaseUrl],
  );
  const signalEvaluationQuery = useQuery({
    queryKey: ["signal-evaluation", signalEvaluationParams],
    queryFn: ({ signal }) =>
      signalEvaluationParams
        ? fetchSignalEvaluation({ ...signalEvaluationParams, signal })
        : Promise.resolve(null),
    enabled: Boolean(signalEvaluationParams),
    staleTime: 60_000,
  });

  const handleSymbolSubmit = (inputValue: string) => {
    const nextSymbol = normalizeSymbolResearchInputSymbol(inputValue);

    if (!nextSymbol) {
      return;
    }

    router.push(
      buildSymbolResearchSwitchHref({
        exchange,
        symbol: nextSymbol,
        timeframe,
        searchParams,
      }),
    );
  };

  if (query.isLoading) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-6 text-[var(--foreground)]">
        <SymbolResearchNavigation
          key={normalizedSymbol}
          exchange={exchange}
          symbol={normalizedSymbol}
          timeframe={timeframe}
          assetClass={assetClass}
          scannerReturnHref={scannerReturnHref}
          searchParams={searchParams}
          isFetching={query.isFetching}
          onSymbolSubmit={handleSymbolSubmit}
          onRefresh={() => void query.refetch()}
        />
        <ResearchState
          title={normalizedSymbol}
          message={`Loading symbol research for ${normalizedSymbol} on ${timeframe}...`}
          apiOrigin={apiOrigin}
          scannerReturnHref={scannerReturnHref}
          loading
        />
      </main>
    );
  }

  if (query.isError) {
    const errorMessage = getSymbolResearchErrorDisplayMessage(query.error);

    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-6 text-[var(--foreground)]">
        <SymbolResearchNavigation
          key={normalizedSymbol}
          exchange={exchange}
          symbol={normalizedSymbol}
          timeframe={timeframe}
          assetClass={assetClass}
          scannerReturnHref={scannerReturnHref}
          searchParams={searchParams}
          isFetching={query.isFetching}
          onSymbolSubmit={handleSymbolSubmit}
          onRefresh={() => void query.refetch()}
        />
        <ResearchState
          title={normalizedSymbol}
          message={errorMessage}
          apiOrigin={apiOrigin}
          scannerReturnHref={scannerReturnHref}
        />
      </main>
    );
  }

  const data = query.data;

  if (!data) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-6 text-[var(--foreground)]">
        <SymbolResearchNavigation
          key={normalizedSymbol}
          exchange={exchange}
          symbol={normalizedSymbol}
          timeframe={timeframe}
          assetClass={assetClass}
          scannerReturnHref={scannerReturnHref}
          searchParams={searchParams}
          isFetching={query.isFetching}
          onSymbolSubmit={handleSymbolSubmit}
          onRefresh={() => void query.refetch()}
        />
        <ResearchState
          title={normalizedSymbol}
          message="No research data available."
          apiOrigin={apiOrigin}
          scannerReturnHref={scannerReturnHref}
        />
      </main>
    );
  }

  if (!data.ok) {
    const selectedTimeframe = data.timeframe ?? timeframe;
    const unavailableSymbol = data.symbol?.symbol ?? normalizedSymbol;
    const unavailableInput = {
      symbol: unavailableSymbol,
      timeframe: selectedTimeframe,
      unavailableReason: data.unavailableReason,
      message: data.message,
      selectedRun: data.selectedRun,
      symbolCoverage: data.symbolCoverage,
    };
    const hasEnhancedUnavailableData = Boolean(
      data.unavailableReason || data.selectedRun || data.symbolCoverage,
    );
    const timeframeAvailability = hasEnhancedUnavailableData
      ? buildSymbolResearchTimeframeAvailability({
          timeframes: symbolResearchTimeframes,
          selectedTimeframe,
          unavailable: unavailableInput,
        })
      : null;
    const content = buildSymbolResearchUnavailableContent({
      ...unavailableInput,
    });

    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-6 text-[var(--foreground)]">
        <SymbolResearchNavigation
          key={unavailableSymbol}
          exchange={exchange}
          symbol={unavailableSymbol}
          timeframe={selectedTimeframe}
          assetClass={data.symbol?.assetClass ?? assetClass}
          scannerReturnHref={scannerReturnHref}
          searchParams={searchParams}
          isFetching={query.isFetching}
          onSymbolSubmit={handleSymbolSubmit}
          onRefresh={() => void query.refetch()}
          availabilityRows={timeframeAvailability ?? undefined}
        />
        {timeframeAvailability ? (
          <TimeframeAvailabilityPanel
            rows={timeframeAvailability}
            className="mb-4"
          />
        ) : null}
        <SymbolResearchUnavailableState
          content={content}
          apiOrigin={apiOrigin}
        />
        <SymbolBehaviorPanel
          behavior={data.behavior ?? null}
          diagnostics={data.behaviorDiagnostics}
          coverage={data.symbolCoverage}
          className="mt-4"
        />
      </main>
    );
  }

  const latestSignal = data.latest?.signal ?? null;
  const selectedTimeframe = data.timeframe ?? timeframe;

  if (!latestSignal) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-6 text-[var(--foreground)]">
        <SymbolResearchNavigation
          key={normalizedSymbol}
          exchange={exchange}
          symbol={normalizedSymbol}
          timeframe={selectedTimeframe}
          assetClass={data.symbol.assetClass}
          scannerReturnHref={scannerReturnHref}
          searchParams={searchParams}
          isFetching={query.isFetching}
          onSymbolSubmit={handleSymbolSubmit}
          onRefresh={() => void query.refetch()}
        />
        <ResearchState
          title={data.symbol.symbol}
          message="No selected latest signal found for this symbol/timeframe."
          apiOrigin={apiOrigin}
          scannerReturnHref={scannerReturnHref}
        />
      </main>
    );
  }

  const history = data.history ?? [];
  const timeframes = data.timeframes ?? [];
  const interpretation = getSymbolResearchInterpretation(data, latestSignal);
  const scoreBreakdown = getSymbolResearchScoreBreakdown(data, latestSignal);
  const candles = normalizeSymbolResearchCandles(data.candles);
  const candleSummary = getSymbolResearchCandleSummary(candles);
  const riskTypes = formatSymbolResearchList(latestSignal.detectedRiskTypes);
  const secondaryStructures = formatSymbolResearchList(
    latestSignal.secondaryStructures,
  );
  const timeframeSnapshots = getSymbolResearchTimeframeSnapshots({
    timeframes,
    latestSignal,
    requestedTimeframe: selectedTimeframe,
  });
  const timeframeAvailability = buildSymbolResearchTimeframeAvailability({
    timeframes: symbolResearchTimeframes,
    selectedTimeframe,
    signals: timeframeSnapshots,
  });
  const timeframeSnapshotTitle = getTimeframeSnapshotTitle(timeframeSnapshots.length);
  const timeframeSnapshotNote = getTimeframeSnapshotNote(timeframeSnapshots);
  const showHistorySelectionNotice = hasNewerSymbolResearchHistoryRows([
    ...history,
    ...timeframes,
  ]);
  const researchSummary = buildSymbolResearchSummary(latestSignal);
  const diagnostics = buildSymbolResearchDiagnostics({
    selectedTimeframe,
    currentSelection: data.currentSelection,
    latestSignal,
    history,
  });
  const behaviorReadout = data.behavior
    ? buildBehaviorReadout({
        resultGroup: data.behavior.currentContext?.resultGroup,
        signalLabel: data.behavior.currentContext?.signalLabel,
        sampleSize: data.behavior.sampleSize,
        horizons: data.behavior.horizons,
        warnings: Array.isArray(data.behavior.warnings)
          ? data.behavior.warnings
          : [],
      })
    : null;
  const behaviorSampleQuality = data.behavior
    ? buildBehaviorSampleQuality({ behavior: data.behavior, signalHistory: history })
    : null;
  const decisionSummary = buildResearchDecisionSummary({
    selectedSignal: latestSignal,
    selectedTimeframe,
    timeframeSnapshots,
    behaviorReadout,
    behaviorDiagnostics: data.behaviorDiagnostics,
    sampleQuality: behaviorSampleQuality,
  });
  const signalEvaluationReadout = buildSignalEvaluationReadout(
    signalEvaluationQuery.data,
    {
      currentGroup: latestSignal.resultGroup,
      currentSignalLabel: latestSignal.signalLabel,
      timeframe: selectedTimeframe,
    },
  );
  const candleRowsNotice = getCandleRowsNotice(candles);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 text-[var(--foreground)]">
      <SymbolResearchNavigation
        key={data.symbol.symbol}
        exchange={exchange}
        symbol={data.symbol.symbol}
        timeframe={selectedTimeframe}
        assetClass={data.symbol.assetClass}
        scannerReturnHref={scannerReturnHref}
        searchParams={searchParams}
        isFetching={query.isFetching}
        onSymbolSubmit={handleSymbolSubmit}
        onRefresh={() => void query.refetch()}
        availabilityRows={timeframeAvailability}
      />

      <header className="mb-4 border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
              Symbol Research
            </p>
            <h1 className="mt-1 text-2xl font-semibold">{data.symbol.symbol}</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {data.symbol.exchange} · {data.symbol.market} · {selectedTimeframe} ·{" "}
              {toTitleCase(data.symbol.assetClass)}
            </p>
          </div>
          <div className="text-left text-sm text-[var(--muted)] md:text-right">
            <SymbolWatchlistControl symbol={data.symbol.symbol} />
            <div>
              Quality:{" "}
              <span className="font-semibold text-[var(--foreground)]">
                {toTitleCase(data.symbol.qualityTier)}
              </span>
            </div>
            <div>
              Latest scan:{" "}
              <span className="text-[var(--foreground)]">
                {formatSymbolResearchDateTime(data.latest?.scanRun?.finishedAt)}
              </span>
            </div>
          </div>
        </div>
      </header>

      <TimeframeAvailabilityPanel
        rows={timeframeAvailability}
        className="mb-4"
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <Panel title="Current Classification">
          <div className="grid gap-3 sm:grid-cols-2">
            <Fact label="Group" value={formatSymbolResearchGroup(interpretation.group)} />
            <Fact label="Signal" value={interpretation.label} />
            <Fact
              label="Action"
              value={formatSymbolResearchAction(interpretation.action)}
            />
            <Fact
              label="Setup Type"
              value={formatSymbolResearchSetup(interpretation.setupType)}
            />
            <Fact label="Status Note" value={interpretation.statusNote} />
            <Fact
              label="Price"
              value={formatSymbolResearchPrice(latestSignal.priceAtSignal)}
            />
          </div>
          <TextList title="Status Reasons" values={interpretation.reasons} />
        </Panel>

        <Panel title="Score Breakdown">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {getSymbolResearchScoreRows(scoreBreakdown).map((row) => (
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

      <ResearchDecisionSummaryPanel summary={decisionSummary} />

      <SignalEvaluationPanel
        readout={signalEvaluationReadout}
        isLoading={
          signalEvaluationQuery.isLoading ||
          (signalEvaluationQuery.isFetching && !signalEvaluationQuery.data)
        }
        isError={signalEvaluationQuery.isError}
      />

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <Panel title="Research Summary">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
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

        <Panel title="Data Source">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {diagnostics.rows.map((row) => (
              <Fact key={row.label} label={row.label} value={row.value} />
            ))}
            <Fact label="API Origin" value={apiOrigin} />
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
        </Panel>
      </div>

      <SymbolBehaviorPanel
        behavior={data.behavior}
        diagnostics={data.behaviorDiagnostics}
        signalHistory={history}
        className="mt-4"
      />

      <SymbolResearchChart
        symbol={data.symbol.symbol}
        timeframe={selectedTimeframe}
        candles={candles.rows}
        candleCount={candles.count}
        latestSignal={{
          candleOpenTime: latestSignal.candleOpenTime,
          resultGroup: latestSignal.resultGroup,
          statusNote: latestSignal.statusNote,
        }}
      />

      <SymbolSignalTimeline
        history={history}
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
              formatSelectedTimeframeLabel(item.timeframe, selectedTimeframe),
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

  if (isSymbolResearchUnavailableResponse(body)) {
    return body;
  }

  if (!response.ok) {
    throw new Error(formatSymbolResearchApiError(response.status, body));
  }

  if (isSymbolResearchApiErrorBody(body)) {
    throw new Error(formatSymbolResearchApiError(null, body));
  }

  return body as SymbolResearchResponse;
}

async function fetchSignalEvaluation({
  signal,
  ...params
}: BuildSignalEvaluationUrlParams & { signal?: AbortSignal }) {
  const url = buildSignalEvaluationUrl(params);
  let response: Response;

  try {
    response = await fetch(url, { signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    throw new Error("Failed to reach trade API for signal evaluation.");
  }

  const body = (await response.json().catch(() => null)) as
    | SignalEvaluationResponse
    | null;

  if (!response.ok) {
    throw new Error("Signal evaluation is currently unavailable.");
  }

  return body;
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

export function buildSignalEvaluationUrl({
  exchange = "binance",
  market = "spot",
  timeframe = defaultTimeframe,
  assetClass = "crypto",
  group,
  signalLabel,
  tradeApiBaseUrl,
}: BuildSignalEvaluationUrlParams) {
  const params = new URLSearchParams({
    exchange: exchange.toLowerCase(),
    market: market.toLowerCase(),
    timeframe,
    assetClass,
  });
  const normalizedGroup = group?.trim();
  const normalizedSignalLabel = signalLabel?.trim();

  if (normalizedGroup) {
    params.set("group", normalizedGroup);
  }

  if (normalizedSignalLabel) {
    params.set("signalLabel", normalizedSignalLabel);
  }

  return `${getTradeApiBaseUrl(tradeApiBaseUrl)}/api/signal/evaluation?${params.toString()}`;
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

export function buildScannerReturnHref(
  searchParamsOrState?: QueryStateInput,
  fallback?: { timeframe?: string | null; assetClass?: string | null },
) {
  const params = new URLSearchParams();
  const timeframe =
    getQueryStateValue(searchParamsOrState, "timeframe")?.trim() ||
    fallback?.timeframe?.trim();
  const assetClass =
    getQueryStateValue(searchParamsOrState, "assetClass")?.trim() ||
    fallback?.assetClass?.trim();
  const limit = normalizePositiveInteger(
    getQueryStateValue(searchParamsOrState, "limit"),
  );
  const includeLowQuality =
    getQueryStateValue(searchParamsOrState, "includeLowQuality") === "true";

  if (timeframe) {
    params.set("timeframe", timeframe);
  }

  if (assetClass) {
    params.set("assetClass", assetClass);
  }

  if (includeLowQuality) {
    params.set("includeLowQuality", "true");
  }

  if (limit !== null) {
    params.set("limit", String(limit));
  }

  const query = params.toString();

  return query ? `/scanner?${query}` : "/scanner";
}

export function buildSymbolResearchTimeframeHref({
  exchange,
  symbol,
  timeframe,
  searchParams,
}: {
  exchange: string;
  symbol: string;
  timeframe: string;
  searchParams?: QueryStateInput;
}) {
  return buildSymbolResearchRouteHref({
    exchange,
    symbol,
    timeframe,
    ...getSymbolResearchNavigationState(searchParams),
  });
}

export function buildSymbolResearchSwitchHref({
  exchange,
  symbol,
  timeframe,
  searchParams,
}: {
  exchange: string;
  symbol: string;
  timeframe: string;
  searchParams?: QueryStateInput;
}) {
  const normalizedSymbol = normalizeSymbolResearchInputSymbol(symbol);

  if (!normalizedSymbol) {
    return "";
  }

  return buildSymbolResearchRouteHref({
    exchange,
    symbol: normalizedSymbol,
    timeframe,
    ...getSymbolResearchNavigationState(searchParams),
  });
}

export function normalizeSymbolResearchInputSymbol(value: string) {
  return value.trim().toUpperCase();
}

function SymbolResearchNavigation({
  exchange,
  symbol,
  timeframe,
  assetClass,
  scannerReturnHref,
  searchParams,
  isFetching,
  onSymbolSubmit,
  onRefresh,
  availabilityRows,
}: {
  exchange: string;
  symbol: string;
  timeframe: string;
  assetClass?: string | null;
  scannerReturnHref: string;
  searchParams: QueryStateInput;
  isFetching: boolean;
  onSymbolSubmit: (value: string) => void;
  onRefresh: () => void;
  availabilityRows?: SymbolResearchTimeframeAvailabilityRow[];
}) {
  const [symbolInput, setSymbolInput] = useState(symbol);
  const timeframeOptions = buildSymbolResearchTimeframeNavigation({
    timeframes: symbolResearchTimeframes,
    selectedTimeframe: timeframe,
    availabilityRows,
  });
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSymbolSubmit(symbolInput);
  };

  return (
    <section className="mb-3 border border-[var(--border)] bg-[#070b0f] px-3 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={scannerReturnHref}
              className="border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] hover:border-[var(--info)]"
            >
              Back to Scanner
            </Link>
            <button
              type="button"
              onClick={onRefresh}
              disabled={isFetching}
              className="border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isFetching ? "Refreshing" : "Refresh"}
            </button>
          </div>
          <p className="mt-2 text-xs text-[var(--muted)]">
            {symbol} / {timeframe}
            {assetClass ? ` / ${toTitleCase(assetClass)}` : ""}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex w-full min-w-0 flex-col gap-2 sm:flex-row lg:max-w-md"
        >
          <label className="min-w-0 flex-1">
            <span className="sr-only">Symbol</span>
            <input
              value={symbolInput}
              onChange={(event) => setSymbolInput(event.target.value)}
              className="h-9 w-full border border-[var(--border)] bg-[#080d12] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--info)]"
              placeholder="SEIUSDT"
            />
          </label>
          <button
            type="submit"
            className="h-9 border border-[var(--border)] px-3 text-xs font-semibold text-[var(--foreground)] hover:border-[var(--info)]"
          >
            Open Symbol
          </button>
        </form>
      </div>

      <nav
        aria-label="Timeframe quick switch"
        className="mt-3 flex flex-wrap gap-2 text-xs"
      >
        {timeframeOptions.map((option) => {
          const className = getTimeframeNavigationClass(option);

          if (option.isDisabled) {
            return (
              <span
                key={option.timeframe}
                aria-disabled="true"
                title={option.reason}
                className={`${className} cursor-not-allowed`}
              >
                <span>{option.timeframe}</span>
                <span className="opacity-80">{option.badgeLabel}</span>
              </span>
            );
          }

          return (
            <Link
              key={option.timeframe}
              href={buildSymbolResearchTimeframeHref({
                exchange,
                symbol,
                timeframe: option.timeframe,
                searchParams,
              })}
              aria-current={option.isSelected ? "page" : undefined}
              title={option.reason}
              className={className}
            >
              <span>{option.timeframe}</span>
              <span className="opacity-80">{option.badgeLabel}</span>
            </Link>
          );
        })}
      </nav>
    </section>
  );
}

export function SymbolWatchlistControl({
  symbol,
  storage,
}: {
  symbol: string;
  storage?: WatchlistStorage | null;
}) {
  const normalizedSymbol = normalizeWatchlistSymbol(symbol) ?? symbol.toUpperCase();
  const initialStorage = storage === undefined ? null : storage;
  const [watchlistSymbols, setWatchlistSymbols] = useState(() =>
    loadWatchlistSymbols(initialStorage),
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const inWatchlist = isSymbolInWatchlist(watchlistSymbols, normalizedSymbol);

  useEffect(() => {
    const loadedSymbols = loadWatchlistSymbols(
      resolveSymbolWatchlistStorage(storage),
    );
    let cancelled = false;

    queueMicrotask(() => {
      if (!cancelled) {
        setWatchlistSymbols(loadedSymbols);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [storage]);

  const addToWatchlist = () => {
    const targetStorage = resolveSymbolWatchlistStorage(storage);
    const currentSymbols = loadWatchlistSymbols(targetStorage);
    const nextSymbols = addWatchlistSymbol(currentSymbols, normalizedSymbol);

    setWatchlistSymbols(nextSymbols);
    saveWatchlistSymbols(targetStorage, nextSymbols);
    setStatusMessage(
      targetStorage
        ? "Added to watchlist."
        : "Storage unavailable. Added in this view only.",
    );
  };

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2 md:justify-end">
      {inWatchlist ? (
        <span className="border border-emerald-500/40 px-2 py-1 text-[11px] font-semibold text-emerald-200">
          In Watchlist
        </span>
      ) : (
        <button
          type="button"
          onClick={addToWatchlist}
          className="border border-[var(--border)] px-2 py-1 text-[11px] font-semibold text-[var(--foreground)] hover:border-[var(--info)]"
        >
          Add to Watchlist
        </button>
      )}
      <Link
        href="/watchlist"
        className="border border-[var(--border)] px-2 py-1 text-[11px] font-semibold text-[var(--foreground)] hover:border-[var(--info)]"
      >
        Open Watchlist
      </Link>
      {statusMessage ? (
        <span className="basis-full text-[11px] text-[var(--muted)] md:text-right">
          {statusMessage}
        </span>
      ) : null}
    </div>
  );
}

function resolveSymbolWatchlistStorage(
  storage: WatchlistStorage | null | undefined,
) {
  if (storage !== undefined) {
    return storage;
  }

  return typeof window === "undefined" ? null : window.localStorage;
}

function TimeframeAvailabilityPanel({
  rows,
  className = "",
}: {
  rows: SymbolResearchTimeframeAvailabilityRow[];
  className?: string;
}) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <Panel title="Timeframe Availability" className={className}>
      <ResponsiveTable
        headers={[
          "Timeframe",
          "Status",
          "Reason",
          "Candles",
          "Run Context",
          "Group",
          "Action",
          "Rank",
          "Scan Time",
        ]}
        rows={rows.map((row) => [
          row.isSelected ? `${row.timeframe} (selected)` : row.timeframe,
          row.statusLabel,
          row.reason,
          row.candles,
          row.selectedRun,
          row.group,
          row.action,
          row.rank,
          row.scanTime,
        ])}
        emptyText="No timeframe availability rows available."
      />
    </Panel>
  );
}

function getTimeframeNavigationClass(option: SymbolResearchTimeframeNavigationOption) {
  const base =
    "inline-flex items-center gap-1.5 border px-3 py-1.5 font-semibold";

  if (option.status === "planned") {
    return `${base} border-[var(--border)] bg-[#080d12] text-[var(--muted)] opacity-70`;
  }

  if (option.status === "selected_unavailable") {
    return `${base} border-amber-400/50 bg-amber-500/10 text-amber-100 hover:border-amber-300`;
  }

  if (option.status === "unavailable") {
    return `${base} border-[var(--border)] bg-[#080d12] text-[var(--muted)] hover:border-amber-400/50 hover:text-[var(--foreground)]`;
  }

  if (option.isSelected) {
    return `${base} border-[var(--info)] bg-[#07131a] text-[var(--foreground)]`;
  }

  return `${base} border-[var(--border)] text-[var(--muted)] hover:border-[var(--info)] hover:text-[var(--foreground)]`;
}

function ResearchState({
  title,
  message,
  apiOrigin,
  scannerReturnHref,
  loading = false,
}: {
  title: string;
  message: string;
  apiOrigin?: string;
  scannerReturnHref?: string;
  loading?: boolean;
}) {
  return (
    <section className="border border-[var(--border)] bg-[var(--panel)] px-4 py-8">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">{message}</p>
      {loading ? (
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <div className="h-16 border border-[var(--border)] bg-[#080d12]" />
          <div className="h-16 border border-[var(--border)] bg-[#080d12]" />
          <div className="h-16 border border-[var(--border)] bg-[#080d12]" />
        </div>
      ) : null}
      {apiOrigin ? (
        <p className="mt-3 text-xs text-[var(--muted)]">API origin: {apiOrigin}</p>
      ) : null}
      {scannerReturnHref ? (
        <Link
          href={scannerReturnHref}
          className="mt-4 inline-flex border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] hover:border-[var(--info)]"
        >
          Back to Scanner
        </Link>
      ) : null}
    </section>
  );
}

function SymbolResearchUnavailableState({
  content,
  apiOrigin,
}: {
  content: ReturnType<typeof buildSymbolResearchUnavailableContent>;
  apiOrigin?: string;
}) {
  return (
    <section className="border border-[var(--border)] bg-[var(--panel)] px-4 py-5">
      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
        Symbol Research
      </p>
      <h1 className="mt-1 text-xl font-semibold">{content.title}</h1>
      <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">{content.message}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {content.details.map((detail) => (
          <Fact key={detail.label} label={detail.label} value={detail.value} />
        ))}
        {apiOrigin ? <Fact label="API Origin" value={apiOrigin} /> : null}
      </div>

      <div className="mt-5 border border-[var(--border)] bg-[#080d12] px-3 py-3">
        <h2 className="text-sm font-semibold">Suggested next checks</h2>
        <ul className="mt-2 space-y-1.5 text-sm text-[var(--muted)]">
          {content.suggestions.map((suggestion) => (
            <li key={suggestion}>{suggestion}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ResearchDecisionSummaryPanel({
  summary,
}: {
  summary: ResearchDecisionSummary;
}) {
  return (
    <Panel title="Research Decision Summary" className="mt-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
        <div>
          <div className="text-[11px] uppercase text-[var(--muted)]">
            Summary
          </div>
          <div className="mt-1 text-lg font-semibold text-[var(--foreground)]">
            {summary.summaryLabel}
          </div>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Research-only framing; not a score or trading instruction.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Fact label="Current Stance" value={summary.currentStance} />
          <Fact
            label="Multi-Timeframe Alignment"
            value={summary.multiTimeframeAlignment}
          />
          <Fact label="Behavior Support" value={summary.behaviorSupport} />
          <Fact label="Confidence Note" value={summary.confidenceNote} />
          <Fact label="Key Caution" value={summary.keyCaution} />
          <Fact
            label="Suggested Research Posture"
            value={summary.suggestedResearchPosture}
          />
        </div>
      </div>
    </Panel>
  );
}

function SignalEvaluationPanel({
  readout,
  isLoading,
  isError,
}: {
  readout: SignalEvaluationReadout;
  isLoading?: boolean;
  isError?: boolean;
}) {
  return (
    <Panel title="Signal Evaluation" className="mt-4">
      <p className="mb-4 max-w-3xl text-sm text-[var(--muted)]">
        How this type of scanner signal behaved across the broader market. Separate
        from this symbol&apos;s own history.
      </p>
      {isLoading ? (
        <p className="text-sm text-[var(--muted)]">
          Loading broad-market signal evaluation...
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Fact
              label="Expected Direction"
              value={readout.expectedDirectionLabel}
            />
            <Fact label="Sample Quality" value={readout.sampleQualityLabel} />
            <Fact label="Source Signals" value={readout.sourceSignals} />
            <Fact label="Completed Signals" value={readout.completedSignals} />
            <Fact label="Selected Horizon" value={readout.selectedHorizonLabel} />
            <Fact label="Median Return" value={readout.medianReturn} />
            <Fact label="Direction Match" value={readout.directionMatchRate} />
            <Fact label="Positive Rate" value={readout.positiveRate} />
          </div>
          <div
            className={`mt-4 border px-3 py-3 text-sm ${
              isError || !readout.available
                ? "border-[var(--border)] bg-[#080d12] text-[var(--muted)]"
                : "border-[var(--border)] bg-[#07131a] text-[var(--foreground)]"
            }`}
          >
            <div className="text-[11px] uppercase text-[var(--muted)]">
              Main Interpretation
            </div>
            <p className="mt-1">{readout.mainInterpretation}</p>
          </div>
          {readout.warnings.length > 0 ? (
            <ul className="mt-3 space-y-1.5 text-xs text-[var(--muted)]">
              {readout.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </Panel>
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
      className={`min-w-0 border border-[var(--border)] bg-[var(--panel)] px-4 py-4 ${className}`}
    >
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase text-[var(--muted)]">{label}</div>
      <div className="mt-1 break-words text-sm text-[var(--foreground)]">{value}</div>
    </div>
  );
}

function formatSelectedTimeframeLabel(
  value: string | null | undefined,
  selectedTimeframe: string,
) {
  const timeframe = value || "Unknown";

  return timeframe.toLowerCase() === selectedTimeframe.toLowerCase()
    ? `${timeframe} (selected)`
    : timeframe;
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

function getSymbolResearchInterpretation(
  data: SymbolResearchSuccessResponse,
  latestSignal: SymbolResearchSignal,
) {
  return {
    group: data.interpretation?.group ?? latestSignal.resultGroup ?? "neutral",
    label: data.interpretation?.label ?? latestSignal.signalLabel ?? "Unknown",
    action:
      data.interpretation?.action ??
      latestSignal.actionBias ??
      latestSignal.statusNote ??
      "review_only",
    setupType:
      data.interpretation?.setupType ?? latestSignal.primaryStructure ?? "unknown",
    statusNote:
      data.interpretation?.statusNote ??
      latestSignal.statusNote ??
      "No status note available.",
    reasons: data.interpretation?.reasons ?? latestSignal.statusReasons ?? [],
  };
}

function getSymbolResearchScoreBreakdown(
  data: SymbolResearchSuccessResponse,
  latestSignal: SymbolResearchSignal,
) {
  return {
    rankScore: data.scoreBreakdown?.rankScore ?? latestSignal.rankScore,
    finalSignalScore:
      data.scoreBreakdown?.finalSignalScore ?? latestSignal.finalSignalScore,
    opportunityScore:
      data.scoreBreakdown?.opportunityScore ?? latestSignal.opportunityScore,
    confirmationScore:
      data.scoreBreakdown?.confirmationScore ?? latestSignal.confirmationScore,
    riskScore: data.scoreBreakdown?.riskScore ?? latestSignal.riskScore,
    trendScore: data.scoreBreakdown?.trendScore ?? latestSignal.trendScore,
    momentumScore:
      data.scoreBreakdown?.momentumScore ?? latestSignal.momentumScore,
    volumeScore: data.scoreBreakdown?.volumeScore ?? latestSignal.volumeScore,
    structureScore:
      data.scoreBreakdown?.structureScore ?? latestSignal.structureScore,
  };
}

function buildSignalEvaluationParams(
  data: SymbolResearchResponse | undefined,
  {
    exchange,
    market,
    fallbackTimeframe,
    fallbackAssetClass,
    tradeApiBaseUrl,
  }: {
    exchange: string;
    market: string;
    fallbackTimeframe: string;
    fallbackAssetClass: string;
    tradeApiBaseUrl: string;
  },
): BuildSignalEvaluationUrlParams | null {
  if (!data?.ok) {
    return null;
  }

  const latestSignal = data.latest?.signal ?? null;

  if (!latestSignal) {
    return null;
  }

  return {
    exchange,
    market,
    timeframe: data.timeframe ?? latestSignal.timeframe ?? fallbackTimeframe,
    assetClass: data.symbol.assetClass || fallbackAssetClass,
    group: latestSignal.resultGroup ?? data.interpretation?.group ?? null,
    signalLabel: latestSignal.signalLabel,
    tradeApiBaseUrl,
  };
}

function buildSymbolResearchRouteHref({
  exchange,
  symbol,
  timeframe,
  assetClass,
  includeLowQuality,
  limit,
  from,
}: {
  exchange: string;
  symbol: string;
  timeframe?: string | null;
  assetClass?: string | null;
  includeLowQuality?: boolean | string | null;
  limit?: number | string | null;
  from?: string | null;
}) {
  const params = new URLSearchParams({
    timeframe: timeframe?.trim() || defaultTimeframe,
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

  return `/symbol/${encodeURIComponent(
    normalizeExchangePathSegment(exchange),
  )}/${encodeURIComponent(normalizeSymbolResearchInputSymbol(symbol))}?${params.toString()}`;
}

function getSymbolResearchNavigationState(searchParams?: QueryStateInput) {
  return {
    assetClass: getQueryStateValue(searchParams, "assetClass"),
    includeLowQuality: getQueryStateValue(searchParams, "includeLowQuality"),
    limit: getQueryStateValue(searchParams, "limit"),
    from: getQueryStateValue(searchParams, "from"),
  };
}

function getQueryStateValue(input: QueryStateInput, key: string) {
  if (!input) {
    return null;
  }

  if ("get" in input && typeof input.get === "function") {
    return input.get(key);
  }

  const record = input as Record<string, string | number | boolean | null | undefined>;
  const value = record[key];

  return value === null || value === undefined ? null : String(value);
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

function getSymbolResearchErrorDisplayMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unable to load symbol research.";
}

export function formatSymbolResearchApiError(
  status: number | null,
  body: SymbolResearchApiErrorBody | SymbolResearchResponse | null,
) {
  const errorCode = getSymbolResearchErrorCode(body);
  const message = getSymbolResearchErrorMessage(body);
  const knownMessage = getKnownSymbolResearchErrorMessage(errorCode);

  if (knownMessage) {
    return knownMessage;
  }

  const parts = [
    status === null ? null : `HTTP ${status}`,
    errorCode,
    message,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(": ") : "Unable to load symbol research.";
}

function getKnownSymbolResearchErrorMessage(errorCode: string | null) {
  switch (errorCode) {
    case "SYMBOL_NOT_FOUND":
      return "Symbol not found in scanner universe.";
    case "NO_LATEST_SIGNAL":
      return "No scanner signal is available for this symbol/timeframe from the selected latest run.";
    case "INVALID_TIMEFRAME":
      return "Invalid timeframe. Try 1h, 4h, 1d, or 1w.";
    default:
      return null;
  }
}

function isSymbolResearchUnavailableResponse(
  body: SymbolResearchResponse | SymbolResearchApiErrorBody | null,
): body is SymbolResearchUnavailableResponse {
  return Boolean(
    body &&
      "ok" in body &&
      body.ok === false &&
      (("unavailableReason" in body && body.unavailableReason) ||
        ("selectedRun" in body && body.selectedRun) ||
        ("symbolCoverage" in body && body.symbolCoverage)),
  );
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
    return (
      body.error.code ??
      body.errorCode ??
      ("code" in body ? body.code ?? null : null)
    );
  }

  if ("errorCode" in body && body.errorCode) {
    return body.errorCode;
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
