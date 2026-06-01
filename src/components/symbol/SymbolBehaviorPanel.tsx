"use client";

import { useState } from "react";
import {
  buildBehaviorSummary,
  formatBehaviorPercent,
  formatBehaviorSampleSize,
  formatBehaviorWinRate,
  formatRecentOutcomeDate,
  getBehaviorGroupLabel,
  getBehaviorSignalLabel,
  getBehaviorWarningLabel,
  getHiddenRecentOutcomeCount,
  hasBehaviorOutcomeStats,
  selectCompactRecentOutcomes,
  type SymbolBehavior,
  type SymbolBehaviorHorizonStats,
  type SymbolBehaviorRecentOutcome,
} from "./symbolBehaviorUi";
import {
  formatSymbolResearchAction,
  formatSymbolResearchScore,
  formatSymbolResearchSetup,
} from "./symbolResearchUi";

type SymbolBehaviorPanelProps = {
  behavior?: SymbolBehavior | null;
  className?: string;
};

const compactOutcomeLimit = 5;

export function SymbolBehaviorPanel({
  behavior,
  className = "",
}: SymbolBehaviorPanelProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section
      className={`min-w-0 border border-[var(--border)] bg-[var(--panel)] px-4 py-4 ${className}`}
    >
      <div className="mb-3">
        <h2 className="text-sm font-semibold">Historical Behavior</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Past scanner signals for this symbol and timeframe. Research only.
        </p>
      </div>

      {!behavior || !hasBehaviorOutcomeStats(behavior) ? (
        <EmptyBehaviorState />
      ) : (
        <>
          <BehaviorSummary behavior={behavior} />
          <BehaviorWarnings warnings={behavior.warnings} />
          <BehaviorHorizons horizons={behavior.horizons} />
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

function EmptyBehaviorState() {
  return (
    <div className="border border-[var(--border)] bg-[#080d12] px-3 py-3">
      <p className="text-sm font-semibold text-[var(--foreground)]">
        Not enough historical behavior data yet.
      </p>
      <p className="mt-1 text-sm text-[var(--muted)]">
        More scanner runs with forward candles are needed before this section can
        summarize past outcomes.
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

function BehaviorHorizons({
  horizons,
}: {
  horizons: SymbolBehaviorHorizonStats[];
}) {
  return (
    <div className="mt-4 grid gap-3 lg:grid-cols-3">
      {horizons.map((horizon) => (
        <article
          key={horizon.candles}
          className="border border-[var(--border)] bg-[#080d12] px-3 py-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">
                Forward return after {horizon.candles}{" "}
                {horizon.candles === 1 ? "candle" : "candles"}
              </h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {formatBehaviorSampleSize(horizon.sampleSize)} matched outcomes
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <BehaviorMetric
              label="Avg Return"
              value={formatBehaviorPercent(horizon.averageReturnPct)}
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
              label="Avg Max Upside"
              value={formatBehaviorPercent(horizon.averageMaxUpsidePct)}
            />
            <BehaviorMetric
              label="Avg Max Drawdown"
              value={formatBehaviorPercent(horizon.averageMaxDrawdownPct)}
            />
            <BehaviorMetric
              label="Best / Worst Return"
              value={`${formatBehaviorPercent(
                horizon.bestReturnPct,
              )} / ${formatBehaviorPercent(horizon.worstReturnPct)}`}
            />
          </div>
        </article>
      ))}
    </div>
  );
}

function CurrentBehaviorContext({ behavior }: { behavior: SymbolBehavior }) {
  const context = behavior.currentContext;

  if (!context) {
    return null;
  }

  return (
    <div className="mt-4 border border-[var(--border)] bg-[#080d12] px-3 py-3">
      <h3 className="text-sm font-semibold">Current setup context</h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <BehaviorFact
          label="Current Group"
          value={getBehaviorGroupLabel(context.currentResultGroup)}
        />
        <BehaviorFact
          label="Current Signal"
          value={getBehaviorSignalLabel(context.currentSignalLabel)}
        />
        <BehaviorFact
          label="Matching Group Sample"
          value={formatBehaviorSampleSize(context.matchingGroupSampleSize)}
        />
        <BehaviorFact
          label="Matching Signal Sample"
          value={formatBehaviorSampleSize(context.matchingSignalSampleSize)}
        />
      </div>
      <p className="mt-3 text-xs text-[var(--muted)]">{context.note}</p>
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
            Available data from prior scanner signals.
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
              key={`${outcome.scanTime}-${outcome.signalLabel}-${index}`}
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
          <p className="mt-1 text-xs text-[var(--muted)]">
            {formatSymbolResearchAction(outcome.actionBias)} ·{" "}
            {formatSymbolResearchSetup(outcome.primaryStructure)}
          </p>
        </div>
        <div className="text-left text-xs text-[var(--muted)] sm:text-right">
          <div>{formatRecentOutcomeDate(outcome.scanTime)}</div>
          <div>Signal candle: {formatRecentOutcomeDate(outcome.candleOpenTime)}</div>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-5">
        <BehaviorMetric
          label="Rank"
          value={formatSymbolResearchScore(outcome.rankScore)}
        />
        <BehaviorMetric
          label="Next 1"
          value={formatBehaviorPercent(outcome.forwardReturnsPct.next1)}
        />
        <BehaviorMetric
          label="Next 3"
          value={formatBehaviorPercent(outcome.forwardReturnsPct.next3)}
        />
        <BehaviorMetric
          label="Next 5"
          value={formatBehaviorPercent(outcome.forwardReturnsPct.next5)}
        />
        <BehaviorMetric
          label="Forward Data"
          value={outcome.hasEnoughForwardCandles ? "Complete" : "Partial"}
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
