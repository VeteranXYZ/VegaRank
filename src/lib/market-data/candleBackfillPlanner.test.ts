import { describe, expect, it } from "vitest";
import {
  buildBackfillPlan,
  getCandleTimeframeDurationMs,
} from "./candleBackfillPlanner";

const hourMs = getCandleTimeframeDurationMs("1h");
const dayMs = getCandleTimeframeDurationMs("1d");

describe("candle backfill planner", () => {
  it("creates deterministic ascending windows for 5000 hourly candles", () => {
    const plan = buildBackfillPlan({
      timeframe: "1h",
      targetCandles: 5_000,
      maxCandlesPerRequest: 350,
      endTimeMs: Date.UTC(2026, 0, 31, 23),
    });

    expect(plan.windows).toHaveLength(15);
    expect(plan.requestedCandles).toBe(5_000);
    expect(plan.truncatedByEarliestTime).toBe(false);
    expect(plan.windows[0]).toMatchObject({
      expectedCandles: 100,
      requestLimit: 100,
    });
    expect(plan.windows.at(-1)).toMatchObject({
      expectedCandles: 350,
      requestLimit: 350,
      endTimeMs: Date.UTC(2026, 0, 31, 23),
    });
    expect(plan.windows.every((window, index, windows) => {
      return index === 0 || window.startTimeMs > windows[index - 1]!.startTimeMs;
    })).toBe(true);
    expect(plan.windows[1]!.startTimeMs).toBe(plan.windows[0]!.endTimeMs + hourMs);
  });

  it("creates multiple deterministic daily windows", () => {
    const plan = buildBackfillPlan({
      timeframe: "1d",
      targetCandles: 3_000,
      maxCandlesPerRequest: 350,
      endTimeMs: Date.UTC(2026, 5, 1),
    });

    expect(plan.windows).toHaveLength(9);
    expect(plan.requestedCandles).toBe(3_000);
    expect(plan.windows[0]!.expectedCandles).toBe(200);
    expect(plan.windows.at(-1)!.endTimeMs).toBe(Date.UTC(2026, 5, 1));
    expect(plan.windows[1]!.startTimeMs).toBe(plan.windows[0]!.endTimeMs + dayMs);
  });

  it("handles exact request-limit division", () => {
    const plan = buildBackfillPlan({
      timeframe: "1h",
      targetCandles: 700,
      maxCandlesPerRequest: 350,
      endTimeMs: 699 * hourMs,
    });

    expect(plan.windows).toHaveLength(2);
    expect(plan.windows.map((window) => window.expectedCandles)).toEqual([350, 350]);
    expect(plan.requestedCandles).toBe(700);
  });

  it("uses one window when the target is smaller than the request limit", () => {
    const plan = buildBackfillPlan({
      timeframe: "4h",
      targetCandles: 50,
      maxCandlesPerRequest: 350,
      endTimeMs: 49 * getCandleTimeframeDurationMs("4h"),
    });

    expect(plan.windows).toEqual([
      {
        startTimeMs: 0,
        endTimeMs: 49 * getCandleTimeframeDurationMs("4h"),
        expectedCandles: 50,
        requestLimit: 50,
      },
    ]);
  });

  it("clamps safely to earliestTimeMs", () => {
    const plan = buildBackfillPlan({
      timeframe: "1h",
      targetCandles: 10,
      maxCandlesPerRequest: 100,
      endTimeMs: 10 * hourMs,
      earliestTimeMs: 5 * hourMs,
    });

    expect(plan.truncatedByEarliestTime).toBe(true);
    expect(plan.requestedCandles).toBe(6);
    expect(plan.windows).toEqual([
      {
        startTimeMs: 5 * hourMs,
        endTimeMs: 10 * hourMs,
        expectedCandles: 6,
        requestLimit: 6,
      },
    ]);
  });

  it("supports controlled overlap between windows", () => {
    const plan = buildBackfillPlan({
      timeframe: "1h",
      targetCandles: 5,
      maxCandlesPerRequest: 3,
      overlapCandles: 1,
      endTimeMs: 4 * hourMs,
    });

    expect(plan.requestedCandles).toBe(6);
    expect(plan.windows).toEqual([
      {
        startTimeMs: 0,
        endTimeMs: 2 * hourMs,
        expectedCandles: 3,
        requestLimit: 3,
      },
      {
        startTimeMs: 2 * hourMs,
        endTimeMs: 4 * hourMs,
        expectedCandles: 3,
        requestLimit: 3,
      },
    ]);
  });

  it("throws controlled errors for invalid inputs", () => {
    expect(() =>
      buildBackfillPlan({
        timeframe: "1h",
        targetCandles: 0,
        maxCandlesPerRequest: 350,
        endTimeMs: 0,
      }),
    ).toThrow("targetCandles must be a positive integer");
    expect(() =>
      buildBackfillPlan({
        timeframe: "1h",
        targetCandles: 10,
        maxCandlesPerRequest: 0,
        endTimeMs: 0,
      }),
    ).toThrow("maxCandlesPerRequest must be a positive integer");
    expect(() =>
      buildBackfillPlan({
        timeframe: "1h",
        targetCandles: 10,
        maxCandlesPerRequest: 3,
        overlapCandles: 3,
        endTimeMs: 0,
      }),
    ).toThrow("overlapCandles must be smaller than maxCandlesPerRequest");
    expect(() =>
      buildBackfillPlan({
        timeframe: "1h",
        targetCandles: 10,
        maxCandlesPerRequest: 350,
        endTimeMs: Number.NaN,
      }),
    ).toThrow("endTimeMs must be a finite timestamp");
    expect(() =>
      buildBackfillPlan({
        timeframe: "1M",
        targetCandles: 10,
        maxCandlesPerRequest: 350,
        endTimeMs: 0,
      }),
    ).toThrow("Unsupported candle timeframe");
  });
});
