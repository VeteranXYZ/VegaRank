"use client";

import { useState } from "react";
import { useAppLanguage } from "@/lib/i18n/AppLanguageProvider";
import {
  buildBehaviorSampleQuality,
  buildBehaviorReadout,
  buildBehaviorSummary,
  buildHistoricalFollowThroughEvaluation,
  formatBehaviorPercent,
  formatBehaviorSampleSize,
  formatBehaviorWinRate,
  formatRecentOutcomeDate,
  getBehaviorDiagnosticsTitle,
  getBehaviorGroupLabel,
  getBehaviorHorizonRows,
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
  type BehaviorDisplayDictionary,
  type HistoricalFollowThroughEvaluation,
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
  const { dictionary } = useAppLanguage();
  const [expanded, setExpanded] = useState(false);
  const isAvailable = diagnostics?.available === true && Boolean(behavior);
  const sampleQuality =
    isAvailable && behavior
      ? buildBehaviorSampleQuality({ behavior, signalHistory })
      : null;
  const followThroughEvaluation = buildHistoricalFollowThroughEvaluation({
    behavior,
    diagnostics,
    sampleQuality,
  });

  return (
    <section
      className={`min-w-0 border border-[var(--border)] bg-[var(--panel)] px-3 py-3 shadow-[var(--shadow-panel)] ${className}`}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Historical Behavior</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            How similar prior ranking results behaved for this symbol and timeframe only.
          </p>
        </div>
        {isAvailable && behavior ? (
          <SampleBadge behavior={behavior} />
        ) : null}
      </div>

      {!isAvailable || !behavior ? (
        <>
          <EmptyBehaviorState diagnostics={diagnostics} coverage={coverage} />
          <HistoricalFollowThroughEvaluationCard
            evaluation={followThroughEvaluation}
          />
        </>
      ) : (
        <>
          <BehaviorReadoutCard
            behavior={behavior}
            sampleQuality={sampleQuality}
          />
          <SampleQualityNotice quality={sampleQuality} />
          <HistoricalFollowThroughEvaluationCard
            evaluation={followThroughEvaluation}
          />
          <BehaviorSummary behavior={behavior} />
          <BehaviorWarnings
            warnings={getDisplayBehaviorWarnings(behavior.warnings)}
          />
          <CurrentBehaviorContext behavior={behavior} dictionary={dictionary} />
          <BehaviorHorizons horizons={getBehaviorHorizonRows(behavior)} />
          <RecentBehaviorOutcomes
            outcomes={behavior.recentOutcomes ?? []}
            hasClusteredRuns={sampleQuality?.hasClusteredRuns === true}
            expanded={expanded}
            onToggle={() => setExpanded((value) => !value)}
            dictionary={dictionary}
          />
        </>
      )}
    </section>
  );
}

