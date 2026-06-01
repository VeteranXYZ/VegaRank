import {
  MTF_SCREENER_TIMEFRAMES,
  getMtfHigherTimeframeHealth,
  type MtfScreenerRow,
  type MtfScreenerTimeframe,
} from "@/components/screener/multiTimeframeScreenerUi";

export const WATCHLIST_STORAGE_KEY = "trade-scanner.watchlist.symbols";
export const DEFAULT_WATCHLIST_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "LINKUSDT",
  "SEIUSDT",
] as const;

export const watchlistSortOptions = [
  { field: "symbol", label: "Symbol" },
  { field: "1h_rank", label: "1h Rank" },
  { field: "4h_rank", label: "4h Rank" },
  { field: "1d_rank", label: "1d Rank" },
  { field: "1w_rank", label: "1w Rank" },
  { field: "higher_timeframe_safety", label: "Higher-Timeframe Safety" },
  { field: "best_short_term_rank", label: "Best Short-Term Rank" },
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
  return symbols.join(", ");
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
}: {
  row: WatchlistRow;
  timeframe?: MtfScreenerTimeframe | null;
  assetClass?: string;
}) {
  if (!row.mtfRow || !timeframe) {
    return null;
  }

  const params = new URLSearchParams({
    timeframe,
    assetClass,
    from: "watchlist",
  });

  return `/symbol/${encodeURIComponent(row.mtfRow.exchange)}/${encodeURIComponent(
    row.symbol,
  )}?${params.toString()}`;
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

export function getWatchlistRank(
  row: WatchlistRow,
  timeframe: MtfScreenerTimeframe,
) {
  const rankScore = row.mtfRow?.snapshots[timeframe]?.rankScore;

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

function normalizeWatchlistSymbols(symbols: readonly string[]) {
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

export { MTF_SCREENER_TIMEFRAMES };
