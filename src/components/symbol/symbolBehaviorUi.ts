import { formatSymbolResearchDateTime, toTitleCase } from "./symbolResearchUi";

export type SymbolBehaviorHorizonKey = "1" | "3" | "5";
export type BehaviorNumericValue = number | string | null | undefined;

export type SymbolBehaviorHorizonStats = {
  sampleSize?: BehaviorNumericValue;
  avgReturnPct?: BehaviorNumericValue;
  medianReturnPct?: BehaviorNumericValue;
  winRatePct?: BehaviorNumericValue;
  bestReturnPct?: BehaviorNumericValue;
  worstReturnPct?: BehaviorNumericValue;
  candles?: BehaviorNumericValue;
  horizon?: SymbolBehaviorHorizonKey | number | string | null;
};

export type SymbolBehaviorHorizonMap = Partial<
  Record<SymbolBehaviorHorizonKey, SymbolBehaviorHorizonStats | null | undefined>
>;

export type SymbolBehaviorResultGroupStats = {
  resultGroup?: string | null;
  sampleSize?: BehaviorNumericValue;
  horizons?: SymbolBehaviorHorizonMap | SymbolBehaviorHorizonStats[] | null;
};

export type SymbolBehaviorSignalLabelStats = {
  signalLabel?: string | null;
  sampleSize?: BehaviorNumericValue;
  horizons?: SymbolBehaviorHorizonMap | SymbolBehaviorHorizonStats[] | null;
};

export type SymbolBehaviorRecentOutcome = {
  scanTime?: string | null;
  resultGroup?: string | null;
  signalLabel?: string | null;
  rankScore?: BehaviorNumericValue;
  priceAtSignal?: BehaviorNumericValue;
  forwardReturnPct?: Partial<Record<SymbolBehaviorHorizonKey, BehaviorNumericValue>> | null;
  forwardReturnsPct?: {
    next1?: BehaviorNumericValue;
    next3?: BehaviorNumericValue;
    next5?: BehaviorNumericValue;
  } | null;
};

export type SymbolBehavior = {
  sampleSize?: BehaviorNumericValue;
  horizons?: SymbolBehaviorHorizonMap | SymbolBehaviorHorizonStats[] | null;
  byResultGroup?: SymbolBehaviorResultGroupStats[] | null;
  bySignalLabel?: SymbolBehaviorSignalLabelStats[] | null;
  recentOutcomes?: SymbolBehaviorRecentOutcome[] | null;
  currentContext?: {
    resultGroup?: string | null;
    signalLabel?: string | null;
    primaryStructure?: string | null;
    timeframe?: string | null;
  } | null;
  warnings?: string[] | null;
};

export type SymbolBehaviorDiagnostics = {
  available?: boolean | null;
  reason?:
    | "ok"
    | "no_prior_signals"
    | "missing_forward_candles"
    | "insufficient_sample"
    | "calculation_failed"
    | "no_latest_signal"
    | "unknown"
    | string
    | null;
  message?: string | null;
};

export type SymbolBehaviorCoverage = {
  candleCount?: BehaviorNumericValue;
  requiredCandles?: BehaviorNumericValue;
};

export type SymbolBehaviorHorizonRow = {
  horizon: SymbolBehaviorHorizonKey;
  label: string;
  sampleSize: number;
  avgReturnPct: number | null;
  medianReturnPct: number | null;
  winRatePct: number | null;
  bestReturnPct: number | null;
  worstReturnPct: number | null;
};

export type SymbolBehaviorSampleHint = {
  label: string;
  detail: string;
  tone: "stronger" | "limited" | "small" | "none";
};

export const symbolBehaviorHorizonKeys = ["1", "3", "5"] as const;

export function toBehaviorNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = typeof value === "string" ? Number(value.trim()) : Number(value);

  return Number.isFinite(number) ? number : null;
}

export function formatBehaviorPercent(value: unknown) {
  const number = toBehaviorNumber(value);

  if (number === null) {
    return "—";
  }

  const sign = number > 0 ? "+" : "";

  return `${sign}${number.toFixed(2)}%`;
}

export function formatBehaviorWinRate(value: unknown) {
  const number = toBehaviorNumber(value);

  return number === null ? "—" : `${number.toFixed(1)}%`;
}

export function formatBehaviorSampleSize(value: unknown) {
  const number = toBehaviorNumber(value);

  if (number === null) {
    return "0";
  }

  return String(Math.max(0, Math.trunc(number)));
}

