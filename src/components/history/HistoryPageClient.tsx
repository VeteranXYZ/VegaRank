"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  formatGroupLabel,
  formatScore,
  formatSignalLabel,
  normalizeGroupKey,
} from "@/components/scanner/latestScanUi";
import { buildSymbolResearchHref } from "@/components/symbol/symbolResearchLinks";
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
const historyDisclaimer =
  "Research-only. Not financial advice. Historical observations are not predictions.";
const emptyHistoricalSnapshotRuns: HistoricalSnapshotRun[] = [];
const emptyHistoricalObservationRows: HistoricalSnapshotObservationRow[] = [];
const historySnapshotsQueryName = "history-snapshots";
const historySnapshotQueryName = "history-snapshot";
const historyObservationReadinessQueryName =
  "history-observation-readiness";
const historySnapshotObservationsQueryName =
  "history-snapshot-observations";
export const recentRunsPanelClassName =
  "rounded-md border border-[var(--border)] bg-[var(--panel)] p-4 xl:sticky xl:top-4 xl:flex xl:max-h-[calc(100vh-2rem)] xl:flex-col xl:overflow-hidden";
export const recentRunsScrollContainerClassName =
  "space-y-2 pr-1 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:overscroll-contain xl:rounded-md xl:border xl:border-[var(--border)] xl:bg-[#0d131a]/40 xl:p-2";
const unsafePrimarySignalLabelMap: Record<string, string> = {
  "do not chase": "Overheated caution",
  avoid: "Risk review",
};

type HistoryTimeframe = (typeof HISTORY_TIMEFRAMES)[number];
type ObservationWindow = (typeof OBSERVATION_WINDOWS)[number];
type ObservationDataStatus = "complete" | "partial" | "missing";
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

