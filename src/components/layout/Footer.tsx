"use client";

import { useLanguage } from "@/components/providers/LanguageProvider";

export function Footer() {
  const { dictionary: t } = useLanguage();

  return (
    <footer className="border-t border-[var(--border)] bg-[#0d131a]">
      <div className="mx-auto max-w-[1600px] px-4 py-5 text-sm text-[var(--muted)] sm:px-6">
        {t.footer.disclaimer}
      </div>
    </footer>
  );
}
