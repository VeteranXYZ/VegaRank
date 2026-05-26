import type { Candle } from "@/lib/exchanges/types";
import type { IndicatorSnapshot } from "@/lib/indicators";
import type { ScannerExplanation } from "./types";

type RiskWarningInput = {
  snapshot: IndicatorSnapshot;
  candles: Candle[];
  sufficientHistory: boolean;
};

export function getRiskWarnings({
  snapshot,
  candles,
  sufficientHistory,
}: RiskWarningInput): ScannerExplanation[] {
  const warnings: ScannerExplanation[] = [];
  const latestCandle = candles.at(-1);

  if (snapshot.rsi14 !== null && snapshot.rsi14 > 75) {
    warnings.push({ key: "warning.rsiAbove75" });
  }

  if (
    snapshot.bollinger.upper !== null &&
    snapshot.close > snapshot.bollinger.upper &&
    (snapshot.volume.ratio === null || snapshot.volume.ratio < 1.2)
  ) {
    warnings.push({ key: "warning.possibleFakeBreakout" });
  }

  if (
    snapshot.priceExtensionFromMA20 !== null &&
    snapshot.priceExtensionFromMA20 > 0.08
  ) {
    warnings.push({ key: "warning.extendedFromMa20" });
  }

  if (snapshot.ma50 !== null && snapshot.close < snapshot.ma50) {
    warnings.push({ key: "warning.belowMa50" });
  }

  if (snapshot.ma200 !== null && snapshot.close < snapshot.ma200) {
    warnings.push({ key: "warning.belowMa200" });
  }

  if (snapshot.rsi14 !== null && snapshot.rsi14 < 45) {
    warnings.push({ key: "warning.rsiBelow45" });
  }

  if (
    snapshot.bollinger.widthPercentile !== null &&
    snapshot.bollinger.widthPercentile < 20 &&
    ((snapshot.ma50 !== null && snapshot.close < snapshot.ma50) ||
      (snapshot.ma200 !== null && snapshot.close < snapshot.ma200))
  ) {
    warnings.push({ key: "warning.weakCompressionBelowTrend" });
  }

  if (latestCandle && hasLongUpperWick(latestCandle)) {
    warnings.push({ key: "warning.longUpperWick" });
  }

  if (!sufficientHistory) {
    warnings.push({ key: "warning.insufficientHistory" });
  }

  return warnings;
}

function hasLongUpperWick(candle: Candle) {
  const range = candle.high - candle.low;

  if (range <= 0) {
    return false;
  }

  const upperWick = candle.high - Math.max(candle.open, candle.close);
  return upperWick / range > 0.45;
}
