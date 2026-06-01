import { formatSymbolResearchDateTime, toTitleCase } from "./symbolResearchUi";

export type SymbolBehaviorHorizonCandles = 1 | 3 | 5;

export type SymbolBehaviorHorizonStats = {
  candles: SymbolBehaviorHorizonCandles;
  sampleSize: number;
  averageReturnPct: number | null;
  medianReturnPct: number | null;
  winRatePct: number | null;
  averageMaxUpsidePct: number | null;
  averageMaxDrawdownPct: number | null;
  bestReturnPct: number | null;
  worstReturnPct: number | null;
};

export type SymbolBehaviorGroupedStats = {
  group: string;
  sampleSize: number;
  horizons: SymbolBehaviorHorizonStats[];
};

export type SymbolBehaviorSignalLabelStats = {
  signalLabel: string;
  sampleSize: number;
  horizons: SymbolBehaviorHorizonStats[];
};

export type SymbolBehaviorRecentOutcome = {
  scanTime: string;
  candleOpenTime: string | null;
  signalLabel: string;
  resultGroup: string | null;
  actionBias: string | null;
  primaryStructure: string | null;
  priceAtSignal: number | null;
  rankScore: number | null;
  forwardReturnsPct: {
    next1: number | null;
    next3: number | null;
    next5: number | null;
  };
  maxUpsidePct: {
    next1: number | null;
    next3: number | null;
    next5: number | null;
  };
  maxDrawdownPct: {
    next1: number | null;
    next3: number | null;
    next5: number | null;
  };
  hasEnoughForwardCandles: boolean;
};

export type SymbolBehavior = {
  timeframe: string;
  symbol: string;
  sampleSize: number;
  eligibleSampleSize: number;
  horizons: SymbolBehaviorHorizonStats[];
  byGroup: SymbolBehaviorGroupedStats[];
  bySignalLabel: SymbolBehaviorSignalLabelStats[];
  recentOutcomes: SymbolBehaviorRecentOutcome[];
  currentContext?: {
    currentSignalLabel: string | null;
    currentResultGroup: string | null;
    matchingGroupSampleSize: number;
    matchingSignalSampleSize: number;
    note: string;
  };
  warnings: string[];
};

export function formatBehaviorPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  const sign = value > 0 ? "+" : "";

  return `${sign}${value.toFixed(2)}%`;
}

export function formatBehaviorWinRate(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return `${value.toFixed(1)}%`;
}

export function formatBehaviorSampleSize(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "0";
  }

  return String(Math.max(0, Math.trunc(value)));
}

export function getBehaviorWarningLabel(warning: string) {
  switch (warning) {
    case "Not enough historical behavior data yet.":
      return "Not enough historical behavior data yet.";
    case "Not enough forward candles for reliable outcome statistics.":
      return "Not enough forward candles for reliable outcome statistics.";
    case "Very limited historical sample size.":
      return "Very limited historical sample size.";
    case "Limited historical sample size.":
      return "Limited historical sample size.";
    default:
      return warning;
  }
}

export function getBehaviorGroupLabel(group: string | null | undefined) {
  return group ? toTitleCase(group) : "Unknown";
}

export function getBehaviorSignalLabel(signalLabel: string | null | undefined) {
  return signalLabel ? toTitleCase(signalLabel) : "Unknown";
}

export function selectCompactRecentOutcomes(
  outcomes: SymbolBehaviorRecentOutcome[] | null | undefined,
  expanded: boolean,
  compactLimit = 5,
) {
  const rows = outcomes ?? [];

  return expanded ? rows : rows.slice(0, compactLimit);
}

export function getHiddenRecentOutcomeCount({
  outcomes,
  expanded,
  compactLimit = 5,
}: {
  outcomes: SymbolBehaviorRecentOutcome[] | null | undefined;
  expanded: boolean;
  compactLimit?: number;
}) {
  if (expanded) {
    return 0;
  }

  return Math.max(0, (outcomes?.length ?? 0) - compactLimit);
}

export function hasBehaviorOutcomeStats(behavior: SymbolBehavior | null | undefined) {
  return Boolean(
    behavior &&
      (behavior.sampleSize > 0 ||
        behavior.horizons.some((horizon) => horizon.sampleSize > 0)),
  );
}

export function buildBehaviorSummary(behavior: SymbolBehavior) {
  const context = behavior.currentContext;

  return [
    {
      label: "Historical Sample",
      value: formatBehaviorSampleSize(behavior.sampleSize),
    },
    {
      label: "Outcome Sample",
      value: formatBehaviorSampleSize(behavior.eligibleSampleSize),
    },
    {
      label: "Current Group Sample",
      value: formatBehaviorSampleSize(context?.matchingGroupSampleSize),
    },
    {
      label: "Current Signal Sample",
      value: formatBehaviorSampleSize(context?.matchingSignalSampleSize),
    },
  ];
}

export function formatRecentOutcomeDate(value: string | null | undefined) {
  return formatSymbolResearchDateTime(value);
}
