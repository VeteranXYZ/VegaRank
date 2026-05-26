import type { IndicatorSnapshot } from "@/lib/indicators";
import type { MarketPhase, ScanResult } from "./types";

type ScoreInput = {
  snapshot: IndicatorSnapshot;
  sufficientHistory: boolean;
  phase?: MarketPhase;
  volume?: ScanResult["volume"];
};

export type ScannerScores = {
  opportunityScore: number;
  confirmationScore: number;
  riskScore: number;
  rankScore: number;
};

export function calculateScannerScores({
  snapshot,
  sufficientHistory,
  phase,
  volume,
}: ScoreInput): ScannerScores {
  const confirmationScore = calculateConfirmationScore(snapshot, phase, volume);
  const riskScore = calculateRiskScore(snapshot, sufficientHistory, phase, volume);
  const opportunityScore = capOpportunityScore({
    opportunityScore: calculateOpportunityScore(
      snapshot,
      sufficientHistory,
      phase,
      volume,
    ),
    confirmationScore,
    snapshot,
    phase,
  });
  const riskConfirmationPenalty =
    riskScore >= 55 && confirmationScore === 0 ? 20 : 0;

  // Rank score is only a sorting aid; the UI still exposes the component scores.
  const rankScore = clampScore(
    opportunityScore * 0.4 +
      confirmationScore * 0.4 -
      riskScore * 0.3 -
      getPhaseRankPenalty(phase) -
      riskConfirmationPenalty,
  );

  return {
    opportunityScore,
    confirmationScore,
    riskScore,
    rankScore,
  };
}

function capOpportunityScore({
  opportunityScore,
  confirmationScore,
  snapshot,
  phase,
}: {
  opportunityScore: number;
  confirmationScore: number;
  snapshot: IndicatorSnapshot;
  phase?: MarketPhase;
}) {
  let cap = 100;

  if (phase === "BREAKDOWN") {
    cap = Math.min(cap, 40);
  }

  if (confirmationScore < 20) {
    cap = Math.min(cap, 80);
  }

  if (phase === "PULLBACK_HEALTHY" && confirmationScore < 25) {
    cap = Math.min(cap, 85);
  }

  if (
    (phase === "SQUEEZE" || phase === "BASE_BUILDING") &&
    confirmationScore < 20
  ) {
    cap = Math.min(cap, 80);
  }

  if (
    snapshot.ma50 !== null &&
    snapshot.ma200 !== null &&
    snapshot.close < snapshot.ma50 &&
    snapshot.close < snapshot.ma200 &&
    confirmationScore < 45
  ) {
    cap = Math.min(cap, 50);
  }

  return Math.min(opportunityScore, cap);
}

export function clampScore(value: number) {
  return Math.min(100, Math.max(0, value));
}

function calculateOpportunityScore(
  snapshot: IndicatorSnapshot,
  sufficientHistory: boolean,
  phase?: MarketPhase,
  volume?: ScanResult["volume"],
) {
  let score = 0;

  if (
    snapshot.bollinger.widthPercentile !== null &&
    snapshot.bollinger.widthPercentile < 20
  ) {
    score += 30;
  }

  if (areNear(snapshot.ma20, snapshot.ma50, 0.02)) {
    score += 20;
  }

  if (isNear(snapshot.close, snapshot.bollinger.middle, 0.025)) {
    score += 15;
  }

  if (isBetween(snapshot.rsi14, 40, 65)) {
    score += 10;
  }

  if (isBetween(snapshot.volume.ratio20, 0.6, 1.2)) {
    score += 10;
  }

  if (
    snapshot.bollinger.widthPercentile !== null &&
    snapshot.bollinger.widthPercentile <= 35 &&
    (volume?.quietCompression || volume?.dryUp)
  ) {
    score += 10;
  }

  if (phase === "PULLBACK_HEALTHY" && volume?.pullbackHealthy) {
    score += 10;
  }

  if (
    sufficientHistory &&
    (snapshot.ma50 === null || snapshot.close >= snapshot.ma50) &&
    (snapshot.rsi14 === null || snapshot.rsi14 >= 45)
  ) {
    score += 15;
  }

  return clampScore(score);
}

