import {
  MTF_SCREENER_TIMEFRAMES,
  getMtfHigherTimeframeHealth,
  getMtfRiskNoteItems,
  type MtfScreenerRow,
  type MtfScreenerTimeframe,
} from "@/components/screener/multiTimeframeScreenerUi";
import { formatGroupLabel, formatScore } from "@/components/rankings/latestRankingsUi";
import {
  buildSymbolResearchHref,
  type ResearchNavigationContext,
} from "@/lib/navigation/researchNavigation";

export const WATCHLIST_STORAGE_KEY = "vegarank.watchlist.symbols";
export const LEGACY_WATCHLIST_STORAGE_KEY = "trade-scanner.watchlist.symbols";
export const DEFAULT_WATCHLIST_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "LINKUSDT",
  "SEIUSDT",
] as const;

export const watchlistPresets = [
  {
    id: "majors",
    label: "Majors",
    symbols: [
      "BTCUSDT",
      "ETHUSDT",
      "SOLUSDT",
      "BNBUSDT",
      "XRPUSDT",
      "LINKUSDT",
      "ADAUSDT",
      "DOGEUSDT",
    ],
  },
  {
    id: "ai",
    label: "AI",
    symbols: [
      "FETUSDT",
      "RENDERUSDT",
      "TAOUSDT",
      "WLDUSDT",
      "AIXBTUSDT",
      "VIRTUALUSDT",
      "CGPTUSDT",
    ],
  },
  {
    id: "defi",
    label: "DeFi",
    symbols: [
      "UNIUSDT",
      "AAVEUSDT",
      "CRVUSDT",
      "PENDLEUSDT",
      "LDOUSDT",
      "CAKEUSDT",
      "ENAUSDT",
    ],
  },
  {
    id: "meme",
    label: "Meme",
    symbols: [
      "DOGEUSDT",
      "SHIBUSDT",
      "PEPEUSDT",
      "BONKUSDT",
      "FLOKIUSDT",
      "WIFUSDT",
      "PENGUUSDT",
    ],
  },
  {
    id: "layer1_infra",
    label: "Layer 1 / Infra",
    symbols: [
      "BTCUSDT",
      "ETHUSDT",
      "SOLUSDT",
      "BNBUSDT",
      "ADAUSDT",
      "AVAXUSDT",
      "SUIUSDT",
      "NEARUSDT",
      "SEIUSDT",
      "TONUSDT",
    ],
  },
] as const;

export type WatchlistPresetId = (typeof watchlistPresets)[number]["id"];

export const watchlistSortOptions = [
  { field: "symbol", label: "Symbol" },
  { field: "1h_rank", label: "1h Rank Score" },
  { field: "4h_rank", label: "4h Rank Score" },
  { field: "1d_rank", label: "1d Rank Score" },
  { field: "1w_rank", label: "1w Rank Score" },
  { field: "higher_timeframe_safety", label: "Higher-Timeframe Context" },
  { field: "best_short_term_rank", label: "Short-Term Rank Score" },
] as const;

export type WatchlistSortField =
  (typeof watchlistSortOptions)[number]["field"];
export type WatchlistSortDirection = "asc" | "desc";
export type WatchlistSortState = {
  field: WatchlistSortField;
  direction: WatchlistSortDirection;
};

export type WatchlistFilters = {
  symbolSearch: string;
  hideMissing: boolean;
  exclude1dRisk: boolean;
  exclude1wRisk: boolean;
  onlyShortTermWatch: boolean;
};

export type WatchlistRow = {
  symbol: string;
  inputIndex: number;
  mtfRow: MtfScreenerRow | null;
};

export type WatchlistSummary = {
  totalSelectedSymbols: number;
  foundSymbols: number;
  missingSymbols: number;
  higherTimeframeRiskSymbols: number;
  shortTermWatchSymbols: number;
};

export type WatchlistResearchCondition =
  | "Broad risk"
  | "Short-term repair inside higher-timeframe risk"
  | "Mixed / selective"
  | "Higher-timeframe improving"
  | "Insufficient data";

export type WatchlistResearchPosture =
  | "Defensive review"
  | "Selective watchlist review"
  | "Repair review only"
  | "Mostly wait"
  | "Data incomplete";

