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

type CryptoCompareHistoricalResponse = {
  Response?: string;
  Message?: string;
  Type?: number;
  Data?: {
    Data?: CryptoCompareCandle[];
  };
};

type CryptoCompareCandle = {
  time: number;
  high: number;
  low: number;
  open: number;
  volumefrom: number;
  volumeto?: number;
  close: number;
};

type ParsedCryptoSymbol = {
  base: string;
  quote: string;
  exchange: "Coinbase" | "Binance" | "CCCAGG";
  mappingConfidence: "exact" | "inferred" | "missing";
};

const quoteSuffixes = ["USDT", "USDC", "USD", "BTC", "ETH"] as const;

export function createCryptoCompareProbe(options: {
  apiBaseUrl?: string;
  apiKey?: string;
} = {}): LiveProviderProbe {
  return {
    providerId: "cryptocompare",
    audit: (request) =>
      auditCryptoCompare({
        ...request,
        apiBaseUrl: options.apiBaseUrl ?? "https://min-api.cryptocompare.com",
        apiKey: options.apiKey,
      }),
  };
}

async function auditCryptoCompare({
  symbol,
  timeframe,
  lookbackDays,
  timeoutMs,
  nowMs,
  fetcher,
  apiBaseUrl,
  apiKey,
}: LiveProviderProbeRequest & {
  apiBaseUrl: string;
  apiKey?: string;
}): Promise<LiveProviderAuditResult> {
  const parsed = parseCryptoCompareSymbol(symbol);

  if (parsed.mappingConfidence === "missing") {
    return buildEmptyAuditResult({
      providerId: "cryptocompare",
      symbolRequested: symbol,
      providerSymbolUsed: symbol,
      exchangeSpecific: "unknown",
      aggregatedOnly: "unknown",
      quoteAssetPreserved: "unknown",
      timeframe,
      nativeIntervalSupported: "unknown",
      fetchedCandles: 0,
      enoughForVegaRank200: false,
      requestCount: 0,
      authRequired: false,
      errorCode: "symbol_mapping_missing",
      errorMessage: "Could not infer base and quote assets for CryptoCompare.",
      failureCategory: "symbol_mapping_missing",
      marketDataProvenance: "uncertain",
    });
  }

  const endpoint = timeframe === "1h" || timeframe === "4h" ? "histohour" : "histoday";
  const aggregate = timeframe === "4h" ? 4 : timeframe === "1w" ? 7 : 1;
  const requestedCandles = Math.min(
    2000,
    Math.max(200, Math.ceil((lookbackDays * 24 * 60 * 60 * 1000) / getTimeframeDurationMs(timeframe))),
  );
  const url = new URL(`/data/v2/${endpoint}`, apiBaseUrl);
  url.searchParams.set("fsym", parsed.base);
  url.searchParams.set("tsym", parsed.quote);
  url.searchParams.set("limit", String(Math.min(2000, requestedCandles)));
  url.searchParams.set("aggregate", String(aggregate));
  url.searchParams.set("toTs", String(Math.floor(nowMs / 1000)));
  url.searchParams.set("e", parsed.exchange);
  if (apiKey) {
    url.searchParams.set("api_key", apiKey);
  }

  const response = await fetchJsonWithAuditTimeout(fetcher, url, timeoutMs);
  const body = response.json as CryptoCompareHistoricalResponse | undefined;
  const authRequired =
    response.status === 401 ||
    response.status === 403 ||
    /api\s*key|auth/i.test(body?.Message ?? response.text);

  if (!response.ok || body?.Response === "Error") {
    return buildEmptyAuditResult({
      providerId: "cryptocompare",
      symbolRequested: symbol,
      providerSymbolUsed: `${parsed.exchange}:${parsed.base}/${parsed.quote}`,
      exchangeSpecific: parsed.exchange !== "CCCAGG",
      aggregatedOnly: parsed.exchange === "CCCAGG",
      quoteAssetPreserved: true,
      timeframe,
      nativeIntervalSupported: timeframe === "1w" ? false : true,
      fetchedCandles: 0,
      enoughForVegaRank200: false,
      requestCount: 1,
      rateLimitObserved: response.rateLimitObserved,
      authRequired,
      errorCode: authRequired ? "auth_required" : "provider_error",
      errorMessage:
        body?.Message ??
        (authRequired
          ? "CryptoCompare requires or rejected an API key for this request."
          : `CryptoCompare request failed with ${response.status}.`),
      dataUseWarning: buildCryptoCompareWarning(timeframe, parsed),
      httpStatus: response.status,
      requestUrlKind: `cryptocompare_${endpoint}`,
      failureCategory: authRequired ? "auth_problem" : "provider_error",
      providerGranularity:
        timeframe === "4h"
          ? "histohour aggregate=4"
          : timeframe === "1w"
            ? "histoday aggregate=7"
            : endpoint,
      sanitizedProviderResponse: sanitizeCryptoCompareResponse(body?.Message ?? response.text, apiKey),
      marketDataProvenance: getCryptoCompareProvenance(parsed),
    });
  }

  const rows = Array.isArray(body?.Data?.Data) ? body.Data.Data : [];
  const candles = rows.map((row) => mapCryptoCompareCandleToCandle(row, timeframe));
  const diagnostics = normalizeAuditCandles(candles, timeframe);

  return buildEmptyAuditResult({
    providerId: "cryptocompare",
    symbolRequested: symbol,
    providerSymbolUsed: `${parsed.exchange}:${parsed.base}/${parsed.quote}`,
    exchangeSpecific: parsed.exchange !== "CCCAGG",
    aggregatedOnly: parsed.exchange === "CCCAGG",
    quoteAssetPreserved: true,
    timeframe,
    nativeIntervalSupported: timeframe === "1w" ? false : true,
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
      : `Only ${diagnostics.fetchedCandles} usable CryptoCompare candles were returned.`,
    dataUseWarning: buildCryptoCompareWarning(timeframe, parsed),
    httpStatus: response.status,
    requestUrlKind: `cryptocompare_${endpoint}`,
    failureCategory:
      diagnostics.enoughForVegaRank200
        ? undefined
        : diagnostics.fetchedCandles === 0
          ? "empty_candle_history"
          : "fewer_than_200",
    providerGranularity:
      timeframe === "4h"
        ? "histohour aggregate=4"
        : timeframe === "1w"
          ? "histoday aggregate=7"
          : endpoint,
    marketDataProvenance: getCryptoCompareProvenance(parsed),
  });
}

