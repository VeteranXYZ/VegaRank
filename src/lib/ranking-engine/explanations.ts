import type { Timeframe } from "@/lib/exchanges/types";
import type { IndicatorSnapshot } from "@/lib/indicators";
import type { MarketPhase, ScannerExplanation, ScanResult } from "./types";

type ExplanationInput = {
  phase: MarketPhase;
  snapshot: IndicatorSnapshot;
  volume?: ScanResult["volume"];
  sufficientHistory: boolean;
  timeframe: Timeframe;
};

export function getReasons({
  phase,
  snapshot,
  volume,
  sufficientHistory,
}: ExplanationInput): ScannerExplanation[] {
  const reasons: ScannerExplanation[] = [];

  if (
    snapshot.bollinger.widthPercentile !== null &&
    snapshot.bollinger.widthPercentile < 20
  ) {
    reasons.push({ key: "reason.bbWidthLow" });
  }

  if (areNear(snapshot.ma20, snapshot.ma50, 0.02)) {
    reasons.push({ key: "reason.ma20Ma50Converging" });
  }

  if (isNear(snapshot.close, snapshot.bollinger.middle, 0.025)) {
    reasons.push({ key: "reason.priceNearBollingerMiddle" });
  }

  if (isBetween(snapshot.volume.ratio20, 0.6, 1.2)) {
    reasons.push({ key: "reason.quietVolumeCompression" });
  }

  if (volume?.quietCompression) {
    reasons.push({ key: "reason.quietVolumeCompression" });
  }

  if (volume?.dryUp && phase === "SQUEEZE") {
    reasons.push({ key: "reason.volumeDryUpCompression" });
  }

  if (volume?.expanding) {
    reasons.push({ key: "reason.volumeExpansion" });
  }

  if (volume?.breakoutConfirmed) {
    reasons.push({ key: "reason.breakoutVolumeConfirmed" });
  }

  if (volume?.pullbackHealthy) {
    reasons.push({ key: "reason.pullbackVolumeHealthy" });
  }

  if (
    snapshot.bollinger.upper !== null &&
    snapshot.close > snapshot.bollinger.upper
  ) {
    reasons.push({ key: "reason.priceAboveUpperBollinger" });
  }

  if (snapshot.volume.ratio20 !== null && snapshot.volume.ratio20 > 1.5) {
    reasons.push({ key: "reason.volumeExpanding" });
  }

  if (
    snapshot.ma20 !== null &&
    snapshot.ma50 !== null &&
    snapshot.ma20 > snapshot.ma50
  ) {
    reasons.push({ key: "reason.ma20AboveMa50" });
  }

  if (snapshot.ma200 !== null && snapshot.close > snapshot.ma200) {
    reasons.push({ key: "reason.priceAboveMa200" });
  }

  if (snapshot.macd.histogramRising) {
    reasons.push({ key: "reason.macdHistogramRising" });
  }

  if (snapshot.macd.bullishCross) {
    reasons.push({ key: "reason.macdBullishCross" });
  }

  if (snapshot.macd.aboveZero) {
    reasons.push({ key: "reason.macdAboveZero" });
  }

  if (reasons.length === 0 && sufficientHistory) {
    reasons.push({ key: "reason.phaseClassification", params: { phase } });
  }

  if (!sufficientHistory) {
    reasons.push({ key: "reason.limitedHistory" });
  }

  return dedupe(reasons);
}

export function getNextConfirmation({
  phase,
  snapshot,
  timeframe,
}: ExplanationInput): ScannerExplanation[] {
  const confirmations: ScannerExplanation[] = [];

  if (phase === "SQUEEZE" || phase === "BASE_BUILDING") {
    confirmations.push({
      key: "confirmation.closeAboveUpperBollinger",
      params: { timeframe },
    });
    confirmations.push({ key: "confirmation.volumeAbove1_5" });
  }

  if (phase === "BREAKOUT_ATTEMPT") {
    confirmations.push({ key: "confirmation.breakoutVolume" });
    confirmations.push({ key: "confirmation.rsiBelow72" });
  }

  if (phase === "TRENDING" || phase === "PULLBACK_HEALTHY") {
    confirmations.push({ key: "confirmation.priceAboveMa50" });
    confirmations.push({ key: "confirmation.pullbackHoldMa20OrMiddle" });
  }

  if (phase === "OVEREXTENDED") {
    confirmations.push({ key: "confirmation.consolidateNearMa20" });
    confirmations.push({ key: "confirmation.rsiCoolBelow72" });
  }

  if (phase === "BREAKDOWN" || phase === "DISTRIBUTION") {
    confirmations.push({ key: "confirmation.recoverMa50" });
    confirmations.push({ key: "confirmation.declineVolumeStabilize" });
  }

  if (
    snapshot.ma20 !== null &&
    snapshot.ma50 !== null &&
    snapshot.ma20 <= snapshot.ma50
  ) {
    confirmations.push({ key: "confirmation.ma20TurnAboveMa50" });
  }

  return dedupe(confirmations);
}

export function getInvalidation({
  phase,
  snapshot,
}: ExplanationInput): ScannerExplanation[] {
  const invalidation: ScannerExplanation[] = [];

  if (phase === "SQUEEZE" || phase === "BASE_BUILDING") {
    invalidation.push({ key: "invalidation.loseBollingerMiddleWithVolume" });
  }

  if (
    phase === "BREAKOUT_ATTEMPT" ||
    phase === "BREAKOUT_CONFIRMED" ||
    phase === "TRENDING"
  ) {
    invalidation.push({ key: "invalidation.closeBelowMa50" });
  }

  if (phase === "PULLBACK_HEALTHY") {
    invalidation.push({ key: "invalidation.pullbackBelowMa50" });
  }

  if (phase === "OVEREXTENDED") {
    invalidation.push({ key: "invalidation.extensionBelowMa20" });
  }

  if (phase === "BREAKDOWN" || phase === "DISTRIBUTION") {
    invalidation.push({ key: "invalidation.weakUntilRecoverMa50" });
  }

  if (snapshot.ma200 !== null) {
    invalidation.push({ key: "invalidation.closeBelowMa200" });
  }

  return dedupe(invalidation);
}

function isBetween(value: number | null, min: number, max: number) {
  return value !== null && value >= min && value <= max;
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

function dedupe(items: ScannerExplanation[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const id = JSON.stringify(item);
    if (seen.has(id)) {
      return false;
    }

    seen.add(id);
    return true;
  });
}
