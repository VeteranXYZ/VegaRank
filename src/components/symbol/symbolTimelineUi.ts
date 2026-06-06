import { formatDisplayDateTime } from "@/lib/utils/format";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { formatScannerReviewValue } from "@/lib/i18n/formatScannerObservation";
import {
  formatActionBias,
  formatGroupLabel,
  formatPrimaryStructure,
  formatUnknownScannerResultValue,
  getDetectedRiskTypeLabels,
  normalizeGroupKey,
} from "@/components/scanner/latestScanUi";
import type { ScannerReviewText } from "@/lib/shared/scannerTypes";
import { formatSymbolResearchRunContext } from "./symbolResearchUi";

export type TimelineDisplayDictionary = (typeof dictionaries)[keyof typeof dictionaries];

export type RawSymbolTimelineSignal = {
  id?: string | null;
  scanRunId?: string | null;
  symbol?: string | null;
  timeframe?: string | null;
  scanTime?: string | null;
  candleOpenTime?: string | null;
  resultGroup?: string | null;
  signalLabel?: string | null;
  actionBias?: string | null;
  statusNoteKey?: string | null;
  statusNote?: string | null;
  reviewTier?: string | null;
  cautionLevel?: string | null;
  statusReasonKeys?: ScannerReviewText[] | null;
  statusReasons?: string[] | null;
  primaryStructure?: string | null;
  rankScore?: number | null;
  opportunityScore?: number | null;
  confirmationScore?: number | null;
  riskScore?: number | null;
  detectedRiskTypes?: unknown;
  sourceRunIsLikelyFullUniverse?: boolean | null;
  isSelectedCurrentRun?: boolean | null;
  isNewerThanSelectedCurrentRun?: boolean | null;
};

export type NormalizedSymbolTimelineSignal = {
  key: string;
  scanTime: string | null;
  candleOpenTime: string | null;
  scanTimeMs: number | null;
  candleOpenTimeMs: number | null;
  group: string;
  groupLabel: string;
  groupDescription: string;
  signalLabel: string;
  actionText: string;
  setupText: string;
  rankScore: string;
  opportunityScore: string;
  confirmationScore: string;
  riskScore: string;
  riskText: string;
  statusText: string;
  runContextText: string;
  isSelectedCurrentRun: boolean;
  isNewerThanSelectedCurrentRun: boolean;
  isSecondaryRun: boolean;
  timelineTone: "selected" | "secondary" | "default";
};

export type CompactSignalHistoryResult = {
  items: NormalizedSymbolTimelineSignal[];
  hiddenCount: number;
  totalCount: number;
};

const groupDescriptions: Record<string, string> = {
  eligible: "Meets current scanner review criteria.",
  watch: "Worth monitoring, but confirmation is still limited.",
  overheated: "Extended conditions require extra caution.",
  risk: "Risk context is elevated or structure has weakened.",
  neutral: "No clear scanner classification is available.",
  insufficient_history: "The scanner needs more candles for a fuller read.",
};

export function normalizeSignalHistory(
  history: RawSymbolTimelineSignal[] | null | undefined,
  dictionary: TimelineDisplayDictionary = dictionaries.en,
): NormalizedSymbolTimelineSignal[] {
  if (!Array.isArray(history) || history.length === 0) {
    return [];
  }

  return dedupeSignalHistory(history)
    .map((item, index) => {
      const group = normalizeGroup(item.resultGroup);
      const scanTimeMs = parseDateMs(item.scanTime);
      const candleOpenTimeMs = parseDateMs(item.candleOpenTime);

      return {
        key: item.id || `${item.symbol ?? "symbol"}-${item.scanTime ?? "scan"}-${index}`,
        scanTime: item.scanTime ?? null,
        candleOpenTime: item.candleOpenTime ?? null,
        scanTimeMs,
        candleOpenTimeMs,
        group,
        groupLabel: getTimelineGroupLabel(group, dictionary),
        groupDescription: getTimelineGroupDescription(group, dictionary),
        signalLabel: getTimelineSignalLabel(item.signalLabel, dictionary),
        actionText: getTimelineActionText(item, dictionary),
        setupText: getTimelineSetupText(item.primaryStructure, dictionary),
        rankScore: formatTimelineScore(item.rankScore),
        opportunityScore: formatTimelineScore(item.opportunityScore),
        confirmationScore: formatTimelineScore(item.confirmationScore),
        riskScore: formatTimelineScore(item.riskScore),
        riskText: getTimelineRiskText(item.detectedRiskTypes, dictionary),
        statusText: getTimelineStatusText(item, dictionary),
        runContextText: formatSymbolResearchRunContext(item),
        isSelectedCurrentRun: item.isSelectedCurrentRun === true,
        isNewerThanSelectedCurrentRun: item.isNewerThanSelectedCurrentRun === true,
        isSecondaryRun: isSecondaryTimelineRun(item),
        timelineTone: getTimelineTone(item),
      };
    })
    .sort((left, right) => {
      const leftTime = left.scanTimeMs ?? left.candleOpenTimeMs ?? Number.NEGATIVE_INFINITY;
      const rightTime = right.scanTimeMs ?? right.candleOpenTimeMs ?? Number.NEGATIVE_INFINITY;

      if (rightTime !== leftTime) {
        return rightTime - leftTime;
      }

      return left.key.localeCompare(right.key);
    });
}

