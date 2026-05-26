import { useLanguage } from "@/components/providers/LanguageProvider";
import type { ScannerSignalState } from "@/lib/shared/scannerTypes";
import { signalToneClass } from "./SignalBadge";

export type SignalSummaryItem = {
  signal: ScannerSignalState | "ALL";
  count: number;
};

type SignalSummaryBarProps = {
  items: SignalSummaryItem[];
  activeSignal: ScannerSignalState | "ALL";
  onSelect: (signal: ScannerSignalState | "ALL") => void;
};

export function SignalSummaryBar({
  items,
  activeSignal,
  onSelect,
}: SignalSummaryBarProps) {
  const { dictionary: t } = useLanguage();

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-[var(--border)] px-3 py-2">
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => {
          const isActive = item.signal === activeSignal;
          const label = item.signal === "ALL" ? t.common.all : t.signal[item.signal];
          const tone =
            item.signal === "ALL"
              ? "border-[var(--border)] bg-[#0b0f14] text-[var(--foreground)]"
              : signalToneClass[item.signal];

          return (
            <button
              key={item.signal}
              type="button"
              onClick={() => onSelect(item.signal)}
              className={`inline-flex h-6 items-center gap-1.5 rounded border px-2 text-[11px] font-semibold transition hover:border-[var(--foreground)] ${tone} ${
                isActive ? "ring-1 ring-[var(--foreground)]" : ""
              }`}
              aria-pressed={isActive}
            >
              <span>{label}</span>
              <span className="tabular-nums text-[var(--foreground)]">
                {item.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
