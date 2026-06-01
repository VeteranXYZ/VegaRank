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
  symbol: string;
  timeframe: string;
  resultGroup?: string | null;
  rankScore: number | null;
  signalLabel?: string | null;
  actionBias?: string | null;
  reviewTier?: string | null;
  statusNote?: string | null;
  statusReasons?: string[];
  primaryStructure?: string | null;
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

export const mtfScreenerPresets: MtfScreenerPreset[] = [
  {
    id: "short_term_repair",
    label: "Short-term Repair",
    description: "1h improving while 4h is still watch/risk and higher timeframes are not risk.",
  },
  {
    id: "mtf_strength",
    label: "Multi-timeframe Strength",
    description: "1h eligible, 4h and 1d constructive, 1w not risk.",
  },
  {
    id: "higher_timeframe_safe_watchlist",
    label: "Higher-timeframe Safe Watchlist",
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

  return [...rowsBySymbol.values()].sort(compareMtfScreenerRows);
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

export function getMtfRiskNotes(row: MtfScreenerRow) {
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

  return notes.length > 0 ? uniqueStrings(notes).slice(0, 4).join("; ") : "-";
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

function compareMtfScreenerRows(left: MtfScreenerRow, right: MtfScreenerRow) {
  const rankDelta =
    getBestMtfRank(right) - getBestMtfRank(left);

  if (rankDelta !== 0) {
    return rankDelta;
  }

  return left.symbol.localeCompare(right.symbol);
}

function getBestMtfRank(row: MtfScreenerRow) {
  return Math.max(
    ...MTF_SCREENER_TIMEFRAMES.map(
      (timeframe) => row.snapshots[timeframe]?.rankScore ?? Number.NEGATIVE_INFINITY,
    ),
  );
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
