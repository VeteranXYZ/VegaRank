import { formatDisplayDateTime } from "@/lib/utils/format";
import { dictionaries } from "@/lib/i18n/dictionaries";
import {
  formatScannerReviewText,
  formatScannerReviewValue,
} from "@/lib/i18n/formatScannerObservation";
import type {
  ActionBias,
  DetectedRiskType,
  ScannerReviewKey,
  ScannerReviewText,
  ScannerSignalLabel,
} from "@/lib/shared/rankingTypes";

export const latestRankingsGroupOrder = [
  "eligible",
  "watch",
  "overheated",
  "risk",
  "neutral",
  "insufficient_history",
] as const;

export type LatestRankingsGroupKey = (typeof latestRankingsGroupOrder)[number];

export type LatestRankingsReviewTier =
  | "eligible"
  | "watch_high"
  | "watch_caution"
  | "watch_low"
  | "overheated"
  | "risk"
  | "neutral"
  | "insufficient_history";

const groupHints = {
  eligible:
    "Candidates worth manual review: positive rank, confirmed/trend, clear setup, and no detected risks.",
  watch:
    "Monitor for confirmation; lower or negative-rank watch rows are lower priority.",
  overheated: "Extended conditions require additional review.",
  risk: "Risk context requires repair review.",
  neutral: "Mixed research context.",
  insufficient_history: "Not enough candles.",
} satisfies Record<LatestRankingsGroupKey, string>;

type LatestRankingsScoreInput = {
  opportunityScore: number | null;
  confirmationScore: number | null;
  riskScore: number | null;
  trendScore: number | null;
  momentumScore: number | null;
  volumeScore: number | null;
  structureScore: number | null;
};

type LatestRankingsGroupSummaryInput = Partial<
  Record<LatestRankingsGroupKey | "insufficientHistory", number | null | undefined>
> & {
  totalByGroup?: Partial<Record<LatestRankingsGroupKey, number | null | undefined>>;
};

const defaultDictionary = dictionaries.en;
export type ScannerDisplayDictionary = (typeof dictionaries)[keyof typeof dictionaries];

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

export function formatGroupLabel(
  group: LatestRankingsGroupKey,
  dictionary: ScannerDisplayDictionary = defaultDictionary,
) {
  return dictionary.scannerResultGroup[group];
}

export function formatGroupHint(group: LatestRankingsGroupKey) {
  return groupHints[group];
}

export function formatSignalLabel(
  value: string | null | undefined,
  dictionary: ScannerDisplayDictionary = defaultDictionary,
) {
  if (!value) {
    return dictionary.scannerResultFallback.unknown;
  }

  return isScannerSignalLabel(value)
    ? dictionary.signalLabel[value]
    : formatUnknownScannerResultValue(value, dictionary);
}

export function formatActionBias(
  value: string | null | undefined,
  dictionary: ScannerDisplayDictionary = defaultDictionary,
) {
  if (!value) {
    return dictionary.scannerResultFallback.unknown;
  }

  return isActionBias(value)
    ? dictionary.actionBias[value]
    : formatUnknownScannerResultValue(value, dictionary);
}

export function formatPrimaryStructure(
  value: string | null | undefined,
  dictionary: ScannerDisplayDictionary = defaultDictionary,
) {
  const normalized = value?.trim().toLowerCase();

  if (!normalized || normalized === "n/a" || normalized === "na") {
    return dictionary.scannerResultFallback.unknown;
  }

  return normalized in dictionary.primaryStructure
    ? dictionary.primaryStructure[
        normalized as keyof typeof dictionary.primaryStructure
      ]
    : formatUnknownScannerResultValue(normalized, dictionary);
}

export function formatActionDisplay(
  actionBias: string | null | undefined,
  detectedRiskTypes: unknown,
  dictionary: ScannerDisplayDictionary = defaultDictionary,
) {
  const hasRisks = hasDetectedRiskTypes(detectedRiskTypes, dictionary);

  if (actionBias === "eligible" && hasRisks) {
    return `${formatActionBias(actionBias, dictionary)} / ${dictionary.scannerReview["review.status.caution"]}`;
  }

  if (actionBias === "watch_only" && hasRisks) {
    return `${formatActionBias(actionBias, dictionary)} / ${dictionary.scannerReview["review.status.caution"]}`;
  }

  if (actionBias === "do_not_chase") {
    return dictionary.scannerReview["review.status.doNotChase"];
  }

  return formatActionBias(actionBias, dictionary);
}