function calculateConfirmationScore(
  snapshot: IndicatorSnapshot,
  phase?: MarketPhase,
  volume?: ScanResult["volume"],
) {
  let score = 0;

  if (snapshot.bollinger.upper !== null && snapshot.close > snapshot.bollinger.upper) {
    score += 25;
  }

  const constructiveVolumePhase = isConstructiveVolumePhase(phase);

  if (volume?.breakoutConfirmed && constructiveVolumePhase) {
    score += 20;
  } else if (volume?.expanding && constructiveVolumePhase) {
    score += 10;
  }

  if (
    volume?.expanding &&
    constructiveVolumePhase &&
    snapshot.ma50 !== null &&
    snapshot.ma200 !== null &&
    snapshot.close > snapshot.ma50 &&
    snapshot.close > snapshot.ma200
  ) {
    score += 10;
  }

  if (
    snapshot.volume.ratio20 !== null &&
    snapshot.volume.ratio20 >= 1 &&
    snapshot.volume.ratio20 < 1.5 &&
    snapshot.ma50 !== null &&
    snapshot.close > snapshot.ma50
  ) {
    score += 5;
  }

  if (
    snapshot.ma20 !== null &&
    snapshot.ma50 !== null &&
    snapshot.ma20 > snapshot.ma50
  ) {
    score += 20;
  }

  if (snapshot.ma200 !== null && snapshot.close > snapshot.ma200) {
    score += 15;
  }

  if (isBetween(snapshot.rsi14, 55, 72)) {
    score += 15;
  }

  if (snapshot.macd.histogramRising) {
    score += 5;
  }

  if (snapshot.macd.bullishCross) {
    score += 10;
  }

  if (
    snapshot.macd.aboveZero &&
    (phase === "TRENDING" || phase === "BREAKOUT_ATTEMPT")
  ) {
    score += 5;
  }

  if (
    snapshot.macd.bearishCross &&
    (phase === "TRENDING" || phase === "BREAKOUT_ATTEMPT")
  ) {
    score -= 10;
  }

  return clampScore(score);
}

function calculateRiskScore(
  snapshot: IndicatorSnapshot,
  sufficientHistory: boolean,
  phase?: MarketPhase,
  volume?: ScanResult["volume"],
) {
  let score = 0;

  if (snapshot.rsi14 !== null && snapshot.rsi14 > 75) {
    score += 25;
  }

  if (
    snapshot.priceExtensionFromMA20 !== null &&
    snapshot.priceExtensionFromMA20 > 0.08
  ) {
    score += 20;
  }

  if (snapshot.ma50 !== null && snapshot.close < snapshot.ma50) {
    score += 20;
  }

  if (snapshot.ma200 !== null && snapshot.close < snapshot.ma200) {
    score += 15;
  }

  if (
    snapshot.bollinger.upper !== null &&
    snapshot.close > snapshot.bollinger.upper &&
    (snapshot.volume.ratio20 === null || snapshot.volume.ratio20 < 1.2)
  ) {
    score += 25;
  }

  if (!sufficientHistory) {
    score += 10;
  }

  if (
    volume?.abnormalSpike &&
    ((snapshot.rsi14 !== null && snapshot.rsi14 > 75) ||
      (snapshot.priceExtensionFromMA20 !== null &&
        snapshot.priceExtensionFromMA20 > 0.08))
  ) {
    score += 20;
  }

  if (volume?.distributionWarning) {
    score += 20;
  }

  if (
    volume?.expanding &&
    phase === "BREAKDOWN" &&
    ((snapshot.ma50 !== null && snapshot.close < snapshot.ma50) ||
      (snapshot.ma200 !== null && snapshot.close < snapshot.ma200))
  ) {
    score += 20;
  }

  if (phase === "OVEREXTENDED") {
    score += 20;
  }

  if (phase === "DISTRIBUTION") {
    score += 35;
  }

  if (phase === "BREAKDOWN") {
    score += 25;
  }

  return clampScore(score);
}

function getPhaseRankPenalty(phase?: MarketPhase) {
  switch (phase) {
    case "OVEREXTENDED":
      return 15;
    case "DISTRIBUTION":
      return 20;
    case "BREAKDOWN":
      return 18;
    default:
      return 0;
  }
}

function isConstructiveVolumePhase(phase?: MarketPhase) {
  return (
    phase === undefined ||
    phase === "BREAKOUT_ATTEMPT" ||
    phase === "BREAKOUT_CONFIRMED" ||
    phase === "TRENDING" ||
    phase === "PULLBACK_HEALTHY"
  );
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
