import { describe, expect, it } from "vitest";
import {
  computeSimpleMovingAverage,
  findLatestSignalCandleTime,
  formatChartPrice,
  normalizeCandlesForChart,
  normalizeSymbolResearchCandles,
} from "./symbolChartUi";

describe("symbol chart UI helpers", () => {
  it("normalizes symbol research candle objects with explicit rows and count", () => {
    const rows = [
      { openTime: 1000, open: 1, high: 2, low: 0.5, close: 1.5 },
      { openTime: 2000, open: 2, high: 3, low: 1.5, close: 2.5 },
    ];

    expect(
      normalizeSymbolResearchCandles({
        count: 10,
        timeframe: "4h",
        firstOpenTime: "2026-05-30T00:00:00.000Z",
        lastOpenTime: "2026-05-31T00:00:00.000Z",
        rows,
      }),
    ).toEqual({
      count: 10,
      timeframe: "4h",
      firstOpenTime: "2026-05-30T00:00:00.000Z",
      lastOpenTime: "2026-05-31T00:00:00.000Z",
      rows,
    });
  });

  it("falls back to rows length when symbol research candle count is missing", () => {
    expect(
      normalizeSymbolResearchCandles({
        timeframe: "4h",
        rows: [
          { openTime: 1000, open: 1, high: 2, low: 0.5, close: 1.5 },
          { openTime: 2000, open: 2, high: 3, low: 1.5, close: 2.5 },
        ],
      }).count,
    ).toBe(2);
  });

  it("treats accidental array candle responses as rows for backward tolerance", () => {
    const rows = [{ openTime: 1000, open: 1, high: 2, low: 0.5, close: 1.5 }];

    expect(normalizeSymbolResearchCandles(rows)).toEqual({
      count: 1,
      timeframe: "",
      firstOpenTime: null,
      lastOpenTime: null,
      rows,
    });
  });

  it("returns a safe empty candle object for null or invalid input", () => {
    expect(normalizeSymbolResearchCandles(null)).toEqual({
      count: 0,
      timeframe: "",
      firstOpenTime: null,
      lastOpenTime: null,
      rows: [],
    });
    expect(normalizeSymbolResearchCandles("bad")).toEqual({
      count: 0,
      timeframe: "",
      firstOpenTime: null,
      lastOpenTime: null,
      rows: [],
    });
  });

  it("normalizes valid candles and rejects invalid candles safely", () => {
    const firstOpen = Date.parse("2026-05-31T00:00:00.000Z");
    const secondOpen = Date.parse("2026-05-31T04:00:00.000Z");
    const candles = normalizeCandlesForChart([
      { openTime: secondOpen, open: 2, high: 3, low: 1, close: 2.5 },
      { openTime: String(firstOpen), open: "1", high: "2", low: "0.5", close: "1.5" },
      { openTime: null, open: 1, high: 2, low: 0.5, close: 1.5 },
      { openTime: Date.parse("2026-05-31T08:00:00.000Z"), open: 1, high: 0.8, low: 0.5, close: 0.7 },
      { openTime: Date.parse("2026-05-31T12:00:00.000Z"), open: 1, high: 2, low: 1.5, close: 1.2 },
      { openTime: Date.parse("2026-05-31T16:00:00.000Z"), open: Number.NaN, high: 2, low: 1, close: 1.5 },
    ]);

    expect(candles).toEqual([
      { time: firstOpen / 1000, open: 1, high: 2, low: 0.5, close: 1.5 },
      { time: secondOpen / 1000, open: 2, high: 3, low: 1, close: 2.5 },
    ]);
  });

  it("handles empty candle arrays", () => {
    expect(normalizeCandlesForChart([])).toEqual([]);
    expect(computeSimpleMovingAverage([], 20)).toEqual([]);
    expect(
      findLatestSignalCandleTime({
        candles: [],
        candleOpenTime: "2026-05-31T00:00:00.000Z",
      }),
    ).toBeNull();
  });

  it("computes simple moving averages after enough closes are available", () => {
    const candles = normalizeCandlesForChart([
      { openTime: Date.parse("2026-05-31T00:00:00.000Z"), open: 1, high: 1, low: 1, close: 1 },
      { openTime: Date.parse("2026-05-31T04:00:00.000Z"), open: 2, high: 2, low: 2, close: 2 },
      { openTime: Date.parse("2026-05-31T08:00:00.000Z"), open: 3, high: 3, low: 3, close: 3 },
      { openTime: Date.parse("2026-05-31T12:00:00.000Z"), open: 4, high: 4, low: 4, close: 4 },
    ]);

    expect(computeSimpleMovingAverage(candles, 3)).toEqual([
      { time: Date.parse("2026-05-31T08:00:00.000Z") / 1000, value: 2 },
      { time: Date.parse("2026-05-31T12:00:00.000Z") / 1000, value: 3 },
    ]);
  });

  it("matches the latest signal candle by open timestamp when possible", () => {
    const candles = normalizeCandlesForChart([
      { openTime: Date.parse("2026-05-31T00:00:00.000Z"), open: 1, high: 2, low: 1, close: 1.5 },
      { openTime: Date.parse("2026-05-31T04:00:00.000Z"), open: 2, high: 3, low: 2, close: 2.5 },
    ]);

    expect(
      findLatestSignalCandleTime({
        candles,
        candleOpenTime: "2026-05-31T04:00:00.000Z",
      }),
    ).toBe(Date.parse("2026-05-31T04:00:00.000Z") / 1000);
    expect(
      findLatestSignalCandleTime({
        candles,
        candleOpenTime: "2026-05-31T08:00:00.000Z",
      }),
    ).toBeNull();
  });

  it("formats chart prices without advice wording", () => {
    expect(formatChartPrice(1234.567)).toBe("1,234.57");
    expect(formatChartPrice(0.000012345)).toBe("0.000012345");
    expect(formatChartPrice(null)).toBe("-");
  });
});
