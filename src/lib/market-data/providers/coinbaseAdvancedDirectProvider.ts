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

type CoinbaseAdvancedCandle = {
  start: string;
  low: string;
  high: string;
  open: string;
  close: string;
  volume: string;
};

type CoinbaseAdvancedCandlesResponse = {
  candles?: CoinbaseAdvancedCandle[];
};

const coinbaseGranularityByTimeframe = {
  "1h": "ONE_HOUR",
  "4h": "FOUR_HOUR",
  "1d": "ONE_DAY",
} satisfies Partial<Record<LiveAuditTimeframe, string>>;
const requestUrlKind = "coinbase_advanced_product_candles";

export function createCoinbaseAdvancedDirectProbe(options: {
  apiBaseUrl?: string;
  bearerToken?: string;
} = {}): LiveProviderProbe {
  return {
    providerId: "coinbase_advanced_direct",
    audit: (request) =>
      auditCoinbaseAdvancedDirect({
        ...request,
        apiBaseUrl: options.apiBaseUrl ?? "https://api.coinbase.com",
        bearerToken: options.bearerToken,
      }),
  };
}

export function mapCoinbaseAdvancedCandleToCandle(
  row: CoinbaseAdvancedCandle,
  timeframe: Exclude<LiveAuditTimeframe, "1w">,
): Candle {
  const openTime = Number(row.start) * 1000;

  return {
    openTime,
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
    volume: Number(row.volume),
    closeTime: openTime + getTimeframeDurationMs(timeframe) - 1,
  };
}

