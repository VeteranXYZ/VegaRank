"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { RefreshIconButton } from "@/components/ui/workspace";
import { useAppLanguage } from "@/lib/i18n/AppLanguageProvider";
import type { Language } from "@/lib/i18n/dictionaries";
import {
  buildArchiveHref,
  buildDefaultResearchReturnLink,
  buildRankingsHref,
  buildSourceAwareResearchReturnLink,
} from "@/lib/navigation/researchNavigation";
import {
  getVegaRankApiBaseUrl,
  getVegaRankApiOriginLabel,
} from "@/lib/runtime/vegaRankApi";
import { explainCode, explainCodes } from "@/lib/vegarank-codebook/explainCode";
import { resultGroupByGroupCode } from "@/lib/vegarank-codebook/codeRegistry";
import type { PublicStoredScannerSignal } from "@/lib/vegarank-codebook/serializeStoredSignal";
import { SymbolBehaviorPanel } from "./SymbolBehaviorPanel";
import { SymbolResearchChart } from "./SymbolResearchChart";
import { SymbolSignalTimeline } from "./SymbolSignalTimeline";
import {
  addWatchlistSymbol,
  isSymbolInWatchlist,
  loadWatchlistSymbols,
  normalizeWatchlistSymbol,
  removeWatchlistSymbol,
  saveWatchlistSymbols,
  type WatchlistStorage,
} from "@/components/watchlist/watchlistUi";
import { MarketContextPanel } from "@/components/market-context/MarketContextPanel";
import {
  fetchMarketContext,
  isMarketContextResponse,
  type MarketContextResponse,
} from "@/components/market-context/marketContextUi";
import {
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
  buildSymbolResearchDiagnostics,
  buildSymbolResearchTimeframeAvailability,
  buildSymbolResearchTimeframeNavigation,
  buildSymbolResearchUnavailableContent,
  formatSymbolResearchDateTime,
  formatSymbolResearchGroup,
  formatSymbolResearchPrice,
  formatSymbolResearchRunContext,
  formatSymbolResearchScore,
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
  type SymbolResearchDisplayDictionary,
} from "./symbolResearchUi";
import { dictionaries } from "@/lib/i18n/dictionaries";

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
  scanRunId: string;
  symbolId?: number;
  exchange: string;
  market: string;
  symbol: string;
  timeframe: string;
  assetClass?: string | null;
  scanTime?: string | null;
  candleOpenTime?: string | null;
  groupCode: PublicStoredScannerSignal["groupCode"];
  actionCode: PublicStoredScannerSignal["actionCode"];
  riskCode: PublicStoredScannerSignal["riskCode"];
  riskCodes: PublicStoredScannerSignal["riskCodes"];
  setupCode: PublicStoredScannerSignal["setupCode"];
  phaseCode: PublicStoredScannerSignal["phaseCode"];
  reasonCodes: PublicStoredScannerSignal["reasonCodes"];
  signalCodes: PublicStoredScannerSignal["signalCodes"];
  qualityCodes: PublicStoredScannerSignal["qualityCodes"];
  metrics: PublicStoredScannerSignal["metrics"];
  scannerVersion: string;
  codeSchemaVersion: string;
  dictionaryVersion: string;
  scoringVersion?: string | null;
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
    groupCode: string;
    actionCode: string;
    riskCode?: string | null;
    riskCodes: string[];
    setupCode: string;
    phaseCode?: string | null;
    reasonCodes: string[];
    signalCodes: string[];
    qualityCodes: string[];
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
  "symbol-terminal flex min-h-[calc(100dvh-var(--app-header-height))] w-full max-w-none flex-col overflow-x-hidden bg-[var(--workspace-background)] px-1.5 py-1.5 text-[var(--foreground)] sm:px-2 xl:h-full xl:min-h-0 xl:overflow-hidden";

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
  const { dictionary, language } = useAppLanguage();
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
  const researchReturnLink =
    visualCheckData?.scannerReturnHref
      ? {
          href: visualCheckData.scannerReturnHref,
          label: "Back to Rankings",
          source: "rankings" as const,
        }
      : buildSourceAwareResearchReturnLink(searchParams, {
          timeframe,
          assetClass,
        }) ??
        buildDefaultResearchReturnLink({
          timeframe,
          assetClass,
        });
  const scannerReturnHref = researchReturnLink.href;
  const scannerReturnLabel = researchReturnLink.label;
  const archiveHref = buildArchiveHref({
    timeframe,
    assetClass,
    symbol: normalizedSymbol,
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
          scannerReturnLabel={scannerReturnLabel}
          archiveHref={archiveHref}
          searchParams={searchParams}
          isFetching={isFetching}
          onSymbolSubmit={handleSymbolSubmit}
          onExchangeChange={handleExchangeChange}
          onRefresh={handleRefresh}
        />
        <ResearchState
          title="Symbol Research"
          message="Loading symbol research..."
          apiOrigin={apiOrigin}
          scannerReturnHref={scannerReturnHref}
          scannerReturnLabel={scannerReturnLabel}
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
          scannerReturnLabel={scannerReturnLabel}
          archiveHref={archiveHref}
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
          scannerReturnLabel={scannerReturnLabel}
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
          scannerReturnLabel={scannerReturnLabel}
          archiveHref={archiveHref}
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
          scannerReturnLabel={scannerReturnLabel}
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
          scannerReturnLabel={scannerReturnLabel}
          archiveHref={buildArchiveHref({
            timeframe: selectedTimeframe,
            assetClass: data.symbol?.assetClass ?? assetClass,
            symbol: unavailableSymbol,
          })}
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
          scannerReturnLabel={scannerReturnLabel}
          archiveHref={buildArchiveHref({
            timeframe: selectedTimeframe,
            assetClass: data.symbol.assetClass,
            symbol: data.symbol.symbol,
          })}
          searchParams={searchParams}
          isFetching={isFetching}
          onSymbolSubmit={handleSymbolSubmit}
          onExchangeChange={handleExchangeChange}
          onRefresh={handleRefresh}
        />
        <ResearchState
          title={data.symbol.symbol}
          message="No research snapshot is available for this symbol."
          apiOrigin={apiOrigin}
          scannerReturnHref={scannerReturnHref}
          scannerReturnLabel={scannerReturnLabel}
        />
      </main>
    );
  }

  const history = data.history ?? [];
  const timeframes = data.timeframes ?? [];
  const interpretation = getSymbolResearchInterpretation(
    data,
    latestSignal,
    language,
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
  const diagnostics = buildSymbolResearchDiagnostics({
    selectedTimeframe,
    currentSelection: data.currentSelection,
    latestSignal,
    history,
  });
  const signalEvaluationReadout = buildSignalEvaluationReadout(
    signalEvaluationData,
    {
      currentGroup: getSymbolResearchGroup(latestSignal),
      currentSignalLabel: null,
      timeframe: selectedTimeframe,
    },
  );
  const marketContextImplication = buildSymbolMarketContextImplication({
    data: marketContextData,
    isError: marketContextIsError,
    selectedGroup: getSymbolResearchGroup(latestSignal) ?? interpretation.group,
    selectedTimeframe,
    timeframeSnapshots,
  });
  const candleRowsNotice = getCandleRowsNotice(candles);
  const archiveSnapshotStatus = getArchiveSnapshotStatus(searchParams);
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
        <MarketContextPanel
          variant="compact"
          data={marketContextData}
          isLoading={marketContextIsLoading}
          isError={marketContextIsError}
          implication={marketContextImplication}
        />

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
              "Research Group",
              "Research Priority",
              "Rank Score",
              "Updated",
              "Run Context",
            ]}
            rows={timeframeSnapshots.map((item) => [
              formatSelectedTimeframeLabel(item.timeframe, selectedTimeframe),
              formatSymbolResearchGroup(getSymbolResearchGroup(item), dictionary),
              explainCode(item.actionCode, language).label,
              formatSymbolResearchScore(item.metrics.rankScore),
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
          scannerReturnLabel={scannerReturnLabel}
          archiveHref={buildArchiveHref({
            timeframe: selectedTimeframe,
            assetClass: data.symbol.assetClass,
            symbol: data.symbol.symbol,
          })}
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
      </div>

      <section className="grid min-w-0 flex-1 gap-2 xl:min-h-0 xl:grid-cols-[minmax(0,1.38fr)_minmax(330px,0.62fr)] xl:overflow-hidden">
        <div className="flex min-w-0 flex-col gap-2 xl:min-h-0 xl:overflow-hidden">
          <ResearchSnapshotPanel
            symbol={data.symbol.symbol}
            selectedTimeframe={selectedTimeframe}
            interpretation={interpretation}
            scoreBreakdown={scoreBreakdown}
            latestSignal={latestSignal}
            latestScanTime={data.latest?.scanRun?.finishedAt}
            qualityTier={data.symbol.qualityTier}
            language={language}
            dictionary={dictionary}
            className="shrink-0"
          />
          <MtfContextStrip
            snapshots={timeframeSnapshots}
            selectedTimeframe={selectedTimeframe}
            className="shrink-0"
            language={language}
          />
          <SymbolResearchChart
            exchange={exchange}
            symbol={data.symbol.symbol}
            timeframe={selectedTimeframe}
            candles={candles.rows}
            candleCount={candles.count}
            className="h-[420px] min-h-[360px] xl:h-auto xl:min-h-0 xl:flex-1"
            density="compact"
            latestSignal={{
              candleOpenTime: latestSignal.candleOpenTime,
              label: interpretation.label,
            }}
          />
        </div>

        <aside className="grid min-w-0 content-start gap-2 xl:min-h-0 xl:overflow-y-auto xl:overscroll-contain xl:pr-1">
          <EvidenceOverviewPanel
            latestSignal={latestSignal}
            scoreBreakdown={scoreBreakdown}
            language={language}
          />
          <ArchiveContextPanel
            archiveHref={buildArchiveHref({
              timeframe: selectedTimeframe,
              assetClass: data.symbol.assetClass,
              symbol: data.symbol.symbol,
            })}
            archiveSnapshotStatus={archiveSnapshotStatus}
            selectedTimeframe={selectedTimeframe}
            latestScanTime={data.latest?.scanRun?.finishedAt}
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
      "Unable to load symbol research. Check API base URL configuration and CORS.",
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

    throw new Error("Unable to load validation context.");
  }

  const body = (await response.json().catch(() => null)) as
    | SignalEvaluationResponse
    | null;

  if (!response.ok) {
    throw new Error("Validation context is currently unavailable.");
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

  return `${getVegaRankApiBaseUrl(tradeApiBaseUrl)}/api/symbol/research?${params.toString()}`;
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

  return `${getVegaRankApiBaseUrl(tradeApiBaseUrl)}/api/signal/evaluation?${params.toString()}`;
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
    groupCode?: SymbolResearchSignal["groupCode"];
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

    return `Supportive backdrop; symbol structure remains primary.${higherTimeframeRiskNote}`;
  }

  if (isMixedSymbolMarketContext(data)) {
    return `Mixed backdrop; symbol structure stays primary.${higherTimeframeRiskNote}`;
  }

  return `BTC/ETH backdrop available for the ${timeframe} review.${higherTimeframeRiskNote}`;
}

export function getTradeApiBaseUrl(
  value: string | null | undefined = process.env.NEXT_PUBLIC_TRADE_API_BASE_URL,
) {
  return getVegaRankApiBaseUrl(value);
}

export function getSymbolResearchApiOriginLabel(
  baseUrl?: string | null,
) {
  return getVegaRankApiOriginLabel(baseUrl);
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

function getSymbolResearchGroup(signal: {
  groupCode?: SymbolResearchSignal["groupCode"] | string | null;
}) {
  const code = signal.groupCode;

  return code && Object.prototype.hasOwnProperty.call(resultGroupByGroupCode, code)
    ? resultGroupByGroupCode[code as keyof typeof resultGroupByGroupCode]
    : "neutral";
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
    groupCode?: SymbolResearchSignal["groupCode"] | string | null;
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
        normalizeSymbolMarketContextGroup(
          snapshot.groupCode ? getSymbolResearchGroup(snapshot) : null,
        ) === "risk"
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
  return buildRankingsHref({
    timeframe:
      getQueryStateValue(searchParamsOrState, "timeframe") ??
      fallback?.timeframe ??
      null,
    assetClass:
      getQueryStateValue(searchParamsOrState, "assetClass") ??
      fallback?.assetClass ??
      null,
    group: getQueryStateValue(searchParamsOrState, "group"),
    risk: getQueryStateValue(searchParamsOrState, "risk"),
    sort: getQueryStateValue(searchParamsOrState, "sort"),
    q: getQueryStateValue(searchParamsOrState, "q"),
    includeLowQuality: getQueryStateValue(
      searchParamsOrState,
      "includeLowQuality",
    ),
    limit: getQueryStateValue(searchParamsOrState, "limit"),
  });
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
  scannerReturnLabel,
  archiveHref,
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
  scannerReturnLabel: string;
  archiveHref: string;
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
          <h1 className="terminal-command-title">Symbol Research</h1>
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
            Open Research
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
            {scannerReturnLabel}
          </Link>
          <Link
            href={archiveHref}
            className="terminal-command-action"
          >
            Review Archive
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
            label="Refresh Research"
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
  const removeFromWatchlist = () => {
    const targetStorage = resolveSymbolWatchlistStorage(storage);
    const currentSymbols = loadWatchlistSymbols(targetStorage);
    const nextSymbols = removeWatchlistSymbol(currentSymbols, normalizedSymbol);

    setWatchlistSymbols(nextSymbols);
    saveWatchlistSymbols(targetStorage, nextSymbols);
    setStatusMessage(
      targetStorage
        ? "Removed from watchlist."
        : "Storage unavailable. Removed in this view only.",
    );
  };

  return (
    <div className={className}>
      {inWatchlist ? (
        <>
          <span className={savedClassName}>
            In Watchlist
          </span>
          <button
            type="button"
            onClick={removeFromWatchlist}
            className={actionClassName}
          >
            Remove from Watchlist
          </button>
        </>
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
          "Research Group",
          "Research Priority",
          "Rank Score",
          "Updated",
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
  scannerReturnLabel = "Back to Rankings",
  loading = false,
}: {
  title: string;
  message: string;
  apiOrigin?: string;
  scannerReturnHref?: string;
  scannerReturnLabel?: string;
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
          {scannerReturnLabel}
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
        <h2 className="text-sm font-semibold">Suggested Review</h2>
        <ul className="mt-2 space-y-1.5 text-sm text-[var(--muted)]">
          {content.suggestions.map((suggestion) => (
            <li key={suggestion}>{suggestion}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ResearchSnapshotPanel({
  symbol,
  selectedTimeframe,
  interpretation,
  scoreBreakdown,
  latestSignal,
  latestScanTime,
  qualityTier,
  language,
  dictionary,
  className = "",
}: {
  symbol: string;
  selectedTimeframe: string;
  interpretation: ReturnType<typeof getSymbolResearchInterpretation>;
  scoreBreakdown: ReturnType<typeof getSymbolResearchScoreBreakdown>;
  latestSignal: SymbolResearchSignal;
  latestScanTime?: string | null;
  qualityTier?: string | null;
  language: Language;
  dictionary: SymbolResearchDisplayDictionary;
  className?: string;
}) {
  const riskCodes = getCodeEvidenceItems(latestSignal.riskCodes, language);
  const qualityCodes = getCodeEvidenceItems(latestSignal.qualityCodes, language);
  const snapshotMetrics = [
    {
      label: "Rank Score",
      value: formatSymbolResearchScore(scoreBreakdown.rankScore),
    },
    {
      label: "Confidence",
      value: formatSymbolResearchScore(
        firstFiniteNumber(
          latestSignal.metrics.confidenceScore,
          scoreBreakdown.confirmationScore,
        ),
      ),
    },
    {
      label: "Risk-Adjusted Score",
      value: formatSymbolResearchScore(
        firstFiniteNumber(
          latestSignal.metrics.riskAdjustedScore,
          scoreBreakdown.finalSignalScore,
        ),
      ),
    },
    {
      label: "Setup Quality",
      value: formatSymbolResearchScore(
        firstFiniteNumber(
          latestSignal.metrics.setupQualityScore,
          scoreBreakdown.opportunityScore,
        ),
      ),
    },
  ];
  const riskMetricRows = [
    {
      label: "Risk Context",
      value: formatSymbolResearchScore(
        firstFiniteNumber(latestSignal.metrics.riskPenalty, scoreBreakdown.riskScore),
      ),
    },
    {
      label: "Risk Codes",
      value:
        riskCodes.length > 0
          ? riskCodes.map((item) => item.label).join(", ")
          : "No additional risk codes",
    },
  ];
  const qualityLabel =
    qualityCodes.length > 0
      ? qualityCodes.map((item) => item.label).join(", ")
      : "No additional codes";

  return (
    <section
      className={`terminal-panel min-w-0 border-l-4 px-2.5 py-2 ${getSymbolPostureToneClass(
        interpretation.group,
      )} ${className}`}
    >
      <div className="mb-2 flex min-w-0 flex-wrap items-center gap-1.5 border-b border-[var(--border)] pb-1.5">
        <h2 className="shrink-0 text-[11px] font-semibold uppercase text-[var(--foreground)]">
          Research Snapshot
        </h2>
        <span className="font-mono text-sm font-semibold text-[var(--foreground)]">
          {symbol}
        </span>
        <span className="font-mono text-[11px] font-semibold uppercase text-[var(--muted)]">
          {selectedTimeframe}
        </span>
        <span
          className={`border px-2 py-0.5 text-[10px] font-semibold uppercase ${getSymbolGroupBadgeClassName(
            interpretation.group,
          )}`}
        >
          {formatSymbolResearchGroupForDisplay(interpretation.group, dictionary)}
        </span>
      </div>

      <div className="grid min-w-0 gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.78fr)]">
        <div className="grid min-w-0 gap-1.5 sm:grid-cols-2">
          <SnapshotFact
            label="Research Group"
            value={formatSymbolResearchGroupForDisplay(interpretation.group, dictionary)}
          />
          <SnapshotFact label="Action" value={interpretation.action} />
          <SnapshotFact label="Setup" value={interpretation.setupType} />
          <SnapshotFact label="Evidence Quality" value={qualityLabel} />
          <SnapshotFact label="Timeframe" value={selectedTimeframe.toUpperCase()} />
          <SnapshotFact
            label="Updated"
            value={formatSymbolResearchDateTime(latestScanTime)}
          />
          {qualityTier ? (
            <SnapshotFact label="Asset Quality" value={toTitleCase(qualityTier)} />
          ) : null}
        </div>

        <div className="terminal-panel-muted min-w-0 border-l-2 border-l-[var(--risk)] px-2 py-2">
          <div className="mb-1 text-[10px] font-semibold uppercase text-[var(--risk)]">
            Risk Context
          </div>
          <div className="grid gap-1.5">
            {riskMetricRows.map((row) => (
              <SnapshotFact key={row.label} label={row.label} value={row.value} />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-2 grid min-w-0 grid-cols-2 gap-1.5 md:grid-cols-4">
        {snapshotMetrics.map((metric) => (
          <MiniMetric
            key={metric.label}
            label={metric.label}
            value={metric.value}
          />
        ))}
      </div>
    </section>
  );
}

function SnapshotFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border border-[var(--border)] bg-[var(--panel-data)] px-2 py-1.5">
      <div className="text-[9px] font-semibold uppercase text-[var(--muted)]">
        {label}
      </div>
      <div
        className="mt-0.5 min-w-0 truncate text-[12px] font-semibold text-[var(--foreground)]"
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

function EvidenceOverviewPanel({
  latestSignal,
  scoreBreakdown,
  language,
}: {
  latestSignal: SymbolResearchSignal;
  scoreBreakdown: ReturnType<typeof getSymbolResearchScoreBreakdown>;
  language: Language;
}) {
  const sections = buildEvidenceOverviewSections({
    latestSignal,
    scoreBreakdown,
    language,
  });

  if (sections.length === 0) {
    return null;
  }

  return (
    <WorkspacePanel title="Evidence Overview">
      <div className="space-y-2">
        {sections.map((section) => (
          <EvidenceOverviewSectionView key={section.title} section={section} />
        ))}
      </div>
    </WorkspacePanel>
  );
}

type EvidenceOverviewSection = {
  title: string;
  codes: CodeEvidenceItem[];
  metrics: Array<{ label: string; value: string }>;
};

type CodeEvidenceItem = {
  key: string;
  label: string;
  short: string;
};

function EvidenceOverviewSectionView({
  section,
}: {
  section: EvidenceOverviewSection;
}) {
  return (
    <section className="min-w-0 border border-[var(--border)] bg-[var(--panel-data)] px-2 py-2">
      <h3 className="text-[10px] font-semibold uppercase text-[var(--muted)]">
        {section.title}
      </h3>
      {section.metrics.length > 0 ? (
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          {section.metrics.map((metric) => (
            <MiniMetric
              key={`${section.title}-${metric.label}`}
              label={metric.label}
              value={metric.value}
            />
          ))}
        </div>
      ) : null}
      {section.codes.length > 0 ? (
        <CodeEvidenceList items={section.codes} className="mt-1.5" />
      ) : null}
    </section>
  );
}

function CodeEvidenceList({
  items,
  className = "",
}: {
  items: CodeEvidenceItem[];
  className?: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <ul className={`space-y-1 ${className}`}>
      {items.map((item) => (
        <li
          key={item.key}
          className="min-w-0 border-l border-[var(--border-medium)] pl-2"
        >
          <div className="truncate text-[12px] font-semibold text-[var(--foreground)]">
            {item.label}
          </div>
          <p className="mt-0.5 text-[11px] leading-4 text-[var(--muted)]">
            {item.short}
          </p>
        </li>
      ))}
    </ul>
  );
}

function ArchiveContextPanel({
  archiveHref,
  archiveSnapshotStatus,
  selectedTimeframe,
  latestScanTime,
}: {
  archiveHref: string;
  archiveSnapshotStatus: string;
  selectedTimeframe: string;
  latestScanTime?: string | null;
}) {
  return (
    <WorkspacePanel title="Archive Context">
      <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-1">
        <SnapshotFact label="Archive Snapshot" value={archiveSnapshotStatus} />
        <SnapshotFact label="Timeframe" value={selectedTimeframe.toUpperCase()} />
        <SnapshotFact
          label="Current Updated"
          value={formatSymbolResearchDateTime(latestScanTime)}
        />
      </div>
      <Link href={archiveHref} className="ui-button mt-2 h-7 px-2 text-[11px]">
        Review Archive
      </Link>
    </WorkspacePanel>
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

function buildEvidenceOverviewSections({
  latestSignal,
  scoreBreakdown,
  language,
}: {
  latestSignal: SymbolResearchSignal;
  scoreBreakdown: ReturnType<typeof getSymbolResearchScoreBreakdown>;
  language: Language;
}): EvidenceOverviewSection[] {
  const metrics = latestSignal.metrics;
  const sections: EvidenceOverviewSection[] = [
    {
      title: "Structure & Setup",
      codes: getCodeEvidenceItems(
        uniqueDisplayItems([latestSignal.setupCode, latestSignal.phaseCode]),
        language,
      ),
      metrics: [
        {
          label: "Structure",
          value: formatSymbolResearchScore(scoreBreakdown.structureScore),
        },
        {
          label: "Trend",
          value: formatSymbolResearchScore(scoreBreakdown.trendScore),
        },
      ],
    },
    {
      title: "Evidence Codes",
      codes: getCodeEvidenceItems(
        uniqueDisplayItems([...latestSignal.signalCodes, ...latestSignal.reasonCodes]),
        language,
      ),
      metrics: [
        {
          label: "Momentum",
          value: formatSymbolResearchScore(scoreBreakdown.momentumScore),
        },
        {
          label: "Liquidity",
          value: formatSymbolResearchScore(scoreBreakdown.volumeScore),
        },
      ],
    },
    {
      title: "Data Quality",
      codes: getCodeEvidenceItems(latestSignal.qualityCodes, language),
      metrics: [
        {
          label: "Quality Score",
          value: formatSymbolResearchScore(metrics.qualityScore),
        },
        {
          label: "History Bars",
          value: formatIntegerMetric(metrics.historyBars),
        },
        {
          label: "Volatility",
          value: formatSymbolResearchScore(metrics.volatilityScore),
        },
        {
          label: "MTF Agreement",
          value: formatSymbolResearchScore(metrics.mtfAgreementScore),
        },
      ],
    },
  ];

  return sections.filter(
    (section) =>
      section.codes.length > 0 ||
      section.metrics.some((metric) => metric.value !== "N/A"),
  );
}

function getCodeEvidenceItems(
  codes: Array<string | null | undefined> | null | undefined,
  language: Language,
): CodeEvidenceItem[] {
  const seen = new Set<string>();

  return explainCodes(codes, language)
    .map((entry) => ({
      key: `${entry.label}-${entry.short}`,
      label: entry.label,
      short: entry.short,
    }))
    .filter((item) => {
      const key = item.key.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

function firstFiniteNumber(...values: Array<number | null | undefined>) {
  return values.find((value) => typeof value === "number" && Number.isFinite(value));
}

function formatIntegerMetric(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "N/A";
  }

  return Math.trunc(value).toLocaleString();
}

function getArchiveSnapshotStatus(searchParams: QueryStateInput) {
  const snapshotId = getQueryStateValue(searchParams, "snapshotId");
  const runId = getQueryStateValue(searchParams, "runId");

  if (snapshotId) {
    return `Snapshot ${snapshotId}`;
  }

  if (runId) {
    return `Run ${runId}`;
  }

  return "No archive snapshot available yet.";
}

function MtfContextStrip({
  snapshots,
  selectedTimeframe,
  className = "",
  language,
}: {
  snapshots: Array<{
    timeframe?: string | null;
    groupCode: SymbolResearchSignal["groupCode"];
    metrics: SymbolResearchSignal["metrics"];
  }>;
  selectedTimeframe: string;
  className?: string;
  language: Language;
}) {
  const orderedSnapshots = orderTimeframeSnapshots(snapshots);

  return (
    <section
      className={`terminal-panel flex min-h-8 min-w-0 items-center gap-1.5 overflow-x-auto px-2 py-1 ${className}`}
    >
      <span className="shrink-0 text-[10px] font-semibold uppercase text-[var(--muted)]">
        Multi-Timeframe
      </span>
      {orderedSnapshots.length > 0 ? (
        <div className="flex min-w-0 items-center gap-1">
          {orderedSnapshots.map((snapshot) => {
            const timeframe = snapshot.timeframe || "Unknown";
            const isSelected =
              timeframe.toLowerCase() === selectedTimeframe.toLowerCase();

            return (
              <div
                key={`${timeframe}-${snapshot.groupCode}`}
                className={`inline-flex h-6 shrink-0 items-center gap-1.5 border px-1.5 ${getMtfContextCellClassName(
                  getSymbolResearchGroup(snapshot),
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
                  {explainCode(snapshot.groupCode, language).label}
                </span>
                <span className="font-mono text-[11px] font-semibold">
                  {formatSymbolResearchScore(snapshot.metrics.rankScore)}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-[var(--muted)]">
          Multi-timeframe context is not available for this symbol.
        </p>
      )}
    </section>
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
    <Panel title="Validation" className={className}>
      <p className="mb-3 max-w-3xl text-sm text-[var(--muted)]">
        Across the broader market, how this ranking-result type has behaved
        across completed samples. Separate from this symbol&apos;s own behavior.
      </p>
      {isLoading ? (
        <p className="text-sm text-[var(--muted)]">
          Loading validation context...
        </p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <Fact
              label="Historical Orientation"
              value={readout.expectedDirectionLabel}
            />
            <Fact label="Sample Quality" value={readout.sampleQualityLabel} />
            <Fact label="Source Results" value={readout.sourceSignals} />
            <Fact label="Completed Results" value={readout.completedSignals} />
            <Fact label="Selected Horizon" value={readout.selectedHorizonLabel} />
            <Fact label="Median Change" value={readout.medianReturn} />
            <Fact label="Match Rate" value={readout.directionMatchRate} />
            <Fact label="Positive Rate" value={readout.positiveRate} />
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
  language: Language = "en",
) {
  const groupCode = data.interpretation?.groupCode ?? latestSignal.groupCode;
  const actionCode = data.interpretation?.actionCode ?? latestSignal.actionCode;
  const setupCode = data.interpretation?.setupCode ?? latestSignal.setupCode;
  const signalCodes =
    data.interpretation?.signalCodes?.length
      ? data.interpretation.signalCodes
      : latestSignal.signalCodes ?? [];
  const reasonCodes =
    data.interpretation?.reasonCodes?.length
      ? data.interpretation.reasonCodes
      : latestSignal.reasonCodes ?? [];
  const signalCode = signalCodes[0] ?? latestSignal.phaseCode;
  const actionExplanation = explainCode(actionCode, language);

  return {
    group: getSymbolResearchGroup({ groupCode }),
    groupCode,
    label: explainCode(signalCode, language).label,
    action: actionExplanation.label,
    setupType: explainCode(setupCode, language).label,
    statusNote: actionExplanation.short,
    reasons: explainCodes(reasonCodes, language).map((reason) => reason.label),
  };
}

function getSymbolResearchScoreBreakdown(
  data: SymbolResearchSuccessResponse,
  latestSignal: SymbolResearchSignal,
) {
  return {
    rankScore: data.scoreBreakdown?.rankScore ?? latestSignal.metrics.rankScore,
    finalSignalScore:
      data.scoreBreakdown?.finalSignalScore ?? latestSignal.metrics.finalSignalScore,
    opportunityScore:
      data.scoreBreakdown?.opportunityScore ?? latestSignal.metrics.opportunityScore,
    confirmationScore:
      data.scoreBreakdown?.confirmationScore ?? latestSignal.metrics.confirmationScore,
    riskScore: data.scoreBreakdown?.riskScore ?? latestSignal.metrics.riskScore,
    trendScore: data.scoreBreakdown?.trendScore ?? latestSignal.metrics.trendScore,
    momentumScore:
      data.scoreBreakdown?.momentumScore ?? latestSignal.metrics.momentumScore,
    volumeScore: data.scoreBreakdown?.volumeScore ?? latestSignal.metrics.volumeScore,
    structureScore:
      data.scoreBreakdown?.structureScore ?? latestSignal.metrics.structureScore,
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
    group: null,
    signalLabel: null,
    tradeApiBaseUrl,
  };
}

function getSymbolResearchNavigationState(searchParams?: QueryStateInput) {
  return {
    assetClass: getQueryStateValue(searchParams, "assetClass"),
    includeLowQuality: getQueryStateValue(searchParams, "includeLowQuality"),
    limit: getQueryStateValue(searchParams, "limit"),
    from: getQueryStateValue(searchParams, "from"),
    group: getQueryStateValue(searchParams, "group"),
    risk: getQueryStateValue(searchParams, "risk"),
    sort: getQueryStateValue(searchParams, "sort"),
    q: getQueryStateValue(searchParams, "q"),
    runId: getQueryStateValue(searchParams, "runId"),
    snapshotId: getQueryStateValue(searchParams, "snapshotId"),
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
      return "Symbol not found in the VegaRank universe.";
    case "NO_LATEST_SIGNAL":
      return "No ranking result is available for this symbol/timeframe from the selected latest run.";
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
