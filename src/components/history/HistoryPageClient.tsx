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

const HISTORY_TIMEFRAMES = ["1h", "4h", "1d", "1w"] as const;
const OBSERVATION_WINDOWS = [1, 3, 5, 10] as const;
const assetClass = "crypto";
const snapshotsLimit = 25;
const maxObservationProbeRuns = 12;
const historyDisclaimer =
  "Research-only. Not financial advice. Historical observations are not predictions.";
const emptyHistoricalSnapshotRuns: HistoricalSnapshotRun[] = [];
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
  const snapshotsQuery = useQuery({
    queryKey: ["history-snapshots", timeframe, assetClass],
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
    queryKey: ["history-snapshot", selectedRunId, assetClass],
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
    queryKey: [
      "history-observation-readiness",
      timeframe,
      selectedRunId,
      assetClass,
      observationWindow,
    ],
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
  const observationRunId =
    readinessQuery.data?.observationRun?.run.runId ?? null;
  const observationQuery = useQuery({
    queryKey: [
      "history-snapshot-observations",
      observationRunId,
      assetClass,
      observationWindow,
    ],
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
  const observationSelectionMode = getForwardObservationSelectionMode({
    selectedRunId,
    readiness: readinessQuery.data ?? null,
  });
  const rows = snapshotQuery.data?.rows ?? [];
  const selectedRun = snapshotQuery.data?.run ?? null;
  const summaryItems = useMemo(
    () => buildRunSummaryItems(selectedRun),
    [selectedRun],
  );

  const refreshData = () => {
    void snapshotsQuery.refetch();
    if (selectedRunId !== null) {
      void snapshotQuery.refetch();
      void readinessQuery.refetch();
      if (observationRunId !== null) {
        void observationQuery.refetch();
      }
    }
  };
  const isRefreshing =
    snapshotsQuery.isFetching ||
    snapshotQuery.isFetching ||
    readinessQuery.isFetching ||
    observationQuery.isFetching;

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

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4">
          <div className="mb-3">
            <h2 className="text-base font-semibold">Recent Successful Runs</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Showing recent successful {timeframe} runs from Postgres.
            </p>
          </div>
          {snapshotsQuery.isError ? (
            <StatePanel
              title="History unavailable"
              message={formatQueryError(snapshotsQuery.error)}
            />
          ) : snapshotsQuery.isLoading ? (
            <StatePanel title="Loading runs" message="Loading stored scan runs." />
          ) : snapshots.length === 0 ? (
            <StatePanel
              title="No stored runs"
              message={`No successful ${timeframe} historical snapshots are available.`}
            />
          ) : (
            <div className="max-h-[680px] space-y-2 overflow-y-auto pr-1">
              {snapshots.map((run) => (
                <button
                  key={run.runId}
                  type="button"
                  onClick={() => setManualSelectedRunId(run.runId)}
                  className={`w-full rounded-md border p-3 text-left transition ${
                    run.runId === selectedRunId
                      ? "border-[var(--foreground)] bg-[#111820]"
                      : "border-[var(--border)] hover:border-[var(--muted)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{run.runId}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Finished {formatHistoryDateTime(run.finishedAt)}
                      </p>
                    </div>
                    <span className="rounded border border-[var(--border)] px-2 py-1 text-xs font-semibold">
                      {run.timeframe}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--muted)]">
                    <span>Scanned {formatCount(run.symbolsScanned)}</span>
                    <span>Signals {formatCount(run.signalsCreated)}</span>
                    <span>Skipped {formatCount(run.skipped)}</span>
                    <span>{formatFullUniverse(run)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <div className="space-y-4">
          <section className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Selected Stored Run</h2>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Stored scanner metadata for the selected historical run.
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
            maturity={classifyForwardObservationMaturity(
              observationQuery.data ?? null,
            )}
            observationRun={
              observationQuery.data?.run ??
              readinessQuery.data?.observationRun?.run ??
              readinessQuery.data?.selectedRun?.run ??
              null
            }
            selectionMode={observationSelectionMode}
            isLoading={
              selectedRunId !== null &&
              (readinessQuery.isLoading ||
                (observationRunId !== null && observationQuery.isLoading))
            }
            isFetching={
              readinessQuery.isFetching || observationQuery.isFetching
            }
            error={
              readinessQuery.isError
                ? formatQueryError(readinessQuery.error)
                : observationQuery.isError
                  ? formatQueryError(observationQuery.error)
                  : null
            }
          />

          <SnapshotTable rows={rows} isLoading={snapshotQuery.isFetching} />
        </div>
      </div>
    </section>
  );
}

export function ForwardObservationSection({
  window,
  onWindowChange,
  response,
  readiness,
  maturity,
  observationRun,
  selectionMode,
  isLoading,
  isFetching,
  error,
}: {
  window: ObservationWindow;
  onWindowChange: (window: ObservationWindow) => void;
  response: HistoricalSnapshotObservationsResponse | null;
  readiness?: HistoricalObservationReadinessResponse | null;
  maturity: ForwardObservationMaturity | null;
  observationRun: HistoricalSnapshotRun | null;
  selectionMode: ForwardObservationSelectionMode;
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
}) {
  const rows = response?.rows ?? [];
  const metadata = response?.metadata ?? null;
  const readinessSummaryRun =
    readiness?.observationRun ?? readiness?.selectedRun ?? null;
  const summary = metadata
    ? {
        window: metadata.window,
        timeframe: metadata.timeframe,
        rowCount: metadata.rowCount,
        completeCount: metadata.completeCount,
        partialCount: metadata.partialCount,
        missingCount: metadata.missingCount,
      }
    : readinessSummaryRun
      ? {
          window: readiness?.metadata.window ?? window,
          timeframe: readiness?.metadata.timeframe ?? observationRun?.timeframe ?? "4h",
          rowCount: readinessSummaryRun.rowCount,
          completeCount: readinessSummaryRun.completeCount,
          partialCount: readinessSummaryRun.partialCount,
          missingCount: readinessSummaryRun.missingCount,
        }
      : null;
  const effectiveMaturity =
    response && maturity
      ? maturity
      : readinessSummaryRun
        ? buildForwardObservationMaturityFromReadiness(readinessSummaryRun)
        : classifyForwardObservationMaturity(response);
  const selectedReadinessRun = readiness?.selectedRun?.run ?? null;
  const shouldShowSelectedRunBadge =
    selectedReadinessRun &&
    observationRun &&
    selectedReadinessRun.runId !== observationRun.runId;

  return (
    <section className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Forward Observation</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Research-only. Historical observations are not predictions.
          </p>
          <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
            {formatForwardObservationSelectionMode(selectionMode)}
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

      {metadata || observationRun || readiness ? (
        <div className="mb-3 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
          {shouldShowSelectedRunBadge ? (
            <span className="rounded border border-[var(--border)] px-2 py-1">
              Selected stored run {shortRunId(selectedReadinessRun.runId)}
            </span>
          ) : null}
          <span className="rounded border border-[var(--border)] px-2 py-1">
            Observation run {shortRunId(observationRun?.runId)}
          </span>
          <span className="rounded border border-[var(--border)] px-2 py-1">
            Finished {formatHistoryDateTime(observationRun?.finishedAt)}
          </span>
          <span className="rounded border border-[var(--border)] px-2 py-1">
            Maturity {formatMaturityState(effectiveMaturity.state)}
          </span>
        </div>
      ) : null}

      {summary ? (
        <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <Metric label="Selected Window" value={`${summary.window} candles`} />
          <Metric label="Timeframe" value={summary.timeframe} />
          <Metric label="Rows" value={formatCount(summary.rowCount)} />
          <Metric label="Complete" value={formatCount(summary.completeCount)} />
          <Metric label="Partial" value={formatCount(summary.partialCount)} />
          <Metric label="Missing" value={formatCount(summary.missingCount)} />
        </div>
      ) : null}

      {error ? (
        <StatePanel title="Observation unavailable" message={error} />
      ) : isLoading ? (
        <StatePanel
          title="Loading observation"
          message="Loading forward observation rows."
        />
      ) : summary && effectiveMaturity.state === "not_ready" ? (
        <ForwardObservationNotReadyPanel
          summary={summary}
          maturity={effectiveMaturity}
          readiness={readiness ?? null}
        />
      ) : summary && effectiveMaturity.state === "empty_or_unavailable" ? (
        <StatePanel
          title="Observation unavailable"
          message="Forward observation data is unavailable for the selected window."
        />
      ) : rows.length === 0 ? (
        <StatePanel
          title="Observation unavailable"
          message="No forward observation rows are available for the selected stored run."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1060px] border-collapse text-left text-sm">
            <thead className="bg-[#0d131a] text-xs uppercase text-[var(--muted)]">
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
          {isFetching ? (
            <p className="mt-2 text-xs text-[var(--muted)]">Refreshing</p>
          ) : null}
        </div>
      )}
    </section>
  );
}

function ForwardObservationNotReadyPanel({
  summary,
  maturity,
  readiness,
}: {
  summary: {
    window: ObservationWindow;
    timeframe: HistoryTimeframe;
    rowCount: number;
    completeCount: number;
    partialCount: number;
    missingCount: number;
  };
  maturity: ForwardObservationMaturity;
  readiness: HistoricalObservationReadinessResponse | null;
}) {
  const coverage = readiness?.coverage ?? null;
  const selectedReadiness = readiness?.selectedRun ?? null;

  return (
    <div className="rounded-md border border-[var(--border)] p-4">
      <h3 className="text-sm font-semibold">
        Forward observation is not ready yet
      </h3>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
        {formatObservationReadinessMessage(readiness)}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Selected Window" value={`${summary.window} candles`} />
        <Metric label="Timeframe" value={summary.timeframe} />
        <Metric label="Rows" value={formatCount(summary.rowCount)} />
        <Metric
          label="Missing Reason"
          value={formatMissingReason(
            maturity.dominantMissingReason ?? "missing_data",
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
        {selectedReadiness?.expectedCompleteTime ? (
          <Metric
            label="Rough Maturity"
            value={formatHistoryDateTime(selectedReadiness.expectedCompleteTime)}
          />
        ) : null}
      </div>
      <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
        For {summary.timeframe} + {summary.window}{" "}
        {summary.window === 1 ? "candle" : "candles"}, expect roughly{" "}
        {formatApproximateObservationWait(summary.timeframe, summary.window)}{" "}
        after the anchor before a complete {summary.window}-candle observation
        can exist. Candle sync timing and missing market data can affect
        availability.
      </p>
    </div>
  );
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
            Full stored single-timeframe result set. Current Symbol Research links
            open the current research view.
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

  const observationRunId = readiness.observationRun?.run.runId ?? null;

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

  return (await response.json()) as HistoricalObservationReadinessResponse;
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
      return "Using most recent observable run";
    case "not_ready":
      return "Not ready for selected run";
    case "unavailable":
      return "Observation unavailable";
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
