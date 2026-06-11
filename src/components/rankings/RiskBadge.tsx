type RiskBadgeProps = {
  label: string;
};

export function RiskBadge({ label }: RiskBadgeProps) {
  return (
    <span className="inline-flex border-l border-[var(--warning-border)] bg-[var(--warning-bg)] px-1.5 py-0.5 text-[11px] font-semibold leading-4 text-[var(--warning)]">
      {label}
    </span>
  );
}
