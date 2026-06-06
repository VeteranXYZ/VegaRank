import { formatDisplayDateTime } from "@/lib/utils/format";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { formatScannerReviewValue } from "@/lib/i18n/formatScannerObservation";
import type { ScannerReviewText } from "@/lib/shared/scannerTypes";

export type SymbolResearchGroup =
  | "eligible"
  | "watch"
  | "overheated"
  | "risk"
  | "neutral"
  | "insufficient_history";

const groupLabels = {
  eligible: "Eligible",
  watch: "Watch",
  overheated: "Overheated",
  risk: "Risk",
  neutral: "Neutral",
  insufficient_history: "Insufficient History",
} satisfies Record<SymbolResearchGroup, string>;

const actionLabels: Record<string, string> = {
  eligible: "Manual review",
  watch: "Review only",
  watch_caution: "Caution review",
  watch_low: "Low priority review",
  overheated: "Overheated review",
  risk: "Risk review",
  neutral: "Mixed research context",
  insufficient_history: "Not enough candles",
};

type CandleSummaryInput = {
  rows?: Array<{
    openTime?: number | string | null;
    close?: number | string | null;
    high?: number | string | null;
    low?: number | string | null;
  }>;
};

type RunContextInput = {
  isSelectedCurrentRun?: boolean | null;
  isNewerThanSelectedCurrentRun?: boolean | null;
  sourceRunIsLikelyFullUniverse?: boolean | null;
};

type TimeframeSnapshotInput = {
  timeframe?: string | null;
};

type TimeframeAvailabilitySignalInput = TimeframeSnapshotInput &
  RunContextInput & {
    resultGroup?: string | null;
    actionBias?: string | null;
    statusNoteKey?: string | null;
    statusNote?: string | null;
    rankScore?: number | null;
    scanTime?: string | null;
  };

type ResearchSummarySignalInput = RunContextInput & {
  resultGroup?: string | null;
  signalLabel?: string | null;
  actionBias?: string | null;
  primaryStructure?: string | null;
  rankScore?: number | null;
  opportunityScore?: number | null;
  confirmationScore?: number | null;
  riskScore?: number | null;
  detectedRiskTypes?: unknown;
  statusReasonKeys?: ScannerReviewText[] | null;
  statusReasons?: string[] | null;
  factors?: Record<string, unknown> | null;
  nextConfirmation?: unknown;
  invalidation?: unknown;
};

type ResearchDiagnosticsInput = {
  selectedTimeframe: string;
  currentSelection?: {
    selectedRunFinishedAt?: string | null;
    selectedSignalScanTime?: string | null;
    isLikelyFullUniverse?: boolean | null;
    fallbackUsed?: boolean | null;
  } | null;
  latestSignal?: RunContextInput | null;
  history?: RunContextInput[] | null;
};

export type SymbolResearchUnavailableReason =
  | "insufficient_history"
  | "not_in_selected_run"
  | "unknown";

export type SymbolResearchUnavailableInput = {
  symbol?: string | null;
  timeframe?: string | null;
  unavailableReason?: SymbolResearchUnavailableReason | string | null;
  message?: string | null;
  selectedRun?: {
    status?: string | null;
    timeframe?: string | null;
    symbolsTotal?: number | null;
    symbolsScanned?: number | null;
    symbolsSkipped?: number | null;
    signalsCreated?: number | null;
    finishedAt?: string | null;
    isLikelyFullUniverse?: boolean | null;
  } | null;
  symbolCoverage?: {
    timeframe?: string | null;
    candleCount?: number | null;
    requiredCandles?: number | null;
  } | null;
};

export type SymbolResearchUnavailableContent = {
  title: string;
  message: string;
  details: Array<{ label: string; value: string }>;
  suggestions: string[];
  isInsufficientHistory: boolean;
};

export type SymbolResearchTimeframeAvailabilityStatus =
  | "selected_available"
  | "available"
  | "selected_unavailable"
  | "unavailable"
  | "not_returned"
  | "planned";

export type SymbolResearchTimeframeAvailabilityRow = {
  timeframe: string;
  status: SymbolResearchTimeframeAvailabilityStatus;
  statusLabel: string;
  badgeLabel: string;
  isSelected: boolean;
  isDisabled: boolean;
  reason: string;
  candles: string;
  selectedRun: string;
  group: string;
  action: string;
  rank: string;
  scanTime: string;
  runContext: string;
};

export type SymbolResearchTimeframeNavigationStatus =
  | SymbolResearchTimeframeAvailabilityStatus
  | "selected"
  | "supported";

export type SymbolResearchTimeframeNavigationOption = {
  timeframe: string;
  status: SymbolResearchTimeframeNavigationStatus;
  badgeLabel: string;
  isSelected: boolean;
  isDisabled: boolean;
  reason: string;
};

export type SymbolResearchSummary = {
  stance: string;
  why: string[];
  nextConfirmation: string[];
  invalidation: string[];
  runBasis: string;
};

export type SymbolResearchDiagnostics = {
  rows: Array<{ label: string; value: string }>;
  notice: string;
  hasWarning: boolean;
};

type ResearchDecisionSignalInput = TimeframeSnapshotInput & {
  resultGroup?: string | null;
};

type ResearchDecisionBehaviorReadoutInput = {
  label?: string | null;
  sampleConfidenceLabel?: string | null;
  summaryText?: string | null;
};

type ResearchDecisionBehaviorDiagnosticsInput = {
  available?: boolean | null;
  reason?: string | null;
};

type ResearchDecisionSampleQualityInput = {
  sampleQualityLabel?: string | null;
  hygieneSummary?: string | null;
  hasVerySmallSample?: boolean | null;
  hasLimitedSample?: boolean | null;
  hasLimitedForwardCandles?: boolean | null;
  hasClusteredRuns?: boolean | null;
  hasNonPreferredRuns?: boolean | null;
};

export type ResearchDecisionPosture =
  | "Deeper research context"
  | "Manual review"
  | "Caution review"
  | "Risk review only"
  | "Insufficient data"
  | "Mixed context";

export type ResearchDecisionSummary = {
  summaryLabel: string;
  currentStance: string;
  multiTimeframeAlignment: string;
  behaviorSupport: string;
  confidenceNote: string;
  keyCaution: string;
  suggestedResearchPosture: ResearchDecisionPosture;
};

export type SignalEvaluationExpectedDirection =
  | "up"
  | "down"
  | "none"
  | "cautious";

