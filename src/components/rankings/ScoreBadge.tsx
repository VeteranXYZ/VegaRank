type ScoreBadgeProps = {
  label: string;
  value: number;
  tone?: "default" | "risk";
  compact?: boolean;
};

export function ScoreBadge({
  label,
  value,
  tone = "default",
  compact = false,
}: ScoreBadgeProps) {
  const color = tone === "risk" ? "text-[var(--warning)]" : "text-[var(--accent)]";

  return (
    <span
      className={`inline-flex items-center justify-between gap-1.5 rounded border border-[var(--border)] bg-[var(--panel-2)] px-2 py-1 text-[11px] ${
        compact ? "min-w-0" : "min-w-24"
      }`}
    >
      <span className="truncate text-[var(--muted)]">{label}</span>
      <span className={`font-semibold tabular-nums ${color}`}>
        {value.toFixed(0)}
      </span>
    </span>
  );
}
