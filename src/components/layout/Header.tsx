"use client";

import Link from "next/link";
import { LanguageToggle, useLanguage } from "@/components/providers/LanguageProvider";

export function Header() {
  const { dictionary: t } = useLanguage();

  return (
    <header className="border-b border-[var(--border)] bg-[#0d131a]">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/" className="text-base font-semibold">
          {t.nav.brand}
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-sm text-[var(--muted)]">
          <Link href="/scanner">{t.nav.scanner}</Link>
          <Link href="/history">{t.nav.history}</Link>
          <Link href="/symbol/binance/BTCUSDT">{t.nav.btc}</Link>
          <LanguageToggle />
        </nav>
      </div>
    </header>
  );
}