export function HistoryPageClient() {
  const [timeframe, setTimeframe] = useState<HistoryTimeframe>("4h");
  const [observationWindow, setObservationWindow] =
    useState<ObservationWindow>(3);
  const [manualSelectedRunId, setManualSelectedRunId] = useState<string | null>(
    null,
  );
  const [refreshingTimeframe, setRefreshingTimeframe] =
    useState<HistoryTimeframe | null>(null);
  const snapshotsQuery = useQuery({
    queryKey: buildHistorySnapshotsQueryKey({ timeframe, assetClass }),
    queryFn: ({ signal }) =>
      fetchHistoricalSnapshots({ timeframe, assetClass, signal }),
    staleTime: 60_000,
  });
  const snapshots = snapshotsQuery.data?.snapshots ?? emptyHistoricalSnapshotRuns;
  const selectedRunId =
    manualSelectedRunId && snapshots.some((run) => run.runId === manualSelectedRunId)
      ? manualSelectedRunId
      : snapshots[0]?.runId ?? null;

  const snapshotQuery = useQuery({
    queryKey: buildHistorySnapshotQueryKey({ runId: selectedRunId, assetClass }),
    queryFn: ({ signal }) =>
      fetchHistoricalSnapshot({
        runId: selectedRunId ?? "",
        assetClass,
        signal,
      }),
    enabled: selectedRunId !== null,
    staleTime: 60_000,
  });
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
    enabled: selectedRunId !== null,
    staleTime: 60_000,
  });
  const readinessError = readinessQuery.isError
    ? formatQueryError(readinessQuery.error)
    : null;
  const observationRunId = getForwardObservationRowsRunId({
    selectedRunId,
    readiness: readinessQuery.data ?? null,
    readinessError,
  });
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
    enabled: observationRunId !== null,
    staleTime: 60_000,
  });
  const observationRowsError = observationQuery.isError
    ? formatQueryError(observationQuery.error)
    : null;
  const forwardObservationUiState = deriveForwardObservationUiState({
    selectedRunId,
    readiness: readinessQuery.data ?? null,
    readinessIsLoading:
      selectedRunId !== null &&
      readinessQuery.isLoading &&
      !readinessQuery.data,
    readinessError,
    response: observationQuery.data ?? null,
    observationRunId,
    observationIsLoading:
      observationRunId !== null &&
      observationQuery.isLoading &&
      !observationQuery.data,
    observationIsFetching: observationQuery.isFetching,
    observationRowsError,
    fallbackWindow: observationWindow,
  });
  const rows = snapshotQuery.data?.rows ?? [];
  const selectedRun = snapshotQuery.data?.run ?? null;
  const summaryItems = useMemo(
    () => buildRunSummaryItems(selectedRun),
    [selectedRun],
  );

  const refreshData = () => {
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
      blockingRefreshes.push(snapshotQuery.refetch(), readinessQuery.refetch());
    }

    if (refreshScope.backgroundQueryKeys.length > 0) {
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

  return (
    <section className="mx-auto max-w-[1800px] px-3 py-5 sm:px-4">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase text-[var(--muted)]">Research</p>
          <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
            Historical Research
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
            {historyDisclaimer}
          </p>
        </div>
        <button
          type="button"
          onClick={refreshData}
          disabled={isRefreshing}
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isRefreshing ? "Refreshing" : "Refresh"}
        </button>
      </div>

      <section className="mb-4 rounded-md border border-[var(--border)] bg-[var(--panel)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Timeframe</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Single-timeframe stored scan runs only.
            </p>
          </div>
          <div className="flex rounded-md border border-[var(--border)] p-1">
            {HISTORY_TIMEFRAMES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setTimeframe(option)}
                className={`min-w-12 rounded px-3 py-1.5 text-sm font-semibold ${
                  option === timeframe
                    ? "bg-[var(--foreground)] text-[var(--background)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)] xl:items-start">
        <RecentSuccessfulRunsPanel
          timeframe={timeframe}
          snapshots={snapshots}
          selectedRunId={selectedRunId}
          latestRunId={snapshots[0]?.runId ?? null}
          observationRunId={forwardObservationUiState.observationRun?.runId ?? null}
          recommendedRunId={
            readinessQuery.data?.recommendedRun?.run.runId ?? null
          }
          isError={snapshotsQuery.isError}
          errorMessage={
            snapshotsQuery.isError ? formatQueryError(snapshotsQuery.error) : null
          }
          isLoading={snapshotsQuery.isLoading}
          onSelectRun={setManualSelectedRunId}
        />

        <div className="space-y-4">
          <section className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Selected Stored Run</h2>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  This is the scanner snapshot you selected. Snapshot Rows below
                  come from this run. Forward Observation may use a different
                  mature observation run for research context when this selected
                  stored run is still waiting for future candles.
                </p>
              </div>
              {snapshotQuery.data ? (
                <span className="rounded border border-[var(--border)] px-2 py-1 text-xs font-semibold text-[var(--muted)]">
                  {snapshotQuery.data.metadata.rowCount} rows, full stored set
                </span>
              ) : null}
            </div>
            {snapshotQuery.isError ? (
              <StatePanel
                title="Snapshot unavailable"
                message={formatQueryError(snapshotQuery.error)}
              />
            ) : snapshotQuery.isLoading && selectedRunId ? (
              <StatePanel
                title="Loading snapshot"
                message="Loading selected historical scan rows."
              />
            ) : !selectedRun ? (
              <StatePanel
                title="No run selected"
                message="Select a successful run to review its stored snapshot."
              />
            ) : (
              <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-4">
                {summaryItems.map((item) => (
                  <Metric key={item.label} label={item.label} value={item.value} />
                ))}
              </div>
            )}
          </section>

          <ForwardObservationSection
            window={observationWindow}
            onWindowChange={setObservationWindow}
            response={observationQuery.data ?? null}
            readiness={readinessQuery.data ?? null}
            uiState={forwardObservationUiState}
          />

          <SnapshotTable rows={rows} isLoading={snapshotQuery.isFetching} />
        </div>
      </div>
    </section>
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
      aria-label="Recent successful runs"
    >
      <div className="mb-3 shrink-0">
        <h2 className="text-base font-semibold">Recent Successful Runs</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Showing recent successful {timeframe} runs from Postgres.
        </p>
      </div>
      {isError ? (
        <StatePanel
          title="History unavailable"
          message={errorMessage ?? "Stored scan runs could not be loaded."}
        />
      ) : isLoading ? (
        <StatePanel title="Loading runs" message="Loading stored scan runs." />
      ) : snapshots.length === 0 ? (
        <StatePanel
          title="No stored runs"
          message={`No successful ${timeframe} historical snapshots are available.`}
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
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className="truncate text-sm font-semibold"
                      title={run.runId}
                    >
                      {formatCompactRunId(run.runId)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      Finished {formatHistoryDateTime(run.finishedAt)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded border border-[var(--border)] px-2 py-1 text-xs font-semibold">
                    {run.timeframe}
                  </span>
                </div>
                {badges.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {badges.map((badge) => (
                      <span
                        key={badge}
                        className="rounded border border-[var(--border)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-normal text-[var(--muted)]"
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--muted)]">
                  <span>Scanned {formatCount(run.symbolsScanned)}</span>
                  <span>Signals {formatCount(run.signalsCreated)}</span>
                  <span>Skipped {formatCount(run.skipped)}</span>
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
    runId === observationRunId ? "Mature observation" : null,
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
    "w-full rounded-md border p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

  if (isSelected) {
    return `${base} border-[var(--foreground)] bg-[#111820]`;
  }

  if (run.isLikelyFullUniverse === true) {
    return `${base} border-[var(--border)] bg-[#0f151c] hover:border-[var(--muted)]`;
  }

  return `${base} border-[var(--border)] opacity-75 hover:border-[var(--muted)] hover:opacity-100`;
}

export function ForwardObservationSection({
  window,
  onWindowChange,
  response,
  readiness,
  uiState,
}: {
  window: ObservationWindow;
  onWindowChange: (window: ObservationWindow) => void;
  response: HistoricalSnapshotObservationsResponse | null;
  readiness?: HistoricalObservationReadinessResponse | null;
  uiState: ForwardObservationUiState;
}) {
  const rows = response?.rows ?? emptyHistoricalObservationRows;
  const summary = uiState.summary;
  const selectedReadiness = readiness?.selectedRun ?? null;
  const selectedReadinessRun = selectedReadiness?.run ?? uiState.selectedRun;
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
  const stateTakeaways = showObservationSummary
    ? []
    : buildResearchTakeaways({
        summary: null,
        uiState,
      });

  return (
    <section className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Forward Observation</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Research-only. Historical observations are not predictions.
          </p>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-[var(--muted)]">
            Forward Observation uses completed future candles from the observation
            run. If the selected stored run is not mature yet, this section may
            use the latest mature full-universe run for observation metrics.
          </p>
          <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
            {formatForwardObservationUiStatusLabel(uiState)}
          </p>
        </div>
        <div className="flex rounded-md border border-[var(--border)] p-1">
          {OBSERVATION_WINDOWS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onWindowChange(option)}
              className={`rounded px-3 py-1.5 text-xs font-semibold ${
                option === window
                  ? "bg-[var(--foreground)] text-[var(--background)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {option} {option === 1 ? "candle" : "candles"}
            </button>
          ))}
        </div>
      </div>

      {summary || observationRun || selectedReadinessRun || readiness ? (
        <div className="mb-3 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
          {selectedReadinessRun ? (
            <span className="rounded border border-[var(--border)] px-2 py-1">
              Selected stored run: {shortRunId(selectedReadinessRun.runId)}, status:{" "}
              {formatReadinessRunStatus(selectedReadiness)}
            </span>
          ) : null}
          {selectedReadinessRun ? (
            <span className="rounded border border-[var(--border)] px-2 py-1">
              Selected finished {formatHistoryDateTime(selectedReadinessRun.finishedAt)}
            </span>
          ) : null}
          {observationRun ? (
            <span className="rounded border border-[var(--border)] px-2 py-1">
              Observation run: {shortRunId(observationRun.runId)}, status:{" "}
              {formatReadinessRunStatus(observationReadiness)}. Mature run used
              for forward observation metrics.
            </span>
          ) : null}
          {observationRun ? (
            <span className="rounded border border-[var(--border)] px-2 py-1">
              Observation finished {formatHistoryDateTime(observationRun.finishedAt)}
            </span>
          ) : null}
          <span className="rounded border border-[var(--border)] px-2 py-1">
            Maturity {formatMaturityState(uiState.maturity.state)}
          </span>
        </div>
      ) : null}

      {readyContextNote ? (
        <p className="mb-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
          {readyContextNote}
        </p>
      ) : null}

      {summary && !showObservationSummary ? (
        <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
          <Metric label="Window" value={`${summary.window} candles`} />
          <Metric label="Timeframe" value={summary.timeframe} />
          <Metric label="Total Rows" value={formatCount(summary.totalRows)} />
          <Metric label="Returned Rows" value={formatCount(summary.returnedRows)} />
          <Metric label="Complete" value={formatCount(summary.completeCount)} />
          <Metric label="Partial" value={formatCount(summary.partialCount)} />
          <Metric label="Missing" value={formatCount(summary.missingCount)} />
        </div>
      ) : null}

      {showObservationSummary ? (
        <ObservationSummarySection summary={observationSummary} />
      ) : null}

      {stateTakeaways.length > 0 ? (
        <ResearchTakeaways takeaways={stateTakeaways} />
      ) : null}

      <ObservationDataStatusLegend />

      {uiState.status !== "observation_ready" ? (
        <ForwardObservationStatePanel
          uiState={uiState}
          readiness={readiness ?? null}
        />
      ) : rows.length === 0 ? (
        <StatePanel
          title="Observation rows unavailable"
          message="No forward observation rows are available for the selected observation run."
        />
      ) : (
        <div className="overflow-x-auto">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Observation Rows</h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Historical outcome rows from the observation run shown above.
              </p>
            </div>
            <span className="text-xs text-[var(--muted)]">
              {rows.length} rows
            </span>
          </div>
          <table className="w-full min-w-[1060px] border-collapse text-left text-sm">
            <thead className="sticky top-0 bg-[#0d131a] text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="px-3 py-3 font-semibold">Symbol</th>
                <th className="px-3 py-3 font-semibold">Group</th>
                <th className="px-3 py-3 font-semibold">Label</th>
                <th className="px-3 py-3 font-semibold">Rank Score</th>
                <th className="px-3 py-3 font-semibold">Anchor Close</th>
                <th className="px-3 py-3 font-semibold">Observed Close</th>
                <th className="px-3 py-3 font-semibold">Observed Change</th>
                <th className="px-3 py-3 font-semibold">Max Drawdown</th>
                <th className="px-3 py-3 font-semibold">Data Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-3 font-semibold">{row.symbol}</td>
                  <td className="px-3 py-3">
                    {formatGroupLabel(normalizeGroupKey(row.group))}
                  </td>
                  <td className="px-3 py-3">{formatSignalLabel(row.label)}</td>
                  <td className="px-3 py-3 tabular-nums">
                    {formatScore(row.rankScore)}
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {formatObservationNumber(row.anchorClose)}
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {formatObservationNumber(row.observedClose)}
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {formatObservationPercent(row.observedChangePct)}
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {formatObservationPercent(row.maxDrawdownPct)}
                  </td>
                  <td className="px-3 py-3">
                    <span className="font-semibold">
                      {formatDataStatus(row.dataStatus)}
                    </span>
                    {row.missingReason ? (
                      <span className="block text-xs text-[var(--muted)]">
                        {formatMissingReason(row.missingReason)}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {uiState.isFetching ? (
            <p className="mt-2 text-xs text-[var(--muted)]">Refreshing</p>
          ) : null}
        </div>
      )}
    </section>
  );
}

function ForwardObservationStatePanel({
  uiState,
  readiness,
}: {
  uiState: ForwardObservationUiState;
  readiness: HistoricalObservationReadinessResponse | null;
}) {
  const summary = uiState.summary;
  const coverage = readiness?.coverage ?? null;
  const selectedReadiness = readiness?.selectedRun ?? null;
  const observationReadiness = getReadyObservationReadinessRun(readiness);
  const dominantReadiness = observationReadiness ?? selectedReadiness;
  const title = getForwardObservationPanelTitle(uiState);
  const message = getForwardObservationPanelMessage({
    uiState,
    readiness,
  });
  const showDiagnostics =
    !hasReadyObservationContext(uiState) &&
    (summary !== null ||
      coverage !== null ||
      selectedReadiness !== null ||
      readiness?.recommendedRun !== null);

  return (
    <div className="rounded-md border border-[var(--border)] p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
        {message}
      </p>
      {showDiagnostics ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {summary ? (
            <Metric label="Window" value={`${summary.window} candles`} />
          ) : null}
          {summary ? <Metric label="Timeframe" value={summary.timeframe} /> : null}
          {selectedReadiness ? (
            <Metric
              label="Selected Run"
              value={shortRunId(selectedReadiness.run.runId)}
            />
          ) : null}
          {readiness?.recommendedRun ? (
            <Metric
              label="Recommended Run"
              value={shortRunId(readiness.recommendedRun.run.runId)}
            />
          ) : null}
          {observationReadiness ? (
            <Metric
              label="Observation Run"
              value={shortRunId(observationReadiness.run.runId)}
            />
          ) : null}
          {summary ? (
            <Metric label="Total Rows" value={formatCount(summary.totalRows)} />
          ) : null}
          {summary ? (
            <Metric
              label="Returned Rows"
              value={formatCount(summary.returnedRows)}
            />
          ) : null}
          {summary ? (
            <Metric label="Complete" value={formatCount(summary.completeCount)} />
          ) : null}
          {summary ? (
            <Metric label="Partial" value={formatCount(summary.partialCount)} />
          ) : null}
          {summary ? (
            <Metric label="Missing" value={formatCount(summary.missingCount)} />
          ) : null}
          {selectedReadiness?.diagnosticBlocker ? (
            <Metric
              label="Diagnostic"
              value={formatObservationDiagnosticBlocker(
                selectedReadiness.diagnosticBlocker,
              )}
            />
          ) : readiness?.metadata.diagnosticBlocker ? (
            <Metric
              label="Diagnostic"
              value={formatObservationDiagnosticBlocker(
                readiness.metadata.diagnosticBlocker,
              )}
            />
          ) : null}
          <Metric
            label="Dominant Reason"
            value={formatObservationBlocker(
              dominantReadiness?.blocker ?? readiness?.metadata.blocker,
              uiState.maturity.dominantMissingReason,
            )}
          />
          {coverage ? (
            <Metric
              label="Latest Candle"
              value={formatHistoryDateTime(coverage.latestOpenTime)}
            />
          ) : null}
          {coverage ? (
            <Metric
              label="Latest Coverage"
              value={formatLatestCoverage(coverage)}
            />
          ) : null}
          {selectedReadiness ? (
            <Metric
              label="Coverage Lag"
              value={formatCoverageLag(selectedReadiness)}
            />
          ) : null}
          {selectedReadiness?.expectedCompleteTime ? (
            <Metric
              label="Rough Maturity"
              value={formatHistoryDateTime(selectedReadiness.expectedCompleteTime)}
            />
          ) : null}
        </div>
      ) : null}
      {summary && uiState.status === "not_ready_for_selected_run" ? (
        <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
          For {summary.timeframe} + {summary.window}{" "}
          {summary.window === 1 ? "candle" : "candles"}, expect roughly{" "}
          {formatApproximateObservationWait(summary.timeframe, summary.window)}{" "}
          after the anchor before a complete {summary.window}-candle observation
          can exist. Candle sync timing and missing market data can affect
          availability.
        </p>
      ) : null}
    </div>
  );
}

function ObservationDataStatusLegend() {
  return (
    <div className="mb-3 rounded-md border border-[var(--border)] p-3 text-xs leading-5 text-[var(--muted)]">
      <p className="font-semibold text-[var(--foreground)]">Data status</p>
      <p className="mt-1">
        Complete means enough future candles exist for the selected forward
        observation window. Partial means fewer future candles are available than
        the selected window. Missing means required future candles are
        unavailable, often because of market data coverage, listing history, or
        sync gaps. These statuses are research context, not scanner algorithm
        failures or predictions.
      </p>
    </div>
  );
}

function ObservationSummarySection({
  summary,
}: {
  summary: ObservationSummary;
}) {
  const takeaways = buildResearchTakeaways({
    summary,
    uiState: null,
  });

  return (
    <section className="mb-3 rounded-md border border-[var(--border)] p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold">Observation Summary</h3>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-[var(--muted)]">
          Observation metrics are calculated from the observation run shown in
          Forward Observation. They are historical observations for research
          context, not predictions or financial advice.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Rows observed" value={formatCount(summary.totalRows)} />
        <Metric label="Complete" value={formatCount(summary.completeCount)} />
        <Metric label="Partial" value={formatCount(summary.partialCount)} />
        <Metric label="Missing" value={formatCount(summary.missingCount)} />
        <Metric
          label="Median observed change"
          value={formatObservationSummaryPercent(summary.medianObservedChangePct)}
        />
        <Metric
          label="Average observed change"
          value={formatObservationSummaryPercent(summary.averageObservedChangePct)}
        />
        <Metric
          label="Median max drawdown"
          value={formatObservationSummaryPercent(summary.medianMaxDrawdownPct)}
        />
        <Metric
          label="Observation coverage"
          value={`${summary.coverageLabel} (${formatObservationPercent(
            summary.completePct,
          )})`}
        />
      </div>

      <p className="mt-3 max-w-3xl text-xs leading-5 text-[var(--muted)]">
        Observation coverage describes how many rows have enough future candles
        for the selected window. It is not a prediction and does not describe
        future outcomes.
      </p>

      {summary.hasPartialOnlyCoverage ? (
        <p className="mt-3 max-w-3xl text-xs leading-5 text-[var(--muted)]">
          Partial observations are available, but they do not cover the full
          selected forward window. Complete-row distribution metrics stay empty
          until enough full-window observations are available. Partial rows are
          shown in the table for research context only.
        </p>
      ) : null}

      <ResearchTakeaways takeaways={takeaways} />
      <GroupDistributionTable groups={summary.groups} />
      <NotableHistoricalExamples summary={summary} />
    </section>
  );
}

function ResearchTakeaways({ takeaways }: { takeaways: string[] }) {
  return (
    <div className="mt-4 rounded-md border border-[var(--border)] p-3">
      <h4 className="text-sm font-semibold">Research Takeaways</h4>
      <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-[var(--muted)]">
        {takeaways.map((takeaway) => (
          <li key={takeaway}>{takeaway}</li>
        ))}
      </ul>
    </div>
  );
}

function buildResearchTakeaways({
  summary,
  uiState,
}: {
  summary: ObservationSummary | null;
  uiState: ForwardObservationUiState | null;
}) {
  if (summary) {
    if (summary.completeCount > 0 && summary.coverageLabel === "Strong") {
      return [
        "This observation window has enough complete rows for group-level historical review.",
        "Group metrics use complete rows only.",
        "Notable examples may include outliers and should not be treated as predictions.",
      ];
    }

    if (summary.completeCount === 0) {
      if (summary.partialCount > 0 && summary.missingCount > 0) {
        return [
          "This observation window does not have enough complete rows for group-level conclusions.",
          "Partial rows are shown for research context only while missing rows may reflect unavailable future candles, listing history, market data coverage, or sync gaps.",
          "Wait for more future candles before comparing groups; the selected scanner snapshot can still be reviewed separately.",
        ];
      }

      if (summary.partialCount > 0) {
        return [
          "This observation window does not have enough complete rows for group-level conclusions.",
          "Partial rows are shown for research context only.",
          "Wait for more future candles before comparing groups.",
        ];
      }

      if (summary.missingCount > 0) {
        return [
          "This observation window does not have enough complete rows for group-level conclusions.",
          "Missing rows usually reflect unavailable future candles, listing history, market data coverage, or sync gaps.",
          "The selected scanner snapshot can still be reviewed separately.",
        ];
      }
    }

    return [
      "This observation window has some complete rows, but coverage is limited for group-level historical review.",
      "Group metrics use complete rows only.",
      "Notable examples may include outliers and should not be treated as predictions.",
    ];
  }

  if (!uiState || !shouldShowUnavailableResearchTakeaways(uiState.status)) {
    return [];
  }

  return [
    "Forward observation is not available for this run yet.",
    "The selected run can still be reviewed as a scanner snapshot.",
    "Historical observations are research context only, not predictions or financial advice.",
  ];
}

function shouldShowUnavailableResearchTakeaways(
  status: ForwardObservationUiStatus,
) {
  return [
    "readiness_unavailable",
    "not_ready_for_selected_run",
    "no_observable_run",
    "observation_rows_error",
    "observation_ready_summary_missing",
    "observation_empty",
  ].includes(status);
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
        Group metrics use complete rows only so partial and missing observations
        do not get counted as zero.
      </p>
      {groups.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">
          Not enough complete rows
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left text-sm">
            <thead className="bg-[#0d131a] text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="px-3 py-3 font-semibold">Group</th>
                <th className="px-3 py-3 font-semibold">Rows</th>
                <th className="px-3 py-3 font-semibold">Complete</th>
                <th className="px-3 py-3 font-semibold">Partial</th>
                <th className="px-3 py-3 font-semibold">Missing</th>
                <th className="px-3 py-3 font-semibold">
                  Median observed change
                </th>
                <th className="px-3 py-3 font-semibold">
                  Average observed change
                </th>
                <th className="px-3 py-3 font-semibold">Median max drawdown</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group.groupKey} className="border-t border-[var(--border)]">
                  <td className="px-3 py-3 font-semibold">{group.groupLabel}</td>
                  <td className="px-3 py-3 tabular-nums">
                    {formatCount(group.rows)}
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {formatCount(group.complete)}
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {formatCount(group.partial)}
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {formatCount(group.missing)}
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {formatObservationSummaryPercent(
                      group.medianObservedChangePct,
                    )}
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {formatObservationSummaryPercent(
                      group.averageObservedChangePct,
                    )}
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {formatObservationSummaryPercent(group.medianMaxDrawdownPct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
      <h4 className="text-sm font-semibold">Notable historical examples</h4>
      <p className="mt-1 max-w-3xl text-xs leading-5 text-[var(--muted)]">
        These examples are historical observations for the selected window, not
        predictions or trade recommendations.
      </p>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <NotableExampleList
          title="Largest positive observed changes"
          examples={summary.notable.largestPositiveObservedChanges}
        />
        <NotableExampleList
          title="Largest negative observed changes"
          examples={summary.notable.largestNegativeObservedChanges}
        />
        <NotableExampleList
          title="Largest observed drawdowns"
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
    <div className="rounded-md border border-[var(--border)] p-3">
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
              className="rounded border border-[var(--border)] p-2 text-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold">{example.symbol}</span>
                <span className="text-[var(--muted)]">{example.groupLabel}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[var(--muted)]">
                <span>
                  Observed change{" "}
                  {formatObservationPercent(example.observedChangePct)}
                </span>
                {example.maxDrawdownPct !== null ? (
                  <span>
                    Max drawdown{" "}
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
      return "Loading observation readiness";
    case "readiness_unavailable":
      return "Observation readiness unavailable";
    case "not_ready_for_selected_run":
      return "Forward observation is not ready yet";
    case "no_observable_run":
      return isMarketCoverageBlocker(uiState)
        ? "Forward observation unavailable"
        : "No observable run available";
    case "using_selected_run":
      return "Using selected run";
    case "using_recommended_observable_run":
      return "Using mature observation run";
    case "loading_observation_rows":
      return "Loading observation rows";
    case "observation_rows_error":
      return "Observation rows unavailable";
    case "observation_ready_summary_missing":
      return "Observation rows not returned";
    case "observation_empty":
      return "No observation rows returned";
    case "observation_ready":
      return "Forward observation ready";
  }
}

function hasReadyObservationContext(uiState: ForwardObservationUiState) {
  return (
    uiState.observationRun !== null &&
    (uiState.selectionMode === "selected" ||
      uiState.selectionMode === "observable")
  );
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
      return "Checking whether the selected forward window has enough completed future candles.";
    case "readiness_unavailable":
      return "Forward Observation readiness could not be determined. This may happen if the API endpoint is not deployed yet, unavailable, or returned an invalid response.";
    case "not_ready_for_selected_run":
      if (isWaitingForFutureCandlesDiagnostic(uiState, readiness)) {
        return "This snapshot is not fully observable yet. It is waiting for completed future candles in the selected timeframe.";
      }

      return "This snapshot is not fully observable yet. Forward Observation uses completed future candles in the selected timeframe.";
    case "no_observable_run":
      if (isStaleMarketDataDiagnostic(uiState, readiness)) {
        return "This snapshot is not fully observable yet. Market data appears stale; production data may need latest candle sync before this window can be observed.";
      }

      if (isMarketCoverageBlocker(uiState)) {
        return "This snapshot is not fully observable yet. The stored market candles do not yet cover enough completed future candles for this window.";
      }

      return "No observable run is available within the backend readiness search window. Older runs may be unavailable, candle data may be stale, or market data sync may not have caught up.";
    case "using_selected_run":
      return "The selected stored run is the observation run for this forward window.";
    case "using_recommended_observable_run":
      return "The selected stored run remains unchanged, and Forward Observation is using a mature observation run for this forward observation window.";
    case "loading_observation_rows":
      return "Loading forward observation rows for the selected observation run.";
    case "observation_rows_error":
      return uiState.observationRowsError ?? "Forward observation rows could not be loaded.";
    case "observation_ready_summary_missing":
      return "Observation run is available, but no observation rows were returned. This may indicate the historical observation query returned no rows or the summary was not produced.";
    case "observation_empty":
      return "Observation run is available, but it has no historical observation rows for this forward observation window.";
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
  isLoading,
}: {
  rows: HistoricalSnapshotRow[];
  isLoading: boolean;
}) {
  return (
    <section className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Snapshot Rows</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Snapshot Rows are the scanner output from the selected stored run.
            They are not necessarily the same run used for Forward Observation.
            Current Symbol Research links open the current research view.
          </p>
        </div>
        <span className="text-xs text-[var(--muted)]">
          {isLoading ? "Refreshing" : `${rows.length} rows`}
        </span>
      </div>
      {rows.length === 0 ? (
        <StatePanel
          title="No rows"
          message="No scan signals are available for the selected stored run."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
            <thead className="bg-[#0d131a] text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="px-3 py-3 font-semibold">#</th>
                <th className="px-3 py-3 font-semibold">Symbol</th>
                <th className="px-3 py-3 font-semibold">Market</th>
                <th className="px-3 py-3 font-semibold">Group</th>
                <th className="px-3 py-3 font-semibold">Label</th>
                <th className="px-3 py-3 font-semibold">Primary Signal</th>
                <th className="px-3 py-3 font-semibold">Risk Notes</th>
                <th className="px-3 py-3 font-semibold">Rank Score</th>
                <th className="px-3 py-3 font-semibold">Components</th>
                <th className="px-3 py-3 font-semibold">Versions</th>
                <th className="px-3 py-3 font-semibold">Research</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-3 tabular-nums text-[var(--muted)]">
                    {index + 1}
                  </td>
                  <td className="px-3 py-3 font-semibold">{row.symbol}</td>
                  <td className="px-3 py-3 text-xs text-[var(--muted)]">
                    {formatMarket(row)}
                  </td>
                  <td className="px-3 py-3">
                    {formatGroupLabel(normalizeGroupKey(row.group))}
                  </td>
                  <td className="px-3 py-3">{formatSignalLabel(row.label)}</td>
                  <td className="px-3 py-3">
                    {formatHistoryPrimarySignal(row.primarySignal)}
                  </td>
                  <td className="max-w-[280px] px-3 py-3 text-xs leading-5 text-[var(--muted)]">
                    {formatRiskNotes(row)}
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {formatScore(row.rankScore)}
                  </td>
                  <td className="px-3 py-3 text-xs leading-5 text-[var(--muted)]">
                    {formatComponentScores(row.componentScores)}
                  </td>
                  <td className="px-3 py-3 text-xs leading-5 text-[var(--muted)]">
                    {formatVersions(row)}
                  </td>
                  <td className="px-3 py-3">
                    <Link
                      href={buildSymbolResearchHref({
                        exchange: row.exchange ?? "binance",
                        symbol: row.symbol,
                        timeframe: row.timeframe,
                        assetClass,
                      })}
                      className="text-xs font-semibold text-[var(--accent)]"
                    >
                      Current research
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--border)] p-3">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold">{value}</p>
    </div>
  );
}

function StatePanel({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-md border border-[var(--border)] p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{message}</p>
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

function buildRunSummaryItems(run: HistoricalSnapshotRun | null) {
  if (!run) {
    return [];
  }

  return [
    ["Run ID", run.runId],
    ["Timeframe", run.timeframe],
    ["Started", formatHistoryDateTime(run.startedAt)],
    ["Finished", formatHistoryDateTime(run.finishedAt)],
    ["Universe", run.universe ?? "-"],
    ["Asset Class", assetClass],
    ["Symbols Total", formatCount(run.symbolsTotal)],
    ["Symbols Scanned", formatCount(run.symbolsScanned)],
    ["Signals Created", formatCount(run.signalsCreated)],
    ["Skipped", formatCount(run.skipped)],
    ["Failed", formatCount(run.failedSymbols)],
    ["Full Universe", formatFullUniverse(run)],
    ["Scanner Version", run.scannerVersion ?? "-"],
    ["Scoring Version", run.scoringVersion ?? "-"],
  ].map(([label, value]) => ({ label, value }));
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
  const baseUrl = tradeApiBaseUrl?.trim().replace(/\/+$/, "") ?? "";

  return `${baseUrl}/api/history/snapshots?${params.toString()}`;
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
  const baseUrl = tradeApiBaseUrl?.trim().replace(/\/+$/, "") ?? "";

  return `${baseUrl}/api/history/snapshot?${params.toString()}`;
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
  const baseUrl = tradeApiBaseUrl?.trim().replace(/\/+$/, "") ?? "";

  return `${baseUrl}/api/history/snapshot-observations?${params.toString()}`;
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

  const baseUrl = tradeApiBaseUrl?.trim().replace(/\/+$/, "") ?? "";

  return `${baseUrl}/api/history/observation-readiness?${params.toString()}`;
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
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return [
    date.getUTCFullYear(),
    padDatePart(date.getUTCMonth() + 1),
    padDatePart(date.getUTCDate()),
  ].join("-") + ` ${padDatePart(date.getUTCHours())}:${padDatePart(date.getUTCMinutes())}`;
}

export function formatHistoryPrimarySignal(value: string | null | undefined) {
  const label = value?.trim();

  if (!label) {
    return "-";
  }

  return unsafePrimarySignalLabelMap[label.toLowerCase()] ?? label;
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
    return `Selected stored run is still waiting for future candles. Showing the most recent ${runDescription} instead.`;
  }

  if (diagnosticBlocker === "stale_market_data") {
    return `Selected stored run has stale market data coverage. Showing the most recent ${runDescription} instead.`;
  }

  return `Showing the most recent ${runDescription} for this historical observation.`;
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

function formatDataStatus(value: ObservationDataStatus) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatForwardObservationSelectionMode(
  value: ForwardObservationSelectionMode,
) {
  switch (value) {
    case "selected":
      return "Using selected run";
    case "observable":
      return "Using mature observation run";
    case "not_ready":
      return "Not ready for selected run";
    case "unavailable":
      return "Observation readiness unavailable";
  }
}

function formatForwardObservationUiStatusLabel(
  uiState: ForwardObservationUiState,
) {
  switch (uiState.status) {
    case "loading_readiness":
      return "Loading observation readiness";
    case "readiness_unavailable":
      return "Observation readiness unavailable";
    case "not_ready_for_selected_run":
      return "Not ready for selected run";
    case "no_observable_run":
      return isMarketCoverageBlocker(uiState)
        ? "Forward observation unavailable"
        : "No observable run available";
    case "using_selected_run":
    case "loading_observation_rows":
    case "observation_ready":
    case "observation_ready_summary_missing":
    case "observation_empty":
    case "observation_rows_error":
      return `Mode: ${formatForwardObservationSelectionMode(uiState.selectionMode)}`;
    case "using_recommended_observable_run":
      return "Mode: Using mature observation run";
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
    return "This snapshot is not fully observable yet. Market data appears stale; production data may need latest candle sync before this window can be observed.";
  }

  if (diagnosticBlocker === "waiting_for_future_candles") {
    return "This snapshot is not fully observable yet. It is waiting for completed future candles in the selected timeframe.";
  }

  switch (blocker) {
    case "market_data_coverage":
      return "Market candle coverage is not far enough for this forward window. Forward Observation uses completed future candles in the selected timeframe.";
    case "time_maturity":
      return "This snapshot is too recent for the selected forward window. Forward Observation uses completed future candles in the selected timeframe.";
    case "mixed":
      return "Forward observation is blocked by a mix of time maturity and market candle coverage. Refresh after candle coverage advances.";
    case "no_runs":
      return "No successful stored runs are available for this timeframe.";
    case "unavailable":
      return "Forward observation data is unavailable for the selected window.";
    case "observable":
      return "Forward observation rows are available for this window.";
    default:
      return "Forward observation is not ready for the selected window.";
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
  return value ? value.slice(0, 8) : "-";
}

function formatCompactRunId(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  if (value.length <= 16) {
    return value;
  }

  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function formatFullUniverse(run: HistoricalSnapshotRun) {
  if (run.isLikelyFullUniverse === true) {
    return "Likely full universe";
  }

  if (run.isLikelyFullUniverse === false) {
    return "Limited or unknown";
  }

  return "Unknown universe";
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

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
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
