import type { Candle, Timeframe } from "@/lib/exchanges/types";
import { scanCandles, getClosedCandles } from "@/lib/scanner/scanCandles";
import type {
  MarketPhase,
  ScannerExplanation,
  ScannerSignalState,
  ScanResult,
} from "@/lib/shared/scannerTypes";

export type BacktestMatchMode = "broad" | "standard" | "similar";
export type SampleQuality = "none" | "low" | "medium" | "good";
export type BacktestSummaryKey =
  | "backtest.summary.noSamples"
  | "backtest.summary.smallSample"
  | "backtest.summary.positiveShortTerm"
  | "backtest.summary.highFakeoutRisk"
  | "backtest.summary.highVolatility"
  | "backtest.summary.noClearEdge";

export type BacktestWarningKey =
  | "backtest.warning.noSamples"
  | "backtest.warning.smallSample"
  | "backtest.warning.insufficientHistory"
  | "backtest.warning.falseBreakoutHigh"
  | "backtest.warning.volatileAfterSignal"
  | "backtest.warning.researchOnly";

export type BacktestNoteKey =
  | "backtest.note.researchOnly"
  | "backtest.note.noDatabase";

export type HistoricalBehaviorResult = {
  symbol: string;
  timeframe: Timeframe;
  limit: number;
  matchMode: BacktestMatchMode;
  current: {
    phase: MarketPhase;
    signalState: ScannerSignalState;
    rankScore: number;
    opportunityScore: number;
    confirmationScore: number;
    riskScore: number;
    rsi14: number | null;
    bbWidthPercentile: number | null;
    volumeRatio: number | null;
    macdState: MacdState;
  };
  sampleCount: number;
  sampleQuality: SampleQuality;
  summaryKey: BacktestSummaryKey;
  horizons: HorizonStats[];
  falseBreakoutRatePct: number | null;
  warnings: ScannerExplanation[];
  notes: ScannerExplanation[];
  recentSamples: RecentSample[];
};

export type HorizonStats = {
  candles: 1 | 3 | 5 | 10;
  label: "1K" | "3K" | "5K" | "10K";
  sampleCount: number;
  averageReturnPct: number;
  medianReturnPct: number;
  winRatePct: number;
  averageMfePct: number;
  averageMaePct: number;
  bestReturnPct: number;
  worstReturnPct: number;
};

export type RecentSample = {
  signalTime: string;
  signalClose: number;
  phase: MarketPhase;
  signalState: ScannerSignalState;
  return5K: number;
  mfe5K: number;
  mae5K: number;
};

type MacdState = "cross" | "improving" | "flat" | "fading" | "weak" | "none";

type MatchedSample = {
  index: number;
  candle: Candle;
  scan: ScanResult;
  forward: Record<1 | 3 | 5 | 10, ForwardPerformance>;
  falseBreakout: boolean | null;
};

type ForwardPerformance = {
  returnPct: number;
  mfePct: number;
  maePct: number;
  win: boolean;
};

const horizons = [1, 3, 5, 10] as const;
const warmupCandles = 250;

export function reviewHistoricalBehavior({
  symbol,
  timeframe,
  limit,
  matchMode,
  candles,
}: {
  symbol: string;
  timeframe: Timeframe;
  limit: number;
  matchMode: BacktestMatchMode;
  candles: Candle[];
}): HistoricalBehaviorResult {
  const closedCandles = getClosedCandles(candles);
  const current = scanCandles(symbol, timeframe, closedCandles);
  const samples: MatchedSample[] = [];
  const maxHorizon = 10;

  if (closedCandles.length < warmupCandles + maxHorizon + 1) {
    return buildResult({
      symbol,
      timeframe,
      limit,
      matchMode,
      current,
      samples: [],
      insufficientHistory: true,
    });
  }

  for (let index = warmupCandles - 1; index < closedCandles.length - maxHorizon; index += 1) {
    const slice = closedCandles.slice(0, index + 1);
    const scan = scanCandles(symbol, timeframe, slice);

    if (!isMatchedSetup(current, scan, matchMode)) {
      continue;
    }

    samples.push({
      index,
      candle: closedCandles[index],
      scan,
      forward: getForwardPerformance(closedCandles, index),
      falseBreakout: isBreakoutPhase(current.phase)
        ? getFalseBreakout(closedCandles, index)
        : null,
    });
  }

  return buildResult({
    symbol,
    timeframe,
    limit,
    matchMode,
    current,
    samples,
    insufficientHistory: false,
  });
}