export type SignalEvaluationSampleQuality =
  | "none"
  | "very_limited"
  | "limited"
  | "moderate"
  | "strong";

export type SignalEvaluationHorizonStats = {
  sampleSize?: number | null;
  avgReturnPct?: number | null;
  medianReturnPct?: number | null;
  positiveRatePct?: number | null;
  directionMatchRatePct?: number | null;
  bestReturnPct?: number | null;
  worstReturnPct?: number | null;
};

export type SignalEvaluationResponse = {
  ok?: boolean;
  filters?: {
    assetClass?: string | null;
    exchange?: string | null;
    market?: string | null;
    timeframe?: string | null;
    symbol?: string | null;
    group?: string | null;
    signalLabel?: string | null;
    primaryStructure?: string | null;
    setupType?: string | null;
    horizons?: number[] | null;
  } | null;
  sample?: {
    sourceSignals?: number | null;
    completedSignals?: number | null;
    skippedSignals?: number | null;
    sampleQuality?: SignalEvaluationSampleQuality | string | null;
    warnings?: string[] | null;
  } | null;
  expectedDirection?: SignalEvaluationExpectedDirection | string | null;
  horizons?: Record<string, SignalEvaluationHorizonStats | null | undefined> | null;
  interpretation?: {
    summary?: string | null;
    confidence?: string | null;
    researchOnly?: boolean | null;
  } | null;
};

export type SignalEvaluationReadout = {
  available: boolean;
  statusLabel: string;
  expectedDirectionLabel: string;
  sampleQualityLabel: string;
  sourceSignals: string;
  completedSignals: string;
  selectedHorizonLabel: string;
  medianReturn: string;
  directionMatchRate: string;
  positiveRate: string;
  mainInterpretation: string;
  warnings: string[];
  contradictionMessage: string | null;
};

type SignalEvaluationReadoutContext = {
  currentGroup?: string | null;
  currentSignalLabel?: string | null;
  timeframe?: string | null;
};

export function formatSymbolResearchScore(
  value: number | null | undefined,
  decimals = 1,
) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return value.toFixed(decimals);
}

export function formatSymbolResearchPrice(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  if (value >= 1000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  if (value >= 1) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  }

  return value.toLocaleString(undefined, {
    minimumSignificantDigits: 2,
    maximumSignificantDigits: 6,
  });
}

export function formatSymbolResearchDateTime(value: string | number | null | undefined) {
  return formatDisplayDateTime(value);
}

export function formatSymbolResearchGroup(value: string | null | undefined) {
  return isSymbolResearchGroup(value) ? groupLabels[value] : "Unknown";
}

export function formatSymbolResearchAction(value: string | null | undefined) {
  if (!value) {
    return "Review only";
  }

  const formattedReview = formatScannerReviewValue(value, dictionaries.en);

  if (formattedReview !== value) {
    return formattedReview;
  }

  if (Object.values(actionLabels).includes(value)) {
    return value;
  }

  return actionLabels[value] ?? toTitleCase(value);
}

export function formatSymbolResearchSetup(value: string | null | undefined) {
  return value ? toTitleCase(value) : "Unknown";
}

export function formatSymbolResearchList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? toTitleCase(item) : ""))
    .filter(Boolean);
}

export function getSymbolResearchScoreRows(scores: {
  rankScore?: number | null;
  finalSignalScore?: number | null;
  opportunityScore?: number | null;
  confirmationScore?: number | null;
  riskScore?: number | null;
  trendScore?: number | null;
  momentumScore?: number | null;
  volumeScore?: number | null;
  structureScore?: number | null;
}) {
  return [
    { label: "Rank", value: formatSymbolResearchScore(scores.rankScore) },
    { label: "Final Signal", value: formatSymbolResearchScore(scores.finalSignalScore) },
    { label: "Setup Score", value: formatSymbolResearchScore(scores.opportunityScore) },
    { label: "Confirmation", value: formatSymbolResearchScore(scores.confirmationScore) },
    { label: "Risk", value: formatSymbolResearchScore(scores.riskScore) },
    { label: "Trend", value: formatSymbolResearchScore(scores.trendScore) },
    { label: "Momentum", value: formatSymbolResearchScore(scores.momentumScore) },
    { label: "Volume", value: formatSymbolResearchScore(scores.volumeScore) },
    { label: "Structure", value: formatSymbolResearchScore(scores.structureScore) },
  ];
}

export function getSymbolResearchCandleSummary(candles: CandleSummaryInput) {
  const rows = candles.rows ?? [];
  const latestClose = toNullableFiniteNumber(rows[rows.length - 1]?.close);
  const highs = rows
    .map((row) => toNullableFiniteNumber(row.high))
    .filter((value): value is number => value !== null);
  const lows = rows
    .map((row) => toNullableFiniteNumber(row.low))
    .filter((value): value is number => value !== null);
  const high = highs.length > 0 ? Math.max(...highs) : null;
  const low = lows.length > 0 ? Math.min(...lows) : null;

  return {
    latestClose,
    recentHigh: Number.isFinite(high) ? high : null,
    recentLow: Number.isFinite(low) ? low : null,
  };
}

export function formatSymbolResearchRunContext(value: RunContextInput) {
  if (value.isSelectedCurrentRun) {
    return value.sourceRunIsLikelyFullUniverse === true
      ? "Selected full-universe run"
      : "Selected current run";
  }

  if (value.isNewerThanSelectedCurrentRun) {
    return value.sourceRunIsLikelyFullUniverse === false
      ? "Newer non-preferred run"
      : "Newer run";
  }

  if (value.sourceRunIsLikelyFullUniverse === true) {
    return "Full-universe run";
  }

  if (value.sourceRunIsLikelyFullUniverse === false) {
    return "Smaller/manual run";
  }

  return "Historical run";
}

export function hasNewerSymbolResearchHistoryRows(
  history: RunContextInput[] | null | undefined,
) {
  return Boolean(
    history?.some((item) => item.isNewerThanSelectedCurrentRun === true),
  );
}

export function getTimeframeSnapshotTitle(itemCount: number) {
  return itemCount <= 1 ? "Timeframe Snapshot" : "Multi-Timeframe Snapshot";
}

