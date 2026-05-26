import { useLanguage } from "@/components/providers/LanguageProvider";
import type { ScannerSignal } from "@/lib/shared/scannerTypes";

type SignalBadgeProps = {
  signal: ScannerSignal;
};

export const signalToneClass: Record<ScannerSignal["state"], string> = {
  WATCHLIST: "border-[#8f7a31] bg-[#221d0d] text-[var(--warning)]",
  CONFIRMED: "border-[#2f7d46] bg-[#132119] text-[var(--accent)]",
  TREND_CONTINUATION: "border-[#2d5b89] bg-[#101b29] text-[#86b7ef]",
  HIGH_RISK: "border-[#8f3a3a] bg-[#2a1414] text-[var(--danger)]",
  WEAK: "border-[#6d4a2f] bg-[#23180f] text-[#d8a16b]",
  NEUTRAL: "border-[var(--border)] bg-[#0b0f14] text-[var(--muted)]",
};

export function SignalBadge({ signal }: SignalBadgeProps) {
  const { dictionary: t } = useLanguage();

  return (
    <span
      className={`inline-flex h-5 items-center rounded border px-1.5 text-[11px] font-semibold leading-none ${signalToneClass[signal.state]}`}
      title={t.signalSummary[signal.state]}
    >
      {t.signal[signal.state]}
    </span>
  );
}
