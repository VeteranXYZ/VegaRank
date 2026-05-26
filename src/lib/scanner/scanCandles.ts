import type { Candle, Timeframe } from "@/lib/exchanges/types";
import { calculateIndicatorSnapshot } from "@/lib/indicators";
import { getReasons, getInvalidation, getNextConfirmation } from "./explanations";
import { determineMarketPhase } from "./marketPhase";
import { getRiskWarnings } from "./riskFilters";
import { calculateScannerScores } from "./scoring";
import { deriveScannerSignal } from "./signal";
import type { ScanResult } from "./types";

export function scanCandles(
  symbol: string,
  timeframe: Timeframe,
  candles: Candle[],
): ScanResult {
  const closedCandles = getClosedCandles(candles);
  const snapshot = calculateIndicatorSnapshot(closedCandles);
  const missingIndicators = getMissingIndicators(snapshot);
  const sufficientHistory = closedCandles.length >= 200;
  const phase = determineMarketPhase(snapshot, closedCandles);
  const scores = calculateScannerScores({ snapshot, sufficientHistory, phase });
  const signal = deriveScannerSignal({ phase, ...scores });
  const lastClosedCandle = closedCandles.at(-1);

  return {
    exchange: "binance",
    symbol,
    timeframe,
    price: snapshot.close,
    phase,
    signal,
    ...scores,
    rsi14: snapshot.rsi14,
    bbWidthPercentile: snapshot.bollinger.widthPercentile,
    volumeRatio: snapshot.volume.ratio,
    maStatus: getMaStatus(snapshot),
    reasons: getReasons({ phase, snapshot, sufficientHistory, timeframe }),
    warnings: getRiskWarnings({ snapshot, candles: closedCandles, sufficientHistory }),
    nextConfirmation: getNextConfirmation({
      phase,
      snapshot,
      sufficientHistory,
      timeframe,
    }),
    invalidation: getInvalidation({ phase, snapshot, sufficientHistory, timeframe }),
    dataQuality: {
      candleCount: closedCandles.length,
      sufficientHistory,
      missingIndicators,
      usesClosedCandles: true,
      lastClosedCandleTime: lastClosedCandle?.closeTime ?? null,
    },
  };
}

export function getClosedCandles(candles: Candle[], now = Date.now()) {
  const latestCandle = candles.at(-1);

  if (!latestCandle || latestCandle.closeTime <= now) {
    return candles;
  }

  return candles.slice(0, -1);
}

function getMaStatus(snapshot: ReturnType<typeof calculateIndicatorSnapshot>) {
  return {
    aboveMA20: snapshot.ma20 !== null && snapshot.close > snapshot.ma20,
    aboveMA50: snapshot.ma50 !== null && snapshot.close > snapshot.ma50,
    aboveMA200: snapshot.ma200 !== null && snapshot.close > snapshot.ma200,
    ma20AboveMA50:
      snapshot.ma20 !== null && snapshot.ma50 !== null && snapshot.ma20 > snapshot.ma50,
    ma50AboveMA200:
      snapshot.ma50 !== null &&
      snapshot.ma200 !== null &&
      snapshot.ma50 > snapshot.ma200,
  };
}

function getMissingIndicators(snapshot: ReturnType<typeof calculateIndicatorSnapshot>) {
  const missing: string[] = [];

  if (snapshot.ma20 === null) missing.push("ma20");
  if (snapshot.ma50 === null) missing.push("ma50");
  if (snapshot.ma200 === null) missing.push("ma200");
  if (snapshot.bollinger.upper === null) missing.push("bollinger");
  if (snapshot.bollinger.widthPercentile === null) {
    missing.push("bollingerWidthPercentile");
  }
  if (snapshot.rsi14 === null) missing.push("rsi14");
  if (snapshot.volume.ma20 === null) missing.push("volumeMa20");
  if (snapshot.volume.ratio === null) missing.push("volumeRatio");
  if (snapshot.priceExtensionFromMA20 === null) {
    missing.push("priceExtensionFromMA20");
  }

  return missing;
}
