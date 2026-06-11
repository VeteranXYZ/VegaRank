import type { Candle } from "@/lib/exchanges/types";
import type { IndicatorSnapshot } from "@/lib/indicators";
import { volumeThresholds } from "@/lib/indicators/volume";
import type { MarketPhase, ScanResult } from "./types";

export function getVolumeAnalysis({
  snapshot,
  phase,
  candles,
}: {
  snapshot: IndicatorSnapshot;
  phase: MarketPhase;
  candles: Candle[];
}): ScanResult["volume"] {
  const latestCandle = candles.at(-1);
  const ratio20 = snapshot.volume.ratio20;
  const nearMean =
    isNear(snapshot.close, snapshot.ma20, 0.025) ||
    isNear(snapshot.close, snapshot.bollinger.middle, 0.025);
  const priceNearUpper =
    snapshot.bollinger.upper !== null &&
    snapshot.close >= snapshot.bollinger.upper * 0.98;
  const weakClose = latestCandle ? latestCandle.close < latestCandle.open : false;
  const longUpperWick = latestCandle ? hasLongUpperWick(latestCandle) : false;
  const quietCompression =
    ratio20 !== null &&
    ratio20 >= volumeThresholds.quietCompressionMinRatio20 &&
    ratio20 <= volumeThresholds.quietCompressionMaxRatio20 &&
    snapshot.bollinger.widthPercentile !== null &&
    snapshot.bollinger.widthPercentile <= 35;

  return {
    latest: snapshot.volume.latest,
    ma20: snapshot.volume.ma20,
    ma50: snapshot.volume.ma50,
    ratio20,
    ratio50: snapshot.volume.ratio50,
    quoteVolumeLatest: snapshot.volume.quoteVolumeLatest,
    quoteVolumeMA20: snapshot.volume.quoteVolumeMA20,
    dryUp: snapshot.volume.dryUp,
    expanding: snapshot.volume.expanding,
    abnormalSpike: snapshot.volume.abnormalSpike,
    breakoutConfirmed:
      snapshot.volume.expanding &&
      (phase === "BREAKOUT_ATTEMPT" ||
        phase === "BREAKOUT_CONFIRMED" ||
        (snapshot.bollinger.upper !== null && snapshot.close > snapshot.bollinger.upper)),
    pullbackHealthy:
      (phase === "PULLBACK_HEALTHY" || nearMean) &&
      ratio20 !== null &&
      ratio20 <= volumeThresholds.healthyPullbackMaxRatio20 &&
      !longUpperWick &&
      !weakClose,
    distributionWarning:
      ratio20 !== null &&
      ratio20 >= volumeThresholds.distributionMinRatio20 &&
      (longUpperWick || weakClose) &&
      (priceNearUpper ||
        (snapshot.priceExtensionFromMA20 !== null &&
          snapshot.priceExtensionFromMA20 > 0.06)),
    quietCompression,
  };
}

function isNear(value: number, target: number | null, tolerance: number) {
  if (target === null || target === 0) {
    return false;
  }

  return Math.abs(value - target) / Math.abs(target) <= tolerance;
}

function hasLongUpperWick(candle: Candle) {
  const range = candle.high - candle.low;

  if (range <= 0) {
    return false;
  }

  const upperWick = candle.high - Math.max(candle.open, candle.close);
  return upperWick / range > 0.45;
}
