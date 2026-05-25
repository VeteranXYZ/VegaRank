import type { IndicatorSnapshot } from "@/lib/indicators";
import type { MarketPhase } from "./types";

type ScoreInput = {
  snapshot: IndicatorSnapshot;
  sufficientHistory: boolean;
  phase?: MarketPhase;
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
}: ScoreInput): ScannerScores {
  const opportunityScore = calculateOpportunityScore(snapshot, sufficientHistory);
  const confirmationScore = calculateConfirmationScore(snapshot);
  const riskScore = calculateRiskScore(snapshot, sufficientHistory, phase);

  // Rank score is only a sorting aid; the UI still exposes the component scores.
  const rankScore = clampScore(
    opportunityScore * 0.45 +
      confirmationScore * 0.35 -
      riskScore * 0.25 -
      getPhaseRankPenalty(phase),
  );

  return {
    opportunityScore,
    confirmationScore,
    riskScore,
    rankScore,
  };
}

export function clampScore(value: number) {
  return Math.min(100, Math.max(0, value));
}

function calculateOpportunityScore(
  snapshot: IndicatorSnapshot,
  sufficientHistory: boolean,
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

  if (isBetween(snapshot.volume.ratio, 0.6, 1.2)) {
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

function calculateConfirmationScore(snapshot: IndicatorSnapshot) {
  let score = 0;

  if (snapshot.bollinger.upper !== null && snapshot.close > snapshot.bollinger.upper) {
    score += 25;
  }

  if (snapshot.volume.ratio !== null && snapshot.volume.ratio > 1.5) {
    score += 25;
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

  return clampScore(score);
}

function calculateRiskScore(
  snapshot: IndicatorSnapshot,
  sufficientHistory: boolean,
  phase?: MarketPhase,
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
    (snapshot.volume.ratio === null || snapshot.volume.ratio < 1.2)
  ) {
    score += 25;
  }

  if (!sufficientHistory) {
    score += 10;
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
