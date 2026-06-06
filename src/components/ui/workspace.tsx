import type { ButtonHTMLAttributes, ReactNode } from "react";

export type StatusTone =
  | "neutral"
  | "accent"
  | "positive"
  | "negative"
  | "warning"
  | "danger"
  | "info"
  | "observation"
  | "eligible"
  | "watch"
  | "risk"
  | "overheated"
  | "complete"
  | "partial"
  | "missing";

export type SectionTone =
  | "neutral"
  | "selected"
  | "observation"
  | "summary"
  | "takeaway"
  | "rows"
  | "snapshot"
  | "screener";

type MetadataItem = {
  label: string;
  value: ReactNode;
  tone?: StatusTone;
};

const toneClass: Record<StatusTone, string> = {
  neutral:
    "border-[var(--neutral-border)] bg-[var(--neutral-bg)] text-[var(--neutral)]",
  accent: "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]",
  positive:
    "border-[var(--positive-border)] bg-[var(--positive-bg)] text-[var(--positive)]",
  negative:
    "border-[var(--negative-border)] bg-[var(--negative-bg)] text-[var(--negative)]",
  warning:
    "border-[var(--warning-border)] bg-[var(--warning-bg)] text-[var(--warning)]",
  danger: "border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger)]",
  info: "border-[var(--info-border)] bg-[var(--info-bg)] text-[var(--info)]",
  observation:
    "border-[var(--observation-border)] bg-[var(--observation-bg)] text-[var(--observation)]",
  eligible:
    "border-[var(--eligible-border)] bg-[var(--eligible-bg)] text-[var(--eligible)]",
  watch: "border-[var(--watch-border)] bg-[var(--watch-bg)] text-[var(--watch)]",
  risk: "border-[var(--risk-border)] bg-[var(--risk-bg)] text-[var(--risk)]",
  overheated:
    "border-[var(--overheated-border)] bg-[var(--overheated-bg)] text-[var(--overheated)]",
  complete:
    "border-[var(--complete-border)] bg-[var(--complete-bg)] text-[var(--complete)]",
  partial:
    "border-[var(--partial-border)] bg-[var(--partial-bg)] text-[var(--partial)]",
  missing:
    "border-[var(--missing-border)] bg-[var(--missing-bg)] text-[var(--missing)]",
};

const toneAccentClass: Record<StatusTone, string> = {
  neutral: "border-l-[var(--neutral-border)] text-[var(--neutral)]",
  accent: "border-l-[var(--accent)] text-[var(--accent)]",
  positive: "border-l-[var(--positive)] text-[var(--positive)]",
  negative: "border-l-[var(--negative)] text-[var(--negative)]",
  warning: "border-l-[var(--warning)] text-[var(--warning)]",
  danger: "border-l-[var(--danger)] text-[var(--danger)]",
  info: "border-l-[var(--info)] text-[var(--info)]",
  observation: "border-l-[var(--observation)] text-[var(--observation)]",
  eligible: "border-l-[var(--eligible)] text-[var(--eligible)]",
  watch: "border-l-[var(--watch)] text-[var(--watch)]",
  risk: "border-l-[var(--risk)] text-[var(--risk)]",
  overheated: "border-l-[var(--overheated)] text-[var(--overheated)]",
  complete: "border-l-[var(--complete)] text-[var(--complete)]",
  partial: "border-l-[var(--partial)] text-[var(--partial)]",
  missing: "border-l-[var(--missing)] text-[var(--missing)]",
};

const sectionToneClass: Record<SectionTone, string> = {
  neutral: "border-l-[var(--section-snapshot)]",
  selected: "border-l-[var(--section-selected)]",
  observation: "border-l-[var(--section-observation)]",
  summary: "border-l-[var(--section-summary)]",
  takeaway: "border-l-[var(--section-takeaway)]",
  rows: "border-l-[var(--section-rows)]",
  snapshot: "border-l-[var(--section-snapshot)]",
  screener: "border-l-[var(--accent)]",
};

export function PageShell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`mx-auto flex min-h-[calc(100vh-1px)] max-w-[1880px] flex-col bg-[var(--workspace-background)] px-2 py-2 sm:px-3 ${className}`}
    >
      {children}
    </section>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  metadata,
  tone = "screener",
  className = "",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  metadata?: MetadataItem[];
  tone?: SectionTone;
  className?: string;
}) {
  return (
    <header
      className={`mb-2 border border-l-4 border-[var(--border)] bg-[var(--panel-elevated)] px-3 py-2 shadow-[var(--shadow-panel)] ${sectionToneClass[tone]} ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[10px] font-semibold uppercase tracking-normal text-[var(--accent)]">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-[14px] font-semibold leading-5 text-[var(--foreground)]">
            {title}
          </h1>
          {description ? (
            <p className="mt-0.5 max-w-3xl text-[11px] leading-4 text-[var(--muted)]">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="max-w-full shrink-0">{actions}</div> : null}
      </div>
      {metadata && metadata.length > 0 ? (
        <MetadataStrip items={metadata} className="mt-2" />
      ) : null}
    </header>
  );
}

export function PageSection({
  title,
  description,
  actions,
  children,
  tone = "neutral",
  className = "",
  bodyClassName = "",
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  tone?: SectionTone;
  className?: string;
  bodyClassName?: string;
}) {
  const hasHeader = title || description || actions;

  return (
    <section
      className={`border border-l-4 border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-panel)] ${sectionToneClass[tone]} ${className}`}
    >
      {hasHeader ? (
        <SectionHeader title={title} description={description} actions={actions} />
      ) : null}
      <div className={bodyClassName || (hasHeader ? "px-3 py-2" : "p-3")}>
        {children}
      </div>
    </section>
  );
}

export function SectionHeader({
  title,
  description,
  actions,
  className = "",
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap items-start justify-between gap-2 border-b border-[var(--border)] px-3 py-1.5 ${className}`}
    >
      <div className="min-w-0">
        {title ? (
          <h2 className="text-[13px] font-semibold leading-5 text-[var(--foreground)]">
            {title}
          </h2>
        ) : null}
        {description ? (
          <p className="mt-0.5 max-w-3xl text-[11px] leading-4 text-[var(--muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="max-w-full">{actions}</div> : null}
    </div>
  );
}

