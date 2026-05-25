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
  reasons: string[];
  warnings: string[];
  nextConfirmation: string[];
  invalidation: string[];
  dataQuality: {
    candleCount: number;
    sufficientHistory: boolean;
    missingIndicators: string[];
  };
};
