import { useLanguage } from "@/components/providers/LanguageProvider";
import type { MarketPhase } from "@/lib/shared/scannerTypes";

type PhaseBadgeProps = {
  phase: MarketPhase;
};

export function PhaseBadge({ phase }: PhaseBadgeProps) {
  const { dictionary: t } = useLanguage();

  return (
    <span className="inline-flex h-5 items-center rounded border border-[#2f7d46]/50 bg-[#16251b]/70 px-1.5 text-[11px] font-semibold leading-none text-[var(--accent)]">
      {t.phase[phase]}
    </span>
  );
}
