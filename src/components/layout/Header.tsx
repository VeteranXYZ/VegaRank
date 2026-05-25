import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-[var(--border)] bg-[#0d131a]">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-base font-semibold">
          Crypto Technical Scanner
        </Link>
        <nav className="flex items-center gap-4 text-sm text-[var(--muted)]">
          <Link href="/scanner">Scanner</Link>
          <Link href="/history">History</Link>
          <Link href="/symbol/binance/BTCUSDT">BTCUSDT</Link>
        </nav>
      </div>
    </header>
  );
}
