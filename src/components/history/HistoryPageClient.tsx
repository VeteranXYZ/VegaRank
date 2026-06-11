"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useAppLanguage } from "@/lib/i18n/AppLanguageProvider";
import {
  formatGroupLabel,
  formatScore,
  formatSignalLabel,
  normalizeGroupKey,
  type ScannerDisplayDictionary,
} from "@/components/scanner/latestScanUi";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { formatScannerReviewValue } from "@/lib/i18n/formatScannerObservation";
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
import { buildSymbolResearchHref } from "@/components/symbol/symbolResearchLinks";
import {
  PageShell,
  RefreshIconButton,
  StatusBadge,
  type StatusTone,
} from "@/components/ui/workspace";
import { formatDisplayDateTime } from "@/lib/utils/format";
import { getVegaRankApiBaseUrl } from "@/lib/runtime/vegaRankApi";
import {
  buildObservationSummary,
  type ObservationGroupSummary,
  type ObservationNotableExample,
  type ObservationSummary,
} from "./historyObservationSummary";

const HISTORY_TIMEFRAMES = ["1h", "4h", "1d", "1w"] as const;
const OBSERVATION_WINDOWS = [1, 3, 5, 10] as const;
const assetClass = "crypto";
const snapshotsLimit = 25;
const maxObservationProbeRuns = 12;
const emptyHistoricalSnapshotRuns: HistoricalSnapshotRun[] = [];
const emptyHistoricalObservationRows: HistoricalSnapshotObservationRow[] = [];
const historySnapshotsQueryName = "history-snapshots";
const historySnapshotQueryName = "history-snapshot";
const historyObservationReadinessQueryName =
  "history-observation-readiness";
const historySnapshotObservationsQueryName =
  "history-snapshot-observations";
const historyCompactControlStyle = { fontSize: "10px", lineHeight: 1 };
export const recentRunsPanelClassName =
  "terminal-panel xl:flex xl:min-h-0 xl:flex-col xl:overflow-hidden";
export const recentRunsScrollContainerClassName =
  "space-y-0.5 p-1 pr-1 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:overscroll-contain";
const unsafePrimarySignalLabelMap: Record<string, string> = {
  "do not chase": "Overheated caution",
  avoid: "Risk review",
};

type HistoryTimeframe = (typeof HISTORY_TIMEFRAMES)[number];
type ObservationWindow = (typeof OBSERVATION_WINDOWS)[number];
type ObservationDataStatus = "complete" | "partial" | "missing";
type ObservationRowsDataStatusFilter = "all" | ObservationDataStatus;
type ObservationRowsGroupFilter =
  | "all"
  | "eligible"
  | "watch"
  | "overheated"
  | "risk"
  | "neutral";
type HistoryTerminalTone =
  | "accent"
  | "complete"
  | "partial"
  | "missing"
  | "neutral"
  | "risk"
  | "watch";
export type ObservationRowsSortKey =
  | "symbol"
  | "group"
  | "label"
  | "rank_score"
  | "anchor_close"
  | "observed_close"
  | "observed_change"
  | "max_drawdown"
  | "data_status";
export type SnapshotRowsSortKey =
  | "index"
  | "symbol"
  | "market"
  | "group"
  | "label"
  | "rank_score";
type SnapshotIndexedRow = {
  row: HistoricalSnapshotRow;
  sourceIndex: number;
};
type ObservationReadinessBlocker =
  | "observable"
  | "time_maturity"
  | "market_data_coverage"
  | "mixed"
  | "unavailable"
  | "no_runs";
type ObservationDiagnosticBlocker =
  | "observable"
  | "waiting_for_future_candles"
  | "stale_market_data"
  | "unavailable"
  | "no_runs";
type HistoricalObservationReadinessState =
  | "ready"
  | "not_ready"
  | "unavailable";
type ForwardObservationMaturityState =
  | "ready"
  | "not_ready"
  | "empty_or_unavailable";
type ForwardObservationSelectionMode =
  | "selected"
  | "observable"
  | "not_ready"
  | "unavailable";
type ForwardObservationUiStatus =
  | "loading_readiness"
  | "readiness_unavailable"
  | "not_ready_for_selected_run"
  | "no_observable_run"
  | "using_selected_run"
  | "using_recommended_observable_run"
  | "loading_observation_rows"
  | "observation_ready"
  | "observation_ready_summary_missing"
  | "observation_empty"
  | "observation_rows_error";
type HistoricalSnapshotObservationSummary = {
  totalRows: number;
  returnedRows: number;
  completeCount: number;
  partialCount: number;
  missingCount: number;
  window: ObservationWindow;
  timeframe: HistoryTimeframe;
  runId: string;
};
type ForwardObservationSummary = {
  window: ObservationWindow;
  timeframe: HistoryTimeframe;
  rowCount: number;
  totalRows: number;
  returnedRows: number;
  completeCount: number;
  partialCount: number;
  missingCount: number;
};
type ForwardObservationUiState = {
  status: ForwardObservationUiStatus;
  selectionMode: ForwardObservationSelectionMode;
  blocker: ObservationReadinessBlocker | null;
  selectedRun: HistoricalSnapshotRun | null;
  observationRun: HistoricalSnapshotRun | null;
  summary: ForwardObservationSummary | null;
  maturity: ForwardObservationMaturity;
  readinessError: string | null;
  observationRowsError: string | null;
  isFetching: boolean;
};

type HistoricalSnapshotRun = {
  runId: string;
  timeframe: HistoryTimeframe;
  status: "success";
  universe?: string | null;
  exchange?: string | null;
  market?: string | null;
  symbolsTotal?: number | null;
  symbolsScanned?: number | null;
  signalsCreated?: number | null;
  skipped?: number | null;
  failedSymbols?: number | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  isLikelyFullUniverse?: boolean | null;
  fullUniverseMinExpectedSymbols?: number | null;
  params?: unknown;
  scannerVersion?: string | null;
  scoringVersion?: string | null;
};

type HistoricalSnapshotRow = {
  id: string;
  scanRunId: string;
  symbol: string;
  exchange?: string | null;
  market?: string | null;
  timeframe: HistoryTimeframe;
  scanTime?: string | null;
  candleOpenTime?: string | null;
  priceAtSignal?: number | null;
  group?: string | null;
  label?: string | null;
  primarySignal?: string | null;
  reviewTier?: string | null;
  riskNotes?: string | null;
  riskTypes?: string[];
  rankScore?: number | null;
  componentScores?: {
    finalSignalScore?: number | null;
    opportunityScore?: number | null;
    confirmationScore?: number | null;
    riskScore?: number | null;
    trendScore?: number | null;
    momentumScore?: number | null;
    volumeScore?: number | null;
    structureScore?: number | null;
  };
  actionBias?: string | null;
  primaryStructure?: string | null;
  scannerVersion?: string | null;
  scoringVersion?: string | null;
};

type HistoricalSnapshotsResponse = {
  ok: boolean;
  snapshots: HistoricalSnapshotRun[];
  metadata: {
    timeframe: HistoryTimeframe;
    assetClass: string;
    count: number;
    limit?: number;
    disclaimer: string;
  };
};

type HistoricalSnapshotDetailResponse = {
  ok: boolean;
  run: HistoricalSnapshotRun;
  rows: HistoricalSnapshotRow[];
  metadata: {
    rowCount: number;
    limited: boolean;
    timeframe: HistoryTimeframe;
    assetClass: string;
    disclaimer: string;
  };
};

type HistoricalSnapshotObservationRow = {
  id: string;
  scanRunId: string;
  symbol: string;
  exchange?: string | null;
  market?: string | null;
  timeframe: HistoryTimeframe;
  group?: string | null;
  label?: string | null;
  primarySignal?: string | null;
  rankScore?: number | null;
  anchorTime?: string | null;
  anchorClose?: number | null;
  anchorSource?: "stored_signal" | "nearest_prior_candle" | "unavailable";
  latestMarketOpenTime?: string | null;
  window: ObservationWindow;
  observedClose?: number | null;
  observedChangePct?: number | null;
  maxDrawdownPct?: number | null;
  dataStatus: ObservationDataStatus;
  missingReason?: string | null;
};

type HistoricalSnapshotObservationsResponse = {
  ok: boolean;
  run: HistoricalSnapshotRun;
  rows: HistoricalSnapshotObservationRow[];
  summary?: HistoricalSnapshotObservationSummary | null;
  metadata: {
    window: ObservationWindow;
    selectedWindow: ObservationWindow;
    windowUnit: "completed_candles";
    rowCount: number;
    completeCount: number;
    partialCount: number;
    missingCount: number;
    limited: boolean;
    timeframe: HistoryTimeframe;
    assetClass: string;
    disclaimer: string;
  };
};

type HistoricalObservationCoverage = {
  timeframe: HistoryTimeframe;
  assetClass: string;
  totalSymbols: number;
  symbolsWithCandles: number;
  latestOpenTime: string | null;
  latestOpenTimeSymbolCount: number;
  latestOpenTimeCoveragePct?: number | null;
  buckets: Array<{
    latestOpenTime: string | null;
    symbolCount: number;
  }>;
};

type HistoricalObservationReadinessRun = {
  run: HistoricalSnapshotRun;
  state: HistoricalObservationReadinessState;
  blocker: ObservationReadinessBlocker;
  diagnosticBlocker?: ObservationDiagnosticBlocker | null;
  isObservable: boolean;
  isLimited: boolean;
  rowCount: number;
  completeCount: number;
  partialCount: number;
  missingCount: number;
  dominantMissingReason: string | null;
  dominantMissingReasonCount: number;
  latestAnchorTime: string | null;
  expectedCompleteTime: string | null;
  latestCoverageTime?: string | null;
  coverageLagMs?: number | null;
  coverageLagCandles?: number | null;
};

type HistoricalObservationReadinessResponse = {
  ok: boolean;
  selectedRun: HistoricalObservationReadinessRun | null;
  recommendedRun: HistoricalObservationReadinessRun | null;
  observationRun: HistoricalObservationReadinessRun | null;
  coverage: HistoricalObservationCoverage;
  metadata: {
    timeframe: HistoryTimeframe;
    assetClass: string;
    window: ObservationWindow;
    selectedWindow: ObservationWindow;
    windowUnit: "completed_candles";
    blocker: ObservationReadinessBlocker;
    diagnosticBlocker?: ObservationDiagnosticBlocker | null;
    candidateCount: number;
    candidateLimit: number;
    fullUniverseMinExpectedSymbols: number;
    disclaimer: string;
  };
};

export type HistoryVisualCheckData = {
  initialTimeframe?: HistoryTimeframe;
  initialObservationWindow?: ObservationWindow;
  snapshots: HistoricalSnapshotRun[];
  snapshotsByRunId: Record<string, HistoricalSnapshotDetailResponse>;
  readinessByRunId: Partial<Record<string, HistoricalObservationReadinessResponse>>;
  observationsByRunIdAndWindow: Partial<
    Record<
      string,
      Partial<Record<ObservationWindow, HistoricalSnapshotObservationsResponse>>
    >
  >;
};

type ForwardObservationMaturity = {
  state: ForwardObservationMaturityState;
  readyCount: number;
  rowCount: number;
  completeCount: number;
  partialCount: number;
  missingCount: number;
  dominantMissingReason: string | null;
  dominantMissingReasonCount: number;
};

type ForwardObservationCandidate = {
  run: HistoricalSnapshotRun;
  response: HistoricalSnapshotObservationsResponse | null;
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
};

type ForwardObservationSelection = {
  response: HistoricalSnapshotObservationsResponse | null;
  maturity: ForwardObservationMaturity | null;
  run: HistoricalSnapshotRun | null;
  mode: ForwardObservationSelectionMode;
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
};

const observationRowsDataStatusFilters = [
  { value: "all", label: "All" },
  { value: "complete", label: "Complete" },
  { value: "partial", label: "Partial" },
  { value: "missing", label: "Missing" },
] satisfies Array<{
  value: ObservationRowsDataStatusFilter;
  label: string;
}>;

const observationRowsGroupFilters = [
  { value: "all", label: "All" },
  { value: "eligible", label: "Eligible" },
  { value: "watch", label: "Watch" },
  { value: "overheated", label: "Hot" },
  { value: "risk", label: "Risk" },
  { value: "neutral", label: "Neutral" },
] satisfies Array<{
  value: ObservationRowsGroupFilter;
  label: string;
}>;