function buildResult({
  symbol,
  timeframe,
  limit,
  matchMode,
  current,
  samples,
  insufficientHistory,
}: {
  symbol: string;
  timeframe: Timeframe;
  limit: number;
  matchMode: BacktestMatchMode;
  current: ScanResult;
  samples: MatchedSample[];
  insufficientHistory: boolean;
}): HistoricalBehaviorResult {
  const sampleCount = samples.length;
  const sampleQuality = getSampleQuality(sampleCount);
  const horizonStats = horizons.map((horizon) => getHorizonStats(samples, horizon));
  const falseBreakoutRatePct = getFalseBreakoutRate(samples);
  const summaryKey = getSummaryKey({
    sampleCount,
    horizonStats,
    falseBreakoutRatePct,
  });
  const warnings = getWarnings({
    sampleCount,
    horizonStats,
    falseBreakoutRatePct,
    insufficientHistory,
  });

  return {
    symbol,
    timeframe,
    limit,
    matchMode,
    current: {
      phase: current.phase,
      signalState: current.signal.state,
      rankScore: round(current.rankScore),
      opportunityScore: round(current.opportunityScore),
      confirmationScore: round(current.confirmationScore),
      riskScore: round(current.riskScore),
      rsi14: roundNullable(current.rsi14),
      bbWidthPercentile: roundNullable(current.bbWidthPercentile),
      volumeRatio: roundNullable(current.volume.ratio20),
      macdState: getMacdState(current),
    },
    sampleCount,
    sampleQuality,
    summaryKey,
    horizons: horizonStats,
    falseBreakoutRatePct,
    warnings,
    notes: [
      { key: "backtest.note.researchOnly" },
      { key: "backtest.note.noDatabase" },
    ],
    recentSamples: samples.slice(-5).reverse().map((sample) => ({
      signalTime: new Date(sample.candle.closeTime).toISOString(),
      signalClose: sample.candle.close,
      phase: sample.scan.phase,
      signalState: sample.scan.signal.state,
      return5K: round(sample.forward[5].returnPct),
      mfe5K: round(sample.forward[5].mfePct),
      mae5K: round(sample.forward[5].maePct),
    })),
  };
}

function isMatchedSetup(
  current: ScanResult,
  candidate: ScanResult,
  matchMode: BacktestMatchMode,
) {
  if (candidate.phase !== current.phase) {
    return false;
  }

  if (matchMode === "broad") {
    return true;
  }

  if (matchMode === "standard") {
    return candidate.signal.state === current.signal.state;
  }

  return (
    isSimilarRsi(current.rsi14, candidate.rsi14) &&
    getBbBand(current.bbWidthPercentile) === getBbBand(candidate.bbWidthPercentile) &&
    getVolumeBand(current.volume.ratio20) === getVolumeBand(candidate.volume.ratio20) &&
    getMacdDirection(current) === getMacdDirection(candidate) &&
    Math.abs(getMaScore(current) - getMaScore(candidate)) <= 2
  );
}

function getForwardPerformance(candles: Candle[], index: number) {
  return Object.fromEntries(
    horizons.map((horizon) => {
      const signalClose = candles[index].close;
      const future = candles.slice(index + 1, index + horizon + 1);
      const futureClose = future.at(-1)?.close ?? signalClose;
      const maxHigh = Math.max(...future.map((candle) => candle.high));
      const minLow = Math.min(...future.map((candle) => candle.low));
      const result: ForwardPerformance = {
        returnPct: pct(futureClose / signalClose - 1),
        mfePct: pct(maxHigh / signalClose - 1),
        maePct: pct(minLow / signalClose - 1),
        win: futureClose > signalClose,
      };

      return [horizon, result];
    }),
  ) as Record<1 | 3 | 5 | 10, ForwardPerformance>;
}

function getHorizonStats(
  samples: MatchedSample[],
  horizon: 1 | 3 | 5 | 10,
): HorizonStats {
  const values = samples.map((sample) => sample.forward[horizon]);
  const returns = values.map((value) => value.returnPct);

  return {
    candles: horizon,
    label: `${horizon}K` as HorizonStats["label"],
    sampleCount: values.length,
    averageReturnPct: round(average(returns)),
    medianReturnPct: round(median(returns)),
    winRatePct: round(
      values.length === 0
        ? 0
        : (values.filter((value) => value.win).length / values.length) * 100,
    ),
    averageMfePct: round(average(values.map((value) => value.mfePct))),
    averageMaePct: round(average(values.map((value) => value.maePct))),
    bestReturnPct: round(returns.length === 0 ? 0 : Math.max(...returns)),
    worstReturnPct: round(returns.length === 0 ? 0 : Math.min(...returns)),
  };
}

