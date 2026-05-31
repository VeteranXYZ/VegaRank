export const DEFAULT_BINANCE_PUBLIC_BASE_URL = "https://data-api.binance.vision";

export function getBinancePublicBaseUrl() {
  return normalizeBaseUrl(
    process.env.BINANCE_PUBLIC_BASE_URL ?? DEFAULT_BINANCE_PUBLIC_BASE_URL,
  );
}

export function buildBinancePublicUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getBinancePublicBaseUrl()}${normalizedPath}`;
}

function normalizeBaseUrl(value: string) {
  const trimmed = value.trim();
  const withoutTrailingSlash = trimmed.replace(/\/+$/, "");

  return withoutTrailingSlash || DEFAULT_BINANCE_PUBLIC_BASE_URL;
}
