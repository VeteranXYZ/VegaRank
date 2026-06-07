import type { Timeframe } from "./timeframes";

export type MarketPhase =
  | "BASE_BUILDING"
  | "SQUEEZE"
  | "BREAKOUT_ATTEMPT"
  | "BREAKOUT_CONFIRMED"
  | "TRENDING"
  | "PULLBACK_HEALTHY"
  | "OVEREXTENDED"
  | "DISTRIBUTION"
  | "BREAKDOWN";

export type ScannerSignalState =
  | "WATCHLIST"
  | "CONFIRMED"
  | "TREND_CONTINUATION"
  | "HIGH_RISK"
  | "WEAK"
  | "NEUTRAL";

export type ScannerSignal = {
  state: ScannerSignalState;
  label: string;
  summary: string;
};

export type ScannerSignalLabel =
  | "confirmed"
  | "watch"
  | "trend"
  | "overheated"
  | "distribution_risk"
  | "weak_bounce"
  | "breakdown_risk"
  | "weak"
  | "neutral";

export type ActionBias =
  | "eligible"
  | "watch_only"
  | "do_not_chase"
  | "avoid"
  | "ignore";

export type PrimaryStructure =
  | "strong_trend"
  | "healthy_pullback"
  | "trend_repair"
  | "breakout_attempt"
  | "overextended"
  | "distribution_risk"
  | "weak_bounce"
  | "trend_breakdown"
  | "neutral";

export type DetectedRiskType =
  | "overheat_risk"
  | "distribution_risk"
  | "weak_bounce_risk"
  | "trend_breakdown_risk"
  | "liquidity_spike_risk"
  | "failed_breakout_risk";

export type ScannerTextParamValue = string | number | boolean | null;

export type ScannerObservationSeverity =
  | "positive"
  | "neutral"
  | "warning"
  | "risk";

export type ScannerObservationScope =
  | "trend"
  | "momentum"
  | "volume"
  | "structure"
  | "risk"
  | "quality"
  | "confirmation"
  | "invalidation"
  | "system";

export type ScannerObservationKey =
  | "factor.priceAboveMa20"
  | "factor.priceAboveMa50"
  | "factor.priceAboveMa200"
  | "factor.ma20AboveMa50"
  | "factor.ma50AboveMa200"
  | "factor.rsiHealthyRepair"
  | "factor.macdImproving"
  | "factor.macdStrong"
  | "factor.strongClose"
  | "factor.volumeSupportsUpside"
  | "factor.priceBelowMa20"
  | "factor.priceBelowMa50"
  | "factor.priceBelowMa200"
  | "factor.ma20BelowMa50"
  | "factor.rsiWeak"
  | "factor.macdWeakening"
  | "factor.macdWeak"
  | "risk.overheat"
  | "risk.distribution"
  | "risk.weakBounce"
  | "risk.trendBreakdown"
  | "risk.liquiditySpike"
  | "risk.failedBreakout"
  | "risk.longUpperWick"
  | "risk.weakClose"
  | "risk.volumeSpikeAboveMa20"
  | "neutral.macdFlat"
  | "neutral.volumeNearAverage"
  | "neutral.rsiInsufficient"
  | "neutral.bbPercentInsufficient"
  | "confirmation.reclaimMa50"
  | "confirmation.ma20ApproachOrCrossMa50"
  | "confirmation.rsiRecoverAbove50"
  | "confirmation.holdBreakoutLevel"
  | "confirmation.closeAbovePriorHigh"
  | "confirmation.pullbackVolumeStable"
  | "invalidation.loseMa20Repair"
  | "invalidation.bearishVolumeExpansion"
  | "invalidation.failToReclaimMa50"
  | "invalidation.macdWeakensFurther"
  | "invalidation.loseBreakoutLevel"
  | "invalidation.riskRisesConfirmationFalls";

export type ScannerObservation = {
  key: ScannerObservationKey;
  severity: ScannerObservationSeverity;
  scope: ScannerObservationScope;
  params?: Record<string, ScannerTextParamValue>;
};

export type ScannerReviewKey =
  | "review.status.manualReview"
  | "review.status.avoid"
  | "review.status.doNotChase"
  | "review.status.noClearEdge"
  | "review.status.notEnoughCandles"
  | "review.status.caution"
  | "review.status.lowPriority"
  | "review.status.needsConfirmation"
  | "review.reason.cleanCandidate"
  | "review.reason.riskGroupPriority"
  | "review.reason.overheatedPriority"
  | "review.reason.neutralGroup"
  | "review.reason.insufficientHistory"
  | "review.reason.detectedRisks"
  | "review.reason.rankBelowZero"
  | "review.reason.neutralSetup"
  | "review.reason.needsConfirmation";

