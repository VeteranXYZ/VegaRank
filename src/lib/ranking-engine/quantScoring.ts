import type { Candle } from "@/lib/exchanges/types";
import type { IndicatorSnapshot } from "@/lib/indicators";
import type {
  MarketPhase,
  ScanResult,
  ScannerCodeContractMetrics,
  ScannerSignal,
  ScannerSignalLabel,
} from "@/lib/shared/rankingTypes";
import {
  phaseCodeByMarketPhase,
  type ActiveScannerCode,
} from "@/lib/vegarank-codebook/codeRegistry";

export const QUANT_SCORING_MODEL_VERSION = "quant-factor-v1" as const;
export const QUANT_SCORING_CALIBRATION_VERSION =
  "deterministic-baseline-1" as const;
export const SCORING_VERSION = QUANT_SCORING_MODEL_VERSION;

type QuantScoreInput = {
  snapshot: IndicatorSnapshot;
  sufficientHistory: boolean;
  phase?: MarketPhase;
  volume?: ScanResult["volume"];
  candles?: Candle[];
};

export type QuantDerivedMetrics = {
  price: number;
  rsi: number | null;
  bbPercent: number | null;
  bbWidthPercentile: number | null;
  closeAboveMA20: boolean | null;
  closeAboveMA50: boolean | null;
  closeAboveMA200: boolean | null;
  ma20AboveMA50: boolean | null;
  ma50AboveMA200: boolean | null;
  ma20: number | null;
  ma50: number | null;
  ma200: number | null;
  ma20ConvergingMA50: boolean;
  ma20NearCrossAboveMA50: boolean;
  macdState: "strong" | "improving" | "flat" | "weakening" | "weak" | null;
  volumeRatio: number | null;
  quoteVolumeLatest: number | null;
  quoteVolumeMA20: number | null;
  upperWickRatio: number | null;
  lowerWickRatio: number | null;
  closePositionInCandle: number | null;
  bodyRatio: number | null;
  isVolumeSpike: boolean | null;
  isStrongClose: boolean | null;
  isWeakClose: boolean | null;
  isLongUpperWick: boolean | null;
  isLongLowerWick: boolean | null;
  isRedCandle: boolean | null;
  isPriceExtendedAboveMA20: boolean;
  isNearMA50: boolean;
  isAboveRecentHigh: boolean;
  failedBreakout: boolean;
  historyBars: number;
  missingIndicatorCount: number;
  missingIndicators: string[];
  dataCompletenessScore: number;
  liquidityReliabilityScore: number;
  factorAgreementScore: number;
  volatilityPercentile: number | null;
  atrExtension: number | null;
  distanceFromBase: number | null;
};

export type QuantCodeAttribution = {
  groupCode: ActiveScannerCode;
  actionCode: ActiveScannerCode;
  riskCode: ActiveScannerCode | null;
  riskCodes: ActiveScannerCode[];
  setupCode: ActiveScannerCode;
  phaseCode: ActiveScannerCode;
  reasonCodes: ActiveScannerCode[];
  signalCodes: ActiveScannerCode[];
  qualityCodes: ActiveScannerCode[];
};

export type QuantScannerScoreResult = {
  opportunityScore: number;
  confirmationScore: number;
  riskScore: number;
  trendScore: number;
  momentumScore: number;
  volumeScore: number;
  structureScore: number;
  volatilityScore: number;
  mtfAgreementScore: number | null;
  riskPenalty: number;
  qualityPenalty: number;
  finalSignalScore: number;
  rankScore: number;
  riskAdjustedScore: number;
  setupQualityScore: number;
  confidenceScore: number;
  absoluteSetupScore: number;
  universePercentile: number | null;
  signalLabel: ScannerSignalLabel;
  actionBias: ScanResult["actionBias"];
  primaryStructure: ScanResult["primaryStructure"];
  secondaryStructures: string[];
  detectedRiskTypes: ScanResult["detectedRiskTypes"];
  bullishObservations: [];
  bearishObservations: [];
  riskObservations: [];
  neutralObservations: [];
  nextConfirmationObservations: [];
  invalidationObservations: [];
  rawMetrics: Record<string, never>;
  metrics: ScannerCodeContractMetrics;
  attribution: QuantCodeAttribution;
};

type ScoreCore = {
  trendScore: number;
  momentumScore: number;
  structureScore: number;
  volatilityScore: number;
  volumeScore: number;
  mtfAgreementScore: number | null;
  riskPenalty: number;
  qualityPenalty: number;
  absoluteSetupScore: number;
  setupQualityScore: number;
  riskAdjustedScore: number;
  confidenceScore: number;
  universePercentile: number | null;
  rankScore: number;
};

type QuantContextUpdate = {
  mtfAgreementScore?: number | null;
  universePercentile?: number | null;
};

export function calculateScannerScores(
  input: QuantScoreInput,
): QuantScannerScoreResult {
  const derived = buildQuantDerivedMetrics(input);
  const trendScore = calculateTrendScore(derived);
  const momentumScore = calculateMomentumScore(derived);
  const structureScore = calculateStructureScore(derived, trendScore, momentumScore);
  const volatilityScore = calculateVolatilityScore(derived, trendScore, structureScore);
  const volumeScore = calculateVolumeScore(derived, input.phase);
  const factorAgreementScore = calculateFactorAgreementScore([
    trendScore,
    momentumScore,
    structureScore,
    volatilityScore,
    volumeScore,
  ]);
  const scoringDerived = {
    ...derived,
    factorAgreementScore,
  };
  const mtfAgreementScore = 50;
  const riskPenalty = calculateRiskPenalty(derived, {
    trendScore,
    momentumScore,
    structureScore,
    volatilityScore,
    volumeScore,
    phase: input.phase,
  });
  const qualityPenalty = calculateQualityPenalty(derived);
  const core = buildScoreCore({
    trendScore,
    momentumScore,
    structureScore,
    volatilityScore,
    volumeScore,
    mtfAgreementScore,
    riskPenalty,
    qualityPenalty,
    derived: scoringDerived,
    universePercentile: null,
  });
  const attribution = buildQuantCodeAttribution(core, scoringDerived, input.phase);
  const metrics = buildQuantScoringMetrics(core, scoringDerived);

  return buildQuantScoreResult({
    core,
    attribution,
    derived: scoringDerived,
    metrics,
  });
}

