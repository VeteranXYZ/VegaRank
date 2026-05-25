"use client";

import { useQuery } from "@tanstack/react-query";
import { timeframeLabels } from "@/lib/exchanges/types";
import type { StoredScanSnapshot } from "@/lib/storage/scanSnapshots";

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

export function HistoryPageClient() {
  const historyQuery = useQuery({
    queryKey: ["scan-history", 50],
    queryFn: () => fetchHistory(50),
  });
  const data = historyQuery.data;

  return (
    <section className="mx-auto max-w-[1500px] px-4 py-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-[var(--muted)]">
            Research
          </p>
          <h1 className="mt-1 text-3xl font-semibold">Scan History</h1>
        </div>
        <button
          type="button"
          onClick={() => void historyQuery.refetch()}
          disabled={historyQuery.isFetching}
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
        >
          {historyQuery.isFetching ? "Refreshing" : "Refresh"}
        </button>
      </div>

      {historyQuery.isError ? (
        <StatePanel
          title="Unable To Load History"
          message={
            historyQuery.error instanceof Error
              ? historyQuery.error.message
              : "History request failed."
          }
        />
      ) : historyQuery.isLoading ? (
        <StatePanel
          title="Loading History"
          message="Reading locally stored scan snapshots."
        />
      ) : !data || data.snapshots.length === 0 ? (
        <StatePanel
          title="No Snapshots Yet"
          message="Run a scanner request to start collecting local scan history."
        />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <SummaryCards data={data} />
            <DistributionSection title="Signal Distribution" items={data.summary.bySignal} />
            <DistributionSection title="Phase Distribution" items={data.summary.byPhase} />
            <SnapshotTable snapshots={data.snapshots} />
          </div>
          <aside className="space-y-5">
            <DistributionSection
              title="Alignment Distribution"
              items={data.summary.byAlignment}
            />
            <DistributionSection title="Mode Distribution" items={data.summary.byMode} />
            <LatestSnapshot snapshot={data.snapshots[0]} />
          </aside>
        </div>
      )}
    </section>
  );
}

function SummaryCards({ data }: { data: HistoryApiResponse }) {
  const cards = [
    ["Snapshots", String(data.summary.snapshotCount)],
    ["Results", String(data.summary.resultCount)],
    ["Latest", data.summary.latestAt ? formatDateTime(data.summary.latestAt) : "n/a"],
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

function DistributionSection({
  title,
  items,
}: {
  title: string;
  items: Record<string, number>;
}) {
  const rows = Object.entries(items).sort((left, right) => right[1] - left[1]);
  const total = rows.reduce((sum, [, count]) => sum + count, 0);

  return (
    <section className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No data yet.</p>
      ) : (
        <div className="space-y-3">
          {rows.map(([label, count]) => (
            <div key={label}>
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span>{formatEnum(label)}</span>
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
  return (
    <section className="overflow-hidden rounded-md border border-[var(--border)] bg-[var(--panel)]">
      <div className="border-b border-[var(--border)] px-4 py-3">
        <h2 className="text-lg font-semibold">Recent Snapshots</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-left text-sm">
          <thead className="bg-[#0d131a] text-xs uppercase text-[var(--muted)]">
            <tr>
              <th className="px-3 py-3 font-semibold">Created</th>
              <th className="px-3 py-3 font-semibold">Mode</th>
              <th className="px-3 py-3 font-semibold">Scope</th>
              <th className="px-3 py-3 font-semibold">Limit</th>
              <th className="px-3 py-3 font-semibold">Results</th>
              <th className="px-3 py-3 font-semibold">Errors</th>
              <th className="px-3 py-3 font-semibold">Top Symbols</th>
            </tr>
          </thead>
          <tbody>
            {snapshots.map((snapshot) => (
              <tr key={snapshot.id} className="border-t border-[var(--border)]">
                <td className="px-3 py-3">{formatDateTime(snapshot.createdAt)}</td>
                <td className="px-3 py-3 uppercase">{snapshot.mode}</td>
                <td className="px-3 py-3">{formatScope(snapshot)}</td>
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
  return (
    <section className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4">
      <h2 className="mb-4 text-lg font-semibold">Latest Leaders</h2>
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
              {result.signalLabel} · {formatEnum(result.phase)}
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

function formatScope(snapshot: StoredScanSnapshot) {
  if (snapshot.mode === "mtf") {
    return snapshot.timeframes?.map((timeframe) => timeframeLabels[timeframe]).join(" / ");
  }

  return snapshot.timeframe ? timeframeLabels[snapshot.timeframe] : "n/a";
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
