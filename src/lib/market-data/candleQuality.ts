import type { Candle, Timeframe } from "@/lib/shared/timeframes";
import { getCandleTimeframeDurationMs } from "./candleBackfillPlanner";

export type CandleGapRange = {
  afterOpenTime: number;
  beforeOpenTime: number;
  startOpenTime: number;
  endOpenTime: number;
  missingCandles: number;
};

export type CandleContinuityDiagnostics = {
  inputCount: number;
  sortedCandleCount: number;
  duplicateOpenTimeCount: number;
  nonFiniteCandleCount: number;
  gapCount: number;
  firstOpenTime?: number;
  lastOpenTime?: number;
  expectedNextOpenTime?: number;
  isContinuous: boolean;
  missingOpenTimes: number[];
  missingRanges: CandleGapRange[];
  incompleteReason?: string;
};

export type NormalizeCandlesResult = {
  candles: Candle[];
  diagnostics: CandleContinuityDiagnostics;
};

export type CandleSufficiencyDiagnostics = {
  isSufficient: boolean;
  candleCount: number;
  requiredCount: number;
  incompleteReason?: string;
};

export function normalizeCandles(
  candles: Candle[],
  timeframe: Timeframe,
): NormalizeCandlesResult {
  const byOpenTime = new Map<number, Candle>();
  let duplicateOpenTimeCount = 0;
  let nonFiniteCandleCount = 0;

  for (const candle of candles) {
    if (!hasFiniteCandleValues(candle)) {
      nonFiniteCandleCount += 1;
      continue;
    }

    if (byOpenTime.has(candle.openTime)) {
      duplicateOpenTimeCount += 1;
    }

    byOpenTime.set(candle.openTime, { ...candle });
  }

  const sortedCandles = [...byOpenTime.values()].sort(
    (left, right) => left.openTime - right.openTime,
  );
  const diagnostics = buildContinuityDiagnostics({
    inputCount: candles.length,
    candles: sortedCandles,
    timeframe,
    duplicateOpenTimeCount,
    nonFiniteCandleCount,
  });

  return {
    candles: sortedCandles,
    diagnostics,
  };
}

export function inspectCandleContinuity(
  candles: Candle[],
  timeframe: Timeframe,
): CandleContinuityDiagnostics {
  return normalizeCandles(candles, timeframe).diagnostics;
}

export function assertSufficientCandles(
  candles: Candle[],
  requiredCount: number,
): CandleSufficiencyDiagnostics {
  if (!Number.isInteger(requiredCount) || requiredCount <= 0) {
    throw new Error("requiredCount must be a positive integer.");
  }

  const candleCount = candles.length;
  const isSufficient = candleCount >= requiredCount;

  return {
    isSufficient,
    candleCount,
    requiredCount,
    incompleteReason: isSufficient
      ? undefined
      : `Only ${candleCount} candles available; ${requiredCount} required.`,
  };
}

function buildContinuityDiagnostics({
  inputCount,
  candles,
  timeframe,
  duplicateOpenTimeCount,
  nonFiniteCandleCount,
}: {
  inputCount: number;
  candles: Candle[];
  timeframe: Timeframe;
  duplicateOpenTimeCount: number;
  nonFiniteCandleCount: number;
}): CandleContinuityDiagnostics {
  const durationMs = getCandleTimeframeDurationMs(timeframe);
  const missingRanges: CandleGapRange[] = [];
  const missingOpenTimes: number[] = [];

  for (let index = 1; index < candles.length; index += 1) {
    const previous = candles[index - 1]!;
    const current = candles[index]!;
    const expectedOpenTime = previous.openTime + durationMs;

    if (current.openTime <= previous.openTime || current.openTime === expectedOpenTime) {
      continue;
    }

    const missingCandles = Math.floor(
      (current.openTime - expectedOpenTime) / durationMs,
    );
    const endOpenTime = current.openTime - durationMs;

    missingRanges.push({
      afterOpenTime: previous.openTime,
      beforeOpenTime: current.openTime,
      startOpenTime: expectedOpenTime,
      endOpenTime,
      missingCandles,
    });

    for (
      let openTime = expectedOpenTime;
      openTime <= endOpenTime;
      openTime += durationMs
    ) {
      missingOpenTimes.push(openTime);
    }
  }

  const firstOpenTime = candles.at(0)?.openTime;
  const lastOpenTime = candles.at(-1)?.openTime;
  const expectedNextOpenTime =
    lastOpenTime === undefined ? undefined : lastOpenTime + durationMs;
  const gapCount = missingRanges.length;
  const isContinuous = candles.length > 0 && gapCount === 0 && nonFiniteCandleCount === 0;

  return {
    inputCount,
    sortedCandleCount: candles.length,
    duplicateOpenTimeCount,
    nonFiniteCandleCount,
    gapCount,
    firstOpenTime,
    lastOpenTime,
    expectedNextOpenTime,
    isContinuous,
    missingOpenTimes,
    missingRanges,
    incompleteReason: buildIncompleteReason({
      candleCount: candles.length,
      gapCount,
      nonFiniteCandleCount,
    }),
  };
}

function buildIncompleteReason({
  candleCount,
  gapCount,
  nonFiniteCandleCount,
}: {
  candleCount: number;
  gapCount: number;
  nonFiniteCandleCount: number;
}) {
  if (candleCount === 0) {
    return "No usable candles available.";
  }

  if (nonFiniteCandleCount > 0) {
    return "Non-finite candle values were removed.";
  }

  if (gapCount > 0) {
    return "Missing candle intervals detected.";
  }

  return undefined;
}

function hasFiniteCandleValues(candle: Candle) {
  return (
    Number.isFinite(candle.openTime) &&
    Number.isFinite(candle.open) &&
    Number.isFinite(candle.high) &&
    Number.isFinite(candle.low) &&
    Number.isFinite(candle.close) &&
    Number.isFinite(candle.volume) &&
    Number.isFinite(candle.closeTime) &&
    (candle.quoteVolume === undefined || Number.isFinite(candle.quoteVolume))
  );
}
