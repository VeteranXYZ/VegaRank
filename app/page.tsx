import Link from "next/link";
import { longResearchDisclaimer } from "@/components/researchCopy";
import {
  PageHeader,
  PageSection,
  PageShell,
  ResearchNotice,
  StatusBadge,
} from "@/components/ui/workspace";

export default function HomePage() {
  const workspaceLinks = [
    {
      href: "/rankings",
      title: "Market Rankings",
      description: "Review the latest ranked research results and grouped setups.",
      action: "Open Rankings",
      primary: true,
      tone: "rows" as const,
    },
    {
      href: "/screener",
      title: "Multi-Timeframe Screener",
      description: "Compare joined 1h, 4h, 1d, and 1w research rows.",
      action: "Open Screener",
      primary: false,
      tone: "screener" as const,
    },
    {
      href: "/watchlist",
      title: "Watchlist Research",
      description: "Monitor selected symbols against the latest MTF snapshot.",
      action: "Open Watchlist",
      primary: false,
      tone: "selected" as const,
    },
    {
      href: "/archive",
      title: "Research Archive",
      description: "Inspect stored snapshots and forward observation context.",
      action: "Open Archive",
      primary: false,
      tone: "observation" as const,
    },
  ];

  return (
    <PageShell className="min-h-0">
      <PageHeader
        eyebrow="Technical research rankings"
        title="VegaRank"
        tone="screener"
        description="Rank crypto setups by structure, confirmation, and risk context."
        metadata={[
          { label: "Mode", value: "Research-only", tone: "accent" },
          { label: "Guidance", value: "No instructions", tone: "neutral" },
          { label: "Accounts", value: "Not connected", tone: "neutral" },
          { label: "Primary view", value: "Rankings", tone: "info" },
        ]}
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {workspaceLinks.map((item) => (
          <PageSection
            key={item.href}
            className="min-h-40"
            tone={item.tone}
            bodyClassName="flex min-h-40 flex-col justify-between p-4"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-[var(--foreground)]">
                  {item.title}
                </h2>
                {item.primary ? (
                  <StatusBadge tone="accent">Primary</StatusBadge>
                ) : null}
              </div>
              <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                {item.description}
              </p>
            </div>
            <Link
              href={item.href}
              className={`mt-4 inline-flex h-8 items-center justify-center rounded border px-3 text-xs font-semibold ${
                item.primary
                  ? "border-[var(--accent)] bg-[var(--accent)] text-on-accent"
                  : "border-[var(--border)] bg-[var(--control)] text-[var(--foreground)] hover:border-[var(--border-strong)] hover:bg-[var(--row-hover)]"
              }`}
            >
              {item.action}
            </Link>
          </PageSection>
        ))}
      </div>

      <ResearchNotice className="mt-4 max-w-5xl" tone="neutral">
        {longResearchDisclaimer} It does not place trades or connect to user wallets
        or exchange accounts.
      </ResearchNotice>
    </PageShell>
  );
}
