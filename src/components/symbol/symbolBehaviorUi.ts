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
  sourceRunIsLikelyFullUniverse?: boolean | null;
  isSelectedCurrentRun?: boolean | null;
  isNewerThanSelectedCurrentRun?: boolean | null;
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

export type SymbolBehaviorRunContext = {
  scanTime?: string | null;
  sourceRunIsLikelyFullUniverse?: boolean | null;
  isSelectedCurrentRun?: boolean | null;
  isNewerThanSelectedCurrentRun?: boolean | null;
};

export type BehaviorSampleQualityTone = "neutral" | "notice" | "warning";

export type BehaviorSampleQualityReadout = {
  sampleQualityLabel: string;
  sampleQualityTone: BehaviorSampleQualityTone;
  hygieneSummary: string;
  caveats: string[];
  hasClusteredRuns: boolean;
  hasLimitedForwardCandles: boolean;
  hasNonPreferredRuns: boolean;
  hasVerySmallSample: boolean;
  hasLimitedSample: boolean;
};

export type BehaviorReadoutContextType =
  | "opportunity"
  | "risk"
  | "neutral"
  | "unknown";

export type BehaviorReadoutTone =
  | "constructive"
  | "weak"
  | "risk"
  | "mixed"
  | "insufficient";

export type BehaviorReadoutAgreement =
  | "aligned_positive"
  | "aligned_negative"
  | "mixed"
  | "short_only"
  | "insufficient";

export type BehaviorReadoutInput = {
  resultGroup?: string | null;
  currentGroup?: string | null;
  signalLabel?: string | null;
  sampleSize?: BehaviorNumericValue;
  horizons?: SymbolBehavior["horizons"];
  warnings?: string[] | null;
};