export function calculateTrendScore(input: QuantDerivedMetrics) {
  let score = 50;

  score += input.closeAboveMA20 === true ? 8 : input.closeAboveMA20 === false ? -8 : 0;
  score += input.closeAboveMA50 === true ? 12 : input.closeAboveMA50 === false ? -12 : 0;
  score +=
    input.closeAboveMA200 === true ? 14 : input.closeAboveMA200 === false ? -14 : 0;
  score += input.ma20AboveMA50 === true ? 12 : input.ma20AboveMA50 === false ? -12 : 0;
  score += input.ma50AboveMA200 === true ? 12 : input.ma50AboveMA200 === false ? -12 : 0;

  if (
    input.closeAboveMA20 === true &&
    input.ma20AboveMA50 === true &&
    input.ma50AboveMA200 === true
  ) {
    score += 12;
  }

  if (input.ma20ConvergingMA50 || input.ma20NearCrossAboveMA50) {
    score += 6;
  }

  return clampScore(score);
}

export function calculateMomentumScore(input: QuantDerivedMetrics) {
  let score = 50;

  if (isBetween(input.rsi, 50, 65)) score += 18;
  else if (isBetween(input.rsi, 65, 72)) score += 12;
  else if (isBetween(input.rsi, 72, 80)) score += 4;
  else if (input.rsi !== null && input.rsi > 80) score -= 10;
  else if (isBetween(input.rsi, 40, 50)) score -= 10;
  else if (input.rsi !== null && input.rsi < 40) score -= 24;

  switch (input.macdState) {
    case "strong":
      score += 18;
      break;
    case "improving":
      score += 14;
      break;
    case "weakening":
      score -= 14;
      break;
    case "weak":
      score -= 24;
      break;
  }

  if (input.isAboveRecentHigh) score += 8;
  if (input.failedBreakout) score -= 18;

  return clampScore(score);
}

export function calculateStructureScore(
  input: QuantDerivedMetrics,
  trendScore: number,
  momentumScore: number,
) {
  let score = 50;

  if (input.isStrongClose) score += 10;
  if (input.isWeakClose) score -= 14;
  if (input.isLongUpperWick) score -= 12;
  if (input.isNearMA50) score += 8;
  if (input.isAboveRecentHigh) score += 12;
  if (input.ma20ConvergingMA50) score += 8;
  if (input.ma20NearCrossAboveMA50) score += 10;
  if (input.closeAboveMA20 === true && input.closeAboveMA50 !== false) score += 6;
  if (input.closeAboveMA50 === false && input.closeAboveMA200 === false) score -= 22;
  if (input.isPriceExtendedAboveMA20) score -= 12;
  if (input.failedBreakout) score -= 30;
  if (trendScore >= 70 && momentumScore >= 60) score += 8;
  if (trendScore < 35 && momentumScore < 45) score -= 12;

  return clampScore(score);
}

export function calculateVolatilityScore(
  input: QuantDerivedMetrics,
  trendScore: number,
  structureScore: number,
) {
  let score = 55;
  const width = input.volatilityPercentile;
  const constructiveContext = trendScore >= 55 && structureScore >= 55;

  if (width === null) {
    return score;
  }

  if (width <= 15) score += constructiveContext ? 22 : 8;
  else if (width <= 30) score += constructiveContext ? 14 : 6;
  else if (width <= 70) score += 4;
  else if (width <= 90) score += input.isStrongClose ? 2 : -8;
  else score += input.isStrongClose && !input.isLongUpperWick ? -2 : -18;

  if (input.isWeakClose && width >= 75) score -= 14;
  if (input.isLongUpperWick && width >= 75) score -= 10;
  if (input.failedBreakout) score -= 16;

  return clampScore(score);
}

export function calculateVolumeScore(
  input: QuantDerivedMetrics,
  phase?: MarketPhase,
) {
  let score = 55;

  if (input.volumeRatio === null) {
    return 45;
  }

  if (input.volumeRatio < 0.4) score = 25;
  else if (input.volumeRatio < 0.75) score = 38;
  else if (input.volumeRatio <= 1.2) score = 56;
  else if (input.volumeRatio <= 2) score = 70;
  else if (input.volumeRatio <= 3) score = 62;
  else score = 45;

  if (
    input.volumeRatio >= 1.5 &&
    input.isStrongClose &&
    (phase === "BREAKOUT_ATTEMPT" || phase === "BREAKOUT_CONFIRMED")
  ) {
    score += 10;
  }

  if (input.volumeRatio >= 3 && (input.isWeakClose || input.isLongUpperWick)) {
    score -= 18;
  }

  if (input.quoteVolumeLatest !== null && input.quoteVolumeLatest <= 0) {
    score -= 20;
  }

  return clampScore(score);
}

