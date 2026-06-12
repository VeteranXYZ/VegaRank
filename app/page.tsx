import Link from "next/link";
import {
  longResearchDisclaimer,
  shortResearchDisclaimer,
} from "@/components/researchCopy";
import {
  PageHeader,
  PageSection,
  PageShell,
  ResearchNotice,
  StatCell,
  StatStrip,
  StatusBadge,
  type StatusTone,
} from "@/components/ui/workspace";
import { getVegaRankApiBaseUrl } from "@/lib/runtime/vegaRankApi";
import { formatDisplayDateTime } from "@/lib/utils/format";

type LatestSnapshotRun = {
  timeframe?: string | null;
  universe?: string | null;
  symbolsScanned?: number | null;
  signalsCreated?: number | null;
  finishedAt?: string | null;
};

type LatestSnapshotSummary = {
  totalSignals?: number | null;
  returnedItems?: number | null;
  eligibleSignals?: number | null;
  watchSignals?: number | null;
  eligible?: number | null;
  watch?: number | null;
};

type LatestSnapshotResponse = {
  ok?: boolean;
  run?: LatestSnapshotRun | null;
  summary?: LatestSnapshotSummary | null;
  count?: number | null;
  timeframe?: string | null;
  assetClass?: string | null;
};

type SnapshotStatus = {
  available: boolean;
  fields: {
    timeframe: string;
    assetClass: string;
    universe: string;
    scanned: string;
    rankedRows: string;
    shown: string;
    highPriority: string;
    watch: string;
    riskContext: string;
    updated: string;
  };
};

const snapshotFallback = "N/A";

const workflowItems = [
  {
    step: "01",
    loop: "Discover",
    page: "Market Rankings",
    href: "/rankings",
    copy: "Review the latest ranked research candidates and grouped market structures.",
    action: "Open Rankings",
    tone: "rows",
  },
  {
    step: "02",
    loop: "Compare",
    page: "Multi-Timeframe Screener",
    href: "/screener",
    copy: "Compare joined 1h, 4h, 1d, and 1w research rows.",
    action: "Open Screener",
    tone: "screener",
  },
  {
    step: "03",
    loop: "Research",
    page: "Symbol Research",
    href: "/symbol/binance/BTCUSDT",
    copy: "Inspect setup quality, evidence reliability, risk context, and archive context for one symbol.",
    action: "Open BTCUSDT Research",
    tone: "summary",
  },
  {
    step: "04",
    loop: "Monitor",
    page: "Local Watchlist",
    href: "/watchlist",
    copy: "Monitor selected symbols against the latest multi-timeframe snapshot.",
    action: "Open Watchlist",
    tone: "selected",
  },
  {
    step: "05",
    loop: "Validate",
    page: "Research Archive",
    href: "/archive",
    copy: "Review stored snapshots and later observation context.",
    action: "Open Archive",
    tone: "observation",
  },
] as const;

const researchPaths = [
  {
    label: "New review",
    path: "Rankings -> Symbol Research -> Watchlist",
    copy: "Start with Market Rankings to review the latest research queue.",
  },
  {
    label: "Cross-timeframe review",
    path: "Screener -> Symbol Research",
    copy: "Use Screener when you need multi-timeframe comparison.",
  },
  {
    label: "Historical review",
    path: "Archive -> Symbol Research",
    copy: "Use Archive when you want stored snapshot and later observation context.",
  },
] as const;

const researchStatusRows = [
  ["Data Source", "Latest public API snapshot"],
  ["Coverage", "Current crypto universe"],
  [
    "Evidence Model",
    "Rank Score / Setup Quality / Risk Context / Evidence Reliability",
  ],
  ["Validation", "Archive snapshots are available when stored runs exist"],
  ["Boundary", shortResearchDisclaimer],
] as const;

export default async function HomePage() {
  const latestSnapshot = await getLatestResearchSnapshot();

  return (
    <PageShell className="gap-3 overflow-x-hidden">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(420px,0.75fr)]">
        <PageHeader
          className="mb-0"
          eyebrow="Research workspace"
          title={
            <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-[18px] leading-6">VegaRank</span>
              <span className="text-[12px] font-semibold text-[var(--muted)]">
                Research Candidate Ranking System
              </span>
            </span>
          }
          tone="screener"
          description={
            <span>
              Rank crypto market structures by setup quality, evidence reliability,
              and risk context. Built to decide what to research first, not what to
              trade.
            </span>
          }
          actions={
            <div className="flex flex-wrap gap-1.5">
              <Link href="/rankings" className="terminal-mini-action is-accent h-7 px-2.5">
                Open Rankings
              </Link>
              <Link href="/screener" className="terminal-mini-action h-7 px-2.5">
                Open Screener
              </Link>
            </div>
          }
          metadata={[
            { label: "Status", value: "Research-only", tone: "accent" },
            { label: "Boundary", value: "No trading instructions", tone: "neutral" },
            { label: "Monitoring", value: "Local watchlist", tone: "info" },
            { label: "Validation", value: "Archive validation", tone: "observation" },
          ]}
        />

        <LatestSnapshotPanel snapshot={latestSnapshot} />
      </div>

      <ResearchWorkflow />

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(440px,0.8fr)]">
        <SuggestedResearchPaths />
        <ResearchStatusPanel />
      </div>

      <ResearchNotice className="max-w-5xl" tone="neutral">
        <span className="font-semibold text-[var(--foreground)]">
          {shortResearchDisclaimer}
        </span>{" "}
        {longResearchDisclaimer} It does not place trades or connect to user wallets
        or exchange accounts.
      </ResearchNotice>
    </PageShell>
  );
}

