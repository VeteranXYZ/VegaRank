import type { Timeframe } from "@/lib/exchanges/types";

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

export type ScannerExplanationKey =
  | "reason.bbWidthLow"
  | "reason.ma20Ma50Converging"
  | "reason.priceNearBollingerMiddle"
  | "reason.quietVolumeCompression"
  | "reason.priceAboveUpperBollinger"
  | "reason.volumeExpanding"
  | "reason.ma20AboveMa50"
  | "reason.priceAboveMa200"
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
  | "warning.extendedFromMa20"
  | "warning.belowMa50"
  | "warning.belowMa200"
  | "warning.rsiBelow45"
  | "warning.longUpperWick"
  | "warning.weakCompressionBelowTrend"
  | "warning.insufficientHistory";

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
  rankScore: number;
  rsi14: number | null;
  bbWidthPercentile: number | null;
  volumeRatio: number | null;
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
    lastClosedCandleTime?: number | null;
  };
};
