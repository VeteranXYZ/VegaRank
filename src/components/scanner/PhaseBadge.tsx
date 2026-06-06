import { useAppLanguage } from "@/lib/i18n/AppLanguageProvider";
import type { MarketPhase } from "@/lib/shared/scannerTypes";

type PhaseBadgeProps = {
  phase: MarketPhase;
};

export function PhaseBadge({ phase }: PhaseBadgeProps) {
  const { dictionary: t } = useAppLanguage();

  return (
    <span className="inline-flex h-5 items-center border border-[var(--positive-border)] bg-[var(--positive-bg)] px-1.5 text-[11px] font-semibold leading-none text-[var(--positive)]">
      {t.phase[phase]}
    </span>
  );
}
