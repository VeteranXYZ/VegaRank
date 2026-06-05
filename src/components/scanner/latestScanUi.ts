import { formatDisplayDateTime } from "@/lib/utils/format";

export const latestScanGroupOrder = [
  "eligible",
  "watch",
  "overheated",
  "risk",
  "neutral",
  "insufficient_history",
] as const;

export type LatestScanGroupKey = (typeof latestScanGroupOrder)[number];

export type LatestScanReviewTier =
  | "eligible"
  | "watch_high"
  | "watch_caution"
  | "watch_low"
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
} satisfies Record<LatestScanGroupKey, string>;

const groupHints = {
  eligible:
    "Candidates worth manual review: positive rank, confirmed/trend, clear setup, and no detected risks.",
  watch:
    "Monitor for confirmation; lower or negative-rank watch rows are lower priority.",
  overheated: "Extended conditions require additional review.",
  risk: "Risk context requires repair review.",
  neutral: "Mixed research context.",
  insufficient_history: "Not enough candles.",
} satisfies Record<LatestScanGroupKey, string>;

const reviewTierLabels = {
  eligible: "Manual review",
  watch_high: "Needs confirmation",
  watch_caution: "Caution",
  watch_low: "Low priority",
  overheated: "Overheated review",
  risk: "Risk review",
  neutral: "Mixed research context",
  insufficient_history: "Not enough candles",
} satisfies Record<LatestScanReviewTier, string>;

type LatestScanScoreInput = {
  opportunityScore: number | null;
  confirmationScore: number | null;
  riskScore: number | null;
  trendScore: number | null;
  momentumScore: number | null;
  volumeScore: number | null;
  structureScore: number | null;
};

type LatestScanGroupSummaryInput = Partial<
  Record<LatestScanGroupKey | "insufficientHistory", number | null | undefined>
> & {
  totalByGroup?: Partial<Record<LatestScanGroupKey, number | null | undefined>>;
};

const signalLabels: Record<string, string> = {
  confirmed: "Confirmed",
  watch: "Watch",
  trend: "Trend",
  overheated: "Overheated",
  distribution_risk: "Distribution Risk",
  weak_bounce: "Weak Bounce",
  breakdown_risk: "Breakdown Risk",
  weak: "Weak",
  neutral: "Neutral",
};

const actionLabels: Record<string, string> = {
  eligible: "Eligible",
  watch_only: "Watch Only",
  do_not_chase: "Overheated Review",
  avoid: "Risk Review",
  ignore: "Low Priority Review",
};

const qualityLabels: Record<string, string> = {
  core: "Core",
  major: "Major",
  normal: "Normal",
  new_listing: "New Listing",
  meme: "Meme",
  fan_token: "Fan Token",
  wrapped_or_staked: "Wrapped/Staked",
  stable_like: "Stable-Like",
  special_or_suspicious: "Special/Suspicious",
  low_history: "Low History",
};

export function formatScore(value: number | null | undefined, decimals = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return value.toFixed(decimals);
}

