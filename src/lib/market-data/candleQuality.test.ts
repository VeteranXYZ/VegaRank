import type { Candle } from "@/lib/shared/timeframes";
import { describe, expect, it } from "vitest";
import {
  assertSufficientCandles,
  inspectCandleContinuity,
  normalizeCandles,
} from "./candleQuality";

const hourMs = 60 * 60 * 1000;

describe("candle quality helpers", () => {
  it("sorts unordered candles ascending without mutating input", () => {
    const input = [makeCandle(2 * hourMs), makeCandle(0), makeCandle(hourMs)];
    const originalOpenTimes = input.map((candle) => candle.openTime);

    const result = normalizeCandles(input, "1h");

    expect(result.candles.map((candle) => candle.openTime)).toEqual([
      0,
      hourMs,
      2 * hourMs,
    ]);
    expect(input.map((candle) => candle.openTime)).toEqual(originalOpenTimes);
    expect(result.diagnostics.isContinuous).toBe(true);
  });

  it("deduplicates by openTime with a last duplicate wins policy", () => {
    const result = normalizeCandles(
      [
        makeCandle(0, { close: 101 }),
        makeCandle(hourMs),
        makeCandle(0, { close: 202 }),
      ],
      "1h",
    );

    expect(result.candles).toHaveLength(2);
    expect(result.candles[0]!.close).toBe(202);
    expect(result.diagnostics.duplicateOpenTimeCount).toBe(1);
  });

  it("reports missing candle intervals", () => {
    const diagnostics = inspectCandleContinuity(
      [makeCandle(0), makeCandle(2 * hourMs)],
      "1h",
    );

    expect(diagnostics.isContinuous).toBe(false);
    expect(diagnostics.gapCount).toBe(1);
    expect(diagnostics.missingOpenTimes).toEqual([hourMs]);
    expect(diagnostics.missingRanges).toEqual([
      {
        afterOpenTime: 0,
        beforeOpenTime: 2 * hourMs,
        startOpenTime: hourMs,
        endOpenTime: hourMs,
        missingCandles: 1,
      },
    ]);
    expect(diagnostics.incompleteReason).toBe("Missing candle intervals detected.");
  });

  it("reports continuous candles with expected next open time", () => {
    const diagnostics = inspectCandleContinuity(
      [makeCandle(0), makeCandle(hourMs), makeCandle(2 * hourMs)],
      "1h",
    );

    expect(diagnostics).toMatchObject({
      sortedCandleCount: 3,
      gapCount: 0,
      firstOpenTime: 0,
      lastOpenTime: 2 * hourMs,
      expectedNextOpenTime: 3 * hourMs,
      isContinuous: true,
    });
    expect(diagnostics.incompleteReason).toBeUndefined();
  });

  it("reports insufficient coverage without throwing", () => {
    expect(assertSufficientCandles([makeCandle(0), makeCandle(hourMs)], 3)).toEqual({
      isSufficient: false,
      candleCount: 2,
      requiredCount: 3,
      incompleteReason: "Only 2 candles available; 3 required.",
    });
    expect(assertSufficientCandles([makeCandle(0), makeCandle(hourMs)], 2)).toEqual({
      isSufficient: true,
      candleCount: 2,
      requiredCount: 2,
      incompleteReason: undefined,
    });
  });

  it("removes non-finite candles conservatively", () => {
    const result = normalizeCandles(
      [makeCandle(0), makeCandle(hourMs, { close: Number.NaN })],
      "1h",
    );

    expect(result.candles).toEqual([makeCandle(0)]);
    expect(result.diagnostics.nonFiniteCandleCount).toBe(1);
    expect(result.diagnostics.isContinuous).toBe(false);
    expect(result.diagnostics.incompleteReason).toBe(
      "Non-finite candle values were removed.",
    );
  });

  it("throws controlled errors for invalid sufficiency requirements", () => {
    expect(() => assertSufficientCandles([], 0)).toThrow(
      "requiredCount must be a positive integer",
    );
  });
});

function makeCandle(openTime: number, overrides: Partial<Candle> = {}): Candle {
  return {
    openTime,
    open: 100,
    high: 110,
    low: 90,
    close: 105,
    volume: 1_000,
    closeTime: openTime + hourMs - 1,
    ...overrides,
  };
}
