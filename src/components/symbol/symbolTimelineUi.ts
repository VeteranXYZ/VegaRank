import { formatDisplayDateTime } from "@/lib/utils/format";
import type { Language } from "@/lib/i18n/dictionaries";
import { resultGroupByGroupCode } from "@/lib/scanner-codebook/codeRegistry";
import { explainCode, explainCodes } from "@/lib/scanner-codebook/explainCode";
import type { PublicStoredScannerSignal } from "@/lib/scanner-codebook/serializeStoredSignal";
import { formatSymbolResearchRunContext } from "./symbolResearchUi";

export type RawSymbolTimelineSignal = Partial<PublicStoredScannerSignal> & {
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
  language: Language = "en",
): NormalizedSymbolTimelineSignal[] {
  if (!Array.isArray(history) || history.length === 0) {
    return [];
  }

  return dedupeSignalHistory(history)
    .map((item, index) => {
      const group = normalizeGroup(item.groupCode);
      const scanTimeMs = parseDateMs(item.scanTime);
      const candleOpenTimeMs = parseDateMs(item.candleOpenTime);

      return {
        key: item.id || `${item.symbol ?? "symbol"}-${item.scanTime ?? "scan"}-${index}`,
        scanTime: item.scanTime ?? null,
        candleOpenTime: item.candleOpenTime ?? null,
        scanTimeMs,
        candleOpenTimeMs,
        group,
        groupLabel: getTimelineGroupLabel(item.groupCode, language),
        groupDescription: getTimelineGroupDescription(item.groupCode, language),
        signalLabel: getTimelineSignalLabel(item, language),
        actionText: getTimelineActionText(item, language),
        setupText: getTimelineSetupText(item.setupCode, language),
        rankScore: formatTimelineScore(item.metrics?.rankScore),
        opportunityScore: formatTimelineScore(item.metrics?.opportunityScore),
        confirmationScore: formatTimelineScore(item.metrics?.confirmationScore),
        riskScore: formatTimelineScore(item.metrics?.riskScore),
        riskText: getTimelineRiskText(item.riskCodes, language),
        statusText: getTimelineStatusText(item, language),
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
  language: Language = "en",
) {
  return explainCode(normalizeGroupCode(value), language).label;
}

export function getTimelineGroupDescription(
  value: string | null | undefined,
  language: Language = "en",
) {
  const groupCode = normalizeGroupCode(value);

  if (language !== "en") {
    return explainCode(groupCode, language).short;
  }

  return groupDescriptions[normalizeGroup(groupCode)];
}

export function getTimelineStatusText(
  item: RawSymbolTimelineSignal,
  language: Language = "en",
) {
  const statusCode =
    item.reasonCodes?.[0] ??
    item.qualityCodes?.[0] ??
    item.actionCode ??
    "NX_801";

  return explainCode(statusCode, language).short;
}

export function getTimelineRiskText(
  value: unknown,
  language: Language = "en",
) {
  if (!Array.isArray(value) || value.length === 0) {
    return getNoSpecificRiskText(language);
  }

  const risks = explainCodes(value as Array<string | null | undefined>, language).map(
    (entry) => entry.label,
  );

  return risks.length > 0 ? risks.join(", ") : getNoSpecificRiskText(language);
}

function getTimelineActionText(
  item: RawSymbolTimelineSignal,
  language: Language,
) {
  return explainCode(item.actionCode, language).label;
}

function getTimelineSignalLabel(
  item: RawSymbolTimelineSignal,
  language: Language,
) {
  const signalCode = item.signalCodes?.[0] ?? item.phaseCode ?? item.setupCode ?? "NX_801";

  return explainCode(signalCode, language).label;
}

function getTimelineSetupText(
  value: string | null | undefined,
  language: Language,
) {
  return explainCode(value, language).label;
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
    item.signalCodes?.join(",") ?? "",
    item.metrics?.rankScore ?? "",
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
  const code = normalizeGroupCode(value);

  if (code === "GR_201") {
    return "watch";
  }

  return Object.prototype.hasOwnProperty.call(resultGroupByGroupCode, code)
    ? resultGroupByGroupCode[code as keyof typeof resultGroupByGroupCode]
    : "neutral";
}

function normalizeGroupCode(value: string | null | undefined) {
  return value === "GR_201" ||
    (value && Object.prototype.hasOwnProperty.call(resultGroupByGroupCode, value))
    ? value
    : "GR_001";
}

function getNoSpecificRiskText(language: Language) {
  return language === "zh" ? "未记录具体风险代码。" : "No specific risk codes noted.";
}

function parseDateMs(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}