export function formatPrice(value: number | null | undefined) {
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

export function formatDateTime(value: string | null | undefined) {
  return formatDisplayDateTime(value);
}

export function formatGroupLabel(group: LatestScanGroupKey) {
  return groupLabels[group];
}

export function formatGroupHint(group: LatestScanGroupKey) {
  return groupHints[group];
}

export function formatSignalLabel(value: string | null | undefined) {
  if (!value) {
    return "Unknown";
  }

  return signalLabels[value] ?? toTitleCase(value);
}

export function formatActionBias(value: string | null | undefined) {
  if (!value) {
    return "Unknown";
  }

  return actionLabels[value] ?? toTitleCase(value);
}

export function formatActionDisplay(
  actionBias: string | null | undefined,
  detectedRiskTypes: unknown,
) {
  const hasRisks = hasDetectedRiskTypes(detectedRiskTypes);

  if (actionBias === "eligible" && hasRisks) {
    return "Eligible / Caution";
  }

  if (actionBias === "watch_only" && hasRisks) {
    return "Watch / Caution";
  }

  if (actionBias === "do_not_chase") {
    return "Overheated review";
  }

  return formatActionBias(actionBias);
}

export function getLatestScanActionDisplay(item: {
  actionBias?: string | null;
  detectedRiskTypes?: unknown;
  resultGroup?: string | null;
  reviewTier?: string | null;
}) {
  const resultGroup = normalizeGroupKey(item.resultGroup);

  if (resultGroup === "watch") {
    if (item.reviewTier === "watch_caution") {
      return "Caution review";
    }

    if (item.reviewTier === "watch_low") {
      return "Low priority review";
    }

    return "Review only";
  }

  return formatActionDisplay(item.actionBias, item.detectedRiskTypes);
}

export function formatReviewTierLabel(value: string | null | undefined) {
  return isLatestScanReviewTier(value)
    ? reviewTierLabels[value]
    : "Needs review";
}

export function getReviewStatusNote(item: {
  statusNote?: string | null;
  reviewTier?: string | null;
  resultGroup?: string | null;
}) {
  if (item.statusNote?.trim()) {
    return item.statusNote.trim();
  }

  if (isLatestScanReviewTier(item.reviewTier)) {
    return formatReviewTierLabel(item.reviewTier);
  }

  const group = normalizeGroupKey(item.resultGroup);

  return group === "watch" ? "Needs confirmation" : formatReviewTierLabel(group);
}

export function getReviewStatusReasons(item: {
  statusReasons?: unknown;
  detectedRiskTypes?: unknown;
  primaryStructure?: string | null;
  rankScore?: number | null;
  resultGroup?: string | null;
}) {
  if (Array.isArray(item.statusReasons)) {
    const reasons = item.statusReasons.filter(
      (reason): reason is string => typeof reason === "string" && reason.length > 0,
    );

    if (reasons.length > 0) {
      return reasons;
    }
  }

  const reasons: string[] = [];
  const resultGroup = normalizeGroupKey(item.resultGroup);
  const riskLabels = getDetectedRiskTypeLabels(item.detectedRiskTypes);

  if (riskLabels.length > 0) {
    reasons.push(
      `Caution: detected ${riskLabels.join(", ")}, so this is not treated as a clean eligible candidate.`,
    );
  }

  if (item.primaryStructure === "neutral") {
    reasons.push("Neutral setup type prevents clean eligible classification.");
  }

  if (typeof item.rankScore === "number" && item.rankScore < 0) {
    reasons.push("Low priority watch because rank score is below zero.");
  }

  if (resultGroup === "risk") {
    reasons.push("Risk group has priority over setup score.");
  } else if (resultGroup === "overheated") {
    reasons.push("Overheated state has priority over setup score.");
  } else if (reasons.length === 0 && resultGroup === "watch") {
    reasons.push(
      "Needs confirmation: positive rank with a meaningful setup, but eligible rules are not fully met.",
    );
  }

  return reasons;
}

export function getVisibleReviewReason(item: {
  detectedRiskTypes?: unknown;
  primaryStructure?: string | null;
  rankScore?: number | null;
  resultGroup?: string | null;
  reviewTier?: string | null;
}) {
  const resultGroup = normalizeGroupKey(item.resultGroup);

  if (resultGroup !== "watch") {
    return null;
  }

  const riskLabels = getDetectedRiskTypeLabels(item.detectedRiskTypes);

  if (riskLabels.some((label) => label.toLowerCase() === "weak bounce risk")) {
    return "Weak bounce risk";
  }

  if (riskLabels.length > 0 || item.reviewTier === "watch_caution") {
    return "Detected risk";
  }

  if (typeof item.rankScore === "number" && item.rankScore < 0) {
    return "Negative rank";
  }

  if (item.primaryStructure === "neutral") {
    return "Neutral setup";
  }

  if (item.reviewTier === "watch_low") {
    return "Setup not clean";
  }

  return "Needs confirmation";
}

export function formatQualityTier(value: string | null | undefined) {
  if (!value) {
    return "Unknown";
  }

  return qualityLabels[value] ?? toTitleCase(value);
}

export function getLatestScanScoreRows(item: LatestScanScoreInput) {
  return [
    { label: "Setup Score", value: formatScore(item.opportunityScore) },
    { label: "Confirmation", value: formatScore(item.confirmationScore) },
    { label: "Risk", value: formatScore(item.riskScore) },
    { label: "Trend", value: formatScore(item.trendScore) },
    { label: "Momentum", value: formatScore(item.momentumScore) },
    { label: "Volume", value: formatScore(item.volumeScore) },
    { label: "Structure", value: formatScore(item.structureScore) },
  ];
}

export function getDetectedRiskTypeLabels(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((riskType) => (typeof riskType === "string" ? toTitleCase(riskType) : ""))
    .filter(Boolean);
}

export function hasDetectedRiskTypes(value: unknown) {
  return getDetectedRiskTypeLabels(value).length > 0;
}

export function getLatestScanGroupCount(
  summary: LatestScanGroupSummaryInput | null | undefined,
  group: LatestScanGroupKey,
) {
  if (!summary) {
    return 0;
  }

  const totalByGroupValue = summary.totalByGroup?.[group];

  if (typeof totalByGroupValue === "number" && Number.isFinite(totalByGroupValue)) {
    return totalByGroupValue;
  }

  const value =
    group === "insufficient_history"
      ? summary.insufficient_history ?? summary.insufficientHistory
      : summary[group];

  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function getLatestScanGroupSummaryChips(
  summary: LatestScanGroupSummaryInput | null | undefined,
) {
  return latestScanGroupOrder
    .map((group) => ({
      group,
      label: formatGroupLabel(group),
      count: getLatestScanGroupCount(summary, group),
    }));
}

export function getResultGroupSortOrder(group: string | null | undefined) {
  const normalized = normalizeGroupKey(group);
  const index = latestScanGroupOrder.indexOf(normalized);

  return index === -1 ? latestScanGroupOrder.length : index;
}

export function normalizeGroupKey(
  group: string | null | undefined,
): LatestScanGroupKey {
  return group === "insufficientHistory" || group === "insufficient_history"
    ? "insufficient_history"
    : latestScanGroupOrder.includes(group as LatestScanGroupKey)
      ? (group as LatestScanGroupKey)
      : "neutral";
}

function isLatestScanReviewTier(
  value: string | null | undefined,
): value is LatestScanReviewTier {
  return (
    value === "eligible" ||
    value === "watch_high" ||
    value === "watch_caution" ||
    value === "watch_low" ||
    value === "overheated" ||
    value === "risk" ||
    value === "neutral" ||
    value === "insufficient_history"
  );
}

export function toTitleCase(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\//g, " / ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}
