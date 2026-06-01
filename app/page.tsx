import Link from "next/link";

export default function HomePage() {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-144px)] max-w-6xl flex-col justify-center gap-8 px-6 py-16">
      <div className="max-w-3xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
          Technical screening and research
        </p>
        <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
          Crypto Technical Scanner
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--muted)]">
          Rank Binance USDT spot pairs by technical structure, volatility
          compression, confirmation strength, and risk context.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/scanner"
          className="rounded-md bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[#06130a]"
        >
          Open Scanner
        </Link>
        <Link
          href="/screener"
          className="rounded-md border border-[var(--border)] px-5 py-3 text-sm font-semibold text-[var(--foreground)]"
        >
          Open Multi-Timeframe Screener
        </Link>
        <Link
          href="/symbol/binance/BTCUSDT"
          className="rounded-md border border-[var(--border)] px-5 py-3 text-sm font-semibold text-[var(--foreground)]"
        >
          View BTCUSDT Detail
        </Link>
      </div>

      <p className="max-w-3xl rounded-md border border-[var(--border)] bg-[var(--panel)] p-4 text-sm leading-6 text-[var(--muted)]">
        This tool is for technical screening and research only. It does not
        provide financial advice, investment advice, trading recommendations,
        or profit guarantees. It does not place trades or connect to user
        wallets or exchange accounts.
      </p>
    </section>
  );
}