export function getTimeframeSnapshotNote(timeframes: TimeframeSnapshotInput[]) {
  const base =
    "Snapshot rows may use the selected full-universe signal for the requested timeframe and latest available full-universe signals for other timeframes.";
  const availabilityNote =
    "Unavailable or planned timeframes are omitted from this snapshot unless the API returns enough detail to explain them.";

  if (timeframes.length !== 1) {
    return `${base} ${availabilityNote}`;
  }

  const timeframe = timeframes[0]?.timeframe || "selected timeframe";
  return `Only ${timeframe} snapshot is currently available for this symbol. ${base} ${availabilityNote}`;
}

export function getSymbolResearchTimeframeSnapshots<T extends TimeframeSnapshotInput>({
  timeframes,
  latestSignal,
  requestedTimeframe,
}: {
  timeframes: T[];
  latestSignal: T | null | undefined;
  requestedTimeframe: string;
}) {
  const requested = requestedTimeframe.trim().toLowerCase();
  const selected =
    latestSignal?.timeframe?.toLowerCase() === requested ? latestSignal : null;

  if (!selected) {
    return [...timeframes];
  }

  return [
    selected,
    ...timeframes.filter((item) => item.timeframe?.toLowerCase() !== requested),
  ];
}

export function buildResearchDecisionSummary({
  selectedSignal,
  selectedTimeframe,
  timeframeSnapshots,
  behaviorReadout,
  behaviorDiagnostics,
  sampleQuality,
}: {
  selectedSignal?: ResearchDecisionSignalInput | null;
  selectedTimeframe?: string | null;
  timeframeSnapshots?: ResearchDecisionSignalInput[] | null;
  behaviorReadout?: ResearchDecisionBehaviorReadoutInput | null;
  behaviorDiagnostics?: ResearchDecisionBehaviorDiagnosticsInput | null;
  sampleQuality?: ResearchDecisionSampleQualityInput | null;
}): ResearchDecisionSummary {
  const group = normalizeResearchGroup(selectedSignal?.resultGroup);
  const timeframe =
    selectedTimeframe?.trim() || selectedSignal?.timeframe?.trim() || "selected timeframe";
  const mtfContext = getResearchDecisionMultiTimeframeContext({
    group,
    selectedTimeframe: timeframe,
    timeframeSnapshots,
  });
  const behaviorContext = getResearchDecisionBehaviorContext({
    behaviorReadout,
    behaviorDiagnostics,
    sampleQuality,
  });
  const suggestedResearchPosture = getResearchDecisionPosture({
    group,
    mtfContext,
    behaviorContext,
  });

  return {
    summaryLabel: getResearchDecisionSummaryLabel({
      group,
      mtfContext,
      behaviorContext,
    }),
    currentStance: `Selected ${timeframe} group is ${formatSymbolResearchGroup(group)}.`,
    multiTimeframeAlignment: mtfContext.text,
    behaviorSupport: behaviorContext.text,
    confidenceNote: getResearchDecisionConfidenceNote({
      behaviorContext,
      behaviorReadout,
      behaviorDiagnostics,
      sampleQuality,
    }),
    keyCaution: getResearchDecisionKeyCaution({
      group,
      mtfContext,
      behaviorContext,
      sampleQuality,
    }),
    suggestedResearchPosture,
  };
}

export function buildSignalEvaluationReadout(
  evaluation: SignalEvaluationResponse | null | undefined,
  context: SignalEvaluationReadoutContext = {},
): SignalEvaluationReadout {
  if (!evaluation || evaluation.ok !== true) {
    return unavailableSignalEvaluationReadout(
      "Signal evaluation is currently unavailable.",
    );
  }

  const horizons = evaluation.horizons ?? null;
  const sample = evaluation.sample ?? null;
  const selectedHorizon = selectSignalEvaluationHorizon(horizons);

  if (!horizons || !sample || selectedHorizon === null) {
    return unavailableSignalEvaluationReadout(
      "No completed broad-market signal evaluation sample is available yet.",
    );
  }

  const selectedStats = horizons[String(selectedHorizon)] ?? null;

  if (!selectedStats || toFiniteNumber(selectedStats.sampleSize) <= 0) {
    return unavailableSignalEvaluationReadout(
      "No completed broad-market signal evaluation sample is available yet.",
    );
  }

  const group = normalizeResearchGroup(
    evaluation.filters?.group ?? context.currentGroup,
  );
  const signalLabel =
    evaluation.filters?.signalLabel?.trim() ||
    context.currentSignalLabel?.trim() ||
    null;
  const expectedDirection = normalizeSignalEvaluationDirection(
    evaluation.expectedDirection,
  );
  const sampleQuality = normalizeSignalEvaluationSampleQuality(
    sample.sampleQuality,
  );
  const medianReturn = toNullableFiniteNumber(selectedStats.medianReturnPct);
  const avgReturn = toNullableFiniteNumber(selectedStats.avgReturnPct);
  const directionMatchRate = toNullableFiniteNumber(
    selectedStats.directionMatchRatePct,
  );
  const positiveRate = toNullableFiniteNumber(selectedStats.positiveRatePct);
  const status = getSignalEvaluationStatus({
    expectedDirection,
    medianReturn,
    directionMatchRate,
  });
  const isLimitedSample =
    sampleQuality === "very_limited" ||
    sampleQuality === "limited" ||
    toFiniteNumber(sample.completedSignals) < 10;
  const contradictionMessage = getSignalEvaluationContradiction({
    status,
    expectedDirection,
    group,
    signalLabel,
  });
  const statusLabel = getSignalEvaluationStatusLabel(status);
  const caveats = [
    isLimitedSample ? "Sample is limited; use as research context only." : null,
    group === "overheated" && avgReturn !== null && medianReturn !== null && avgReturn > 0 && medianReturn < 0
      ? "Median outcome leaned lower, while average was affected by large outliers."
      : null,
    contradictionMessage,
    evaluation.interpretation?.summary?.trim() || null,
  ].filter((item): item is string => Boolean(item));

  return {
    available: true,
    statusLabel,
    expectedDirectionLabel: formatSignalEvaluationDirection(expectedDirection),
    sampleQualityLabel: formatSignalEvaluationSampleQuality(sampleQuality),
    sourceSignals: formatNullableInteger(sample.sourceSignals),
    completedSignals: formatNullableInteger(sample.completedSignals),
    selectedHorizonLabel: `${selectedHorizon} candles`,
    medianReturn: formatSignalEvaluationReturn(medianReturn),
    directionMatchRate: formatSignalEvaluationRate(directionMatchRate),
    positiveRate: formatSignalEvaluationRate(positiveRate),
    mainInterpretation:
      caveats.length > 0 ? `${statusLabel}. ${caveats.join(" ")}` : statusLabel,
    warnings: formatSignalEvaluationWarnings(sample.warnings),
    contradictionMessage,
  };
}