export function calculateRiskPenalty(
  input: QuantDerivedMetrics,
  context: {
    trendScore: number;
    momentumScore: number;
    structureScore: number;
    volatilityScore: number;
    volumeScore: number;
    phase?: MarketPhase;
  },
) {
  let penalty = 0;

  if (input.rsi !== null && input.rsi > 70) penalty += 10;
  if (input.rsi !== null && input.rsi > 80) penalty += 22;
  if (input.bbPercent !== null && input.bbPercent > 90) penalty += 10;
  if (input.bbPercent !== null && input.bbPercent > 98) penalty += 18;
  if (input.volatilityPercentile !== null && input.volatilityPercentile > 85) {
    penalty += input.isStrongClose ? 8 : 16;
  }
  if (input.isPriceExtendedAboveMA20) penalty += 22;
  if (input.distanceFromBase !== null && input.distanceFromBase > 0.15) penalty += 12;
  if (input.isVolumeSpike) penalty += 10;
  if (input.isLongUpperWick) penalty += 18;
  if (input.isWeakClose) penalty += 18;
  if (input.isVolumeSpike && (input.isWeakClose || input.isLongUpperWick)) {
    penalty += 18;
  }
  if (input.closeAboveMA50 === false) penalty += 10;
  if (input.closeAboveMA200 === false) penalty += 12;
  if (input.macdState === "weakening") penalty += 10;
  if (input.macdState === "weak") penalty += 18;
  if (input.failedBreakout) penalty += 32;
  if (input.volumeRatio !== null && input.volumeRatio < 0.45) penalty += 12;
  if (input.volumeRatio !== null && input.volumeRatio >= 5) penalty += 18;
  if (context.phase === "BREAKDOWN" && input.volumeRatio !== null && input.volumeRatio >= 1.5) {
    penalty += 12;
  }

  switch (context.phase) {
    case "OVEREXTENDED":
      penalty += 18;
      break;
    case "DISTRIBUTION":
      penalty += 30;
      break;
    case "BREAKDOWN":
      penalty += 28;
      break;
  }

  if (context.momentumScore >= 78 && context.structureScore < 55) {
    penalty += 12;
  }

  return clampScore(penalty);
}

export function calculateQualityPenalty(input: QuantDerivedMetrics) {
  let penalty = 0;

  if (input.historyBars < 50) penalty += 100;
  else if (input.historyBars < 100) penalty += 82;
  else if (input.historyBars < 200) penalty += 62;
  else if (input.historyBars < 260) penalty += 18;

  penalty += Math.min(28, input.missingIndicatorCount * 5);

  if (input.volumeRatio === null) penalty += 6;
  if (input.price <= 0) penalty += 40;

  return clampScore(penalty);
}

export function calculateRiskAdjustedScore({
  setupQualityScore,
  riskPenalty,
  qualityPenalty,
}: {
  setupQualityScore: number;
  riskPenalty: number;
  qualityPenalty: number;
}) {
  return clampScore(
    setupQualityScore - 0.45 * riskPenalty - 0.35 * qualityPenalty,
  );
}

export function calculateConfidenceScore({
  dataCompletenessScore,
  mtfAgreementScore,
  liquidityReliabilityScore,
  factorAgreementScore,
  qualityPenalty,
}: {
  dataCompletenessScore: number;
  mtfAgreementScore: number | null;
  liquidityReliabilityScore: number;
  factorAgreementScore: number;
  qualityPenalty: number;
}) {
  const effectiveMtfScore = mtfAgreementScore ?? 50;

  return clampScore(
    0.35 * dataCompletenessScore +
      0.25 * effectiveMtfScore +
      0.2 * liquidityReliabilityScore +
      0.2 * factorAgreementScore -
      0.35 * qualityPenalty,
  );
}

export function calculateUniversePercentiles<T extends ScanResult>(results: T[]) {
  const ranked = results
    .map((result, index) => ({
      index,
      score: result.codeContract?.metrics.riskAdjustedScore ?? null,
    }))
    .filter((item): item is { index: number; score: number } =>
      Number.isFinite(item.score),
    )
    .sort((left, right) => left.score - right.score);

  if (ranked.length === 0) {
    return results;
  }

  const percentiles = new Map<number, number>();
  const denominator = Math.max(ranked.length - 1, 1);

  for (let index = 0; index < ranked.length; index += 1) {
    const percentile = ranked.length === 1 ? 100 : (index / denominator) * 100;
    percentiles.set(ranked[index].index, percentile);
  }

  for (const [index, percentile] of percentiles) {
    applyQuantContextScores(results[index], { universePercentile: percentile });
  }

  return results;
}

export function applyQuantContextScores(
  result: ScanResult,
  update: QuantContextUpdate,
) {
  if (!result.codeContract) {
    return result;
  }

  const current = result.codeContract.metrics;
  const core: ScoreCore = {
    trendScore: current.trendScore ?? 50,
    momentumScore: current.momentumScore ?? 50,
    structureScore: current.structureScore ?? 50,
    volatilityScore: current.volatilityScore ?? 50,
    volumeScore: current.volumeScore ?? 50,
    mtfAgreementScore:
      update.mtfAgreementScore !== undefined
        ? update.mtfAgreementScore
        : current.mtfAgreementScore,
    riskPenalty: current.riskPenalty ?? 0,
    qualityPenalty: current.qualityPenalty ?? 0,
    absoluteSetupScore: current.absoluteSetupScore ?? current.setupQualityScore ?? 50,
    setupQualityScore: current.setupQualityScore ?? 50,
    riskAdjustedScore: current.riskAdjustedScore ?? 50,
    confidenceScore: current.confidenceScore ?? 50,
    universePercentile:
      update.universePercentile !== undefined
        ? update.universePercentile
        : current.universePercentile,
    rankScore: current.rankScore ?? 50,
  };
  const recalculated = buildScoreCore({
    trendScore: core.trendScore,
    momentumScore: core.momentumScore,
    structureScore: core.structureScore,
    volatilityScore: core.volatilityScore,
    volumeScore: core.volumeScore,
    mtfAgreementScore: core.mtfAgreementScore,
    riskPenalty: core.riskPenalty,
    qualityPenalty: core.qualityPenalty,
    derived: {
      dataCompletenessScore: current.qualityScore ?? 50,
      liquidityReliabilityScore: current.volumeScore ?? 50,
      factorAgreementScore: current.confirmationScore ?? current.confidenceScore ?? 50,
    },
    universePercentile: core.universePercentile,
  });
  const metrics = {
    ...current,
    mtfAgreementScore: recalculated.mtfAgreementScore,
    absoluteSetupScore: recalculated.absoluteSetupScore,
    setupQualityScore: recalculated.setupQualityScore,
    riskAdjustedScore: recalculated.riskAdjustedScore,
    confidenceScore: recalculated.confidenceScore,
    universePercentile: recalculated.universePercentile,
    rankScore: recalculated.rankScore,
    score: recalculated.rankScore,
    finalSignalScore: recalculated.riskAdjustedScore,
    opportunityScore: recalculated.setupQualityScore,
    confirmationScore: recalculated.confidenceScore,
    riskScore: recalculated.riskPenalty,
  };
  const groupCode = classifyGroupFromScores(metrics, result.codeContract.riskCodes);
  const actionCode = classifyActionFromScores(metrics, result.codeContract.riskCodes);

  result.codeContract = {
    ...result.codeContract,
    groupCode,
    actionCode,
    metrics,
  };
  result.rankScore = recalculated.rankScore;
  result.finalSignalScore = recalculated.riskAdjustedScore;
  result.opportunityScore = recalculated.setupQualityScore;
  result.confirmationScore = recalculated.confidenceScore;
  result.riskScore = recalculated.riskPenalty;
  result.mtfAgreementScore = recalculated.mtfAgreementScore;
  result.riskAdjustedScore = recalculated.riskAdjustedScore;
  result.setupQualityScore = recalculated.setupQualityScore;
  result.confidenceScore = recalculated.confidenceScore;
  result.absoluteSetupScore = recalculated.absoluteSetupScore;
  result.universePercentile = recalculated.universePercentile;
  result.signal = buildResearchSignal(groupCode, actionCode);

  return result;
}

