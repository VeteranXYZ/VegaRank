import {
  formatGroupLabel,
  formatScore,
  formatSignalLabel,
  getDetectedRiskTypeLabels,
  normalizeGroupKey,
  type LatestScanGroupKey,
} from "@/components/scanner/latestScanUi";

export const MTF_SCREENER_TIMEFRAMES = ["1h", "4h", "1d", "1w"] as const;
export type MtfScreenerTimeframe = (typeof MTF_SCREENER_TIMEFRAMES)[number];

export const mtfScreenerGroupFilterOptions = [
  "any",
  "eligible",
  "watch",
  "risk",
  "overheated",
  "neutral",
] as const;

export type MtfScreenerGroupFilter =
  (typeof mtfScreenerGroupFilterOptions)[number];

export const mtfScreenerPresetIds = [
  "short_term_repair",
  "mtf_strength",
  "higher_timeframe_safe_watchlist",
  "overheated_caution",
  "breakdown_risk",
] as const;

export type MtfScreenerPresetId = (typeof mtfScreenerPresetIds)[number];

export const mtfScreenerSortOptions = [
  { field: "combined_rank", label: "Screener Rank" },
  { field: "symbol", label: "Symbol" },
  { field: "1h_rank", label: "1h Rank" },
  { field: "4h_rank", label: "4h Rank" },
  { field: "1d_rank", label: "1d Rank" },
  { field: "1w_rank", label: "1w Rank" },
  { field: "higher_timeframe_safety", label: "Higher-Timeframe Safety" },
] as const;

export type MtfScreenerSortField =
  (typeof mtfScreenerSortOptions)[number]["field"];
export type MtfScreenerSortDirection = "desc" | "asc";
export type MtfScreenerSortState = {
  field: MtfScreenerSortField;
  direction: MtfScreenerSortDirection;
};

export type MtfScreenerFilters = {
  groups: Record<MtfScreenerTimeframe, MtfScreenerGroupFilter>;
  minRank: Record<MtfScreenerTimeframe, number>;
  exclude1dRisk: boolean;
  exclude1wRisk: boolean;
};

export type MtfLatestScanRun = {
  id: string;
  timeframe: string;
  status: string;
  symbolsTotal: number;
  symbolsScanned: number;
  signalsCreated: number;
  symbolsSkipped: number;
  startedAt: string;
  finishedAt: string | null;
  isLikelyFullUniverse?: boolean | null;
};

export type MtfLatestScanSummary = {
  totalSignals?: number | null;
  returnedItems?: number | null;
  lowQualityExcluded?: number | null;
};

export type MtfLatestScanItem = {
  id: string;
  scanRunId?: string;
  exchange?: string | null;
  market?: string | null;
  assetClass?: string | null;
  symbol: string;
  timeframe: string;
  group?: string | null;
  resultGroup?: string | null;
  rankScore: number | null;
  signalLabel?: string | null;
  action?: string | null;
  actionBias?: string | null;
  reviewTier?: string | null;
  statusNote?: string | null;
  statusReasons?: string[];
  setupType?: string | null;
  primaryStructure?: string | null;
  scanTime?: string | null;
  detectedRiskTypes?: unknown;
};

export type MtfLatestScanResponse = {
  ok: boolean;
  timeframe: string;
  assetClass: string;
  run: MtfLatestScanRun | null;
  summary: MtfLatestScanSummary | null;
  items: MtfLatestScanItem[];
  count: number;
};

export type MtfLatestScreenerApiRow = {
  symbol: string;
  exchange?: string | null;
  market?: string | null;
  assetClass?: string | null;
  timeframes: Record<MtfScreenerTimeframe, MtfLatestScanItem | null>;
};

export type MtfLatestScreenerResponse = {
  ok: boolean;
  assetClass: string;
  timeframes: readonly MtfScreenerTimeframe[];
  runs: Record<MtfScreenerTimeframe, MtfLatestScanRun | null>;
  signalCounts: Record<MtfScreenerTimeframe, number>;
  missingCounts: Record<MtfScreenerTimeframe, number>;
  count: number;
  rows: MtfLatestScreenerApiRow[];
};

export type MtfScreenerSnapshot = MtfLatestScanItem & {
  timeframe: MtfScreenerTimeframe;
  resultGroup: LatestScanGroupKey;
};

