"use client";

import { useLanguage } from "@/components/providers/LanguageProvider";

export function Footer() {
  const { dictionary: t } = useLanguage();

  return (
    <footer className="border-t border-[var(--border)] bg-[var(--panel)]">
      <div className="mx-auto max-w-[1800px] px-3 py-3 text-xs leading-5 text-[var(--muted)] sm:px-4">
        {t.footer.disclaimer}
      </div>
    </footer>
  );
}
