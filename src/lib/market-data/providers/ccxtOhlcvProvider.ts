import type { Candle } from "@/lib/shared/timeframes";
import { normalizeCandles } from "../candleQuality";
import { getCandleTimeframeDurationMs } from "../candleBackfillPlanner";
import { getMondayUtcWeekStartMs } from "../weeklyAggregation";

export type CcxtExchangeId = "binance" | "coinbase";
export type CcxtAuditTimeframe = "1h" | "4h" | "1d" | "1w";
export type CcxtUnsupportedReason =
  | "fetch_ohlcv_not_supported"
  | "unsupported_timeframe";

export type CcxtOhlcvRow = [
  number | string,
  number | string,
  number | string,
  number | string,
  number | string,
  number | string,
];

export type CcxtClientLike = {
  has?: {
    fetchOHLCV?: boolean | "emulated";
  };
  timeframes?: Record<string, string> | string[];
  fetchOHLCV: (
    symbol: string,
    timeframe: string,
    since?: number,
    limit?: number,
    params?: Record<string, unknown>,
  ) => Promise<CcxtOhlcvRow[]>;
  close?: () => Promise<void>;
};

export type CcxtOhlcvAuditOptions = {
  exchange: CcxtExchangeId;
  symbol: string;
  timeframe: CcxtAuditTimeframe;
  limit: number;
  nowMs?: number;
  includeIncompleteCurrentWeek?: boolean;
};

export type WeeklyDerivationDiagnostics = {
  sourceDailyCandles: number;
  generatedWeeklyCandles: number;
  completeWeeks: number;
  incompleteWeeksDropped: number;
  missingDailyWeeksDropped: number;
  firstOpenTime?: number;
  lastOpenTime?: number;
  gapCount: number;
  enoughForVegaRank200: boolean;
};

export type CcxtOhlcvAuditResult = {
  provider: "ccxt";
  exchange: CcxtExchangeId;
  originalSymbol: string;
  ccxtSymbol: string;
  timeframe: CcxtAuditTimeframe;
  nativeTimeframeSupported: boolean;
  derived: boolean;
  derivationMethod?: "daily_to_weekly_utc";
  sourceTimeframe?: "1d";
  fetchedCandles: number;
  generatedCandles: number;
  enoughForVegaRank200: boolean;
  scannerEligible: boolean;
  firstOpenTime?: number;
  lastOpenTime?: number;
  gapCount: number;
  unsupportedReason?: CcxtUnsupportedReason;
  candles: Candle[];
  derivationDiagnostics?: WeeklyDerivationDiagnostics;
};

type CcxtModule = Record<
  CcxtExchangeId,
  new (options?: Record<string, unknown>) => CcxtClientLike
> & {
  default?: Partial<
    Record<CcxtExchangeId, new (options?: Record<string, unknown>) => CcxtClientLike>
  >;
};

const requiredCandleCount = 200;
const quoteSuffixes = ["USDT", "USDC", "USD", "BTC", "ETH"] as const;

export async function createCcxtOhlcvClient(
  exchange: CcxtExchangeId,
  options: Record<string, unknown> = {},
): Promise<CcxtClientLike> {
  const ccxtModule = (await import("ccxt")) as unknown as CcxtModule;
  const ExchangeClient = ccxtModule[exchange] ?? ccxtModule.default?.[exchange];

  if (!ExchangeClient) {
    throw new Error(`CCXT exchange client is unavailable for ${exchange}.`);
  }

  return new ExchangeClient({
    enableRateLimit: true,
    ...options,
  });
}

export async function auditCcxtOhlcv(
  client: CcxtClientLike,
  options: CcxtOhlcvAuditOptions,
): Promise<CcxtOhlcvAuditResult> {
  const ccxtSymbol = normalizeSymbolToCcxt(options.symbol);

  if (!isFetchOhlcvSupported(client)) {
    return buildUnsupportedResult(options, ccxtSymbol, "fetch_ohlcv_not_supported");
  }

  if (options.timeframe === "1w") {
    if (isNativeTimeframeSupported(client, "1w")) {
      return fetchNativeCcxtCandles(client, options, ccxtSymbol, "1w");
    }

    if (!isNativeTimeframeSupported(client, "1d")) {
      return buildUnsupportedResult(options, ccxtSymbol, "unsupported_timeframe");
    }

    return fetchDerivedWeeklyCandles(client, options, ccxtSymbol);
  }

  if (!isNativeTimeframeSupported(client, options.timeframe)) {
    return buildUnsupportedResult(options, ccxtSymbol, "unsupported_timeframe");
  }

  return fetchNativeCcxtCandles(client, options, ccxtSymbol, options.timeframe);
}

