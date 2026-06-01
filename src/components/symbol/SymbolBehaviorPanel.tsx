"use client";

import { useState } from "react";
import {
  buildBehaviorSampleQuality,
  buildBehaviorReadout,
  buildBehaviorSummary,
  formatBehaviorPercent,
  formatBehaviorSampleSize,
  formatBehaviorWinRate,
  formatRecentOutcomeDate,
  getBehaviorDiagnosticsTitle,
  getBehaviorGroupLabel,
  getBehaviorHorizonRows,
  getBehaviorSampleHint,
  getBehaviorSampleSize,
  getBehaviorSetupLabel,
  getBehaviorSignalLabel,
  getBehaviorUnavailableMessage,
  getBehaviorWarningLabel,
  getHiddenRecentOutcomeCount,
  getRecentOutcomeReturn,
  selectCompactRecentOutcomes,
  type BehaviorSampleQualityReadout,
  type BehaviorReadout,
  type SymbolBehavior,
  type SymbolBehaviorCoverage,
  type SymbolBehaviorDiagnostics,
  type SymbolBehaviorHorizonRow,
  type SymbolBehaviorRecentOutcome,
  type SymbolBehaviorRunContext,
} from "./symbolBehaviorUi";
import { formatSymbolResearchScore } from "./symbolResearchUi";

type SymbolBehaviorPanelProps = {
  behavior?: SymbolBehavior | null;
  diagnostics?: SymbolBehaviorDiagnostics | null;
  coverage?: SymbolBehaviorCoverage | null;
  signalHistory?: SymbolBehaviorRunContext[] | null;
  className?: string;
};

const compactOutcomeLimit = 10;

export function SymbolBehaviorPanel({
  behavior,
  diagnostics,
  coverage,
  signalHistory,
  className = "",
}: SymbolBehaviorPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const isAvailable = diagnostics?.available === true && Boolean(behavior);
  const sampleQuality =
    isAvailable && behavior
      ? buildBehaviorSampleQuality({ behavior, signalHistory })
      : null;

  return (
    <section
      className={`min-w-0 border border-[var(--border)] bg-[var(--panel)] px-4 py-4 ${className}`}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Historical Behavior</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            How similar prior signals behaved after this setup appeared. Same
            symbol/timeframe scanner history only; research context, not financial
            advice.
          </p>
        </div>
        {isAvailable && behavior ? (
          <SampleBadge behavior={behavior} />
        ) : null}
      </div>

      {!isAvailable || !behavior ? (
        <EmptyBehaviorState diagnostics={diagnostics} coverage={coverage} />
      ) : (
        <>
          <BehaviorReadoutCard
            behavior={behavior}
            sampleQuality={sampleQuality}
          />
          <SampleQualityNotice quality={sampleQuality} />
          <BehaviorSummary behavior={behavior} />
          <SampleHint behavior={behavior} />
          <BehaviorWarnings
            warnings={Array.isArray(behavior.warnings) ? behavior.warnings : []}
          />
          <CurrentBehaviorContext behavior={behavior} />
          <BehaviorHorizons horizons={getBehaviorHorizonRows(behavior)} />
          <RecentBehaviorOutcomes
            outcomes={behavior.recentOutcomes ?? []}
            hasClusteredRuns={sampleQuality?.hasClusteredRuns === true}
            expanded={expanded}
            onToggle={() => setExpanded((value) => !value)}
          />
        </>
      )}
    </section>
  );
}

function SampleBadge({ behavior }: { behavior: SymbolBehavior }) {
  const sampleSize = getBehaviorSampleSize(behavior);

  return (
    <div className="border border-[var(--border)] bg-[#080d12] px-3 py-2 text-xs">
      <div className="text-[10px] uppercase text-[var(--muted-2)]">Sample size</div>
      <div className="mt-1 font-semibold text-[var(--foreground)]">
        {formatBehaviorSampleSize(sampleSize)} prior observations
      </div>
    </div>
  );
}

function EmptyBehaviorState({
  diagnostics,
  coverage,
}: {
  diagnostics?: SymbolBehaviorDiagnostics | null;
  coverage?: SymbolBehaviorCoverage | null;
}) {
  return (
    <div className="border border-[var(--border)] bg-[#080d12] px-3 py-3">
      <p className="text-sm font-semibold text-[var(--foreground)]">
        {getBehaviorDiagnosticsTitle(diagnostics)}
      </p>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {getBehaviorUnavailableMessage({ diagnostics, coverage })}
      </p>
    </div>
  );
}

