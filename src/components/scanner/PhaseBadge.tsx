import { useLanguage } from "@/components/providers/LanguageProvider";
import type { MarketPhase } from "@/lib/scanner/types";

type PhaseBadgeProps = {
  phase: MarketPhase;
};

export function PhaseBadge({ phase }: PhaseBadgeProps) {
  const { dictionary: t } = useLanguage();

  return (
    <span className="inline-flex rounded-md bg-[#16251b] px-2 py-1 text-xs font-semibold text-[var(--accent)]">
      {t.phase[phase]}
    </span>
  );
}
