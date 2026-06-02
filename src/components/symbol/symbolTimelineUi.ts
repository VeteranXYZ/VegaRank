import { formatSymbolResearchRunContext } from "./symbolResearchUi";

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
  statusNote?: string | null;
  reviewTier?: string | null;
  cautionLevel?: string | null;
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

const groupLabels: Record<string, string> = {
  eligible: "Eligible",
  watch: "Watch",
  overheated: "Overheated",
  risk: "Risk",
  neutral: "Neutral",
  insufficient_history: "Insufficient History",
};

const groupDescriptions: Record<string, string> = {
  eligible: "Meets current scanner review criteria.",
  watch: "Worth monitoring, but confirmation is still limited.",
  overheated: "Extended conditions require extra caution.",
  risk: "Risk context is elevated or structure has weakened.",
  neutral: "No clear scanner classification is available.",
  insufficient_history: "The scanner needs more candles for a fuller read.",
};

const actionLabels: Record<string, string> = {
  eligible: "Manual review",
  watch_only: "Review only",
  do_not_chase: "Overheated review",
  avoid: "Repair review",
  ignore: "Low priority review",
};

export function normalizeSignalHistory(
  history: RawSymbolTimelineSignal[] | null | undefined,
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
        groupLabel: getTimelineGroupLabel(group),
        groupDescription: getTimelineGroupDescription(group),
        signalLabel: item.signalLabel ? toTitleCase(item.signalLabel) : "Unknown",
        actionText: getTimelineActionText(item),
        setupText: item.primaryStructure ? toTitleCase(item.primaryStructure) : "Unknown",
        rankScore: formatTimelineScore(item.rankScore),
        opportunityScore: formatTimelineScore(item.opportunityScore),
        confirmationScore: formatTimelineScore(item.confirmationScore),
        riskScore: formatTimelineScore(item.riskScore),
        riskText: getTimelineRiskText(item.detectedRiskTypes),
        statusText: getTimelineStatusText(item),
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

export function formatTimelineScore(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return value.toFixed(1);
}

export function getTimelineGroupLabel(value: string | null | undefined) {
  return groupLabels[normalizeGroup(value)];
}

export function getTimelineGroupDescription(value: string | null | undefined) {
  return groupDescriptions[normalizeGroup(value)];
}

export function getTimelineStatusText(item: RawSymbolTimelineSignal) {
  if (item.statusNote) {
    return toTitleCase(item.statusNote);
  }

  if (item.reviewTier) {
    return `Review tier: ${toTitleCase(item.reviewTier)}`;
  }

  if (item.cautionLevel) {
    return `Caution level: ${toTitleCase(item.cautionLevel)}`;
  }

  const firstReason = item.statusReasons?.find((reason) => reason.trim().length > 0);

  if (firstReason) {
    return toTitleCase(firstReason);
  }

  return "No status note available.";
}

export function getTimelineRiskText(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    return "No specific risk types noted.";
  }

  const risks = value
    .map((item) => (typeof item === "string" ? toTitleCase(item) : ""))
    .filter(Boolean);

  return risks.length > 0 ? risks.join(", ") : "No specific risk types noted.";
}

function getTimelineActionText(item: RawSymbolTimelineSignal) {
  if (item.actionBias && actionLabels[item.actionBias]) {
    return actionLabels[item.actionBias];
  }

  if (item.actionBias) {
    return toTitleCase(item.actionBias);
  }

  if (item.statusNote) {
    return toTitleCase(item.statusNote);
  }

  return "Review only";
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
  if (value && groupLabels[value]) {
    return value;
  }

  return "neutral";
}

function parseDateMs(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function toTitleCase(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}