export type WatchlistResearchSummaryCounts = {
  totalSelectedSymbols: number;
  foundSymbols: number;
  missingSymbols: number;
  oneDayRiskSymbols: number;
  oneWeekRiskSymbols: number;
  shortTermWatchSymbols: number;
  repairInsideRiskSymbols: number;
  broadRiskSymbols: number;
  missingImportantDataSymbols: number;
};

export type WatchlistResearchSummaryItem = {
  symbol: string;
  timeframe: MtfScreenerTimeframe | null;
  reason: string;
  rankScore: number | null;
};

export type WatchlistResearchSummary = {
  conditionLabel: WatchlistResearchCondition;
  conditionText: string;
  researchPosture: WatchlistResearchPosture;
  counts: WatchlistResearchSummaryCounts;
  bestResearchCandidates: WatchlistResearchSummaryItem[];
  highestRiskSymbols: WatchlistResearchSummaryItem[];
  missingDataSymbols: WatchlistResearchSummaryItem[];
};

export type WatchlistStorage = Pick<Storage, "getItem" | "setItem">;

export const defaultWatchlistFilters: WatchlistFilters = {
  symbolSearch: "",
  hideMissing: false,
  exclude1dRisk: false,
  exclude1wRisk: false,
  onlyShortTermWatch: false,
};

export const defaultWatchlistSort: WatchlistSortState = {
  field: "symbol",
  direction: "asc",
};

export function parseWatchlistSymbols(input: string) {
  const symbols: string[] = [];
  const seen = new Set<string>();

  for (const token of input.split(/[\s,]+/)) {
    const symbol = normalizeWatchlistSymbol(token);

    if (!symbol || seen.has(symbol)) {
      continue;
    }

    seen.add(symbol);
    symbols.push(symbol);
  }

  return symbols;
}

export function normalizeWatchlistSymbol(value: string) {
  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (!normalized) {
    return null;
  }

  return normalized.endsWith("USDT") ? normalized : `${normalized}USDT`;
}

export function formatWatchlistInput(symbols: readonly string[]) {
  return normalizeWatchlistSymbols(symbols).join(", ");
}

export function getWatchlistPresetSymbols(presetId: WatchlistPresetId) {
  return (
    watchlistPresets.find((preset) => preset.id === presetId)?.symbols ?? []
  );
}

export function applyWatchlistPreset(presetId: WatchlistPresetId) {
  return normalizeWatchlistSymbols(getWatchlistPresetSymbols(presetId));
}

export function buildWatchlistExportText(symbols: readonly string[]) {
  return formatWatchlistInput(symbols);
}

export function importWatchlistSymbols(input: string) {
  return parseWatchlistSymbols(input);
}

export function loadWatchlistSymbols(
  storage: WatchlistStorage | null | undefined,
  defaultSymbols: readonly string[] = DEFAULT_WATCHLIST_SYMBOLS,
) {
  if (!storage) {
    return [...defaultSymbols];
  }

  let rawValue: string | null = null;

  try {
    rawValue = storage.getItem(WATCHLIST_STORAGE_KEY);

    if (rawValue === null || rawValue.trim() === "") {
      const legacyRawValue = storage.getItem(LEGACY_WATCHLIST_STORAGE_KEY);

      if (legacyRawValue !== null && legacyRawValue.trim() !== "") {
        rawValue = legacyRawValue;
        storage.setItem(WATCHLIST_STORAGE_KEY, legacyRawValue);
      }
    }
  } catch {
    return [...defaultSymbols];
  }

  if (rawValue === null || rawValue.trim() === "") {
    return [...defaultSymbols];
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (Array.isArray(parsed)) {
      return normalizeWatchlistSymbols(parsed.map(String));
    }

    if (typeof parsed === "string") {
      return parseWatchlistSymbols(parsed);
    }
  } catch {
    return parseWatchlistSymbols(rawValue);
  }

  return [...defaultSymbols];
}

export function saveWatchlistSymbols(
  storage: WatchlistStorage | null | undefined,
  symbols: readonly string[],
) {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(
      WATCHLIST_STORAGE_KEY,
      JSON.stringify(normalizeWatchlistSymbols(symbols)),
    );
  } catch {
    return;
  }
}

