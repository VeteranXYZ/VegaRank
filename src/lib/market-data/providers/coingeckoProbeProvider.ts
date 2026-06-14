import type { Candle } from "@/lib/shared/timeframes";
import {
  buildEmptyAuditResult,
  fetchJsonWithAuditTimeout,
  getTimeframeDurationMs,
  normalizeAuditCandles,
  type LiveAuditTimeframe,
  type LiveProviderAuditResult,
  type LiveProviderProbe,
  type LiveProviderProbeRequest,
} from "../liveProviderAudit";

type CoinGeckoOhlcRow = [number, number, number, number, number];

const coingeckoIdByBaseAsset: Record<string, string> = {
  "00": "00-token",
  AERO: "aerodrome-finance",
  BTC: "bitcoin",
  CBETH: "coinbase-wrapped-staked-eth",
  DOGINME: "doginme",
  DRIFT: "drift-protocol",
  ETH: "ethereum",
};

export function createCoinGeckoProbe(options: {
  apiBaseUrl?: string;
  apiKey?: string;
} = {}): LiveProviderProbe {
  return {
    providerId: "coingecko",
    audit: (request) =>
      auditCoinGecko({
        ...request,
        apiBaseUrl: options.apiBaseUrl ?? "https://api.coingecko.com/api/v3",
        apiKey: options.apiKey,
      }),
  };
}

async function auditCoinGecko({
  symbol,
  timeframe,
  timeoutMs,
  fetcher,
  apiBaseUrl,
  apiKey,
}: LiveProviderProbeRequest & {
  apiBaseUrl: string;
  apiKey?: string;
}): Promise<LiveProviderAuditResult> {
  const baseAsset = inferBaseAsset(symbol);
  const coinId = coingeckoIdByBaseAsset[baseAsset];

  if (!coinId) {
    return buildEmptyAuditResult({
      providerId: "coingecko",
      symbolRequested: symbol,
      providerSymbolUsed: baseAsset,
      exchangeSpecific: false,
      aggregatedOnly: true,
      quoteAssetPreserved: false,
      timeframe,
      nativeIntervalSupported: "unknown",
      fetchedCandles: 0,
      enoughForVegaRank200: false,
      requestCount: 0,
      authRequired: false,
      errorCode: "symbol_mapping_missing",
      errorMessage: `No CoinGecko coin id mapping is configured for base asset ${baseAsset}.`,
      dataUseWarning: "CoinGecko is aggregated coin-level data, not exchange-specific OHLCV.",
      failureCategory: "symbol_mapping_missing",
      marketDataProvenance: "aggregated",
    });
  }

  if (timeframe === "1w") {
    return buildEmptyAuditResult({
      providerId: "coingecko",
      symbolRequested: symbol,
      providerSymbolUsed: coinId,
      exchangeSpecific: false,
      aggregatedOnly: true,
      quoteAssetPreserved: false,
      timeframe,
      nativeIntervalSupported: false,
      fetchedCandles: 0,
      enoughForVegaRank200: false,
      requestCount: 0,
      authRequired: false,
      errorCode: "unsupported",
      errorMessage: "CoinGecko OHLC does not provide native VegaRank 1w exchange-specific candles.",
      dataUseWarning: "Aggregated coin-level data must not be used as exchange-specific primary.",
      requestUrlKind: "coingecko_coin_ohlc",
      failureCategory: "timeframe_unsupported",
      marketDataProvenance: "aggregated",
    });
  }

  const url = new URL(`coins/${encodeURIComponent(coinId)}/ohlc`, ensureTrailingSlash(apiBaseUrl));
  url.searchParams.set("vs_currency", "usd");
  url.searchParams.set("days", chooseCoinGeckoDays(timeframe));
  const headers: Record<string, string> = apiKey ? { "x-cg-demo-api-key": apiKey } : {};
  const response = await fetchJsonWithAuditTimeout(fetcher, url, timeoutMs, headers);
  const authRequired = response.status === 401 || response.status === 403;

  if (!response.ok) {
    return buildEmptyAuditResult({
      providerId: "coingecko",
      symbolRequested: symbol,
      providerSymbolUsed: coinId,
      exchangeSpecific: false,
      aggregatedOnly: true,
      quoteAssetPreserved: false,
      timeframe,
      nativeIntervalSupported: "unknown",
      fetchedCandles: 0,
      enoughForVegaRank200: false,
      requestCount: 1,
      rateLimitObserved: response.rateLimitObserved,
      authRequired,
      errorCode: authRequired ? "auth_required" : "provider_error",
      errorMessage: `CoinGecko coin-level OHLC request failed with HTTP ${response.status}.`,
      dataUseWarning: "CoinGecko is aggregated coin-level data, not exchange-specific OHLCV.",
      httpStatus: response.status,
      requestUrlKind: "coingecko_coin_ohlc",
      failureCategory: authRequired
        ? "auth_problem"
        : response.status === 404
          ? "product_not_found"
          : "provider_error",
      providerGranularity: getCoinGeckoProviderGranularity(timeframe),
      sanitizedProviderResponse: sanitizeCoinGeckoResponse(response.text, apiKey),
      marketDataProvenance: "aggregated",
    });
  }

  const rows = Array.isArray(response.json) ? (response.json as CoinGeckoOhlcRow[]) : [];
  const candles = rows.map((row) => mapCoinGeckoOhlcRowToCandle(row, timeframe));
  const diagnostics = normalizeAuditCandles(candles, timeframe);

  return buildEmptyAuditResult({
    providerId: "coingecko",
    symbolRequested: symbol,
    providerSymbolUsed: coinId,
    exchangeSpecific: false,
    aggregatedOnly: true,
    quoteAssetPreserved: false,
    timeframe,
    nativeIntervalSupported: getCoinGeckoNativeIntervalSupport(timeframe),
    fetchedCandles: diagnostics.fetchedCandles,
    firstOpenTime: diagnostics.firstOpenTime,
    lastOpenTime: diagnostics.lastOpenTime,
    oldestCandleTime: diagnostics.firstOpenTime,
    newestCandleTime: diagnostics.lastOpenTime,
    enoughForVegaRank200: diagnostics.enoughForVegaRank200,
    gapCount: diagnostics.gapCount,
    requestCount: 1,
    rateLimitObserved: response.rateLimitObserved,
    authRequired: false,
    errorCode: diagnostics.enoughForVegaRank200 ? undefined : "insufficient_history",
    errorMessage: diagnostics.enoughForVegaRank200
      ? undefined
      : `Only ${diagnostics.fetchedCandles} usable CoinGecko OHLC rows were returned.`,
    dataUseWarning:
      "CoinGecko OHLC is aggregated coin-level data with automatic or plan-limited granularity; do not use as exchange-specific primary.",
    httpStatus: response.status,
    requestUrlKind: "coingecko_coin_ohlc",
    failureCategory:
      diagnostics.enoughForVegaRank200
        ? undefined
        : diagnostics.fetchedCandles === 0
          ? "empty_candle_history"
          : "fewer_than_200",
    providerGranularity: getCoinGeckoProviderGranularity(timeframe),
    marketDataProvenance: "aggregated",
  });
}