export function buildSymbolResearchSummary(
  signal: ResearchSummarySignalInput,
): SymbolResearchSummary {
  return {
    stance: getResearchSummaryStance(signal),
    why: withResearchFallback(
      uniqueResearchBullets([
        ...(signal.statusReasons ?? []),
        ...getSetupBullets(signal),
        ...getScoreContextBullets(signal),
        ...getFactorBullets(signal.factors, ["risk", "bearish", "bullish", "neutral"]),
        ...getRiskTypeBullets(signal.detectedRiskTypes),
      ]).slice(0, 4),
      "Current grouping reflects the selected scanner classification.",
    ),
    nextConfirmation: withResearchFallback(
      uniqueResearchBullets(collectResearchText(signal.nextConfirmation)).slice(0, 3),
      "Watch for stronger confirmation before changing the research view.",
    ),
    invalidation: withResearchFallback(
      uniqueResearchBullets([
        ...collectResearchText(signal.invalidation),
        ...getRiskTypeBullets(signal.detectedRiskTypes),
      ]).slice(0, 3),
      "Reassess if risk flags increase or structure weakens.",
    ),
    runBasis: `Based on ${lowerFirst(formatSymbolResearchRunContext(signal))}`,
  };
}

export function buildSymbolResearchDiagnostics({
  selectedTimeframe,
  currentSelection,
  latestSignal,
  history,
}: ResearchDiagnosticsInput): SymbolResearchDiagnostics {
  const hasNewerSecondary = hasNewerSymbolResearchHistoryRows(history);
  const hasHistory = (history?.length ?? 0) > 0;
  const hasLatestSignal = Boolean(latestSignal);
  const notice = !hasLatestSignal && hasHistory
    ? "No selected current signal found; showing history only."
    : hasNewerSecondary
      ? "Newer secondary runs exist. Current classification uses selected full-universe run."
      : !hasHistory
        ? "No recent signal history available."
        : "Current classification uses the selected scanner run.";

  return {
    rows: [
      { label: "Selected Timeframe", value: selectedTimeframe || "Not available" },
      {
        label: "Full-Universe Run",
        value: currentSelection?.isLikelyFullUniverse ? "Yes" : "No",
      },
      {
        label: "Run Finished",
        value: formatSymbolResearchDateTime(currentSelection?.selectedRunFinishedAt),
      },
      {
        label: "Signal Scan Time",
        value: formatSymbolResearchDateTime(currentSelection?.selectedSignalScanTime),
      },
      {
        label: "Fallback Used",
        value: currentSelection?.fallbackUsed ? "Yes" : "No",
      },
    ],
    notice,
    hasWarning: hasNewerSecondary || (!hasLatestSignal && hasHistory),
  };
}

export function buildSymbolResearchUnavailableContent(
  input: SymbolResearchUnavailableInput,
): SymbolResearchUnavailableContent {
  const symbol = input.symbol?.trim() || "This symbol";
  const timeframe = input.timeframe?.trim() || "selected timeframe";
  const candleCount = input.symbolCoverage?.candleCount ?? null;
  const requiredCandles = input.symbolCoverage?.requiredCandles ?? null;
  const isInsufficientHistory =
    formatSymbolResearchUnavailableReason(input.unavailableReason).code ===
    "insufficient_history";
  const hasEnhancedUnavailableData = Boolean(
    input.unavailableReason || input.selectedRun || input.symbolCoverage,
  );
  const title = hasEnhancedUnavailableData
    ? "Timeframe unavailable for this symbol"
    : "No scanner signal available";
  const reason = formatSymbolResearchUnavailableReason(input.unavailableReason);
  const message =
    input.message?.trim() ||
    (isInsufficientHistory && candleCount !== null && requiredCandles !== null
      ? `No ${timeframe} scanner signal for ${symbol}. The selected scan ran successfully, but ${symbol} has only ${candleCount} candles and the scanner currently requires ${requiredCandles}.`
      : "No scanner signal is available for this symbol/timeframe from the selected latest run.");
  const details = [
    { label: "Symbol", value: symbol },
    { label: "Timeframe", value: timeframe },
    { label: "Reason", value: reason.label },
    {
      label: "Candles",
      value:
        candleCount === null
          ? "Not available"
          : requiredCandles === null
            ? String(candleCount)
            : formatSymbolResearchUnavailableCoverage({
                candleCount,
                requiredCandles,
              }),
    },
    {
      label: "Selected Run",
      value: formatSymbolResearchUnavailableSelectedRun(input.selectedRun),
    },
    {
      label: "Signals Created",
      value: formatNullableInteger(input.selectedRun?.signalsCreated),
    },
    {
      label: "Run Finished",
      value: formatSymbolResearchDateTime(input.selectedRun?.finishedAt),
    },
  ];

  return {
    title,
    message,
    details,
    suggestions: isInsufficientHistory
      ? [
          `Try 4h or 1d for ${symbol}.`,
          `Refresh after the next scanner run; ${timeframe} coverage updates as more ${toReadableTimeframeUnit(timeframe)} candles accrue.`,
        ]
      : [
          "Try 4h or 1d for this symbol.",
          "Refresh after the next scanner run if this timeframe should have coverage.",
        ],
    isInsufficientHistory,
  };
}