export function isSymbolInWatchlist(
  symbols: readonly string[],
  symbol: string,
) {
  const normalizedSymbol = normalizeWatchlistSymbol(symbol);

  return normalizedSymbol
    ? normalizeWatchlistSymbols(symbols).includes(normalizedSymbol)
    : false;
}

export function addWatchlistSymbol(
  symbols: readonly string[],
  symbol: string,
) {
  const normalizedSymbol = normalizeWatchlistSymbol(symbol);
  const normalizedSymbols = normalizeWatchlistSymbols(symbols);

  if (!normalizedSymbol || normalizedSymbols.includes(normalizedSymbol)) {
    return normalizedSymbols;
  }

  return [...normalizedSymbols, normalizedSymbol];
}

export function removeWatchlistSymbol(
  symbols: readonly string[],
  symbol: string,
) {
  const normalizedSymbol = normalizeWatchlistSymbol(symbol);

  if (!normalizedSymbol) {
    return normalizeWatchlistSymbols(symbols);
  }

  return normalizeWatchlistSymbols(symbols).filter(
    (currentSymbol) => currentSymbol !== normalizedSymbol,
  );
}

export function addWatchlistSymbolToStorage({
  storage,
  symbol,
}: {
  storage: WatchlistStorage | null | undefined;
  symbol: string;
}) {
  const currentSymbols = loadWatchlistSymbols(storage);
  const nextSymbols = addWatchlistSymbol(currentSymbols, symbol);

  saveWatchlistSymbols(storage, nextSymbols);

  return {
    symbol: normalizeWatchlistSymbol(symbol),
    symbols: nextSymbols,
    added: nextSymbols.length > currentSymbols.length,
  };
}

export function buildWatchlistRows(
  symbols: readonly string[],
  mtfRows: readonly MtfScreenerRow[],
) {
  const rowsBySymbol = new Map(
    mtfRows.map((row) => [row.symbol.toUpperCase(), row]),
  );

  return normalizeWatchlistSymbols(symbols).map((symbol, inputIndex) => ({
    symbol,
    inputIndex,
    mtfRow: rowsBySymbol.get(symbol) ?? null,
  }));
}

export function getWatchlistSummary(
  rows: readonly WatchlistRow[],
): WatchlistSummary {
  return {
    totalSelectedSymbols: rows.length,
    foundSymbols: rows.filter((row) => row.mtfRow).length,
    missingSymbols: rows.filter((row) => !row.mtfRow).length,
    higherTimeframeRiskSymbols: rows.filter(hasHigherTimeframeRisk).length,
    shortTermWatchSymbols: rows.filter(hasShortTermWatchState).length,
  };
}

export function buildWatchlistResearchSummary(
  rows: readonly WatchlistRow[],
  limit = 5,
): WatchlistResearchSummary {
  const safeLimit = Math.max(1, Math.floor(limit));
  const foundRows = rows.filter((row) => row.mtfRow);
  const cleanerCandidateRows = rows.filter(isCleanerCandidate);
  const counts: WatchlistResearchSummaryCounts = {
    totalSelectedSymbols: rows.length,
    foundSymbols: foundRows.length,
    missingSymbols: rows.length - foundRows.length,
    oneDayRiskSymbols: rows.filter((row) => hasTimeframeRisk(row, "1d")).length,
    oneWeekRiskSymbols: rows.filter((row) => hasTimeframeRisk(row, "1w")).length,
    shortTermWatchSymbols: rows.filter(hasShortTermWatchState).length,
    repairInsideRiskSymbols: rows.filter(isRepairInsideRisk).length,
    broadRiskSymbols: rows.filter(isBroadRisk).length,
    missingImportantDataSymbols: rows.filter(hasMissingImportantData).length,
  };
  const conditionLabel = getResearchConditionLabel({
    counts,
    cleanerCandidateCount: cleanerCandidateRows.length,
  });

  return {
    conditionLabel,
    conditionText: getResearchConditionText(conditionLabel),
    researchPosture: getResearchPosture({
      conditionLabel,
      counts,
      cleanerCandidateCount: cleanerCandidateRows.length,
    }),
    counts,
    bestResearchCandidates: rows
      .filter(hasShortTermWatchState)
      .sort(compareResearchCandidates)
      .slice(0, safeLimit)
      .map(buildResearchCandidateItem),
    highestRiskSymbols: rows
      .filter(hasRiskReviewReason)
      .sort(compareRiskRows)
      .slice(0, safeLimit)
      .map(buildHighestRiskItem),
    missingDataSymbols: rows
      .filter(hasMissingImportantData)
      .slice(0, safeLimit)
      .map(buildMissingDataItem),
  };
}