function mapCoinGeckoOhlcRowToCandle(
  row: CoinGeckoOhlcRow,
  timeframe: LiveAuditTimeframe,
): Candle {
  const closeTime = Number(row[0]);
  const durationMs = getTimeframeDurationMs(timeframe);

  return {
    openTime: closeTime - durationMs + 1,
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: 0,
    closeTime,
  };
}

function inferBaseAsset(symbol: string) {
  const normalized = symbol.trim().toUpperCase();
  if (normalized.includes("-")) {
    return normalized.split("-")[0] ?? normalized;
  }
  for (const quote of ["USDT", "USDC", "USD"] as const) {
    if (normalized.endsWith(quote) && normalized.length > quote.length) {
      return normalized.slice(0, -quote.length);
    }
  }
  return normalized;
}

function chooseCoinGeckoDays(timeframe: Exclude<LiveAuditTimeframe, "1w">) {
  if (timeframe === "1h") {
    return "1";
  }
  if (timeframe === "4h") {
    return "30";
  }
  return "365";
}

function getCoinGeckoNativeIntervalSupport(timeframe: LiveAuditTimeframe) {
  if (timeframe === "4h") {
    return "unknown" as const;
  }
  return false;
}

function getCoinGeckoProviderGranularity(timeframe: LiveAuditTimeframe) {
  if (timeframe === "1h") {
    return "CoinGecko automatic OHLC interval for days=1";
  }
  if (timeframe === "4h") {
    return "CoinGecko automatic OHLC interval for days=30; not native VegaRank 4h";
  }
  if (timeframe === "1d") {
    return "CoinGecko automatic OHLC interval for days=365";
  }
  return "unsupported";
}

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function sanitizeCoinGeckoResponse(text: string, apiKey: string | undefined) {
  let sanitized = text.slice(0, 1_000);
  if (apiKey) {
    sanitized = sanitized.split(apiKey).join("[REDACTED]");
  }
  return sanitized;
}
