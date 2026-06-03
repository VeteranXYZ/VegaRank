import { useLanguage } from "@/components/providers/LanguageProvider";
import type { ScannerSignal } from "@/lib/shared/scannerTypes";

type SignalBadgeProps = {
  signal: ScannerSignal;
};

export const signalToneClass: Record<ScannerSignal["state"], string> = {
  WATCHLIST: "border-[#8f7a31]/70 bg-[var(--warning-bg)] text-[var(--warning)]",
  CONFIRMED: "border-[#2f7d46]/70 bg-[var(--positive-bg)] text-[var(--accent)]",
  TREND_CONTINUATION: "border-[#2d5b89]/70 bg-[var(--info-bg)] text-[var(--info)]",
  HIGH_RISK: "border-[#8f3a3a]/70 bg-[var(--danger-bg)] text-[var(--danger)]",
  WEAK: "border-[#6d4a2f]/70 bg-[var(--warning-bg)] text-[var(--warning)]",
  NEUTRAL: "border-[var(--border)] bg-[var(--control)] text-[var(--muted)]",
};

export function SignalBadge({ signal }: SignalBadgeProps) {
  const { dictionary: t } = useLanguage();

  return (
    <span
      className={`inline-flex h-5 items-center border px-1.5 text-[11px] font-semibold leading-none ${signalToneClass[signal.state]}`}
      title={t.signalSummary[signal.state]}
    >
      {t.signal[signal.state]}
    </span>
  );
}