export function filterWatchlistRows(
  rows: readonly WatchlistRow[],
  filters: WatchlistFilters,
) {
  const symbolSearch = filters.symbolSearch.trim().toUpperCase();

  return rows.filter((row) => {
    if (symbolSearch && !row.symbol.includes(symbolSearch)) {
      return false;
    }

    if (filters.hideMissing && !row.mtfRow) {
      return false;
    }

    if (filters.exclude1dRisk && hasTimeframeRisk(row, "1d")) {
      return false;
    }

    if (filters.exclude1wRisk && hasTimeframeRisk(row, "1w")) {
      return false;
    }

    if (filters.onlyShortTermWatch && !hasShortTermWatchState(row)) {
      return false;
    }

    return true;
  });
}

export function sortWatchlistRows(
  rows: readonly WatchlistRow[],
  sort: WatchlistSortState = defaultWatchlistSort,
) {
  return [...rows].sort((left, right) => compareWatchlistRows(left, right, sort));
}

export function getWatchlistResearchTimeframe(row: WatchlistRow) {
  if (!row.mtfRow) {
    return null;
  }

  if (row.mtfRow.snapshots["4h"]) {
    return "4h";
  }

  const fallbackTimeframes: MtfScreenerTimeframe[] = ["1h", "1d", "1w"];

  return (
    fallbackTimeframes.find((timeframe) => row.mtfRow?.snapshots[timeframe]) ??
    null
  );
}

export function buildWatchlistResearchHref({
  row,
  timeframe = getWatchlistResearchTimeframe(row),
  assetClass = "crypto",
  context,
}: {
  row: WatchlistRow;
  timeframe?: MtfScreenerTimeframe | null;
  assetClass?: string;
  context?: ResearchNavigationContext;
}) {
  if (!row.mtfRow || !timeframe) {
    return null;
  }

  return buildSymbolResearchHref({
    ...context,
    exchange: row.mtfRow.exchange,
    symbol: row.symbol,
    timeframe,
    assetClass,
    from: "watchlist",
  });
}

export function hasHigherTimeframeRisk(row: WatchlistRow) {
  return hasTimeframeRisk(row, "1d") || hasTimeframeRisk(row, "1w");
}

export function hasShortTermWatchState(row: WatchlistRow) {
  return (
    hasTimeframeGroup(row, "1h", ["eligible", "watch"]) ||
    hasTimeframeGroup(row, "4h", ["eligible", "watch"])
  );
}

export function hasBroadRisk(row: WatchlistRow) {
  return isBroadRisk(row);
}

export function getWatchlistRank(
  row: WatchlistRow,
  timeframe: MtfScreenerTimeframe,
) {
  const rankScore = row.mtfRow?.snapshots[timeframe]?.metrics.rankScore;

  return typeof rankScore === "number" && Number.isFinite(rankScore)
    ? rankScore
    : null;
}

export function getBestShortTermRank(row: WatchlistRow) {
  const ranks = [getWatchlistRank(row, "1h"), getWatchlistRank(row, "4h")].filter(
    (rank): rank is number => typeof rank === "number",
  );

  return ranks.length > 0 ? Math.max(...ranks) : null;
}

function getResearchConditionLabel({
  counts,
  cleanerCandidateCount,
}: {
  counts: WatchlistResearchSummaryCounts;
  cleanerCandidateCount: number;
}): WatchlistResearchCondition {
  if (counts.totalSelectedSymbols === 0 || counts.foundSymbols === 0) {
    return "Insufficient data";
  }

  if (
    counts.broadRiskSymbols > 0 &&
    counts.broadRiskSymbols >= Math.ceil(counts.foundSymbols / 2)
  ) {
    return "Broad risk";
  }

  if (counts.repairInsideRiskSymbols > 0) {
    return "Short-term repair inside higher-timeframe risk";
  }

  if (cleanerCandidateCount > 0) {
    return "Higher-timeframe improving";
  }

  return "Mixed / selective";
}

