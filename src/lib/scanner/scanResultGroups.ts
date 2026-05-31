export const SCAN_RESULT_GROUPS = [
  "eligible",
  "watch",
  "overheated",
  "risk",
  "neutral",
  "insufficient_history",
] as const;

export type ScanResultGroup = (typeof SCAN_RESULT_GROUPS)[number];

export const SCAN_RESULT_REVIEW_TIERS = [
  "eligible",
  "watch_high",
  "watch_caution",
  "watch_low",
  "overheated",
  "risk",
  "neutral",
  "insufficient_history",
] as const;

export type ScanResultReviewTier = (typeof SCAN_RESULT_REVIEW_TIERS)[number];

export type ScanResultCautionLevel = "none" | "caution" | "low";

export type ScanResultGroupInput = {
  signalLabel?: string | null;
  actionBias?: string | null;
  primaryStructure?: string | null;
  rankScore?: number | null;
  riskScore?: number | null;
  detectedRiskTypes?: unknown[] | null;
};

export type ScanResultReview = {
  reviewTier: ScanResultReviewTier;
  statusNote: string;
  cautionLevel: ScanResultCautionLevel;
  statusReasons: string[];
};

export type ScanResultGroupSummary = Record<ScanResultGroup, number> & {
  totalSignals: number;
  confirmed: number;
  trend: number;
  watchSignals: number;
  neutralSignals: number;
  overheatedSignals: number;
  breakdownRisk: number;
  distributionRisk: number;
  avoid: number;
  eligibleSignals: number;
  doNotChase: number;
};

const DISPLAY_GROUP_ORDER: Record<ScanResultGroup, number> = {
  eligible: 0,
  watch: 1,
  overheated: 2,
  risk: 3,
  neutral: 4,
  insufficient_history: 5,
};

const WATCH_REVIEW_TIER_ORDER: Partial<Record<ScanResultReviewTier, number>> = {
  watch_high: 0,
  watch_low: 1,
  watch_caution: 2,
};

const WATCH_CLOSE_RANK_DELTA = 5;

export function classifyScanResultGroup(
  signal: ScanResultGroupInput,
): ScanResultGroup {
  const actionBias = signal.actionBias ?? "";
  const signalLabel = signal.signalLabel ?? "";
  const primaryStructure = signal.primaryStructure ?? "";
  const rankScore = signal.rankScore ?? Number.NEGATIVE_INFINITY;
  const hasDetectedRisks = hasAnyDetectedRiskType(signal, [
    "overheat_risk",
    "weak_bounce_risk",
    "distribution_risk",
    "trend_breakdown_risk",
    "liquidity_spike_risk",
    "failed_breakout_risk",
  ]);

  if (
    actionBias === "avoid" ||
    signalLabel === "breakdown_risk" ||
    signalLabel === "distribution_risk" ||
    primaryStructure === "trend_breakdown" ||
    primaryStructure === "distribution_risk" ||
    hasAnyDetectedRiskType(signal, [
      "distribution_risk",
      "trend_breakdown_risk",
      "liquidity_spike_risk",
      "failed_breakout_risk",
    ])
  ) {
    return "risk";
  }

  if (
    actionBias === "do_not_chase" ||
    signalLabel === "overheated" ||
    primaryStructure === "overextended"
  ) {
    return "overheated";
  }

  if (
    actionBias === "eligible" &&
    (signalLabel === "confirmed" || signalLabel === "trend") &&
    rankScore > 0 &&
    primaryStructure !== "" &&
    primaryStructure !== "neutral" &&
    !hasDetectedRisks
  ) {
    return "eligible";
  }

  if (
    actionBias === "eligible" &&
    (signalLabel === "confirmed" || signalLabel === "trend" || rankScore > 0)
  ) {
    return "watch";
  }

  if (
    actionBias === "watch_only" ||
    signalLabel === "watch" ||
    signalLabel === "weak_bounce"
  ) {
    return "watch";
  }

  return "neutral";
}