export function HistoryPageClient({
  visualCheckData,
}: {
  visualCheckData?: HistoryVisualCheckData;
} = {}) {
  const isVisualCheck = Boolean(visualCheckData);
  const [timeframe, setTimeframe] = useState<HistoryTimeframe>(
    visualCheckData?.initialTimeframe ?? "4h",
  );
  const [observationWindow, setObservationWindow] =
    useState<ObservationWindow>(visualCheckData?.initialObservationWindow ?? 3);
  const [manualSelectedRunId, setManualSelectedRunId] = useState<string | null>(
    null,
  );
  const [refreshingTimeframe, setRefreshingTimeframe] =
    useState<HistoryTimeframe | null>(null);
  const snapshotsQuery = useQuery({
    queryKey: buildHistorySnapshotsQueryKey({ timeframe, assetClass }),
    queryFn: ({ signal }) =>
      fetchHistoricalSnapshots({ timeframe, assetClass, signal }),
    enabled: !isVisualCheck,
    staleTime: 60_000,
  });
  const snapshots = visualCheckData
    ? visualCheckData.snapshots.filter((run) => run.timeframe === timeframe)
    : snapshotsQuery.data?.snapshots ?? emptyHistoricalSnapshotRuns;
  const selectedRunId =
    manualSelectedRunId && snapshots.some((run) => run.runId === manualSelectedRunId)
      ? manualSelectedRunId
      : snapshots[0]?.runId ?? null;

  const shouldLoadSnapshotRows = isVisualCheck || selectedRunId !== null;
  const shouldLoadObservationRows = isVisualCheck || selectedRunId !== null;
  const visualSnapshotData =
    selectedRunId && visualCheckData
      ? visualCheckData.snapshotsByRunId[selectedRunId] ?? null
      : null;

  const snapshotQuery = useQuery({
    queryKey: buildHistorySnapshotQueryKey({ runId: selectedRunId, assetClass }),
    queryFn: ({ signal }) =>
      fetchHistoricalSnapshot({
        runId: selectedRunId ?? "",
        assetClass,
        signal,
      }),
    enabled: selectedRunId !== null && shouldLoadSnapshotRows && !isVisualCheck,
    staleTime: 60_000,
  });
  const snapshotData = visualSnapshotData ?? snapshotQuery.data ?? null;
  const readinessQuery = useQuery({
    queryKey: buildHistoryObservationReadinessQueryKey({
      timeframe,
      runId: selectedRunId,
      assetClass,
      window: observationWindow,
    }),
    queryFn: ({ signal }) =>
      fetchHistoricalObservationReadiness({
        timeframe,
        runId: selectedRunId,
        assetClass,
        window: observationWindow,
        signal,
      }),
    enabled:
      selectedRunId !== null && shouldLoadObservationRows && !isVisualCheck,
    staleTime: 60_000,
  });
  const readinessData =
    selectedRunId && visualCheckData
      ? visualCheckData.readinessByRunId[selectedRunId] ?? null
      : shouldLoadObservationRows
        ? readinessQuery.data ?? null
        : null;
  const readinessError =
    !isVisualCheck && shouldLoadObservationRows && readinessQuery.isError
    ? formatQueryError(readinessQuery.error)
    : null;
  const observationRunId = getForwardObservationRowsRunId({
    selectedRunId,
    readiness: readinessData,
    readinessError,
  });
  const visualObservationData =
    observationRunId && visualCheckData
      ? visualCheckData.observationsByRunIdAndWindow[observationRunId]?.[
          observationWindow
        ] ?? null
      : null;
  const observationQuery = useQuery({
    queryKey: buildHistorySnapshotObservationsQueryKey({
      runId: observationRunId,
      assetClass,
      window: observationWindow,
    }),
    queryFn: ({ signal }) =>
      fetchHistoricalSnapshotObservations({
        runId: observationRunId ?? "",
        assetClass,
        window: observationWindow,
        signal,
      }),
    enabled:
      observationRunId !== null && shouldLoadObservationRows && !isVisualCheck,
    staleTime: 60_000,
  });
  const effectiveObservationData =
    visualObservationData ??
    (shouldLoadObservationRows ? (observationQuery.data ?? null) : null);
  const observationRowsError =
    !isVisualCheck && shouldLoadObservationRows && observationQuery.isError
    ? formatQueryError(observationQuery.error)
    : null;
  const forwardObservationUiState = deriveForwardObservationUiState({
    selectedRunId,
    readiness: readinessData,
    readinessIsLoading:
      selectedRunId !== null &&
      shouldLoadObservationRows &&
      !isVisualCheck &&
      readinessQuery.isLoading &&
      !readinessQuery.data,
    readinessError,
    response: effectiveObservationData,
    observationRunId,
    observationIsLoading:
      observationRunId !== null &&
      shouldLoadObservationRows &&
      !isVisualCheck &&
      observationQuery.isLoading &&
      !observationQuery.data,
    observationIsFetching:
      !isVisualCheck && shouldLoadObservationRows && observationQuery.isFetching,
    observationRowsError,
    fallbackWindow: observationWindow,
  });
  const rows = snapshotData?.rows ?? [];

  const refreshData = () => {
    if (isVisualCheck) {
      return;
    }

    const activeTimeframe = timeframe;
    const refreshScope = buildHistoryRefreshScope({
      timeframe: activeTimeframe,
      assetClass,
      selectedRunId,
      observationRunId,
      window: observationWindow,
    });
    const blockingRefreshes: Array<Promise<unknown>> = [
      snapshotsQuery.refetch(),
    ];

    setRefreshingTimeframe(activeTimeframe);

    if (selectedRunId !== null) {
      if (shouldLoadSnapshotRows) {
        blockingRefreshes.push(snapshotQuery.refetch());
      }

      if (shouldLoadObservationRows) {
        blockingRefreshes.push(readinessQuery.refetch());
      }
    }

    if (shouldLoadObservationRows && refreshScope.backgroundQueryKeys.length > 0) {
      void observationQuery.refetch();
    }

    void Promise.allSettled(blockingRefreshes).finally(() => {
      setRefreshingTimeframe((current) =>
        getNextRefreshingTimeframeAfterCompletion({
          refreshingTimeframe: current,
          completedTimeframe: activeTimeframe,
        }),
      );
    });
  };
  const isRefreshing = isHistoryRefreshActiveForTimeframe({
    refreshingTimeframe,
    timeframe,
  });
  const selectedRunFromList =
    snapshots.find((run) => run.runId === selectedRunId) ?? null;
  const commandRows =
    forwardObservationUiState.summary?.totalRows ??
    snapshotData?.metadata.rowCount ??
    selectedRunFromList?.signalsCreated ??
    rows.length;
  const selectedRun = snapshotData?.run ?? selectedRunFromList;

  return (
    <PageShell className="history-terminal max-w-none xl:h-full xl:min-h-0 xl:overflow-hidden">
      <HistoryCommandBar
        timeframe={timeframe}
        selectedRunId={selectedRunId}
        validationStatus={
          shouldLoadObservationRows
            ? formatValidationStatus(forwardObservationUiState)
            : "not loaded"
        }
        window={observationWindow}
        rowCount={commandRows}
        isRefreshing={isRefreshing}
        isVisualCheck={isVisualCheck}
        onTimeframeChange={setTimeframe}
        onRefresh={refreshData}
      />
      <p className="mb-1 text-[11px] leading-4 text-[var(--muted)]">
        Browse stored runs and snapshots to review how setups evolved over time.
        Use it to revisit prior structures and compare what followed.
      </p>

      <div className="grid min-h-0 flex-1 gap-2 xl:grid-cols-[260px_minmax(0,1fr)] xl:overflow-hidden">
        <RecentSuccessfulRunsPanel
          timeframe={timeframe}
          snapshots={snapshots}
          selectedRunId={selectedRunId}
          latestRunId={snapshots[0]?.runId ?? null}
          observationRunId={forwardObservationUiState.observationRun?.runId ?? null}
          recommendedRunId={
            readinessData?.recommendedRun?.run.runId ?? null
          }
          isError={!isVisualCheck && snapshotsQuery.isError}
          errorMessage={
            !isVisualCheck && snapshotsQuery.isError
              ? formatQueryError(snapshotsQuery.error)
              : null
          }
          isLoading={!isVisualCheck && snapshotsQuery.isLoading}
          onSelectRun={setManualSelectedRunId}
        />

        <main className="min-w-0 space-y-2 xl:flex xl:min-h-0 xl:flex-col xl:overflow-hidden">
          <ForwardObservationSection
            window={observationWindow}
            onWindowChange={setObservationWindow}
            response={effectiveObservationData}
            readiness={readinessData}
            uiState={forwardObservationUiState}
            selectedRun={selectedRun}
            isRequested={shouldLoadObservationRows}
            snapshotError={
              shouldLoadSnapshotRows && !isVisualCheck && snapshotQuery.isError
                ? formatQueryError(snapshotQuery.error)
                : null
            }
            snapshotIsLoading={
              shouldLoadSnapshotRows &&
              !isVisualCheck &&
              snapshotQuery.isLoading &&
              selectedRunId !== null
            }
          />

          <SnapshotTable
            rows={rows}
            selectedRunId={selectedRunId}
            rowCountEstimate={selectedRun?.signalsCreated ?? null}
            isRequested={shouldLoadSnapshotRows}
            isLoading={!isVisualCheck && snapshotQuery.isFetching}
            isError={!isVisualCheck && snapshotQuery.isError}
            errorMessage={
              !isVisualCheck && snapshotQuery.isError
                ? formatQueryError(snapshotQuery.error)
                : null
            }
          />
        </main>
      </div>
    </PageShell>
  );
}

function HistoryCommandBar({
  timeframe,
  selectedRunId,
  validationStatus,
  window,
  rowCount,
  isRefreshing,
  isVisualCheck,
  onTimeframeChange,
  onRefresh,
}: {
  timeframe: HistoryTimeframe;
  selectedRunId: string | null;
  validationStatus: string;
  window: ObservationWindow;
  rowCount: number;
  isRefreshing: boolean;
  isVisualCheck: boolean;
  onTimeframeChange: (timeframe: HistoryTimeframe) => void;
  onRefresh: () => void;
}) {
  return (
    <header className="terminal-command-bar mb-1">
      <div className="terminal-command-row text-[var(--terminal-bar-muted)]">
        <div className="terminal-command-brand">
          <h1 className="terminal-command-title">Research Archive</h1>
          <span className="shrink-0 font-mono text-[10px] text-[var(--terminal-bar-muted)]">
            Crypto
          </span>
        </div>
        <div className="terminal-command-main">
          <TimeframeSelector
            timeframe={timeframe}
            onTimeframeChange={onTimeframeChange}
          />
          <HistoryCommandStat
            label="Run"
            value={selectedRunId ? shortRunId(selectedRunId) : "None"}
            tone={selectedRunId ? "accent" : "missing"}
            title={`Selected Run: ${selectedRunId ?? "None"}`}
          />
          <HistoryCommandStat
            label="Validation"
            value={validationStatus.toUpperCase()}
            tone={getHistoryValidationTone(validationStatus)}
          />
          <HistoryCommandStat
            label="Window"
            value={`${window} ${window === 1 ? "candle" : "candles"}`}
            tone="neutral"
          />
          <HistoryCommandStat
            label="Rows"
            value={formatCount(rowCount)}
            tone={rowCount > 0 ? "complete" : "missing"}
          />
        </div>
        <div className="terminal-command-actions">
          <RefreshIconButton
            onClick={onRefresh}
            disabled={isRefreshing || isVisualCheck}
            isRefreshing={isRefreshing}
            label={isVisualCheck ? "Mock data" : "Refresh"}
          />
        </div>
      </div>
    </header>
  );
}

function HistoryCommandStat({
  label,
  value,
  tone = "neutral",
  title,
}: {
  label: string;
  value: string;
  tone?: HistoryTerminalTone;
  title?: string;
}) {
  return (
    <div
      title={title ?? `${label}: ${value}`}
      className={`inline-flex h-6 max-w-[220px] shrink-0 items-center gap-1.5 overflow-hidden border border-l-2 border-white/10 bg-white/[0.04] px-1.5 ${getHistoryTerminalToneBorderClass(tone)}`}
    >
      <span className="shrink-0 text-[9px] font-semibold uppercase text-[var(--terminal-bar-muted)]">
        {label}
      </span>
      <span
        className={`min-w-0 truncate font-mono text-[10px] font-semibold leading-4 ${getHistoryTerminalToneTextClass(tone)}`}
      >
        {value}
      </span>
    </div>
  );
}

