import { formatSymbolResearchDateTime, toTitleCase } from "./symbolResearchUi";

export type SymbolBehaviorHorizonKey = "1" | "3" | "5";

export type SymbolBehaviorHorizonStats = {
  sampleSize: number;
  avgReturnPct: number | null;
  medianReturnPct: number | null;
  winRatePct: number | null;
  bestReturnPct: number | null;
  worstReturnPct: number | null;
};

export type SymbolBehaviorHorizonMap = Record<
  SymbolBehaviorHorizonKey,
  SymbolBehaviorHorizonStats | null
>;

export type SymbolBehaviorResultGroupStats = {
  resultGroup: string;
  sampleSize: number;
  horizons: SymbolBehaviorHorizonMap;
};

export type SymbolBehaviorSignalLabelStats = {
  signalLabel: string;
  sampleSize: number;
  horizons: SymbolBehaviorHorizonMap;
};

export type SymbolBehaviorRecentOutcome = {
  scanTime: string;
  resultGroup: string | null;
  signalLabel: string | null;
  rankScore: number | null;
  priceAtSignal: number | null;
  forwardReturnPct: Record<SymbolBehaviorHorizonKey, number | null>;
};

export type SymbolBehavior = {
  sampleSize: number;
  horizons: SymbolBehaviorHorizonMap;
  byResultGroup: SymbolBehaviorResultGroupStats[];
  bySignalLabel: SymbolBehaviorSignalLabelStats[];
  recentOutcomes: SymbolBehaviorRecentOutcome[];
  currentContext: {
    resultGroup: string | null;
    signalLabel: string | null;
    primaryStructure: string | null;
    timeframe: string;
  };
  warnings: string[];
};

export type SymbolBehaviorDiagnostics = {
  available: boolean;
  reason:
    | "ok"
    | "no_prior_signals"
    | "missing_forward_candles"
    | "insufficient_sample"
    | "calculation_failed"
    | "no_latest_signal"
    | "unknown";
  message: string;
};

export type SymbolBehaviorHorizonRow = SymbolBehaviorHorizonStats & {
  horizon: SymbolBehaviorHorizonKey;
  label: string;
};

export const symbolBehaviorHorizonKeys = ["1", "3", "5"] as const;

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

export function getBehaviorSetupLabel(primaryStructure: string | null | undefined) {
  return primaryStructure ? toTitleCase(primaryStructure) : "Unknown";
}

export function getBehaviorHorizonRows(
  behavior: SymbolBehavior | null | undefined,
): SymbolBehaviorHorizonRow[] {
  if (!behavior) {
    return [];
  }

  return symbolBehaviorHorizonKeys.map((horizon) => ({
    horizon,
    label: `${horizon} ${horizon === "1" ? "candle" : "candles"}`,
    ...(behavior.horizons[horizon] ?? {
      sampleSize: 0,
      avgReturnPct: null,
      medianReturnPct: null,
      winRatePct: null,
      bestReturnPct: null,
      worstReturnPct: null,
    }),
  }));
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
      Object.values(behavior.horizons).some(
        (horizon) => (horizon?.sampleSize ?? 0) > 0,
      ),
  );
}

export function buildBehaviorSummary(behavior: SymbolBehavior) {
  const horizonRows = getBehaviorHorizonRows(behavior);

  return [
    {
      label: "Historical Sample",
      value: formatBehaviorSampleSize(behavior.sampleSize),
    },
    ...horizonRows.map((row) => ({
      label: `${row.horizon} Candle Samples`,
      value: formatBehaviorSampleSize(row.sampleSize),
    })),
  ];
}

export function getBehaviorUnavailableMessage(
  diagnostics: SymbolBehaviorDiagnostics | null | undefined,
) {
  return (
    diagnostics?.message ||
    "Historical behavior is not available for this symbol/timeframe yet."
  );
}

export function formatRecentOutcomeDate(value: string | null | undefined) {
  return formatSymbolResearchDateTime(value);
}
