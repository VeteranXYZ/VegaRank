import { useLanguage } from "@/components/providers/LanguageProvider";
import { formatScannerExplanation } from "@/lib/i18n/formatScannerExplanation";
import type { ScannerExplanation } from "@/lib/shared/scannerTypes";

type ReasonListProps = {
  title: string;
  items: ScannerExplanation[];
};

export function ReasonList({ title, items }: ReasonListProps) {
  const { dictionary: t } = useLanguage();

  return (
    <div>
      <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
        {title}
      </h3>
      <ul className="space-y-1.5 text-xs leading-5 text-[var(--foreground)]">
        {items.map((item) => (
          <li
            key={`${item.key}-${JSON.stringify(item.params ?? {})}`}
            className="rounded border border-[var(--border)] bg-[#0b0f14]/80 px-2 py-1.5"
          >
            {formatScannerExplanation(item, t)}
          </li>
        ))}
      </ul>
    </div>
  );
}