export function buildSymbolResearchTimeframeAvailability({
  timeframes,
  selectedTimeframe,
  signals = [],
  unavailable,
  plannedTimeframes = [],
}: {
  timeframes: readonly string[];
  selectedTimeframe: string;
  signals?: TimeframeAvailabilitySignalInput[];
  unavailable?: SymbolResearchUnavailableInput | null;
  plannedTimeframes?: readonly string[];
}): SymbolResearchTimeframeAvailabilityRow[] {
  const selected = selectedTimeframe.trim().toLowerCase();
  const planned = new Set(plannedTimeframes.map((timeframe) => timeframe.toLowerCase()));
  const signalByTimeframe = new Map(
    signals
      .filter((signal) => signal.timeframe)
      .map((signal) => [signal.timeframe?.toLowerCase() ?? "", signal]),
  );
  const unavailableTimeframe = unavailable?.timeframe?.trim().toLowerCase();
  const unavailableReason = formatSymbolResearchUnavailableReason(
    unavailable?.unavailableReason,
  );
  const hasUnavailablePayload = Boolean(
    unavailable &&
      (unavailable.unavailableReason ||
        unavailable.symbolCoverage ||
        unavailable.selectedRun),
  );

  return timeframes.map((timeframe) => {
    const key = timeframe.toLowerCase();
    const isSelected = key === selected;
    const signal = signalByTimeframe.get(key);
    const isPlanned = planned.has(key);
    const isSelectedUnavailable =
      isSelected &&
      hasUnavailablePayload &&
      (!unavailableTimeframe || unavailableTimeframe === key);

    if (isPlanned) {
      return buildTimeframeAvailabilityRow({
        timeframe,
        status: "planned",
        isSelected,
        reason: "No production scanner run is available for this timeframe yet.",
      });
    }

    if (signal) {
      return buildTimeframeAvailabilityRow({
        timeframe,
        status: isSelected ? "selected_available" : "available",
        isSelected,
        signal,
      });
    }

    if (isSelectedUnavailable) {
      return buildTimeframeAvailabilityRow({
        timeframe,
        status: "selected_unavailable",
        isSelected,
        unavailable,
        reason: unavailableReason.label,
      });
    }

    return buildTimeframeAvailabilityRow({
      timeframe,
      status: "not_returned",
      isSelected,
      reason: "No latest signal was returned for this timeframe.",
    });
  });
}

export function buildSymbolResearchTimeframeNavigation({
  timeframes,
  selectedTimeframe,
  availabilityRows = [],
  plannedTimeframes = [],
}: {
  timeframes: readonly string[];
  selectedTimeframe: string;
  availabilityRows?: readonly SymbolResearchTimeframeAvailabilityRow[];
  plannedTimeframes?: readonly string[];
}): SymbolResearchTimeframeNavigationOption[] {
  const selected = selectedTimeframe.trim().toLowerCase();
  const planned = new Set(plannedTimeframes.map((timeframe) => timeframe.toLowerCase()));
  const availabilityByTimeframe = new Map(
    availabilityRows.map((row) => [row.timeframe.toLowerCase(), row]),
  );

  return timeframes.map((timeframe) => {
    const key = timeframe.toLowerCase();
    const isSelected = key === selected;
    const availability = availabilityByTimeframe.get(key);

    if (availability) {
      return {
        timeframe,
        status: availability.status,
        badgeLabel:
          availability.status === "not_returned"
            ? isSelected
              ? "Selected"
              : "Supported"
            : availability.badgeLabel,
        isSelected,
        isDisabled: availability.isDisabled,
        reason: availability.reason,
      };
    }

    if (planned.has(key)) {
      return {
        timeframe,
        status: "planned",
        badgeLabel: "Planned",
        isSelected,
        isDisabled: true,
        reason: "No production scanner run is available for this timeframe yet.",
      };
    }

    return {
      timeframe,
      status: isSelected ? "selected" : "supported",
      badgeLabel: isSelected ? "Selected" : "Supported",
      isSelected,
      isDisabled: false,
      reason: "Production scanner supports this timeframe.",
    };
  });
}

export function formatSymbolResearchUnavailableReason(
  value: SymbolResearchUnavailableInput["unavailableReason"],
) {
  switch (value) {
    case "insufficient_history":
      return {
        code: "insufficient_history" as const,
        label: "Insufficient history",
      };
    case "not_in_selected_run":
      return {
        code: "not_in_selected_run" as const,
        label: "Not in selected run",
      };
    case "unknown":
    default:
      return {
        code: "unknown" as const,
        label: "Unknown",
      };
  }
}

export function formatSymbolResearchUnavailableSelectedRun(
  selectedRun: SymbolResearchUnavailableInput["selectedRun"],
) {
  if (!selectedRun) {
    return "No selected run";
  }

  const timeframe = selectedRun.timeframe ? `${selectedRun.timeframe} ` : "";
  const runType = selectedRun.isLikelyFullUniverse
    ? "full-universe"
    : "selected";
  const status = selectedRun.status ? toTitleCase(selectedRun.status) : "Unknown";
  const scanned = formatNullableInteger(selectedRun.symbolsScanned);
  const total = formatNullableInteger(selectedRun.symbolsTotal);
  const skipped = formatNullableInteger(selectedRun.symbolsSkipped);

  return `${timeframe}${runType} run, ${status.toLowerCase()}, scanned ${scanned} / ${total}, skipped ${skipped}`;
}

export function formatSymbolResearchUnavailableCoverage({
  candleCount,
  requiredCandles,
}: {
  candleCount?: number | null;
  requiredCandles?: number | null;
}) {
  if (typeof candleCount !== "number" || !Number.isFinite(candleCount)) {
    return "Not available";
  }

  if (
    typeof requiredCandles !== "number" ||
    !Number.isFinite(requiredCandles)
  ) {
    return String(candleCount);
  }

  return `${candleCount} / ${requiredCandles} required`;
}

function buildTimeframeAvailabilityRow({
  timeframe,
  status,
  isSelected,
  signal,
  unavailable,
  reason,
}: {
  timeframe: string;
  status: SymbolResearchTimeframeAvailabilityStatus;
  isSelected: boolean;
  signal?: TimeframeAvailabilitySignalInput;
  unavailable?: SymbolResearchUnavailableInput | null;
  reason?: string;
}): SymbolResearchTimeframeAvailabilityRow {
  const isAvailable = status === "available" || status === "selected_available";
  const isPlanned = status === "planned";
  const isNotReturned = status === "not_returned";
  const selectedRun = unavailable?.selectedRun;
  const coverage = unavailable?.symbolCoverage;

  return {
    timeframe,
    status,
    statusLabel: getTimeframeAvailabilityStatusLabel(status),
    badgeLabel: getTimeframeAvailabilityBadgeLabel(status, reason),
    isSelected,
    isDisabled: isPlanned,
    reason: reason ?? (isAvailable ? "Available" : "Unavailable"),
    candles: coverage
      ? formatSymbolResearchUnavailableCoverage(coverage)
      : isAvailable
        ? "Covered"
        : isNotReturned
          ? "Not returned"
          : "Not available",
    selectedRun: selectedRun
      ? formatSymbolResearchUnavailableSelectedRun(selectedRun)
      : isAvailable && signal
        ? formatSymbolResearchRunContext(signal)
        : isPlanned
          ? "Not configured"
          : isNotReturned
            ? "Open timeframe to check"
            : "Not available",
    group: signal ? formatSymbolResearchGroup(signal.resultGroup) : "-",
    action: signal
      ? formatSymbolResearchAction(
          signal.actionBias ?? signal.statusNoteKey ?? signal.statusNote,
        )
      : "-",
    rank: signal ? formatSymbolResearchScore(signal.rankScore) : "-",
    scanTime: signal ? formatSymbolResearchDateTime(signal.scanTime) : "-",
    runContext: signal ? formatSymbolResearchRunContext(signal) : "-",
  };
}

