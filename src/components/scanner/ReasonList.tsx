import { useLanguage } from "@/components/providers/LanguageProvider";
import { formatScannerExplanation } from "@/lib/i18n/formatScannerExplanation";
import type { ScannerExplanation } from "@/lib/shared/scannerTypes";

type ReasonListProps = {
  title: string;
  items: ScannerExplanation[];
};

export function ReasonList({ title, items }: ReasonListProps) {
  const { dictionary: t } = useLanguage();
  const visibleItems = items.slice(0, 5);
  const hiddenItems = items.slice(5);

  return (
    <div>
      <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
        {title}
      </h3>
      <ul className="space-y-1 text-[11px] leading-5 text-[var(--foreground)]">
        {visibleItems.map((item) => (
          <li
            key={`${item.key}-${JSON.stringify(item.params ?? {})}`}
            className="border-l border-[var(--border)] bg-[#0b0f14]/45 px-2 py-0.5"
          >
            {formatScannerExplanation(item, t)}
          </li>
        ))}
      </ul>
      {hiddenItems.length > 0 && (
        <details className="mt-1 text-[11px] leading-5 text-[var(--foreground)]">
          <summary className="cursor-pointer list-none text-[10px] font-semibold text-[var(--info)]">
            {t.scanner.more} {hiddenItems.length}
          </summary>
          <ul className="mt-1 space-y-1">
            {hiddenItems.map((item) => (
              <li
                key={`${item.key}-${JSON.stringify(item.params ?? {})}`}
                className="border-l border-[var(--border)] bg-[#0b0f14]/45 px-2 py-0.5"
              >
                {formatScannerExplanation(item, t)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