export type MtfScreenerRow = {
  symbol: string;
  exchange: string;
  market: string;
  snapshots: Partial<Record<MtfScreenerTimeframe, MtfScreenerSnapshot>>;
};

export type MtfScreenerPreset = {
  id: MtfScreenerPresetId;
  label: string;
  description: string;
};

export type MtfResearchBucketId = MtfScreenerPresetId;

export type MtfResearchBucket = MtfScreenerPreset & {
  id: MtfResearchBucketId;
  implication: string;
};

export type MtfResearchBucketCount = MtfResearchBucket & {
  count: number;
};

export type MtfHigherTimeframeHealthCode =
  | "higher_tf_ok"
  | "one_day_risk"
  | "one_week_risk"
  | "higher_tf_risk"
  | "limited_htf_data";

export type MtfHigherTimeframeHealth = {
  code: MtfHigherTimeframeHealthCode;
  label: string;
  sortRank: number;
};

export const mtfScreenerPresets: MtfScreenerPreset[] = [
  {
    id: "short_term_repair",
    label: "Short-term Repair",
    description: "1h improving while 4h is still watch/risk and higher timeframes are not risk.",
  },
  {
    id: "mtf_strength",
    label: "MTF Strength",
    description: "1h eligible, 4h and 1d constructive, 1w not risk.",
  },
  {
    id: "higher_timeframe_safe_watchlist",
    label: "Higher-TF Watchlist",
    description: "4h constructive with 1d and 1w not in risk.",
  },
  {
    id: "overheated_caution",
    label: "Overheated Caution",
    description: "1h or 4h is overheated.",
  },
  {
    id: "breakdown_risk",
    label: "Breakdown Risk",
    description: "1h or 4h is in the risk group.",
  },
];

const mtfResearchBucketImplications: Record<MtfResearchBucketId, string> = {
  short_term_repair: "Review group for short-term repair context before deeper research.",
  mtf_strength: "Research set for aligned MTF structure, not a recommendation.",
  higher_timeframe_safe_watchlist: "Triage group for higher-timeframe review context.",
  overheated_caution: "Caution review group for stretched near-term conditions.",
  breakdown_risk: "Risk triage group for defensive review.",
};

export const mtfResearchBuckets: MtfResearchBucket[] = mtfScreenerPresets.map(
  (preset) => ({
    ...preset,
    implication: mtfResearchBucketImplications[preset.id],
  }),
);

export const defaultMtfScreenerFilters: MtfScreenerFilters = {
  groups: {
    "1h": "any",
    "4h": "any",
    "1d": "any",
    "1w": "any",
  },
  minRank: {
    "1h": 0,
    "4h": 0,
    "1d": 0,
    "1w": 0,
  },
  exclude1dRisk: false,
  exclude1wRisk: false,
};

export const defaultMtfScreenerSort: MtfScreenerSortState = {
  field: "combined_rank",
  direction: "desc",
};

export function buildMtfScreenerRows(
  latestByTimeframe: Partial<Record<MtfScreenerTimeframe, MtfLatestScanResponse>>,
) {
  const rowsBySymbol = new Map<string, MtfScreenerRow>();

  for (const timeframe of MTF_SCREENER_TIMEFRAMES) {
    const response = latestByTimeframe[timeframe];

    for (const item of response?.items ?? []) {
      const symbol = item.symbol.trim().toUpperCase();

      if (!symbol) {
        continue;
      }

      const existing = rowsBySymbol.get(symbol) ?? {
        symbol,
        exchange: item.exchange ?? "binance",
        market: item.market ?? "spot",
        snapshots: {},
      };

      existing.snapshots[timeframe] = {
        ...item,
        symbol,
        timeframe,
        resultGroup: normalizeGroupKey(item.resultGroup),
      };
      rowsBySymbol.set(symbol, existing);
    }
  }

  return [...rowsBySymbol.values()].sort(compareMtfScreenerRowsBySymbol);
}