export function normalizeSymbolToCcxt(symbol: string) {
  const normalized = symbol.trim().toUpperCase();
  if (normalized.includes("/")) {
    return normalized;
  }

  if (normalized.includes("-")) {
    return normalized.split("-").join("/");
  }

  for (const quote of quoteSuffixes) {
    if (normalized.endsWith(quote) && normalized.length > quote.length) {
      return `${normalized.slice(0, -quote.length)}/${quote}`;
    }
  }

  return normalized;
}

export function isNativeTimeframeSupported(
  client: CcxtClientLike,
  timeframe: CcxtAuditTimeframe,
) {
  if (!isFetchOhlcvSupported(client)) {
    return false;
  }

  const timeframes = client.timeframes;
  if (!timeframes) {
    return false;
  }

  return Array.isArray(timeframes)
    ? timeframes.includes(timeframe)
    : Object.prototype.hasOwnProperty.call(timeframes, timeframe);
}

export function mapCcxtRowsToCandles(
  rows: CcxtOhlcvRow[],
  timeframe: CcxtAuditTimeframe,
): Candle[] {
  const durationMs = getCandleTimeframeDurationMs(timeframe);

  return rows
    .map((row) => mapCcxtRowToCandle(row, durationMs))
    .sort((left, right) => left.openTime - right.openTime);
}

function isFetchOhlcvSupported(client: CcxtClientLike) {
  return client.has?.fetchOHLCV === true;
}

async function fetchNativeCcxtCandles(
  client: CcxtClientLike,
  options: CcxtOhlcvAuditOptions,
  ccxtSymbol: string,
  fetchTimeframe: CcxtAuditTimeframe,
): Promise<CcxtOhlcvAuditResult> {
  const rows = await client.fetchOHLCV(
    ccxtSymbol,
    fetchTimeframe,
    undefined,
    options.limit,
    {},
  );
  const normalized = normalizeCandles(
    mapCcxtRowsToCandles(rows, fetchTimeframe),
    fetchTimeframe,
  );

  return {
    provider: "ccxt",
    exchange: options.exchange,
    originalSymbol: options.symbol,
    ccxtSymbol,
    timeframe: options.timeframe,
    nativeTimeframeSupported: true,
    derived: false,
    fetchedCandles: normalized.candles.length,
    generatedCandles: 0,
    enoughForVegaRank200: normalized.candles.length >= requiredCandleCount,
    scannerEligible: normalized.candles.length >= requiredCandleCount,
    firstOpenTime: normalized.diagnostics.firstOpenTime,
    lastOpenTime: normalized.diagnostics.lastOpenTime,
    gapCount: normalized.diagnostics.gapCount,
    candles: normalized.candles,
  };
}

async function fetchDerivedWeeklyCandles(
  client: CcxtClientLike,
  options: CcxtOhlcvAuditOptions,
  ccxtSymbol: string,
): Promise<CcxtOhlcvAuditResult> {
  const dailyLimit = options.limit * 7 + 7;
  const rows = await client.fetchOHLCV(ccxtSymbol, "1d", undefined, dailyLimit, {});
  const dailyCandles = normalizeCandles(mapCcxtRowsToCandles(rows, "1d"), "1d");
  const derivation = deriveWeeklyCandlesFromDaily(dailyCandles.candles, {
    nowMs: options.nowMs ?? Date.now(),
    includeIncompleteCurrentWeek: options.includeIncompleteCurrentWeek ?? false,
  });
  const weeklyDiagnostics = normalizeCandles(derivation.weeklyCandles, "1w");
  const enoughForVegaRank200 =
    weeklyDiagnostics.candles.length >= requiredCandleCount;
  const gapCount =
    dailyCandles.diagnostics.gapCount + weeklyDiagnostics.diagnostics.gapCount;
  const derivationDiagnostics: WeeklyDerivationDiagnostics = {
    sourceDailyCandles: dailyCandles.candles.length,
    generatedWeeklyCandles: weeklyDiagnostics.candles.length,
    completeWeeks: derivation.completeWeeks,
    incompleteWeeksDropped: derivation.incompleteWeeksDropped,
    missingDailyWeeksDropped: derivation.missingDailyWeeksDropped,
    firstOpenTime: weeklyDiagnostics.diagnostics.firstOpenTime,
    lastOpenTime: weeklyDiagnostics.diagnostics.lastOpenTime,
    gapCount,
    enoughForVegaRank200,
  };

  return {
    provider: "ccxt",
    exchange: options.exchange,
    originalSymbol: options.symbol,
    ccxtSymbol,
    timeframe: "1w",
    nativeTimeframeSupported: false,
    derived: true,
    derivationMethod: "daily_to_weekly_utc",
    sourceTimeframe: "1d",
    fetchedCandles: dailyCandles.candles.length,
    generatedCandles: weeklyDiagnostics.candles.length,
    enoughForVegaRank200,
    scannerEligible: enoughForVegaRank200,
    firstOpenTime: weeklyDiagnostics.diagnostics.firstOpenTime,
    lastOpenTime: weeklyDiagnostics.diagnostics.lastOpenTime,
    gapCount,
    candles: weeklyDiagnostics.candles,
    derivationDiagnostics,
  };
}

