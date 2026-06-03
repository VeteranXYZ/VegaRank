import {
  buildMarketContextPanelView,
  type MarketContextPanelState,
} from "./marketContextUi";

type MarketContextPanelProps = MarketContextPanelState & {
  variant?: "full" | "compact";
  implication?: string;
  className?: string;
};

export function MarketContextPanel({
  data,
  isLoading = false,
  isError = false,
  variant = "full",
  implication,
  className,
}: MarketContextPanelProps) {
  const view = buildMarketContextPanelView({ data, isLoading, isError });
  const isCompact = variant === "compact";
  const description = isCompact
    ? getCompactDescription(view.unavailable)
    : view.description;
  const implicationText =
    implication || getDefaultImplication(view.contextNote, isCompact);

  return (
    <section
      className={joinClassNames(
        "border border-[var(--border)] bg-[var(--panel)] px-3 py-3 shadow-[inset_3px_0_0_rgba(56,189,248,0.28)]",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            {isCompact ? "Market Backdrop" : "Market Context"}
          </div>
          <h2 className="mt-1 text-sm font-semibold text-[var(--foreground)]">
            {view.title}
          </h2>
          <p className="mt-1 max-w-5xl text-[11px] leading-5 text-[var(--muted)]">
            {isCompact
              ? "BTC/ETH proxy context for research-only interpretation. Context only; does not alter this symbol's scanner classification."
              : "BTC/ETH regime backdrop for research-only interpretation. This is not a scanner signal and does not change rankings or classifications."}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold uppercase text-[var(--muted)]">
          <span className="border border-[var(--border)] px-1.5 py-0.5">
            Research-only
          </span>
          <span className="border border-[var(--border)] px-1.5 py-0.5">
            Backdrop, not signal
          </span>
        </div>
      </div>

      <p className="mt-3 max-w-6xl text-xs leading-5 text-[var(--foreground)]">
        {description}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {view.chips.map((chip) => (
          <span
            key={`${chip.label}-${chip.value}`}
            className={`inline-flex items-center gap-1 border px-2 py-1 text-[11px] ${getChipClassName(
              chip.tone,
            )}`}
          >
            <span className="font-semibold text-[var(--muted)]">
              {chip.label}
            </span>
            <span>{chip.value}</span>
          </span>
        ))}
      </div>

      {!isCompact && view.keyPoints.length > 0 ? (
        <div className="mt-3 border-t border-[var(--border)] pt-2">
          <div className="text-[10px] font-semibold uppercase text-[var(--muted)]">
            Layer notes
          </div>
          <ul className="mt-2 grid gap-1.5 md:grid-cols-2">
          {view.keyPoints.map((point) => (
            <li
              key={point}
              className="border border-[var(--border)] bg-[var(--panel-2)] px-2 py-1.5 text-[11px] leading-4 text-[var(--muted)]"
            >
              {point}
            </li>
          ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-3 border-t border-[var(--border)] pt-2">
        <div className="text-[10px] font-semibold uppercase text-[var(--muted)]">
          Research implication
        </div>
        <p className="mt-1 text-[11px] leading-4 text-[var(--muted)]">
          {implicationText}
          {implicationText.includes("informational") || isCompact
            ? ""
            : " This context is informational and does not alter symbol-level classifications."}
        </p>
      </div>
    </section>
  );
}

function getCompactDescription(unavailable: boolean) {
  if (unavailable) {
    return "Market context is unavailable. Symbol research data is still shown normally.";
  }

  return "Broader regime context is shown as a backdrop only. Symbol-level signal remains primary.";
}

function getDefaultImplication(contextNote: string, isCompact: boolean) {
  if (isCompact && contextNote.includes("informational")) {
    return "Does not alter this symbol's scanner classification.";
  }

  return contextNote;
}

function joinClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ");
}

function getChipClassName(tone: "constructive" | "risk" | "mixed" | "neutral") {
  switch (tone) {
    case "constructive":
      return "border-emerald-500/40 bg-[var(--positive-bg)] text-[var(--positive)]";
    case "risk":
      return "border-rose-500/45 bg-[var(--danger-bg)] text-[var(--danger)]";
    case "mixed":
      return "border-amber-500/45 bg-[var(--warning-bg)] text-[var(--warning)]";
    case "neutral":
      return "border-[var(--border)] bg-[var(--panel-2)] text-[var(--muted)]";
  }
}