function getFalseBreakout(candles: Candle[], index: number) {
  const middle = average(candles.slice(Math.max(0, index - 19), index + 1).map((candle) => candle.close));

  if (!Number.isFinite(middle)) {
    return null;
  }

  return candles.slice(index + 1, index + 4).some((candle) => candle.close < middle);
}

function getFalseBreakoutRate(samples: MatchedSample[]) {
  const values = samples
    .map((sample) => sample.falseBreakout)
    .filter((value): value is boolean => value !== null);

  if (values.length === 0) {
    return null;
  }

  return round((values.filter(Boolean).length / values.length) * 100);
}

function getSummaryKey({
  sampleCount,
  horizonStats,
  falseBreakoutRatePct,
}: {
  sampleCount: number;
  horizonStats: HorizonStats[];
  falseBreakoutRatePct: number | null;
}): BacktestSummaryKey {
  if (sampleCount === 0) {
    return "backtest.summary.noSamples";
  }

  if (sampleCount < 5) {
    return "backtest.summary.smallSample";
  }

  if (falseBreakoutRatePct !== null && falseBreakoutRatePct > 40) {
    return "backtest.summary.highFakeoutRisk";
  }

  const five = horizonStats.find((item) => item.candles === 5);

  if (five && five.averageReturnPct > 0 && five.winRatePct >= 55) {
    return "backtest.summary.positiveShortTerm";
  }

  if (five && five.averageMfePct >= 8 && five.averageMaePct <= -6) {
    return "backtest.summary.highVolatility";
  }

  return "backtest.summary.noClearEdge";
}

function getWarnings({
  sampleCount,
  horizonStats,
  falseBreakoutRatePct,
  insufficientHistory,
}: {
  sampleCount: number;
  horizonStats: HorizonStats[];
  falseBreakoutRatePct: number | null;
  insufficientHistory: boolean;
}) {
  const warnings: ScannerExplanation[] = [{ key: "backtest.warning.researchOnly" }];

  if (insufficientHistory) {
    warnings.push({ key: "backtest.warning.insufficientHistory" });
  }

  if (sampleCount === 0) {
    warnings.push({ key: "backtest.warning.noSamples" });
  } else if (sampleCount < 10) {
    warnings.push({ key: "backtest.warning.smallSample" });
  }

  if (falseBreakoutRatePct !== null && falseBreakoutRatePct > 40) {
    warnings.push({ key: "backtest.warning.falseBreakoutHigh" });
  }

  const five = horizonStats.find((item) => item.candles === 5);

  if (five && five.averageMfePct >= 8 && five.averageMaePct <= -6) {
    warnings.push({ key: "backtest.warning.volatileAfterSignal" });
  }

  return warnings;
}

function getSampleQuality(sampleCount: number): SampleQuality {
  if (sampleCount === 0) return "none";
  if (sampleCount < 10) return "low";
  if (sampleCount < 30) return "medium";
  return "good";
}

function isBreakoutPhase(phase: MarketPhase) {
  return phase === "BREAKOUT_ATTEMPT" || phase === "BREAKOUT_CONFIRMED";
}

function isSimilarRsi(current: number | null, candidate: number | null) {
  if (current === null || candidate === null) {
    return true;
  }

  return Math.abs(current - candidate) <= 8;
}

function getBbBand(value: number | null) {
  if (value === null) return "unknown";
  if (value < 20) return "low";
  if (value <= 60) return "mid";
  return "high";
}

function getVolumeBand(value: number | null) {
  if (value === null) return "unknown";
  if (value < 0.8) return "low";
  if (value < 1.5) return "normal";
  if (value < 3) return "expanded";
  return "abnormal";
}

function getMacdDirection(result: ScanResult) {
  const state = getMacdState(result);

  if (state === "cross" || state === "improving" || state === "flat") {
    return "constructive";
  }

  if (state === "fading" || state === "weak") {
    return "weakening";
  }

  return "none";
}

function getMacdState(result: ScanResult): MacdState {
  if (!result.macd) return "none";
  if (result.macd.bearishCross) return "weak";
  if (!result.macd.histogramRising) return "fading";
  if (result.macd.bullishCross) return "cross";
  if (result.macd.aboveZero) return "flat";
  return "improving";
}

function getMaScore(result: ScanResult) {
  return [
    result.maStatus.aboveMA20,
    result.maStatus.aboveMA50,
    result.maStatus.aboveMA200,
    result.maStatus.ma20AboveMA50,
    result.maStatus.ma50AboveMA200,
  ].filter(Boolean).length;
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function pct(value: number) {
  return value * 100;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function roundNullable(value: number | null) {
  return value === null ? null : round(value);
}
