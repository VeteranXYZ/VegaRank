"use client";

import { useLanguage } from "@/components/providers/LanguageProvider";

export function Footer() {
  const { dictionary: t } = useLanguage();

  return (
    <footer className="border-t border-[var(--border)] bg-[var(--panel-elevated)]">
      <div className="mx-auto max-w-[1760px] px-2 py-3 text-[11px] leading-5 text-[var(--muted)] sm:px-3">
        {t.footer.disclaimer}
      </div>
    </footer>
  );
}