function BehaviorReadoutCard({
  behavior,
  sampleQuality,
}: {
  behavior: SymbolBehavior;
  sampleQuality?: BehaviorSampleQualityReadout | null;
}) {
  const readout = buildBehaviorReadout({
    resultGroup: behavior.currentContext?.resultGroup,
    signalLabel: behavior.currentContext?.signalLabel,
    sampleSize: behavior.sampleSize,
    horizons: behavior.horizons,
    warnings: Array.isArray(behavior.warnings) ? behavior.warnings : [],
  });
  const toneClass = getBehaviorReadoutToneClass(readout);
  const caveats = uniquePanelCaveats([
    ...readout.caveats,
    ...(sampleQuality?.caveats ?? []),
  ]);

  return (
    <div className={`mb-3 border px-3 py-3 ${toneClass}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-normal text-[var(--muted-2)]">
            Behavior Readout
          </div>
          <h3 className="mt-1 text-sm font-semibold text-[var(--foreground)]">
            {readout.label}
          </h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-[var(--muted)]">
            {readout.summaryText}
          </p>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <BehaviorFact
          label="Sample Confidence"
          value={readout.sampleConfidenceLabel}
        />
        <BehaviorFact label="Selected Horizon" value={readout.selectedHorizonLabel} />
        <BehaviorFact
          label="Horizon Agreement"
          value={readout.horizonAgreementLabel}
        />
        <BehaviorFact label="Historical Bias" value={readout.historicalBiasLabel} />
      </div>
      {caveats.length > 0 ? (
        <div className="mt-3 space-y-1 text-xs text-[var(--muted)]">
          {caveats.map((caveat) => (
            <p key={caveat}>{caveat}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SampleQualityNotice({
  quality,
}: {
  quality?: BehaviorSampleQualityReadout | null;
}) {
  if (!quality) {
    return null;
  }

  const className =
    quality.sampleQualityTone === "warning"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
      : quality.sampleQualityTone === "notice"
        ? "border-sky-500/25 bg-sky-500/10 text-sky-100"
        : "border-[var(--border)] bg-[#080d12] text-[var(--muted)]";

  return (
    <div className={`mb-3 border px-3 py-2 text-xs ${className}`}>
      <div className="text-[10px] uppercase tracking-normal text-[var(--muted-2)]">
        Sample Quality
      </div>
      <p className="mt-1">
        <span className="font-semibold text-[var(--foreground)]">
          {quality.sampleQualityLabel}
        </span>{" "}
        - {quality.hygieneSummary}
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

function getBehaviorReadoutToneClass(readout: BehaviorReadout) {
  switch (readout.tone) {
    case "constructive":
      return "border-emerald-500/30 bg-emerald-500/10";
    case "weak":
      return "border-amber-500/30 bg-amber-500/10";
    case "risk":
      return "border-rose-500/35 bg-rose-500/10";
    case "mixed":
      return "border-sky-500/25 bg-sky-500/10";
    case "insufficient":
      return "border-[var(--border)] bg-[#080d12]";
  }
}

function SampleHint({ behavior }: { behavior: SymbolBehavior }) {
  const hint = getBehaviorSampleHint(behavior);
  const className =
    hint.tone === "stronger"
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-100"
      : hint.tone === "limited"
        ? "border-sky-500/25 bg-sky-500/10 text-sky-100"
        : "border-amber-500/30 bg-amber-500/10 text-amber-100";

  return (
    <p className={`mt-3 border px-3 py-2 text-xs ${className}`}>
      <span className="font-semibold">{hint.label}</span> — {hint.detail}
    </p>
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

function CurrentBehaviorContext({ behavior }: { behavior: SymbolBehavior }) {
  const context = behavior.currentContext;

  if (!context) {
    return null;
  }

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

function BehaviorHorizons({ horizons }: { horizons: SymbolBehaviorHorizonRow[] }) {
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold">Forward horizon observations</h3>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Forward return compares the signal price to the close after each completed
        horizon.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-xs">
          <thead className="bg-[#090f15] text-[10px] uppercase text-[var(--muted)]">
            <tr>
              <th className="px-2 py-1.5">Horizon</th>
              <th className="px-2 py-1.5 text-right">Observations</th>
              <th className="px-2 py-1.5 text-right">Avg Return</th>
              <th className="px-2 py-1.5 text-right">Median Return</th>
              <th className="px-2 py-1.5 text-right">Positive Rate</th>
              <th className="px-2 py-1.5 text-right">Best</th>
              <th className="px-2 py-1.5 text-right">Worst</th>
            </tr>
          </thead>
          <tbody>
            {horizons.map((horizon) => (
              <tr key={horizon.horizon} className="border-t border-[var(--border)]">
                <td className="px-2 py-2 font-semibold text-[var(--foreground)]">
                  {horizon.label}
                </td>
                <td className="px-2 py-2 text-right">
                  {formatBehaviorSampleSize(horizon.sampleSize)}
                </td>
                <PercentCell value={horizon.avgReturnPct} />
                <PercentCell value={horizon.medianReturnPct} />
                <td className="px-2 py-2 text-right font-mono">
                  {formatBehaviorWinRate(horizon.winRatePct)}
                </td>
                <PercentCell value={horizon.bestReturnPct} />
                <PercentCell value={horizon.worstReturnPct} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RecentBehaviorOutcomes({
  outcomes,
  hasClusteredRuns,
  expanded,
  onToggle,
}: {
  outcomes: SymbolBehaviorRecentOutcome[];
  hasClusteredRuns?: boolean;
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
            Most recent prior observations with available forward returns.
          </p>
        </div>
        <span className="text-xs text-[var(--muted)]">
          Showing {formatBehaviorSampleSize(visibleOutcomes.length)} of{" "}
          {formatBehaviorSampleSize(outcomes.length)} recent observations
        </span>
      </div>

      {hasClusteredRuns ? (
        <p className="mb-3 border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          Several recent observations are close together in time; treat short-term
          behavior samples cautiously.
        </p>
      ) : null}

      {visibleOutcomes.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          No recent outcomes are available yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-xs">
            <thead className="bg-[#090f15] text-[10px] uppercase text-[var(--muted)]">
              <tr>
                <th className="px-2 py-1.5">Scan Time</th>
                <th className="px-2 py-1.5">Group</th>
                <th className="px-2 py-1.5">Signal</th>
                <th className="px-2 py-1.5 text-right">Rank</th>
                <th className="px-2 py-1.5 text-right">Next 1</th>
                <th className="px-2 py-1.5 text-right">Next 3</th>
                <th className="px-2 py-1.5 text-right">Next 5</th>
              </tr>
            </thead>
            <tbody>
              {visibleOutcomes.map((outcome, index) => (
                <tr
                  key={`${outcome.scanTime ?? "unknown"}-${outcome.signalLabel ?? "unknown"}-${index}`}
                  className="border-t border-[var(--border)]"
                >
                  <td className="px-2 py-2">
                    {formatRecentOutcomeDate(outcome.scanTime)}
                  </td>
                  <td className="px-2 py-2">
                    {getBehaviorGroupLabel(outcome.resultGroup)}
                  </td>
                  <td className="px-2 py-2">
                    {getBehaviorSignalLabel(outcome.signalLabel)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono">
                    {formatSymbolResearchScore(toScoreValue(outcome.rankScore))}
                  </td>
                  <PercentCell value={getRecentOutcomeReturn(outcome, "1")} />
                  <PercentCell value={getRecentOutcomeReturn(outcome, "3")} />
                  <PercentCell value={getRecentOutcomeReturn(outcome, "5")} />
                </tr>
              ))}
            </tbody>
          </table>
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
            ? "Show fewer observations"
            : `Show all observations (${hiddenCount} hidden)`}
        </button>
      ) : null}
    </div>
  );
}

function PercentCell({ value }: { value: unknown }) {
  const formatted = formatBehaviorPercent(value);
  const numeric = typeof value === "string" ? Number(value) : Number(value);
  const tone =
    Number.isFinite(numeric) && numeric > 0
      ? "text-emerald-100"
      : Number.isFinite(numeric) && numeric < 0
        ? "text-rose-100"
        : "text-[var(--foreground)]";

  return (
    <td className={`px-2 py-2 text-right font-mono ${tone}`}>{formatted}</td>
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

function toScoreValue(value: unknown) {
  const number = typeof value === "string" ? Number(value.trim()) : Number(value);

  return Number.isFinite(number) ? number : null;
}

function uniquePanelCaveats(values: string[]) {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    const key = value.trim().toLowerCase();

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(value);
  }

  return unique;
}
