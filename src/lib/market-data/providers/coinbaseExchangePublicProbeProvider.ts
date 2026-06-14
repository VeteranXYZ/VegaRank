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

type CoinbaseExchangeCandleRow = [number, number, number, number, number, number];

const coinbaseExchangeGranularityByTimeframe: Partial<Record<LiveAuditTimeframe, string>> = {
  "1h": "3600",
  "1d": "86400",
};
const requestUrlKind = "coinbase_exchange_public_product_candles";

export function createCoinbaseExchangePublicProbe(options: {
  apiBaseUrl?: string;
} = {}): LiveProviderProbe {
  return {
    providerId: "coinbase_exchange_public",
    audit: (request) =>
      auditCoinbaseExchangePublic({
        ...request,
        apiBaseUrl: options.apiBaseUrl ?? "https://api.exchange.coinbase.com",
      }),
  };
}

async function auditCoinbaseExchangePublic({
  symbol,
  timeframe,
  timeoutMs,
  nowMs,
  fetcher,
  apiBaseUrl,
}: LiveProviderProbeRequest & {
  apiBaseUrl: string;
}): Promise<LiveProviderAuditResult> {
  const providerSymbol = mapCoinbaseExchangeProductId(symbol);
  const providerGranularity = coinbaseExchangeGranularityByTimeframe[timeframe];

  if (!providerGranularity) {
    return buildEmptyAuditResult({
      providerId: "coinbase_exchange_public",
      symbolRequested: symbol,
      providerSymbolUsed: providerSymbol,
      exchangeSpecific: true,
      aggregatedOnly: false,
      quoteAssetPreserved: providerSymbol.includes("-USDC") || providerSymbol.includes("-USD"),
      timeframe,
      nativeIntervalSupported: false,
      fetchedCandles: 0,
      enoughForVegaRank200: false,
      requestCount: 0,
      authRequired: false,
      errorCode: "unsupported",
      errorMessage:
        timeframe === "4h"
          ? "Coinbase Exchange public candles do not expose native 4h; nearest documented public granularity is 6h."
          : "Coinbase Exchange public candles do not expose native 1w granularity.",
      dataUseWarning:
        "Read-only feasibility comparator only. Do not derive 4h or 1w in this live audit.",
      requestUrlKind,
      failureCategory: "timeframe_unsupported",
      providerGranularity: timeframe === "4h" ? "unsupported; nearest=21600" : "unsupported",
      marketDataProvenance: "exchange_specific",
    });
  }

  const durationMs = getTimeframeDurationMs(timeframe);
  const requestedCandles = 300;
  const endMs = nowMs;
  const startMs = nowMs - requestedCandles * durationMs;
  const url = new URL(
    `/products/${encodeURIComponent(providerSymbol)}/candles`,
    apiBaseUrl,
  );
  url.searchParams.set("start", new Date(startMs).toISOString());
  url.searchParams.set("end", new Date(endMs).toISOString());
  url.searchParams.set("granularity", providerGranularity);

  const response = await fetchJsonWithAuditTimeout(fetcher, url, timeoutMs);
  if (!response.ok) {
    const failureCategory = classifyCoinbaseExchangeFailure(response.status, response.text);
    return buildEmptyAuditResult({
      providerId: "coinbase_exchange_public",
      symbolRequested: symbol,
      providerSymbolUsed: providerSymbol,
      exchangeSpecific: true,
      aggregatedOnly: false,
      quoteAssetPreserved: providerSymbol.includes("-USDC") || providerSymbol.includes("-USD"),
      timeframe,
      nativeIntervalSupported: true,
      fetchedCandles: 0,
      enoughForVegaRank200: false,
      requestCount: 1,
      rateLimitObserved: response.rateLimitObserved,
      authRequired: response.status === 401 || response.status === 403,
      errorCode: errorCodeForCoinbaseExchangeFailure(failureCategory),
      errorMessage: buildCoinbaseExchangeFailureMessage(response.status, failureCategory),
      httpStatus: response.status,
      requestUrlKind,
      failureCategory,
      providerGranularity,
      sanitizedProviderResponse: response.text.slice(0, 1_000),
      marketDataProvenance: "exchange_specific",
    });
  }

  if (!Array.isArray(response.json)) {
    return buildEmptyAuditResult({
      providerId: "coinbase_exchange_public",
      symbolRequested: symbol,
      providerSymbolUsed: providerSymbol,
      exchangeSpecific: true,
      aggregatedOnly: false,
      quoteAssetPreserved: providerSymbol.includes("-USDC") || providerSymbol.includes("-USD"),
      timeframe,
      nativeIntervalSupported: true,
      fetchedCandles: 0,
      enoughForVegaRank200: false,
      requestCount: 1,
      rateLimitObserved: response.rateLimitObserved,
      authRequired: false,
      errorCode: "provider_error",
      errorMessage:
        "Coinbase Exchange public response did not contain the expected candle array.",
      httpStatus: response.status,
      requestUrlKind,
      failureCategory: "code_or_path_bug",
      providerGranularity,
      sanitizedProviderResponse: response.text.slice(0, 1_000),
      marketDataProvenance: "exchange_specific",
    });
  }

  const rows = response.json as CoinbaseExchangeCandleRow[];
  const candles = rows.map((row) => mapCoinbaseExchangeCandleToCandle(row, timeframe));
  const diagnostics = normalizeAuditCandles(candles, timeframe);
  const empty = diagnostics.fetchedCandles === 0;
  const enough = diagnostics.enoughForVegaRank200;

  return buildEmptyAuditResult({
    providerId: "coinbase_exchange_public",
    symbolRequested: symbol,
    providerSymbolUsed: providerSymbol,
    exchangeSpecific: true,
    aggregatedOnly: false,
    quoteAssetPreserved: providerSymbol.includes("-USDC") || providerSymbol.includes("-USD"),
    timeframe,
    nativeIntervalSupported: true,
    fetchedCandles: diagnostics.fetchedCandles,
    firstOpenTime: diagnostics.firstOpenTime,
    lastOpenTime: diagnostics.lastOpenTime,
    oldestCandleTime: diagnostics.firstOpenTime,
    newestCandleTime: diagnostics.lastOpenTime,
    enoughForVegaRank200: enough,
    gapCount: diagnostics.gapCount,
    requestCount: 1,
    rateLimitObserved: response.rateLimitObserved,
    authRequired: false,
    errorCode: enough ? undefined : empty ? "empty_history" : "insufficient_history",
    errorMessage: enough
      ? undefined
      : `Only ${diagnostics.fetchedCandles} usable Coinbase Exchange public candles were returned.`,
    httpStatus: response.status,
    requestUrlKind,
    failureCategory: enough ? undefined : empty ? "empty_candle_history" : "fewer_than_200",
    providerGranularity,
    marketDataProvenance: "exchange_specific",
  });
}