export function getLatestRankingsActionDisplay(
  item: {
    actionBias?: string | null;
    detectedRiskTypes?: unknown;
    resultGroup?: string | null;
    reviewTier?: string | null;
  },
  dictionary: ScannerDisplayDictionary = defaultDictionary,
) {
  const resultGroup = normalizeGroupKey(item.resultGroup);

  if (resultGroup === "watch") {
    if (item.reviewTier === "watch_caution") {
      return dictionary.scannerReview["review.status.caution"];
    }

    if (item.reviewTier === "watch_low") {
      return dictionary.scannerReview["review.status.lowPriority"];
    }

    return dictionary.scannerReview["review.status.manualReview"];
  }

  return formatActionDisplay(item.actionBias, item.detectedRiskTypes, dictionary);
}

export function formatReviewTierLabel(
  value: string | null | undefined,
  dictionary: ScannerDisplayDictionary = defaultDictionary,
) {
  if (!isLatestRankingsReviewTier(value)) {
    return dictionary.scannerResultFallback.needsReview;
  }

  switch (value) {
    case "eligible":
      return dictionary.scannerReview["review.status.manualReview"];
    case "watch_high":
      return dictionary.scannerReview["review.status.needsConfirmation"];
    case "watch_caution":
      return dictionary.scannerReview["review.status.caution"];
    case "watch_low":
      return dictionary.scannerReview["review.status.lowPriority"];
    case "overheated":
      return dictionary.scannerReview["review.status.doNotChase"];
    case "risk":
      return dictionary.scannerReview["review.status.avoid"];
    case "neutral":
      return dictionary.scannerReview["review.status.noClearEdge"];
    case "insufficient_history":
      return dictionary.scannerReview["review.status.notEnoughCandles"];
  }
}

export function getReviewStatusNote(
  item: {
    statusNote?: string | null;
    statusNoteKey?: string | null;
    reviewTier?: string | null;
    resultGroup?: string | null;
  },
  dictionary: ScannerDisplayDictionary = defaultDictionary,
) {
  const statusNoteKey = toScannerReviewText(item.statusNoteKey);

  if (statusNoteKey) {
    return formatScannerReviewText(statusNoteKey, dictionary);
  }

  if (item.statusNote?.trim()) {
    return formatScannerReviewValue(item.statusNote, dictionary);
  }

  if (isLatestRankingsReviewTier(item.reviewTier)) {
    return formatReviewTierLabel(item.reviewTier, dictionary);
  }

  const group = normalizeGroupKey(item.resultGroup);

  return group === "watch"
    ? dictionary.scannerReview["review.status.needsConfirmation"]
    : formatReviewTierLabel(group, dictionary);
}

export function getReviewStatusReasons(
  item: {
    statusReasons?: unknown;
    statusReasonKeys?: unknown;
    detectedRiskTypes?: unknown;
    primaryStructure?: string | null;
    rankScore?: number | null;
    resultGroup?: string | null;
  },
  dictionary: ScannerDisplayDictionary = defaultDictionary,
) {
  const statusReasonKeys = toScannerReviewTextArray(item.statusReasonKeys);

  if (statusReasonKeys.length > 0) {
    return statusReasonKeys.map((reason) =>
      formatScannerReviewText(reason, dictionary),
    );
  }

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
  const riskLabels = getDetectedRiskTypeLabels(item.detectedRiskTypes, dictionary);

  if (riskLabels.length > 0) {
    reasons.push(
      formatScannerReviewText(
        {
          key: "review.reason.detectedRisks",
          params: { risks: riskLabels.join(", ") },
        },
        dictionary,
      ),
    );
  }

  if (item.primaryStructure === "neutral") {
    reasons.push(
      formatScannerReviewText({ key: "review.reason.neutralSetup" }, dictionary),
    );
  }

  if (typeof item.rankScore === "number" && item.rankScore < 0) {
    reasons.push(
      formatScannerReviewText({ key: "review.reason.rankBelowZero" }, dictionary),
    );
  }

  if (resultGroup === "risk") {
    reasons.push(
      formatScannerReviewText({ key: "review.reason.riskGroupPriority" }, dictionary),
    );
  } else if (resultGroup === "overheated") {
    reasons.push(
      formatScannerReviewText(
        { key: "review.reason.overheatedPriority" },
        dictionary,
      ),
    );
  } else if (reasons.length === 0 && resultGroup === "watch") {
    reasons.push(
      formatScannerReviewText(
        { key: "review.reason.needsConfirmation" },
        dictionary,
      ),
    );
  }

  return reasons;
}

