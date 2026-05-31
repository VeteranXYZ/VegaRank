export const latestScanGroupOrder = [
  "eligible",
  "watch",
  "overheated",
  "risk",
  "neutral",
  "insufficient_history",
] as const;

export type LatestScanGroupKey = (typeof latestScanGroupOrder)[number];

const groupLabels = {
  eligible: "Eligible",
  watch: "Watch",
  overheated: "Overheated",
  risk: "Risk",
  neutral: "Neutral",
  insufficient_history: "Insufficient History",
} satisfies Record<LatestScanGroupKey, string>;

const groupHints = {
  eligible: "Candidates worth manual review, not automatic buys.",
  watch: "Monitor for confirmation.",
  overheated: "Strong but extended, do not chase.",
  risk: "Avoid or wait for repair.",
  neutral: "No clear edge.",
  insufficient_history: "Not enough candles.",
} satisfies Record<LatestScanGroupKey, string>;

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
>;

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
  do_not_chase: "Do Not Chase",
  avoid: "Avoid",
  ignore: "Ignore",
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
  if (!value) {
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
    return "Do not chase";
  }

  return formatActionBias(actionBias);
}

export function formatQualityTier(value: string | null | undefined) {
  if (!value) {
    return "Unknown";
  }

  return qualityLabels[value] ?? toTitleCase(value);
}

export function getLatestScanScoreRows(item: LatestScanScoreInput) {
  return [
    { label: "Opportunity", value: formatScore(item.opportunityScore) },
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
    .filter((group) => group !== "insufficient_history")
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

export function toTitleCase(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\//g, " / ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}