export type ScannerReviewText = {
  key: ScannerReviewKey;
  params?: Record<string, ScannerTextParamValue>;
};

export type ScanEvaluationNoteKey =
  | "evaluation.insufficientFutureCandles"
  | "evaluation.riskOutcomeVerified"
  | "evaluation.opportunityOutcomeVerified";

export type ScanEvaluationNote = {
  key: ScanEvaluationNoteKey;
  params?: Record<string, ScannerTextParamValue>;
};

export type ScannerExplanationKey =
  | "reason.bbWidthLow"
  | "reason.ma20Ma50Converging"
  | "reason.priceNearBollingerMiddle"
  | "reason.quietVolumeCompression"
  | "reason.volumeDryUpCompression"
  | "reason.volumeExpansion"
  | "reason.breakoutVolumeConfirmed"
  | "reason.pullbackVolumeHealthy"
  | "reason.priceAboveUpperBollinger"
  | "reason.volumeExpanding"
  | "reason.ma20AboveMa50"
  | "reason.priceAboveMa200"
  | "reason.macdHistogramRising"
  | "reason.macdBullishCross"
  | "reason.macdAboveZero"
  | "reason.phaseClassification"
  | "reason.limitedHistory"
  | "confirmation.closeAboveUpperBollinger"
  | "confirmation.volumeAbove1_5"
  | "confirmation.breakoutVolume"
  | "confirmation.rsiBelow72"
  | "confirmation.priceAboveMa50"
  | "confirmation.pullbackHoldMa20OrMiddle"
  | "confirmation.consolidateNearMa20"
  | "confirmation.rsiCoolBelow72"
  | "confirmation.recoverMa50"
  | "confirmation.declineVolumeStabilize"
  | "confirmation.ma20TurnAboveMa50"
  | "invalidation.loseBollingerMiddleWithVolume"
  | "invalidation.closeBelowMa50"
  | "invalidation.pullbackBelowMa50"
  | "invalidation.extensionBelowMa20"
  | "invalidation.weakUntilRecoverMa50"
  | "invalidation.closeBelowMa200"
  | "warning.rsiAbove75"
  | "warning.possibleFakeBreakout"
  | "warning.breakoutWithoutVolume"
  | "warning.abnormalVolumeSpike"
  | "warning.distributionVolume"
  | "warning.highVolumeBreakdown"
  | "warning.volumeSpikeWithExtension"
  | "warning.extendedFromMa20"
  | "warning.belowMa50"
  | "warning.belowMa200"
  | "warning.rsiBelow45"
  | "warning.longUpperWick"
  | "warning.weakCompressionBelowTrend"
  | "warning.macdBearishCross"
  | "warning.macdMomentumWeakening"
  | "warning.insufficientHistory"
  | "backtest.warning.noSamples"
  | "backtest.warning.smallSample"
  | "backtest.warning.insufficientHistory"
  | "backtest.warning.falseBreakoutHigh"
  | "backtest.warning.volatileAfterSignal"
  | "backtest.warning.researchOnly"
  | "backtest.note.researchOnly"
  | "backtest.note.noDatabase";

export type ScannerExplanation = {
  key: ScannerExplanationKey;
  params?: {
    timeframe?: Timeframe;
    phase?: MarketPhase;
  };
};

export type MultiTimeframeAlignment =
  | "STRONG_ALIGNMENT"
  | "EARLY_4H_SIGNAL"
  | "DAILY_CONFIRMATION"
  | "CONFLICTING"
  | "HIGH_RISK";

export type MultiTimeframeScanSummary = {
  alignment: MultiTimeframeAlignment;
  label: string;
  summary: string;
  constructiveCount: number;
  riskCount: number;
  rankScore: number;
  timeframes: Timeframe[];
  timeframeResults: MultiTimeframeResultSummary[];
};

export type MultiTimeframeResultSummary = {
  timeframe: Timeframe;
  phase: MarketPhase;
  signal: ScannerSignal;
  rankScore: number;
  opportunityScore: number;
  confirmationScore: number;
  riskScore: number;
};

