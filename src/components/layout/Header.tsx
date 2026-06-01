"use client";

import Link from "next/link";
import { LanguageToggle, useLanguage } from "@/components/providers/LanguageProvider";

export function Header() {
  const { dictionary: t } = useLanguage();

  return (
    <header className="border-b border-[var(--border)] bg-[#090e14]">
      <div className="mx-auto flex min-h-11 max-w-[1800px] flex-wrap items-center justify-between gap-2 px-3 py-1.5 sm:px-4">
        <Link href="/" className="text-sm font-semibold leading-none">
          {t.nav.brand}
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
          <Link href="/scanner">{t.nav.scanner}</Link>
          <Link href="/screener">Screener</Link>
          <Link href="/history">{t.nav.history}</Link>
          <Link href="/symbol/binance/BTCUSDT">{t.nav.btc}</Link>
          <LanguageToggle />
        </nav>
      </div>
    </header>
  );
}
