export const MARKET_SYMBOL_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)?$/;

export function normalizeMarketSymbolParam(value: string | null | undefined) {
  return value?.trim().toUpperCase() ?? "";
}

export function isValidMarketSymbol(value: string) {
  return value.length >= 2 && value.length <= 30 && MARKET_SYMBOL_PATTERN.test(value);
}