export type ScannerCodeContractMetrics = {
  rankScore: number | null;
  riskAdjustedScore: number | null;
  setupQualityScore: number | null;
  confidenceScore: number | null;
  absoluteSetupScore: number | null;
  universePercentile: number | null;
  trendScore: number | null;
  momentumScore: number | null;
  structureScore: number | null;
  volatilityScore: number | null;
  volumeScore: number | null;
  mtfAgreementScore: number | null;
  riskPenalty: number | null;
  qualityPenalty: number | null;
  historyBars: number | null;
  volumeRank: number | null;
  volatilityPercentile: number | null;
  atrExtension: number | null;
  distanceFromBase: number | null;
  scoringModelVersion: "quant-factor-v1";
  scoringCalibrationVersion: "deterministic-baseline-1";
  score: number | null;
  finalSignalScore: number | null;
  opportunityScore: number | null;
  confirmationScore: number | null;
  riskScore: number | null;
  qualityScore: number | null;
  price: number | null;
  rsi14: number | null;
  bbPercent: number | null;
  bbWidthPercentile: number | null;
  volumeRatio: number | null;
};

export type ScannerCodeContractShape = {
  exchange: "binance";
  symbol: string;
  timeframe: string;
  assetClass?: string;
  groupCode: string;
  actionCode: string;
  riskCode: string | null;
  riskCodes: string[];
  setupCode: string;
  phaseCode: string;
  reasonCodes: string[];
  signalCodes: string[];
  qualityCodes: string[];
  metrics: ScannerCodeContractMetrics;
  scannerVersion: string;
  codeSchemaVersion: string;
  dictionaryVersion: string;
};

export type ScanResult = {
  exchange: "binance";
  symbol: string;
  timeframe: Timeframe;
  price: number;
  phase: MarketPhase;
  signal: ScannerSignal;
  multiTimeframe?: MultiTimeframeScanSummary;
  opportunityScore: number;
  confirmationScore: number;
  riskScore: number;
  trendScore: number;
  momentumScore: number;
  volumeScore: number;
  structureScore: number;
  finalSignalScore: number;
  rankScore: number;
  riskAdjustedScore?: number;
  setupQualityScore?: number;
  confidenceScore?: number;
  absoluteSetupScore?: number;
  universePercentile?: number | null;
  volatilityScore?: number;
  mtfAgreementScore?: number | null;
  riskPenalty?: number;
  qualityPenalty?: number;
  codeContract?: ScannerCodeContractShape;
  signalLabel: ScannerSignalLabel;
  actionBias: ActionBias;
  primaryStructure: PrimaryStructure;
  secondaryStructures: string[];
  detectedRiskTypes: DetectedRiskType[];
  bullishObservations: ScannerObservation[];
  bearishObservations: ScannerObservation[];
  riskObservations: ScannerObservation[];
  neutralObservations: ScannerObservation[];
  nextConfirmationObservations: ScannerObservation[];
  invalidationObservations: ScannerObservation[];
  rawMetrics: Record<string, unknown>;
  rsi14: number | null;
  bbPercent: number | null;
  bbWidthPercentile: number | null;
  volumeRatio: number | null;
  volume: {
    latest: number;
    ma20: number | null;
    ma50: number | null;
    ratio20: number | null;
    ratio50: number | null;
    quoteVolumeLatest?: number;
    quoteVolumeMA20?: number | null;
    dryUp: boolean;
    expanding: boolean;
    abnormalSpike: boolean;
    breakoutConfirmed: boolean;
    pullbackHealthy: boolean;
    distributionWarning: boolean;
    quietCompression?: boolean;
  };
  macd?: {
    line: number;
    signal: number;
    histogram: number;
    histogramRising: boolean;
    bullishCross: boolean;
    bearishCross: boolean;
    aboveZero: boolean;
  };
  maStatus: {
    aboveMA20: boolean;
    aboveMA50: boolean;
    aboveMA200: boolean;
    ma20AboveMA50: boolean;
    ma50AboveMA200: boolean;
  };
  reasons: ScannerExplanation[];
  warnings: ScannerExplanation[];
  nextConfirmation: ScannerExplanation[];
  invalidation: ScannerExplanation[];
  dataQuality: {
    candleCount: number;
    sufficientHistory: boolean;
    missingIndicators: string[];
    usesClosedCandles?: boolean;
    lastClosedCandleOpenTime?: number | null;
    lastClosedCandleCloseTime?: number | null;
    lastClosedCandleTime?: number | null;
  };
};
