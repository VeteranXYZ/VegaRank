import { useAppLanguage } from "@/lib/i18n/AppLanguageProvider";
import type { ScannerSignal } from "@/lib/shared/scannerTypes";

type SignalBadgeProps = {
  signal: ScannerSignal;
};

export const signalToneClass: Record<ScannerSignal["state"], string> = {
  WATCHLIST: "border-[var(--watch-border)] bg-[var(--watch-bg)] text-[var(--watch)]",
  CONFIRMED:
    "border-[var(--eligible-border)] bg-[var(--eligible-bg)] text-[var(--eligible)]",
  TREND_CONTINUATION:
    "border-[var(--info-border)] bg-[var(--info-bg)] text-[var(--info)]",
  HIGH_RISK: "border-[var(--risk-border)] bg-[var(--risk-bg)] text-[var(--risk)]",
  WEAK:
    "border-[var(--overheated-border)] bg-[var(--overheated-bg)] text-[var(--overheated)]",
  NEUTRAL:
    "border-[var(--neutral-border)] bg-[var(--neutral-bg)] text-[var(--neutral)]",
};

export function SignalBadge({ signal }: SignalBadgeProps) {
  const { dictionary: t } = useAppLanguage();

  return (
    <span
      className={`inline-flex h-5 items-center border px-1.5 text-[11px] font-semibold leading-none ${signalToneClass[signal.state]}`}
      title={t.signalSummary[signal.state]}
    >
      {t.signal[signal.state]}
    </span>
  );
}