export function calculateMtfAgreementScore(results: ScanResult[]) {
  if (results.length === 0) {
    return null;
  }

  let score = 50;
  const byTimeframe = new Map(results.map((result) => [result.timeframe, result]));
  const constructiveCodes = new Set(["GR_201", "GR_501", "GR_601"]);
  const riskCodes = new Set(["GR_301", "GR_302", "GR_401", "GR_402"]);
  const constructiveCount = results.filter((result) =>
    constructiveCodes.has(result.codeContract?.groupCode ?? ""),
  ).length;
  const riskCount = results.filter((result) =>
    riskCodes.has(result.codeContract?.groupCode ?? ""),
  ).length;
  const fourHour = byTimeframe.get("4h");
  const daily = byTimeframe.get("1d");
  const weekly = byTimeframe.get("1w");

  score += constructiveCount * 10;
  score -= riskCount * 14;

  if (
    fourHour &&
    daily &&
    constructiveCodes.has(fourHour.codeContract?.groupCode ?? "") &&
    constructiveCodes.has(daily.codeContract?.groupCode ?? "")
  ) {
    score += 16;
  }

  if (weekly && riskCodes.has(weekly.codeContract?.groupCode ?? "")) {
    score -= 14;
  }

  return clampScore(score);
}

export function buildQuantCodeAttribution(
  scores: ScoreCore,
  input: QuantDerivedMetrics,
  phase?: MarketPhase,
): QuantCodeAttribution {
  const reasonCodes: ActiveScannerCode[] = [];
  const signalCodes: ActiveScannerCode[] = [];
  const riskCodes: ActiveScannerCode[] = [];
  const qualityCodes: ActiveScannerCode[] = [];

  if (input.closeAboveMA20 === true) reasonCodes.push("TR_501");
  if (input.closeAboveMA50 === true) reasonCodes.push("TR_502");
  if (input.closeAboveMA200 === true) reasonCodes.push("TR_503");
  if (input.ma20AboveMA50 === true) reasonCodes.push("TR_605");
  if (input.ma50AboveMA200 === true) reasonCodes.push("TR_602");
  if (input.closeAboveMA50 === false) reasonCodes.push("TR_301");
  if (input.closeAboveMA200 === false) reasonCodes.push("TR_302");

  if (scores.trendScore >= 78) signalCodes.push("TR_601");
  else if (scores.trendScore >= 60) signalCodes.push("TR_101");

  if (scores.momentumScore >= 78) signalCodes.push("MO_201");
  else if (scores.momentumScore >= 62) signalCodes.push("MO_202");
  else if (scores.momentumScore < 42) signalCodes.push("MO_101");

  if (input.macdState === "improving") reasonCodes.push("MO_502");
  if (input.macdState === "strong") reasonCodes.push("MO_601");
  if (input.macdState === "weakening") reasonCodes.push("MO_302");
  if (input.rsi !== null && input.rsi < 45) reasonCodes.push("MO_301");

  const momentumOverheated =
    (input.rsi !== null && input.rsi >= 75) ||
    input.isPriceExtendedAboveMA20 ||
    (scores.momentumScore >= 78 && scores.riskPenalty >= 45);
  if (momentumOverheated) {
    signalCodes.push("MO_340");
    riskCodes.push("RK_303");
  }

  const compression =
    input.volatilityPercentile !== null && input.volatilityPercentile <= 25;
  if (compression) {
    reasonCodes.push("VO_202");
    if (scores.trendScore >= 55 && scores.structureScore >= 55) {
      signalCodes.push("VO_501");
    }
  } else if (
    input.volatilityPercentile !== null &&
    input.volatilityPercentile >= 85
  ) {
    riskCodes.push(input.isStrongClose ? "VO_301" : "VO_302");
  } else {
    reasonCodes.push("VO_102");
  }

  if (input.volumeRatio !== null && input.volumeRatio < 0.75) {
    qualityCodes.push("VL_104");
  }
  if (input.volumeRatio !== null && input.volumeRatio < 0.45) {
    riskCodes.push("VL_301");
  }
  if (input.volumeRatio !== null && input.volumeRatio >= 1.5) {
    reasonCodes.push("VL_501");
  }
  if (input.volumeRatio !== null && input.volumeRatio >= 1.5 && input.isStrongClose) {
    reasonCodes.push("VL_601");
  }

  if (input.failedBreakout) {
    riskCodes.push("RK_304");
    signalCodes.push("PX_305");
  } else if (input.isAboveRecentHigh && scores.structureScore >= 60) {
    signalCodes.push("PX_501");
  } else if (scores.structureScore >= 65 && compression) {
    signalCodes.push("PX_604");
  } else if (scores.structureScore >= 60) {
    signalCodes.push("PX_503");
  } else if (scores.structureScore < 38) {
    signalCodes.push("PX_101");
  }

  if (scores.riskPenalty >= 40) riskCodes.push("RK_301");
  if (scores.riskPenalty >= 65) riskCodes.push("RK_302");
  if (scores.riskPenalty >= 90) riskCodes.push("RK_401");

  if (input.historyBars < 50) qualityCodes.push("QH_401");
  else if (input.historyBars < 200) qualityCodes.push("QH_201");
  else if (input.missingIndicatorCount >= 4) qualityCodes.push("QH_402");
  else if (input.missingIndicatorCount > 0) qualityCodes.push("QH_101");
  else qualityCodes.push("QH_001");

  if (scores.qualityPenalty >= 80 && !qualityCodes.includes("QH_401")) {
    qualityCodes.push("QH_402");
  }

  const setupCode = chooseSetupCode(scores, input, phase);
  const uniqueRiskCodes = uniqueCodes(riskCodes);
  const uniqueSignalCodes = uniqueCodes(signalCodes.length > 0 ? signalCodes : ["MO_001"]);
  const uniqueReasonCodes = uniqueCodes(reasonCodes);
  const uniqueQualityCodes = uniqueCodes(qualityCodes);
  const groupCode = classifyGroupFromScores(
    buildQuantScoringMetrics(scores, input),
    uniqueRiskCodes,
  );
  const actionCode = classifyActionFromScores(
    buildQuantScoringMetrics(scores, input),
    uniqueRiskCodes,
  );

  return {
    groupCode,
    actionCode,
    riskCode: uniqueRiskCodes[0] ?? null,
    riskCodes: uniqueRiskCodes,
    setupCode,
    phaseCode: phase ? phaseCodeByMarketPhase[phase] : "NX_801",
    reasonCodes: uniqueReasonCodes,
    signalCodes: uniqueSignalCodes,
    qualityCodes: uniqueQualityCodes,
  };
}