export function getBehaviorWarningLabel(warning: string) {
  switch (warning) {
    case "Very limited historical sample size.":
      return "Very small sample — treat as context only.";
    case "Limited historical sample size.":
      return "Limited sample — useful as context, not a conclusion.";
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
  return symbolBehaviorHorizonKeys.map((horizon) =>
    normalizeHorizonRow(horizon, getRawHorizon(behavior?.horizons, horizon)),
  );
}

export function selectCompactRecentOutcomes(
  outcomes: SymbolBehaviorRecentOutcome[] | null | undefined,
  expanded: boolean,
  compactLimit = 10,
) {
  const rows = Array.isArray(outcomes) ? outcomes : [];

  return expanded ? rows : rows.slice(0, compactLimit);
}

export function getHiddenRecentOutcomeCount({
  outcomes,
  expanded,
  compactLimit = 10,
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
  return getBehaviorHorizonRows(behavior).some((horizon) => horizon.sampleSize > 0);
}

export function getBehaviorSampleSize(behavior: SymbolBehavior | null | undefined) {
  return Math.max(
    toBehaviorNumber(behavior?.sampleSize) ?? 0,
    ...getBehaviorHorizonRows(behavior).map((row) => row.sampleSize),
  );
}

export function getBehaviorSampleHint(
  behavior: SymbolBehavior | null | undefined,
): SymbolBehaviorSampleHint {
  const sampleSize = getBehaviorSampleSize(behavior);

  if (sampleSize >= 30) {
    return {
      label: "Stronger sample",
      detail: "More prior observations are available, but this remains research context.",
      tone: "stronger",
    };
  }

  if (sampleSize >= 10) {
    return {
      label: "Limited but usable sample",
      detail: "Useful as context, not a conclusion.",
      tone: "limited",
    };
  }

  if (sampleSize >= 1) {
    return {
      label: "Very small sample",
      detail: "Treat these observations carefully.",
      tone: "small",
    };
  }

  return {
    label: "No completed observations",
    detail: "More completed scanner history is needed.",
    tone: "none",
  };
}

export function buildBehaviorSummary(behavior: SymbolBehavior) {
  const horizonRows = getBehaviorHorizonRows(behavior);

  return [
    {
      label: "Sample Size",
      value: `${formatBehaviorSampleSize(
        getBehaviorSampleSize(behavior),
      )} prior observations`,
    },
    ...horizonRows.map((row) => ({
      label: `${row.horizon} Candle Outcomes`,
      value: formatBehaviorSampleSize(row.sampleSize),
    })),
  ];
}

export function getBehaviorDiagnosticsTitle(
  diagnostics: SymbolBehaviorDiagnostics | null | undefined,
) {
  switch (diagnostics?.reason) {
    case "no_latest_signal":
      return "No current latest signal";
    case "no_prior_signals":
      return "No prior matching signals";
    case "missing_forward_candles":
      return "Forward candles not ready";
    case "insufficient_sample":
      return "Sample is still too small";
    case "calculation_failed":
      return "Calculation unavailable";
    case "ok":
      return "Historical behavior available";
    default:
      return "Historical behavior unavailable";
  }
}

export function getBehaviorUnavailableMessage({
  diagnostics,
  coverage,
}: {
  diagnostics?: SymbolBehaviorDiagnostics | null;
  coverage?: SymbolBehaviorCoverage | null;
} = {}) {
  const coverageText = formatBehaviorCoverage(coverage);
  const suffix = coverageText ? ` Current coverage: ${coverageText}.` : "";

  switch (diagnostics?.reason) {
    case "no_latest_signal":
      return `Historical behavior is unavailable because this symbol/timeframe does not currently have a latest signal.${suffix}`;
    case "no_prior_signals":
      return "No prior matching signals were found yet for this symbol/timeframe. This can be normal for newly added 1d/1w data or newly available symbols.";
    case "missing_forward_candles":
      return "Prior signals exist, but not enough forward candles have completed yet to summarize behavior.";
    case "insufficient_sample":
      return "There are prior signals, but not enough completed outcomes yet to summarize behavior safely.";
    case "calculation_failed":
      return "Historical behavior could not be calculated for this request. The rest of Symbol Research remains available.";
    default:
      return (
        diagnostics?.message ||
        "Historical behavior is currently unavailable for this symbol/timeframe."
      );
  }
}

export function getRecentOutcomeReturn(
  outcome: SymbolBehaviorRecentOutcome,
  horizon: SymbolBehaviorHorizonKey,
) {
  const directValue = outcome.forwardReturnPct?.[horizon];

  if (directValue !== undefined) {
    return directValue;
  }

  if (horizon === "1") {
    return outcome.forwardReturnsPct?.next1;
  }

  if (horizon === "3") {
    return outcome.forwardReturnsPct?.next3;
  }

  return outcome.forwardReturnsPct?.next5;
}

export function formatRecentOutcomeDate(value: string | null | undefined) {
  return formatSymbolResearchDateTime(value);
}

export function formatBehaviorCoverage(
  coverage: SymbolBehaviorCoverage | null | undefined,
) {
  const candleCount = toBehaviorNumber(coverage?.candleCount);
  const requiredCandles = toBehaviorNumber(coverage?.requiredCandles);

  if (candleCount === null) {
    return null;
  }

  if (requiredCandles === null) {
    return `${Math.trunc(candleCount)} candles`;
  }

  return `${Math.trunc(candleCount)} / ${Math.trunc(requiredCandles)} required candles`;
}

function getRawHorizon(
  horizons: SymbolBehavior["horizons"],
  horizon: SymbolBehaviorHorizonKey,
) {
  if (!horizons) {
    return null;
  }

  if (Array.isArray(horizons)) {
    return (
      horizons.find((item) => {
        const key = getHorizonKey(item?.horizon ?? item?.candles);
        return key === horizon;
      }) ?? null
    );
  }

  return horizons[horizon] ?? null;
}

function normalizeHorizonRow(
  horizon: SymbolBehaviorHorizonKey,
  raw: SymbolBehaviorHorizonStats | null | undefined,
): SymbolBehaviorHorizonRow {
  return {
    horizon,
    label: `${horizon} ${horizon === "1" ? "candle" : "candles"}`,
    sampleSize: Math.max(0, Math.trunc(toBehaviorNumber(raw?.sampleSize) ?? 0)),
    avgReturnPct: toBehaviorNumber(raw?.avgReturnPct),
    medianReturnPct: toBehaviorNumber(raw?.medianReturnPct),
    winRatePct: toBehaviorNumber(raw?.winRatePct),
    bestReturnPct: toBehaviorNumber(raw?.bestReturnPct),
    worstReturnPct: toBehaviorNumber(raw?.worstReturnPct),
  };
}

function getHorizonKey(value: unknown): SymbolBehaviorHorizonKey | null {
  if (value === 1 || value === "1") {
    return "1";
  }

  if (value === 3 || value === "3") {
    return "3";
  }

  if (value === 5 || value === "5") {
    return "5";
  }

  return null;
}