async function auditCoinbaseAdvancedDirect({
  symbol,
  timeframe,
  lookbackDays,
  timeoutMs,
  nowMs,
  fetcher,
  apiBaseUrl,
  bearerToken,
}: LiveProviderProbeRequest & {
  apiBaseUrl: string;
  bearerToken?: string;
}): Promise<LiveProviderAuditResult> {
  if (timeframe === "1w") {
    return buildEmptyAuditResult({
      providerId: "coinbase_advanced_direct",
      symbolRequested: symbol,
      providerSymbolUsed: symbol,
      exchangeSpecific: true,
      aggregatedOnly: false,
      quoteAssetPreserved: true,
      timeframe,
      nativeIntervalSupported: false,
      fetchedCandles: 0,
      enoughForVegaRank200: false,
      requestCount: 0,
      authRequired: false,
      errorCode: "unsupported",
      errorMessage: "Coinbase Advanced direct candles do not expose native 1w granularity.",
      dataUseWarning: "Do not derive weekly candles in the live audit; report unsupported.",
      requestUrlKind,
      failureCategory: "timeframe_unsupported",
    });
  }

  const providerGranularity = coinbaseGranularityByTimeframe[timeframe];

  if (!bearerToken) {
    return buildEmptyAuditResult({
      providerId: "coinbase_advanced_direct",
      symbolRequested: symbol,
      providerSymbolUsed: symbol,
      exchangeSpecific: true,
      aggregatedOnly: false,
      quoteAssetPreserved: true,
      timeframe,
      nativeIntervalSupported: true,
      fetchedCandles: 0,
      enoughForVegaRank200: false,
      requestCount: 0,
      authRequired: true,
      errorCode: "auth_required",
      errorMessage:
        "Coinbase Advanced credentials are missing. Set COINBASE_ADVANCED_BEARER_TOKEN for authenticated read-only live audit requests.",
      requestUrlKind,
      failureCategory: "auth_problem",
      providerGranularity,
      marketDataProvenance: "exchange_specific",
    });
  }

  const url = new URL(
    `/api/v3/brokerage/products/${encodeURIComponent(symbol)}/candles`,
    apiBaseUrl,
  );
  const endSeconds = Math.floor(nowMs / 1000);
  const startSeconds = Math.floor((nowMs - lookbackDays * 24 * 60 * 60 * 1000) / 1000);
  url.searchParams.set("start", String(startSeconds));
  url.searchParams.set("end", String(endSeconds));
  url.searchParams.set("granularity", providerGranularity);
  url.searchParams.set("limit", "350");

  const response = await fetchJsonWithAuditTimeout(
    fetcher,
    url,
    timeoutMs,
    { Authorization: `Bearer ${bearerToken}` },
  );

  if (!response.ok) {
    const failureCategory = classifyCoinbaseAdvancedFailure(response.status, response.text);
    const authRejected = response.status === 401 || response.status === 403;
    return buildEmptyAuditResult({
      providerId: "coinbase_advanced_direct",
      symbolRequested: symbol,
      providerSymbolUsed: symbol,
      exchangeSpecific: true,
      aggregatedOnly: false,
      quoteAssetPreserved: true,
      timeframe,
      nativeIntervalSupported: true,
      fetchedCandles: 0,
      enoughForVegaRank200: false,
      requestCount: 1,
      rateLimitObserved: response.rateLimitObserved,
      authRequired: authRejected,
      errorCode: authRejected ? "auth_rejected" : errorCodeForCoinbaseAdvancedFailure(failureCategory),
      errorMessage: buildCoinbaseAdvancedFailureMessage(response.status, failureCategory),
      httpStatus: response.status,
      requestUrlKind,
      failureCategory,
      providerGranularity,
      sanitizedProviderResponse: sanitizeProviderResponse(response.text, bearerToken),
      marketDataProvenance: "exchange_specific",
    });
  }

  const body = response.json as CoinbaseAdvancedCandlesResponse | undefined;
  if (!body || !Array.isArray(body.candles)) {
    return buildEmptyAuditResult({
      providerId: "coinbase_advanced_direct",
      symbolRequested: symbol,
      providerSymbolUsed: symbol,
      exchangeSpecific: true,
      aggregatedOnly: false,
      quoteAssetPreserved: true,
      timeframe,
      nativeIntervalSupported: true,
      fetchedCandles: 0,
      enoughForVegaRank200: false,
      requestCount: 1,
      rateLimitObserved: response.rateLimitObserved,
      authRequired: false,
      errorCode: "provider_error",
      errorMessage:
        "Coinbase Advanced response did not contain a candles array; this may be an endpoint path or response-shape bug.",
      httpStatus: response.status,
      requestUrlKind,
      failureCategory: "code_or_path_bug",
      providerGranularity,
      sanitizedProviderResponse: sanitizeProviderResponse(response.text, bearerToken),
      marketDataProvenance: "exchange_specific",
    });
  }
  const rows = Array.isArray(body?.candles) ? body.candles : [];
  const candles = rows.map((row) => mapCoinbaseAdvancedCandleToCandle(row, timeframe));
  const diagnostics = normalizeAuditCandles(candles, timeframe);
  const empty = diagnostics.fetchedCandles === 0;
  const enough = diagnostics.enoughForVegaRank200;

  return buildEmptyAuditResult({
    providerId: "coinbase_advanced_direct",
    symbolRequested: symbol,
    providerSymbolUsed: symbol,
    exchangeSpecific: true,
    aggregatedOnly: false,
    quoteAssetPreserved: true,
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
      : `Only ${diagnostics.fetchedCandles} usable Coinbase candles were returned.`,
    httpStatus: response.status,
    requestUrlKind,
    failureCategory: enough ? undefined : empty ? "empty_candle_history" : "fewer_than_200",
    providerGranularity,
    marketDataProvenance: "exchange_specific",
  });
}

function classifyCoinbaseAdvancedFailure(status: number, text: string) {
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

function errorCodeForCoinbaseAdvancedFailure(
  failureCategory: ReturnType<typeof classifyCoinbaseAdvancedFailure>,
) {
  switch (failureCategory) {
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

function buildCoinbaseAdvancedFailureMessage(
  status: number,
  failureCategory: ReturnType<typeof classifyCoinbaseAdvancedFailure>,
) {
  if (failureCategory === "auth_problem") {
    return `Coinbase Advanced rejected the supplied credentials with HTTP ${status}.`;
  }
  if (failureCategory === "product_not_found") {
    return `Coinbase Advanced returned HTTP ${status}; the product id may not exist on this endpoint.`;
  }
  if (failureCategory === "request_window_too_large") {
    return `Coinbase Advanced returned HTTP ${status}; the request window may exceed endpoint limits.`;
  }
  if (failureCategory === "timeframe_unsupported") {
    return `Coinbase Advanced returned HTTP ${status}; the requested granularity may be unsupported.`;
  }
  return `Coinbase Advanced request failed with HTTP ${status}.`;
}

function sanitizeProviderResponse(text: string, secret: string) {
  const trimmed = text.slice(0, 1_000);
  return trimmed.split(secret).join("[REDACTED]");
}