export function PageToolbar({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 border border-[var(--border)] bg-[var(--panel)] px-2 py-2 ${className}`}
    >
      {children}
    </div>
  );
}

export function ControlGroup({
  title,
  children,
  className = "",
}: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`space-y-2 border-t border-[var(--border)] pt-3 first:border-t-0 first:pt-0 ${className}`}>
      {title ? (
        <h3 className="text-[10px] font-semibold uppercase tracking-normal text-[var(--muted)]">
          {title}
        </h3>
      ) : null}
      {children}
    </section>
  );
}

export function MetadataStrip({
  items,
  className = "",
}: {
  items: MetadataItem[];
  className?: string;
}) {
  return (
    <dl
      className={`flex flex-wrap gap-x-3 gap-y-1 border-t border-[var(--border)] pt-1.5 text-[11px] ${className}`}
    >
      {items.map((item) => (
        <div key={item.label} className="min-w-0 max-w-full">
          <dt className="inline text-[10px] font-semibold uppercase tracking-normal text-[var(--muted)]">
            {item.label}
          </dt>
          <dd
            className={`ml-1 inline-flex max-w-full items-center border px-1.5 py-0.5 font-semibold ${
              toneClass[item.tone ?? "neutral"]
            }`}
          >
            <span className="truncate">{item.value}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function MetricCard({
  label,
  value,
  tone = "neutral",
  detail,
  className = "",
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: StatusTone;
  detail?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`min-w-0 border-l-2 bg-[var(--panel)] px-2.5 py-1.5 ${
        toneAccentClass[tone]
      } ${className}`}
    >
      <div className="truncate text-[10px] font-semibold uppercase tracking-normal text-[var(--muted)]">
        {label}
      </div>
      <div className="mt-0.5 break-words text-[13px] font-semibold tabular-nums text-[var(--foreground)]">
        {value}
      </div>
      {detail ? (
        <div
          className={`mt-1 inline-flex border px-1.5 py-0.5 text-[10px] font-semibold ${toneClass[tone]}`}
        >
          {detail}
        </div>
      ) : null}
    </div>
  );
}

export function StatusBadge({
  children,
  tone = "neutral",
  className = "",
  title,
}: {
  children: ReactNode;
  tone?: StatusTone;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex max-w-full items-center whitespace-nowrap border px-1.5 py-0.5 text-[10px] font-semibold leading-none ${toneClass[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function RefreshIconButton({
  isRefreshing,
  label = "Refresh",
  refreshingLabel = "Refreshing",
  className = "",
  ...buttonProps
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  isRefreshing?: boolean;
  label?: string;
  refreshingLabel?: string;
}) {
  const accessibleLabel = isRefreshing ? refreshingLabel : label;

  return (
    <button
      type="button"
      title={accessibleLabel}
      aria-label={accessibleLabel}
      aria-busy={isRefreshing || undefined}
      className={`terminal-icon-action ${isRefreshing ? "is-refreshing" : ""} ${className}`}
      {...buttonProps}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      >
        <path d="M21 12a9 9 0 0 1-15.4 6.4L3 16" />
        <path d="M3 16h5v5" />
        <path d="M3 12A9 9 0 0 1 18.4 5.6L21 8" />
        <path d="M21 8h-5V3" />
      </svg>
      <span className="sr-only">{accessibleLabel}</span>
    </button>
  );
}

export function ResearchNotice({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: StatusTone;
  className?: string;
}) {
  return (
    <section
      className={`border border-l-2 border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-[11px] leading-5 ${toneAccentClass[tone]} ${className}`}
    >
      {children}
    </section>
  );
}

export function EmptyState({
  title,
  message,
  className = "",
}: {
  title: ReactNode;
  message: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`border border-[var(--border)] bg-[var(--panel)] px-3 py-8 text-center ${className}`}
    >
      <h3 className="text-sm font-semibold text-[var(--foreground)]">{title}</h3>
      <p className="mx-auto mt-1 max-w-xl text-[12px] leading-5 text-[var(--muted)]">
        {message}
      </p>
    </section>
  );
}

export function getStatusToneClass(tone: StatusTone) {
  return toneClass[tone];
}