function LatestSnapshotPanel({ snapshot }: { snapshot: SnapshotStatus }) {
  return (
    <PageSection
      tone={snapshot.available ? "snapshot" : "neutral"}
      title="Latest Research Snapshot"
      description="The most recent ranked universe available from the public API."
      actions={
        <StatusBadge tone={snapshot.available ? "complete" : "missing"}>
          {snapshot.available ? "Current Snapshot" : "Snapshot status unavailable"}
        </StatusBadge>
      }
      bodyClassName="space-y-2 px-3 py-2"
    >
      <StatStrip label="Snapshot">
        <StatCell label="Timeframe" value={snapshot.fields.timeframe} tone="info" />
        <StatCell label="Asset Class" value={snapshot.fields.assetClass} />
        <StatCell label="Universe" value={snapshot.fields.universe} />
        <StatCell label="Risk Context" value={snapshot.fields.riskContext} tone="risk" />
        <StatCell label="Updated" value={snapshot.fields.updated} tone="observation" />
      </StatStrip>

      <div className="grid min-w-0 grid-cols-2 gap-2 md:grid-cols-5">
        <SnapshotMetric label="Scanned" value={snapshot.fields.scanned} />
        <SnapshotMetric label="Research Rows" value={snapshot.fields.rankedRows} />
        <SnapshotMetric label="Shown" value={snapshot.fields.shown} />
        <SnapshotMetric
          label="High Priority"
          value={snapshot.fields.highPriority}
          tone="eligible"
        />
        <SnapshotMetric label="Watch" value={snapshot.fields.watch} tone="watch" />
      </div>

      {!snapshot.available ? (
        <p className="border-t border-[var(--border)] pt-2 text-[11px] leading-4 text-[var(--muted)]">
          Latest snapshot unavailable. The research workflow remains available.
        </p>
      ) : null}
    </PageSection>
  );
}