export function classifyGroupFromScores(
  metrics: ScannerCodeContractMetrics,
  riskCodes: readonly string[] = [],
): ActiveScannerCode {
  const rankScore = metrics.rankScore ?? 0;
  const setupQualityScore = metrics.setupQualityScore ?? 0;
  const confidenceScore = metrics.confidenceScore ?? 0;
  const momentumScore = metrics.momentumScore ?? 0;
  const riskPenalty = metrics.riskPenalty ?? 0;
  const qualityPenalty = metrics.qualityPenalty ?? 0;
  const historyBars = metrics.historyBars ?? 0;

  if (historyBars < 50 || qualityPenalty >= 95) {
    return "GR_401";
  }

  if (qualityPenalty >= 80 || metrics.volumeScore !== null && metrics.volumeScore < 25) {
    return "GR_402";
  }

  if (riskPenalty >= 58 && (momentumScore >= 70 || riskCodes.includes("RK_303"))) {
    return "GR_302";
  }

  if (riskPenalty >= 65 || riskCodes.includes("RK_302") || riskCodes.includes("RK_401")) {
    return "GR_301";
  }

  if (rankScore >= 80 && riskPenalty <= 45 && confidenceScore >= 72) {
    return "GR_601";
  }

  if (rankScore >= 65 && riskPenalty <= 55 && confidenceScore >= 60) {
    return "GR_501";
  }

  if (setupQualityScore >= 55) {
    return "GR_201";
  }

  return "GR_101";
}

export function classifyActionFromScores(
  metrics: ScannerCodeContractMetrics,
  riskCodes: readonly string[] = [],
): ActiveScannerCode {
  const groupCode = classifyGroupFromScores(metrics, riskCodes);
  const rankScore = metrics.rankScore ?? 0;
  const setupQualityScore = metrics.setupQualityScore ?? 0;
  const confidenceScore = metrics.confidenceScore ?? 0;
  const riskPenalty = metrics.riskPenalty ?? 0;

  if (groupCode === "GR_401" || groupCode === "GR_402") {
    return "AC_401";
  }

  if (riskCodes.includes("RK_303")) {
    return "AC_301";
  }

  if (riskPenalty >= 65 || groupCode === "GR_301") {
    return "AC_302";
  }

  if (rankScore >= 80 && confidenceScore >= 72) {
    return "AC_601";
  }

  if (rankScore >= 65) {
    return "AC_501";
  }

  if (setupQualityScore >= 55 && confidenceScore < 55) {
    return "AC_102";
  }

  if (setupQualityScore >= 45) {
    return "AC_103";
  }

  return "AC_101";
}