function getResearchConditionText(conditionLabel: WatchlistResearchCondition) {
  switch (conditionLabel) {
    case "Broad risk":
      return "Multiple selected symbols carry risk across 4h, 1d, or 1w, so review defensively.";
    case "Short-term repair inside higher-timeframe risk":
      return "Some 1h or 4h repair is present, but higher-timeframe risk remains the main context.";
    case "Higher-timeframe improving":
      return "Selected symbols include cleaner 4h watch context with limited higher-timeframe risk.";
    case "Mixed / selective":
      return "The watchlist is mixed; use symbol research for selective manual review.";
    case "Insufficient data":
      return "Not enough selected symbols have latest research snapshot data to summarize.";
  }
}

function getResearchPosture({
  conditionLabel,
  counts,
  cleanerCandidateCount,
}: {
  conditionLabel: WatchlistResearchCondition;
  counts: WatchlistResearchSummaryCounts;
  cleanerCandidateCount: number;
}): WatchlistResearchPosture {
  if (
    conditionLabel === "Insufficient data" ||
    counts.missingSymbols === counts.totalSelectedSymbols
  ) {
    return "Data incomplete";
  }

  if (conditionLabel === "Broad risk") {
    return "Defensive review";
  }

  if (
    counts.repairInsideRiskSymbols > 0 &&
    cleanerCandidateCount === 0
  ) {
    return "Repair review only";
  }

  if (cleanerCandidateCount > 0 || counts.shortTermWatchSymbols > 0) {
    return "Selective watchlist review";
  }

  return "Mostly wait";
}

function buildResearchCandidateItem(
  row: WatchlistRow,
): WatchlistResearchSummaryItem {
  const timeframe = getPrimaryShortTermTimeframe(row);

  return {
    symbol: row.symbol,
    timeframe,
    reason: buildResearchCandidateReason(row, timeframe),
    rankScore: timeframe ? getWatchlistRank(row, timeframe) : null,
  };
}

function buildHighestRiskItem(row: WatchlistRow): WatchlistResearchSummaryItem {
  const timeframe = getPrimaryRiskTimeframe(row);

  return {
    symbol: row.symbol,
    timeframe,
    reason: buildHighestRiskReason(row),
    rankScore: timeframe ? getWatchlistRank(row, timeframe) : null,
  };
}

function buildMissingDataItem(row: WatchlistRow): WatchlistResearchSummaryItem {
  return {
    symbol: row.symbol,
    timeframe: getWatchlistResearchTimeframe(row),
    reason: buildMissingDataReason(row),
    rankScore: null,
  };
}

function buildResearchCandidateReason(
  row: WatchlistRow,
  timeframe: MtfScreenerTimeframe | null,
) {
  const primaryText = timeframe
    ? `${timeframe} ${getTimeframeGroupLabel(row, timeframe)}`
    : "Short-term watch context";
  const context = getHigherTimeframeContext(row);

  return `${primaryText} with ${context}.`;
}

function buildHighestRiskReason(row: WatchlistRow) {
  const riskGroups = MTF_SCREENER_TIMEFRAMES.filter((timeframe) =>
    hasTimeframeRisk(row, timeframe),
  ).map((timeframe) => `${timeframe} risk`);
  const lowRanks = MTF_SCREENER_TIMEFRAMES.flatMap((timeframe) => {
    const rank = getWatchlistRank(row, timeframe);

    return typeof rank === "number" && rank <= 0
      ? [`${timeframe} rank ${formatScore(rank)}`]
      : [];
  });
  const riskNotes = row.mtfRow ? getMtfRiskNoteItems(row.mtfRow) : [];
  const reasonParts = [
    ...riskGroups,
    ...lowRanks,
    ...(riskNotes.length > 0 ? ["detected risk notes present"] : []),
  ];

  return `${
    uniqueStrings(reasonParts).slice(0, 3).join("; ") || "Manual risk review"
  }.`;
}