function isScannerSignalLabel(value: string): value is ScannerSignalLabel {
  return value in defaultDictionary.signalLabel;
}

function isActionBias(value: string): value is ActionBias {
  return value in defaultDictionary.actionBias;
}

function isDetectedRiskType(value: string): value is DetectedRiskType {
  return value in defaultDictionary.detectedRiskType;
}

function formatDetectedRiskType(
  value: string,
  dictionary: ScannerDisplayDictionary = defaultDictionary,
) {
  return isDetectedRiskType(value)
    ? dictionary.detectedRiskType[value]
    : formatUnknownScannerResultValue(value, dictionary);
}

function isScannerReviewKey(value: string): value is ScannerReviewKey {
  return value in defaultDictionary.scannerReview;
}

function toScannerReviewText(value: unknown): ScannerReviewText | null {
  if (typeof value === "string" && isScannerReviewKey(value)) {
    return { key: value };
  }

  if (
    value &&
    typeof value === "object" &&
    "key" in value &&
    typeof value.key === "string" &&
    isScannerReviewKey(value.key)
  ) {
    return value as ScannerReviewText;
  }

  return null;
}

function toScannerReviewTextArray(value: unknown) {
  return Array.isArray(value)
    ? value.map(toScannerReviewText).filter((item): item is ScannerReviewText => !!item)
    : [];
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

export function getLatestRankingsScoreRows(item: LatestRankingsScoreInput) {
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

export function getDetectedRiskTypeLabels(
  value: unknown,
  dictionary: ScannerDisplayDictionary = defaultDictionary,
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((riskType) =>
      typeof riskType === "string" ? formatDetectedRiskType(riskType, dictionary) : "",
    )
    .filter(Boolean);
}

export function hasDetectedRiskTypes(
  value: unknown,
  dictionary: ScannerDisplayDictionary = defaultDictionary,
) {
  return getDetectedRiskTypeLabels(value, dictionary).length > 0;
}

export function formatUnknownScannerResultValue(
  value: string,
  dictionary: ScannerDisplayDictionary = defaultDictionary,
) {
  return dictionary === defaultDictionary
    ? toTitleCase(value)
    : dictionary.scannerResultFallback.unknown;
}

export function getLatestRankingsGroupCount(
  summary: LatestRankingsGroupSummaryInput | null | undefined,
  group: LatestRankingsGroupKey,
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

export function getLatestRankingsGroupSummaryChips(
  summary: LatestRankingsGroupSummaryInput | null | undefined,
  dictionary: ScannerDisplayDictionary = defaultDictionary,
) {
  return latestRankingsGroupOrder
    .map((group) => ({
      group,
      label: formatGroupLabel(group, dictionary),
      count: getLatestRankingsGroupCount(summary, group),
    }));
}

export function getResultGroupSortOrder(group: string | null | undefined) {
  const normalized = normalizeGroupKey(group);
  const index = latestRankingsGroupOrder.indexOf(normalized);

  return index === -1 ? latestRankingsGroupOrder.length : index;
}

export function normalizeGroupKey(
  group: string | null | undefined,
): LatestRankingsGroupKey {
  return group === "insufficientHistory" || group === "insufficient_history"
    ? "insufficient_history"
    : latestRankingsGroupOrder.includes(group as LatestRankingsGroupKey)
      ? (group as LatestRankingsGroupKey)
      : "neutral";
}

function isLatestRankingsReviewTier(
  value: string | null | undefined,
): value is LatestRankingsReviewTier {
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
