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
  overheated: "Do not chase",
  risk: "Avoid or wait for repair",
  neutral: "No clear edge",
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
  if (value === null || value === undefined || value === "") {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatSymbolResearchGroup(value: string | null | undefined) {
  return isSymbolResearchGroup(value) ? groupLabels[value] : "Unknown";
}

export function formatSymbolResearchAction(value: string | null | undefined) {
  if (!value) {
    return "Review only";
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
    { label: "Opportunity", value: formatSymbolResearchScore(scores.opportunityScore) },
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
  plannedTimeframes = ["1h"],
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
  plannedTimeframes = ["1h"],
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
      ? formatSymbolResearchAction(signal.actionBias ?? signal.statusNote)
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

function getResearchSummaryStance(signal: ResearchSummarySignalInput) {
  switch (signal.resultGroup) {
    case "eligible":
      return "Manual review candidate";
    case "watch":
      return "Watch for confirmation";
    case "overheated":
      return "Do not chase";
    case "risk":
      return "Risk / wait for repair";
    case "insufficient_history":
      return "Not enough history";
    case "neutral":
    default:
      return "No clear edge";
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
    ["Opportunity", signal.opportunityScore],
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