export function buildQuantScoringMetrics(
  scores: ScoreCore,
  input: Pick<
    QuantDerivedMetrics,
    | "historyBars"
    | "volumeRatio"
    | "volatilityPercentile"
    | "atrExtension"
    | "distanceFromBase"
    | "price"
    | "rsi"
    | "bbPercent"
    | "bbWidthPercentile"
    | "dataCompletenessScore"
  >,
): ScannerCodeContractMetrics {
  return {
    rankScore: roundScore(scores.rankScore),
    riskAdjustedScore: roundScore(scores.riskAdjustedScore),
    setupQualityScore: roundScore(scores.setupQualityScore),
    confidenceScore: roundScore(scores.confidenceScore),
    absoluteSetupScore: roundScore(scores.absoluteSetupScore),
    universePercentile: nullableRoundScore(scores.universePercentile),
    trendScore: roundScore(scores.trendScore),
    momentumScore: roundScore(scores.momentumScore),
    structureScore: roundScore(scores.structureScore),
    volatilityScore: roundScore(scores.volatilityScore),
    volumeScore: roundScore(scores.volumeScore),
    mtfAgreementScore: nullableRoundScore(scores.mtfAgreementScore),
    riskPenalty: roundScore(scores.riskPenalty),
    qualityPenalty: roundScore(scores.qualityPenalty),
    historyBars: input.historyBars,
    volumeRank: nullableRoundScore(input.volumeRatio),
    volatilityPercentile: nullableRoundScore(input.volatilityPercentile),
    atrExtension: null,
    distanceFromBase: nullableRoundScore(input.distanceFromBase),
    scoringModelVersion: QUANT_SCORING_MODEL_VERSION,
    scoringCalibrationVersion: QUANT_SCORING_CALIBRATION_VERSION,
    score: roundScore(scores.rankScore),
    finalSignalScore: roundScore(scores.riskAdjustedScore),
    opportunityScore: roundScore(scores.setupQualityScore),
    confirmationScore: roundScore(scores.confidenceScore),
    riskScore: roundScore(scores.riskPenalty),
    qualityScore: roundScore(input.dataCompletenessScore),
    price: nullableRoundScore(input.price),
    rsi14: nullableRoundScore(input.rsi),
    bbPercent: nullableRoundScore(input.bbPercent),
    bbWidthPercentile: nullableRoundScore(input.bbWidthPercentile),
    volumeRatio: nullableRoundScore(input.volumeRatio),
  };
}

export function buildResearchSignal(
  groupCode: ActiveScannerCode,
  actionCode: ActiveScannerCode,
): ScannerSignal {
  if (groupCode === "GR_601") {
    return {
      state: "TREND_CONTINUATION",
      label: groupCode,
      summary: `${groupCode} / ${actionCode}`,
    };
  }

  if (groupCode === "GR_501" || groupCode === "GR_201") {
    return {
      state: groupCode === "GR_501" ? "CONFIRMED" : "WATCHLIST",
      label: groupCode,
      summary: `${groupCode} / ${actionCode}`,
    };
  }

  if (groupCode === "GR_301" || groupCode === "GR_302") {
    return {
      state: "HIGH_RISK",
      label: groupCode,
      summary: `${groupCode} / ${actionCode}`,
    };
  }

  if (groupCode === "GR_401" || groupCode === "GR_402") {
    return {
      state: "WEAK",
      label: groupCode,
      summary: `${groupCode} / ${actionCode}`,
    };
  }

  return {
    state: "NEUTRAL",
    label: groupCode,
    summary: `${groupCode} / ${actionCode}`,
  };
}

export function clampScore(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, value));
}

function buildScoreCore({
  trendScore,
  momentumScore,
  structureScore,
  volatilityScore,
  volumeScore,
  mtfAgreementScore,
  riskPenalty,
  qualityPenalty,
  derived,
  universePercentile,
}: {
  trendScore: number;
  momentumScore: number;
  structureScore: number;
  volatilityScore: number;
  volumeScore: number;
  mtfAgreementScore: number | null;
  riskPenalty: number;
  qualityPenalty: number;
  derived: Partial<QuantDerivedMetrics> & {
    dataCompletenessScore: number;
    liquidityReliabilityScore: number;
    factorAgreementScore: number;
  };
  universePercentile: number | null;
}): ScoreCore {
  const effectiveMtfScore = mtfAgreementScore ?? 50;
  const rawOpportunityScore =
    0.2 * trendScore +
    0.18 * momentumScore +
    0.18 * structureScore +
    0.14 * volatilityScore +
    0.12 * volumeScore +
    0.18 * effectiveMtfScore;
  const absoluteSetupScore = clampScore(rawOpportunityScore);
  const setupQualityScore = absoluteSetupScore;
  const riskAdjustedScore = calculateRiskAdjustedScore({
    setupQualityScore,
    riskPenalty,
    qualityPenalty,
  });
  const confidenceScore = calculateConfidenceScore({
    dataCompletenessScore: derived.dataCompletenessScore,
    mtfAgreementScore,
    liquidityReliabilityScore: derived.liquidityReliabilityScore,
    factorAgreementScore: derived.factorAgreementScore,
    qualityPenalty,
  });
  const effectiveUniversePercentile = universePercentile ?? 50;
  const rankScore = clampScore(
    0.6 * riskAdjustedScore +
      0.25 * effectiveUniversePercentile +
      0.15 * confidenceScore,
  );

  return {
    trendScore,
    momentumScore,
    structureScore,
    volatilityScore,
    volumeScore,
    mtfAgreementScore,
    riskPenalty,
    qualityPenalty,
    absoluteSetupScore,
    setupQualityScore,
    riskAdjustedScore,
    confidenceScore,
    universePercentile,
    rankScore,
  };
}

function buildQuantScoreResult({
  core,
  attribution,
  derived,
  metrics,
}: {
  core: ScoreCore;
  attribution: QuantCodeAttribution;
  derived: QuantDerivedMetrics;
  metrics: ScannerCodeContractMetrics;
}): QuantScannerScoreResult {
  return {
    opportunityScore: core.setupQualityScore,
    confirmationScore: core.confidenceScore,
    riskScore: core.riskPenalty,
    trendScore: core.trendScore,
    momentumScore: core.momentumScore,
    volumeScore: core.volumeScore,
    structureScore: core.structureScore,
    volatilityScore: core.volatilityScore,
    mtfAgreementScore: core.mtfAgreementScore,
    riskPenalty: core.riskPenalty,
    qualityPenalty: core.qualityPenalty,
    finalSignalScore: core.riskAdjustedScore,
    rankScore: core.rankScore,
    riskAdjustedScore: core.riskAdjustedScore,
    setupQualityScore: core.setupQualityScore,
    confidenceScore: core.confidenceScore,
    absoluteSetupScore: core.absoluteSetupScore,
    universePercentile: core.universePercentile,
    signalLabel: toInternalSignalLabel(attribution.groupCode),
    actionBias: toInternalActionBias(attribution.actionCode),
    primaryStructure: toInternalPrimaryStructure(attribution.setupCode),
    secondaryStructures: buildSecondaryStructures(attribution, derived),
    detectedRiskTypes: [],
    bullishObservations: [],
    bearishObservations: [],
    riskObservations: [],
    neutralObservations: [],
    nextConfirmationObservations: [],
    invalidationObservations: [],
    rawMetrics: {},
    metrics,
    attribution,
  };
}