export function buildMtfScreenerRowsFromResponse(
  response: MtfLatestScreenerResponse | undefined,
) {
  const rowsBySymbol = new Map<string, MtfScreenerRow>();

  for (const apiRow of response?.rows ?? []) {
    const symbol = apiRow.symbol.trim().toUpperCase();

    if (!symbol) {
      continue;
    }

    const row: MtfScreenerRow = {
      symbol,
      exchange: apiRow.exchange ?? "binance",
      market: apiRow.market ?? "spot",
      snapshots: {},
    };

    for (const timeframe of MTF_SCREENER_TIMEFRAMES) {
      const snapshot = apiRow.timeframes[timeframe];

      if (!snapshot) {
        continue;
      }

      row.snapshots[timeframe] = {
        ...snapshot,
        symbol,
        exchange: snapshot.exchange ?? apiRow.exchange ?? "binance",
        market: snapshot.market ?? apiRow.market ?? "spot",
        timeframe,
        resultGroup: normalizeGroupKey(snapshot.resultGroup ?? snapshot.group),
      };
    }

    rowsBySymbol.set(symbol, row);
  }

  return [...rowsBySymbol.values()].sort(compareMtfScreenerRowsBySymbol);
}

export function filterMtfScreenerRows(
  rows: MtfScreenerRow[],
  filters: MtfScreenerFilters,
  presetId: MtfScreenerPresetId | "custom" = "custom",
) {
  return rows.filter((row) =>
    presetId === "custom"
      ? doesMtfRowMatchFilters(row, filters)
      : doesMtfRowMatchPreset(row, presetId),
  );
}

export function filterMtfScreenerRowsBySearch(
  rows: MtfScreenerRow[],
  searchQuery: string,
) {
  const normalizedQuery = searchQuery.trim().toUpperCase();

  if (!normalizedQuery) {
    return rows;
  }

  return rows.filter((row) => row.symbol.toUpperCase().includes(normalizedQuery));
}

export function countMtfResearchBuckets(
  rows: MtfScreenerRow[],
): MtfResearchBucketCount[] {
  return mtfResearchBuckets.map((bucket) => ({
    ...bucket,
    count: rows.filter((row) => doesMtfRowMatchResearchBucket(row, bucket.id))
      .length,
  }));
}

export function sortMtfScreenerRows(
  rows: MtfScreenerRow[],
  sort: MtfScreenerSortState = defaultMtfScreenerSort,
) {
  return [...rows].sort((left, right) => compareMtfScreenerRows(left, right, sort));
}

export function doesMtfRowMatchFilters(
  row: MtfScreenerRow,
  filters: MtfScreenerFilters,
) {
  for (const timeframe of MTF_SCREENER_TIMEFRAMES) {
    const groupFilter = filters.groups[timeframe];
    const snapshot = row.snapshots[timeframe];

    if (
      groupFilter !== "any" &&
      (!snapshot || snapshot.resultGroup !== groupFilter)
    ) {
      return false;
    }

    const minRank = filters.minRank[timeframe];

    if (
      Number.isFinite(minRank) &&
      minRank > 0 &&
      (!snapshot ||
        typeof snapshot.rankScore !== "number" ||
        snapshot.rankScore < minRank)
    ) {
      return false;
    }
  }

  if (filters.exclude1dRisk && isMtfRisk(row, "1d")) {
    return false;
  }

  if (filters.exclude1wRisk && isMtfRisk(row, "1w")) {
    return false;
  }

  return true;
}

export function doesMtfRowMatchPreset(
  row: MtfScreenerRow,
  presetId: MtfScreenerPresetId,
) {
  switch (presetId) {
    case "short_term_repair":
      return (
        hasMtfGroup(row, "1h", ["eligible", "watch"]) &&
        hasMtfGroup(row, "4h", ["risk", "watch"]) &&
        !isMtfRisk(row, "1d") &&
        !isMtfRisk(row, "1w")
      );
    case "mtf_strength":
      return (
        hasMtfGroup(row, "1h", ["eligible"]) &&
        hasMtfGroup(row, "4h", ["eligible", "watch"]) &&
        hasMtfGroup(row, "1d", ["eligible", "watch"]) &&
        !isMtfRisk(row, "1w")
      );
    case "higher_timeframe_safe_watchlist":
      return (
        hasMtfGroup(row, "4h", ["eligible", "watch"]) &&
        !isMtfRisk(row, "1d") &&
        !isMtfRisk(row, "1w")
      );
    case "overheated_caution":
      return hasMtfGroup(row, "1h", ["overheated"]) || hasMtfGroup(row, "4h", ["overheated"]);
    case "breakdown_risk":
      return isMtfRisk(row, "1h") || isMtfRisk(row, "4h");
  }
}

