"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { RefreshIconButton } from "@/components/ui/workspace";
import { useAppLanguage } from "@/lib/i18n/AppLanguageProvider";
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
import { MarketContextPanel } from "@/components/market-context/MarketContextPanel";
import { formatSignalLabel } from "@/components/scanner/latestScanUi";
import {
  fetchMarketContext,
  isMarketContextResponse,
  type MarketContextResponse,
} from "@/components/market-context/marketContextUi";
import {
  buildBehaviorReadout,
  buildBehaviorSampleQuality,
  buildHistoricalFollowThroughEvaluation,
  formatBehaviorSampleSize,
  type BehaviorSampleQualityReadout,
  type HistoricalFollowThroughEvaluation,
  type SymbolBehavior,
  type SymbolBehaviorDiagnostics,
} from "./symbolBehaviorUi";
import {
  normalizeSymbolResearchCandles,
  type SymbolResearchCandles,
} from "./symbolChartUi";
import {
  DEFAULT_SYMBOL_RESEARCH_TIMEFRAME,
  buildSymbolResearchHref,
  getSymbolResearchTimeframeSelection,
  normalizeSymbolResearchTimeframe,
  type SymbolResearchTimeframeSelection,
} from "./symbolResearchLinks";
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
  hasNewerSymbolResearchHistoryRows,
  toTitleCase,
  type SignalEvaluationReadout,
  type SignalEvaluationResponse,
  type SymbolResearchTimeframeAvailabilityRow,
  type SymbolResearchTimeframeNavigationOption,
  type SymbolResearchUnavailableReason,
  type ResearchDecisionSummary,
  type SymbolResearchDisplayDictionary,
} from "./symbolResearchUi";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { formatScannerReviewValue } from "@/lib/i18n/formatScannerObservation";
import type { ScannerReviewText } from "@/lib/shared/scannerTypes";

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

export type SymbolResearchVisualCheckData = {
  data: SymbolResearchSuccessResponse;
  marketContext?: MarketContextResponse | null;
  signalEvaluation?: SignalEvaluationResponse | null;
  apiOriginLabel?: string;
  scannerReturnHref?: string;
};

type SymbolResearchPageClientProps = {
  exchange: string;
  symbol: string;
  visualCheckData?: SymbolResearchVisualCheckData;
};

export type SymbolResearchRun = {
  id: string;
  status: string;
  timeframe: string;
  symbolsTotal: number;
  symbolsScanned: number;
  signalsCreated: number;
  finishedAt: string | null;
};

