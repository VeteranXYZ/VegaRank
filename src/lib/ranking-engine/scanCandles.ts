import type { Candle, Exchange, Timeframe } from "@/lib/exchanges/types";
import { calculateIndicatorSnapshot } from "@/lib/indicators";
import { getReasons, getInvalidation, getNextConfirmation } from "./explanations";
import { determineMarketPhase } from "./marketPhase";
import { buildResearchSignal, calculateScannerScores } from "./quantScoring";
import { getRiskWarnings } from "./riskFilters";
import type { ScanResult } from "./types";
import { getVolumeAnalysis } from "./volumeAnalysis";
import { scannerCodeVersions } from "@/lib/vegarank-codebook/codeRegistry";

export function scanCandles(
  symbol: string,
  timeframe: Timeframe,
  candles: Candle[],
  { exchange = "binance" }: { exchange?: Exchange } = {},
): ScanResult {
  const closedCandles = getClosedCandles(candles);
  const snapshot = calculateIndicatorSnapshot(closedCandles);
  const missingIndicators = getMissingIndicators(snapshot);
  const sufficientHistory = closedCandles.length >= 200;
  const phase = determineMarketPhase(snapshot, closedCandles);
  const volume = getVolumeAnalysis({ snapshot, phase, candles: closedCandles });
  const scores = calculateScannerScores({
    snapshot,
    sufficientHistory,
    phase,
    volume,
    candles: closedCandles,
  });
  const signal = buildResearchSignal(
    scores.attribution.groupCode,
    scores.attribution.actionCode,
  );
  const lastClosedCandle = closedCandles.at(-1);
  const codeContract = {
    exchange,
    symbol,
    timeframe,
    groupCode: scores.attribution.groupCode,
    actionCode: scores.attribution.actionCode,
    riskCode: scores.attribution.riskCode,
    riskCodes: scores.attribution.riskCodes,
    setupCode: scores.attribution.setupCode,
    phaseCode: scores.attribution.phaseCode,
    reasonCodes: scores.attribution.reasonCodes,
    signalCodes: scores.attribution.signalCodes,
    qualityCodes: scores.attribution.qualityCodes,
    metrics: scores.metrics,
    ...scannerCodeVersions,
  };

  return {
    exchange,
    symbol,
    timeframe,
    price: snapshot.close,
    phase,
    signal,
    ...scores,
    codeContract,
    rsi14: snapshot.rsi14,
    bbPercent: scores.metrics.bbPercent ?? null,
    bbWidthPercentile: snapshot.bollinger.widthPercentile,
    volumeRatio: snapshot.volume.ratio20,
    volume,
    macd: getMacdStatus(snapshot),
    maStatus: getMaStatus(snapshot),
    reasons: getReasons({ phase, snapshot, volume, sufficientHistory, timeframe }),
    warnings: getRiskWarnings({
      phase,
      snapshot,
      volume,
      candles: closedCandles,
      sufficientHistory,
    }),
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
      lastClosedCandleOpenTime: lastClosedCandle?.openTime ?? null,
      lastClosedCandleCloseTime: lastClosedCandle?.closeTime ?? null,
      lastClosedCandleTime: lastClosedCandle?.closeTime ?? null,
    },
  };
}

function getMacdStatus(snapshot: ReturnType<typeof calculateIndicatorSnapshot>) {
  if (
    snapshot.macd.line === null ||
    snapshot.macd.signal === null ||
    snapshot.macd.histogram === null
  ) {
    return undefined;
  }

  return {
    line: snapshot.macd.line,
    signal: snapshot.macd.signal,
    histogram: snapshot.macd.histogram,
    histogramRising: snapshot.macd.histogramRising,
    bullishCross: snapshot.macd.bullishCross,
    bearishCross: snapshot.macd.bearishCross,
    aboveZero: snapshot.macd.aboveZero,
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
  if (snapshot.volume.ratio20 === null) missing.push("volumeRatio");
  if (snapshot.macd.line === null) missing.push("macd");
  if (snapshot.priceExtensionFromMA20 === null) {
    missing.push("priceExtensionFromMA20");
  }

  return missing;
}