export function doesMtfRowMatchResearchBucket(
  row: MtfScreenerRow,
  bucketId: MtfResearchBucketId,
) {
  return doesMtfRowMatchPreset(row, bucketId);
}

export function getMtfPresetDescription(
  presetId: MtfScreenerPresetId | "custom",
) {
  return mtfScreenerPresets.find((preset) => preset.id === presetId)?.description ?? null;
}

export function getMtfSymbolResearchTimeframe(row: MtfScreenerRow) {
  if (row.snapshots["4h"]) {
    return "4h";
  }

  return (
    MTF_SCREENER_TIMEFRAMES.find((timeframe) => row.snapshots[timeframe]) ?? "4h"
  );
}

export function buildMtfSymbolResearchHref({
  row,
  timeframe = getMtfSymbolResearchTimeframe(row),
  assetClass = "crypto",
}: {
  row: MtfScreenerRow;
  timeframe?: string;
  assetClass?: string;
}) {
  const params = new URLSearchParams({
    timeframe,
    assetClass,
    from: "screener",
  });

  return `/symbol/${encodeURIComponent(row.exchange)}/${encodeURIComponent(
    row.symbol,
  )}?${params.toString()}`;
}

export function formatMtfGroup(snapshot: MtfScreenerSnapshot | undefined) {
  return snapshot ? formatGroupLabel(snapshot.resultGroup) : "Not returned";
}

export function formatMtfRank(snapshot: MtfScreenerSnapshot | undefined) {
  return snapshot ? formatScore(snapshot.rankScore) : "-";
}

export function getMtfCombinedRank(row: MtfScreenerRow) {
  let weightedTotal = 0;
  let weightTotal = 0;

  for (const timeframe of MTF_SCREENER_TIMEFRAMES) {
    const rankScore = row.snapshots[timeframe]?.rankScore;

    if (typeof rankScore !== "number" || !Number.isFinite(rankScore)) {
      continue;
    }

    const weight = getMtfRankWeight(timeframe);
    weightedTotal += rankScore * weight;
    weightTotal += weight;
  }

  return weightTotal > 0 ? weightedTotal / weightTotal : null;
}

export function formatMtfCombinedRank(row: MtfScreenerRow) {
  return formatScore(getMtfCombinedRank(row));
}

export function getMtfHigherTimeframeHealth(
  row: MtfScreenerRow,
): MtfHigherTimeframeHealth {
  const oneDay = row.snapshots["1d"];
  const oneWeek = row.snapshots["1w"];
  const oneDayRisk = oneDay?.resultGroup === "risk";
  const oneWeekRisk = oneWeek?.resultGroup === "risk";

  if (oneDayRisk && oneWeekRisk) {
    return {
      code: "higher_tf_risk",
      label: "Higher TF Risk",
      sortRank: 0,
    };
  }

  if (oneDayRisk) {
    return {
      code: "one_day_risk",
      label: "1d Risk",
      sortRank: 1,
    };
  }

  if (oneWeekRisk) {
    return {
      code: "one_week_risk",
      label: "1w Risk",
      sortRank: 1,
    };
  }

  if (!oneDay || !oneWeek) {
    return {
      code: "limited_htf_data",
      label: "Limited HTF Data",
      sortRank: 2,
    };
  }

  return {
    code: "higher_tf_ok",
    label: "Higher TF OK",
    sortRank: 3,
  };
}

export function getMtfPrimarySignal(row: MtfScreenerRow) {
  const preferredTimeframes: MtfScreenerTimeframe[] = ["4h", "1h", "1d", "1w"];
  const snapshot =
    preferredTimeframes
      .map((timeframe) => row.snapshots[timeframe])
      .find((item) => item && item.resultGroup !== "neutral") ??
    preferredTimeframes
      .map((timeframe) => row.snapshots[timeframe])
      .find(Boolean);

  if (!snapshot) {
    return "No latest signal";
  }

  return `${snapshot.timeframe} ${formatSignalLabel(snapshot.signalLabel)} / ${formatGroupLabel(snapshot.resultGroup)}`;
}