function mapCryptoCompareCandleToCandle(
  row: CryptoCompareCandle,
  timeframe: LiveAuditTimeframe,
): Candle {
  const openTime = row.time * 1000;

  return {
    openTime,
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
    volume: Number(row.volumefrom),
    quoteVolume: row.volumeto === undefined ? undefined : Number(row.volumeto),
    closeTime: openTime + getTimeframeDurationMs(timeframe) - 1,
  };
}

function parseCryptoCompareSymbol(symbol: string): ParsedCryptoSymbol {
  const normalized = symbol.trim().toUpperCase();

  if (normalized.includes("-")) {
    const [base, quote] = normalized.split("-");
    if (base && quote) {
      return {
        base,
        quote,
        exchange: "Coinbase",
        mappingConfidence: "exact",
      };
    }
  }

  for (const quote of quoteSuffixes) {
    if (normalized.endsWith(quote) && normalized.length > quote.length) {
      return {
        base: normalized.slice(0, -quote.length),
        quote,
        exchange: quote === "USDT" ? "Binance" : "CCCAGG",
        mappingConfidence: "inferred",
      };
    }
  }

  return {
    base: normalized,
    quote: "",
    exchange: "CCCAGG",
    mappingConfidence: "missing",
  };
}

function buildCryptoCompareWarning(
  timeframe: LiveAuditTimeframe,
  parsed: ParsedCryptoSymbol,
) {
  const warnings: string[] = [];

  if (parsed.mappingConfidence === "inferred") {
    warnings.push("Symbol mapping was inferred from quote suffix.");
  }

  if (parsed.exchange === "CCCAGG") {
    warnings.push("CryptoCompare CCCAGG is aggregated and must not be used as exchange-specific primary.");
  } else {
    warnings.push("Verify CryptoCompare exchange parameter semantics before production use.");
  }

  if (timeframe === "4h") {
    warnings.push("4h uses CryptoCompare aggregate=4 on hourly history.");
  }

  if (timeframe === "1w") {
    warnings.push("1w uses CryptoCompare aggregate=7 on daily history and is not native weekly.");
  }

  return warnings.join(" ");
}

function getCryptoCompareProvenance(parsed: ParsedCryptoSymbol) {
  if (parsed.exchange === "CCCAGG") {
    return "aggregated" as const;
  }
  if (parsed.mappingConfidence === "exact") {
    return "exchange_specific" as const;
  }
  return "uncertain" as const;
}

function sanitizeCryptoCompareResponse(text: string, apiKey: string | undefined) {
  let sanitized = text.slice(0, 1_000);
  if (apiKey) {
    sanitized = sanitized.split(apiKey).join("[REDACTED]");
  }
  return sanitized;
}
