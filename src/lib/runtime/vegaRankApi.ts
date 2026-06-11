export const DEFAULT_VEGARANK_API_BASE_URL = "https://api.vegarank.com";

// Keep the existing env var name for deployment continuity in this cutover phase.
export const VEGARANK_API_BASE_URL_ENV_VAR = "NEXT_PUBLIC_TRADE_API_BASE_URL";

export function getVegaRankApiBaseUrl(
  value: string | null | undefined = process.env.NEXT_PUBLIC_TRADE_API_BASE_URL,
) {
  return normalizeVegaRankApiBaseUrl(value) ?? DEFAULT_VEGARANK_API_BASE_URL;
}

export function normalizeVegaRankApiBaseUrl(value: string | null | undefined) {
  const normalized = value?.trim().replace(/\/+$/, "") ?? "";

  return normalized || null;
}

export function getVegaRankApiOriginLabel(baseUrl?: string | null) {
  const normalizedBaseUrl =
    normalizeVegaRankApiBaseUrl(baseUrl) ?? DEFAULT_VEGARANK_API_BASE_URL;

  try {
    return new URL(normalizedBaseUrl).origin;
  } catch {
    return DEFAULT_VEGARANK_API_BASE_URL;
  }
}