function SampleBadge({ behavior }: { behavior: SymbolBehavior }) {
  const sampleSize = getBehaviorSampleSize(behavior);

  return (
    <div className="border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-xs">
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
    <details className="border border-[var(--border)] bg-[var(--panel-2)] px-3 py-3">
      <summary className="cursor-pointer text-sm font-semibold text-[var(--foreground)]">
        {getBehaviorDiagnosticsTitle(diagnostics)}
      </summary>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {getBehaviorUnavailableMessage({ diagnostics, coverage })}
      </p>
    </details>
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
  const caveats = getReadoutDisplayCaveats(readout, sampleQuality);

  return (
    <div className={`mb-3 border px-3 py-3 shadow-[var(--shadow-panel)] ${toneClass}`}>
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
      ? "border-[var(--warning-border)] bg-[var(--warning-bg)] text-[var(--warning)]"
      : quality.sampleQualityTone === "notice"
        ? "border-[var(--info-border)] bg-[var(--info-bg)] text-[var(--info)]"
        : "border-[var(--border)] bg-[var(--panel-2)] text-[var(--muted)]";

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
      {quality.caveats.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-4 text-[var(--muted)]">
          {quality.caveats.map((caveat) => (
            <li key={caveat}>{caveat}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function HistoricalFollowThroughEvaluationCard({
  evaluation,
}: {
  evaluation: HistoricalFollowThroughEvaluation;
}) {
  const toneClass = evaluation.available
    ? "border-[var(--border)] bg-[var(--panel-2)]"
    : "border-[var(--warning-border)] bg-[var(--warning-bg)]";

  return (
    <div className={`mb-3 border px-3 py-3 ${toneClass}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-normal text-[var(--muted-2)]">
            {evaluation.title}
          </div>
          <h3 className="mt-1 text-sm font-semibold text-[var(--foreground)]">
            {evaluation.posture}
          </h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-[var(--muted)]">
            {evaluation.interpretation}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <BehaviorFact label="Evaluation Scope" value={evaluation.evaluationScope} />
        <BehaviorFact
          label="Selected Horizon"
          value={evaluation.selectedHorizonLabel}
        />
        <BehaviorFact
          label="Completed Observations"
          value={evaluation.sampleLabel}
        />
        <BehaviorFact
          label="Historical Match"
          value={evaluation.directionMatchLabel}
        />
        <BehaviorFact
          label="Median Follow-through"
          value={evaluation.medianReturnLabel}
        />
        <BehaviorFact
          label="Historical Positive Rate"
          value={evaluation.positiveRateLabel}
        />
      </div>

      {evaluation.caveats.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-[var(--muted)]">
          {evaluation.caveats.map((caveat) => (
            <li key={caveat}>{caveat}</li>
          ))}
        </ul>
      ) : null}
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
      return "border-[var(--positive-border)] bg-[var(--positive-bg)]";
    case "weak":
      return "border-[var(--warning-border)] bg-[var(--warning-bg)]";
    case "risk":
      return "border-[var(--danger-border)] bg-[var(--danger-bg)]";
    case "mixed":
      return "border-[var(--info-border)] bg-[var(--info-bg)]";
    case "insufficient":
      return "border-[var(--border)] bg-[var(--panel-2)]";
  }
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
          className="border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-xs text-[var(--warning)]"
        >
          {getBehaviorWarningLabel(warning)}
        </p>
      ))}
    </div>
  );
}

function CurrentBehaviorContext({
  behavior,
  dictionary,
}: {
  behavior: SymbolBehavior;
  dictionary: BehaviorDisplayDictionary;
}) {
  const context = behavior.currentContext;

  if (!context) {
    return null;
  }

  return (
    <div className="mt-4 border border-[var(--border)] bg-[var(--panel-2)] px-3 py-3">
      <h3 className="text-sm font-semibold">Current context</h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <BehaviorFact
          label="Current Group"
          value={getBehaviorGroupLabel(context.resultGroup, dictionary)}
        />
        <BehaviorFact
          label="Current Signal"
          value={getBehaviorSignalLabel(context.signalLabel, dictionary)}
        />
        <BehaviorFact
          label="Primary Structure"
          value={getBehaviorSetupLabel(context.primaryStructure, dictionary)}
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
          <thead className="bg-[var(--table-header)] text-[10px] uppercase text-[var(--muted)]">
            <tr>
              <th className="px-2 py-1.5">Horizon</th>
              <th className="px-2 py-1.5 text-right">Observations</th>
              <th className="px-2 py-1.5 text-right">Avg Return</th>
              <th className="px-2 py-1.5 text-right">Median Return</th>
              <th className="px-2 py-1.5 text-right">
                Historical Positive Rate
              </th>
              <th className="px-2 py-1.5 text-right">Max Observed</th>
              <th className="px-2 py-1.5 text-right">Min Observed</th>
            </tr>
          </thead>
          <tbody>
            {horizons.map((horizon) => (
              <tr
                key={horizon.horizon}
                className="border-t border-[var(--border)] odd:bg-[var(--panel-data)] even:bg-[var(--panel-muted)]"
              >
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
  dictionary,
}: {
  outcomes: SymbolBehaviorRecentOutcome[];
  hasClusteredRuns?: boolean;
  expanded: boolean;
  onToggle: () => void;
  dictionary: BehaviorDisplayDictionary;
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
        <p className="mb-3 border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-xs text-[var(--warning)]">
          Several recent observations are close together in time; treat near-term
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
            <thead className="bg-[var(--table-header)] text-[10px] uppercase text-[var(--muted)]">
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
                  className="border-t border-[var(--border)] odd:bg-[var(--panel-data)] even:bg-[var(--panel-muted)]"
                >
                  <td className="px-2 py-2">
                    {formatRecentOutcomeDate(outcome.scanTime)}
                  </td>
                  <td className="px-2 py-2">
                    {getBehaviorGroupLabel(outcome.resultGroup, dictionary)}
                  </td>
                  <td className="px-2 py-2">
                    {getBehaviorSignalLabel(outcome.signalLabel, dictionary)}
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
      ? "text-[var(--positive)]"
      : Number.isFinite(numeric) && numeric < 0
        ? "text-[var(--negative)]"
        : "text-[var(--foreground)]";

  return (
    <td className={`px-2 py-2 text-right font-mono ${tone}`}>{formatted}</td>
  );
}

function BehaviorFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2">
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

function getReadoutDisplayCaveats(
  readout: BehaviorReadout,
  sampleQuality?: BehaviorSampleQualityReadout | null,
) {
  return uniquePanelCaveats(readout.caveats)
    .filter((caveat) => !isSampleQualityDuplicateCaveat(caveat, sampleQuality))
    .slice(0, 1);
}

function isSampleQualityDuplicateCaveat(
  caveat: string,
  sampleQuality?: BehaviorSampleQualityReadout | null,
) {
  const normalized = caveat.toLowerCase();

  if (
    normalized.includes("limited sample") ||
    normalized.includes("very small sample") ||
    normalized.includes("historical sample size") ||
    normalized.includes("research context") ||
    normalized.includes("completed forward candles are needed")
  ) {
    return true;
  }

  if (
    sampleQuality?.hasLimitedForwardCandles &&
    normalized.includes("1-candle horizon")
  ) {
    return true;
  }

  return false;
}

function getDisplayBehaviorWarnings(warnings: SymbolBehavior["warnings"]) {
  if (!Array.isArray(warnings)) {
    return [];
  }

  return warnings.filter((warning) => !isSampleSizeWarning(warning));
}

function isSampleSizeWarning(warning: string) {
  return (
    warning === "Very limited historical sample size." ||
    warning === "Limited historical sample size."
  );
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
