import type { Candle } from "@/lib/shared/timeframes";
import { getCandleTimeframeDurationMs } from "./candleBackfillPlanner";
import {
  normalizeCandles,
  type CandleContinuityDiagnostics,
} from "./candleQuality";

export type WeeklyAggregationOptions = {
  includeIncompleteCurrentWeek?: boolean;
  minDailyCandlesPerWeek?: number;
  weekStartsOn?: "monday-utc";
};

export type WeeklyAggregationDiagnostics = {
  totalWeeks: number;
  completeWeeks: number;
  partialWeeks: number;
  droppedPartialWeeks: number;
  gapsDetected: number;
  normalizedInput: CandleContinuityDiagnostics;
};

export type WeeklyAggregationResult = {
  weeklyCandles: Candle[];
  diagnostics: WeeklyAggregationDiagnostics;
};

const dayMs = getCandleTimeframeDurationMs("1d");
const weekMs = getCandleTimeframeDurationMs("1w");
const completeWeekDailyCandles = 7;

export function aggregateDailyCandlesToWeekly(
  dailyCandles: Candle[],
  options: WeeklyAggregationOptions = {},
): WeeklyAggregationResult {
  validateWeeklyAggregationOptions(options);

  if (options.weekStartsOn && options.weekStartsOn !== "monday-utc") {
    throw new Error("Only monday-utc weekly aggregation is supported.");
  }

  const normalized = normalizeCandles(dailyCandles, "1d");
  const weekGroups = groupDailyCandlesByMondayUtcWeek(normalized.candles);
  const minDailyCandlesPerWeek = options.minDailyCandlesPerWeek ?? 1;
  const weeklyCandles: Candle[] = [];
  let completeWeeks = 0;
  let partialWeeks = 0;
  let droppedPartialWeeks = 0;

  weekGroups.forEach((group, index) => {
    const isComplete = isCompleteUtcWeek(group.weekStartTimeMs, group.candles);
    const isLatestWeek = index === weekGroups.length - 1;

    if (isComplete) {
      completeWeeks += 1;
      weeklyCandles.push(buildWeeklyCandle(group.weekStartTimeMs, group.candles));
      return;
    }

    partialWeeks += 1;

    if (
      options.includeIncompleteCurrentWeek === true &&
      isLatestWeek &&
      group.candles.length >= minDailyCandlesPerWeek
    ) {
      weeklyCandles.push(buildWeeklyCandle(group.weekStartTimeMs, group.candles));
      return;
    }

    droppedPartialWeeks += 1;
  });

  return {
    weeklyCandles,
    diagnostics: {
      totalWeeks: weekGroups.length,
      completeWeeks,
      partialWeeks,
      droppedPartialWeeks,
      gapsDetected: normalized.diagnostics.gapCount,
      normalizedInput: normalized.diagnostics,
    },
  };
}

function validateWeeklyAggregationOptions(options: WeeklyAggregationOptions) {
  if (
    options.minDailyCandlesPerWeek !== undefined &&
    (!Number.isInteger(options.minDailyCandlesPerWeek) ||
      options.minDailyCandlesPerWeek <= 0 ||
      options.minDailyCandlesPerWeek > completeWeekDailyCandles)
  ) {
    throw new Error("minDailyCandlesPerWeek must be an integer from 1 to 7.");
  }
}

function groupDailyCandlesByMondayUtcWeek(candles: Candle[]) {
  const groups = new Map<number, Candle[]>();

  for (const candle of candles) {
    const weekStartTimeMs = getMondayUtcWeekStartMs(candle.openTime);
    const group = groups.get(weekStartTimeMs);

    if (group) {
      group.push(candle);
    } else {
      groups.set(weekStartTimeMs, [candle]);
    }
  }

  return [...groups.entries()]
    .sort(([leftWeekStart], [rightWeekStart]) => leftWeekStart - rightWeekStart)
    .map(([weekStartTimeMs, groupCandles]) => ({
      weekStartTimeMs,
      candles: groupCandles.sort((left, right) => left.openTime - right.openTime),
    }));
}

function isCompleteUtcWeek(weekStartTimeMs: number, candles: Candle[]) {
  if (candles.length !== completeWeekDailyCandles) {
    return false;
  }

  return candles.every(
    (candle, index) => candle.openTime === weekStartTimeMs + index * dayMs,
  );
}

function buildWeeklyCandle(weekStartTimeMs: number, candles: Candle[]): Candle {
  const firstCandle = candles[0]!;
  const lastCandle = candles.at(-1)!;
  const quoteVolumeValues = candles
    .map((candle) => candle.quoteVolume)
    .filter((quoteVolume): quoteVolume is number => Number.isFinite(quoteVolume));
  const quoteVolume =
    quoteVolumeValues.length > 0
      ? quoteVolumeValues.reduce((total, value) => total + value, 0)
      : undefined;

  return {
    openTime: weekStartTimeMs,
    open: firstCandle.open,
    high: Math.max(...candles.map((candle) => candle.high)),
    low: Math.min(...candles.map((candle) => candle.low)),
    close: lastCandle.close,
    volume: candles.reduce((total, candle) => total + candle.volume, 0),
    quoteVolume,
    closeTime: weekStartTimeMs + weekMs - 1,
  };
}

export function getMondayUtcWeekStartMs(timeMs: number) {
  if (!Number.isFinite(timeMs)) {
    throw new Error("timeMs must be a finite timestamp.");
  }

  const date = new Date(timeMs);
  const utcDay = date.getUTCDay();
  const daysSinceMonday = (utcDay + 6) % 7;

  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() - daysSinceMonday,
  );
}
