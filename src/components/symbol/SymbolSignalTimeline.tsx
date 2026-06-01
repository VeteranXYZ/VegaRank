"use client";

import { useMemo, useState } from "react";
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
};

export function SymbolSignalTimeline({
  history,
  showSelectionNotice = false,
}: SymbolSignalTimelineProps) {
  const [showAll, setShowAll] = useState(false);
  const items = useMemo(() => normalizeSignalHistory(history), [history]);
  const compactHistory = useMemo(() => getCompactSignalHistory(items), [items]);
  const visibleItems = showAll ? items : compactHistory.items;
  const canToggle = compactHistory.hiddenCount > 0;

  return (
    <section className="mt-4 min-w-0 border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold">Signal History</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Recent scanner classifications for this symbol.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          No recent signal history is available for this symbol.
        </p>
      ) : (
        <>
          {items.length === 1 ? (
            <p className="mb-3 border border-[var(--border)] bg-[#080d12] px-3 py-2 text-xs text-[var(--muted)]">
              Only the latest signal is available. More history will appear after future
              scans.
            </p>
          ) : null}

          {showSelectionNotice ? (
            <p className="mb-3 border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              Some newer history rows may come from non-preferred or smaller runs.
              Current classification uses the selected full-universe scan run.
            </p>
          ) : null}

          <ol className="relative space-y-3 border-l border-[var(--border)] pl-3 sm:pl-4">
            {visibleItems.map((item) => (
              <li key={item.key} className="relative">
                <span
                  className={`absolute -left-[21px] top-4 h-2.5 w-2.5 border ${getDotClassName(item)}`}
                />
                <article className={`min-w-0 border px-3 py-3 ${getArticleClassName(item)}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`border px-2 py-0.5 text-[10px] font-semibold uppercase ${getGroupClassName(item.group)}`}
                        >
                          {item.groupLabel}
                        </span>
                        <span className="text-sm font-semibold text-[var(--foreground)]">
                          {item.signalLabel}
                        </span>
                        {item.timelineTone !== "default" ? (
                          <span className="border border-[var(--border)] px-2 py-0.5 text-[10px] uppercase text-[var(--muted)]">
                            {item.timelineTone === "selected"
                              ? "Selected current"
                              : "Secondary run"}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {item.groupDescription}
                      </p>
                    </div>
                    <div className="text-left text-xs text-[var(--muted)] sm:text-right">
                      <div>{formatTimelineDate(item.scanTime)}</div>
                      <div>Signal candle: {formatTimelineDate(item.candleOpenTime)}</div>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                    <TimelineFact label="Action" value={item.actionText} />
                    <TimelineFact label="Setup" value={item.setupText} />
                    <TimelineFact label="Rank" value={item.rankScore} />
                    <TimelineFact label="Opportunity" value={item.opportunityScore} />
                    <TimelineFact label="Confirmation" value={item.confirmationScore} />
                    <TimelineFact label="Risk" value={item.riskScore} />
                    <TimelineFact label="Run Context" value={item.runContextText} />
                    <TimelineFact label="Risks Noted" value={item.riskText} wide />
                    <TimelineFact label="Status" value={item.statusText} wide />
                  </div>
                </article>
              </li>
            ))}
          </ol>

          {canToggle ? (
            <button
              type="button"
              aria-expanded={showAll}
              onClick={() => setShowAll((value) => !value)}
              className="mt-3 border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--foreground)] hover:border-[var(--info)]"
            >
              {showAll
                ? "Show less history"
                : `Show more history (${compactHistory.hiddenCount} hidden)`}
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}

function getArticleClassName(item: NormalizedSymbolTimelineSignal) {
  if (item.timelineTone === "selected") {
    return "border-[var(--info)] bg-[#07131a]";
  }

  if (item.timelineTone === "secondary") {
    return "border-dashed border-[var(--border)] bg-[#070b10] opacity-85";
  }

  return "border-[var(--border)] bg-[#080d12]";
}

function getDotClassName(item: NormalizedSymbolTimelineSignal) {
  if (item.timelineTone === "selected") {
    return "border-[var(--info)] bg-[var(--info)]";
  }

  if (item.timelineTone === "secondary") {
    return "border-[var(--border)] bg-[#070b10]";
  }

  return "border-[var(--border)] bg-[var(--panel)]";
}

function TimelineFact({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <div className="text-[10px] uppercase text-[var(--muted-2)]">{label}</div>
      <div className="mt-1 break-words text-[var(--foreground)]">{value}</div>
    </div>
  );
}

function getGroupClassName(group: string) {
  switch (group) {
    case "eligible":
      return "border-emerald-500/35 bg-emerald-500/10 text-emerald-200";
    case "watch":
      return "border-sky-500/35 bg-sky-500/10 text-sky-200";
    case "overheated":
      return "border-amber-500/35 bg-amber-500/10 text-amber-200";
    case "risk":
      return "border-rose-500/35 bg-rose-500/10 text-rose-200";
    case "insufficient_history":
      return "border-zinc-500/35 bg-zinc-500/10 text-zinc-200";
    default:
      return "border-slate-500/35 bg-slate-500/10 text-slate-200";
  }
}