function buildMissingDataReason(row: WatchlistRow) {
  if (!row.mtfRow) {
    return "No latest research snapshot available.";
  }

  const missing = (["1d", "1w"] as const).filter(
    (timeframe) => !row.mtfRow?.snapshots[timeframe],
  );

  return `Missing ${missing.join(" and ")} data.`;
}

function getHigherTimeframeContext(row: WatchlistRow) {
  const parts = (["1d", "1w"] as const).map((timeframe) => {
    const snapshot = row.mtfRow?.snapshots[timeframe];

    if (!snapshot) {
      return `${timeframe} missing snapshot`;
    }

    if (snapshot.resultGroup === "risk") {
      return `${timeframe} risk remains`;
    }

    return `${timeframe} ${formatGroupLabel(snapshot.resultGroup)}`;
  });

  return parts.join(" and ");
}

function getPrimaryShortTermTimeframe(row: WatchlistRow) {
  if (hasTimeframeGroup(row, "4h", ["eligible", "watch"])) {
    return "4h";
  }

  if (hasTimeframeGroup(row, "1h", ["eligible", "watch"])) {
    return "1h";
  }

  return null;
}

function getPrimaryRiskTimeframe(row: WatchlistRow) {
  const preferredRiskTimeframes: MtfScreenerTimeframe[] = [
    "4h",
    "1d",
    "1w",
    "1h",
  ];

  return (
    preferredRiskTimeframes.find((timeframe) =>
      hasTimeframeRisk(row, timeframe),
    ) ??
    getWatchlistResearchTimeframe(row)
  );
}

function getTimeframeGroupLabel(
  row: WatchlistRow,
  timeframe: MtfScreenerTimeframe,
) {
  const group = row.mtfRow?.snapshots[timeframe]?.resultGroup;

  return group ? formatGroupLabel(group) : "N/A";
}

function isCleanerCandidate(row: WatchlistRow) {
  return (
    hasTimeframeGroup(row, "4h", ["eligible", "watch"]) &&
    !hasTimeframeRisk(row, "1d") &&
    !hasTimeframeRisk(row, "1w")
  );
}

function isRepairInsideRisk(row: WatchlistRow) {
  return hasShortTermWatchState(row) && hasHigherTimeframeRisk(row);
}

function isBroadRisk(row: WatchlistRow) {
  const riskCount = (["4h", "1d", "1w"] as const).filter((timeframe) =>
    hasTimeframeRisk(row, timeframe),
  ).length;

  return (
    riskCount >= 2 ||
    (hasTimeframeRisk(row, "4h") && hasTimeframeRisk(row, "1d"))
  );
}

function hasRiskReviewReason(row: WatchlistRow) {
  if (!row.mtfRow) {
    return false;
  }

  return (
    isBroadRisk(row) ||
    (hasTimeframeRisk(row, "4h") && hasHigherTimeframeRisk(row)) ||
    MTF_SCREENER_TIMEFRAMES.some((timeframe) => {
      const rank = getWatchlistRank(row, timeframe);

      return typeof rank === "number" && rank <= 0;
    }) ||
    getMtfRiskNoteItems(row.mtfRow).length > 0
  );
}

function hasMissingImportantData(row: WatchlistRow) {
  return (
    !row.mtfRow || !row.mtfRow.snapshots["1d"] || !row.mtfRow.snapshots["1w"]
  );
}

function compareResearchCandidates(left: WatchlistRow, right: WatchlistRow) {
  const scoreDelta =
    getResearchCandidateScore(right) - getResearchCandidateScore(left);

  if (scoreDelta !== 0) {
    return scoreDelta;
  }

  return (
    left.inputIndex - right.inputIndex ||
    left.symbol.localeCompare(right.symbol)
  );
}

function getResearchCandidateScore(row: WatchlistRow) {
  return (
    (isCleanerCandidate(row) ? 100 : 0) +
    (isRepairInsideRisk(row) ? 45 : 0) +
    (hasTimeframeGroup(row, "4h", ["eligible"]) ? 35 : 0) +
    (hasTimeframeGroup(row, "4h", ["watch"]) ? 25 : 0) +
    (hasTimeframeGroup(row, "1h", ["eligible"]) ? 20 : 0) +
    (hasTimeframeGroup(row, "1h", ["watch"]) ? 10 : 0) +
    (getBestShortTermRank(row) ?? 0) / 10
  );
}

