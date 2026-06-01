"use client";

import { useState } from "react";
import {
  buildBehaviorSummary,
  formatBehaviorPercent,
  formatBehaviorSampleSize,
  formatBehaviorWinRate,
  formatRecentOutcomeDate,
  getBehaviorGroupLabel,
  getBehaviorHorizonRows,
  getBehaviorSetupLabel,
  getBehaviorSignalLabel,
  getBehaviorUnavailableMessage,
  getBehaviorWarningLabel,
  getHiddenRecentOutcomeCount,
  hasBehaviorOutcomeStats,
  selectCompactRecentOutcomes,
  type SymbolBehavior,
  type SymbolBehaviorDiagnostics,
  type SymbolBehaviorHorizonRow,
  type SymbolBehaviorRecentOutcome,
} from "./symbolBehaviorUi";
import { formatSymbolResearchScore } from "./symbolResearchUi";

type SymbolBehaviorPanelProps = {
  behavior?: SymbolBehavior | null;
  diagnostics?: SymbolBehaviorDiagnostics | null;
  className?: string;
};

const compactOutcomeLimit = 5;

export function SymbolBehaviorPanel({
  behavior,
  diagnostics,
  className = "",
}: SymbolBehaviorPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const isAvailable = diagnostics?.available === true && hasBehaviorOutcomeStats(behavior);

  return (
    <section
      className={`min-w-0 border border-[var(--border)] bg-[var(--panel)] px-4 py-4 ${className}`}
    >
      <div className="mb-3">
        <h2 className="text-sm font-semibold">Historical Behavior</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Historical observations for prior scanner classifications. Research only,
          not a prediction.
        </p>
      </div>

      {!isAvailable || !behavior ? (
        <EmptyBehaviorState diagnostics={diagnostics} />
      ) : (
        <>
          <BehaviorSummary behavior={behavior} />
          <BehaviorWarnings warnings={behavior.warnings} />
          <BehaviorHorizons horizons={getBehaviorHorizonRows(behavior)} />
          <CurrentBehaviorContext behavior={behavior} />
          <RecentBehaviorOutcomes
            outcomes={behavior.recentOutcomes}
            expanded={expanded}
            onToggle={() => setExpanded((value) => !value)}
          />
        </>
      )}
    </section>
  );
}

function EmptyBehaviorState({
  diagnostics,
}: {
  diagnostics?: SymbolBehaviorDiagnostics | null;
}) {
  return (
    <div className="border border-[var(--border)] bg-[#080d12] px-3 py-3">
      <p className="text-sm font-semibold text-[var(--foreground)]">
        Historical behavior is not available for this symbol/timeframe yet.
      </p>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {getBehaviorUnavailableMessage(diagnostics)}
      </p>
    </div>
  );
}

function BehaviorSummary({ behavior }: { behavior: SymbolBehavior }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {buildBehaviorSummary(behavior).map((item) => (
        <BehaviorFact key={item.label} label={item.label} value={item.value} />
      ))}
    </div>
  );
}

function BehaviorWarnings({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 grid gap-2">
      {warnings.map((warning) => (
        <p
          key={warning}
          className="border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100"
        >
          {getBehaviorWarningLabel(warning)}
        </p>
      ))}
    </div>
  );
}

function BehaviorHorizons({ horizons }: { horizons: SymbolBehaviorHorizonRow[] }) {
  return (
    <div className="mt-4 grid gap-3 lg:grid-cols-3">
      {horizons.map((horizon) => (
        <article
          key={horizon.horizon}
          className="border border-[var(--border)] bg-[#080d12] px-3 py-3"
        >
          <h3 className="text-sm font-semibold">
            Forward return after {horizon.label}
          </h3>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {formatBehaviorSampleSize(horizon.sampleSize)} matched observations
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <BehaviorMetric
              label="Avg Return"
              value={formatBehaviorPercent(horizon.avgReturnPct)}
            />
            <BehaviorMetric
              label="Median Return"
              value={formatBehaviorPercent(horizon.medianReturnPct)}
            />
            <BehaviorMetric
              label="Win Rate"
              value={formatBehaviorWinRate(horizon.winRatePct)}
            />
            <BehaviorMetric
              label="Best Return"
              value={formatBehaviorPercent(horizon.bestReturnPct)}
            />
            <BehaviorMetric
              label="Worst Return"
              value={formatBehaviorPercent(horizon.worstReturnPct)}
            />
          </div>
        </article>
      ))}
    </div>
  );
}