function buildQuantDerivedMetrics({
  snapshot,
  candles,
  volume,
  sufficientHistory,
}: QuantScoreInput): QuantDerivedMetrics {
  const latestCandle = candles?.at(-1);
  const previousCandle = candles?.at(-2);
  const recentCandles = candles?.slice(-21, -1) ?? [];
  const recentHigh =
    recentCandles.length > 0
      ? Math.max(...recentCandles.map((candle) => candle.high))
      : null;
  const previousHigh = previousCandle?.high ?? recentHigh;
  const bbPercent = getBollingerPercent(snapshot);
  const volumeRatio = volume?.ratio20 ?? snapshot.volume.ratio20;
  const candleQuality = getCandleQuality(latestCandle, volumeRatio);
  const closeAboveMA20 =
    snapshot.ma20 === null ? null : snapshot.close > snapshot.ma20;
  const closeAboveMA50 =
    snapshot.ma50 === null ? null : snapshot.close > snapshot.ma50;
  const closeAboveMA200 =
    snapshot.ma200 === null ? null : snapshot.close > snapshot.ma200;
  const ma20AboveMA50 =
    snapshot.ma20 === null || snapshot.ma50 === null
      ? null
      : snapshot.ma20 > snapshot.ma50;
  const ma50AboveMA200 =
    snapshot.ma50 === null || snapshot.ma200 === null
      ? null
      : snapshot.ma50 > snapshot.ma200;
  const ma20ConvergingMA50 = isNear(snapshot.ma20, snapshot.ma50, 0.03);
  const ma20NearCrossAboveMA50 =
    snapshot.ma20 !== null &&
    snapshot.ma50 !== null &&
    snapshot.ma20 <= snapshot.ma50 &&
    (snapshot.ma50 - snapshot.ma20) / snapshot.ma50 <= 0.025;
  const isAboveRecentHigh = recentHigh !== null && snapshot.close > recentHigh;
  const failedBreakout =
    previousHigh !== null &&
    latestCandle !== undefined &&
    latestCandle.high > previousHigh &&
    latestCandle.close < previousHigh &&
    (candleQuality.isLongUpperWick === true ||
      candleQuality.isWeakClose === true);
  const historyBars = Math.max(candles?.length ?? 0, sufficientHistory ? 300 : 0);
  const missingIndicators = getMissingIndicators(snapshot);
  const missingIndicatorCount = missingIndicators.length;
  const dataCompletenessScore = clampScore(
    Math.min(100, historyBars / 2.6) - Math.min(35, missingIndicatorCount * 5),
  );
  const liquidityReliabilityScore =
    volumeRatio === null
      ? 45
      : clampScore(volumeRatio < 0.4 ? 25 : volumeRatio < 0.75 ? 45 : 70);
  const distanceFromBase = snapshot.priceExtensionFromMA20;

  return {
    price: snapshot.close,
    rsi: snapshot.rsi14,
    bbPercent,
    bbWidthPercentile: snapshot.bollinger.widthPercentile,
    closeAboveMA20,
    closeAboveMA50,
    closeAboveMA200,
    ma20AboveMA50,
    ma50AboveMA200,
    ma20: snapshot.ma20,
    ma50: snapshot.ma50,
    ma200: snapshot.ma200,
    ma20ConvergingMA50,
    ma20NearCrossAboveMA50,
    macdState: getMacdState(snapshot),
    volumeRatio,
    quoteVolumeLatest:
      typeof volume?.quoteVolumeLatest === "number"
        ? volume.quoteVolumeLatest
        : typeof snapshot.volume.quoteVolumeLatest === "number"
          ? snapshot.volume.quoteVolumeLatest
          : null,
    quoteVolumeMA20:
      typeof volume?.quoteVolumeMA20 === "number"
        ? volume.quoteVolumeMA20
        : typeof snapshot.volume.quoteVolumeMA20 === "number"
          ? snapshot.volume.quoteVolumeMA20
          : null,
    ...candleQuality,
    isPriceExtendedAboveMA20:
      snapshot.priceExtensionFromMA20 !== null &&
      snapshot.priceExtensionFromMA20 > 0.08,
    isNearMA50: isNear(snapshot.close, snapshot.ma50, 0.025),
    isAboveRecentHigh,
    failedBreakout,
    historyBars,
    missingIndicatorCount,
    missingIndicators,
    dataCompletenessScore,
    liquidityReliabilityScore,
    factorAgreementScore: 50,
    volatilityPercentile: snapshot.bollinger.widthPercentile,
    atrExtension: null,
    distanceFromBase,
  };
}

function calculateFactorAgreementScore(scores: number[]) {
  const constructiveCount = scores.filter((score) => score >= 58).length;
  const weakCount = scores.filter((score) => score <= 42).length;
  const averageScore =
    scores.reduce((total, score) => total + score, 0) / Math.max(scores.length, 1);

  return clampScore(averageScore + constructiveCount * 5 - weakCount * 7);
}

function getCandleQuality(
  candle: Candle | undefined,
  volumeRatio: number | null,
): Pick<
  QuantDerivedMetrics,
  | "upperWickRatio"
  | "lowerWickRatio"
  | "closePositionInCandle"
  | "bodyRatio"
  | "isVolumeSpike"
  | "isStrongClose"
  | "isWeakClose"
  | "isLongUpperWick"
  | "isLongLowerWick"
  | "isRedCandle"