export type BehaviorReadout = {
  label: string;
  tone: BehaviorReadoutTone;
  contextType: BehaviorReadoutContextType;
  sampleConfidenceLabel: string;
  selectedHorizonLabel: string;
  selectedHorizon: SymbolBehaviorHorizonKey | null;
  horizonAgreement: BehaviorReadoutAgreement;
  horizonAgreementLabel: string;
  historicalBiasLabel: string;
  summaryText: string;
  caveats: string[];
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

export function buildBehaviorSampleQuality({
  behavior,
  signalHistory,
}: {
  behavior: SymbolBehavior | null | undefined;
  signalHistory?: SymbolBehaviorRunContext[] | null;
}): BehaviorSampleQualityReadout | null {
  if (!behavior) {
    return null;
  }

  const sampleSize = getBehaviorSampleSize(behavior);
  const horizonRows = getBehaviorHorizonRows(behavior);
  const recentOutcomes = Array.isArray(behavior.recentOutcomes)
    ? behavior.recentOutcomes
    : [];
  const runContexts = [
    ...recentOutcomes,
    ...(Array.isArray(signalHistory) ? signalHistory : []),
  ];
  const hasVerySmallSample = sampleSize > 0 && sampleSize < 10;
  const hasLimitedSample = sampleSize >= 10 && sampleSize < 20;
  const hasClusteredRuns = hasClusteredScanTimes(
    recentOutcomes.length > 0 ? recentOutcomes : signalHistory,
  );
  const hasLimitedForwardCandles = hasLimitedLongerHorizonSamples(
    horizonRows,
    sampleSize,
  );
  const hasNonPreferredRuns = runContexts.some(isNonPreferredRunContext);
  const isNewOneHourHistory =
    behavior.currentContext?.timeframe?.trim().toLowerCase() === "1h" &&
    sampleSize < 20;

  const caveats: string[] = [];

  if (hasVerySmallSample || isNewOneHourHistory) {
    caveats.push("Production history is still accumulating.");
  }

  if (hasVerySmallSample) {
    caveats.push("Very limited sample; treat as research context.");
  } else if (hasLimitedSample) {
    caveats.push("Limited sample; treat as research context.");
  }

  if (hasClusteredRuns) {
    caveats.push(
      "Some recent observations appear clustered and may reflect development or non-scheduled runs.",
    );
  }

  if (hasNonPreferredRuns) {
    caveats.push(
      "Some observations may include non-selected or secondary runs.",
    );
  }

  if (hasLimitedForwardCandles) {
    caveats.push("Longer-horizon outcomes are still incomplete.");
  }

  const sampleQualityLabel = getBehaviorSampleQualityLabel({
    hasVerySmallSample,
    hasLimitedSample,
    hasNonPreferredRuns,
    hasClusteredRuns,
    hasLimitedForwardCandles,
  });

  return {
    sampleQualityLabel,
    sampleQualityTone: getBehaviorSampleQualityTone({
      hasVerySmallSample,
      hasLimitedSample,
      hasNonPreferredRuns,
      hasClusteredRuns,
      hasLimitedForwardCandles,
    }),
    hygieneSummary: getBehaviorSampleQualitySummary({
      sampleQualityLabel,
      hasVerySmallSample,
      hasLimitedSample,
      hasNonPreferredRuns,
      hasClusteredRuns,
      hasLimitedForwardCandles,
    }),
    caveats: uniqueStrings(caveats),
    hasClusteredRuns,
    hasLimitedForwardCandles,
    hasNonPreferredRuns,
    hasVerySmallSample,
    hasLimitedSample,
  };
}

export function buildBehaviorReadout(
  input: BehaviorReadoutInput,
): BehaviorReadout {
  const overallSampleSize = Math.max(
    0,
    Math.trunc(toBehaviorNumber(input.sampleSize) ?? 0),
  );
  const horizonRows = getBehaviorHorizonRows({ horizons: input.horizons });
  const usableRows = horizonRows.filter(isUsableReadoutHorizon);
  const selected = selectBehaviorReadoutHorizon(usableRows);
  const selectedSampleSize = selected?.sampleSize ?? 0;
  const contextType = getBehaviorReadoutContextType(
    input.resultGroup ?? input.currentGroup,
  );
  const horizonAgreement = getBehaviorHorizonAgreement(usableRows);
  const caveats = buildBehaviorReadoutCaveats({
    selectedSampleSize,
    overallSampleSize,
    horizonAgreement,
    warnings: input.warnings,
  });

  if (!selected) {
    return {
      label: "Insufficient sample",
      tone: "insufficient",
      contextType,
      sampleConfidenceLabel: getBehaviorReadoutSampleConfidence(0),
      selectedHorizonLabel: "No usable horizon",
      selectedHorizon: null,
      horizonAgreement,
      horizonAgreementLabel: getBehaviorHorizonAgreementLabel(horizonAgreement),
      historicalBiasLabel: "Not enough usable horizon data",
      summaryText:
        "Not enough completed follow-through observations are available for a conservative readout.",
      caveats,
    };
  }

  const label = getBehaviorReadoutLabel({ selected, contextType });
  const tone = getBehaviorReadoutTone({ label, contextType });

  return {
    label,
    tone,
    contextType,
    sampleConfidenceLabel: getBehaviorReadoutSampleConfidence(selectedSampleSize),
    selectedHorizonLabel: selected.label,
    selectedHorizon: selected.horizon,
    horizonAgreement,
    horizonAgreementLabel: getBehaviorHorizonAgreementLabel(horizonAgreement),
    historicalBiasLabel: `${formatBehaviorPercent(
      selected.medianReturnPct,
    )} median, ${formatBehaviorWinRate(
      selected.winRatePct,
    )} positive rate in this sample`,
    summaryText: getBehaviorReadoutSummaryText({
      label,
      selectedHorizonLabel: selected.label,
      contextType,
    }),
    caveats,
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

function isUsableReadoutHorizon(row: SymbolBehaviorHorizonRow) {
  return (
    row.sampleSize >= 10 &&
    row.medianReturnPct !== null &&
    row.winRatePct !== null
  );
}

function selectBehaviorReadoutHorizon(
  usableRows: SymbolBehaviorHorizonRow[],
) {
  return (
    usableRows.find((row) => row.horizon === "5") ??
    usableRows.find((row) => row.horizon === "3") ??
    usableRows.find((row) => row.horizon === "1") ??
    null
  );
}

function getBehaviorReadoutContextType(
  resultGroup: string | null | undefined,
): BehaviorReadoutContextType {
  const normalized = resultGroup?.trim().toLowerCase();

  if (normalized === "risk") {
    return "risk";
  }

  if (normalized === "neutral") {
    return "neutral";
  }

  if (
    normalized === "eligible" ||
    normalized === "watch" ||
    normalized === "overheated"
  ) {
    return "opportunity";
  }

  return "unknown";
}

function getBehaviorHorizonAgreement(
  usableRows: SymbolBehaviorHorizonRow[],
): BehaviorReadoutAgreement {
  if (usableRows.length === 0) {
    return "insufficient";
  }

  if (usableRows.length === 1 && usableRows[0].horizon === "1") {
    return "short_only";
  }

  const positiveCount = usableRows.filter(
    (row) =>
      (row.medianReturnPct ?? 0) > 0 && (row.winRatePct ?? 0) >= 50,
  ).length;
  const negativeCount = usableRows.filter(
    (row) =>
      (row.medianReturnPct ?? 0) < 0 && (row.winRatePct ?? 0) < 50,
  ).length;
  const majority = Math.floor(usableRows.length / 2) + 1;

  if (positiveCount >= majority) {
    return "aligned_positive";
  }

  if (negativeCount >= majority) {
    return "aligned_negative";
  }

  return "mixed";
}

function getBehaviorHorizonAgreementLabel(
  agreement: BehaviorReadoutAgreement,
) {
  switch (agreement) {
    case "aligned_positive":
      return "Aligned positive";
    case "aligned_negative":
      return "Aligned negative";
    case "mixed":
      return "Mixed";
    case "short_only":
      return "Short horizon only";
    case "insufficient":
      return "Insufficient";
  }
}

function getBehaviorReadoutSampleConfidence(sampleSize: number) {
  if (sampleSize >= 50) {
    return "Better";
  }

  if (sampleSize >= 20) {
    return "Moderate";
  }

  if (sampleSize >= 10) {
    return "Limited";
  }

  return "Very limited";
}

function getBehaviorReadoutLabel({
  selected,
  contextType,
}: {
  selected: SymbolBehaviorHorizonRow;
  contextType: BehaviorReadoutContextType;
}) {
  const median = selected.medianReturnPct ?? 0;
  const positiveRate = selected.winRatePct ?? 0;

  if (contextType === "risk") {
    if (median < 0 && positiveRate < 45) {
      return "Downside continuation tendency";
    }

    if (median >= 0) {
      return "Risk not confirmed in sample";
    }

    return "Mixed risk follow-through";
  }

  if (median > 1 && positiveRate >= 60 && selected.sampleSize >= 20) {
    return "Strong constructive tendency";
  }

  if (median > 0 && positiveRate >= 50) {
    return "Constructive tendency";
  }

  if (median < 0 && positiveRate < 45) {
    return "Weak follow-through";
  }

  return "Mixed follow-through";
}

function getBehaviorReadoutTone({
  label,
  contextType,
}: {
  label: string;
  contextType: BehaviorReadoutContextType;
}): BehaviorReadoutTone {
  if (label === "Insufficient sample") {
    return "insufficient";
  }

  if (contextType === "risk") {
    return label === "Downside continuation tendency" ? "risk" : "mixed";
  }

  if (
    label === "Constructive tendency" ||
    label === "Strong constructive tendency"
  ) {
    return "constructive";
  }

  if (label === "Weak follow-through") {
    return "weak";
  }

  return "mixed";
}

function getBehaviorReadoutSummaryText({
  label,
  selectedHorizonLabel,
  contextType,
}: {
  label: string;
  selectedHorizonLabel: string;
  contextType: BehaviorReadoutContextType;
}) {
  if (
    label === "Constructive tendency" ||
    label === "Strong constructive tendency"
  ) {
    return `Prior similar signals tended to show constructive follow-through over ${selectedHorizonLabel} in this sample.`;
  }

  if (label === "Weak follow-through") {
    return `Prior similar signals did not consistently follow through over ${selectedHorizonLabel} in this sample.`;
  }

  if (label === "Downside continuation tendency") {
    return `Prior similar risk signals tended to continue lower over ${selectedHorizonLabel} in this sample.`;
  }

  if (label === "Risk not confirmed in sample") {
    return `Prior similar risk signals did not consistently continue lower over ${selectedHorizonLabel} in this sample.`;
  }

  if (contextType === "risk") {
    return `Prior similar risk signals had mixed follow-through over ${selectedHorizonLabel} in this sample.`;
  }

  return `Prior similar signals had mixed follow-through over ${selectedHorizonLabel} in this sample.`;
}

function buildBehaviorReadoutCaveats({
  selectedSampleSize,
  overallSampleSize,
  horizonAgreement,
  warnings,
}: {
  selectedSampleSize: number;
  overallSampleSize: number;
  horizonAgreement: BehaviorReadoutAgreement;
  warnings?: string[] | null;
}) {
  const caveats: string[] = [];

  if (selectedSampleSize < 10) {
    caveats.push("Very limited sample: more completed forward candles are needed.");
  } else if (selectedSampleSize < 20) {
    caveats.push("Limited sample: treat this as research context only.");
  }

  if (overallSampleSize > 0 && overallSampleSize < selectedSampleSize) {
    caveats.push("Overall sample metadata is smaller than the selected horizon sample.");
  }

  if (horizonAgreement === "mixed") {
    caveats.push("Usable horizons disagree; avoid over-weighting one horizon.");
  }

  if (horizonAgreement === "short_only") {
    caveats.push("Only the 1-candle horizon has enough usable observations.");
  }

  for (const warning of warnings ?? []) {
    if (warning) {
      caveats.push(getBehaviorWarningLabel(warning));
    }
  }

  return uniqueStrings(caveats);
}

function hasClusteredScanTimes(
  values:
    | Array<{ scanTime?: string | null } | null | undefined>
    | null
    | undefined,
) {
  if (!Array.isArray(values) || values.length < 3) {
    return false;
  }

  const times = values
    .map((item) => item?.scanTime ?? "")
    .map((scanTime) => parseValidDateMs(scanTime))
    .filter((time): time is number => time !== null)
    .sort((left, right) => left - right);

  if (times.length < 3) {
    return false;
  }

  const clusteredWindowMs = 60 * 60 * 1000;

  for (let startIndex = 0; startIndex <= times.length - 3; startIndex += 1) {
    if (times[startIndex + 2]! - times[startIndex]! <= clusteredWindowMs) {
      return true;
    }
  }

  return false;
}

function parseValidDateMs(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function hasLimitedLongerHorizonSamples(
  horizonRows: SymbolBehaviorHorizonRow[],
  sampleSize: number,
) {
  if (sampleSize <= 0) {
    return false;
  }

  return horizonRows
    .filter((row) => row.horizon === "3" || row.horizon === "5")
    .some((row) => {
      if (row.sampleSize === 0) {
        return true;
      }

      const missingCount = sampleSize - row.sampleSize;
      return missingCount >= 5 && row.sampleSize <= sampleSize * 0.5;
    });
}

function isNonPreferredRunContext(
  value: SymbolBehaviorRunContext | null | undefined,
) {
  if (!value || value.isSelectedCurrentRun === true) {
    return false;
  }

  return (
    value.isNewerThanSelectedCurrentRun === true ||
    value.sourceRunIsLikelyFullUniverse === false
  );
}

function getBehaviorSampleQualityLabel({
  hasVerySmallSample,
  hasLimitedSample,
  hasNonPreferredRuns,
  hasClusteredRuns,
  hasLimitedForwardCandles,
}: Pick<
  BehaviorSampleQualityReadout,
  | "hasVerySmallSample"
  | "hasLimitedSample"
  | "hasNonPreferredRuns"
  | "hasClusteredRuns"
  | "hasLimitedForwardCandles"
>) {
  if (hasVerySmallSample) {
    return "Very limited sample";
  }

  if (hasLimitedSample) {
    return "Limited sample";
  }

  if (hasNonPreferredRuns) {
    return "Mixed run context";
  }

  if (hasClusteredRuns) {
    return "Clustered recent observations";
  }

  if (hasLimitedForwardCandles) {
    return "Waiting for more completed forward candles";
  }

  return "Clean enough for context";
}

function getBehaviorSampleQualityTone({
  hasVerySmallSample,
  hasLimitedSample,
  hasNonPreferredRuns,
  hasClusteredRuns,
  hasLimitedForwardCandles,
}: Pick<
  BehaviorSampleQualityReadout,
  | "hasVerySmallSample"
  | "hasLimitedSample"
  | "hasNonPreferredRuns"
  | "hasClusteredRuns"
  | "hasLimitedForwardCandles"
>): BehaviorSampleQualityTone {
  if (hasVerySmallSample || hasNonPreferredRuns || hasClusteredRuns) {
    return "warning";
  }

  if (hasLimitedSample || hasLimitedForwardCandles) {
    return "notice";
  }

  return "neutral";
}

function getBehaviorSampleQualitySummary({
  sampleQualityLabel,
  hasVerySmallSample,
  hasLimitedSample,
  hasNonPreferredRuns,
  hasClusteredRuns,
  hasLimitedForwardCandles,
}: Pick<
  BehaviorSampleQualityReadout,
  | "sampleQualityLabel"
  | "hasVerySmallSample"
  | "hasLimitedSample"
  | "hasNonPreferredRuns"
  | "hasClusteredRuns"
  | "hasLimitedForwardCandles"
>) {
  if (hasVerySmallSample) {
    return "Very limited completed observations are available; production history is still accumulating.";
  }

  if (hasLimitedSample) {
    return "A limited sample is available; treat as research context.";
  }

  if (hasNonPreferredRuns) {
    return "This sample may include non-selected or secondary runs.";
  }

  if (hasClusteredRuns) {
    return "Recent observations appear clustered close together in time.";
  }

  if (hasLimitedForwardCandles) {
    return "Longer-horizon outcomes are still accumulating.";
  }

  return `${sampleQualityLabel}; treat as research context.`;
}

function uniqueStrings(values: string[]) {
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
