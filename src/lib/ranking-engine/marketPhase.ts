import type { Candle } from "@/lib/exchanges/types";
import type { IndicatorSnapshot } from "@/lib/indicators";
import type { MarketPhase } from "./types";

export function determineMarketPhase(
  snapshot: IndicatorSnapshot,
  candles: Candle[],
): MarketPhase {
  const close = snapshot.close;
  const rsi = snapshot.rsi14;
  const volumeRatio = snapshot.volume.ratio;
  const { ma20, ma50, ma200, bollinger, priceExtensionFromMA20 } = snapshot;
  const latestCandle = candles.at(-1);

  if (rsi !== null && rsi > 75) {
    return "OVEREXTENDED";
  }

  if (
    priceExtensionFromMA20 !== null &&
    priceExtensionFromMA20 > 0.08 &&
    close > (bollinger.upper ?? Number.POSITIVE_INFINITY)
  ) {
    return "OVEREXTENDED";
  }

  if (
    latestCandle &&
    volumeRatio !== null &&
    volumeRatio > 1.5 &&
    hasLongUpperWick(latestCandle) &&
    latestCandle.close < latestCandle.open
  ) {
    return "DISTRIBUTION";
  }

  if (
    ((ma50 !== null && close < ma50) || (ma200 !== null && close < ma200)) &&
    rsi !== null &&
    rsi < 45
  ) {
    return "BREAKDOWN";
  }

  if (
    bollinger.upper !== null &&
    close > bollinger.upper &&
    volumeRatio !== null &&
    volumeRatio > 1.5 &&
    ma20 !== null &&
    ma50 !== null &&
    ma20 > ma50 &&
    rsi !== null &&
    rsi >= 55 &&
    rsi <= 72
  ) {
    return "BREAKOUT_CONFIRMED";
  }

  if (
    bollinger.upper !== null &&
    close >= bollinger.upper * 0.995 &&
    rsi !== null &&
    rsi > 55
  ) {
    return "BREAKOUT_ATTEMPT";
  }

  if (
    ma20 !== null &&
    ma50 !== null &&
    close > ma20 &&
    ma20 > ma50 &&
    (ma200 === null || close > ma200) &&
    rsi !== null &&
    rsi >= 50 &&
    rsi <= 70
  ) {
    return "TRENDING";
  }

  if (
    ma50 !== null &&
    close > ma50 &&
    rsi !== null &&
    rsi > 45 &&
    (isNear(close, ma20, 0.025) || isNear(close, bollinger.middle, 0.025))
  ) {
    return "PULLBACK_HEALTHY";
  }

  if (
    bollinger.widthPercentile !== null &&
    bollinger.widthPercentile < 20 &&
    areNear(ma20, ma50, 0.02) &&
    isNear(close, bollinger.middle, 0.025)
  ) {
    return "SQUEEZE";
  }

  return "BASE_BUILDING";
}

function isNear(value: number, target: number | null, tolerance: number) {
  if (target === null || target === 0) {
    return false;
  }

  return Math.abs(value - target) / Math.abs(target) <= tolerance;
}

function areNear(left: number | null, right: number | null, tolerance: number) {
  if (left === null || right === null || right === 0) {
    return false;
  }

  return Math.abs(left - right) / Math.abs(right) <= tolerance;
}

function hasLongUpperWick(candle: Candle) {
  const range = candle.high - candle.low;

  if (range <= 0) {
    return false;
  }

  const upperWick = candle.high - Math.max(candle.open, candle.close);
  return upperWick / range > 0.45;
}
