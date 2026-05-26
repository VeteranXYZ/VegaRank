"use client";

import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/components/providers/LanguageProvider";
import type { EvaluationSummaryBucket } from "@/lib/storage/scanEvaluation";
import type { StoredScanSnapshot } from "@/lib/storage/scanSnapshotModel";

type Dictionary = ReturnType<typeof useLanguage>["dictionary"];

type HistoryApiResponse = {
  snapshots: StoredScanSnapshot[];
  itemCount: number;
  summary: {
    snapshotCount: number;
    resultCount: number;
    latestAt: string | null;
    byMode: Record<string, number>;
    bySignal: Record<string, number>;
    byPhase: Record<string, number>;
    byAlignment: Record<string, number>;
  };
};

type HistoryEvaluationApiResponse = {
  horizonCandles: number;
  itemCount: number;
  summary: {
    evaluationCount: number;
    completedCount: number;
    pendingCount: number;
    bySignal: Record<string, EvaluationSummaryBucket>;
    byPhase: Record<string, EvaluationSummaryBucket>;
    byAlignment: Record<string, EvaluationSummaryBucket>;
  };
};

export function HistoryPageClient() {
  const { dictionary: t } = useLanguage();
  const historyQuery = useQuery({
    queryKey: ["scan-history", 50],
    queryFn: () => fetchHistory(50),
  });
  const evaluationQuery = useQuery({
    queryKey: ["scan-history-evaluation", 10, 3, 50],
    queryFn: () => fetchEvaluation({ limit: 10, horizon: 3, resultLimit: 50 }),
    enabled: (historyQuery.data?.snapshots.length ?? 0) > 0,
  });
  const data = historyQuery.data;

  return (
    <section className="mx-auto max-w-[1500px] px-4 py-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-[var(--muted)]">
            {t.history.research}
          </p>
          <h1 className="mt-1 text-3xl font-semibold">{t.history.title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            {t.history.subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void historyQuery.refetch()}
          disabled={historyQuery.isFetching}
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
        >
          {historyQuery.isFetching ? t.common.refreshing : t.common.refresh}
        </button>
      </div>

      {historyQuery.isError ? (
        <StatePanel
          title={t.history.errorTitle}
          message={
            historyQuery.error instanceof Error
              ? historyQuery.error.message
              : "History request failed."
          }
        />
      ) : historyQuery.isLoading ? (
        <StatePanel
          title={t.history.loadingTitle}
          message={t.history.loadingMessage}
        />
      ) : !data || data.snapshots.length === 0 ? (
        <StatePanel
          title={t.history.emptyTitle}
          message={t.history.emptyMessage}
        />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <SummaryCards data={data} />
            <EvaluationSection
              data={evaluationQuery.data ?? null}
              isLoading={evaluationQuery.isLoading || evaluationQuery.isFetching}
              isError={evaluationQuery.isError}
              errorMessage={
                evaluationQuery.error instanceof Error
                  ? evaluationQuery.error.message
                  : "Evaluation request failed."
              }
              onRefresh={() => void evaluationQuery.refetch()}
            />
            <DistributionSection
              title={t.history.signalDistribution}
              items={data.summary.bySignal}
            />
            <DistributionSection
              title={t.history.phaseDistribution}
              items={data.summary.byPhase}
            />
            <SnapshotTable snapshots={data.snapshots} />
          </div>
          <aside className="space-y-5">
            <DistributionSection
              title={t.history.alignmentDistribution}
              items={data.summary.byAlignment}
            />
            <DistributionSection
              title={t.history.modeDistribution}
              items={data.summary.byMode}
            />
            <LatestSnapshot snapshot={data.snapshots[0]} />
          </aside>
        </div>
      )}
    </section>
  );
}

function EvaluationSection({
  data,
  isLoading,
  isError,
  errorMessage,
  onRefresh,
}: {
  data: HistoryEvaluationApiResponse | null;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  onRefresh: () => void;
}) {
  const { dictionary: t } = useLanguage();
  const signalRows = data
    ? Object.entries(data.summary.bySignal).sort(
        (left, right) => right[1].completedCount - left[1].completedCount,
      )
    : [];

  return (
    <section className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t.history.forwardEvaluation}</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {t.history.forwardEvaluationHelp}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="rounded-md border border-[var(--border)] px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? t.history.evaluating : t.history.evaluate}
        </button>
      </div>

      {isError ? (
        <p className="text-sm text-[var(--danger)]">{errorMessage}</p>
      ) : isLoading && !data ? (
        <p className="text-sm text-[var(--muted)]">{t.history.evaluating}.</p>
      ) : !data || data.itemCount === 0 ? (
        <p className="text-sm text-[var(--muted)]">{t.history.noEvaluations}</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-2 md:grid-cols-3">
            <Metric label={t.history.evaluated} value={String(data.summary.evaluationCount)} />
            <Metric label={t.history.completed} value={String(data.summary.completedCount)} />
            <Metric label={t.history.pending} value={String(data.summary.pendingCount)} />
          </div>
          {signalRows.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              {t.history.noSignalBuckets}
            </p>
          ) : (
            <>
              <EvaluationSignalCards rows={signalRows} />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                  <thead className="bg-[#0d131a] text-xs uppercase text-[var(--muted)]">
                    <tr>
                      <th className="px-3 py-3 font-semibold">{t.common.signal}</th>
                      <th className="px-3 py-3 font-semibold">{t.history.completed}</th>
                      <th className="px-3 py-3 font-semibold">{t.history.pending}</th>
                      <th className="px-3 py-3 font-semibold">{t.history.hitRate}</th>
                      <th className="px-3 py-3 font-semibold">{t.history.avgReturn}</th>
                      <th className="px-3 py-3 font-semibold">{t.history.avgMaxUp}</th>
                      <th className="px-3 py-3 font-semibold">{t.history.avgMaxDown}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {signalRows.map(([signal, bucket]) => (
                      <tr key={signal} className="border-t border-[var(--border)]">
                        <td className="px-3 py-3">
                          {signal in t.signal
                            ? t.signal[signal as keyof typeof t.signal]
                            : formatEnum(signal)}
                        </td>
                        <td className="px-3 py-3 tabular-nums">
                          {bucket.completedCount}
                        </td>
                        <td className="px-3 py-3 tabular-nums">
                          {bucket.pendingCount}
                        </td>
                        <td className="px-3 py-3 tabular-nums">
                          {formatPercentRatio(bucket.hitRate)}
                        </td>
                        <td className="px-3 py-3 tabular-nums">
                          {formatSignedPercent(bucket.avgReturnPct)}
                        </td>
                        <td className="px-3 py-3 tabular-nums">
                          {formatSignedPercent(bucket.avgMaxUpPct)}
                        </td>
                        <td className="px-3 py-3 tabular-nums">
                          {formatSignedPercent(bucket.avgMaxDownPct)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function EvaluationSignalCards({
  rows,
}: {
  rows: Array<[string, EvaluationSummaryBucket]>;
}) {
  const { dictionary: t } = useLanguage();

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold">{t.history.validationSummary}</h3>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.slice(0, 6).map(([signal, bucket]) => {
          const hitRate = bucket.hitRate ?? 0;

          return (
            <div
              key={signal}
              className="rounded-md border border-[var(--border)] bg-[#0b0f14] p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">
                  {signal in t.signal
                    ? t.signal[signal as keyof typeof t.signal]
                    : formatEnum(signal)}
                </span>
                <span className="text-xs tabular-nums text-[var(--muted)]">
                  {bucket.completedCount} {t.history.completed}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <Metric
                  label={t.history.hitRate}
                  value={formatPercentRatio(bucket.hitRate)}
                />
                <Metric
                  label={t.history.avgReturn}
                  value={formatSignedPercent(bucket.avgReturnPct)}
                />
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#111820]">
                <div
                  className="h-full rounded-full bg-[var(--accent)]"
                  style={{ width: `${hitRate * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SummaryCards({ data }: { data: HistoryApiResponse }) {
  const { dictionary: t } = useLanguage();
  const cards = [
    [t.history.snapshots, String(data.summary.snapshotCount)],
    [t.history.results, String(data.summary.resultCount)],
    [
      t.history.latest,
      data.summary.latestAt ? formatDateTime(data.summary.latestAt) : t.common.notAvailable,
    ],
  ];

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {cards.map(([label, value]) => (
        <div
          key={label}
          className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4"
        >
          <div className="text-xs uppercase tracking-wide text-[var(--muted)]">
            {label}
          </div>
          <div className="mt-2 text-xl font-semibold">{value}</div>
        </div>
      ))}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[#0b0f14] p-3">
      <div className="text-xs text-[var(--muted)]">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}

function DistributionSection({
  title,
  items,
}: {
  title: string;
  items: Record<string, number>;
}) {
  const { dictionary: t } = useLanguage();
  const rows = Object.entries(items).sort((left, right) => right[1] - left[1]);
  const total = rows.reduce((sum, [, count]) => sum + count, 0);

  return (
    <section className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{t.history.noData}</p>
      ) : (
        <div className="space-y-3">
          {rows.map(([label, count]) => (
            <div key={label}>
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span>{formatTranslatedEnum(label, t)}</span>
                <span className="tabular-nums text-[var(--muted)]">{count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#0b0f14]">
                <div
                  className="h-full rounded-full bg-[var(--accent)]"
                  style={{ width: `${total > 0 ? (count / total) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SnapshotTable({ snapshots }: { snapshots: StoredScanSnapshot[] }) {
  const { dictionary: t } = useLanguage();

  return (
    <section className="overflow-hidden rounded-md border border-[var(--border)] bg-[var(--panel)]">
      <div className="border-b border-[var(--border)] px-4 py-3">
        <h2 className="text-lg font-semibold">{t.history.recentSnapshots}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-left text-sm">
          <thead className="bg-[#0d131a] text-xs uppercase text-[var(--muted)]">
            <tr>
              <th className="px-3 py-3 font-semibold">{t.history.created}</th>
              <th className="px-3 py-3 font-semibold">{t.scanner.mode}</th>
              <th className="px-3 py-3 font-semibold">{t.history.scope}</th>
              <th className="px-3 py-3 font-semibold">{t.scanner.limit}</th>
              <th className="px-3 py-3 font-semibold">{t.history.results}</th>
              <th className="px-3 py-3 font-semibold">{t.history.errors}</th>
              <th className="px-3 py-3 font-semibold">{t.history.topSymbols}</th>
            </tr>
          </thead>
          <tbody>
            {snapshots.map((snapshot) => (
              <tr key={snapshot.id} className="border-t border-[var(--border)]">
                <td className="px-3 py-3">{formatDateTime(snapshot.createdAt)}</td>
                <td className="px-3 py-3">{formatMode(snapshot.mode, t)}</td>
                <td className="px-3 py-3">{formatScope(snapshot, t)}</td>
                <td className="px-3 py-3 tabular-nums">{snapshot.limit}</td>
                <td className="px-3 py-3 tabular-nums">{snapshot.itemCount}</td>
                <td className="px-3 py-3 tabular-nums">{snapshot.errorsCount}</td>
                <td className="px-3 py-3">
                  {snapshot.results
                    .slice(0, 4)
                    .map((result) => result.symbol)
                    .join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LatestSnapshot({ snapshot }: { snapshot: StoredScanSnapshot }) {
  const { dictionary: t } = useLanguage();

  return (
    <section className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4">
      <h2 className="mb-4 text-lg font-semibold">{t.history.latestLeaders}</h2>
      <div className="space-y-2">
        {snapshot.results.slice(0, 8).map((result) => (
          <div
            key={`${snapshot.id}-${result.symbol}`}
            className="rounded-md border border-[var(--border)] bg-[#0b0f14] p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold">{result.symbol}</span>
              <span className="text-sm tabular-nums text-[var(--muted)]">
                {result.rankScore.toFixed(1)}
              </span>
            </div>
            <div className="mt-1 text-xs text-[var(--muted)]">
              {t.signal[result.signalState]} · {t.phase[result.phase]}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function StatePanel({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex min-h-96 flex-col items-center justify-center rounded-md border border-[var(--border)] bg-[var(--panel)] px-6 py-10 text-center">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
        {message}
      </p>
    </div>
  );
}

async function fetchHistory(limit: number) {
  const response = await fetch(`/api/history/scans?limit=${limit}`);

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: string; message?: string }
      | null;
    throw new Error(body?.message ?? body?.error ?? "History request failed.");
  }

  return (await response.json()) as HistoryApiResponse;
}

async function fetchEvaluation({
  limit,
  horizon,
  resultLimit,
}: {
  limit: number;
  horizon: number;
  resultLimit: number;
}) {
  const params = new URLSearchParams({
    limit: String(limit),
    horizon: String(horizon),
    resultLimit: String(resultLimit),
  });
  const response = await fetch(`/api/history/evaluate?${params.toString()}`);

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: string; message?: string }
      | null;
    throw new Error(
      body?.message ?? body?.error ?? "Evaluation request failed.",
    );
  }

  return (await response.json()) as HistoryEvaluationApiResponse;
}

function formatScope(snapshot: StoredScanSnapshot, t: Dictionary) {
  if (snapshot.mode === "mtf") {
    return snapshot.timeframes?.map((timeframe) => t.timeframe[timeframe]).join(" / ");
  }

  return snapshot.timeframe ? t.timeframe[snapshot.timeframe] : t.common.notAvailable;
}

function formatMode(mode: StoredScanSnapshot["mode"], t: Dictionary) {
  return mode === "mtf" ? t.scanner.mtfMode : t.scanner.singleMode;
}

function formatTranslatedEnum(value: string, t: Dictionary) {
  if (value in t.signal) {
    return t.signal[value as keyof typeof t.signal];
  }

  if (value in t.phase) {
    return t.phase[value as keyof typeof t.phase];
  }

  if (value in t.alignment) {
    return t.alignment[value as keyof typeof t.alignment];
  }

  if (value === "single" || value === "mtf") {
    return formatMode(value, t);
  }

  return formatEnum(value);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function formatSignedPercent(value: number | null) {
  if (value === null) {
    return "n/a";
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatPercentRatio(value: number | null) {
  if (value === null) {
    return "n/a";
  }

  return `${(value * 100).toFixed(0)}%`;
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
