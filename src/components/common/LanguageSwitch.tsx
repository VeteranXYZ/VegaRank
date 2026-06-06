"use client";

import { useAppLanguage } from "@/lib/i18n/AppLanguageProvider";
import type { AppLanguage } from "@/lib/i18n/language";

const languageOptions: Array<{ label: string; value: AppLanguage }> = [
  { label: "EN", value: "en" },
  { label: "中文", value: "zh" },
];

export function LanguageSwitch() {
  const { language, setLanguage } = useAppLanguage();

  return (
    <div
      className="inline-flex h-6 items-center overflow-hidden border border-[var(--border)] bg-[var(--control)] text-[10px] font-semibold leading-none"
      aria-label="Language"
    >
      {languageOptions.map((option, index) => {
        const isActive = option.value === language;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => setLanguage(option.value)}
            className={`h-full px-2 transition ${
              isActive
                ? "bg-[var(--accent)] text-on-accent"
                : "text-[var(--muted)] hover:bg-[var(--row-hover)] hover:text-[var(--foreground)]"
            } ${index > 0 ? "border-l border-[var(--border)]" : ""}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