function compareRiskRows(left: WatchlistRow, right: WatchlistRow) {
  const scoreDelta = getRiskReviewScore(right) - getRiskReviewScore(left);

  if (scoreDelta !== 0) {
    return scoreDelta;
  }

  return (
    left.inputIndex - right.inputIndex ||
    left.symbol.localeCompare(right.symbol)
  );
}

function getRiskReviewScore(row: WatchlistRow) {
  const riskGroupScore = MTF_SCREENER_TIMEFRAMES.filter((timeframe) =>
    hasTimeframeRisk(row, timeframe),
  ).length * 40;
  const lowRankScore = MTF_SCREENER_TIMEFRAMES.reduce((total, timeframe) => {
    const rank = getWatchlistRank(row, timeframe);

    return typeof rank === "number" && rank <= 0
      ? total + Math.abs(rank)
      : total;
  }, 0);
  const riskNoteScore = row.mtfRow
    ? getMtfRiskNoteItems(row.mtfRow).length * 10
    : 0;

  return (
    riskGroupScore +
    (isBroadRisk(row) ? 40 : 0) +
    (hasTimeframeRisk(row, "4h") ? 20 : 0) +
    lowRankScore +
    riskNoteScore
  );
}

export function normalizeWatchlistSymbols(symbols: readonly string[]) {
  const seen = new Set<string>();
  const normalizedSymbols: string[] = [];

  for (const value of symbols) {
    const symbol = normalizeWatchlistSymbol(value);

    if (!symbol || seen.has(symbol)) {
      continue;
    }

    seen.add(symbol);
    normalizedSymbols.push(symbol);
  }

  return normalizedSymbols;
}

function hasTimeframeRisk(
  row: WatchlistRow,
  timeframe: MtfScreenerTimeframe,
) {
  return row.mtfRow?.snapshots[timeframe]?.resultGroup === "risk";
}

function hasTimeframeGroup(
  row: WatchlistRow,
  timeframe: MtfScreenerTimeframe,
  groups: string[],
) {
  const group = row.mtfRow?.snapshots[timeframe]?.resultGroup;

  return group ? groups.includes(group) : false;
}

function compareWatchlistRows(
  left: WatchlistRow,
  right: WatchlistRow,
  sort: WatchlistSortState,
) {
  const sortDelta = getWatchlistSortDelta(left, right, sort);

  if (sortDelta !== 0) {
    return sortDelta;
  }

  return (
    left.inputIndex - right.inputIndex ||
    left.symbol.localeCompare(right.symbol)
  );
}

function getWatchlistSortDelta(
  left: WatchlistRow,
  right: WatchlistRow,
  sort: WatchlistSortState,
) {
  if (sort.field === "symbol") {
    const symbolDelta = left.symbol.localeCompare(right.symbol);

    return sort.direction === "asc" ? symbolDelta : -symbolDelta;
  }

  const leftValue = getWatchlistSortValue(left, sort.field);
  const rightValue = getWatchlistSortValue(right, sort.field);

  return compareNullableNumbers(leftValue, rightValue, sort.direction);
}

function getWatchlistSortValue(row: WatchlistRow, field: WatchlistSortField) {
  if (!row.mtfRow) {
    return null;
  }

  switch (field) {
    case "1h_rank":
      return getWatchlistRank(row, "1h");
    case "4h_rank":
      return getWatchlistRank(row, "4h");
    case "1d_rank":
      return getWatchlistRank(row, "1d");
    case "1w_rank":
      return getWatchlistRank(row, "1w");
    case "higher_timeframe_safety":
      return getMtfHigherTimeframeHealth(row.mtfRow).sortRank;
    case "best_short_term_rank":
      return getBestShortTermRank(row);
    case "symbol":
      return null;
  }
}

function compareNullableNumbers(
  left: number | null,
  right: number | null,
  direction: WatchlistSortDirection,
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

export { MTF_SCREENER_TIMEFRAMES };
