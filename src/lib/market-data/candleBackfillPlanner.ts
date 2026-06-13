import type { Timeframe } from "@/lib/shared/timeframes";

export type BackfillPlanInput = {
  timeframe: Timeframe;
  targetCandles: number;
  maxCandlesPerRequest: number;
  endTimeMs: number;
  overlapCandles?: number;
  earliestTimeMs?: number;
};

export type BackfillWindow = {
  startTimeMs: number;
  endTimeMs: number;
  expectedCandles: number;
  requestLimit: number;
};

export type BackfillPlan = {
  windows: BackfillWindow[];
  requestedCandles: number;
  targetCandles: number;
  timeframe: Timeframe;
  maxCandlesPerRequest: number;
  truncatedByEarliestTime: boolean;
};

export function buildBackfillPlan(input: BackfillPlanInput): BackfillPlan {
  const durationMs = getCandleTimeframeDurationMs(input.timeframe);
  const targetCandles = validatePositiveInteger(input.targetCandles, "targetCandles");
  const maxCandlesPerRequest = validatePositiveInteger(
    input.maxCandlesPerRequest,
    "maxCandlesPerRequest",
  );
  const overlapCandles = validateNonNegativeInteger(
    input.overlapCandles ?? 0,
    "overlapCandles",
  );
  const endTimeMs = validateFiniteTime(input.endTimeMs, "endTimeMs");

  if (overlapCandles >= maxCandlesPerRequest) {
    throw new Error("overlapCandles must be smaller than maxCandlesPerRequest.");
  }

  const alignedEndTimeMs = floorToDuration(endTimeMs, durationMs);
  const alignedEarliestTimeMs =
    input.earliestTimeMs === undefined
      ? undefined
      : ceilToDuration(validateFiniteTime(input.earliestTimeMs, "earliestTimeMs"), durationMs);

  if (
    alignedEarliestTimeMs !== undefined &&
    alignedEarliestTimeMs > alignedEndTimeMs
  ) {
    return {
      windows: [],
      requestedCandles: 0,
      targetCandles,
      timeframe: input.timeframe,
      maxCandlesPerRequest,
      truncatedByEarliestTime: true,
    };
  }

  const windowsDescending: BackfillWindow[] = [];
  let remainingUniqueCandles = targetCandles;
  let currentWindowEndTimeMs = alignedEndTimeMs;
  let truncatedByEarliestTime = false;

  while (remainingUniqueCandles > 0) {
    const requestedForWindow =
      windowsDescending.length === 0
        ? Math.min(remainingUniqueCandles, maxCandlesPerRequest)
        : Math.min(
            remainingUniqueCandles + overlapCandles,
            maxCandlesPerRequest,
          );
    let startTimeMs =
      currentWindowEndTimeMs - (requestedForWindow - 1) * durationMs;

    if (
      alignedEarliestTimeMs !== undefined &&
      startTimeMs < alignedEarliestTimeMs
    ) {
      startTimeMs = alignedEarliestTimeMs;
      truncatedByEarliestTime = true;
    }

    if (startTimeMs > currentWindowEndTimeMs) {
      break;
    }

    const expectedCandles =
      Math.floor((currentWindowEndTimeMs - startTimeMs) / durationMs) + 1;

    windowsDescending.push({
      startTimeMs,
      endTimeMs: currentWindowEndTimeMs,
      expectedCandles,
      requestLimit: expectedCandles,
    });

    const uniqueCandlesFromWindow =
      windowsDescending.length === 1
        ? expectedCandles
        : Math.max(0, expectedCandles - overlapCandles);
    remainingUniqueCandles -= uniqueCandlesFromWindow;

    if (truncatedByEarliestTime) {
      break;
    }

    currentWindowEndTimeMs =
      startTimeMs + (overlapCandles - 1) * durationMs;
  }

  const windows = windowsDescending.reverse();

  return {
    windows,
    requestedCandles: windows.reduce(
      (total, window) => total + window.expectedCandles,
      0,
    ),
    targetCandles,
    timeframe: input.timeframe,
    maxCandlesPerRequest,
    truncatedByEarliestTime,
  };
}

export function getCandleTimeframeDurationMs(timeframe: Timeframe) {
  switch (timeframe) {
    case "1h":
      return 60 * 60 * 1000;
    case "4h":
      return 4 * 60 * 60 * 1000;
    case "1d":
      return 24 * 60 * 60 * 1000;
    case "1w":
      return 7 * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Unsupported candle timeframe for backfill planning: ${timeframe}.`);
  }
}

function validatePositiveInteger(value: number, field: string) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive integer.`);
  }

  return value;
}

function validateNonNegativeInteger(value: number, field: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer.`);
  }

  return value;
}

function validateFiniteTime(value: number, field: string) {
  if (!Number.isFinite(value)) {
    throw new Error(`${field} must be a finite timestamp.`);
  }

  return value;
}

function floorToDuration(value: number, durationMs: number) {
  return Math.floor(value / durationMs) * durationMs;
}

function ceilToDuration(value: number, durationMs: number) {
  return Math.ceil(value / durationMs) * durationMs;
}