function TimeframeSelector({
  timeframe,
  onTimeframeChange,
}: {
  timeframe: HistoryTimeframe;
  onTimeframeChange: (timeframe: HistoryTimeframe) => void;
}) {
  return (
    <div className="inline-flex h-6 shrink-0 items-center gap-1 overflow-hidden border border-l-2 border-white/10 border-l-[var(--accent)] bg-white/[0.04] px-1">
      <span className="shrink-0 text-[9px] font-semibold uppercase text-[var(--terminal-bar-muted)]">
        Timeframe
      </span>
      <div className="flex items-center gap-0.5">
        {HISTORY_TIMEFRAMES.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onTimeframeChange(option)}
            aria-pressed={option === timeframe}
            className={formatCommandTimeframeControlClassName(option === timeframe)}
          >
            {option.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}

export function RecentSuccessfulRunsPanel({
  timeframe,
  snapshots,
  selectedRunId,
  latestRunId,
  observationRunId,
  recommendedRunId,
  isError,
  errorMessage,
  isLoading,
  onSelectRun,
}: {
  timeframe: HistoryTimeframe;
  snapshots: HistoricalSnapshotRun[];
  selectedRunId: string | null;
  latestRunId: string | null;
  observationRunId: string | null;
  recommendedRunId: string | null;
  isError: boolean;
  errorMessage: string | null;
  isLoading: boolean;
  onSelectRun: (runId: string) => void;
}) {
  return (
    <section
      className={recentRunsPanelClassName}
      data-testid="recent-runs-panel"
      aria-label="Selected Run recent runs"
    >
      <div className="terminal-panel-header-stack shrink-0">
        <div className="flex items-center justify-between gap-2">
          <h2 className="terminal-panel-title">
            Recent Runs
          </h2>
          <StatusBadge
            tone="accent"
            className="h-5 justify-center !py-0 text-[10px] [line-height:1]"
          >
            {timeframe.toUpperCase()}
          </StatusBadge>
        </div>
        <p className="terminal-panel-subtitle text-[9px]">
          Selected Run
        </p>
      </div>
      {isError ? (
        <StatePanel
          title="Archive unavailable"
          message={errorMessage ?? "Stored ranking runs could not be loaded."}
        />
      ) : isLoading ? (
        <StatePanel title="Loading runs" message="Loading stored ranking runs." />
      ) : snapshots.length === 0 ? (
        <StatePanel
          title="No runs"
          message={`No successful ${timeframe} runs are available.`}
        />
      ) : (
        <div
          className={recentRunsScrollContainerClassName}
          data-testid="recent-runs-scroll-container"
          aria-label="Recent successful run selector"
        >
          {snapshots.map((run) => {
            const isSelected = run.runId === selectedRunId;
            const badges = buildRecentRunBadges({
              runId: run.runId,
              selectedRunId,
              latestRunId,
              observationRunId,
              recommendedRunId,
            });

            return (
              <button
                key={run.runId}
                type="button"
                onClick={() => onSelectRun(run.runId)}
                aria-pressed={isSelected}
                aria-label={`Select historical run ${run.runId}`}
                className={formatRecentRunCardClassName(run, isSelected)}
              >
                <div className="flex min-w-0 items-center gap-1">
                  <span
                    className="min-w-0 truncate font-mono text-[11px] font-semibold text-[var(--foreground)]"
                    title={run.runId}
                  >
                    {formatCompactRunId(run.runId)}
                  </span>
                  <span className="shrink-0 border border-[var(--border)] bg-[var(--panel-muted)] px-1 py-0 text-[9px] font-semibold uppercase leading-4 text-[var(--muted)]">
                    {run.timeframe.toUpperCase()}
                  </span>
                  {badges.length > 0
                    ? badges.map((badge) => (
                      <StatusBadge
                        key={badge}
                        tone={getRecentRunBadgeTone(badge)}
                        className="h-4 justify-center !px-1 !py-0 text-[9px] [line-height:1]"
                        title={badge}
                      >
                        {formatRecentRunBadgeLabel(badge)}
                      </StatusBadge>
                    ))
                    : null}
                </div>
                <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] leading-4 text-[var(--muted)]">
                  <span className="font-mono">{formatHistoryDateTime(run.finishedAt)}</span>
                  <span>{formatCount(run.symbolsScanned)} rows</span>
                  <span
                    className={
                      run.isLikelyFullUniverse === true
                        ? "font-semibold text-[var(--foreground)]"
                        : "text-[var(--muted)]"
                    }
                  >
                    {formatFullUniverse(run)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function buildRecentRunBadges({
  runId,
  selectedRunId,
  latestRunId,
  observationRunId,
  recommendedRunId,
}: {
  runId: string;
  selectedRunId: string | null;
  latestRunId: string | null;
  observationRunId: string | null;
  recommendedRunId: string | null;
}) {
  return [
    runId === selectedRunId ? "Selected" : null,
    runId === observationRunId ? "Validation Source" : null,
    runId === latestRunId ? "Latest" : null,
    runId === recommendedRunId && runId !== observationRunId
      ? "Recommended"
      : null,
  ].filter((badge): badge is string => badge !== null);
}

function formatRecentRunCardClassName(
  run: HistoricalSnapshotRun,
  isSelected: boolean,
) {
  const base =
    "w-full border border-l-4 px-1.5 py-1 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

  if (isSelected) {
    return `${base} border-[var(--accent-border)] border-l-[var(--accent)] bg-[var(--section-selected-bg)] shadow-[inset_3px_0_0_var(--accent)]`;
  }

  if (run.isLikelyFullUniverse === true) {
    return `${base} border-[var(--border)] border-l-[var(--complete)] bg-[var(--panel-data)] hover:border-[var(--border-strong)] hover:bg-[var(--row-hover)]`;
  }

  return `${base} border-[var(--border)] border-l-[var(--partial)] bg-[var(--panel-muted)] opacity-80 hover:border-[var(--border-strong)] hover:bg-[var(--row-hover)] hover:opacity-100`;
}

function getRecentRunBadgeTone(badge: string) {
  switch (badge) {
    case "Selected":
      return "accent";
    case "Validation Source":
      return "observation";
    case "Latest":
      return "info";
    case "Recommended":
      return "watch";
    default:
      return "neutral";
  }
}

function formatRecentRunBadgeLabel(badge: string) {
  switch (badge) {
    case "Selected":
      return "Sel";
    case "Validation Source":
      return "Val";
    case "Recommended":
      return "Rec";
    default:
      return badge;
  }
}

export function ForwardObservationSection({
  window,
  onWindowChange,
  response,
  readiness,
  uiState,
  selectedRun = null,
  isRequested = true,
  snapshotError = null,
  snapshotIsLoading = false,
}: {
  window: ObservationWindow;
  onWindowChange: (window: ObservationWindow) => void;
  response: HistoricalSnapshotObservationsResponse | null;
  readiness?: HistoricalObservationReadinessResponse | null;
  uiState: ForwardObservationUiState;
  selectedRun?: HistoricalSnapshotRun | null;
  isRequested?: boolean;
  snapshotError?: string | null;
  snapshotIsLoading?: boolean;
}) {
  const rows = response?.rows ?? emptyHistoricalObservationRows;
  const summary = uiState.summary;
  const outcomeSummaryStatus = isRequested
    ? getOutcomeSummaryStatus({
        summary,
        uiState,
      })
    : { label: "Not loaded", tone: "missing" as const };
  const selectedReadiness = readiness?.selectedRun ?? null;
  const selectedReadinessRun =
    selectedRun ?? selectedReadiness?.run ?? uiState.selectedRun;
  const observationReadiness = getReadyObservationReadinessRun(readiness ?? null);
  const observationRun = uiState.observationRun;
  const readyContextNote = getForwardObservationReadyContextNote({
    uiState,
    readiness: readiness ?? null,
  });
  const observationSummary = useMemo(
    () =>
      buildObservationSummary({
        rows,
        counts: summary
          ? {
              totalRows: summary.totalRows,
              completeCount: summary.completeCount,
              partialCount: summary.partialCount,
              missingCount: summary.missingCount,
            }
          : null,
      }),
    [rows, summary],
  );
  const showObservationSummary =
    uiState.status === "observation_ready" && rows.length > 0;

  return (
    <section className="terminal-panel overflow-hidden xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
      <div className="terminal-panel-header">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="terminal-panel-title">
            Outcome Summary
          </h2>
          <StatusBadge
            tone={outcomeSummaryStatus.tone}
            className="h-5 justify-center !py-0 text-[10px] [line-height:1]"
          >
            {outcomeSummaryStatus.label}
          </StatusBadge>
        </div>
        <div className="flex flex-wrap gap-1 border border-[var(--border)] bg-[var(--panel-muted)] p-0.5">
          {OBSERVATION_WINDOWS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onWindowChange(option)}
              aria-pressed={option === window}
              className={formatSelectedControlClassName(option === window)}
              style={historyCompactControlStyle}
            >
              {option} {option === 1 ? "candle" : "candles"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-col gap-1 px-2 py-1 xl:flex-1 xl:overflow-hidden">
        {!isRequested ? (
          <StatePanel
            title="Loading Outcome Rows"
            message={
              selectedReadinessRun
                ? `Selected run ${shortRunId(selectedReadinessRun.runId)} is loading automatically.`
                : "Choose a run from Recent Runs."
            }
          />
        ) : snapshotError ? (
          <StatePanel title="Selected Run unavailable" message={snapshotError} />
        ) : snapshotIsLoading ? (
          <StatePanel title="Loading Selected Run" message="Loading ranking rows." />
        ) : !selectedReadinessRun ? (
          <StatePanel
            title="No Selected Run"
            message="Choose a run from Recent Runs."
          />
        ) : summary ? (
          <ObservationSummarySection
            summary={observationSummary}
            window={summary.window}
          />
        ) : (
          <StatePanel
            title="Validation Source unavailable"
            message="No validation source is available for the selected run."
          />
        )}

        <SelectedScanValidationStrip
          selectedRun={selectedReadinessRun}
          validationRun={observationRun}
          validationReadiness={observationReadiness}
          summary={summary}
          window={window}
        />

        {!isRequested ? null : uiState.status !== "observation_ready" ? (
          <ForwardObservationStatePanel
            uiState={uiState}
            readiness={readiness ?? null}
          />
        ) : rows.length === 0 ? (
          <StatePanel
            title="Outcome Rows unavailable"
            message="No outcome rows are available for the Validation Source."
          />
        ) : (
          <ObservationRowsTable rows={rows} isFetching={uiState.isFetching} />
        )}

        {isRequested ? (
          <HistoryDetails
            readiness={readiness ?? null}
            response={response}
            uiState={uiState}
            summary={showObservationSummary ? observationSummary : null}
            readyContextNote={readyContextNote}
          />
        ) : null}
      </div>
    </section>
  );
}

function SelectedScanValidationStrip({
  selectedRun,
  validationRun,
  validationReadiness,
  summary,
  window,
}: {
  selectedRun: HistoricalSnapshotRun | null;
  validationRun: HistoricalSnapshotRun | null;
  validationReadiness: HistoricalObservationReadinessRun | null;
  summary: ForwardObservationSummary | null;
  window: ObservationWindow;
}) {
  const validationWindow = summary?.window ?? window;
  const validationWindowLabel = formatValidationWindowLabel({
    summary,
    window: validationWindow,
  });

  return (
    <div className="terminal-panel-data flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 px-2 py-1 text-[10px] shadow-none">
      <HistoryContextStripLine
        label="Run"
        runId={selectedRun?.runId ?? null}
        items={[
          {
            value: formatHistoryDateTime(selectedRun?.finishedAt),
            title: "Finished",
          },
          {
            value: `${formatCount(selectedRun?.symbolsScanned)}/${formatCount(
              selectedRun?.signalsCreated,
            )}`,
            title: "Rows / signals",
          },
          {
            value: selectedRun ? formatFullUniverse(selectedRun) : "-",
            tone:
              selectedRun?.isLikelyFullUniverse === true
                ? "complete"
                : "partial",
            title: "Universe",
          },
        ]}
      />
      <HistoryContextStripLine
        label="Validation"
        runId={validationRun?.runId ?? null}
        items={[
          {
            value:
              validationReadiness?.state === "ready"
                ? "Source ready"
                : formatReadinessRunStatus(validationReadiness),
            tone:
              validationReadiness?.state === "ready"
                ? "observation"
                : "partial",
            title: "Readiness",
          },
          {
            value: summary
              ? `${formatCount(summary.completeCount)}/${formatCount(
                  summary.partialCount,
                )}/${formatCount(summary.missingCount)}`
              : "-",
            title: "Complete / partial / missing",
          },
          {
            value: validationWindowLabel.label,
            tone: validationWindowLabel.tone,
            title: `Window ${validationWindow} ${
              validationWindow === 1 ? "candle" : "candles"
            }`,
          },
        ]}
      />
    </div>
  );
}

function formatValidationWindowLabel({
  summary,
  window,
}: {
  summary: ForwardObservationSummary | null;
  window: ObservationWindow;
}): { label: string; tone: StatusTone } {
  if (
    summary &&
    summary.completeCount === 0 &&
    (summary.partialCount > 0 || summary.missingCount > 0)
  ) {
    return { label: "Window pending", tone: "partial" };
  }

  return {
    label: `Window ${window} ${window === 1 ? "candle" : "candles"}`,
    tone: "accent",
  };
}

function HistoryContextStripLine({
  label,
  runId,
  items,
}: {
  label: string;
  runId: string | null;
  items: Array<{ value: string; tone?: StatusTone; title?: string }>;
}) {
  return (
    <div
      className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5"
      aria-label={`${label} ${runId ?? "unavailable"}`}
    >
      <span className="shrink-0 font-semibold uppercase text-[var(--foreground)]">
        {label}
      </span>
      <HistoryInlineValue
        value={shortRunId(runId)}
        tone="accent"
        title={runId ?? `${label} unavailable`}
      />
      {items.map((item, index) => (
        <HistoryInlineValue
          key={`${label}-${index}-${item.value}`}
          value={item.value}
          tone={item.tone}
          title={item.title}
        />
      ))}
    </div>
  );
}

function HistoryInlineValue({
  value,
  tone = "neutral",
  title,
}: {
  value: string;
  tone?: StatusTone;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex h-5 max-w-full items-center justify-center truncate whitespace-nowrap border border-l-2 bg-[var(--panel)] px-1.5 font-mono text-[10px] font-semibold [line-height:1] ${getHistoryStatusToneBorderClass(
        tone,
      )} ${getHistoryStatusToneTextClass(tone)}`}
    >
      {value}
    </span>
  );
}

function HistoryContextBlock({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, string]>;
}) {
  return (
    <section className="border border-[var(--border)] bg-[var(--panel-muted)] px-2 py-1.5">
      <h3 className="text-[10px] font-semibold uppercase tracking-normal text-[var(--foreground)]">
        {title}
      </h3>
      <dl className="mt-1 grid gap-x-3 gap-y-1 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={`${title}-${label}`} className="min-w-0">
            <dt className="text-[9px] font-semibold uppercase tracking-normal text-[var(--muted)]">
              {label}
            </dt>
            <dd className="truncate font-mono text-[10px] font-semibold text-[var(--foreground)]">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function HistoryDetails({
  readiness,
  response,
  uiState,
  summary,
  readyContextNote,
}: {
  readiness: HistoricalObservationReadinessResponse | null;
  response: HistoricalSnapshotObservationsResponse | null;
  uiState: ForwardObservationUiState;
  summary: ObservationSummary | null;
  readyContextNote: string | null;
}) {
  const selectedReadiness = readiness?.selectedRun ?? null;
  const coverage = readiness?.coverage ?? null;
  const expectedWait = uiState.summary
    ? formatApproximateObservationWait(
        uiState.summary.timeframe,
        uiState.summary.window,
      )
    : "-";

  return (
    <details className="shrink-0 border border-[var(--border)] bg-[var(--panel-muted)]">
      <summary className="cursor-pointer bg-[var(--table-header)] px-2 py-1 text-[11px] font-semibold uppercase tracking-normal text-[var(--foreground)]">
        Details
      </summary>
      <div className="space-y-1.5 border-t border-[var(--border)] px-2 py-1.5">
        <ObservationDataStatusLegend />
        <DetailLine
          label="Data path"
          value="Outcome metrics use Validation Source; Original Ranking Rows stay tied to Selected Run."
        />
        {readyContextNote ? (
          <DetailLine label="Validation note" value={readyContextNote} />
        ) : null}
        <div className="grid gap-2 lg:grid-cols-2">
          <HistoryContextBlock
            title="Maturity Logic"
            rows={[
              ["Status", formatForwardObservationUiStatusLabel(uiState)],
              ["Mode", formatForwardObservationSelectionMode(uiState.selectionMode)],
              ["Maturity", formatMaturityState(uiState.maturity.state)],
              [
                "Diagnostic",
                formatObservationDiagnosticBlocker(
                  selectedReadiness?.diagnosticBlocker ??
                    readiness?.metadata.diagnosticBlocker,
                ),
              ],
              [
                "Dominant Reason",
                formatObservationBlocker(
                  uiState.blocker,
                  uiState.maturity.dominantMissingReason,
                ),
              ],
              ["Expected Wait", expectedWait],
            ]}
          />
          <HistoryContextBlock
            title="Source Data"
            rows={[
              ["Readiness", readiness ? "Loaded" : "Unavailable"],
              ["Outcome Rows", response ? formatCount(response.rows.length) : "-"],
              [
                "Returned Rows",
                response ? formatCount(response.metadata.rowCount) : "-",
              ],
              [
                "Window Unit",
                response?.metadata.windowUnit ?? readiness?.metadata.windowUnit ?? "-",
              ],
              [
                "Latest Coverage",
                coverage ? formatLatestCoverage(coverage) : "-",
              ],
              [
                "Coverage Lag",
                selectedReadiness ? formatCoverageLag(selectedReadiness) : "-",
              ],
            ]}
          />
        </div>
        {summary ? (
          <>
            <GroupDistributionTable groups={summary.groups} />
            <NotableHistoricalExamples summary={summary} />
          </>
        ) : null}
        <RawDetails readiness={readiness} response={response} />
      </div>
    </details>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l-2 border-l-[var(--section-selected)] bg-[var(--panel)] px-2 py-1 text-[11px] leading-4 text-[var(--muted)]">
      <span className="font-semibold text-[var(--foreground)]">{label}:</span>{" "}
      {value}
    </div>
  );
}

function RawDetails({
  readiness,
  response,
}: {
  readiness: HistoricalObservationReadinessResponse | null;
  response: HistoricalSnapshotObservationsResponse | null;
}) {
  const raw = {
    readinessMetadata: readiness?.metadata ?? null,
    coverage: readiness?.coverage ?? null,
    outcomeMetadata: response?.metadata ?? null,
    validationRun: response?.run ?? null,
    sampleOutcomeRows: response?.rows.slice(0, 5) ?? [],
  };

  return (
    <details className="border border-[var(--border)] bg-[var(--panel)]">
      <summary className="cursor-pointer px-2 py-1 text-[11px] font-semibold text-[var(--foreground)]">
        Raw run metadata and row fields
      </summary>
      <pre className="max-h-80 overflow-auto border-t border-[var(--border)] p-2 text-[10px] leading-4 text-[var(--muted)]">
        {JSON.stringify(raw, null, 2)}
      </pre>
    </details>
  );
}

export function ObservationRowsTable({
  rows,
  isFetching,
  initialDataStatusFilter = "all",
  initialGroupFilter = "all",
  initialSymbolSearch = "",
  initialSortState = null,
}: {
  rows: HistoricalSnapshotObservationRow[];
  isFetching: boolean;
  initialDataStatusFilter?: ObservationRowsDataStatusFilter;
  initialGroupFilter?: ObservationRowsGroupFilter;
  initialSymbolSearch?: string;
  initialSortState?: DataSortState<ObservationRowsSortKey> | null;
}) {
  const { dictionary } = useAppLanguage();
  const [dataStatusFilter, setDataStatusFilter] =
    useState<ObservationRowsDataStatusFilter>(initialDataStatusFilter);
  const [groupFilter, setGroupFilter] =
    useState<ObservationRowsGroupFilter>(initialGroupFilter);
  const [symbolSearch, setSymbolSearch] = useState(initialSymbolSearch);
  const [sortState, setSortState] =
    useState<DataSortState<ObservationRowsSortKey> | null>(initialSortState);
  const filteredRows = useMemo(
    () =>
      filterObservationRows({
        rows,
        dataStatusFilter,
        groupFilter,
        symbolSearch,
      }),
    [rows, dataStatusFilter, groupFilter, symbolSearch],
  );
  const visibleRows = useMemo(
    () => sortDataRows(filteredRows, sortState, getObservationRowsSortValue),
    [filteredRows, sortState],
  );
  const updateSort = (
    key: ObservationRowsSortKey,
    defaultDirection: DataSortDirection,
  ) => {
    setSortState((current) =>
      getNextDataSortState({ current, key, defaultDirection }),
    );
  };

  return (
    <section className="terminal-panel-data overflow-hidden xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
      <div className="terminal-panel-header is-start">
        <h3 className="terminal-panel-title shrink-0">
          Outcome Rows
        </h3>
        <StatusBadge
          tone={visibleRows.length === rows.length ? "complete" : "info"}
          className="text-[10px]"
        >
          {formatObservationRowsFilterCount({
            visibleCount: visibleRows.length,
            totalCount: rows.length,
          })}
        </StatusBadge>
        {isFetching ? (
          <StatusBadge tone="partial" className="text-[10px]">
            Refreshing
          </StatusBadge>
        ) : null}
        <span className="shrink-0 text-[10px] font-semibold uppercase text-[var(--muted)]">
          Validation Source
        </span>
        <ObservationRowsFilterGroup
          label="Status"
          options={observationRowsDataStatusFilters}
          selectedValue={dataStatusFilter}
          onSelect={(value) => setDataStatusFilter(value)}
        />
        <ObservationRowsFilterGroup
          label="State"
          options={observationRowsGroupFilters}
          selectedValue={groupFilter}
          onSelect={(value) => setGroupFilter(value)}
        />
        <label className="flex min-w-[150px] flex-1 items-center gap-1 sm:flex-none">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-normal text-[var(--muted)]">
            Search
          </span>
          <input
            value={symbolSearch}
            onChange={(event) => setSymbolSearch(event.target.value)}
            placeholder="Symbol"
            className="terminal-control h-6 min-w-0 flex-1 font-mono text-[10px] sm:w-32 sm:flex-none"
          />
        </label>
      </div>

      {visibleRows.length === 0 ? (
        <StatePanel
          title="No matching observation rows"
          message="No observation rows match the current filters."
        />
      ) : (
        <DataTableScroll className="max-h-[70vh] !overflow-x-auto !overflow-y-auto xl:min-h-0 xl:flex-1">
          <DataTable minWidth="min-w-[1180px]">
            <thead className="sticky top-0 z-20 bg-[var(--table-header)] text-[10px] uppercase tracking-normal text-[var(--muted)]">
              <tr>
                <DataTableHeaderCell
                  sortKey="symbol"
                  sortState={sortState}
                  onSortChange={updateSort}
                >
                  Symbol
                </DataTableHeaderCell>
                <DataTableHeaderCell
                  sortKey="group"
                  sortState={sortState}
                  defaultDirection="desc"
                  onSortChange={updateSort}
                >
                  Original State
                </DataTableHeaderCell>
                <DataTableHeaderCell
                  sortKey="rank_score"
                  sortState={sortState}
                  defaultDirection="desc"
                  onSortChange={updateSort}
                  align="right"
                >
                  Rank
                </DataTableHeaderCell>
                <DataTableHeaderCell
                  sortKey="anchor_close"
                  sortState={sortState}
                  defaultDirection="desc"
                  onSortChange={updateSort}
                  align="right"
                >
                  Anchor Close
                </DataTableHeaderCell>
                <DataTableHeaderCell
                  sortKey="observed_close"
                  sortState={sortState}
                  defaultDirection="desc"
                  onSortChange={updateSort}
                  align="right"
                >
                  Observed Close
                </DataTableHeaderCell>
                <DataTableHeaderCell
                  sortKey="observed_change"
                  sortState={sortState}
                  defaultDirection="desc"
                  onSortChange={updateSort}
                  align="right"
                >
                  Return
                </DataTableHeaderCell>
                <DataTableHeaderCell
                  sortKey="max_drawdown"
                  sortState={sortState}
                  defaultDirection="desc"
                  onSortChange={updateSort}
                  align="right"
                >
                  Max Drawdown
                </DataTableHeaderCell>
                <DataTableHeaderCell
                  sortKey="data_status"
                  sortState={sortState}
                  defaultDirection="desc"
                  onSortChange={updateSort}
                >
                  Outcome Status
                </DataTableHeaderCell>
                <DataTableHeaderCell>Research</DataTableHeaderCell>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr
                  key={row.id}
                  className="group border-t border-[var(--table-grid)] odd:bg-[var(--panel-data)] even:bg-[var(--panel-muted)] hover:bg-[var(--row-hover)] hover:shadow-[inset_3px_0_0_var(--accent)]"
                >
                  <DataTableCell className="font-semibold text-[var(--foreground)]">
                    {row.symbol}
                  </DataTableCell>
                  <DataTableCell>
                    <div
                      className="flex min-w-0 items-center gap-1.5"
                      title={`${formatGroupLabel(
                        normalizeGroupKey(row.group),
                      )} · ${formatSignalLabel(row.label, dictionary)}`}
                    >
                      <GroupChip
                        group={normalizeGroupKey(row.group)}
                        dictionary={dictionary}
                      />
                      <span
                        className="min-w-0 truncate text-[10px] text-[var(--muted)]"
                        title={formatSignalLabel(row.label, dictionary)}
                      >
                        {formatSignalLabel(row.label, dictionary)}
                      </span>
                    </div>
                  </DataTableCell>
                  <DataTableCell align="right" className="font-mono tabular-nums">
                    {formatScore(row.rankScore)}
                  </DataTableCell>
                  <DataTableCell align="right" className="font-mono tabular-nums">
                    {formatObservationNumber(row.anchorClose)}
                  </DataTableCell>
                  <DataTableCell align="right" className="font-mono tabular-nums">
                    {formatObservationNumber(row.observedClose)}
                  </DataTableCell>
                  <DataTableCell
                    align="right"
                    className={`font-mono tabular-nums ${getObservedChangeClass(
                      row.observedChangePct,
                    )}`}
                  >
                    {formatObservationPercent(row.observedChangePct)}
                  </DataTableCell>
                  <DataTableCell
                    align="right"
                    className={`font-mono tabular-nums ${getDrawdownClass(
                      row.maxDrawdownPct,
                    )}`}
                  >
                    {formatObservationPercent(row.maxDrawdownPct)}
                  </DataTableCell>
                  <DataTableCell>
                    <ObservationDataStatusBadge
                      status={row.dataStatus}
                      missingReason={row.missingReason}
                    />
                  </DataTableCell>
                  <DataTableCell>
                    <Link
                      href={buildSymbolResearchHref({
                        exchange: row.exchange ?? "binance",
                        symbol: row.symbol,
                        timeframe: row.timeframe,
                        assetClass,
                      })}
                      className="terminal-mini-action is-accent h-6 px-2"
                    >
                      Research
                    </Link>
                  </DataTableCell>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </DataTableScroll>
      )}
    </section>
  );
}

function ObservationRowsFilterGroup<TValue extends string>({
  label,
  options,
  selectedValue,
  onSelect,
}: {
  label: string;
  options: Array<{ value: TValue; label: string }>;
  selectedValue: TValue;
  onSelect: (value: TValue) => void;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-normal text-[var(--muted)]">
        {label}
      </span>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => {
          const isSelected = option.value === selectedValue;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onSelect(option.value)}
              aria-pressed={isSelected}
              className={formatObservationRowsFilterButtonClassName(isSelected)}
              style={historyCompactControlStyle}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ObservationDataStatusBadge({
  status,
  missingReason,
}: {
  status: ObservationDataStatus;
  missingReason?: string | null;
}) {
  return (
    <DataTableChip
      tone={getObservationDataStatusChipTone(status)}
      className="max-w-[180px]"
      title={
        missingReason
          ? `${formatDataStatus(status)}: ${formatMissingReason(missingReason)}`
          : formatDataStatus(status)
      }
    >
      {formatCompactDataStatus(status, missingReason)}
    </DataTableChip>
  );
}

function GroupChip({
  group,
  dictionary,
}: {
  group: ReturnType<typeof normalizeGroupKey>;
  dictionary: ScannerDisplayDictionary;
}) {
  return (
    <DataTableChip tone={getHistoryGroupChipTone(group)}>
      {formatGroupLabel(group, dictionary)}
    </DataTableChip>
  );
}

export function getObservationRowsSortValue(
  row: HistoricalSnapshotObservationRow,
  key: ObservationRowsSortKey,
): DataSortValue {
  switch (key) {
    case "symbol":
      return row.symbol;
    case "group":
      return getHistoryGroupSortRank(normalizeGroupKey(row.group));
    case "label":
      return formatSignalLabel(row.label);
    case "rank_score":
      return row.rankScore;
    case "anchor_close":
      return row.anchorClose;
    case "observed_close":
      return row.observedClose;
    case "observed_change":
      return row.observedChangePct;
    case "max_drawdown":
      return row.maxDrawdownPct;
    case "data_status":
      return getObservationDataStatusSortRank(row.dataStatus);
  }
}

function filterObservationRows({
  rows,
  dataStatusFilter,
  groupFilter,
  symbolSearch,
}: {
  rows: HistoricalSnapshotObservationRow[];
  dataStatusFilter: ObservationRowsDataStatusFilter;
  groupFilter: ObservationRowsGroupFilter;
  symbolSearch: string;
}) {
  const normalizedSymbolSearch = symbolSearch.trim().toUpperCase();

  return rows.filter((row) => {
    const matchesDataStatus =
      dataStatusFilter === "all" || row.dataStatus === dataStatusFilter;
    const matchesGroup =
      groupFilter === "all" || normalizeGroupKey(row.group) === groupFilter;
    const matchesSymbol =
      !normalizedSymbolSearch ||
      row.symbol.toUpperCase().includes(normalizedSymbolSearch);

    return matchesDataStatus && matchesGroup && matchesSymbol;
  });
}

function formatObservationRowsFilterButtonClassName(isSelected: boolean) {
  return formatSelectedControlClassName(isSelected);
}

function getObservationDataStatusChipTone(status: ObservationDataStatus): ChipTone {
  switch (status) {
    case "complete":
      return "complete";
    case "partial":
      return "partial";
    case "missing":
      return "missing";
  }
}

function getObservationDataStatusSortRank(status: ObservationDataStatus) {
  switch (status) {
    case "complete":
      return 3;
    case "partial":
      return 2;
    case "missing":
      return 1;
  }
}

function getHistoryGroupSortRank(group: ReturnType<typeof normalizeGroupKey>) {
  switch (group) {
    case "eligible":
      return 5;
    case "watch":
      return 4;
    case "neutral":
      return 3;
    case "overheated":
      return 2;
    case "risk":
      return 1;
    case "insufficient_history":
      return 0;
  }
}

function getHistoryGroupChipTone(
  group: ReturnType<typeof normalizeGroupKey>,
): ChipTone {
  switch (group) {
    case "eligible":
      return "eligible";
    case "watch":
      return "watch";
    case "overheated":
      return "overheated";
    case "risk":
      return "risk";
    case "neutral":
    case "insufficient_history":
      return "neutral";
  }
}

function formatObservationRowsFilterCount({
  visibleCount,
  totalCount,
}: {
  visibleCount: number;
  totalCount: number;
}) {
  return visibleCount === totalCount
    ? `Showing ${formatCount(visibleCount)}`
    : `Showing ${formatCount(visibleCount)}/${formatCount(totalCount)}`;
}

function getObservedChangeClass(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value === 0) {
    return "text-[var(--muted)]";
  }

  return value > 0 ? "ui-value-positive font-semibold" : "ui-value-negative font-semibold";
}

function getDrawdownClass(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value === 0) {
    return "text-[var(--muted)]";
  }

  return "ui-value-warning font-semibold";
}

function getObservedSummaryTone(value: number | null): StatusTone {
  if (typeof value !== "number" || !Number.isFinite(value) || value === 0) {
    return "neutral";
  }

  return value > 0 ? "positive" : "negative";
}

function getPositiveRateTone(value: number | null): StatusTone {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "neutral";
  }

  if (value >= 60) {
    return "positive";
  }

  if (value <= 40) {
    return "negative";
  }

  return "neutral";
}

function getDrawdownSummaryTone(value: number | null): StatusTone {
  if (typeof value !== "number" || !Number.isFinite(value) || value === 0) {
    return "neutral";
  }

  return value < 0 ? "warning" : "neutral";
}

function formatSelectedControlClassName(isSelected: boolean) {
  const base =
    "inline-flex h-6 items-center justify-center whitespace-nowrap border px-2 py-0 text-[10px] font-semibold uppercase [line-height:1] tracking-normal transition focus-visible:outline-[var(--accent)]";

  return isSelected
    ? `${base} border-[var(--accent-border)] bg-[var(--accent)] text-[var(--accent-foreground)]`
    : `${base} border-[var(--border)] bg-[var(--control)] text-[var(--muted)] hover:border-[var(--accent-border)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]`;
}

function formatCommandTimeframeControlClassName(isSelected: boolean) {
  const base =
    "inline-flex h-[18px] min-w-7 items-center justify-center whitespace-nowrap border px-1.5 py-0 text-[9px] font-semibold uppercase leading-none tracking-normal transition focus-visible:outline-[var(--accent)]";

  return isSelected
    ? `${base} border-[var(--accent-border)] bg-[var(--accent)] text-[var(--accent-foreground)]`
    : `${base} border-transparent bg-transparent text-[var(--terminal-bar-muted)] hover:border-white/20 hover:text-[var(--terminal-bar-foreground)]`;
}

function getHistoryValidationTone(status: string): HistoryTerminalTone {
  switch (status) {
    case "ready":
      return "complete";
    case "pending":
      return "partial";
    case "not loaded":
      return "neutral";
    case "unavailable":
      return "missing";
    default:
      return "neutral";
  }
}

function getHistoryTerminalToneBorderClass(tone: HistoryTerminalTone) {
  switch (tone) {
    case "accent":
      return "border-l-[var(--accent)]";
    case "complete":
      return "border-l-[var(--complete)]";
    case "partial":
      return "border-l-[var(--partial)]";
    case "missing":
      return "border-l-[var(--missing)]";
    case "risk":
      return "border-l-[var(--risk)]";
    case "watch":
      return "border-l-[var(--watch)]";
    case "neutral":
    default:
      return "border-l-[var(--neutral-border)]";
  }
}

function getHistoryTerminalToneTextClass(tone: HistoryTerminalTone) {
  switch (tone) {
    case "accent":
      return "text-[var(--accent)]";
    case "complete":
      return "text-[var(--complete)]";
    case "partial":
      return "text-[var(--partial)]";
    case "missing":
      return "text-[var(--missing)]";
    case "risk":
      return "text-[var(--risk)]";
    case "watch":
      return "text-[var(--watch)]";
    case "neutral":
    default:
      return "text-[var(--terminal-bar-foreground)]";
  }
}

function getHistoryStatusToneBorderClass(tone: StatusTone) {
  switch (tone) {
    case "accent":
      return "border-l-[var(--accent)]";
    case "positive":
    case "complete":
    case "eligible":
      return "border-l-[var(--complete)]";
    case "negative":
    case "danger":
    case "risk":
      return "border-l-[var(--risk)]";
    case "warning":
    case "partial":
    case "overheated":
      return "border-l-[var(--partial)]";
    case "info":
      return "border-l-[var(--info)]";
    case "observation":
      return "border-l-[var(--observation)]";
    case "watch":
      return "border-l-[var(--watch)]";
    case "missing":
      return "border-l-[var(--missing)]";
    case "neutral":
    default:
      return "border-l-[var(--neutral-border)]";
  }
}

function getHistoryStatusToneTextClass(tone: StatusTone) {
  switch (tone) {
    case "accent":
      return "text-[var(--accent)]";
    case "positive":
    case "complete":
    case "eligible":
      return "text-[var(--complete)]";
    case "negative":
    case "danger":
    case "risk":
      return "text-[var(--risk)]";
    case "warning":
    case "partial":
    case "overheated":
      return "text-[var(--partial)]";
    case "info":
      return "text-[var(--info)]";
    case "observation":
      return "text-[var(--observation)]";
    case "watch":
      return "text-[var(--watch)]";
    case "missing":
      return "text-[var(--missing)]";
    case "neutral":
    default:
      return "text-[var(--foreground)]";
  }
}

function formatValidationStatus(uiState: ForwardObservationUiState) {
  switch (uiState.status) {
    case "observation_ready":
      return "ready";
    case "loading_readiness":
    case "loading_observation_rows":
    case "not_ready_for_selected_run":
    case "using_selected_run":
    case "using_recommended_observable_run":
      return "pending";
    case "readiness_unavailable":
    case "no_observable_run":
    case "observation_rows_error":
    case "observation_ready_summary_missing":
    case "observation_empty":
      return "unavailable";
  }
}

function getOutcomeSummaryStatus({
  summary,
  uiState,
}: {
  summary: ForwardObservationSummary | null;
  uiState: ForwardObservationUiState;
}): { label: string; tone: StatusTone } {
  if (uiState.status === "observation_ready") {
    if (summary?.completeCount === 0 && summary.partialCount > 0) {
      return { label: "Outcomes partial", tone: "partial" };
    }

    if (summary?.completeCount === 0 && summary.missingCount > 0) {
      return { label: "Window pending", tone: "partial" };
    }

    return { label: "Source ready", tone: "observation" };
  }

  if (
    uiState.status === "not_ready_for_selected_run" ||
    uiState.status === "loading_readiness" ||
    uiState.status === "loading_observation_rows"
  ) {
    return {
      label: formatForwardObservationUiStatusLabel(uiState),
      tone: "partial",
    };
  }

  return {
    label: formatForwardObservationUiStatusLabel(uiState),
    tone: "neutral",
  };
}

function ForwardObservationStatePanel({
  uiState,
  readiness,
}: {
  uiState: ForwardObservationUiState;
  readiness: HistoricalObservationReadinessResponse | null;
}) {
  const title = getForwardObservationPanelTitle(uiState);
  const message = getForwardObservationPanelMessage({
    uiState,
    readiness,
  });

  return (
    <div className="border-l-2 border-l-[var(--observation)] bg-[var(--observation-bg)] py-1 pl-3 pr-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 max-w-3xl text-xs leading-5 text-[var(--muted)]">
        {message}
      </p>
    </div>
  );
}

function ObservationDataStatusLegend() {
  return (
    <div className="terminal-panel mb-3 px-3 py-2 text-xs leading-5 text-[var(--muted)]">
      <span className="font-semibold text-[var(--foreground)]">Outcome Status:</span>{" "}
      Complete has the selected future window, Partial has fewer future candles,
      Missing has no usable future window.
    </div>
  );
}

function ObservationSummarySection({ summary }: {
  summary: ObservationSummary;
  window: ObservationWindow;
}) {
  return (
    <section className="terminal-panel-data flex min-w-0 flex-wrap items-center gap-1 px-2 py-1 shadow-none">
      <SummaryStripStat
        label="Complete"
        value={formatCount(summary.completeCount)}
        tone="complete"
      />
      <SummaryStripStat
        label="Partial"
        value={formatCount(summary.partialCount)}
        tone="partial"
      />
      <SummaryStripStat
        label="Missing"
        value={formatCount(summary.missingCount)}
        tone="missing"
      />
      <SummaryStripStat
        label="Median"
        value={formatCompactObservationSummaryPercent(
          summary.medianObservedChangePct,
        )}
        tone={getObservedSummaryTone(summary.medianObservedChangePct)}
      />
      <SummaryStripStat
        label="Positive"
        value={formatCompactObservationSummaryPercent(summary.positiveRatePct)}
        tone={getPositiveRateTone(summary.positiveRatePct)}
      />
      <SummaryStripStat
        label="Drawdown"
        value={formatCompactObservationSummaryPercent(
          summary.worstMaxDrawdownPct,
        )}
        tone={getDrawdownSummaryTone(summary.worstMaxDrawdownPct)}
      />
    </section>
  );
}

function SummaryStripStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: StatusTone;
}) {
  return (
    <span
      className={`inline-flex h-5 max-w-full items-center justify-center gap-1 whitespace-nowrap border border-l-2 bg-[var(--panel-muted)] px-1.5 text-[10px] [line-height:1] ${getHistoryStatusToneBorderClass(
        tone,
      )}`}
    >
      <span className="shrink-0 font-semibold uppercase text-[var(--muted)]">
        {label}
      </span>
      <span
        className={`min-w-0 truncate font-mono font-semibold tabular-nums ${getHistoryStatusToneTextClass(
          tone,
        )}`}
      >
        {value}
      </span>
    </span>
  );
}

function GroupDistributionTable({
  groups,
}: {
  groups: ObservationGroupSummary[];
}) {
  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold">Group distribution</h4>
      <p className="mt-1 max-w-3xl text-xs leading-5 text-[var(--muted)]">
        Complete rows only; partial and missing rows are counted separately.
      </p>
      {groups.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">
          Not enough complete rows
        </p>
      ) : (
        <DataTableScroll>
          <DataTable minWidth="min-w-[860px]">
            <thead className="bg-[var(--table-header)] text-xs uppercase text-[var(--muted)]">
              <tr>
                <DataTableHeaderCell>Group</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Rows</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Complete</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Partial</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Missing</DataTableHeaderCell>
                <DataTableHeaderCell align="right">
                  Median return
                </DataTableHeaderCell>
                <DataTableHeaderCell align="right">
                  Average return
                </DataTableHeaderCell>
                <DataTableHeaderCell align="right">
                  Median drawdown
                </DataTableHeaderCell>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr
                  key={group.groupKey}
                  className="border-t border-[var(--border)] odd:bg-[var(--panel-data)] even:bg-[var(--panel-muted)] hover:bg-[var(--row-hover)]"
                >
                  <DataTableCell className="font-semibold text-[var(--foreground)]">
                    {group.groupLabel}
                  </DataTableCell>
                  <DataTableCell align="right" className="tabular-nums">
                    {formatCount(group.rows)}
                  </DataTableCell>
                  <DataTableCell align="right" className="tabular-nums">
                    {formatCount(group.complete)}
                  </DataTableCell>
                  <DataTableCell align="right" className="tabular-nums">
                    {formatCount(group.partial)}
                  </DataTableCell>
                  <DataTableCell align="right" className="tabular-nums">
                    {formatCount(group.missing)}
                  </DataTableCell>
                  <DataTableCell align="right" className="tabular-nums">
                    {formatObservationSummaryPercent(
                      group.medianObservedChangePct,
                    )}
                  </DataTableCell>
                  <DataTableCell align="right" className="tabular-nums">
                    {formatObservationSummaryPercent(
                      group.averageObservedChangePct,
                    )}
                  </DataTableCell>
                  <DataTableCell align="right" className="tabular-nums">
                    {formatObservationSummaryPercent(group.medianMaxDrawdownPct)}
                  </DataTableCell>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </DataTableScroll>
      )}
    </div>
  );
}

function NotableHistoricalExamples({
  summary,
}: {
  summary: ObservationSummary;
}) {
  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold">Notable symbols</h4>
      <p className="mt-1 max-w-3xl text-xs leading-5 text-[var(--muted)]">
        Largest returns and drawdowns from complete rows.
      </p>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <NotableExampleList
          title="Largest positive returns"
          examples={summary.notable.largestPositiveObservedChanges}
        />
        <NotableExampleList
          title="Largest negative returns"
          examples={summary.notable.largestNegativeObservedChanges}
        />
        <NotableExampleList
          title="Largest drawdowns"
          examples={summary.notable.largestObservedDrawdowns}
        />
      </div>
    </div>
  );
}

function NotableExampleList({
  title,
  examples,
}: {
  title: string;
  examples: ObservationNotableExample[];
}) {
  return (
    <div className="border border-[var(--border)] bg-[var(--panel)] p-3">
      <h5 className="text-xs font-semibold uppercase tracking-normal text-[var(--muted)]">
        {title}
      </h5>
      {examples.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--muted)]">
          Not enough complete rows
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {examples.map((example) => (
            <li
              key={`${title}-${example.symbol}`}
              className="border-t border-[var(--border)] py-2 text-xs first:border-t-0"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold">{example.symbol}</span>
                <span className="text-[var(--muted)]">{example.groupLabel}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[var(--muted)]">
                <span>
                  Return{" "}
                  {formatObservationPercent(example.observedChangePct)}
                </span>
                {example.maxDrawdownPct !== null ? (
                  <span>
                    Drawdown{" "}
                    {formatObservationPercent(example.maxDrawdownPct)}
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function getForwardObservationPanelTitle(uiState: ForwardObservationUiState) {
  switch (uiState.status) {
    case "loading_readiness":
      return "Loading Validation Source";
    case "readiness_unavailable":
      return "Validation Source unavailable";
    case "not_ready_for_selected_run":
      return "Selected Run is not mature";
    case "no_observable_run":
      return isMarketCoverageBlocker(uiState)
        ? "Validation Source unavailable"
        : "No Validation Source available";
    case "using_selected_run":
      return "Using Selected Run";
    case "using_recommended_observable_run":
      return "Using Validation Source";
    case "loading_observation_rows":
      return "Loading Outcome Rows";
    case "observation_rows_error":
      return "Outcome Rows unavailable";
    case "observation_ready_summary_missing":
      return "Outcome Rows not returned";
    case "observation_empty":
      return "No Outcome Rows returned";
    case "observation_ready":
      return "Validation ready";
  }
}

function getForwardObservationPanelMessage({
  uiState,
  readiness,
}: {
  uiState: ForwardObservationUiState;
  readiness: HistoricalObservationReadinessResponse | null;
}) {
  switch (uiState.status) {
    case "loading_readiness":
      return "Checking completed candles for the selected forward window.";
    case "readiness_unavailable":
      return "Validation Source readiness could not be determined.";
    case "not_ready_for_selected_run":
      if (isWaitingForFutureCandlesDiagnostic(uiState, readiness)) {
        return "The Selected Run is waiting for completed future candles.";
      }

      return "The Selected Run is not mature for this forward window.";
    case "no_observable_run":
      if (isStaleMarketDataDiagnostic(uiState, readiness)) {
        return "Market data appears stale for this forward window.";
      }

      if (isMarketCoverageBlocker(uiState)) {
        return "Stored candles do not cover enough completed future candles.";
      }

      return "No mature validation source is available within the readiness search window.";
    case "using_selected_run":
      return "The Selected Run is also the Validation Source.";
    case "using_recommended_observable_run":
      return "The Selected Run remains unchanged; Outcome Rows use the Validation Source.";
    case "loading_observation_rows":
      return "Loading Outcome Rows for the Validation Source.";
    case "observation_rows_error":
      return uiState.observationRowsError ?? "Outcome Rows could not be loaded.";
    case "observation_ready_summary_missing":
      return "Validation Source is available, but no Outcome Rows were returned.";
    case "observation_empty":
      return "Validation Source is available, but it has no Outcome Rows for this forward window.";
    case "observation_ready":
      return formatObservationReadinessMessage(readiness);
  }
}

function isMarketCoverageBlocker(uiState: ForwardObservationUiState) {
  return (
    uiState.status === "no_observable_run" &&
    uiState.blocker === "market_data_coverage"
  );
}

function isStaleMarketDataDiagnostic(
  uiState: ForwardObservationUiState,
  readiness: HistoricalObservationReadinessResponse | null,
) {
  return (
    getObservationDiagnosticBlocker(uiState, readiness) === "stale_market_data"
  );
}

function isWaitingForFutureCandlesDiagnostic(
  uiState: ForwardObservationUiState,
  readiness: HistoricalObservationReadinessResponse | null,
) {
  return (
    getObservationDiagnosticBlocker(uiState, readiness) ===
    "waiting_for_future_candles"
  );
}

function getObservationDiagnosticBlocker(
  uiState: ForwardObservationUiState,
  readiness: HistoricalObservationReadinessResponse | null,
) {
  const selectedRunId = uiState.selectedRun?.runId ?? null;
  const selectedReadiness =
    selectedRunId && readiness?.selectedRun?.run.runId === selectedRunId
      ? readiness.selectedRun
      : readiness?.selectedRun;

  return (
    selectedReadiness?.diagnosticBlocker ??
    readiness?.metadata.diagnosticBlocker ??
    null
  );
}

function formatObservationBlocker(
  blocker: ObservationReadinessBlocker | null | undefined,
  missingReason: string | null,
) {
  if (blocker === "market_data_coverage") {
    return "Market candle coverage";
  }

  if (blocker === "time_maturity") {
    return "Time maturity";
  }

  if (blocker === "mixed") {
    return "Mixed readiness";
  }

  if (missingReason) {
    return formatMissingReason(missingReason);
  }

  switch (blocker) {
    case "observable":
      return "Observable";
    case "unavailable":
      return "Unavailable";
    case "no_runs":
      return "No runs";
    default:
      return "Missing data";
  }
}

function formatObservationDiagnosticBlocker(
  blocker: ObservationDiagnosticBlocker | null | undefined,
) {
  switch (blocker) {
    case "observable":
      return "Observable";
    case "waiting_for_future_candles":
      return "Waiting for future candles";
    case "stale_market_data":
      return "Market data appears stale";
    case "no_runs":
      return "No runs";
    case "unavailable":
    default:
      return "Unavailable";
  }
}

function formatCoverageLag(readinessRun: HistoricalObservationReadinessRun) {
  const candles = readinessRun.coverageLagCandles;
  const ms = readinessRun.coverageLagMs;

  if (typeof candles === "number" && Number.isFinite(candles) && candles > 0) {
    return `${formatCount(candles)} ${candles === 1 ? "candle" : "candles"}`;
  }

  if (typeof ms === "number" && Number.isFinite(ms) && ms > 0) {
    return formatDuration(Math.ceil(ms / 3_600_000), "hour");
  }

  return "No lag detected";
}

export function SnapshotTable({
  rows,
  selectedRunId,
  rowCountEstimate,
  isRequested,
  isLoading,
  isError = false,
  errorMessage = null,
  initialSortState = null,
}: {
  rows: HistoricalSnapshotRow[];
  selectedRunId?: string | null;
  rowCountEstimate?: number | null;
  isRequested?: boolean;
  isLoading: boolean;
  isError?: boolean;
  errorMessage?: string | null;
  initialSortState?: DataSortState<SnapshotRowsSortKey> | null;
}) {
  const { dictionary } = useAppLanguage();
  const requested = isRequested ?? true;
  const [sortState, setSortState] =
    useState<DataSortState<SnapshotRowsSortKey> | null>(initialSortState);
  const indexedRows = useMemo(
    () => rows.map((row, sourceIndex) => ({ row, sourceIndex })),
    [rows],
  );
  const visibleRows = useMemo(
    () => sortDataRows(indexedRows, sortState, getSnapshotRowsSortValue),
    [indexedRows, sortState],
  );
  const updateSort = (
    key: SnapshotRowsSortKey,
    defaultDirection: DataSortDirection,
  ) => {
    setSortState((current) =>
      getNextDataSortState({ current, key, defaultDirection }),
    );
  };
  const rowStatusLabel = getSnapshotRowsStatusLabel({
    requested,
    isLoading,
    isError,
    rowCount: rows.length,
    rowCountEstimate,
  });

  return (
    <details
      className="terminal-panel-data shrink-0 overflow-hidden"
    >
      <summary className="terminal-panel-header cursor-pointer list-none marker:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="terminal-panel-title">
            Original Ranking Rows
          </h2>
        </div>
        <StatusBadge
          tone={
            isError
              ? "risk"
              : isLoading
                ? "partial"
                : requested
                  ? "accent"
                  : "missing"
          }
          className="h-5 justify-center !py-0 text-[10px] [line-height:1]"
        >
          {rowStatusLabel}
        </StatusBadge>
      </summary>
      <div className="border-t border-[var(--border)] px-2 py-2">
        <p className="mb-2 text-[11px] leading-4 text-[var(--muted)]">
          Original ranking output from Selected Run. Research opens current
          symbol view, not historical replay.
        </p>
      {!requested ? (
        <div className="terminal-state-panel">
          <p className="text-[12px] leading-5 text-[var(--muted)]">
            Rows load automatically after selecting a run to keep the initial
            archive page light.
            {selectedRunId ? ` Selected run ${shortRunId(selectedRunId)}.` : ""}
          </p>
        </div>
      ) : isError ? (
        <StatePanel
          title="Original rows unavailable"
          message={errorMessage ?? "Original ranking rows could not be loaded."}
        />
      ) : isLoading && rows.length === 0 ? (
        <StatePanel title="Loading rows" message="Loading original ranking rows." />
      ) : rows.length === 0 ? (
        <StatePanel
          title="No rows"
          message="No ranking rows are available for the Selected Run."
        />
      ) : (
        <DataTableScroll className="max-h-72 !overflow-x-auto !overflow-y-auto">
          <DataTable minWidth="min-w-[1180px]">
            <thead className="sticky top-0 z-20 bg-[var(--table-header)] text-[10px] uppercase tracking-normal text-[var(--muted)]">
              <tr>
                <DataTableHeaderCell
                  sortKey="index"
                  sortState={sortState}
                  onSortChange={updateSort}
                  align="right"
                >
                  #
                </DataTableHeaderCell>
                <DataTableHeaderCell
                  sortKey="symbol"
                  sortState={sortState}
                  onSortChange={updateSort}
                >
                  Symbol
                </DataTableHeaderCell>
                <DataTableHeaderCell
                  sortKey="market"
                  sortState={sortState}
                  onSortChange={updateSort}
                >
                  Market
                </DataTableHeaderCell>
                <DataTableHeaderCell
                  sortKey="group"
                  sortState={sortState}
                  defaultDirection="desc"
                  onSortChange={updateSort}
                >
                  Group
                </DataTableHeaderCell>
                <DataTableHeaderCell
                  sortKey="label"
                  sortState={sortState}
                  onSortChange={updateSort}
                >
                  Label
                </DataTableHeaderCell>
                <DataTableHeaderCell>Primary Signal</DataTableHeaderCell>
                <DataTableHeaderCell>Risk Notes</DataTableHeaderCell>
                <DataTableHeaderCell
                  sortKey="rank_score"
                  sortState={sortState}
                  defaultDirection="desc"
                  onSortChange={updateSort}
                  align="right"
                >
                  Rank Score
                </DataTableHeaderCell>
                <DataTableHeaderCell>Components</DataTableHeaderCell>
                <DataTableHeaderCell>Versions</DataTableHeaderCell>
                <DataTableHeaderCell>Research</DataTableHeaderCell>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(({ row, sourceIndex }) => (
                <tr
                  key={row.id}
                  className="border-t border-[var(--table-grid)] odd:bg-[var(--panel-data)] even:bg-[var(--panel-muted)] hover:bg-[var(--row-hover)]"
                >
                  <DataTableCell align="right" className="font-mono tabular-nums">
                    {sourceIndex + 1}
                  </DataTableCell>
                  <DataTableCell className="font-semibold text-[var(--foreground)]">
                    {row.symbol}
                  </DataTableCell>
                  <DataTableCell>
                    {formatMarket(row)}
                  </DataTableCell>
                  <DataTableCell>
                    <GroupChip
                      group={normalizeGroupKey(row.group)}
                      dictionary={dictionary}
                    />
                  </DataTableCell>
                  <DataTableCell>
                    <DataTableChip title={formatSignalLabel(row.label, dictionary)}>
                      {formatSignalLabel(row.label, dictionary)}
                    </DataTableChip>
                  </DataTableCell>
                  <DataTableCell
                    className="max-w-[160px] text-[var(--foreground)]"
                    truncate
                    title={formatHistoryPrimarySignal(row.primarySignal, dictionary)}
                  >
                    {formatHistoryPrimarySignal(row.primarySignal, dictionary)}
                  </DataTableCell>
                  <DataTableCell
                    className="max-w-[240px]"
                    truncate
                    title={formatRiskNotes(row)}
                  >
                    {formatRiskNotes(row)}
                  </DataTableCell>
                  <DataTableCell align="right" className="font-mono tabular-nums">
                    {formatScore(row.rankScore)}
                  </DataTableCell>
                  <DataTableCell
                    className="max-w-[180px]"
                    truncate
                    title={formatComponentScores(row.componentScores)}
                  >
                    {formatComponentScores(row.componentScores)}
                  </DataTableCell>
                  <DataTableCell
                    className="max-w-[150px]"
                    truncate
                    title={formatVersions(row)}
                  >
                    {formatVersions(row)}
                  </DataTableCell>
                  <DataTableCell>
                    <Link
                      href={buildSymbolResearchHref({
                        exchange: row.exchange ?? "binance",
                        symbol: row.symbol,
                        timeframe: row.timeframe,
                        assetClass,
                      })}
                      className="terminal-mini-action is-accent px-2 py-1"
                    >
                      Research
                    </Link>
                  </DataTableCell>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </DataTableScroll>
      )}
      </div>
    </details>
  );
}

function getSnapshotRowsStatusLabel({
  requested,
  isLoading,
  isError,
  rowCount,
  rowCountEstimate,
}: {
  requested: boolean;
  isLoading: boolean;
  isError: boolean;
  rowCount: number;
  rowCountEstimate?: number | null;
}) {
  if (isError) {
    return "Error";
  }

  if (isLoading) {
    return "Loading";
  }

  if (!requested) {
    return rowCountEstimate
      ? `${formatCount(rowCountEstimate)} rows available`
      : "Load on open";
  }

  return `${formatCount(rowCount)} rows`;
}

function getSnapshotRowsSortValue(
  item: SnapshotIndexedRow,
  key: SnapshotRowsSortKey,
): DataSortValue {
  switch (key) {
    case "index":
      return item.sourceIndex + 1;
    case "symbol":
      return item.row.symbol;
    case "market":
      return formatMarket(item.row);
    case "group":
      return getHistoryGroupSortRank(normalizeGroupKey(item.row.group));
    case "label":
      return formatSignalLabel(item.row.label);
    case "rank_score":
      return item.row.rankScore;
  }
}

function StatePanel({ title, message }: { title: string; message: string }) {
  return (
    <div className="terminal-state-panel">
      <h3 className="text-[12px] font-semibold text-[var(--foreground)]">
        {title}
      </h3>
      <p className="mt-1 text-[11px] leading-4 text-[var(--muted)]">{message}</p>
    </div>
  );
}

export function buildHistorySnapshotsQueryKey({
  timeframe,
  assetClass,
}: {
  timeframe: HistoryTimeframe;
  assetClass: string;
}) {
  return [historySnapshotsQueryName, timeframe, assetClass] as const;
}

export function buildHistorySnapshotQueryKey({
  runId,
  assetClass,
}: {
  runId: string | null;
  assetClass: string;
}) {
  return [historySnapshotQueryName, runId, assetClass] as const;
}

export function buildHistoryObservationReadinessQueryKey({
  timeframe,
  runId,
  assetClass,
  window,
}: {
  timeframe: HistoryTimeframe;
  runId: string | null;
  assetClass: string;
  window: ObservationWindow;
}) {
  return [
    historyObservationReadinessQueryName,
    timeframe,
    runId,
    assetClass,
    window,
  ] as const;
}

export function buildHistorySnapshotObservationsQueryKey({
  runId,
  assetClass,
  window,
}: {
  runId: string | null;
  assetClass: string;
  window: ObservationWindow;
}) {
  return [
    historySnapshotObservationsQueryName,
    runId,
    assetClass,
    window,
  ] as const;
}

export function buildHistoryRefreshScope({
  timeframe,
  assetClass,
  selectedRunId,
  observationRunId,
  window,
}: {
  timeframe: HistoryTimeframe;
  assetClass: string;
  selectedRunId: string | null;
  observationRunId: string | null;
  window: ObservationWindow;
}) {
  return {
    timeframe,
    blockingQueryKeys: [
      buildHistorySnapshotsQueryKey({ timeframe, assetClass }),
      ...(selectedRunId
        ? [
            buildHistorySnapshotQueryKey({
              runId: selectedRunId,
              assetClass,
            }),
            buildHistoryObservationReadinessQueryKey({
              timeframe,
              runId: selectedRunId,
              assetClass,
              window,
            }),
          ]
        : []),
    ],
    backgroundQueryKeys: observationRunId
      ? [
          buildHistorySnapshotObservationsQueryKey({
            runId: observationRunId,
            assetClass,
            window,
          }),
        ]
      : [],
  };
}

export function isHistoryRefreshActiveForTimeframe({
  refreshingTimeframe,
  timeframe,
}: {
  refreshingTimeframe: HistoryTimeframe | null;
  timeframe: HistoryTimeframe;
}) {
  return refreshingTimeframe === timeframe;
}

export function getNextRefreshingTimeframeAfterCompletion({
  refreshingTimeframe,
  completedTimeframe,
}: {
  refreshingTimeframe: HistoryTimeframe | null;
  completedTimeframe: HistoryTimeframe;
}) {
  return refreshingTimeframe === completedTimeframe
    ? null
    : refreshingTimeframe;
}

export function getObservationProbeRuns({
  snapshots,
  selectedRunId,
  window,
}: {
  snapshots: HistoricalSnapshotRun[];
  selectedRunId: string | null;
  window: ObservationWindow;
}) {
  if (!selectedRunId) {
    return [];
  }

  const selectedIndex = snapshots.findIndex((run) => run.runId === selectedRunId);

  if (selectedIndex < 0) {
    return [];
  }

  return snapshots.slice(
    selectedIndex,
    selectedIndex + getObservationProbeLimit(window),
  );
}

export function classifyForwardObservationMaturity(
  response: HistoricalSnapshotObservationsResponse | null,
): ForwardObservationMaturity {
  if (!response) {
    return emptyForwardObservationMaturity();
  }

  const metadata = response.metadata;
  const readyCount = metadata.completeCount + metadata.partialCount;
  const { reason, count } = getDominantMissingReason(response.rows);

  if (metadata.rowCount <= 0 || response.rows.length === 0) {
    return {
      ...emptyForwardObservationMaturity(),
      rowCount: metadata.rowCount,
      completeCount: metadata.completeCount,
      partialCount: metadata.partialCount,
      missingCount: metadata.missingCount,
      dominantMissingReason: reason,
      dominantMissingReasonCount: count,
    };
  }

  if (readyCount > 0) {
    return {
      state: "ready",
      readyCount,
      rowCount: metadata.rowCount,
      completeCount: metadata.completeCount,
      partialCount: metadata.partialCount,
      missingCount: metadata.missingCount,
      dominantMissingReason: reason,
      dominantMissingReasonCount: count,
    };
  }

  const allRowsMissing =
    metadata.missingCount === metadata.rowCount &&
    metadata.rowCount > 0;
  const state =
    allRowsMissing && isFutureCandleMissingReason(reason)
      ? "not_ready"
      : "empty_or_unavailable";

  return {
    state,
    readyCount,
    rowCount: metadata.rowCount,
    completeCount: metadata.completeCount,
    partialCount: metadata.partialCount,
    missingCount: metadata.missingCount,
    dominantMissingReason: reason,
    dominantMissingReasonCount: count,
  };
}

export function selectForwardObservationResult({
  selectedRunId,
  candidates,
}: {
  selectedRunId: string | null;
  candidates: ForwardObservationCandidate[];
}): ForwardObservationSelection {
  if (!selectedRunId || candidates.length === 0) {
    return emptyForwardObservationSelection();
  }

  const enriched = candidates.map((candidate) => ({
    ...candidate,
    maturity: classifyForwardObservationMaturity(candidate.response),
  }));
  const selected =
    enriched.find((candidate) => candidate.run.runId === selectedRunId) ??
    enriched[0];

  if (!selected.response && selected.isLoading) {
    return {
      response: null,
      maturity: null,
      run: selected.run,
      mode: "selected",
      isLoading: true,
      isFetching: true,
      error: null,
    };
  }

  if (selected.error) {
    return {
      response: null,
      maturity: null,
      run: selected.run,
      mode: "unavailable",
      isLoading: false,
      isFetching: selected.isFetching,
      error: selected.error,
    };
  }

  if (selected.maturity.state === "ready") {
    return buildForwardObservationSelection({
      candidate: selected,
      mode: "selected",
      candidates: enriched,
    });
  }

  if (selected.maturity.state === "not_ready") {
    const readyCandidate = enriched.find(
      (candidate) => candidate.maturity.state === "ready",
    );

    if (readyCandidate) {
      return buildForwardObservationSelection({
        candidate: readyCandidate,
        mode: "observable",
        candidates: enriched,
      });
    }

    const pendingProbe = enriched.some(
      (candidate) =>
        candidate.run.runId !== selectedRunId &&
        !candidate.response &&
        candidate.isLoading,
    );

    if (pendingProbe) {
      return {
        response: selected.response,
        maturity: selected.maturity,
        run: selected.response?.run ?? selected.run,
        mode: "not_ready",
        isLoading: true,
        isFetching: true,
        error: null,
      };
    }

    return buildForwardObservationSelection({
      candidate: selected,
      mode: "not_ready",
      candidates: enriched,
    });
  }

  return buildForwardObservationSelection({
    candidate: selected,
    mode: "unavailable",
    candidates: enriched,
  });
}

function getForwardObservationSelectionMode({
  selectedRunId,
  readiness,
}: {
  selectedRunId: string | null;
  readiness: HistoricalObservationReadinessResponse | null;
}): ForwardObservationSelectionMode {
  if (!selectedRunId || !readiness) {
    return "unavailable";
  }

  const observationRunId =
    readiness.observationRun?.state === "ready"
      ? readiness.observationRun.run.runId
      : readiness.selectedRun?.state === "ready"
        ? readiness.selectedRun.run.runId
        : null;

  if (observationRunId && observationRunId !== selectedRunId) {
    return "observable";
  }

  if (observationRunId === selectedRunId) {
    return "selected";
  }

  if (readiness.selectedRun?.state === "not_ready") {
    return "not_ready";
  }

  return "unavailable";
}

export function getForwardObservationRowsRunId({
  selectedRunId,
  readiness,
  readinessError,
}: {
  selectedRunId: string | null;
  readiness: HistoricalObservationReadinessResponse | null;
  readinessError: string | null;
}) {
  if (!selectedRunId || readinessError || readiness?.ok !== true) {
    return null;
  }

  if (readiness.observationRun?.state === "ready") {
    return readiness.observationRun.run.runId;
  }

  if (
    readiness.selectedRun?.state === "ready" &&
    (!readiness.observationRun ||
      readiness.observationRun.run.runId === readiness.selectedRun.run.runId)
  ) {
    return readiness.selectedRun.run.runId;
  }

  return null;
}

export function deriveForwardObservationUiState({
  selectedRunId,
  readiness,
  readinessIsLoading,
  readinessError,
  response,
  observationRunId,
  observationIsLoading,
  observationIsFetching,
  observationRowsError,
  fallbackWindow,
}: {
  selectedRunId: string | null;
  readiness: HistoricalObservationReadinessResponse | null;
  readinessIsLoading: boolean;
  readinessError: string | null;
  response: HistoricalSnapshotObservationsResponse | null;
  observationRunId: string | null;
  observationIsLoading: boolean;
  observationIsFetching: boolean;
  observationRowsError: string | null;
  fallbackWindow: ObservationWindow;
}): ForwardObservationUiState {
  const observationReadinessRun = getReadyObservationReadinessRun(readiness);
  const readinessRun = observationReadinessRun ?? readiness?.selectedRun ?? null;
  const observationRun = response?.run ?? observationReadinessRun?.run ?? null;
  const selectedRun = readiness?.selectedRun?.run ?? null;
  const summary = buildForwardObservationSummary({
    response,
    readinessRun,
    fallbackWindow,
    fallbackTimeframe:
      readiness?.metadata.timeframe ??
      observationRun?.timeframe ??
      selectedRun?.timeframe ??
      "4h",
  });
  const maturity = response
    ? classifyForwardObservationMaturity(response)
    : readinessRun
      ? buildForwardObservationMaturityFromReadiness(readinessRun)
      : emptyForwardObservationMaturity();
  const selectionMode = getForwardObservationSelectionMode({
    selectedRunId,
    readiness,
  });
  const effectiveObservationRunId =
    observationRunId ?? observationReadinessRun?.run.runId ?? null;
  const blocker =
    readiness?.selectedRun?.blocker ?? readiness?.metadata.blocker ?? null;
  const base = {
    selectionMode,
    blocker,
    selectedRun,
    observationRun,
    summary,
    maturity,
    readinessError,
    observationRowsError,
    isFetching: observationIsFetching,
  };

  if (!selectedRunId) {
    return {
      ...base,
      status: "readiness_unavailable",
    };
  }

  if (readinessError) {
    return {
      ...base,
      status: "readiness_unavailable",
    };
  }

  if (readinessIsLoading && !readiness) {
    return {
      ...base,
      status: "loading_readiness",
    };
  }

  if (!readiness || readiness.ok !== true) {
    return {
      ...base,
      status: "readiness_unavailable",
    };
  }

  if (!effectiveObservationRunId || !observationReadinessRun) {
    return {
      ...base,
      status:
        readiness.selectedRun?.state === "not_ready" &&
        blocker === "time_maturity"
          ? "not_ready_for_selected_run"
          : "no_observable_run",
    };
  }

  if (observationRowsError) {
    return {
      ...base,
      status: "observation_rows_error",
    };
  }

  if (observationIsLoading && !response) {
    return {
      ...base,
      status: "loading_observation_rows",
    };
  }

  if (response) {
    const expectedRows = summary?.totalRows ?? response.metadata.rowCount;

    if (response.rows.length > 0) {
      return {
        ...base,
        status: "observation_ready",
      };
    }

    return {
      ...base,
      status:
        expectedRows > 0
          ? "observation_ready_summary_missing"
          : "observation_empty",
    };
  }

  return {
    ...base,
    status:
      effectiveObservationRunId === selectedRunId
        ? "using_selected_run"
        : "using_recommended_observable_run",
  };
}

function getReadyObservationReadinessRun(
  readiness: HistoricalObservationReadinessResponse | null,
) {
  if (readiness?.observationRun?.state === "ready") {
    return readiness.observationRun;
  }

  if (readiness?.selectedRun?.state === "ready") {
    return readiness.selectedRun;
  }

  return null;
}

function getObservationResponseExpectedRows(
  response: HistoricalSnapshotObservationsResponse,
) {
  if (response.rows.length > 0) {
    return response.rows.length;
  }

  if (
    typeof response.summary?.totalRows === "number" &&
    Number.isFinite(response.summary.totalRows)
  ) {
    return Math.max(0, response.summary.totalRows);
  }

  if (
    typeof response.run.signalsCreated === "number" &&
    Number.isFinite(response.run.signalsCreated) &&
    response.run.signalsCreated > 0
  ) {
    return response.run.signalsCreated;
  }

  return Math.max(0, response.metadata.rowCount);
}

function countObservationRows(rows: HistoricalSnapshotObservationRow[]) {
  return rows.reduce(
    (counts, row) => ({
      complete: counts.complete + (row.dataStatus === "complete" ? 1 : 0),
      partial: counts.partial + (row.dataStatus === "partial" ? 1 : 0),
      missing: counts.missing + (row.dataStatus === "missing" ? 1 : 0),
    }),
    { complete: 0, partial: 0, missing: 0 },
  );
}

function toForwardObservationSummary({
  window,
  timeframe,
  totalRows,
  returnedRows,
  completeCount,
  partialCount,
  missingCount,
}: {
  window: ObservationWindow;
  timeframe: HistoryTimeframe;
  totalRows: number;
  returnedRows: number;
  completeCount: number;
  partialCount: number;
  missingCount: number;
}): ForwardObservationSummary {
  return {
    window,
    timeframe,
    rowCount: totalRows,
    totalRows,
    returnedRows,
    completeCount,
    partialCount,
    missingCount,
  };
}

function buildForwardObservationSummary({
  response,
  readinessRun,
  fallbackWindow,
  fallbackTimeframe,
}: {
  response: HistoricalSnapshotObservationsResponse | null;
  readinessRun: HistoricalObservationReadinessRun | null;
  fallbackWindow: ObservationWindow;
  fallbackTimeframe: HistoryTimeframe;
}): ForwardObservationSummary | null {
  if (response) {
    const summary = response.summary;

    if (summary) {
      return toForwardObservationSummary({
        window: summary.window,
        timeframe: summary.timeframe,
        totalRows: summary.totalRows,
        returnedRows: summary.returnedRows,
        completeCount: summary.completeCount,
        partialCount: summary.partialCount,
        missingCount: summary.missingCount,
      });
    }

    if (response.rows.length > 0) {
      const counts = countObservationRows(response.rows);

      return toForwardObservationSummary({
        window: response.metadata.window,
        timeframe: response.metadata.timeframe,
        totalRows: response.rows.length,
        returnedRows: response.rows.length,
        completeCount: counts.complete,
        partialCount: counts.partial,
        missingCount: counts.missing,
      });
    }

    const expectedRows = getObservationResponseExpectedRows(response);

    return toForwardObservationSummary({
      window: response.metadata.window,
      timeframe: response.metadata.timeframe,
      totalRows: expectedRows,
      returnedRows: 0,
      completeCount: 0,
      partialCount: 0,
      missingCount: expectedRows,
    });
  }

  if (!readinessRun) {
    return null;
  }

  return toForwardObservationSummary({
    window: fallbackWindow,
    timeframe: fallbackTimeframe,
    totalRows: readinessRun.rowCount,
    returnedRows: readinessRun.rowCount,
    completeCount: readinessRun.completeCount,
    partialCount: readinessRun.partialCount,
    missingCount: readinessRun.missingCount,
  });
}

async function fetchHistoricalSnapshots({
  timeframe,
  assetClass,
  signal,
}: {
  timeframe: HistoryTimeframe;
  assetClass: string;
  signal?: AbortSignal;
}) {
  const response = await fetch(
    buildHistoricalSnapshotsUrl({ timeframe, assetClass, limit: snapshotsLimit }),
    { signal },
  );

  if (!response.ok) {
    throw new Error(`Failed to load historical snapshots (${response.status}).`);
  }

  return (await response.json()) as HistoricalSnapshotsResponse;
}

async function fetchHistoricalSnapshot({
  runId,
  assetClass,
  signal,
}: {
  runId: string;
  assetClass: string;
  signal?: AbortSignal;
}) {
  const response = await fetch(
    buildHistoricalSnapshotUrl({ runId, assetClass }),
    { signal },
  );

  if (!response.ok) {
    throw new Error(`Failed to load historical snapshot (${response.status}).`);
  }

  return (await response.json()) as HistoricalSnapshotDetailResponse;
}

async function fetchHistoricalSnapshotObservations({
  runId,
  assetClass,
  window,
  signal,
}: {
  runId: string;
  assetClass: string;
  window: ObservationWindow;
  signal?: AbortSignal;
}) {
  const response = await fetch(
    buildHistoricalSnapshotObservationsUrl({ runId, assetClass, window }),
    { signal },
  );

  if (!response.ok) {
    throw new Error(
      `Unable to load forward observation (${response.status}).`,
    );
  }

  return (await response.json()) as HistoricalSnapshotObservationsResponse;
}

async function fetchHistoricalObservationReadiness({
  timeframe,
  runId,
  assetClass,
  window,
  signal,
}: {
  timeframe: HistoryTimeframe;
  runId: string | null;
  assetClass: string;
  window: ObservationWindow;
  signal?: AbortSignal;
}) {
  const response = await fetch(
    buildHistoricalObservationReadinessUrl({
      timeframe,
      runId,
      assetClass,
      window,
    }),
    { signal },
  );

  if (!response.ok) {
    throw new Error(
      `Unable to load observation readiness (${response.status}).`,
    );
  }

  const body = (await response.json()) as unknown;

  if (!isHistoricalObservationReadinessResponse(body)) {
    throw new Error("Observation readiness returned an invalid response.");
  }

  return body;
}

export function buildHistoricalSnapshotsUrl({
  timeframe,
  assetClass,
  limit,
  tradeApiBaseUrl = process.env.NEXT_PUBLIC_TRADE_API_BASE_URL,
}: {
  timeframe: string;
  assetClass: string;
  limit: number;
  tradeApiBaseUrl?: string;
}) {
  const params = new URLSearchParams({
    timeframe,
    assetClass,
    limit: String(limit),
  });
  const baseUrl = getVegaRankApiBaseUrl(tradeApiBaseUrl);

  return `${baseUrl}/api/archive/snapshots?${params.toString()}`;
}

export function buildHistoricalSnapshotUrl({
  runId,
  assetClass,
  tradeApiBaseUrl = process.env.NEXT_PUBLIC_TRADE_API_BASE_URL,
}: {
  runId: string;
  assetClass: string;
  tradeApiBaseUrl?: string;
}) {
  const params = new URLSearchParams({ runId, assetClass });
  const baseUrl = getVegaRankApiBaseUrl(tradeApiBaseUrl);

  return `${baseUrl}/api/archive/snapshot?${params.toString()}`;
}

export function buildHistoricalSnapshotObservationsUrl({
  runId,
  assetClass,
  window,
  tradeApiBaseUrl = process.env.NEXT_PUBLIC_TRADE_API_BASE_URL,
}: {
  runId: string;
  assetClass: string;
  window: ObservationWindow;
  tradeApiBaseUrl?: string;
}) {
  const params = new URLSearchParams({
    runId,
    assetClass,
    window: String(window),
  });
  const baseUrl = getVegaRankApiBaseUrl(tradeApiBaseUrl);

  return `${baseUrl}/api/archive/snapshot-observations?${params.toString()}`;
}

export function buildHistoricalObservationReadinessUrl({
  timeframe,
  runId,
  assetClass,
  window,
  tradeApiBaseUrl = process.env.NEXT_PUBLIC_TRADE_API_BASE_URL,
}: {
  timeframe: string;
  runId?: string | null;
  assetClass: string;
  window: ObservationWindow;
  tradeApiBaseUrl?: string;
}) {
  const params = new URLSearchParams({
    timeframe,
    assetClass,
    window: String(window),
  });
  const trimmedRunId = runId?.trim() ?? "";

  if (trimmedRunId) {
    params.set("runId", trimmedRunId);
  }

  const baseUrl = getVegaRankApiBaseUrl(tradeApiBaseUrl);

  return `${baseUrl}/api/archive/observation-readiness?${params.toString()}`;
}

function formatQueryError(error: unknown) {
  return error instanceof Error ? error.message : "Request failed.";
}

function isHistoricalObservationReadinessResponse(
  value: unknown,
): value is HistoricalObservationReadinessResponse {
  if (!isRecord(value) || value.ok !== true) {
    return false;
  }

  if (
    !isHistoricalObservationReadinessRunOrNull(value.selectedRun) ||
    !isHistoricalObservationReadinessRunOrNull(value.recommendedRun) ||
    !isHistoricalObservationReadinessRunOrNull(value.observationRun)
  ) {
    return false;
  }

  if (!isRecord(value.coverage) || !isRecord(value.metadata)) {
    return false;
  }

  return (
    isHistoryTimeframeValue(value.metadata.timeframe) &&
    isObservationWindowValue(value.metadata.window) &&
    isOptionalObservationDiagnosticBlocker(value.metadata.diagnosticBlocker) &&
    typeof value.coverage.totalSymbols === "number" &&
    typeof value.coverage.latestOpenTimeSymbolCount === "number"
  );
}

function isHistoricalObservationReadinessRunOrNull(value: unknown) {
  if (value === null) {
    return true;
  }

  if (!isRecord(value) || !isRecord(value.run)) {
    return false;
  }

  return (
    typeof value.run.runId === "string" &&
    isHistoryTimeframeValue(value.run.timeframe) &&
    isOptionalObservationDiagnosticBlocker(value.diagnosticBlocker) &&
    isOptionalNumberOrNull(value.coverageLagMs) &&
    isOptionalNumberOrNull(value.coverageLagCandles) &&
    typeof value.rowCount === "number" &&
    typeof value.completeCount === "number" &&
    typeof value.partialCount === "number" &&
    typeof value.missingCount === "number"
  );
}

function isOptionalObservationDiagnosticBlocker(value: unknown) {
  return (
    value === undefined ||
    value === null ||
    value === "observable" ||
    value === "waiting_for_future_candles" ||
    value === "stale_market_data" ||
    value === "unavailable" ||
    value === "no_runs"
  );
}

function isOptionalNumberOrNull(value: unknown) {
  return value === undefined || value === null || typeof value === "number";
}

function isHistoryTimeframeValue(value: unknown): value is HistoryTimeframe {
  return (
    typeof value === "string" &&
    HISTORY_TIMEFRAMES.includes(value as HistoryTimeframe)
  );
}

function isObservationWindowValue(value: unknown): value is ObservationWindow {
  return (
    typeof value === "number" &&
    OBSERVATION_WINDOWS.includes(value as ObservationWindow)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

export function formatHistoryDateTime(value: string | null | undefined) {
  return formatDisplayDateTime(value, { timeZone: "utc" });
}

export function formatHistoryPrimarySignal(
  value: string | null | undefined,
  dictionary: ScannerDisplayDictionary = dictionaries.en,
) {
  const label = value?.trim();

  if (!label) {
    return "-";
  }

  const formattedReview = formatScannerReviewValue(label, dictionary);

  if (formattedReview !== label) {
    return formattedReview;
  }

  if (dictionary === dictionaries.en) {
    return unsafePrimarySignalLabelMap[label.toLowerCase()] ?? label;
  }

  return dictionary.scannerResultFallback.unknown;
}

function formatCount(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString()
    : "-";
}

function formatReadinessRunStatus(
  readinessRun: HistoricalObservationReadinessRun | null | undefined,
) {
  if (!readinessRun) {
    return "Unknown";
  }

  if (readinessRun.state === "ready") {
    return "Ready";
  }

  if (readinessRun.diagnosticBlocker) {
    return formatObservationDiagnosticBlocker(readinessRun.diagnosticBlocker);
  }

  return formatMaturityState(
    readinessRun.state === "unavailable"
      ? "empty_or_unavailable"
      : readinessRun.state,
  );
}

function getForwardObservationReadyContextNote({
  uiState,
  readiness,
}: {
  uiState: ForwardObservationUiState;
  readiness: HistoricalObservationReadinessResponse | null;
}) {
  if (
    uiState.selectionMode !== "observable" ||
    !uiState.observationRun ||
    !uiState.selectedRun ||
    uiState.observationRun.runId === uiState.selectedRun.runId
  ) {
    return null;
  }

  const diagnosticBlocker = readiness?.selectedRun?.diagnosticBlocker;
  const runDescription = readiness?.observationRun?.isLimited
    ? "mature run"
    : "mature full-universe run";

  if (diagnosticBlocker === "waiting_for_future_candles") {
    return `Selected Run is still waiting for future candles. Validation Source uses the most recent ${runDescription}.`;
  }

  if (diagnosticBlocker === "stale_market_data") {
    return `Selected Run has stale market data coverage. Validation Source uses the most recent ${runDescription}.`;
  }

  return `Validation Source uses the most recent ${runDescription}.`;
}

function formatObservationNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString(undefined, { maximumFractionDigits: 6 })
    : "-";
}

function formatObservationPercent(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${value.toFixed(2)}%`
    : "-";
}

function formatObservationSummaryPercent(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? formatObservationPercent(value)
    : "Not enough complete rows";
}

function formatCompactObservationSummaryPercent(
  value: number | null | undefined,
) {
  return typeof value === "number" && Number.isFinite(value)
    ? formatObservationPercent(value)
    : "N/A";
}

function formatDataStatus(value: ObservationDataStatus) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatCompactDataStatus(
  status: ObservationDataStatus,
  missingReason: string | null | undefined,
) {
  if (!missingReason) {
    return formatDataStatus(status);
  }

  return `${formatDataStatus(status)} · ${formatCompactMissingReason(
    missingReason,
  )}`;
}

function formatCompactMissingReason(value: string) {
  switch (value) {
    case "insufficient_future_candles":
      return "insufficient candles";
    case "no_future_candles":
      return "no future candles";
    case "run_after_latest_candle":
      return "after latest candle";
    case "missing_anchor":
      return "missing anchor";
    default:
      return "missing data";
  }
}

function formatForwardObservationSelectionMode(
  value: ForwardObservationSelectionMode,
) {
  switch (value) {
    case "selected":
      return "Selected Run";
    case "observable":
      return "Validation Source";
    case "not_ready":
      return "Selected Run not mature";
    case "unavailable":
      return "Unavailable";
  }
}

function formatForwardObservationUiStatusLabel(
  uiState: ForwardObservationUiState,
) {
  switch (uiState.status) {
    case "loading_readiness":
      return "Validation loading";
    case "readiness_unavailable":
      return "Validation unavailable";
    case "not_ready_for_selected_run":
      return "Validation pending";
    case "no_observable_run":
      return isMarketCoverageBlocker(uiState)
        ? "Validation unavailable"
        : "No Validation Source";
    case "using_selected_run":
      return "Validation pending";
    case "loading_observation_rows":
      return "Validation loading";
    case "observation_ready":
      return "Validation ready";
    case "observation_ready_summary_missing":
    case "observation_empty":
    case "observation_rows_error":
      return "Validation unavailable";
    case "using_recommended_observable_run":
      return "Validation Source";
  }
}

function formatMaturityState(value: ForwardObservationMaturityState) {
  switch (value) {
    case "ready":
      return "Ready";
    case "not_ready":
      return "Not ready";
    case "empty_or_unavailable":
      return "Unavailable";
  }
}

function formatMissingReason(value: string) {
  switch (value) {
    case "insufficient_future_candles":
      return "Insufficient future candles";
    case "no_future_candles":
      return "No completed future candles yet";
    case "run_after_latest_candle":
      return "Run is after the latest candle";
    case "missing_anchor":
      return "Missing anchor";
    default:
      return "Missing data";
  }
}

function formatObservationReadinessMessage(
  readiness: HistoricalObservationReadinessResponse | null,
) {
  const blocker = readiness?.metadata.blocker;
  const diagnosticBlocker = readiness?.metadata.diagnosticBlocker;

  if (diagnosticBlocker === "stale_market_data") {
    return "Market data appears stale for this forward window.";
  }

  if (diagnosticBlocker === "waiting_for_future_candles") {
    return "Selected Run is waiting for completed future candles.";
  }

  switch (blocker) {
    case "market_data_coverage":
      return "Market candle coverage is not far enough for this forward window.";
    case "time_maturity":
      return "Selected Run is too recent for this forward window.";
    case "mixed":
      return "Validation is blocked by mixed time maturity and market candle coverage.";
    case "no_runs":
      return "No successful runs are available for this timeframe.";
    case "unavailable":
      return "Validation data is unavailable for the selected window.";
    case "observable":
      return "Outcome Rows are available for this window.";
    default:
      return "Validation is not ready for the selected window.";
  }
}

function formatLatestCoverage(coverage: HistoricalObservationCoverage) {
  const count = formatCount(coverage.latestOpenTimeSymbolCount);
  const total = formatCount(coverage.totalSymbols);
  const pct =
    typeof coverage.latestOpenTimeCoveragePct === "number"
      ? `, ${coverage.latestOpenTimeCoveragePct.toFixed(2)}%`
      : "";

  return `${count} / ${total}${pct}`;
}

function formatApproximateObservationWait(
  timeframe: HistoryTimeframe,
  window: ObservationWindow,
) {
  switch (timeframe) {
    case "1h":
      return formatDuration(window, "hour");
    case "4h":
      return formatDuration(window * 4, "hour");
    case "1d":
      return formatDuration(window, "day");
    case "1w":
      return formatDuration(window, "week");
  }
}

function formatDuration(value: number, unit: "hour" | "day" | "week") {
  return `${value} ${unit}${value === 1 ? "" : "s"}`;
}

function shortRunId(value: string | null | undefined) {
  return value ? value.slice(0, 5) : "-";
}

function formatCompactRunId(value: string | null | undefined) {
  return shortRunId(value);
}

function formatFullUniverse(run: HistoricalSnapshotRun) {
  if (run.isLikelyFullUniverse === true) {
    return "Full";
  }

  if (run.isLikelyFullUniverse === false) {
    return "Limited";
  }

  return "Unknown";
}

function formatMarket(row: HistoricalSnapshotRow) {
  const exchange = row.exchange ?? "binance";
  const market = row.market ?? "spot";

  return `${exchange} / ${market}`;
}

function formatRiskNotes(row: HistoricalSnapshotRow) {
  const riskTypes = row.riskTypes?.length
    ? `Risk types: ${row.riskTypes.join(", ")}.`
    : "";
  const notes = row.riskNotes ?? "";
  const text = [notes, riskTypes].filter(Boolean).join(" ");

  return text || "-";
}

function formatComponentScores(
  scores: HistoricalSnapshotRow["componentScores"],
) {
  if (!scores) {
    return "-";
  }

  return [
    ["Opp", scores.opportunityScore],
    ["Conf", scores.confirmationScore],
    ["Risk", scores.riskScore],
    ["Trend", scores.trendScore],
    ["Mom", scores.momentumScore],
  ]
    .map(([label, value]) => `${label} ${formatScore(value as number | null)}`)
    .join(" / ");
}

function formatVersions(row: HistoricalSnapshotRow) {
  return [
    row.scannerVersion ? `Scanner ${row.scannerVersion}` : null,
    row.scoringVersion ? `Scoring ${row.scoringVersion}` : null,
  ]
    .filter(Boolean)
    .join(" / ") || "-";
}

function getObservationProbeLimit(window: ObservationWindow) {
  return Math.min(maxObservationProbeRuns, Math.max(3, window + 2));
}

function getDominantMissingReason(rows: HistoricalSnapshotObservationRow[]) {
  const counts = new Map<string, number>();

  for (const row of rows) {
    if (!row.missingReason) {
      continue;
    }

    counts.set(row.missingReason, (counts.get(row.missingReason) ?? 0) + 1);
  }

  return [...counts.entries()].reduce(
    (dominant, [reason, count]) =>
      count > dominant.count ? { reason, count } : dominant,
    { reason: null as string | null, count: 0 },
  );
}

function isFutureCandleMissingReason(reason: string | null) {
  return (
    reason === "no_future_candles" ||
    reason === "insufficient_future_candles" ||
    reason === "run_after_latest_candle"
  );
}

function buildForwardObservationMaturityFromReadiness(
  readinessRun: HistoricalObservationReadinessRun,
): ForwardObservationMaturity {
  return {
    state:
      readinessRun.state === "unavailable"
        ? "empty_or_unavailable"
        : readinessRun.state,
    readyCount: readinessRun.completeCount + readinessRun.partialCount,
    rowCount: readinessRun.rowCount,
    completeCount: readinessRun.completeCount,
    partialCount: readinessRun.partialCount,
    missingCount: readinessRun.missingCount,
    dominantMissingReason: readinessRun.dominantMissingReason,
    dominantMissingReasonCount: readinessRun.dominantMissingReasonCount,
  };
}

function emptyForwardObservationMaturity(): ForwardObservationMaturity {
  return {
    state: "empty_or_unavailable",
    readyCount: 0,
    rowCount: 0,
    completeCount: 0,
    partialCount: 0,
    missingCount: 0,
    dominantMissingReason: null,
    dominantMissingReasonCount: 0,
  };
}

function emptyForwardObservationSelection(): ForwardObservationSelection {
  return {
    response: null,
    maturity: null,
    run: null,
    mode: "unavailable",
    isLoading: false,
    isFetching: false,
    error: null,
  };
}

function buildForwardObservationSelection({
  candidate,
  mode,
  candidates,
}: {
  candidate: ForwardObservationCandidate & {
    maturity: ForwardObservationMaturity;
  };
  mode: ForwardObservationSelectionMode;
  candidates: Array<
    ForwardObservationCandidate & {
      maturity: ForwardObservationMaturity;
    }
  >;
}): ForwardObservationSelection {
  return {
    response: candidate.response,
    maturity: candidate.maturity,
    run: candidate.response?.run ?? candidate.run,
    mode,
    isLoading: false,
    isFetching: candidates.some((item) => item.isFetching),
    error: candidate.error,
  };
}
