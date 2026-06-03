"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/providers/LanguageProvider";

const navItems = [
  { href: "/scanner", labelKey: "scanner" },
  { href: "/screener", label: "Screener" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/history", labelKey: "history" },
  { href: "/symbol/binance/BTCUSDT", labelKey: "btc" },
] as const;

export function Header() {
  const { dictionary: t } = useLanguage();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--header-bg)] backdrop-blur">
      <div className="mx-auto flex min-h-9 max-w-[1760px] flex-wrap items-center justify-between gap-2 px-2 py-1 sm:px-3">
        <Link
          href="/"
          className="flex items-center gap-2 text-[13px] font-semibold leading-none text-[var(--foreground)]"
        >
          <span className="h-2.5 w-2.5 rounded-full border border-[var(--accent-border)] bg-[var(--accent)]" />
          <span>{t.nav.brand}</span>
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-1 text-[11px] font-semibold text-[var(--muted)]">
          {navItems.map((item) => {
            const label =
              "label" in item ? item.label : t.nav[item.labelKey];
            const isSymbolLink = item.href.startsWith("/symbol");
            const isActive = isSymbolLink
              ? pathname.startsWith("/symbol")
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`border px-2 py-1 transition ${
                  isActive
                  ? "border-[var(--accent-border)] bg-[var(--panel)] text-[var(--accent)] shadow-[inset_0_-2px_0_var(--accent)]"
                    : "border-transparent hover:border-[var(--border-medium)] hover:bg-[var(--row-hover)] hover:text-[var(--foreground)]"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