export function getMtfRiskNoteItems(row: MtfScreenerRow) {
  const notes: string[] = [];

  for (const timeframe of MTF_SCREENER_TIMEFRAMES) {
    const snapshot = row.snapshots[timeframe];

    if (!snapshot) {
      continue;
    }

    const riskLabels = getDetectedRiskTypeLabels(snapshot.detectedRiskTypes);

    if (riskLabels.length > 0) {
      notes.push(`${timeframe}: ${riskLabels.join(", ")}`);
      continue;
    }

    if (snapshot.resultGroup === "risk") {
      notes.push(`${timeframe}: Risk group`);
    } else if (snapshot.resultGroup === "overheated") {
      notes.push(`${timeframe}: Overheated`);
    }
  }

  return uniqueStrings(notes);
}

export function getMtfRiskNotesSummary(
  row: MtfScreenerRow,
  visibleCount = 3,
) {
  const notes = getMtfRiskNoteItems(row);
  const safeVisibleCount = Math.max(1, Math.floor(visibleCount));
  const visibleNotes = notes.slice(0, safeVisibleCount);
  const hiddenNotes = notes.slice(safeVisibleCount);

  return {
    notes,
    visibleNotes,
    hiddenNotes,
    hiddenCount: hiddenNotes.length,
  };
}

export function getMtfRiskNotes(row: MtfScreenerRow) {
  const { notes } = getMtfRiskNotesSummary(row, 4);

  return notes.length > 0 ? notes.slice(0, 4).join("; ") : "-";
}

export function getMtfRunFinishedAt(response: MtfLatestScanResponse | undefined) {
  return response?.run?.finishedAt ?? response?.run?.startedAt ?? null;
}

function hasMtfGroup(
  row: MtfScreenerRow,
  timeframe: MtfScreenerTimeframe,
  groups: LatestScanGroupKey[],
) {
  const group = row.snapshots[timeframe]?.resultGroup;

  return group ? groups.includes(group) : false;
}

function isMtfRisk(row: MtfScreenerRow, timeframe: MtfScreenerTimeframe) {
  return row.snapshots[timeframe]?.resultGroup === "risk";
}

function compareMtfScreenerRows(
  left: MtfScreenerRow,
  right: MtfScreenerRow,
  sort: MtfScreenerSortState = defaultMtfScreenerSort,
) {
  const sortDelta = getMtfSortDelta(left, right, sort);

  if (sortDelta !== 0) {
    return sortDelta;
  }

  return left.symbol.localeCompare(right.symbol);
}

function getMtfSortDelta(
  left: MtfScreenerRow,
  right: MtfScreenerRow,
  sort: MtfScreenerSortState,
) {
  if (sort.field === "symbol") {
    const symbolDelta = left.symbol.localeCompare(right.symbol);

    return sort.direction === "asc" ? symbolDelta : -symbolDelta;
  }

  const leftValue = getMtfSortValue(left, sort.field);
  const rightValue = getMtfSortValue(right, sort.field);

  return compareNullableNumbers(leftValue, rightValue, sort.direction);
}

function getMtfSortValue(
  row: MtfScreenerRow,
  field: MtfScreenerSortField,
) {
  switch (field) {
    case "combined_rank":
      return getMtfCombinedRank(row);
    case "1h_rank":
      return row.snapshots["1h"]?.rankScore ?? null;
    case "4h_rank":
      return row.snapshots["4h"]?.rankScore ?? null;
    case "1d_rank":
      return row.snapshots["1d"]?.rankScore ?? null;
    case "1w_rank":
      return row.snapshots["1w"]?.rankScore ?? null;
    case "higher_timeframe_safety":
      return getMtfHigherTimeframeHealth(row).sortRank;
    case "symbol":
      return null;
  }
}

function compareNullableNumbers(
  left: number | null,
  right: number | null,
  direction: MtfScreenerSortDirection,
) {
  const leftMissing = left === null || !Number.isFinite(left);
  const rightMissing = right === null || !Number.isFinite(right);

  if (leftMissing && rightMissing) {
    return 0;
  }

  if (leftMissing) {
    return 1;
  }

  if (rightMissing) {
    return -1;
  }

  const delta = left - right;

  return direction === "asc" ? delta : -delta;
}

function compareMtfScreenerRowsBySymbol(
  left: MtfScreenerRow,
  right: MtfScreenerRow,
) {
  return left.symbol.localeCompare(right.symbol);
}

function getMtfRankWeight(timeframe: MtfScreenerTimeframe) {
  switch (timeframe) {
    case "4h":
    case "1d":
      return 2;
    case "1h":
    case "1w":
      return 1;
  }
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    const key = value.toLowerCase();

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(value);
    }
  }

  return unique;
}
