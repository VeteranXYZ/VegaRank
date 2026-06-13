import type { Candle } from "@/lib/shared/timeframes";
import { describe, expect, it } from "vitest";
import {
  aggregateDailyCandlesToWeekly,
  getMondayUtcWeekStartMs,
} from "./weeklyAggregation";

const dayMs = 24 * 60 * 60 * 1000;
const weekMs = 7 * dayMs;
const monday = Date.UTC(2026, 0, 5);

describe("weekly aggregation", () => {
  it("aggregates seven daily candles into one Monday UTC weekly candle", () => {
    const result = aggregateDailyCandlesToWeekly(makeDailyCandles(monday, 7));

    expect(result.weeklyCandles).toEqual([
      {
        openTime: monday,
        open: 100,
        high: 116,
        low: 84,
        close: 107,
        volume: 91,
        quoteVolume: 721,
        closeTime: monday + weekMs - 1,
      },
    ]);
    expect(result.diagnostics).toMatchObject({
      totalWeeks: 1,
      completeWeeks: 1,
      partialWeeks: 0,
      droppedPartialWeeks: 0,
      gapsDetected: 0,
    });
  });

  it("aggregates two complete weeks into two weekly candles", () => {
    const result = aggregateDailyCandlesToWeekly(makeDailyCandles(monday, 14));

    expect(result.weeklyCandles).toHaveLength(2);
    expect(result.weeklyCandles.map((candle) => candle.openTime)).toEqual([
      monday,
      monday + weekMs,
    ]);
    expect(result.diagnostics.completeWeeks).toBe(2);
  });

  it("drops partial latest week by default", () => {
    const result = aggregateDailyCandlesToWeekly(makeDailyCandles(monday, 10));

    expect(result.weeklyCandles).toHaveLength(1);
    expect(result.weeklyCandles[0]!.openTime).toBe(monday);
    expect(result.diagnostics).toMatchObject({
      totalWeeks: 2,
      completeWeeks: 1,
      partialWeeks: 1,
      droppedPartialWeeks: 1,
    });
  });

  it("can include the latest partial week when explicitly requested", () => {
    const result = aggregateDailyCandlesToWeekly(makeDailyCandles(monday, 10), {
      includeIncompleteCurrentWeek: true,
    });

    expect(result.weeklyCandles).toHaveLength(2);
    expect(result.weeklyCandles[1]).toMatchObject({
      openTime: monday + weekMs,
      open: 107,
      high: 119,
      low: 81,
      close: 110,
      volume: 54,
      quoteVolume: 324,
      closeTime: monday + 2 * weekMs - 1,
    });
    expect(result.diagnostics).toMatchObject({
      completeWeeks: 1,
      partialWeeks: 1,
      droppedPartialWeeks: 0,
    });
  });

  it("reports missing daily candles as partial coverage with gap diagnostics", () => {
    const dailyCandles = makeDailyCandles(monday, 7).filter(
      (candle) => candle.openTime !== monday + 2 * dayMs,
    );
    const result = aggregateDailyCandlesToWeekly(dailyCandles);

    expect(result.weeklyCandles).toEqual([]);
    expect(result.diagnostics).toMatchObject({
      totalWeeks: 1,
      completeWeeks: 0,
      partialWeeks: 1,
      droppedPartialWeeks: 1,
      gapsDetected: 1,
    });
    expect(result.diagnostics.normalizedInput.missingOpenTimes).toEqual([
      monday + 2 * dayMs,
    ]);
  });

  it("uses Monday 00:00 UTC as the week boundary", () => {
    const sunday = Date.UTC(2026, 0, 11);
    const nextMonday = Date.UTC(2026, 0, 12);

    expect(getMondayUtcWeekStartMs(sunday)).toBe(monday);
    expect(getMondayUtcWeekStartMs(nextMonday)).toBe(nextMonday);
  });

  it("aggregates unordered daily candles after normalization", () => {
    const result = aggregateDailyCandlesToWeekly(
      makeDailyCandles(monday, 7).reverse(),
    );

    expect(result.weeklyCandles).toHaveLength(1);
    expect(result.weeklyCandles[0]).toMatchObject({
      openTime: monday,
      open: 100,
      close: 107,
    });
    expect(result.diagnostics.normalizedInput.isContinuous).toBe(true);
  });

  it("throws controlled errors for unsupported options", () => {
    expect(() =>
      aggregateDailyCandlesToWeekly([], {
        minDailyCandlesPerWeek: 8,
      }),
    ).toThrow("minDailyCandlesPerWeek must be an integer from 1 to 7");
  });
});

function makeDailyCandles(startTimeMs: number, count: number): Candle[] {
  return Array.from({ length: count }, (_, index) => {
    const openTime = startTimeMs + index * dayMs;

    return {
      openTime,
      open: 100 + index,
      high: 110 + index,
      low: 90 - index,
      close: 101 + index,
      volume: 10 + index,
      quoteVolume: 100 + index,
      closeTime: openTime + dayMs - 1,
    };
  });
}