function getTimeframeAvailabilityStatusLabel(
  status: SymbolResearchTimeframeAvailabilityStatus,
) {
  switch (status) {
    case "selected_available":
    case "available":
      return "Available";
    case "selected_unavailable":
    case "unavailable":
      return "Unavailable";
    case "not_returned":
      return "Not returned";
    case "planned":
      return "Planned / Not configured";
  }
}

function getTimeframeAvailabilityBadgeLabel(
  status: SymbolResearchTimeframeAvailabilityStatus,
  reason?: string,
) {
  switch (status) {
    case "selected_available":
      return "Selected";
    case "available":
      return "Available";
    case "selected_unavailable":
      return reason === "Insufficient history" ? "Insufficient history" : "Unavailable";
    case "unavailable":
      return "Unavailable";
    case "not_returned":
      return "Not returned";
    case "planned":
      return "Planned";
  }
}

function toReadableTimeframeUnit(timeframe: string) {
  switch (timeframe) {
    case "1w":
      return "weekly";
    case "1d":
      return "daily";
    case "4h":
      return "4h";
    case "1h":
      return "hourly";
    default:
      return timeframe;
  }
}

export function toTitleCase(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function formatNullableInteger(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "Not available";
}

function unavailableSignalEvaluationReadout(
  message: string,
): SignalEvaluationReadout {
  return {
    available: false,
    statusLabel: "Unavailable",
    expectedDirectionLabel: "Not available",
    sampleQualityLabel: "No completed sample",
    sourceSignals: "0",
    completedSignals: "0",
    selectedHorizonLabel: "Not available",
    medianReturn: "-",
    directionMatchRate: "-",
    positiveRate: "-",
    mainInterpretation: message,
    warnings: [],
    contradictionMessage: null,
  };
}

function selectSignalEvaluationHorizon(
  horizons: SignalEvaluationResponse["horizons"],
) {
  if (!horizons) {
    return null;
  }

  for (const horizon of ["5", "3", "1"]) {
    if (toFiniteNumber(horizons[horizon]?.sampleSize) > 0) {
      return Number(horizon);
    }
  }

  const firstCompleted = Object.entries(horizons)
    .map(([key, stats]) => ({
      horizon: Number(key),
      sampleSize: toFiniteNumber(stats?.sampleSize),
    }))
    .filter((item) => Number.isFinite(item.horizon) && item.sampleSize > 0)
    .sort((left, right) => left.horizon - right.horizon)[0];

  return firstCompleted?.horizon ?? null;
}

function getSignalEvaluationStatus({
  expectedDirection,
  medianReturn,
  directionMatchRate,
}: {
  expectedDirection: SignalEvaluationExpectedDirection;
  medianReturn: number | null;
  directionMatchRate: number | null;
}) {
  if (expectedDirection === "up" || expectedDirection === "cautious") {
    if (
      directionMatchRate !== null &&
      medianReturn !== null &&
      directionMatchRate >= 55 &&
      medianReturn > 0
    ) {
      return "supportive_up" as const;
    }

    if (
      (directionMatchRate !== null && directionMatchRate < 45) ||
      (medianReturn !== null && medianReturn < 0)
    ) {
      return "not_supportive_up" as const;
    }

    return "mixed" as const;
  }

  if (expectedDirection === "down") {
    if (
      directionMatchRate !== null &&
      medianReturn !== null &&
      directionMatchRate >= 55 &&
      medianReturn < 0
    ) {
      return "supportive_down" as const;
    }

    if (
      (directionMatchRate !== null && directionMatchRate < 45) ||
      (medianReturn !== null && medianReturn > 0)
    ) {
      return "not_supportive_down" as const;
    }

    return "mixed" as const;
  }

  return "mixed" as const;
}

function getSignalEvaluationStatusLabel(
  status: ReturnType<typeof getSignalEvaluationStatus>,
) {
  switch (status) {
    case "supportive_up":
      return "Historically supportive";
    case "not_supportive_up":
      return "Historically not supportive";
    case "supportive_down":
      return "Risk follow-through observed";
    case "not_supportive_down":
      return "Risk follow-through not supported";
    case "mixed":
      return "Mixed historical follow-through";
  }
}

function getSignalEvaluationContradiction({
  status,
  expectedDirection,
  group,
  signalLabel,
}: {
  status: ReturnType<typeof getSignalEvaluationStatus>;
  expectedDirection: SignalEvaluationExpectedDirection;
  group: SymbolResearchGroup;
  signalLabel: string | null;
}) {
  const normalizedLabel = signalLabel?.toLowerCase() ?? "";
  const isBullishLabel =
    expectedDirection === "up" ||
    group === "eligible" ||
    normalizedLabel === "confirmed" ||
    normalizedLabel === "trend";
  const isRiskLabel =
    group === "risk" ||
    normalizedLabel === "breakdown_risk" ||
    normalizedLabel === "distribution_risk";

  if (isBullishLabel && status === "not_supportive_up") {
    return "Historical evaluation does not support this bullish label in the current sample.";
  }

  if (isRiskLabel && status === "supportive_down") {
    return "Historical evaluation supports caution for this risk label.";
  }

  return null;
}

function normalizeSignalEvaluationDirection(
  value: string | null | undefined,
): SignalEvaluationExpectedDirection {
  if (
    value === "up" ||
    value === "down" ||
    value === "none" ||
    value === "cautious"
  ) {
    return value;
  }

  return "none";
}

function normalizeSignalEvaluationSampleQuality(
  value: string | null | undefined,
): SignalEvaluationSampleQuality {
  if (
    value === "none" ||
    value === "very_limited" ||
    value === "limited" ||
    value === "moderate" ||
    value === "strong"
  ) {
    return value;
  }

  return "none";
}

function formatSignalEvaluationDirection(
  value: SignalEvaluationExpectedDirection,
) {
  switch (value) {
    case "up":
      return "Up";
    case "down":
      return "Down";
    case "cautious":
      return "Cautious / up";
    case "none":
      return "No directional edge";
  }
}

function formatSignalEvaluationSampleQuality(
  value: SignalEvaluationSampleQuality,
) {
  switch (value) {
    case "none":
      return "No completed sample";
    case "very_limited":
      return "Very limited";
    case "limited":
      return "Limited";
    case "moderate":
      return "Moderate";
    case "strong":
      return "Strong";
  }
}

function formatSignalEvaluationReturn(value: number | null) {
  if (value === null) {
    return "-";
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatSignalEvaluationRate(value: number | null) {
  return value === null ? "-" : `${value.toFixed(1)}%`;
}

function formatSignalEvaluationWarnings(value: string[] | null | undefined) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((warning) => {
      switch (warning) {
        case "missing_future_candles":
          return "Some recent signals do not have enough future candles yet.";
        case "insufficient_completed_horizons":
          return "Longer horizons are still incomplete.";
        case "limited_sample":
        case "very_limited_sample":
          return "Sample is limited.";
        case "symbol_filtered_sample":
          return "Symbol-filtered sample is limited.";
        case "one_hour_history_still_accumulating":
          return "1h production history is still accumulating.";
        case "neutral_has_no_directional_edge":
          return "Neutral samples have no directional edge.";
        default:
          return toTitleCase(warning);
      }
    })
    .filter(Boolean);
}

function toFiniteNumber(value: unknown) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function isSymbolResearchGroup(value: unknown): value is SymbolResearchGroup {
  return (
    value === "eligible" ||
    value === "watch" ||
    value === "overheated" ||
    value === "risk" ||
    value === "neutral" ||
    value === "insufficient_history"
  );
}

type ResearchDecisionMultiTimeframeContext = {
  status: "aligned_positive" | "higher_timeframe_caution" | "broad_risk" | "mixed" | "unavailable";
  text: string;
  hasHigherTimeframeRisk: boolean;
};

type ResearchDecisionBehaviorContext = {
  status: "supportive" | "cautionary" | "insufficient" | "mixed" | "unavailable";
  text: string;
};

function normalizeResearchGroup(value: string | null | undefined): SymbolResearchGroup {
  return isSymbolResearchGroup(value) ? value : "neutral";
}

function getResearchDecisionMultiTimeframeContext({
  group,
  selectedTimeframe,
  timeframeSnapshots,
}: {
  group: SymbolResearchGroup;
  selectedTimeframe: string;
  timeframeSnapshots?: ResearchDecisionSignalInput[] | null;
}): ResearchDecisionMultiTimeframeContext {
  const rows = Array.isArray(timeframeSnapshots) ? timeframeSnapshots : [];

  if (rows.length <= 1) {
    return {
      status: "unavailable",
      text: "Multi-timeframe context is unavailable.",
      hasHigherTimeframeRisk: false,
    };
  }

  const selected = selectedTimeframe.trim().toLowerCase();
  const higherRiskRows = rows.filter((row) => {
    const timeframe = row.timeframe?.trim().toLowerCase();
    return (
      timeframe !== selected &&
      isHigherDecisionTimeframe(timeframe) &&
      normalizeResearchGroup(row.resultGroup) === "risk"
    );
  });
  const hasHigherTimeframeRisk = higherRiskRows.length > 0;

  if (group === "risk" && hasHigherTimeframeRisk) {
    return {
      status: "broad_risk",
      text: "Broad risk: selected timeframe and higher timeframe include risk context.",
      hasHigherTimeframeRisk,
    };
  }

  if (hasHigherTimeframeRisk) {
    return {
      status: "higher_timeframe_caution",
      text: "Higher-timeframe caution: 1d or 1w includes risk context.",
      hasHigherTimeframeRisk,
    };
  }

  if (group === "eligible" || group === "watch") {
    return {
      status: "aligned_positive",
      text: "Aligned positive: higher timeframes are not in risk context.",
      hasHigherTimeframeRisk,
    };
  }

  return {
    status: "mixed",
    text: "Mixed multi-timeframe context.",
    hasHigherTimeframeRisk,
  };
}

function isHigherDecisionTimeframe(value: string | null | undefined) {
  return value === "1d" || value === "1w";
}

function getResearchDecisionBehaviorContext({
  behaviorReadout,
  behaviorDiagnostics,
  sampleQuality,
}: {
  behaviorReadout?: ResearchDecisionBehaviorReadoutInput | null;
  behaviorDiagnostics?: ResearchDecisionBehaviorDiagnosticsInput | null;
  sampleQuality?: ResearchDecisionSampleQualityInput | null;
}): ResearchDecisionBehaviorContext {
  if (!behaviorReadout || behaviorDiagnostics?.available === false) {
    return {
      status: "unavailable",
      text: "Historical behavior context is unavailable.",
    };
  }

  const label = behaviorReadout.label ?? "";

  if (label === "Insufficient sample" || sampleQuality?.hasVerySmallSample) {
    return {
      status: "insufficient",
      text: "Historical behavior sample is insufficient.",
    };
  }

  if (label === "Downside continuation tendency") {
    return {
      status: "cautionary",
      text: "Cautionary: prior similar risk signals tended to continue lower in this sample.",
    };
  }

  if (label === "Weak follow-through") {
    return {
      status: "cautionary",
      text: "Cautionary: prior similar signals did not consistently follow through in this sample.",
    };
  }

  if (
    label === "Constructive tendency" ||
    label === "Strong constructive tendency"
  ) {
    return {
      status: "supportive",
      text: "Supportive: prior similar signals showed constructive follow-through in this sample.",
    };
  }

  return {
    status: "mixed",
    text: "Mixed: historical follow-through is not clearly aligned.",
  };
}

function getResearchDecisionPosture({
  group,
  mtfContext,
  behaviorContext,
}: {
  group: SymbolResearchGroup;
  mtfContext: ResearchDecisionMultiTimeframeContext;
  behaviorContext: ResearchDecisionBehaviorContext;
}): ResearchDecisionPosture {
  switch (group) {
    case "risk":
      return mtfContext.status === "broad_risk" ||
        behaviorContext.status === "cautionary"
        ? "Risk review only"
        : "Caution review";
    case "eligible":
      return mtfContext.hasHigherTimeframeRisk ||
        behaviorContext.status === "cautionary"
        ? "Manual review"
        : "Deeper research context";
    case "watch":
      return "Manual review";
    case "overheated":
      return "Caution review";
    case "insufficient_history":
    case "neutral":
      return "Insufficient data";
    default:
      return "Mixed context";
  }
}

function getResearchDecisionSummaryLabel({
  group,
  mtfContext,
  behaviorContext,
}: {
  group: SymbolResearchGroup;
  mtfContext: ResearchDecisionMultiTimeframeContext;
  behaviorContext: ResearchDecisionBehaviorContext;
}) {
  if (group === "risk" && behaviorContext.status === "cautionary") {
    return "Risk context reinforced";
  }

  if (group === "risk") {
    return "Risk context";
  }

  if (group === "eligible" && mtfContext.hasHigherTimeframeRisk) {
    return "Higher-timeframe caution";
  }

  if (group === "eligible" && behaviorContext.status === "supportive") {
    return "Constructive research context";
  }

  if (group === "eligible") {
    return "Research context";
  }

  if (group === "watch") {
    return "Watch context";
  }

  if (group === "overheated") {
    return "Overheated caution";
  }

  return "Mixed research context";
}

function getResearchDecisionConfidenceNote({
  behaviorContext,
  behaviorReadout,
  behaviorDiagnostics,
  sampleQuality,
}: {
  behaviorContext: ResearchDecisionBehaviorContext;
  behaviorReadout?: ResearchDecisionBehaviorReadoutInput | null;
  behaviorDiagnostics?: ResearchDecisionBehaviorDiagnosticsInput | null;
  sampleQuality?: ResearchDecisionSampleQualityInput | null;
}) {
  if (sampleQuality?.sampleQualityLabel && sampleQuality.hygieneSummary) {
    return `${sampleQuality.sampleQualityLabel}: ${sampleQuality.hygieneSummary}`;
  }

  if (behaviorDiagnostics?.available === false) {
    return "Historical behavior context is unavailable.";
  }

  if (behaviorContext.status === "insufficient") {
    return "Historical behavior sample is insufficient.";
  }

  return behaviorReadout?.sampleConfidenceLabel
    ? `Behavior sample confidence: ${behaviorReadout.sampleConfidenceLabel}.`
    : "Behavior sample quality is not available.";
}

function getResearchDecisionKeyCaution({
  group,
  mtfContext,
  behaviorContext,
  sampleQuality,
}: {
  group: SymbolResearchGroup;
  mtfContext: ResearchDecisionMultiTimeframeContext;
  behaviorContext: ResearchDecisionBehaviorContext;
  sampleQuality?: ResearchDecisionSampleQualityInput | null;
}) {
  if (mtfContext.status === "broad_risk") {
    return "Risk context appears on multiple timeframes.";
  }

  if (mtfContext.hasHigherTimeframeRisk) {
    return "Higher-timeframe risk is present.";
  }

  if (group === "risk") {
    return "Risk context is elevated; repair should be reviewed before deeper research.";
  }

  if (group === "watch") {
    return "Confirmation is still needed.";
  }

  if (group === "overheated") {
    return "Overextension risk is elevated.";
  }

  if (
    sampleQuality?.hasVerySmallSample ||
    behaviorContext.status === "insufficient" ||
    behaviorContext.status === "unavailable"
  ) {
    return "Historical behavior context is limited.";
  }

  if (sampleQuality?.hasNonPreferredRuns) {
    return "Some observations may include non-selected or secondary runs.";
  }

  if (sampleQuality?.hasClusteredRuns) {
    return "Clustered recent observations are present.";
  }

  return "Treat this as research context, not a conclusion.";
}

function getResearchSummaryStance(signal: ResearchSummarySignalInput) {
  switch (signal.resultGroup) {
    case "eligible":
      return "Manual review context";
    case "watch":
      return "Confirmation review";
    case "overheated":
      return "Overheated review";
    case "risk":
      return "Risk review";
    case "insufficient_history":
      return "Not enough history";
    case "neutral":
    default:
      return "Mixed research context";
  }
}

function getFactorBullets(
  factors: Record<string, unknown> | null | undefined,
  keys: string[],
) {
  if (!factors) {
    return [];
  }

  return keys.flatMap((key) => collectResearchText(factors[key]));
}

function getRiskTypeBullets(value: unknown) {
  return collectResearchText(value).map((item) =>
    item.toLowerCase().includes("risk") ? item : `${item} risk noted`,
  );
}

function getSetupBullets(signal: ResearchSummarySignalInput) {
  return signal.primaryStructure
    ? [`Setup type: ${toTitleCase(signal.primaryStructure)}`]
    : [];
}

function getScoreContextBullets(signal: ResearchSummarySignalInput) {
  const scores = [
    ["Rank", signal.rankScore],
    ["Setup Score", signal.opportunityScore],
    ["Confirmation", signal.confirmationScore],
    ["Risk", signal.riskScore],
  ]
    .filter((item): item is [string, number] => typeof item[1] === "number")
    .map(([label, value]) => `${label} ${formatSymbolResearchScore(value)}`);

  return scores.length > 0 ? [`Scores: ${scores.join(", ")}`] : [];
}

function collectResearchText(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectResearchText);
  }

  return [];
}

