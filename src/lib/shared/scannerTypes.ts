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
  signalLabel: ScannerSignalLabel;
  actionBias: ActionBias;
  primaryStructure: PrimaryStructure;
  secondaryStructures: string[];
  detectedRiskTypes: DetectedRiskType[];
  bullishFactors: string[];
  bearishFactors: string[];
  riskFactors: string[];
  neutralFactors: string[];
  nextConfirmationText: string[];
  invalidationText: string[];
  rawMetrics: {
    price: number;
    rsi: number | null;
    bbPercent: number | null;
    volumeRatio: number | null;
    macdState: string | null;
    closeAboveMA20: boolean | null;
    closeAboveMA50: boolean | null;
    closeAboveMA200: boolean | null;
    ma20AboveMA50: boolean | null;
    ma50AboveMA200: boolean | null;
    ma20?: number | null;
    ma50?: number | null;
    ma200?: number | null;
    upperWickRatio?: number | null;
    lowerWickRatio?: number | null;
    closePositionInCandle?: number | null;
    bodyRatio?: number | null;
    isVolumeSpike?: boolean | null;
    isStrongClose?: boolean | null;
    isWeakClose?: boolean | null;
    isLongUpperWick?: boolean | null;
    isLongLowerWick?: boolean | null;
    isRedCandle?: boolean | null;
  };
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
