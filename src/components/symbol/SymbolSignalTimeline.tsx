"use client";

import { useMemo } from "react";
import { useAppLanguage } from "@/lib/i18n/AppLanguageProvider";
import {
  formatTimelineDate,
  getCompactSignalHistory,
  normalizeSignalHistory,
  type NormalizedSymbolTimelineSignal,
  type RawSymbolTimelineSignal,
} from "./symbolTimelineUi";

type SymbolSignalTimelineProps = {
  history: RawSymbolTimelineSignal[];
  showSelectionNotice?: boolean;
  className?: string;
  variant?: "default" | "rail";
  maxItems?: number;
};

export function SymbolSignalTimeline({
  history,
  showSelectionNotice = false,
  className = "mt-4",
  variant = "default",
  maxItems = variant === "rail" ? 3 : 8,
}: SymbolSignalTimelineProps) {
  const { dictionary } = useAppLanguage();
  const items = useMemo(
    () => normalizeSignalHistory(history, dictionary),
    [history, dictionary],
  );
  const compactHistory = useMemo(
    () => getCompactSignalHistory(items, maxItems),
    [items, maxItems],
  );
  const visibleItems = compactHistory.items;
  const isRail = variant === "rail";

  return (
    <section
      className={`min-w-0 border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-panel)] ${
        isRail ? "px-2.5 py-2" : "px-3 py-3"
      } ${className}`}
    >
      <div className={isRail ? "mb-2 border-b border-[var(--border)] pb-1" : "mb-3"}>
        <h2
          className={
            isRail
              ? "text-[11px] font-semibold uppercase text-[var(--foreground)]"
              : "text-sm font-semibold"
          }
        >
          {isRail ? "Timeline" : "Signal Timeline"}
        </h2>
      </div>

      {items.length === 0 ? (
        <p className={isRail ? "text-[12px] text-[var(--muted)]" : "text-sm text-[var(--muted)]"}>
          No recent signal timeline is available for this symbol.
        </p>
      ) : (
        <>
          {items.length === 1 ? (
            <p
              className={
                isRail
                  ? "mb-2 border border-[var(--border)] bg-[var(--panel-2)] px-2 py-1.5 text-[11px] text-[var(--muted)]"
                  : "mb-3 border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-xs text-[var(--muted)]"
              }
            >
              Only the latest signal is available. More history will appear after future
              scans.
            </p>
          ) : null}

          {showSelectionNotice ? (
            <p
              className={
                isRail
                  ? "mb-2 border-l border-[var(--warning-border)] pl-2 text-[10px] leading-4 text-[var(--muted)]"
                  : "mb-3 border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-xs text-[var(--warning)]"
              }
            >
              {isRail
                ? "Newer secondary rows exist."
                : "Some newer history rows may come from non-preferred or smaller runs. Current classification uses the selected full-universe scan run."}
            </p>
          ) : null}

          {isRail ? (
            <ul className="space-y-1 text-[11px]">
              {visibleItems.map((item) => (
                <li
                  key={item.key}
                  className={`border bg-[var(--panel-data)] px-2 py-1.5 ${getGroupClassName(
                    item.group,
                  )} ${getRowClassName(item)}`}
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="shrink-0 text-[10px] font-semibold uppercase">
                      {item.groupLabel}
                    </span>
                    <span className="font-mono text-[11px] font-semibold">
                      {item.rankScore}
                    </span>
                    {item.timelineTone !== "default" ? (
                      <span className="ml-auto shrink-0 text-[9px] font-semibold uppercase text-[var(--muted)]">
                        {item.timelineTone === "selected" ? "Current" : "Alt"}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 truncate font-semibold text-[var(--foreground)]">
                    {item.signalLabel}
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[10px] text-[var(--muted)]">
                    {formatTimelineDate(item.scanTime)}
                  </div>
                  <div className="mt-0.5 truncate text-[10px] text-[var(--muted)]">
                    {getRailRunContextText(item)}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="overflow-x-auto bg-[var(--panel-data)]">
              <table className="w-full min-w-[760px] border-collapse text-left text-xs">
                <thead className="bg-[var(--table-header)] text-[10px] uppercase text-[var(--muted)]">
                  <tr>
                    <th className="border-b border-[var(--border-medium)] px-2 py-1.5">
                      Time
                    </th>
                    <th className="border-b border-[var(--border-medium)] px-2 py-1.5">
                      State
                    </th>
                    <th className="border-b border-[var(--border-medium)] px-2 py-1.5">
                      Signal
                    </th>
                    <th className="border-b border-[var(--border-medium)] px-2 py-1.5 text-right">
                      Rank
                    </th>
                    <th className="border-b border-[var(--border-medium)] px-2 py-1.5">
                      Run Context
                    </th>
                    <th className="border-b border-[var(--border-medium)] px-2 py-1.5">
                      Marker
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.map((item) => (
                    <tr
                      key={item.key}
                      className={`border-t border-[var(--border)] odd:bg-[var(--panel-data)] even:bg-[var(--panel-muted)] hover:bg-[var(--row-hover)] ${getRowClassName(
                        item,
                      )}`}
                    >
                      <td className="whitespace-nowrap px-2 py-2 font-mono text-[11px] text-[var(--muted)]">
                        {formatTimelineDate(item.scanTime)}
                      </td>
                      <td className="px-2 py-2">
                        <span
                          className={`border px-2 py-0.5 text-[10px] font-semibold uppercase ${getGroupClassName(item.group)}`}
                        >
                          {item.groupLabel}
                        </span>
                      </td>
                      <td className="max-w-[220px] truncate px-2 py-2 font-semibold text-[var(--foreground)]">
                        {item.signalLabel}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-[var(--foreground)]">
                        {item.rankScore}
                      </td>
                      <td className="max-w-[220px] truncate px-2 py-2 text-[var(--muted)]">
                        {item.runContextText}
                      </td>
                      <td className="px-2 py-2">
                        {item.timelineTone !== "default" ? (
                          <span className="border border-[var(--border)] px-2 py-0.5 text-[10px] uppercase text-[var(--muted)]">
                            {item.timelineTone === "selected"
                              ? "Selected current"
                              : "Secondary run"}
                          </span>
                        ) : (
                          <span className="text-[11px] text-[var(--muted-2)]">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </>
      )}
    </section>
  );
}

function getRowClassName(item: NormalizedSymbolTimelineSignal) {
  if (item.timelineTone === "selected") {
    return "shadow-[inset_2px_0_0_var(--info)]";
  }

  if (item.timelineTone === "secondary") {
    return "opacity-85";
  }

  return "";
}

function getGroupClassName(group: string) {
  switch (group) {
    case "eligible":
      return "border-[var(--eligible-border)] bg-[var(--eligible-bg)] text-[var(--eligible)]";
    case "watch":
      return "border-[var(--watch-border)] bg-[var(--watch-bg)] text-[var(--watch)]";
    case "overheated":
      return "border-[var(--overheated-border)] bg-[var(--overheated-bg)] text-[var(--overheated)]";
    case "risk":
      return "border-[var(--risk-border)] bg-[var(--risk-bg)] text-[var(--risk)]";
    case "insufficient_history":
      return "border-[var(--missing-border)] bg-[var(--missing-bg)] text-[var(--missing)]";
    default:
      return "border-[var(--neutral-border)] bg-[var(--neutral-bg)] text-[var(--neutral)]";
  }
}

function getRailRunContextText(item: NormalizedSymbolTimelineSignal) {
  if (item.timelineTone === "selected") {
    return "Current run";
  }

  if (item.timelineTone === "secondary") {
    return "Secondary row";
  }

  if (item.runContextText.includes("Full-universe")) {
    return "Full run";
  }

  return item.runContextText;
}
