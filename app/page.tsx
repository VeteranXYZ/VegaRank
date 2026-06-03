import Link from "next/link";
import { longResearchDisclaimer } from "@/components/researchCopy";

export default function HomePage() {
  const workspaceLinks = [
    {
      href: "/scanner",
      title: "Latest Scan Results",
      description: "Review the latest persisted scanner run and grouped signals.",
      action: "Open Scanner",
      primary: true,
    },
    {
      href: "/screener",
      title: "Multi-Timeframe Screener",
      description: "Compare joined 1h, 4h, 1d, and 1w research rows.",
      action: "Open Screener",
      primary: false,
    },
    {
      href: "/watchlist",
      title: "Watchlist Research",
      description: "Monitor selected symbols against the latest MTF snapshot.",
      action: "Open Watchlist",
      primary: false,
    },
    {
      href: "/history",
      title: "Historical Research",
      description: "Inspect stored snapshots and forward observation context.",
      action: "Open History",
      primary: false,
    },
  ];

  return (
    <section className="mx-auto max-w-[1800px] px-3 py-5 sm:px-4">
      <div className="mb-4 border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--accent)]">
          Technical screening workspace
        </p>
        <h1 className="mt-1 text-2xl font-semibold leading-tight">
          Crypto Technical Scanner
        </h1>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--muted)]">
          Rank Binance USDT spot pairs by technical structure, volatility
          compression, confirmation strength, and risk context.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {workspaceLinks.map((item) => (
          <section
            key={item.href}
            className="flex min-h-40 flex-col justify-between border border-[var(--border)] bg-[var(--panel)] p-4"
          >
            <div>
              <h2 className="text-sm font-semibold text-[var(--foreground)]">
                {item.title}
              </h2>
              <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                {item.description}
              </p>
            </div>
            <Link
              href={item.href}
              className={`mt-4 inline-flex h-8 items-center justify-center rounded border px-3 text-xs font-semibold ${
                item.primary
                  ? "border-[var(--accent)] bg-[var(--accent)] text-on-accent"
                  : "border-[var(--border)] bg-[var(--control)] text-[var(--foreground)] hover:border-[var(--info)]"
              }`}
            >
              {item.action}
            </Link>
          </section>
        ))}
      </div>

      <p className="mt-4 max-w-5xl border border-[var(--border)] bg-[var(--panel-2)] p-3 text-xs leading-5 text-[var(--muted)]">
        {longResearchDisclaimer} It does not place trades or connect to user wallets
        or exchange accounts.
      </p>
    </section>
  );
}
