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

export type SymbolQualityTier =
  | "core"
  | "major"
  | "normal"
  | "new_listing"
  | "meme"
  | "fan_token"
  | "wrapped_or_staked"
  | "stable_like"
  | "special_or_suspicious"
  | "low_history";

export type SymbolQuality = {
  qualityTier: SymbolQualityTier;
  isLowQuality: boolean;
  qualityFlags: string[];
};

export type SymbolQualityMetadata = {
  exchange?: string | null;
  baseAsset?: string | null;
  quoteAsset?: string | null;
  assetClass?: SymbolAssetClass | null;
  candleCount?: number | null;
  firstOpenTime?: string | Date | null;
  now?: Date;
};

export type SymbolQualityIdentity = {
  symbol: string;
  baseAsset: string;
  quoteAsset: string | null;
  isDashedPair: boolean;
  isMalformedPair: boolean;
};

const STABLE_BASE_ASSETS = new Set([
  "USDT",
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
  "EURC",
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
const CORE_BASE_ASSETS = new Set([
  "BTC",
  "ETH",
  "SOL",
  "BNB",
  "XRP",
  "ADA",
  "AVAX",
  "LINK",
  "DOGE",
  "TON",
  "TRX",
]);
const MAJOR_BASE_ASSETS = new Set([
  "LTC",
  "BCH",
  "DOT",
  "UNI",
  "AAVE",
  "ATOM",
  "NEAR",
  "APT",
  "ARB",
  "OP",
  "SUI",
  "HBAR",
  "XLM",
  "ETC",
  "FIL",
  "ICP",
  "INJ",
  "SEI",
  "WLD",
  "FET",
]);
const MEME_BASE_ASSETS = new Set([
  "DOGE",
  "SHIB",
  "PEPE",
  "FLOKI",
  "BONK",
  "WIF",
  "TURBO",
  "PNUT",
  "BABYDOGE",
  "MEME",
]);
const FAN_TOKEN_BASE_ASSETS = new Set([
  "PSG",
  "ATM",
  "PORTO",
  "LAZIO",
  "SANTOS",
  "ASR",
  "ACM",
  "BAR",
  "JUV",
  "CITY",
  "ALPINE",
]);
const WRAPPED_OR_STAKED_BASE_ASSETS = new Set([
  "WBTC",
  "WBETH",
  "BNSOL",
  "WETH",
  "STETH",
  "RETH",
  "LSETH",
  "CBETH",
]);
const SUSPICIOUS_BASE_ASSETS = new Set([
  "U",
  "S",
  "D",
  "F",
  "C",
  "T",
  "A",
  "G",
  "XUSD",
]);
const LEVERAGED_SUFFIXES = ["DOWN", "BULL", "BEAR", "3L", "3S", "5L", "5S"];
const LEVERAGED_UP_EXCEPTIONS = new Set(["JUP"]);
const LOW_HISTORY_CANDLE_COUNT = 500;
const NEW_LISTING_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

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

export function getSymbolQuality(
  symbol: string,
  metadata: SymbolQualityMetadata = {},
): SymbolQuality {
  const identity = parseSymbolQualityIdentity(symbol, metadata);
  const baseAsset = identity.baseAsset;
  const flags = new Set<string>();
  const now = metadata.now ?? new Date();

  if (
    metadata.assetClass === "stable" ||
    STABLE_BASE_ASSETS.has(baseAsset) ||
    baseAsset.includes("USD")
  ) {
    flags.add("stable_like");
  }

  if (FAN_TOKEN_BASE_ASSETS.has(baseAsset)) {
    flags.add("fan_token");
  }

  if (
    WRAPPED_OR_STAKED_BASE_ASSETS.has(baseAsset) ||
    (baseAsset.startsWith("W") && baseAsset.length > 3) ||
    baseAsset.includes("STAKED")
  ) {
    flags.add("wrapped_or_staked");
  }

  if (
    MEME_BASE_ASSETS.has(baseAsset) ||
    baseAsset.startsWith("1000") ||
    baseAsset.startsWith("1M") ||
    baseAsset.includes("BABYDOGE")
  ) {
    flags.add("meme");
  }

  if (
    metadata.assetClass === "special" ||
    SUSPICIOUS_BASE_ASSETS.has(baseAsset) ||
    baseAsset.length === 1 ||
    isAllNumericBaseAsset(baseAsset) ||
    !/^[A-Z0-9]+$/.test(baseAsset) ||
    identity.isMalformedPair ||
    isSpecialQualityBaseAsset(baseAsset)
  ) {
    flags.add("special_or_suspicious");
  }

  if (
    metadata.candleCount !== null &&
    metadata.candleCount !== undefined &&
    metadata.candleCount < LOW_HISTORY_CANDLE_COUNT
  ) {
    flags.add("low_history");
  }

  const firstOpenTimeMs = metadata.firstOpenTime
    ? new Date(metadata.firstOpenTime).getTime()
    : null;

  if (
    firstOpenTimeMs !== null &&
    Number.isFinite(firstOpenTimeMs) &&
    now.getTime() - firstOpenTimeMs < NEW_LISTING_MAX_AGE_MS
  ) {
    flags.add("new_listing");
  }

  const qualityFlags = Array.from(flags);
  const qualityTier = resolveQualityTier(baseAsset, qualityFlags);

  return {
    qualityTier,
    isLowQuality: qualityTier !== "core" && qualityTier !== "major" && qualityTier !== "normal",
    qualityFlags,
  };
}

export function parseSymbolQualityIdentity(
  symbol: string,
  metadata: Pick<SymbolQualityMetadata, "baseAsset" | "quoteAsset"> = {},
): SymbolQualityIdentity {
  const normalizedSymbol = normalizeAssetToken(symbol);
  const metadataBase = normalizeOptionalAssetToken(metadata.baseAsset);
  const metadataQuote = normalizeOptionalAssetToken(metadata.quoteAsset);

  if (metadataBase && metadataQuote) {
    return {
      symbol: normalizedSymbol,
      baseAsset: metadataBase,
      quoteAsset: metadataQuote,
      isDashedPair: normalizedSymbol.includes("-"),
      isMalformedPair: false,
    };
  }

  if (normalizedSymbol.includes("-")) {
    const parts = normalizedSymbol.split("-");
    const [baseAsset, quoteAsset] = parts;
    const isWellFormed =
      parts.length === 2 &&
      isAlphanumericAsset(baseAsset) &&
      isAlphanumericAsset(quoteAsset);

    return {
      symbol: normalizedSymbol,
      baseAsset: isWellFormed ? baseAsset : normalizedSymbol,
      quoteAsset: isWellFormed ? quoteAsset : null,
      isDashedPair: true,
      isMalformedPair: !isWellFormed,
    };
  }

  const suffixQuote = inferSuffixQuoteAsset(normalizedSymbol);

  if (suffixQuote) {
    return {
      symbol: normalizedSymbol,
      baseAsset: normalizedSymbol.slice(0, -suffixQuote.length),
      quoteAsset: suffixQuote,
      isDashedPair: false,
      isMalformedPair: false,
    };
  }

  return {
    symbol: normalizedSymbol,
    baseAsset: normalizedSymbol,
    quoteAsset: null,
    isDashedPair: false,
    isMalformedPair: !isAlphanumericAsset(normalizedSymbol),
  };
}

function resolveQualityTier(
  baseAsset: string,
  qualityFlags: string[],
): SymbolQualityTier {
  if (CORE_BASE_ASSETS.has(baseAsset)) {
    return "core";
  }

  if (MAJOR_BASE_ASSETS.has(baseAsset)) {
    return "major";
  }

  for (const tier of [
    "stable_like",
    "special_or_suspicious",
    "fan_token",
    "wrapped_or_staked",
    "low_history",
    "new_listing",
    "meme",
  ] satisfies SymbolQualityTier[]) {
    if (qualityFlags.includes(tier)) {
      return tier;
    }
  }

  return "normal";
}

function inferSuffixQuoteAsset(symbol: string) {
  for (const quoteAsset of ["USDT", "USDC", "USD", "BTC", "ETH", "EUR", "GBP"]) {
    if (symbol.length > quoteAsset.length && symbol.endsWith(quoteAsset)) {
      return quoteAsset;
    }
  }

  return null;
}

function isAllNumericBaseAsset(baseAsset: string) {
  return /^[0-9]+$/.test(baseAsset);
}

function isSpecialQualityBaseAsset(baseAsset: string) {
  if (baseAsset.endsWith("UP") && !LEVERAGED_UP_EXCEPTIONS.has(baseAsset)) {
    return true;
  }

  return LEVERAGED_SUFFIXES.some((suffix) => baseAsset.endsWith(suffix));
}

function normalizeAssetToken(value: string) {
  return value.trim().toUpperCase();
}

function normalizeOptionalAssetToken(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase();
  return normalized ? normalized : null;
}

function isAlphanumericAsset(value: string | undefined) {
  return typeof value === "string" && /^[A-Z0-9]+$/.test(value);
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