export type SymbolResearchSignal = {
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
  statusNoteKey?: string | null;
  statusNote?: string | null;
  cautionLevel?: string | null;
  statusReasonKeys?: ScannerReviewText[];
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

export type SymbolResearchSuccessResponse = {
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
const defaultTimeframe = DEFAULT_SYMBOL_RESEARCH_TIMEFRAME;
const symbolResearchTimeframes = ["4h", "1d", "1w", "1h"] as const;
const symbolResearchExchanges = ["binance", "coinbase"] as const;
const symbolResearchMarketContextAssetClass = "crypto";
const symbolResearchMainClass =
  "symbol-terminal flex h-full min-h-0 w-full max-w-none flex-col overflow-hidden bg-[var(--workspace-background)] px-1.5 py-1.5 text-[var(--foreground)] sm:px-2";

type SymbolTerminalTone =
  | "accent"
  | "eligible"
  | "watch"
  | "repair"
  | "risk"
  | "warning"
  | "complete"
  | "neutral"
  | "missing";

type SymbolTerminalStat = {
  label: string;
  value: string;
  tone: SymbolTerminalTone;
  title?: string;
};

export function SymbolResearchPageClient({
  exchange,
  symbol,
  visualCheckData,
}: SymbolResearchPageClientProps) {
  const { dictionary } = useAppLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isVisualCheck = Boolean(visualCheckData);
  const market = searchParams.get("market")?.trim() || "spot";
  const timeframeSelection = getSymbolResearchTimeframeSelection(
    searchParams.get("timeframe"),
  );
  const timeframe = timeframeSelection.selectedTimeframe;
  const assetClass = searchParams.get("assetClass")?.trim() || "crypto";
  const normalizedSymbol = symbol.toUpperCase();
  const tradeApiBaseUrl = getTradeApiBaseUrl();
  const apiOrigin =
    visualCheckData?.apiOriginLabel ??
    getSymbolResearchApiOriginLabel(tradeApiBaseUrl);
  const scannerReturnHref =
    visualCheckData?.scannerReturnHref ??
    buildScannerReturnHref(searchParams, {
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
    enabled: !isVisualCheck,
    staleTime: 60_000,
  });
  const marketContextQuery = useQuery({
    queryKey: ["market-context", symbolResearchMarketContextAssetClass],
    queryFn: ({ signal }) =>
      fetchMarketContext({
        assetClass: symbolResearchMarketContextAssetClass,
        signal,
        tradeApiBaseUrl,
      }),
    enabled: !isVisualCheck,
    staleTime: 60_000,
  });
  const effectiveResearchData = visualCheckData?.data ?? query.data;
  const signalEvaluationParams = useMemo(
    () => buildSignalEvaluationParams(effectiveResearchData, {
      exchange,
      market,
      fallbackTimeframe: timeframe,
      fallbackAssetClass: assetClass,
      tradeApiBaseUrl,
    }),
    [
      assetClass,
      effectiveResearchData,
      exchange,
      market,
      timeframe,
      tradeApiBaseUrl,
    ],
  );
  const signalEvaluationQuery = useQuery({
    queryKey: ["signal-evaluation", signalEvaluationParams],
    queryFn: ({ signal }) =>
      signalEvaluationParams
        ? fetchSignalEvaluation({ ...signalEvaluationParams, signal })
        : Promise.resolve(null),
    enabled: !isVisualCheck && Boolean(signalEvaluationParams),
    staleTime: 60_000,
  });
  const isFetching = isVisualCheck ? false : query.isFetching;
  const handleRefresh = isVisualCheck ? () => undefined : () => void query.refetch();
  const marketContextData = isVisualCheck
    ? visualCheckData?.marketContext
    : marketContextQuery.data;
  const marketContextIsLoading = isVisualCheck
    ? false
    : marketContextQuery.isLoading;
  const marketContextIsError = isVisualCheck ? false : marketContextQuery.isError;
  const signalEvaluationData = isVisualCheck
    ? visualCheckData?.signalEvaluation
    : signalEvaluationQuery.data;
  const signalEvaluationIsLoading = isVisualCheck
    ? false
    : signalEvaluationQuery.isLoading;
  const signalEvaluationIsFetching = isVisualCheck
    ? false
    : signalEvaluationQuery.isFetching;
  const signalEvaluationIsError = isVisualCheck
    ? false
    : signalEvaluationQuery.isError;

  const handleSymbolSubmit = (inputValue: string) => {
    if (isVisualCheck) {
      return;
    }

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

  const handleExchangeChange = (nextExchange: string) => {
    if (isVisualCheck) {
      return;
    }

    const normalizedExchange =
      symbolResearchExchanges.find((option) => option === nextExchange.toLowerCase()) ??
      "binance";

    router.push(
      buildSymbolResearchSwitchHref({
        exchange: normalizedExchange,
        symbol: normalizedSymbol,
        timeframe,
        searchParams,
      }),
    );
  };

  if (!isVisualCheck && query.isLoading) {
    return (
      <main className={symbolResearchMainClass}>
        <SymbolResearchNavigation
          key={normalizedSymbol}
          exchange={exchange}
          symbol={normalizedSymbol}
          timeframe={timeframe}
          timeframeSelection={timeframeSelection}
          assetClass={assetClass}
          scannerReturnHref={scannerReturnHref}
          searchParams={searchParams}
          isFetching={isFetching}
          onSymbolSubmit={handleSymbolSubmit}
          onExchangeChange={handleExchangeChange}
          onRefresh={handleRefresh}
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

  if (!isVisualCheck && query.isError) {
    const errorMessage = getSymbolResearchErrorDisplayMessage(query.error);

    return (
      <main className={symbolResearchMainClass}>
        <SymbolResearchNavigation
          key={normalizedSymbol}
          exchange={exchange}
          symbol={normalizedSymbol}
          timeframe={timeframe}
          timeframeSelection={timeframeSelection}
          assetClass={assetClass}
          scannerReturnHref={scannerReturnHref}
          searchParams={searchParams}
          isFetching={isFetching}
          onSymbolSubmit={handleSymbolSubmit}
          onExchangeChange={handleExchangeChange}
          onRefresh={handleRefresh}
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

  const data = effectiveResearchData;

  if (!data) {
    return (
      <main className={symbolResearchMainClass}>
        <SymbolResearchNavigation
          key={normalizedSymbol}
          exchange={exchange}
          symbol={normalizedSymbol}
          timeframe={timeframe}
          timeframeSelection={timeframeSelection}
          assetClass={assetClass}
          scannerReturnHref={scannerReturnHref}
          searchParams={searchParams}
          isFetching={isFetching}
          onSymbolSubmit={handleSymbolSubmit}
          onExchangeChange={handleExchangeChange}
          onRefresh={handleRefresh}
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
      <main className={symbolResearchMainClass}>
        <SymbolResearchNavigation
          key={unavailableSymbol}
          exchange={exchange}
          symbol={unavailableSymbol}
          timeframe={selectedTimeframe}
          timeframeSelection={timeframeSelection}
          assetClass={data.symbol?.assetClass ?? assetClass}
          scannerReturnHref={scannerReturnHref}
          searchParams={searchParams}
          isFetching={isFetching}
          onSymbolSubmit={handleSymbolSubmit}
          onExchangeChange={handleExchangeChange}
          onRefresh={handleRefresh}
          availabilityRows={timeframeAvailability ?? undefined}
        />
        {timeframeAvailability ? (
          <TimeframeAvailabilityPanel
            rows={timeframeAvailability}
            className="mb-2"
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
      <main className={symbolResearchMainClass}>
        <SymbolResearchNavigation
          key={normalizedSymbol}
          exchange={exchange}
          symbol={normalizedSymbol}
          timeframe={selectedTimeframe}
          timeframeSelection={timeframeSelection}
          assetClass={data.symbol.assetClass}
          scannerReturnHref={scannerReturnHref}
          searchParams={searchParams}
          isFetching={isFetching}
          onSymbolSubmit={handleSymbolSubmit}
          onExchangeChange={handleExchangeChange}
          onRefresh={handleRefresh}
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
  const interpretation = getSymbolResearchInterpretation(
    data,
    latestSignal,
    dictionary,
  );
  const scoreBreakdown = getSymbolResearchScoreBreakdown(data, latestSignal);
  const candles = normalizeSymbolResearchCandles(data.candles);
  const candleSummary = getSymbolResearchCandleSummary(candles);
  const timeframeSnapshots = getSymbolResearchTimeframeSnapshots({
    timeframes,
    latestSignal,
    requestedTimeframe: selectedTimeframe,
  });
  const timeframeAvailability = buildSymbolResearchTimeframeAvailability({
    timeframes: symbolResearchTimeframes,
    selectedTimeframe,
    signals: timeframeSnapshots,
    dictionary,
  });
  const timeframeSnapshotTitle = getTimeframeSnapshotTitle(timeframeSnapshots.length);
  const timeframeSnapshotNote = getTimeframeSnapshotNote(timeframeSnapshots);
  const showHistorySelectionNotice = hasNewerSymbolResearchHistoryRows([
    ...history,
    ...timeframes,
  ]);
  const researchSummary = buildSymbolResearchSummary(latestSignal, dictionary);
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
  const historicalFollowThroughEvaluation =
    buildHistoricalFollowThroughEvaluation({
      behavior: data.behavior,
      diagnostics: data.behaviorDiagnostics,
      sampleQuality: behaviorSampleQuality,
    });
  const signalEvaluationReadout = buildSignalEvaluationReadout(
    signalEvaluationData,
    {
      currentGroup: latestSignal.resultGroup,
      currentSignalLabel: latestSignal.signalLabel,
      timeframe: selectedTimeframe,
    },
  );
  const marketContextImplication = buildSymbolMarketContextImplication({
    data: marketContextData,
    isError: marketContextIsError,
    selectedGroup: latestSignal.resultGroup ?? interpretation.group,
    selectedTimeframe,
    timeframeSnapshots,
  });
  const candleRowsNotice = getCandleRowsNotice(candles);
  const primaryReason = getSymbolResearchPrimaryReason({
    interpretation,
    latestSignal,
    decisionSummary,
    selectedTimeframe,
    timeframeSnapshots,
  });
  const evidence = buildSymbolResearchEvidence({
    selectedTimeframe,
    interpretation,
    latestSignal,
    scoreBreakdown,
    decisionSummary,
    marketContextImplication,
    behaviorSampleQuality,
    showHistorySelectionNotice,
    dictionary,
  });
  const nextCheckItems = buildSymbolResearchNextChecks({
    selectedTimeframe,
    interpretation,
    researchSummary,
    timeframeSnapshots,
    dictionary,
  });
  const detailsDiagnosticsPanel = (
    <details
      id="symbol-details"
      className="terminal-panel px-2.5 py-2 text-[11px] text-[var(--muted)]"
    >
      <summary className="cursor-pointer list-none font-semibold uppercase text-[var(--muted)] transition hover:text-[var(--foreground)]">
        Diagnostics
        <span className="ml-1 font-normal normal-case text-[var(--muted-2)]">
          source summary
        </span>
      </summary>
      <div className="mt-2 space-y-2">
        <SignalEvaluationPanel
          readout={signalEvaluationReadout}
          isLoading={
            signalEvaluationIsLoading ||
            (signalEvaluationIsFetching && !signalEvaluationData)
          }
          isError={signalEvaluationIsError}
          className="px-2 py-2"
        />

        <SymbolBehaviorPanel
          behavior={data.behavior}
          diagnostics={data.behaviorDiagnostics}
          signalHistory={history}
        />

        <TimeframeAvailabilityPanel rows={timeframeAvailability} />

        <Panel title={timeframeSnapshotTitle}>
          {timeframeSnapshotNote ? (
            <p className="mb-3 text-xs text-[var(--muted)]">
              {timeframeSnapshotNote}
            </p>
          ) : null}
          <ResponsiveTable
            headers={[
              "Timeframe",
              "Group",
              "Action",
              "Rank",
              "Scan Time",
              "Run Context",
            ]}
            rows={timeframeSnapshots.map((item) => [
              formatSelectedTimeframeLabel(item.timeframe, selectedTimeframe),
              formatSymbolResearchGroup(item.resultGroup, dictionary),
              formatSymbolResearchAction(
                item.actionBias ?? item.statusNoteKey ?? item.statusNote,
                dictionary,
              ),
              formatSymbolResearchScore(item.rankScore),
              formatSymbolResearchDateTime(item.scanTime),
              formatSymbolResearchRunContext(item),
            ])}
            emptyText="No timeframe snapshots available."
          />
        </Panel>

        <Panel title="Recent Candles Summary">
          {candleRowsNotice ? (
            <p className="mb-3 text-xs text-[var(--muted)]">
              {candleRowsNotice}
            </p>
          ) : null}
          <div className="grid gap-2">
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

        <Panel title="Data Source">
          <div className="grid gap-2">
            {diagnostics.rows.map((row) => (
              <Fact key={row.label} label={row.label} value={row.value} />
            ))}
            <Fact label="API Origin" value={apiOrigin} />
          </div>
          <p
            className={`terminal-state-panel mt-3 border-l-4 px-3 py-2 text-xs ${
              diagnostics.hasWarning
                ? "border-l-[var(--warning)] text-[var(--warning)]"
                : "border-l-[var(--neutral)] text-[var(--muted)]"
            }`}
          >
            {diagnostics.notice}
          </p>
        </Panel>

      </div>
    </details>
  );

  return (
    <main className={symbolResearchMainClass}>
      <div className="shrink-0 lg:-mx-1.5 lg:bg-[var(--workspace-background)] lg:px-1.5 lg:pb-1">
        <SymbolResearchNavigation
          key={data.symbol.symbol}
          exchange={exchange}
          symbol={data.symbol.symbol}
          timeframe={selectedTimeframe}
          timeframeSelection={timeframeSelection}
          assetClass={data.symbol.assetClass}
          scannerReturnHref={scannerReturnHref}
          searchParams={searchParams}
          isFetching={isFetching}
          onSymbolSubmit={handleSymbolSubmit}
          onExchangeChange={handleExchangeChange}
          onRefresh={handleRefresh}
          availabilityRows={timeframeAvailability}
          extraStats={[
            {
              label: "Quality",
              value: toTitleCase(data.symbol.qualityTier),
              tone: data.symbol.isLowQuality ? "warning" : "complete",
            },
            {
              label: "Latest",
              value: formatSymbolResearchDateTime(data.latest?.scanRun?.finishedAt),
              tone: "neutral",
            },
          ]}
          watchlistSymbol={data.symbol.symbol}
        />

        <DecisionHeader
          symbol={data.symbol.symbol}
          selectedTimeframe={selectedTimeframe}
          interpretation={interpretation}
          scoreBreakdown={scoreBreakdown}
          qualityTier={data.symbol.qualityTier}
          latestScanTime={data.latest?.scanRun?.finishedAt}
          stance={getSymbolResearchStance(interpretation.group)}
          primaryReason={primaryReason}
          dictionary={dictionary}
        />
      </div>

      <section className="grid min-h-0 min-w-0 flex-1 gap-2 overflow-hidden lg:grid-cols-[minmax(0,1.32fr)_minmax(300px,0.68fr)_minmax(292px,0.58fr)]">
        <div className="flex min-h-0 min-w-0 flex-col gap-2 overflow-hidden">
          <MtfContextStrip
            snapshots={timeframeSnapshots}
            selectedTimeframe={selectedTimeframe}
            className="shrink-0"
            dictionary={dictionary}
          />
          <SymbolResearchChart
            exchange={exchange}
            symbol={data.symbol.symbol}
            timeframe={selectedTimeframe}
            candles={candles.rows}
            candleCount={candles.count}
            className="min-h-0 flex-1"
            density="compact"
            latestSignal={{
              candleOpenTime: latestSignal.candleOpenTime,
              resultGroup: latestSignal.resultGroup,
              statusNote: latestSignal.statusNote,
            }}
          />
        </div>

        <div className="min-h-0 min-w-0 overflow-y-auto overscroll-contain pr-1">
          <div className="grid min-w-0 content-start gap-2">
            <WhyThisStatePanel
              positiveEvidence={evidence.positive}
              risksAndLimits={evidence.risks}
              scoreBreakdown={scoreBreakdown}
            />
            <NextChecksPanel items={nextCheckItems} />
            <HistoricalEvidenceSummaryPanel
              behavior={data.behavior}
              evaluation={historicalFollowThroughEvaluation}
              sampleQuality={behaviorSampleQuality}
              signalEvaluationReadout={signalEvaluationReadout}
            />
          </div>
        </div>

        <aside className="grid min-h-0 min-w-0 content-start gap-2 overflow-y-auto overscroll-contain pr-1">
          <MarketContextPanel
            variant="compact"
            data={marketContextData}
            isLoading={marketContextIsLoading}
            isError={marketContextIsError}
            implication={marketContextImplication}
          />
          <SymbolSignalTimeline
            history={history}
            showSelectionNotice={showHistorySelectionNotice}
            className=""
            variant="rail"
            maxItems={3}
          />
          {detailsDiagnosticsPanel}
        </aside>
      </section>
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
    timeframe: normalizeSymbolResearchTimeframe(timeframe),
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

export function buildSymbolMarketContextImplication({
  data,
  isError = false,
  selectedGroup,
  selectedTimeframe,
  timeframeSnapshots,
}: {
  data?: MarketContextResponse | null;
  isError?: boolean;
  selectedGroup?: string | null;
  selectedTimeframe?: string | null;
  timeframeSnapshots?: Array<{
    timeframe?: string | null;
    resultGroup?: string | null;
  }> | null;
}) {
  if (isError || !isMarketContextResponse(data)) {
    return "Market context unavailable; symbol data remains available.";
  }

  const group = normalizeSymbolMarketContextGroup(selectedGroup);
  const timeframe = selectedTimeframe?.trim() || "selected timeframe";
  const higherTimeframeRiskNote = hasHigherTimeframeRisk({
    selectedTimeframe: timeframe,
    timeframeSnapshots,
  })
    ? " Higher-timeframe risk in the symbol snapshot also raises the confirmation bar."
    : "";

  if (isRiskOrientedSymbolMarketContext(data)) {
    if (group === "risk") {
      return `Risk-oriented backdrop reinforces this ${timeframe} risk classification.${higherTimeframeRiskNote}`;
    }

    if (group === "eligible" || group === "watch") {
      return `Risk-oriented backdrop makes this ${timeframe} setup a repair read, not clean trend context.${higherTimeframeRiskNote}`;
    }

    return `Risk-oriented backdrop; symbol structure stays primary.${higherTimeframeRiskNote}`;
  }

  if (isConstructiveSymbolMarketContext(data)) {
    if (group === "eligible") {
      return `Supportive backdrop; symbol confirmation still leads.${higherTimeframeRiskNote}`;
    }

    return `Supportive backdrop; symbol signal remains primary.${higherTimeframeRiskNote}`;
  }

  if (isMixedSymbolMarketContext(data)) {
    return `Mixed backdrop; symbol structure stays primary.${higherTimeframeRiskNote}`;
  }

  return `BTC/ETH backdrop available for the ${timeframe} review.${higherTimeframeRiskNote}`;
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

function normalizeSymbolMarketContextGroup(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";

  if (normalized === "risk") {
    return "risk";
  }

  if (normalized === "eligible") {
    return "eligible";
  }

  if (normalized === "watch" || normalized.startsWith("watch_")) {
    return "watch";
  }

  return normalized || "neutral";
}

function isRiskOrientedSymbolMarketContext(data: MarketContextResponse) {
  const { combinedContext, marketContext, tacticalContext } = data.context;

  return (
    combinedContext === "unstable_transition" ||
    combinedContext === "risk_off_continuation" ||
    marketContext.includes("risk_off") ||
    tacticalContext.includes("weakness")
  );
}

function isConstructiveSymbolMarketContext(data: MarketContextResponse) {
  const { combinedContext, marketContext } = data.context;

  return (
    combinedContext === "bull_trend_continuation" ||
    (marketContext.includes("risk_on") && !isRiskOrientedSymbolMarketContext(data))
  );
}

function isMixedSymbolMarketContext(data: MarketContextResponse) {
  const { combinedContext, structuralContext, marketContext, tacticalContext } =
    data.context;

  return [combinedContext, structuralContext, marketContext, tacticalContext].some(
    (value) => value.includes("mixed"),
  );
}

function hasHigherTimeframeRisk({
  selectedTimeframe,
  timeframeSnapshots,
}: {
  selectedTimeframe: string;
  timeframeSnapshots?: Array<{
    timeframe?: string | null;
    resultGroup?: string | null;
  }> | null;
}) {
  const selectedRank = getSymbolResearchTimeframeRank(selectedTimeframe);

  if (selectedRank === null) {
    return false;
  }

  return Boolean(
    timeframeSnapshots?.some((snapshot) => {
      const snapshotRank = getSymbolResearchTimeframeRank(snapshot.timeframe);

      return (
        snapshotRank !== null &&
        snapshotRank > selectedRank &&
        normalizeSymbolMarketContextGroup(snapshot.resultGroup) === "risk"
      );
    }),
  );
}

function getSymbolResearchTimeframeRank(value: string | null | undefined) {
  switch (value?.trim().toLowerCase()) {
    case "1h":
      return 0;
    case "4h":
      return 1;
    case "1d":
      return 2;
    case "1w":
      return 3;
    default:
      return null;
  }
}

export function buildScannerReturnHref(
  searchParamsOrState?: QueryStateInput,
  fallback?: { timeframe?: string | null; assetClass?: string | null },
) {
  const params = new URLSearchParams();
  const requestedTimeframe =
    getQueryStateValue(searchParamsOrState, "timeframe")?.trim() ||
    fallback?.timeframe?.trim();
  const timeframe = requestedTimeframe
    ? normalizeSymbolResearchTimeframe(requestedTimeframe)
    : null;
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
  return buildSymbolResearchHref({
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

  return buildSymbolResearchHref({
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
  timeframeSelection,
  assetClass,
  scannerReturnHref,
  searchParams,
  isFetching,
  onSymbolSubmit,
  onExchangeChange,
  onRefresh,
  availabilityRows,
  extraStats = [],
  watchlistSymbol,
}: {
  exchange: string;
  symbol: string;
  timeframe: string;
  timeframeSelection?: SymbolResearchTimeframeSelection;
  assetClass?: string | null;
  scannerReturnHref: string;
  searchParams: QueryStateInput;
  isFetching: boolean;
  onSymbolSubmit: (value: string) => void;
  onExchangeChange: (value: string) => void;
  onRefresh: () => void;
  availabilityRows?: SymbolResearchTimeframeAvailabilityRow[];
  extraStats?: SymbolTerminalStat[];
  watchlistSymbol?: string;
}) {
  const [symbolInput, setSymbolInput] = useState(symbol);
  const normalizedExchange = exchange.toLowerCase();
  const exchangeValue = symbolResearchExchanges.includes(
    normalizedExchange as (typeof symbolResearchExchanges)[number],
  )
    ? normalizedExchange
    : "binance";
  const timeframeOptions = buildSymbolResearchTimeframeNavigation({
    timeframes: symbolResearchTimeframes,
    selectedTimeframe: timeframe,
    availabilityRows,
  });
  const commandStats: SymbolTerminalStat[] = [
    {
      label: "Symbol",
      value: symbol,
      tone: "accent",
    },
    {
      label: "TF",
      value: timeframe.toUpperCase(),
      tone: timeframeSelection?.fallbackReason === "invalid" ? "warning" : "accent",
    },
    {
      label: "Asset",
      value: assetClass ? toTitleCase(assetClass) : "Unknown",
      tone: "neutral",
    },
    ...extraStats,
  ];
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSymbolSubmit(symbolInput);
  };

  return (
    <section className="terminal-command-bar mb-1">
      <div className="terminal-command-row text-[var(--terminal-bar-muted)]">
        <div
          className="terminal-command-brand"
          title={`Symbol Research / ${symbol} / Selected timeframe: ${timeframe}`}
        >
          <h1 className="terminal-command-title">SYMBOL</h1>
          <label className="shrink-0">
            <span className="sr-only">Exchange</span>
            <select
              value={exchangeValue}
              onChange={(event) => onExchangeChange(event.target.value)}
              className="h-6 border border-white/15 bg-white/[0.05] px-1.5 font-mono text-[10px] uppercase text-[var(--terminal-bar-foreground)] outline-none focus:border-[var(--accent)]"
            >
              {symbolResearchExchanges.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <span className="sr-only">Selected timeframe: {timeframe}</span>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex min-w-[180px] max-w-[300px] flex-1 items-center gap-1"
        >
          <label className="min-w-0 flex-1">
            <span className="sr-only">Symbol</span>
            <input
              value={symbolInput}
              onChange={(event) => setSymbolInput(event.target.value)}
              className="h-6 w-full border border-white/15 bg-white/[0.05] px-2 font-mono text-[11px] text-[var(--terminal-bar-foreground)] outline-none placeholder:text-[var(--terminal-bar-muted)] focus:border-[var(--accent)]"
              placeholder="SEIUSDT"
            />
          </label>
          <button
            type="submit"
            className="terminal-command-action is-primary"
          >
            Open
          </button>
        </form>

        <nav
          aria-label="Timeframe quick switch"
          className="flex min-w-0 shrink-0 flex-wrap gap-1 text-xs"
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
              </Link>
            );
          })}
        </nav>

        <div className="terminal-command-main">
          {commandStats.map((stat) => (
            <SymbolTerminalCommandStat
              key={`${stat.label}-${stat.value}`}
              stat={stat}
            />
          ))}
        </div>

        <div className="terminal-command-actions">
          <Link
            href={scannerReturnHref}
            className="terminal-command-action"
          >
            Back to Scanner
          </Link>
          {watchlistSymbol ? (
            <SymbolWatchlistControl
              symbol={watchlistSymbol}
              className="flex flex-wrap items-center justify-end gap-1"
              variant="terminal"
            />
          ) : null}
          <RefreshIconButton
            onClick={onRefresh}
            disabled={isFetching}
            isRefreshing={isFetching}
            label="Refresh"
          />
        </div>
      </div>

      {timeframeSelection?.fallbackReason === "invalid" ? (
        <p className="border-t border-white/10 px-2 py-1 text-[11px] text-[var(--terminal-bar-muted)]">
          Fallback timeframe: {timeframe}. Requested timeframe{" "}
          {timeframeSelection.requestedTimeframe} is not supported.
        </p>
      ) : null}
    </section>
  );
}

function SymbolTerminalCommandStat({ stat }: { stat: SymbolTerminalStat }) {
  return (
    <div
      title={stat.title ?? `${stat.label}: ${stat.value}`}
      className={`inline-flex h-6 max-w-[220px] shrink-0 items-center gap-1.5 overflow-hidden border border-l-2 border-white/10 bg-white/[0.04] px-1.5 ${getSymbolTerminalToneBorderClass(
        stat.tone,
      )}`}
    >
      <span className="shrink-0 text-[9px] font-semibold uppercase text-[var(--terminal-bar-muted)]">
        {stat.label}
      </span>
      <span
        className={`min-w-0 truncate font-mono text-[10px] font-semibold leading-4 ${getSymbolTerminalToneTextClass(
          stat.tone,
        )}`}
      >
        {stat.value}
      </span>
    </div>
  );
}

export function SymbolWatchlistControl({
  symbol,
  storage,
  className = "mb-2 flex flex-wrap items-center gap-2 md:justify-end",
  variant = "default",
}: {
  symbol: string;
  storage?: WatchlistStorage | null;
  className?: string;
  variant?: "default" | "terminal";
}) {
  const normalizedSymbol = normalizeWatchlistSymbol(symbol) ?? symbol.toUpperCase();
  const initialStorage = storage === undefined ? null : storage;
  const [watchlistSymbols, setWatchlistSymbols] = useState(() =>
    loadWatchlistSymbols(initialStorage),
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const inWatchlist = isSymbolInWatchlist(watchlistSymbols, normalizedSymbol);
  const isTerminal = variant === "terminal";
  const actionClassName = isTerminal
    ? "terminal-command-action"
    : "ui-button h-7 px-2 text-[11px]";
  const savedClassName = isTerminal
    ? "terminal-command-chip border-[var(--positive-border)] bg-[var(--positive-bg)] text-[var(--positive)]"
    : "border border-[var(--positive-border)] bg-[var(--positive-bg)] px-2 py-1 text-[11px] font-semibold text-[var(--positive)]";
  const statusClassName = isTerminal
    ? "basis-full text-[11px] text-[var(--terminal-bar-muted)] md:text-right"
    : "basis-full text-[11px] text-[var(--muted)] md:text-right";

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
    <div className={className}>
      {inWatchlist ? (
        <span className={savedClassName}>
          In Watchlist
        </span>
      ) : (
        <button
          type="button"
          onClick={addToWatchlist}
          className={actionClassName}
        >
          Add to Watchlist
        </button>
      )}
      <Link
        href="/watchlist"
        className={actionClassName}
      >
        Open Watchlist
      </Link>
      {statusMessage ? (
        <span className={statusClassName}>
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
    "inline-flex h-6 items-center gap-1.5 border px-2 text-[10px] font-semibold";

  if (option.status === "planned") {
    return `${base} border-white/10 bg-white/[0.03] text-[var(--terminal-bar-muted)] opacity-70`;
  }

  if (option.status === "selected_unavailable") {
    return `${base} border-[var(--warning-border)] bg-[var(--warning-bg)] text-[var(--warning)] hover:border-[var(--warning)]`;
  }

  if (option.status === "unavailable") {
    return `${base} border-white/10 bg-white/[0.03] text-[var(--terminal-bar-muted)] hover:border-[var(--warning-border)] hover:text-[var(--terminal-bar-foreground)]`;
  }

  if (option.isSelected) {
    return `${base} border-[var(--accent-border)] bg-white/[0.08] text-[var(--accent)] shadow-[inset_0_-2px_0_var(--accent)]`;
  }

  return `${base} border-white/10 bg-white/[0.03] text-[var(--terminal-bar-muted)] hover:border-[var(--accent-border)] hover:text-[var(--terminal-bar-foreground)]`;
}

function getSymbolTerminalToneBorderClass(tone: SymbolTerminalTone) {
  switch (tone) {
    case "eligible":
    case "complete":
      return "border-l-[var(--eligible)]";
    case "watch":
      return "border-l-[var(--watch)]";
    case "repair":
      return "border-l-[var(--repair)]";
    case "risk":
      return "border-l-[var(--risk)]";
    case "warning":
      return "border-l-[var(--overheated)]";
    case "accent":
      return "border-l-[var(--accent)]";
    case "missing":
      return "border-l-[var(--missing)]";
    default:
      return "border-l-[var(--neutral)]";
  }
}

function getSymbolTerminalToneTextClass(tone: SymbolTerminalTone) {
  switch (tone) {
    case "eligible":
    case "complete":
      return "text-[var(--eligible)]";
    case "watch":
      return "text-[var(--watch)]";
    case "repair":
      return "text-[var(--repair)]";
    case "risk":
      return "text-[var(--risk)]";
    case "warning":
      return "text-[var(--overheated)]";
    case "accent":
      return "text-[var(--accent)]";
    case "missing":
      return "text-[var(--missing)]";
    default:
      return "text-[var(--terminal-bar-muted)]";
  }
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
    <section className="terminal-panel border-l-4 border-l-[var(--accent)] px-4 py-6">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">{message}</p>
      {loading ? (
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <div className="terminal-panel-muted h-12" />
          <div className="terminal-panel-muted h-12" />
          <div className="terminal-panel-muted h-12" />
        </div>
      ) : null}
      {apiOrigin ? (
        <p className="mt-3 text-xs text-[var(--muted)]">API origin: {apiOrigin}</p>
      ) : null}
      {scannerReturnHref ? (
        <Link
          href={scannerReturnHref}
          className="ui-button mt-4 h-8 px-3 text-xs"
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
    <section className="terminal-panel border-l-4 border-l-[var(--warning)] px-4 py-5">
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

      <div className="terminal-panel mt-5 px-3 py-3">
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

function DecisionHeader({
  symbol,
  selectedTimeframe,
  interpretation,
  scoreBreakdown,
  qualityTier,
  latestScanTime,
  stance,
  primaryReason,
  dictionary,
}: {
  symbol: string;
  selectedTimeframe: string;
  interpretation: ReturnType<typeof getSymbolResearchInterpretation>;
  scoreBreakdown: ReturnType<typeof getSymbolResearchScoreBreakdown>;
  qualityTier?: string | null;
  latestScanTime?: string | null;
  stance: string;
  primaryReason: string;
  dictionary: SymbolResearchDisplayDictionary;
}) {
  const groupToneClass = getSymbolPostureToneClass(interpretation.group);

  return (
    <section
      className={`terminal-panel mb-1 border-l-4 px-2 py-1.5 ${groupToneClass}`}
      title={primaryReason}
    >
      <div className="flex min-w-0 items-center gap-2 overflow-x-auto whitespace-nowrap">
        <div className="flex min-w-0 shrink-0 items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">
            Decision
          </span>
          <span className="font-mono text-base font-semibold text-[var(--foreground)]">
            {symbol}
          </span>
          <span className="font-mono text-xs font-semibold text-[var(--muted)]">
            {selectedTimeframe.toUpperCase()}
          </span>
          <span
            className={`border px-2 py-0.5 text-[10px] font-semibold uppercase ${getSymbolGroupBadgeClassName(
              interpretation.group,
            )}`}
          >
            {formatSymbolResearchGroupForDisplay(interpretation.group, dictionary)}
          </span>
        </div>

        <div className="min-w-[180px] max-w-[320px] flex-1 truncate text-sm font-semibold text-[var(--foreground)]">
          {stance}
        </div>

        <div className="flex min-w-0 shrink-0 items-center gap-3 text-[11px] text-[var(--muted)]">
          <DecisionInlineStat label="Primary" value={interpretation.label} />
          <DecisionInlineStat
            label="Rank"
            value={formatSymbolResearchScore(scoreBreakdown.rankScore)}
          />
          {qualityTier ? (
            <DecisionInlineStat label="Quality" value={toTitleCase(qualityTier)} />
          ) : null}
          {latestScanTime ? (
            <DecisionInlineStat
              label="Latest"
              value={formatSymbolResearchDateTime(latestScanTime)}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

function DecisionInlineStat({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex min-w-0 items-baseline gap-1">
      <span className="shrink-0 text-[10px] font-semibold uppercase text-[var(--muted-2)]">
        {label}
      </span>
      <span
        className="max-w-[200px] truncate font-mono text-[11px] font-semibold text-[var(--foreground)]"
        title={value}
      >
        {value}
      </span>
    </span>
  );
}

function getSymbolPostureToneClass(group: string | null | undefined) {
  const normalized = normalizeSymbolMarketContextGroup(group);

  if (normalized === "eligible") {
    return "border-[var(--eligible-border)] border-l-[var(--eligible)]";
  }

  if (normalized === "watch") {
    return "border-[var(--watch-border)] border-l-[var(--watch)]";
  }

  if (normalized === "risk") {
    return "border-[var(--risk-border)] border-l-[var(--risk)]";
  }

  if (normalized === "overheated") {
    return "border-[var(--overheated-border)] border-l-[var(--overheated)]";
  }

  return "border-[var(--border)] border-l-[var(--neutral)]";
}

function WhyThisStatePanel({
  positiveEvidence,
  risksAndLimits,
  scoreBreakdown,
}: {
  positiveEvidence: string[];
  risksAndLimits: string[];
  scoreBreakdown: ReturnType<typeof getSymbolResearchScoreBreakdown>;
}) {
  return (
    <WorkspacePanel title="Why">
      <div className="mb-2 grid grid-cols-3 gap-1.5">
        <MiniMetric label="Rank" value={formatSymbolResearchScore(scoreBreakdown.rankScore)} />
        <MiniMetric
          label="Confirm"
          value={formatSymbolResearchScore(scoreBreakdown.confirmationScore)}
        />
        <MiniMetric label="Risk" value={formatSymbolResearchScore(scoreBreakdown.riskScore)} />
      </div>
      <EvidenceList title="Positive" values={positiveEvidence} />
      <EvidenceList title="Limits" values={risksAndLimits} className="mt-2" />
    </WorkspacePanel>
  );
}

function EvidenceList({
  title,
  values,
  className = "",
}: {
  title: string;
  values: string[];
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <h3 className="text-[11px] font-semibold uppercase text-[var(--muted)]">
        {title}
      </h3>
      <ul className="mt-1.5 space-y-1 text-[12px] text-[var(--foreground)]">
        {values.map((value) => (
          <li key={value} className="border-l border-[var(--border-medium)] pl-2 leading-4">
            {value}
          </li>
        ))}
      </ul>
    </div>
  );
}

function NextChecksPanel({ items }: { items: string[] }) {
  const primaryItems = items.slice(0, 4);

  return (
    <WorkspacePanel title="Check next">
      <ul className="space-y-1 text-[12px] text-[var(--foreground)]">
        {primaryItems.map((item) => (
          <li
            key={item}
            className="terminal-panel-muted px-2 py-1.5 leading-4"
          >
            {item}
          </li>
        ))}
      </ul>
    </WorkspacePanel>
  );
}

function MtfContextStrip({
  snapshots,
  selectedTimeframe,
  className = "",
  dictionary,
}: {
  snapshots: Array<{
    timeframe?: string | null;
    resultGroup?: string | null;
    rankScore?: number | null;
  }>;
  selectedTimeframe: string;
  className?: string;
  dictionary: SymbolResearchDisplayDictionary;
}) {
  const orderedSnapshots = orderTimeframeSnapshots(snapshots);

  return (
    <section
      className={`terminal-panel flex min-h-8 min-w-0 items-center gap-1.5 overflow-x-auto px-2 py-1 ${className}`}
    >
      <span className="shrink-0 text-[10px] font-semibold uppercase text-[var(--muted)]">
        MTF
      </span>
      {orderedSnapshots.length > 0 ? (
        <div className="flex min-w-0 items-center gap-1">
          {orderedSnapshots.map((snapshot) => {
            const timeframe = snapshot.timeframe || "Unknown";
            const isSelected =
              timeframe.toLowerCase() === selectedTimeframe.toLowerCase();

            return (
              <div
                key={`${timeframe}-${snapshot.resultGroup ?? "missing"}`}
                className={`inline-flex h-6 shrink-0 items-center gap-1.5 border px-1.5 ${getMtfContextCellClassName(
                  snapshot.resultGroup,
                  isSelected,
                )}`}
              >
                {isSelected ? (
                  <span className="text-[9px] font-semibold uppercase text-[var(--muted)]">
                    Sel
                  </span>
                ) : null}
                <span className="font-mono text-[11px] font-semibold uppercase">
                  {timeframe}
                </span>
                <span className="text-[11px] font-semibold">
                  {formatSymbolResearchGroupForDisplay(
                    snapshot.resultGroup,
                    dictionary,
                  )}
                </span>
                <span className="font-mono text-[11px] font-semibold">
                  {formatSymbolResearchScore(snapshot.rankScore)}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-[var(--muted)]">
          MTF context is not available for this symbol.
        </p>
      )}
    </section>
  );
}

function HistoricalEvidenceSummaryPanel({
  behavior,
  evaluation,
  sampleQuality,
  signalEvaluationReadout,
}: {
  behavior?: SymbolBehavior | null;
  evaluation: HistoricalFollowThroughEvaluation;
  sampleQuality?: BehaviorSampleQualityReadout | null;
  signalEvaluationReadout: SignalEvaluationReadout;
}) {
  const summaryParts = [
    formatHistoricalBehaviorSample(behavior, evaluation),
    evaluation.selectedHorizonLabel,
    evaluation.medianReturnLabel,
    evaluation.positiveRateLabel,
    sampleQuality?.sampleQualityLabel ?? evaluation.sampleConfidenceLabel,
  ].filter((value) => value && value !== "Not available");

  return (
    <WorkspacePanel title="History">
      <div className="grid grid-cols-2 gap-1.5 text-[12px]">
        {summaryParts.slice(0, 4).map((part) => (
          <div
            key={part}
            className="terminal-panel-muted min-w-0 px-2 py-1 font-semibold text-[var(--foreground)]"
            title={part}
          >
            {part}
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <MiniMetric label="Match" value={evaluation.directionMatchLabel} />
        <MiniMetric
          label="Broad"
          value={
            signalEvaluationReadout.available
              ? signalEvaluationReadout.medianReturn
              : "N/A"
          }
        />
      </div>
    </WorkspacePanel>
  );
}

function WorkspacePanel({
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
      className={`terminal-panel min-w-0 px-2.5 py-2 ${className}`}
    >
      <h2 className="mb-2 border-b border-[var(--border)] pb-1 text-[11px] font-semibold uppercase text-[var(--foreground)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="terminal-panel-muted min-w-0 px-2 py-1">
      <div className="text-[9px] font-semibold uppercase text-[var(--muted)]">
        {label}
      </div>
      <div
        className="mt-0.5 truncate font-mono text-[11px] font-semibold text-[var(--foreground)]"
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

function SignalEvaluationPanel({
  readout,
  isLoading,
  isError,
  className = "",
}: {
  readout: SignalEvaluationReadout;
  isLoading?: boolean;
  isError?: boolean;
  className?: string;
}) {
  return (
    <Panel title="Signal Evaluation" className={className}>
      <p className="mb-3 max-w-3xl text-sm text-[var(--muted)]">
        Across the broader market, how this signal type has behaved historically.
        Separate from this symbol&apos;s own history.
      </p>
      {isLoading ? (
        <p className="text-sm text-[var(--muted)]">
          Loading broad-market signal evaluation...
        </p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <Fact
              label="Historical Orientation"
              value={readout.expectedDirectionLabel}
            />
            <Fact label="Sample Quality" value={readout.sampleQualityLabel} />
            <Fact label="Source Signals" value={readout.sourceSignals} />
            <Fact label="Completed Signals" value={readout.completedSignals} />
            <Fact label="Selected Horizon" value={readout.selectedHorizonLabel} />
            <Fact label="Historical Median Return" value={readout.medianReturn} />
            <Fact label="Historical Match Rate" value={readout.directionMatchRate} />
            <Fact label="Historical Positive Rate" value={readout.positiveRate} />
          </div>
          <div
            className={`mt-3 border border-l-4 px-3 py-2.5 text-sm ${
              isError || !readout.available
                ? "border-[var(--border)] border-l-[var(--neutral)] bg-[var(--panel)] text-[var(--muted)]"
                : "border-[var(--border)] border-l-[var(--info)] bg-[var(--panel)] text-[var(--foreground)]"
            }`}
          >
            <div className="text-[11px] uppercase text-[var(--muted)]">
              Research Interpretation
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
      className={`terminal-panel min-w-0 px-3 py-3 ${className}`}
    >
      <h2 className="mb-2 border-b border-[var(--border)] pb-1.5 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="terminal-panel-muted min-w-0 px-2 py-2">
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

function getSymbolResearchStance(group?: string | null) {
  switch (normalizeSymbolMarketContextGroup(group)) {
    case "eligible":
      return "Constructive, manual review required";
    case "watch":
      return "Developing, confirmation review required";
    case "risk":
      return "Risk-oriented, repair review required";
    case "overheated":
      return "Extended, caution review required";
    case "insufficient_history":
      return "Insufficient data for this timeframe";
    default:
      return "Mixed, review only";
  }
}

function getSymbolResearchPrimaryReason({
  interpretation,
  latestSignal,
  decisionSummary,
  selectedTimeframe,
  timeframeSnapshots,
}: {
  interpretation: ReturnType<typeof getSymbolResearchInterpretation>;
  latestSignal: SymbolResearchSignal;
  decisionSummary: ResearchDecisionSummary;
  selectedTimeframe: string;
  timeframeSnapshots: SymbolResearchSignal[];
}) {
  const group = normalizeSymbolMarketContextGroup(interpretation.group);
  const signal = formatSymbolSignalPhrase(interpretation.label);
  const signalSetup = formatSignalSetupPhrase(
    signal,
    latestSignal.primaryStructure,
  );
  const higherTimeframeText = getHigherTimeframeReasonText({
    selectedTimeframe,
    timeframeSnapshots,
  });

  if (group === "eligible") {
    return `${signalSetup} with ${higherTimeframeText}.`;
  }

  if (group === "watch") {
    return `${signalSetup}; confirmation remains incomplete.`;
  }

  if (group === "risk") {
    return `${signal} risk state; ${decisionSummary.keyCaution}`;
  }

  if (group === "overheated") {
    return `${signal} extended state; overextension risk is elevated.`;
  }

  if (group === "insufficient_history") {
    return "Not enough completed scanner history for this timeframe.";
  }

  return interpretation.statusNote || decisionSummary.currentStance;
}

function buildSymbolResearchEvidence({
  selectedTimeframe,
  interpretation,
  latestSignal,
  scoreBreakdown,
  decisionSummary,
  marketContextImplication,
  behaviorSampleQuality,
  showHistorySelectionNotice,
  dictionary,
}: {
  selectedTimeframe: string;
  interpretation: ReturnType<typeof getSymbolResearchInterpretation>;
  latestSignal: SymbolResearchSignal;
  scoreBreakdown: ReturnType<typeof getSymbolResearchScoreBreakdown>;
  decisionSummary: ResearchDecisionSummary;
  marketContextImplication: string;
  behaviorSampleQuality?: BehaviorSampleQualityReadout | null;
  showHistorySelectionNotice: boolean;
  dictionary: SymbolResearchDisplayDictionary;
}) {
  const positive = uniqueDisplayItems([
    `${selectedTimeframe.toUpperCase()} state is ${formatSymbolResearchGroupForDisplay(
      interpretation.group,
      dictionary,
    )}`,
    `Rank ${formatSymbolResearchScore(scoreBreakdown.rankScore)}`,
    `Confirmation ${formatSymbolResearchScore(scoreBreakdown.confirmationScore)}`,
    latestSignal.primaryStructure
      ? `${formatSymbolResearchSetup(latestSignal.primaryStructure, dictionary)} setup`
      : null,
    ...interpretation.reasons.slice(0, 2),
    decisionSummary.multiTimeframeAlignment,
    decisionSummary.behaviorSupport,
  ]);
  const risks = uniqueDisplayItems([
    formatScannerReviewValue("Manual review still required", dictionary),
    `Risk score ${formatSymbolResearchScore(scoreBreakdown.riskScore)}`,
    marketContextImplication,
    behaviorSampleQuality?.sampleQualityLabel,
    showHistorySelectionNotice ? "Newer secondary rows exist" : null,
    ...formatSymbolResearchList(latestSignal.detectedRiskTypes, dictionary).slice(0, 2),
  ]);

  return {
    positive: positive.slice(0, 6),
    risks: risks.slice(0, 6),
  };
}

function buildSymbolResearchNextChecks({
  selectedTimeframe,
  interpretation,
  researchSummary,
  timeframeSnapshots,
  dictionary,
}: {
  selectedTimeframe: string;
  interpretation: ReturnType<typeof getSymbolResearchInterpretation>;
  researchSummary: ReturnType<typeof buildSymbolResearchSummary>;
  timeframeSnapshots: SymbolResearchSignal[];
  dictionary: SymbolResearchDisplayDictionary;
}) {
  const higherTimeframeChecks = buildHigherTimeframeChecks(timeframeSnapshots);

  return uniqueDisplayItems([
    "Price stays above MA20 / MA50 context",
    `${selectedTimeframe.toUpperCase()} remains ${formatSymbolResearchGroupForDisplay(
      interpretation.group,
      dictionary,
    )} after the next scan`,
    ...higherTimeframeChecks,
    researchSummary.nextConfirmation[0],
    "Historical evidence supports follow-through",
    "BTC/ETH backdrop does not turn against the symbol",
    researchSummary.invalidation[0],
  ]).slice(0, 7);
}

function orderTimeframeSnapshots<
  T extends { timeframe?: string | null },
>(snapshots: T[]) {
  const rankByTimeframe = new Map([
    ["1h", 0],
    ["4h", 1],
    ["1d", 2],
    ["1w", 3],
  ]);

  return [...snapshots].sort((left, right) => {
    const leftRank = rankByTimeframe.get(left.timeframe?.toLowerCase() ?? "") ?? 99;
    const rightRank = rankByTimeframe.get(right.timeframe?.toLowerCase() ?? "") ?? 99;

    return leftRank - rightRank;
  });
}

function getMtfContextCellClassName(
  group: string | null | undefined,
  isSelected: boolean,
) {
  const selectedClass = isSelected ? "shadow-[inset_0_-2px_0_currentColor]" : "";

  switch (normalizeSymbolMarketContextGroup(group)) {
    case "eligible":
      return `border-[var(--eligible-border)] bg-[var(--eligible-bg)] text-[var(--eligible)] ${selectedClass}`;
    case "watch":
      return `border-[var(--watch-border)] bg-[var(--watch-bg)] text-[var(--watch)] ${selectedClass}`;
    case "risk":
      return `border-[var(--risk-border)] bg-[var(--risk-bg)] text-[var(--risk)] ${selectedClass}`;
    case "overheated":
      return `border-[var(--overheated-border)] bg-[var(--overheated-bg)] text-[var(--overheated)] ${selectedClass}`;
    case "insufficient_history":
      return `border-[var(--missing-border)] bg-[var(--missing-bg)] text-[var(--missing)] ${selectedClass}`;
    default:
      return `border-[var(--neutral-border)] bg-[var(--neutral-bg)] text-[var(--neutral)] ${selectedClass}`;
  }
}

function getSymbolGroupBadgeClassName(group: string | null | undefined) {
  switch (normalizeSymbolMarketContextGroup(group)) {
    case "eligible":
      return "border-[var(--eligible-border)] bg-[var(--eligible-bg)] text-[var(--eligible)]";
    case "watch":
      return "border-[var(--watch-border)] bg-[var(--watch-bg)] text-[var(--watch)]";
    case "risk":
      return "border-[var(--risk-border)] bg-[var(--risk-bg)] text-[var(--risk)]";
    case "overheated":
      return "border-[var(--overheated-border)] bg-[var(--overheated-bg)] text-[var(--overheated)]";
    case "insufficient_history":
      return "border-[var(--missing-border)] bg-[var(--missing-bg)] text-[var(--missing)]";
    default:
      return "border-[var(--neutral-border)] bg-[var(--neutral-bg)] text-[var(--neutral)]";
  }
}

function formatSymbolResearchGroupForDisplay(
  value: string | null | undefined,
  dictionary: SymbolResearchDisplayDictionary = dictionaries.en,
) {
  return normalizeSymbolMarketContextGroup(value) === "overheated"
    ? "Hot"
    : formatSymbolResearchGroup(value, dictionary);
}

function formatHistoricalBehaviorSample(
  behavior: SymbolBehavior | null | undefined,
  evaluation: HistoricalFollowThroughEvaluation,
) {
  if (behavior) {
    return `${formatBehaviorSampleSize(behavior.sampleSize)} similar setups`;
  }

  return evaluation.sampleLabel;
}

function buildHigherTimeframeChecks(timeframeSnapshots: SymbolResearchSignal[]) {
  const checks = [];
  const oneDay = timeframeSnapshots.find(
    (snapshot) => snapshot.timeframe?.toLowerCase() === "1d",
  );
  const oneWeek = timeframeSnapshots.find(
    (snapshot) => snapshot.timeframe?.toLowerCase() === "1w",
  );

  if (oneDay) {
    checks.push("1D does not shift into Risk");
  }

  if (oneWeek) {
    const group = normalizeSymbolMarketContextGroup(oneWeek.resultGroup);
    checks.push(
      group === "watch"
        ? "1W remains Watch or improves"
        : "1W does not shift into Risk",
    );
  }

  return checks.length > 0
    ? checks
    : ["Higher timeframe context remains available"];
}

function getHigherTimeframeReasonText({
  selectedTimeframe,
  timeframeSnapshots,
}: {
  selectedTimeframe: string;
  timeframeSnapshots: SymbolResearchSignal[];
}) {
  const selectedRank = getSymbolResearchTimeframeRank(selectedTimeframe);
  const hasHigherRisk = timeframeSnapshots.some((snapshot) => {
    const rank = getSymbolResearchTimeframeRank(snapshot.timeframe);

    return (
      selectedRank !== null &&
      rank !== null &&
      rank > selectedRank &&
      normalizeSymbolMarketContextGroup(snapshot.resultGroup) === "risk"
    );
  });

  if (hasHigherRisk) {
    return "higher-timeframe risk still present";
  }

  return timeframeSnapshots.length > 1
    ? "higher-timeframe context not in risk"
    : "selected timeframe evidence";
}

function formatSymbolSignalPhrase(value: string | null | undefined) {
  const label = value?.trim();

  if (!label || label.toLowerCase() === "unknown") {
    return "Current";
  }

  return toTitleCase(label);
}

function formatSignalSetupPhrase(
  signal: string,
  primaryStructure: string | null | undefined,
) {
  if (!primaryStructure) {
    return `${signal} selected setup`;
  }

  const setup = toTitleCase(primaryStructure);

  if (signal.toLowerCase().includes(setup.toLowerCase())) {
    return `${signal} setup`;
  }

  return `${signal} ${setup} setup`;
}

function uniqueDisplayItems(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const value of values) {
    const normalized = value?.trim();

    if (!normalized || normalized === "-") {
      continue;
    }

    const key = normalized.toLowerCase();

    if (!seen.has(key)) {
      seen.add(key);
      items.push(normalized);
    }
  }

  return items;
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
    <div className="overflow-x-auto bg-[var(--panel-data)]">
      <table className="w-full min-w-[760px] border-collapse text-left text-xs">
        <thead className="bg-[var(--table-header)] text-[10px] uppercase text-[var(--muted)]">
          <tr>
            {headers.map((header) => (
              <th key={header} className="border-b border-[var(--border-medium)] px-2 py-1.5">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${row[0]}-${index}`}
              className="border-t border-[var(--border)] odd:bg-[var(--panel-data)] even:bg-[var(--panel-muted)] hover:bg-[var(--row-hover)]"
            >
              {row.map((cell, cellIndex) => (
                <td
                  key={`${headers[cellIndex]}-${cell}`}
                  className="max-w-[220px] truncate px-2 py-1.5 text-[11px] text-[var(--muted)]"
                  title={cell}
                >
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
  dictionary: SymbolResearchDisplayDictionary = dictionaries.en,
) {
  const rawLabel = data.interpretation?.label ?? latestSignal.signalLabel;
  const rawAction =
    data.interpretation?.action ??
    latestSignal.actionBias ??
    latestSignal.statusNote ??
    "review_only";
  const rawSetupType =
    data.interpretation?.setupType ?? latestSignal.primaryStructure ?? "unknown";

  return {
    group: data.interpretation?.group ?? latestSignal.resultGroup ?? "neutral",
    label: formatSymbolResearchSignalLabel(rawLabel, dictionary),
    action: formatSymbolResearchAction(rawAction, dictionary),
    setupType: formatSymbolResearchSetup(rawSetupType, dictionary),
    statusNote: formatScannerReviewValue(
      data.interpretation?.statusNote ??
        latestSignal.statusNoteKey ??
        latestSignal.statusNote,
      dictionary,
      dictionary.scannerResultFallback.noStatusNote,
    ),
    reasons: (
      data.interpretation?.reasons ??
      latestSignal.statusReasonKeys ??
      latestSignal.statusReasons ??
      []
    ).map((reason) => formatScannerReviewValue(reason, dictionary)),
  };
}

function formatSymbolResearchSignalLabel(
  value: string | null | undefined,
  dictionary: SymbolResearchDisplayDictionary,
) {
  return formatSignalLabel(value, dictionary);
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