function SnapshotMetric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: StatusTone;
}) {
  return (
    <div className="min-w-0 border border-[var(--border)] bg-[var(--panel-muted)] px-2 py-1.5">
      <div className="truncate text-[10px] font-semibold uppercase text-[var(--muted)]">
        {label}
      </div>
      <div
        className={`mt-1 truncate font-mono text-[13px] font-semibold tabular-nums ${
          tone === "eligible"
            ? "text-[var(--eligible)]"
            : tone === "watch"
              ? "text-[var(--watch)]"
              : "text-[var(--foreground)]"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function ResearchWorkflow() {
  return (
    <PageSection
      title="Research Workflow"
      description="Move from market discovery to symbol-level research, local monitoring, and archive validation."
      tone="summary"
      bodyClassName="px-3 py-3"
    >
      <div className="grid min-w-0 gap-2 lg:grid-cols-5">
        {workflowItems.map((item) => (
          <article
            key={item.href}
            className="flex min-h-44 min-w-0 flex-col justify-between border border-[var(--border)] bg-[var(--panel-muted)] px-3 py-2"
          >
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] font-semibold text-[var(--muted)]">
                  {item.step}
                </span>
                <StatusBadge tone={getWorkflowTone(item.tone)}>{item.loop}</StatusBadge>
              </div>
              <h2 className="mt-2 text-[13px] font-semibold leading-5 text-[var(--foreground)]">
                {item.page}
              </h2>
              <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">
                {item.copy}
              </p>
            </div>
            <Link
              href={item.href}
              className="terminal-mini-action mt-3 h-7 justify-center px-2"
            >
              {item.action}
            </Link>
          </article>
        ))}
      </div>
      <div className="mt-2 border border-[var(--border)] bg-[var(--panel-muted)] px-2 py-1.5 text-[11px] font-semibold text-[var(--foreground)]">
        Discover -&gt; Compare -&gt; Research -&gt; Monitor -&gt; Validate
      </div>
    </PageSection>
  );
}

function SuggestedResearchPaths() {
  return (
    <PageSection
      title="Suggested Research Paths"
      tone="takeaway"
      bodyClassName="divide-y divide-[var(--border)] px-3 py-1"
    >
      {researchPaths.map((item) => (
        <div key={item.label} className="grid gap-2 py-2 md:grid-cols-[180px_minmax(0,1fr)]">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-[var(--foreground)]">
              {item.label}
            </div>
            <div className="mt-1 font-mono text-[10px] text-[var(--muted)]">
              {item.path}
            </div>
          </div>
          <p className="text-[11px] leading-5 text-[var(--muted)]">{item.copy}</p>
        </div>
      ))}
    </PageSection>
  );
}

function ResearchStatusPanel() {
  return (
    <PageSection
      title="Research Status"
      tone="snapshot"
      bodyClassName="divide-y divide-[var(--border)] px-3 py-1"
    >
      {researchStatusRows.map(([label, value]) => (
        <div key={label} className="grid gap-2 py-2 sm:grid-cols-[150px_minmax(0,1fr)]">
          <div className="text-[10px] font-semibold uppercase text-[var(--muted)]">
            {label}
          </div>
          <div className="text-[11px] leading-5 text-[var(--foreground)]">{value}</div>
        </div>
      ))}
    </PageSection>
  );
}

function getWorkflowTone(tone: (typeof workflowItems)[number]["tone"]): StatusTone {
  switch (tone) {
    case "rows":
      return "info";
    case "screener":
      return "accent";
    case "summary":
      return "positive";
    case "selected":
      return "watch";
    case "observation":
      return "observation";
  }
}

async function getLatestResearchSnapshot(): Promise<SnapshotStatus> {
  const response = await fetchLatestResearchSnapshot();

  if (!response?.ok || !response.run) {
    return buildUnavailableSnapshot(response);
  }

  const run = response.run;
  const summary = response.summary;
  const totalRows = firstFiniteNumber(summary?.totalSignals, run.signalsCreated);
  const shownRows = firstFiniteNumber(summary?.returnedItems, response.count);
  const highPriority = firstFiniteNumber(summary?.eligible, summary?.eligibleSignals);
  const watch = firstFiniteNumber(summary?.watch, summary?.watchSignals);

  return {
    available: true,
    fields: {
      timeframe: formatText(response.timeframe ?? run.timeframe),
      assetClass: formatText(response.assetClass),
      universe: formatText(run.universe),
      scanned: formatInteger(run.symbolsScanned),
      rankedRows: formatInteger(totalRows),
      shown: formatInteger(shownRows),
      highPriority: formatInteger(highPriority),
      watch: formatInteger(watch),
      riskContext: "Included",
      updated: formatUtcDateTime(run.finishedAt),
    },
  };
}

async function fetchLatestResearchSnapshot(): Promise<LatestSnapshotResponse | null> {
  const url = `${getVegaRankApiBaseUrl()}/api/rankings/latest?timeframe=4h&assetClass=crypto&limit=100`;

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { accept: "application/json" },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as LatestSnapshotResponse;
  } catch {
    return null;
  }
}

function buildUnavailableSnapshot(
  response: LatestSnapshotResponse | null,
): SnapshotStatus {
  return {
    available: false,
    fields: {
      timeframe: formatText(response?.timeframe ?? "4h"),
      assetClass: formatText(response?.assetClass ?? "crypto"),
      universe: formatText(response?.run?.universe),
      scanned: formatInteger(response?.run?.symbolsScanned),
      rankedRows: formatInteger(response?.summary?.totalSignals),
      shown: formatInteger(response?.summary?.returnedItems ?? response?.count),
      highPriority: formatInteger(
        firstFiniteNumber(response?.summary?.eligible, response?.summary?.eligibleSignals),
      ),
      watch: formatInteger(
        firstFiniteNumber(response?.summary?.watch, response?.summary?.watchSignals),
      ),
      riskContext: response?.run ? "Included" : snapshotFallback,
      updated: formatUtcDateTime(response?.run?.finishedAt),
    },
  };
}

function formatText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : snapshotFallback;
}

function formatInteger(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return snapshotFallback;
  }

  return Math.trunc(value).toLocaleString("en-US");
}

function formatUtcDateTime(value: string | null | undefined) {
  if (!value) {
    return snapshotFallback;
  }

  const formatted = formatDisplayDateTime(value, {
    fallback: snapshotFallback,
    timeZone: "utc",
  });

  return formatted === snapshotFallback ? formatted : `${formatted} UTC`;
}

function firstFiniteNumber(
  ...values: Array<number | null | undefined>
): number | null {
  return values.find((value) => typeof value === "number" && Number.isFinite(value)) ?? null;
}
