"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  formatDateTime,
  formatGroupLabel,
  formatScore,
  formatSignalLabel,
  normalizeGroupKey,
} from "@/components/scanner/latestScanUi";
import { buildSymbolResearchHref } from "@/components/symbol/symbolResearchLinks";

const HISTORY_TIMEFRAMES = ["1h", "4h", "1d", "1w"] as const;
const assetClass = "crypto";
const snapshotsLimit = 25;
const historyDisclaimer =
  "Research-only. Not financial advice. Historical observations are not predictions.";

type HistoryTimeframe = (typeof HISTORY_TIMEFRAMES)[number];

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

export function HistoryPageClient() {
  const [timeframe, setTimeframe] = useState<HistoryTimeframe>("4h");
  const [manualSelectedRunId, setManualSelectedRunId] = useState<string | null>(
    null,
  );
  const snapshotsQuery = useQuery({
    queryKey: ["history-snapshots", timeframe, assetClass],
    queryFn: ({ signal }) =>
      fetchHistoricalSnapshots({ timeframe, assetClass, signal }),
    staleTime: 60_000,
  });
  const snapshots = snapshotsQuery.data?.snapshots ?? [];
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
  const rows = snapshotQuery.data?.rows ?? [];
  const selectedRun = snapshotQuery.data?.run ?? null;
  const summaryItems = useMemo(
    () => buildRunSummaryItems(selectedRun),
    [selectedRun],
  );

  const refreshData = () => {
    void snapshotsQuery.refetch();
    void snapshotQuery.refetch();
  };

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
          disabled={snapshotsQuery.isFetching || snapshotQuery.isFetching}
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
        >
          {snapshotsQuery.isFetching || snapshotQuery.isFetching
            ? "Refreshing"
            : "Refresh"}
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
                        Finished {formatDateTime(run.finishedAt)}
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

          <SnapshotTable rows={rows} isLoading={snapshotQuery.isFetching} />
        </div>
      </div>
    </section>
  );
}

function SnapshotTable({
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
                  <td className="px-3 py-3">{row.primarySignal ?? "-"}</td>
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

function buildRunSummaryItems(run: HistoricalSnapshotRun | null) {
  if (!run) {
    return [];
  }

  return [
    ["Run ID", run.runId],
    ["Timeframe", run.timeframe],
    ["Started", formatDateTime(run.startedAt)],
    ["Finished", formatDateTime(run.finishedAt)],
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

function formatQueryError(error: unknown) {
  return error instanceof Error ? error.message : "Request failed.";
}

function formatCount(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString()
    : "-";
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