function CurrentBehaviorContext({ behavior }: { behavior: SymbolBehavior }) {
  const context = behavior.currentContext;

  return (
    <div className="mt-4 border border-[var(--border)] bg-[#080d12] px-3 py-3">
      <h3 className="text-sm font-semibold">Current context</h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <BehaviorFact
          label="Current Group"
          value={getBehaviorGroupLabel(context.resultGroup)}
        />
        <BehaviorFact
          label="Current Signal"
          value={getBehaviorSignalLabel(context.signalLabel)}
        />
        <BehaviorFact
          label="Primary Structure"
          value={getBehaviorSetupLabel(context.primaryStructure)}
        />
        <BehaviorFact label="Timeframe" value={context.timeframe || "Unknown"} />
      </div>
    </div>
  );
}

function RecentBehaviorOutcomes({
  outcomes,
  expanded,
  onToggle,
}: {
  outcomes: SymbolBehaviorRecentOutcome[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const visibleOutcomes = selectCompactRecentOutcomes(
    outcomes,
    expanded,
    compactOutcomeLimit,
  );
  const hiddenCount = getHiddenRecentOutcomeCount({
    outcomes,
    expanded,
    compactLimit: compactOutcomeLimit,
  });
  const canToggle = outcomes.length > compactOutcomeLimit;

  return (
    <div className="mt-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Recent outcomes</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Prior scanner observations with available forward candles.
          </p>
        </div>
        <span className="text-xs text-[var(--muted)]">
          {formatBehaviorSampleSize(outcomes.length)} rows
        </span>
      </div>

      {visibleOutcomes.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          No recent outcomes are available yet.
        </p>
      ) : (
        <div className="grid gap-2">
          {visibleOutcomes.map((outcome, index) => (
            <RecentOutcomeCard
              key={`${outcome.scanTime}-${outcome.signalLabel ?? "unknown"}-${index}`}
              outcome={outcome}
            />
          ))}
        </div>
      )}

      {canToggle ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={onToggle}
          className="mt-3 border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--foreground)] hover:border-[var(--info)]"
        >
          {expanded
            ? "Show less outcomes"
            : `Show more outcomes (${hiddenCount} hidden)`}
        </button>
      ) : null}
    </div>
  );
}

function RecentOutcomeCard({
  outcome,
}: {
  outcome: SymbolBehaviorRecentOutcome;
}) {
  return (
    <article className="border border-[var(--border)] bg-[#080d12] px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="border border-[var(--border)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--muted)]">
              {getBehaviorGroupLabel(outcome.resultGroup)}
            </span>
            <span className="text-sm font-semibold text-[var(--foreground)]">
              {getBehaviorSignalLabel(outcome.signalLabel)}
            </span>
          </div>
        </div>
        <div className="text-left text-xs text-[var(--muted)] sm:text-right">
          {formatRecentOutcomeDate(outcome.scanTime)}
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-5">
        <BehaviorMetric
          label="Rank"
          value={formatSymbolResearchScore(outcome.rankScore)}
        />
        <BehaviorMetric
          label="Price"
          value={formatSymbolResearchScore(outcome.priceAtSignal, 4)}
        />
        <BehaviorMetric
          label="Next 1"
          value={formatBehaviorPercent(outcome.forwardReturnPct["1"])}
        />
        <BehaviorMetric
          label="Next 3"
          value={formatBehaviorPercent(outcome.forwardReturnPct["3"])}
        />
        <BehaviorMetric
          label="Next 5"
          value={formatBehaviorPercent(outcome.forwardReturnPct["5"])}
        />
      </div>
    </article>
  );
}

function BehaviorFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border border-[var(--border)] bg-[#080d12] px-3 py-2">
      <div className="text-[10px] uppercase text-[var(--muted-2)]">{label}</div>
      <div className="mt-1 break-words text-sm text-[var(--foreground)]">
        {value}
      </div>
    </div>
  );
}

function BehaviorMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase text-[var(--muted-2)]">{label}</div>
      <div className="mt-1 break-words font-mono text-[var(--foreground)]">
        {value}
      </div>
    </div>
  );
}
