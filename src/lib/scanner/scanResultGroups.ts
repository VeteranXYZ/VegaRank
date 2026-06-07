import type { ScannerReviewKey, ScannerReviewText } from "@/lib/shared/scannerTypes";
import {
  actionBiasByCode,
  primaryStructureBySetupCode,
  resultGroupByGroupCode,
  riskTypeByCode,
  signalLabelByCode,
} from "@/lib/scanner-codebook/codeRegistry";

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
  groupCode?: string | null;
  signalLabel?: string | null;
  actionBias?: string | null;
  primaryStructure?: string | null;
  rankScore?: number | null;
  riskScore?: number | null;
  detectedRiskTypes?: unknown[] | null;
};

export type ScanResultReview = {
  reviewTier: ScanResultReviewTier;
  statusNoteKey: ScannerReviewKey;
  cautionLevel: ScanResultCautionLevel;
  statusReasonKeys: ScannerReviewText[];
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
  watch_caution: 1,
  watch_low: 2,
};

export function classifyScanResultGroup(
  signal: ScanResultGroupInput,
): ScanResultGroup {
  const codeGroup = normalizeGroupCode(signal.groupCode);

  if (codeGroup) {
    return codeGroup;
  }

  const actionBias = normalizeActionBias(signal.actionBias);
  const signalLabel = normalizeSignalLabel(signal.signalLabel);
  const primaryStructure = normalizePrimaryStructure(signal.primaryStructure);
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

function normalizeGroupCode(value: string | null | undefined): ScanResultGroup | "" {
  if (!value) {
    return "";
  }

  const resultGroup =
    resultGroupByGroupCode[value as keyof typeof resultGroupByGroupCode];

  if (resultGroup === "high_priority") {
    return "eligible";
  }

  if (resultGroup === "low_quality") {
    return "insufficient_history";
  }

  return SCAN_RESULT_GROUPS.includes(resultGroup as ScanResultGroup)
    ? (resultGroup as ScanResultGroup)
    : "";
}

export function getScanResultReview(
  signal: ScanResultGroupInput & { resultGroup?: ScanResultGroup },
): ScanResultReview {
  const resultGroup = signal.resultGroup ?? classifyScanResultGroup(signal);
  const rankScore = signal.rankScore ?? Number.NEGATIVE_INFINITY;
  const primaryStructure = normalizePrimaryStructure(signal.primaryStructure);
  const detectedRiskCodes = getDetectedRiskCodes(signal);

  if (resultGroup === "eligible") {
    return {
      reviewTier: "eligible",
      statusNoteKey: "review.status.manualReview",
      cautionLevel: "none",
      statusReasonKeys: [{ key: "review.reason.cleanCandidate" }],
    };
  }

  if (resultGroup === "risk") {
    return {
      reviewTier: "risk",
      statusNoteKey: "review.status.avoid",
      cautionLevel: "caution",
      statusReasonKeys: [{ key: "review.reason.riskGroupPriority" }],
    };
  }

  if (resultGroup === "overheated") {
    return {
      reviewTier: "overheated",
      statusNoteKey: "review.status.doNotChase",
      cautionLevel: "caution",
      statusReasonKeys: [{ key: "review.reason.overheatedPriority" }],
    };
  }

  if (resultGroup === "neutral") {
    return {
      reviewTier: "neutral",
      statusNoteKey: "review.status.noClearEdge",
      cautionLevel: "none",
      statusReasonKeys: [{ key: "review.reason.neutralGroup" }],
    };
  }

  if (resultGroup === "insufficient_history") {
    return {
      reviewTier: "insufficient_history",
      statusNoteKey: "review.status.notEnoughCandles",
      cautionLevel: "low",
      statusReasonKeys: [{ key: "review.reason.insufficientHistory" }],
    };
  }

  if (detectedRiskCodes.length > 0) {
    return {
      reviewTier: "watch_caution",
      statusNoteKey: "review.status.caution",
      cautionLevel: "caution",
      statusReasonKeys: [
        {
          key: "review.reason.detectedRisks",
          params: { risks: detectedRiskCodes.join(", ") },
        },
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
      statusNoteKey: "review.status.lowPriority",
      cautionLevel: "low",
      statusReasonKeys: lowPriorityReasons,
    };
  }

  return {
    reviewTier: "watch_high",
    statusNoteKey: "review.status.needsConfirmation",
    cautionLevel: "none",
    statusReasonKeys: [{ key: "review.reason.needsConfirmation" }],
  };
}

function hasAnyDetectedRiskType(
  signal: ScanResultGroupInput,
  riskTypes: string[],
) {
  const detectedRiskTypes = signal.detectedRiskTypes ?? [];

  return detectedRiskTypes.some((riskType) =>
    riskTypes.includes(normalizeRiskType(riskType)),
  );
}

function getDetectedRiskCodes(signal: ScanResultGroupInput) {
  const detectedRiskTypes = signal.detectedRiskTypes ?? [];

  return detectedRiskTypes
    .map(normalizeRiskType)
    .filter(Boolean);
}

function normalizeActionBias(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return actionBiasByCode[value as keyof typeof actionBiasByCode] ?? value;
}

function normalizeSignalLabel(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return signalLabelByCode[value as keyof typeof signalLabelByCode] ?? value;
}

function normalizePrimaryStructure(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return (
    primaryStructureBySetupCode[value as keyof typeof primaryStructureBySetupCode] ??
    value
  );
}

function normalizeRiskType(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return riskTypeByCode[value as keyof typeof riskTypeByCode] ?? value;
}

function getWatchLowPriorityReasons({
  rankScore,
  primaryStructure,
}: {
  rankScore: number;
  primaryStructure: string;
}): ScannerReviewText[] {
  const reasons: ScannerReviewText[] = [];

  if (rankScore < 0) {
    reasons.push({ key: "review.reason.rankBelowZero" });
  }

  if (primaryStructure === "" || primaryStructure === "neutral") {
    reasons.push({ key: "review.reason.neutralSetup" });
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
  const leftReview = getScanResultReview({ ...left, resultGroup: "watch" });
  const rightReview = getScanResultReview({ ...right, resultGroup: "watch" });
  const reviewDelta =
    (WATCH_REVIEW_TIER_ORDER[leftReview.reviewTier] ?? 99) -
    (WATCH_REVIEW_TIER_ORDER[rightReview.reviewTier] ?? 99);

  if (reviewDelta !== 0) {
    return reviewDelta;
  }

  const rankDelta = rightRank - leftRank;

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
    const signalLabel = normalizeSignalLabel(signal.signalLabel);
    const actionBias = normalizeActionBias(signal.actionBias);

    summary[resultGroup] += 1;

    if (signalLabel === "confirmed") {
      summary.confirmed += 1;
    } else if (signalLabel === "trend") {
      summary.trend += 1;
    } else if (signalLabel === "watch") {
      summary.watchSignals += 1;
    } else if (signalLabel === "neutral") {
      summary.neutralSignals += 1;
    } else if (signalLabel === "overheated") {
      summary.overheatedSignals += 1;
    } else if (signalLabel === "breakdown_risk") {
      summary.breakdownRisk += 1;
    } else if (signalLabel === "distribution_risk") {
      summary.distributionRisk += 1;
    }

    if (actionBias === "avoid") {
      summary.avoid += 1;
    } else if (actionBias === "eligible") {
      summary.eligibleSignals += 1;
    } else if (actionBias === "do_not_chase") {
      summary.doNotChase += 1;
    }
  }

  return summary;
}