export function getCompactSignalHistory(
  items: NormalizedSymbolTimelineSignal[],
  maxItems = 8,
): CompactSignalHistoryResult {
  if (items.length <= maxItems) {
    return {
      items: [...items],
      hiddenCount: 0,
      totalCount: items.length,
    };
  }

  const limit = Math.max(1, maxItems);
  const selectedIndexes = new Set<number>([0]);

  items.forEach((item, index) => {
    if (item.isSelectedCurrentRun) {
      selectedIndexes.add(index);
    }
  });

  const firstSecondaryIndex = items.findIndex(
    (item) => item.isNewerThanSelectedCurrentRun && item.isSecondaryRun,
  );

  if (firstSecondaryIndex >= 0) {
    selectedIndexes.add(firstSecondaryIndex);
  }

  for (let index = 1; index < items.length && selectedIndexes.size < limit; index += 1) {
    if (items[index]?.group !== items[index - 1]?.group) {
      selectedIndexes.add(index);
    }
  }

  for (let index = 0; index < items.length && selectedIndexes.size < limit; index += 1) {
    selectedIndexes.add(index);
  }

  const selected = [...selectedIndexes].sort((left, right) => left - right);

  return {
    items: selected.map((index) => items[index]!),
    hiddenCount: items.length - selected.length,
    totalCount: items.length,
  };
}

export function formatTimelineDate(value: string | number | null | undefined) {
  return formatDisplayDateTime(value);
}

export function formatTimelineScore(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return value.toFixed(1);
}

export function getTimelineGroupLabel(
  value: string | null | undefined,
  dictionary: TimelineDisplayDictionary = dictionaries.en,
) {
  return formatGroupLabel(normalizeGroup(value), dictionary);
}

export function getTimelineGroupDescription(
  value: string | null | undefined,
  dictionary: TimelineDisplayDictionary = dictionaries.en,
) {
  const group = normalizeGroup(value);

  return dictionary === dictionaries.en
    ? groupDescriptions[group]
    : formatGroupLabel(group, dictionary);
}

export function getTimelineStatusText(
  item: RawSymbolTimelineSignal,
  dictionary: TimelineDisplayDictionary = dictionaries.en,
) {
  if (item.statusNoteKey) {
    return formatScannerReviewValue(item.statusNoteKey, dictionary);
  }

  if (item.statusNote) {
    return formatScannerReviewValue(item.statusNote, dictionary);
  }

  if (item.reviewTier) {
    return formatScannerReviewValue(item.reviewTier, dictionary);
  }

  if (item.cautionLevel) {
    return formatScannerReviewValue(item.cautionLevel, dictionary);
  }

  const firstReason =
    item.statusReasonKeys?.find((reason) => reason.key.length > 0) ??
    item.statusReasons?.find((reason) => reason.trim().length > 0);

  if (firstReason) {
    return formatScannerReviewValue(firstReason, dictionary);
  }

  return dictionary.scannerResultFallback.noStatusNote;
}

export function getTimelineRiskText(
  value: unknown,
  dictionary: TimelineDisplayDictionary = dictionaries.en,
) {
  if (!Array.isArray(value) || value.length === 0) {
    return dictionary.scannerResultFallback.noSpecificRiskTypes;
  }

  const risks = getDetectedRiskTypeLabels(value, dictionary);

  return risks.length > 0
    ? risks.join(", ")
    : dictionary.scannerResultFallback.noSpecificRiskTypes;
}

function getTimelineActionText(
  item: RawSymbolTimelineSignal,
  dictionary: TimelineDisplayDictionary,
) {
  if (item.actionBias) {
    return formatActionBias(item.actionBias, dictionary);
  }

  if (item.statusNote) {
    return formatScannerReviewValue(item.statusNote, dictionary);
  }

  return dictionary.scannerReview["review.status.needsConfirmation"];
}

function getTimelineSignalLabel(
  value: string | null | undefined,
  dictionary: TimelineDisplayDictionary,
) {
  return value && value in dictionary.signalLabel
    ? dictionary.signalLabel[value as keyof typeof dictionary.signalLabel]
    : value
      ? formatUnknownScannerResultValue(value, dictionary)
      : dictionary.scannerResultFallback.unknown;
}

function getTimelineSetupText(
  value: string | null | undefined,
  dictionary: TimelineDisplayDictionary,
) {
  return formatPrimaryStructure(value, dictionary);
}

function dedupeSignalHistory(history: RawSymbolTimelineSignal[]) {
  const seen = new Set<string>();
  const rows: RawSymbolTimelineSignal[] = [];

  for (const item of history) {
    const key = getSignalHistoryDedupeKey(item);

    if (!seen.has(key)) {
      seen.add(key);
      rows.push(item);
    }
  }

  return rows;
}

function getSignalHistoryDedupeKey(item: RawSymbolTimelineSignal) {
  return [
    item.scanRunId ?? "",
    item.symbol ?? "",
    item.timeframe ?? "",
    item.scanTime ?? "",
    item.signalLabel ?? "",
    item.rankScore ?? "",
  ].join("|");
}

function isSecondaryTimelineRun(item: RawSymbolTimelineSignal) {
  return (
    item.isSelectedCurrentRun !== true &&
    item.sourceRunIsLikelyFullUniverse === false
  );
}

function getTimelineTone(
  item: RawSymbolTimelineSignal,
): NormalizedSymbolTimelineSignal["timelineTone"] {
  if (item.isSelectedCurrentRun) {
    return "selected";
  }

  if (isSecondaryTimelineRun(item)) {
    return "secondary";
  }

  return "default";
}

function normalizeGroup(value: string | null | undefined) {
  return normalizeGroupKey(value);
}

function parseDateMs(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}