export function getScanResultReview(
  signal: ScanResultGroupInput & { resultGroup?: ScanResultGroup },
): ScanResultReview {
  const resultGroup = signal.resultGroup ?? classifyScanResultGroup(signal);
  const rankScore = signal.rankScore ?? Number.NEGATIVE_INFINITY;
  const primaryStructure = signal.primaryStructure ?? "";
  const detectedRiskLabels = getDetectedRiskLabels(signal);

  if (resultGroup === "eligible") {
    return {
      reviewTier: "eligible",
      statusNote: "Manual review",
      cautionLevel: "none",
      statusReasons: [
        "Clean candidate: positive rank, confirmed/trend signal, clear setup type, and no detected risks.",
      ],
    };
  }

  if (resultGroup === "risk") {
    return {
      reviewTier: "risk",
      statusNote: "Avoid",
      cautionLevel: "caution",
      statusReasons: ["Risk group has priority over opportunity score."],
    };
  }

  if (resultGroup === "overheated") {
    return {
      reviewTier: "overheated",
      statusNote: "Do not chase",
      cautionLevel: "caution",
      statusReasons: ["Overheated state has priority over opportunity score."],
    };
  }

  if (resultGroup === "neutral") {
    return {
      reviewTier: "neutral",
      statusNote: "No clear edge",
      cautionLevel: "none",
      statusReasons: ["Neutral group means no clear edge is present."],
    };
  }

  if (resultGroup === "insufficient_history") {
    return {
      reviewTier: "insufficient_history",
      statusNote: "Not enough candles",
      cautionLevel: "low",
      statusReasons: ["Not enough candles for a full scanner read."],
    };
  }

  if (detectedRiskLabels.length > 0) {
    return {
      reviewTier: "watch_caution",
      statusNote: "Caution",
      cautionLevel: "caution",
      statusReasons: [
        `Caution: detected ${detectedRiskLabels.join(", ")}, so this is not treated as a clean eligible candidate.`,
        ...getWatchLowPriorityReasons({ rankScore, primaryStructure }),
      ],
    };
  }

  const lowPriorityReasons = getWatchLowPriorityReasons({
    rankScore,
    primaryStructure,
  });

  if (lowPriorityReasons.length > 0) {
    return {
      reviewTier: "watch_low",
      statusNote: "Low priority",
      cautionLevel: "low",
      statusReasons: lowPriorityReasons,
    };
  }

  return {
    reviewTier: "watch_high",
    statusNote: "Needs confirmation",
    cautionLevel: "none",
    statusReasons: [
      "Needs confirmation: positive rank with a meaningful setup, but eligible rules are not fully met.",
    ],
  };
}

function hasAnyDetectedRiskType(
  signal: ScanResultGroupInput,
  riskTypes: string[],
) {
  const detectedRiskTypes = signal.detectedRiskTypes ?? [];

  return detectedRiskTypes.some(
    (riskType) => typeof riskType === "string" && riskTypes.includes(riskType),
  );
}

function getDetectedRiskLabels(signal: ScanResultGroupInput) {
  const detectedRiskTypes = signal.detectedRiskTypes ?? [];

  return detectedRiskTypes
    .map((riskType) =>
      typeof riskType === "string" ? riskType.replace(/_/g, " ") : "",
    )
    .filter(Boolean);
}

function getWatchLowPriorityReasons({
  rankScore,
  primaryStructure,
}: {
  rankScore: number;
  primaryStructure: string;
}) {
  const reasons: string[] = [];

  if (rankScore < 0) {
    reasons.push("Low priority watch because rank score is below zero.");
  }

  if (primaryStructure === "" || primaryStructure === "neutral") {
    reasons.push("Neutral setup type prevents clean eligible classification.");
  }

  return reasons;
}

export function compareScanResultGroupItems<
  T extends ScanResultGroupInput & { resultGroup?: ScanResultGroup; symbol?: string },
>(left: T, right: T) {
  const leftGroup = left.resultGroup ?? classifyScanResultGroup(left);
  const rightGroup = right.resultGroup ?? classifyScanResultGroup(right);
  const groupDelta = DISPLAY_GROUP_ORDER[leftGroup] - DISPLAY_GROUP_ORDER[rightGroup];

  if (groupDelta !== 0) {
    return groupDelta;
  }

  if (leftGroup === "watch" && rightGroup === "watch") {
    return compareWatchItems(left, right);
  }

  const rankDelta = (right.rankScore ?? Number.NEGATIVE_INFINITY) -
    (left.rankScore ?? Number.NEGATIVE_INFINITY);

  if (rankDelta !== 0) {
    return rankDelta;
  }

  return (left.symbol ?? "").localeCompare(right.symbol ?? "");
}

