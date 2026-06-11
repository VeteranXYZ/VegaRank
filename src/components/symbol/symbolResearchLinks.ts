export const SYMBOL_RESEARCH_TIMEFRAMES = ["1h", "4h", "1d", "1w"] as const;
export type SymbolResearchTimeframe =
  (typeof SYMBOL_RESEARCH_TIMEFRAMES)[number];

export const DEFAULT_SYMBOL_RESEARCH_TIMEFRAME: SymbolResearchTimeframe = "4h";

export type SymbolResearchHrefParams = {
  exchange: string;
  symbol: string;
  timeframe?: string | null;
  assetClass?: string | null;
  includeLowQuality?: boolean | string | null;
  limit?: number | string | null;
  from?: string | null;
};

export type SymbolResearchTimeframeSelection = {
  requestedTimeframe: string | null;
  selectedTimeframe: SymbolResearchTimeframe;
  fallbackReason: "missing" | "invalid" | null;
};

export function buildSymbolResearchHref({
  exchange,
  symbol,
  timeframe,
  assetClass,
  includeLowQuality,
  limit,
  from,
}: SymbolResearchHrefParams) {
  const params = new URLSearchParams({
    timeframe: normalizeSymbolResearchTimeframe(timeframe),
  });
  const normalizedAssetClass = assetClass?.trim();
  const normalizedLimit = normalizePositiveInteger(limit);
  const normalizedFrom = normalizeSymbolResearchFrom(from);

  if (normalizedAssetClass) {
    params.set("assetClass", normalizedAssetClass);
  }

  if (includeLowQuality === true || includeLowQuality === "true") {
    params.set("includeLowQuality", "true");
  }

  if (normalizedLimit !== null) {
    params.set("limit", String(normalizedLimit));
  }

  if (normalizedFrom) {
    params.set("from", normalizedFrom);
  }

  return `/symbol/${encodeURIComponent(
    normalizeExchangePathSegment(exchange),
  )}/${encodeURIComponent(normalizeSymbolResearchInputSymbol(symbol))}?${params.toString()}`;
}

export function getSymbolResearchTimeframeSelection(
  value: string | null | undefined,
): SymbolResearchTimeframeSelection {
  const requestedTimeframe = value?.trim() || null;

  if (!requestedTimeframe) {
    return {
      requestedTimeframe: null,
      selectedTimeframe: DEFAULT_SYMBOL_RESEARCH_TIMEFRAME,
      fallbackReason: "missing",
    };
  }

  const selectedTimeframe = normalizeSymbolResearchTimeframe(requestedTimeframe);

  return {
    requestedTimeframe,
    selectedTimeframe,
    fallbackReason:
      selectedTimeframe === requestedTimeframe.toLowerCase() ? null : "invalid",
  };
}

export function normalizeSymbolResearchTimeframe(
  value: string | null | undefined,
): SymbolResearchTimeframe {
  const normalized = value?.trim().toLowerCase();

  return isSymbolResearchTimeframe(normalized)
    ? normalized
    : DEFAULT_SYMBOL_RESEARCH_TIMEFRAME;
}

export function isSymbolResearchTimeframe(
  value: string | null | undefined,
): value is SymbolResearchTimeframe {
  return SYMBOL_RESEARCH_TIMEFRAMES.includes(value as SymbolResearchTimeframe);
}

function normalizeSymbolResearchInputSymbol(value: string) {
  return value.trim().toUpperCase();
}

function normalizeExchangePathSegment(value: string | null | undefined) {
  return value?.trim().toLowerCase() || "binance";
}

function normalizeSymbolResearchFrom(value: string | null | undefined) {
  return value?.trim();
}

function normalizePositiveInteger(value: number | string | null | undefined) {
  const number = typeof value === "string" ? Number(value.trim()) : Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    return null;
  }

  return number;
}