function mapCoinbaseExchangeProductId(symbol: string) {
  const normalized = symbol.trim().toUpperCase();
  if (normalized.includes("-")) {
    return normalized;
  }
  for (const quote of ["USDT", "USDC", "USD"] as const) {
    if (normalized.endsWith(quote) && normalized.length > quote.length) {
      const base = normalized.slice(0, -quote.length);
      return `${base}-${quote === "USDT" ? "USD" : quote}`;
    }
  }
  return normalized;
}

function mapCoinbaseExchangeCandleToCandle(
  row: CoinbaseExchangeCandleRow,
  timeframe: LiveAuditTimeframe,
): Candle {
  const openTime = Number(row[0]) * 1000;

  return {
    openTime,
    low: Number(row[1]),
    high: Number(row[2]),
    open: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
    closeTime: openTime + getTimeframeDurationMs(timeframe) - 1,
  };
}

function classifyCoinbaseExchangeFailure(status: number, text: string) {
  const normalized = text.toLowerCase();
  if (status === 401 || status === 403) {
    return "auth_problem" as const;
  }
  if (status === 404) {
    return "product_not_found" as const;
  }
  if (status === 429) {
    return "rate_limited" as const;
  }
  if (/granularity|unsupported interval|unsupported timeframe/.test(normalized)) {
    return "timeframe_unsupported" as const;
  }
  if (/window|range|too large|limit|too many/.test(normalized)) {
    return "request_window_too_large" as const;
  }
  return "provider_error" as const;
}

function errorCodeForCoinbaseExchangeFailure(
  failureCategory: ReturnType<typeof classifyCoinbaseExchangeFailure>,
) {
  switch (failureCategory) {
    case "auth_problem":
      return "auth_required";
    case "product_not_found":
      return "product_not_found";
    case "timeframe_unsupported":
      return "unsupported";
    case "request_window_too_large":
      return "request_window_too_large";
    case "rate_limited":
      return "rate_limited";
    default:
      return "provider_error";
  }
}

function buildCoinbaseExchangeFailureMessage(
  status: number,
  failureCategory: ReturnType<typeof classifyCoinbaseExchangeFailure>,
) {
  if (failureCategory === "product_not_found") {
    return `Coinbase Exchange public returned HTTP ${status}; the product id may not exist.`;
  }
  if (failureCategory === "request_window_too_large") {
    return `Coinbase Exchange public returned HTTP ${status}; the request window may exceed endpoint limits.`;
  }
  if (failureCategory === "timeframe_unsupported") {
    return `Coinbase Exchange public returned HTTP ${status}; the requested granularity may be unsupported.`;
  }
  return `Coinbase Exchange public request failed with HTTP ${status}.`;
}