> {
  if (!candle) {
    return {
      upperWickRatio: null,
      lowerWickRatio: null,
      closePositionInCandle: null,
      bodyRatio: null,
      isVolumeSpike: volumeRatio === null ? null : volumeRatio >= 3,
      isStrongClose: null,
      isWeakClose: null,
      isLongUpperWick: null,
      isLongLowerWick: null,
      isRedCandle: null,
    };
  }

  const range = candle.high - candle.low;

  if (range <= 0) {
    return {
      upperWickRatio: 0,
      lowerWickRatio: 0,
      closePositionInCandle: null,
      bodyRatio: 0,
      isVolumeSpike: volumeRatio === null ? null : volumeRatio >= 3,
      isStrongClose: null,
      isWeakClose: null,
      isLongUpperWick: false,
      isLongLowerWick: false,
      isRedCandle: candle.close < candle.open,
    };
  }

  const upperWickRatio = (candle.high - Math.max(candle.open, candle.close)) / range;
  const lowerWickRatio = (Math.min(candle.open, candle.close) - candle.low) / range;
  const closePositionInCandle = (candle.close - candle.low) / range;
  const bodyRatio = Math.abs(candle.close - candle.open) / range;

  return {
    upperWickRatio,
    lowerWickRatio,
    closePositionInCandle,
    bodyRatio,
    isVolumeSpike: volumeRatio === null ? null : volumeRatio >= 3,
    isStrongClose: closePositionInCandle >= 0.75,
    isWeakClose: closePositionInCandle <= 0.35,
    isLongUpperWick: upperWickRatio >= 0.45,
    isLongLowerWick: lowerWickRatio >= 0.45,
    isRedCandle: candle.close < candle.open,
  };
}

function chooseSetupCode(
  scores: ScoreCore,
  input: QuantDerivedMetrics,
  phase?: MarketPhase,
): ActiveScannerCode {
  if (input.failedBreakout) return "PX_305";
  if (phase === "BREAKDOWN" || scores.structureScore < 30) return "PX_303";
  if (scores.riskPenalty >= 58 && scores.momentumScore >= 70) return "ST_301";
  if (scores.trendScore >= 78) return "TR_601";
  if (input.isAboveRecentHigh && scores.structureScore >= 60) return "PX_501";
  if (input.volatilityPercentile !== null && input.volatilityPercentile <= 25) {
    return "VO_501";
  }
  if (scores.structureScore >= 62) return "PX_503";
  if (scores.trendScore >= 58) return "ST_503";

  return "ST_001";
}

function buildSecondaryStructures(
  attribution: QuantCodeAttribution,
  derived: QuantDerivedMetrics,
) {
  return uniqueCodes([
    attribution.setupCode,
    derived.closeAboveMA20 === true ? "TR_501" : null,
    derived.closeAboveMA50 === true ? "TR_502" : null,
    derived.closeAboveMA200 === true ? "TR_503" : null,
    ...attribution.riskCodes,
  ]).map((code) => code);
}

function getBollingerPercent(snapshot: IndicatorSnapshot) {
  const { upper, lower } = snapshot.bollinger;

  if (upper === null || lower === null || upper === lower) {
    return null;
  }

  return ((snapshot.close - lower) / (upper - lower)) * 100;
}

function getMacdState(snapshot: IndicatorSnapshot) {
  const { line, signal, histogram, histogramRising, aboveZero } = snapshot.macd;

  if (line === null || signal === null || histogram === null) {
    return null;
  }

  if (histogram > 0 && histogramRising && aboveZero) return "strong";
  if (histogram > 0 && histogramRising) return "improving";
  if (Math.abs(histogram) < 0.0000001) return "flat";
  if (histogram < 0 && !histogramRising) return "weak";
  if (!histogramRising) return "weakening";

  return "flat";
}

function getMissingIndicators(snapshot: IndicatorSnapshot) {
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

function toInternalSignalLabel(groupCode: ActiveScannerCode): ScannerSignalLabel {
  switch (groupCode) {
    case "GR_501":
    case "GR_601":
      return "confirmed";
    case "GR_201":
      return "watch";
    case "GR_302":
      return "overheated";
    case "GR_301":
      return "breakdown_risk";
    default:
      return "neutral";
  }
}

function toInternalActionBias(actionCode: ActiveScannerCode): ScanResult["actionBias"] {
  switch (actionCode) {
    case "AC_501":
    case "AC_601":
      return "eligible";
    case "AC_301":
      return "do_not_chase";
    case "AC_302":
    case "AC_401":
      return "avoid";
    case "AC_101":
    case "AC_102":
    case "AC_103":
    case "AC_201":
      return "watch_only";
    default:
      return "ignore";
  }
}

function toInternalPrimaryStructure(
  setupCode: ActiveScannerCode,
): ScanResult["primaryStructure"] {
  switch (setupCode) {
    case "TR_601":
      return "strong_trend";
    case "ST_501":
      return "healthy_pullback";
    case "ST_503":
      return "trend_repair";
    case "PX_201":
    case "PX_501":
      return "breakout_attempt";
    case "ST_301":
      return "overextended";
    case "PX_303":
      return "trend_breakdown";
    case "PX_101":
      return "weak_bounce";
    default:
      return "neutral";
  }
}

function roundScore(value: number) {
  return Math.round(clampScore(value) * 100) / 100;
}

function nullableRoundScore(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value * 100) / 100
    : null;
}

function uniqueCodes(
  codes: Array<ActiveScannerCode | null | undefined>,
): ActiveScannerCode[] {
  return [...new Set(codes.filter(Boolean))] as ActiveScannerCode[];
}

function isBetween(value: number | null, min: number, max: number) {
  return value !== null && value >= min && value < max;
}

function isNear(
  value: number | null,
  target: number | null,
  toleranceRatio: number,
) {
  if (value === null || target === null || target === 0) {
    return false;
  }

  return Math.abs(value - target) / Math.abs(target) <= toleranceRatio;
}