function deriveWeeklyCandlesFromDaily(
  dailyCandles: Candle[],
  options: {
    nowMs: number;
    includeIncompleteCurrentWeek: boolean;
  },
) {
  const groups = groupDailyCandlesByMondayUtcWeek(dailyCandles);
  const currentWeekStartMs = getMondayUtcWeekStartMs(options.nowMs);
  const weeklyCandles: Candle[] = [];
  let completeWeeks = 0;
  let incompleteWeeksDropped = 0;
  let missingDailyWeeksDropped = 0;

  for (const group of groups) {
    const complete = isCompleteDailyWeek(group.weekStartTimeMs, group.candles);
    const currentWeek = group.weekStartTimeMs === currentWeekStartMs;

    if (complete) {
      completeWeeks += 1;
      weeklyCandles.push(buildWeeklyCandle(group.weekStartTimeMs, group.candles));
      continue;
    }

    if (currentWeek) {
      if (options.includeIncompleteCurrentWeek && group.candles.length > 0) {
        weeklyCandles.push(buildWeeklyCandle(group.weekStartTimeMs, group.candles));
      } else {
        incompleteWeeksDropped += 1;
      }
      continue;
    }

    missingDailyWeeksDropped += 1;
  }

  return {
    weeklyCandles,
    completeWeeks,
    incompleteWeeksDropped,
    missingDailyWeeksDropped,
  };
}

function buildUnsupportedResult(
  options: CcxtOhlcvAuditOptions,
  ccxtSymbol: string,
  unsupportedReason: CcxtUnsupportedReason,
): CcxtOhlcvAuditResult {
  return {
    provider: "ccxt",
    exchange: options.exchange,
    originalSymbol: options.symbol,
    ccxtSymbol,
    timeframe: options.timeframe,
    nativeTimeframeSupported: false,
    derived: false,
    fetchedCandles: 0,
    generatedCandles: 0,
    enoughForVegaRank200: false,
    scannerEligible: false,
    gapCount: 0,
    unsupportedReason,
    candles: [],
  };
}

function mapCcxtRowToCandle(row: CcxtOhlcvRow, durationMs: number): Candle {
  const openTime = toFiniteNumber(row[0], "openTime");

  return {
    openTime,
    open: toFiniteNumber(row[1], "open"),
    high: toFiniteNumber(row[2], "high"),
    low: toFiniteNumber(row[3], "low"),
    close: toFiniteNumber(row[4], "close"),
    volume: toFiniteNumber(row[5], "volume"),
    closeTime: openTime + durationMs - 1,
  };
}

function groupDailyCandlesByMondayUtcWeek(candles: Candle[]) {
  const groups = new Map<number, Candle[]>();

  for (const candle of candles) {
    const weekStartTimeMs = getMondayUtcWeekStartMs(candle.openTime);
    const group = groups.get(weekStartTimeMs);

    if (group) {
      group.push(candle);
    } else {
      groups.set(weekStartTimeMs, [candle]);
    }
  }

  return [...groups.entries()]
    .sort(([leftWeekStart], [rightWeekStart]) => leftWeekStart - rightWeekStart)
    .map(([weekStartTimeMs, groupCandles]) => ({
      weekStartTimeMs,
      candles: groupCandles.sort((left, right) => left.openTime - right.openTime),
    }));
}

function isCompleteDailyWeek(weekStartTimeMs: number, candles: Candle[]) {
  const dayMs = getCandleTimeframeDurationMs("1d");

  if (candles.length !== 7) {
    return false;
  }

  return candles.every(
    (candle, index) => candle.openTime === weekStartTimeMs + index * dayMs,
  );
}

function buildWeeklyCandle(weekStartTimeMs: number, candles: Candle[]): Candle {
  const firstCandle = candles[0]!;
  const lastCandle = candles.at(-1)!;
  const weekMs = getCandleTimeframeDurationMs("1w");

  return {
    openTime: weekStartTimeMs,
    open: firstCandle.open,
    high: Math.max(...candles.map((candle) => candle.high)),
    low: Math.min(...candles.map((candle) => candle.low)),
    close: lastCandle.close,
    volume: candles.reduce((total, candle) => total + candle.volume, 0),
    closeTime: weekStartTimeMs + weekMs - 1,
  };
}

function toFiniteNumber(value: number | string, field: string) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    throw new Error(`CCXT OHLCV ${field} must be finite.`);
  }

  return numberValue;
}