function compareWatchItems<T extends ScanResultGroupInput & { symbol?: string }>(
  left: T,
  right: T,
) {
  const leftRank = left.rankScore ?? Number.NEGATIVE_INFINITY;
  const rightRank = right.rankScore ?? Number.NEGATIVE_INFINITY;
  const leftNegative = leftRank < 0;
  const rightNegative = rightRank < 0;

  if (leftNegative !== rightNegative) {
    return leftNegative ? 1 : -1;
  }

  const leftReview = getScanResultReview({ ...left, resultGroup: "watch" });
  const rightReview = getScanResultReview({ ...right, resultGroup: "watch" });
  const reviewDelta =
    (WATCH_REVIEW_TIER_ORDER[leftReview.reviewTier] ?? 99) -
    (WATCH_REVIEW_TIER_ORDER[rightReview.reviewTier] ?? 99);

  if (reviewDelta !== 0) {
    return reviewDelta;
  }

  const rankDelta = rightRank - leftRank;

  if (Math.abs(rankDelta) <= WATCH_CLOSE_RANK_DELTA) {
    const riskDelta =
      (left.riskScore ?? Number.POSITIVE_INFINITY) -
      (right.riskScore ?? Number.POSITIVE_INFINITY);

    if (riskDelta !== 0) {
      return riskDelta;
    }
  }

  if (rankDelta !== 0) {
    return rankDelta;
  }

  return (left.symbol ?? "").localeCompare(right.symbol ?? "");
}

export function buildScanResultGroups<T extends { resultGroup: ScanResultGroup }>(
  items: T[],
) {
  return {
    eligible: items.filter((item) => item.resultGroup === "eligible"),
    watch: items.filter((item) => item.resultGroup === "watch"),
    overheated: items.filter((item) => item.resultGroup === "overheated"),
    risk: items.filter((item) => item.resultGroup === "risk"),
    neutral: items.filter((item) => item.resultGroup === "neutral"),
    insufficientHistory: items.filter(
      (item) => item.resultGroup === "insufficient_history",
    ),
  };
}

export function summarizeScanResultGroups(
  signals: Array<ScanResultGroupInput & { resultGroup?: ScanResultGroup }>,
): ScanResultGroupSummary {
  const summary: ScanResultGroupSummary = {
    totalSignals: signals.length,
    eligible: 0,
    watch: 0,
    overheated: 0,
    risk: 0,
    neutral: 0,
    insufficient_history: 0,
    confirmed: 0,
    trend: 0,
    watchSignals: 0,
    neutralSignals: 0,
    overheatedSignals: 0,
    breakdownRisk: 0,
    distributionRisk: 0,
    avoid: 0,
    eligibleSignals: 0,
    doNotChase: 0,
  };

  for (const signal of signals) {
    const resultGroup = signal.resultGroup ?? classifyScanResultGroup(signal);

    summary[resultGroup] += 1;

    if (signal.signalLabel === "confirmed") {
      summary.confirmed += 1;
    } else if (signal.signalLabel === "trend") {
      summary.trend += 1;
    } else if (signal.signalLabel === "watch") {
      summary.watchSignals += 1;
    } else if (signal.signalLabel === "neutral") {
      summary.neutralSignals += 1;
    } else if (signal.signalLabel === "overheated") {
      summary.overheatedSignals += 1;
    } else if (signal.signalLabel === "breakdown_risk") {
      summary.breakdownRisk += 1;
    } else if (signal.signalLabel === "distribution_risk") {
      summary.distributionRisk += 1;
    }

    if (signal.actionBias === "avoid") {
      summary.avoid += 1;
    } else if (signal.actionBias === "eligible") {
      summary.eligibleSignals += 1;
    } else if (signal.actionBias === "do_not_chase") {
      summary.doNotChase += 1;
    }
  }

  return summary;
}
