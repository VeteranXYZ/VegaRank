type RiskBadgeProps = {
  label: string;
};

export function RiskBadge({ label }: RiskBadgeProps) {
  return (
    <span className="inline-flex rounded border border-[#8f6b24]/40 bg-[#2b2111]/70 px-1.5 py-0.5 text-[11px] font-semibold leading-4 text-[var(--warning)]">
      {label}
    </span>
  );
}