function uniqueResearchBullets(values: string[]) {
  const seen = new Set<string>();
  const bullets: string[] = [];

  for (const value of values) {
    const next = normalizeResearchBullet(value);
    const key = next.toLowerCase();

    if (next && !seen.has(key)) {
      seen.add(key);
      bullets.push(next);
    }
  }

  return bullets;
}

function normalizeResearchBullet(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  const readable =
    /^[a-z0-9_-]+$/i.test(trimmed) && /[_-]/.test(trimmed)
      ? toTitleCase(trimmed)
      : trimmed;

  return sanitizeResearchLanguage(readable);
}

function sanitizeResearchLanguage(value: string) {
  return value
    .replace(/\bbuy\b/gi, "directional action")
    .replace(/\bsell\b/gi, "risk reduction")
    .replace(/\blong\b/gi, "directional")
    .replace(/\bshort\b/gi, "inverse")
    .replace(/\bentry\b/gi, "trigger")
    .replace(/\bexit\b/gi, "invalidation")
    .replace(/\btarget\b/gi, "objective")
    .replace(/\btake[-\s]?profit\b/gi, "objective")
    .replace(/\bstop[-\s]?loss\b/gi, "risk boundary");
}

function withResearchFallback(values: string[], fallback: string) {
  return values.length > 0 ? values : [fallback];
}

function lowerFirst(value: string) {
  return value ? value.charAt(0).toLowerCase() + value.slice(1) : value;
}

function toNullableFiniteNumber(value: unknown) {
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}
