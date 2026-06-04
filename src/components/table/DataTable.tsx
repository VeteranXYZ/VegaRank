import type { ReactNode } from "react";
import {
  type DataSortDirection,
  type DataSortState,
} from "./dataTableSorting";

type CellAlign = "left" | "center" | "right";
export type ChipTone =
  | "neutral"
  | "accent"
  | "positive"
  | "info"
  | "warning"
  | "danger"
  | "eligible"
  | "watch"
  | "risk"
  | "overheated"
  | "complete"
  | "partial"
  | "missing";

const alignClass: Record<CellAlign, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

const chipToneClass: Record<ChipTone, string> = {
  neutral:
    "border-[var(--neutral-border)] bg-[var(--neutral-bg)] text-[var(--neutral)]",
  accent: "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]",
  positive:
    "border-[var(--positive-border)] bg-[var(--positive-bg)] text-[var(--positive)]",
  info: "border-[var(--info-border)] bg-[var(--info-bg)] text-[var(--info)]",
  warning:
    "border-[var(--warning-border)] bg-[var(--warning-bg)] text-[var(--warning)]",
  danger: "border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger)]",
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

export function DataTableScroll({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`max-w-full overflow-x-auto overflow-y-hidden bg-[var(--panel-data)] [contain:layout_paint] [scrollbar-gutter:stable] ${className}`}
    >
      {children}
    </div>
  );
}

export function DataTable({
  children,
  minWidth,
  className = "",
}: {
  children: ReactNode;
  minWidth: string;
  className?: string;
}) {
  return (
    <table
      className={`w-full border-collapse text-left text-xs ${minWidth} ${className}`}
    >
      {children}
    </table>
  );
}

export function DataTableHeaderCell<TKey extends string>({
  children,
  sortKey,
  sortState,
  defaultDirection = "asc",
  onSortChange,
  align = "left",
  className = "",
  colSpan,
  rowSpan,
}: {
  children: ReactNode;
  sortKey?: TKey;
  sortState?: DataSortState<TKey> | null;
  defaultDirection?: DataSortDirection;
  onSortChange?: (key: TKey, defaultDirection: DataSortDirection) => void;
  align?: CellAlign;
  className?: string;
  colSpan?: number;
  rowSpan?: number;
}) {
  const isSortable = Boolean(sortKey && onSortChange);
  const isActive = Boolean(sortKey && sortState?.key === sortKey);
  const ariaSort = isActive
    ? sortState?.direction === "asc"
      ? "ascending"
      : "descending"
    : undefined;

  return (
    <th
      colSpan={colSpan}
      rowSpan={rowSpan}
      aria-sort={ariaSort}
      className={`h-7 border-b border-[var(--border-medium)] bg-[var(--table-header)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-normal text-[var(--muted)] ${alignClass[align]} ${className}`}
    >
      {isSortable && sortKey ? (
        <button
          type="button"
          onClick={() => onSortChange?.(sortKey, defaultDirection)}
          data-sort-key={sortKey}
          aria-pressed={isActive}
          className={`inline-flex h-6 w-full items-center gap-1 rounded-[3px] border px-1 py-0.5 text-[10px] font-semibold uppercase leading-[1.05] transition ${
            align === "right"
              ? "justify-end"
              : align === "center"
                ? "justify-center"
                : "justify-start"
          } ${
            isActive
              ? "border-[var(--accent-border)] bg-transparent text-[var(--accent)]"
              : "border-transparent bg-transparent text-[var(--muted)] hover:border-[var(--accent-border)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
          }`}
        >
          <span className="min-w-0 truncate text-inherit">
            {children}
          </span>
          {isActive && sortState ? (
            <span
              aria-hidden="true"
              className="min-w-3 text-right text-[10px] font-bold text-[var(--accent)]"
            >
              {sortState.direction === "asc" ? "\u2191" : "\u2193"}
            </span>
          ) : null}
        </button>
      ) : (
        children
      )}
    </th>
  );
}

export function DataTableCell({
  children,
  align = "left",
  className = "",
  truncate = false,
  title,
}: {
  children: ReactNode;
  align?: CellAlign;
  className?: string;
  truncate?: boolean;
  title?: string;
}) {
  return (
    <td
      className={`h-[var(--table-row-height)] max-w-0 px-1.5 py-0.5 align-middle text-[11px] leading-[15px] text-[var(--muted)] ${alignClass[align]} ${className}`}
    >
      {truncate ? (
        <div className="truncate" title={title}>
          {children}
        </div>
      ) : (
        children
      )}
    </td>
  );
}

export function DataTableChip({
  children,
  tone = "neutral",
  className = "",
  title,
}: {
  children: ReactNode;
  tone?: ChipTone;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex min-h-[18px] max-w-full items-center overflow-hidden whitespace-nowrap rounded-[4px] border px-1.5 py-0 text-[10px] font-semibold leading-4 ${chipToneClass[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
