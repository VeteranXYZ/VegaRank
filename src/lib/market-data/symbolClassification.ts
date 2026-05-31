export const SYMBOL_ASSET_CLASSES = [
  "crypto",
  "stable",
  "fiat",
  "gold",
  "special",
] as const;

export type SymbolAssetClass = (typeof SYMBOL_ASSET_CLASSES)[number];
export type SymbolAssetClassFilter = SymbolAssetClass | "all";

export type SymbolClassification = {
  assetClass: SymbolAssetClass;
  isScannerEligible: boolean;
  isBacktestEligible: boolean;
  isMarketContext: boolean;
};

const STABLE_BASE_ASSETS = new Set([
  "USDC",
  "FDUSD",
  "USDP",
  "TUSD",
  "BUSD",
  "DAI",
  "PYUSD",
  "USD1",
  "RLUSD",
  "USDD",
  "USDE",
  "SUSDE",
  "USDS",
  "FRAX",
  "BFUSD",
]);

const FIAT_BASE_ASSETS = new Set([
  "EUR",
  "GBP",
  "TRY",
  "BRL",
  "AUD",
  "AEUR",
  "EURI",
  "UAH",
  "ZAR",
  "IDRT",
  "BIDR",
]);

const GOLD_BASE_ASSETS = new Set(["PAXG", "XAUT"]);
const LEVERAGED_SUFFIXES = ["DOWN", "BULL", "BEAR", "3L", "3S", "5L", "5S"];
const LEVERAGED_UP_EXCEPTIONS = new Set(["JUP"]);

export function classifyUsdtSymbol({
  symbol,
  baseAsset,
}: {
  symbol: string;
  baseAsset: string;
}): SymbolClassification {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const normalizedBaseAsset = baseAsset.trim().toUpperCase();

  if (STABLE_BASE_ASSETS.has(normalizedBaseAsset)) {
    return {
      assetClass: "stable",
      isScannerEligible: false,
      isBacktestEligible: false,
      isMarketContext: true,
    };
  }

  if (FIAT_BASE_ASSETS.has(normalizedBaseAsset)) {
    return {
      assetClass: "fiat",
      isScannerEligible: false,
      isBacktestEligible: false,
      isMarketContext: true,
    };
  }

  if (GOLD_BASE_ASSETS.has(normalizedBaseAsset)) {
    return {
      assetClass: "gold",
      isScannerEligible: false,
      isBacktestEligible: true,
      isMarketContext: true,
    };
  }

  if (isSpecialSymbol(normalizedSymbol, normalizedBaseAsset)) {
    return {
      assetClass: "special",
      isScannerEligible: false,
      isBacktestEligible: false,
      isMarketContext: false,
    };
  }

  return {
    assetClass: "crypto",
    isScannerEligible: true,
    isBacktestEligible: true,
    isMarketContext: false,
  };
}

export function isSymbolAssetClass(value: unknown): value is SymbolAssetClass {
  return (
    typeof value === "string" &&
    SYMBOL_ASSET_CLASSES.includes(value as SymbolAssetClass)
  );
}

export function isSymbolAssetClassFilter(
  value: unknown,
): value is SymbolAssetClassFilter {
  return value === "all" || isSymbolAssetClass(value);
}

export function emptyAssetClassCounts() {
  return {
    crypto: 0,
    stable: 0,
    fiat: 0,
    gold: 0,
    special: 0,
  } satisfies Record<SymbolAssetClass, number>;
}

function isSpecialSymbol(symbol: string, baseAsset: string) {
  if (!/^[A-Z0-9]+$/.test(symbol) || !/^[A-Z0-9]+$/.test(baseAsset)) {
    return true;
  }

  if (baseAsset.endsWith("UP") && !LEVERAGED_UP_EXCEPTIONS.has(baseAsset)) {
    return true;
  }

  return LEVERAGED_SUFFIXES.some((suffix) => baseAsset.endsWith(suffix));
}
