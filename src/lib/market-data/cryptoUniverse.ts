export const CORE_CRYPTO_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "DOGEUSDT",
  "ADAUSDT",
  "AVAXUSDT",
  "LINKUSDT",
  "TONUSDT",
] as const;

export type CryptoUniverseName = "core";

export function resolveCryptoUniverse(universe: string | undefined) {
  if (universe === undefined || universe === "") {
    return [];
  }

  if (universe !== "core") {
    throw new Error("universe must be core when provided.");
  }

  return [...CORE_CRYPTO_SYMBOLS];
}

export function normalizeSymbols(symbols: string[]) {
  return Array.from(
    new Set(
      symbols
        .map((symbol) => symbol.trim().toUpperCase())
        .filter((symbol) => /^[A-Z0-9]+USDT$/.test(symbol)),
    ),
  );
}
