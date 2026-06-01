import { describe, expect, it } from "vitest";
import {
  buildBehaviorSummary,
  formatBehaviorPercent,
  formatBehaviorSampleSize,
  formatBehaviorWinRate,
  getBehaviorGroupLabel,
  getBehaviorHorizonRows,
  getBehaviorSignalLabel,
  getBehaviorUnavailableMessage,
  getHiddenRecentOutcomeCount,
  selectCompactRecentOutcomes,
  type SymbolBehavior,
  type SymbolBehaviorRecentOutcome,
} from "./symbolBehaviorUi";

describe("symbol behavior UI helpers", () => {
  it("formats percentages and sample sizes conservatively", () => {
    expect(formatBehaviorPercent(1.234)).toBe("+1.23%");
    expect(formatBehaviorPercent("2.5")).toBe("+2.50%");
    expect(formatBehaviorPercent(-0.5)).toBe("-0.50%");
    expect(formatBehaviorPercent(0)).toBe("0.00%");
    expect(formatBehaviorPercent(null)).toBe("—");
    expect(formatBehaviorPercent("bad")).toBe("—");
    expect(formatBehaviorWinRate(62.345)).toBe("62.3%");
    expect(formatBehaviorWinRate(null)).toBe("—");
    expect(formatBehaviorSampleSize(12.9)).toBe("12");
    expect(formatBehaviorSampleSize("9")).toBe("9");
    expect(formatBehaviorSampleSize(null)).toBe("0");
  });

  it("formats group and signal labels", () => {
    expect(getBehaviorGroupLabel("insufficient_history")).toBe(
      "Insufficient History",
    );
    expect(getBehaviorSignalLabel("breakdown_risk")).toBe("Breakdown Risk");
    expect(getBehaviorGroupLabel(null)).toBe("Unknown");
  });

  it("selects compact and expanded recent outcomes", () => {
    const outcomes = Array.from({ length: 12 }, (_, index) =>
      makeOutcome(`2026-06-0${index + 1}T00:00:00.000Z`),
    );

    expect(selectCompactRecentOutcomes(outcomes, false)).toHaveLength(10);
    expect(selectCompactRecentOutcomes(outcomes, true)).toHaveLength(12);
    expect(
      getHiddenRecentOutcomeCount({ outcomes, expanded: false, compactLimit: 5 }),
    ).toBe(7);
    expect(
      getHiddenRecentOutcomeCount({ outcomes, expanded: true, compactLimit: 5 }),
    ).toBe(0);
  });

  it("builds horizon and summary rows from behavior", () => {
    expect(getBehaviorHorizonRows(makeBehavior()).map((row) => row.label)).toEqual([
      "1 candle",
      "3 candles",
      "5 candles",
    ]);
    expect(buildBehaviorSummary(makeBehavior())).toEqual([
      { label: "Sample Size", value: "12 prior observations" },
      { label: "1 Candle Outcomes", value: "11" },
      { label: "3 Candle Outcomes", value: "10" },
      { label: "5 Candle Outcomes", value: "9" },
    ]);
  });

  it("normalizes missing or array-based horizons without crashing", () => {
    expect(getBehaviorHorizonRows({ sampleSize: 3, horizons: null })).toEqual([
      expect.objectContaining({ horizon: "1", sampleSize: 0 }),
      expect.objectContaining({ horizon: "3", sampleSize: 0 }),
      expect.objectContaining({ horizon: "5", sampleSize: 0 }),
    ]);
    expect(
      getBehaviorHorizonRows({
        sampleSize: "3",
        horizons: [{ candles: 1, sampleSize: "2", avgReturnPct: "1.5" }],
      })[0],
    ).toMatchObject({
      horizon: "1",
      sampleSize: 2,
      avgReturnPct: 1.5,
    });
  });

  it("formats unavailable diagnostics messages", () => {
    expect(
      getBehaviorUnavailableMessage({
        diagnostics: {
          available: false,
          reason: "no_prior_signals",
          message: "No prior signals.",
        },
      }),
    ).toContain("No prior matching signals were found yet");
    expect(
      getBehaviorUnavailableMessage({
        diagnostics: { available: false, reason: "no_latest_signal" },
        coverage: { candleCount: "146", requiredCandles: 200 },
      }),
    ).toContain("Current coverage: 146 / 200 required candles.");
    expect(getBehaviorUnavailableMessage()).toBe(
      "Historical behavior is currently unavailable for this symbol/timeframe.",
    );
  });
});

function makeBehavior(): SymbolBehavior {
  return {
    sampleSize: 12,
    horizons: {
      "1": makeHorizon(11, 1.2),
      "3": makeHorizon(10, 2.2),
      "5": makeHorizon(9, 3.2),
    },
    byResultGroup: [],
    bySignalLabel: [],
    recentOutcomes: [],
    currentContext: {
      signalLabel: "confirmed",
      resultGroup: "eligible",
      primaryStructure: "strong_trend",
      timeframe: "4h",
    },
    warnings: [],
  };
}

function makeHorizon(sampleSize: number, avgReturnPct: number) {
  return {
    sampleSize,
    avgReturnPct,
    medianReturnPct: avgReturnPct,
    winRatePct: 60,
    bestReturnPct: 5,
    worstReturnPct: -2,
  };
}

function makeOutcome(scanTime: string): SymbolBehaviorRecentOutcome {
  return {
    scanTime,
    signalLabel: "confirmed",
    resultGroup: "eligible",
    priceAtSignal: 1,
    rankScore: 10,
    forwardReturnPct: { "1": 1, "3": 2, "5": 3 },
  };
}
