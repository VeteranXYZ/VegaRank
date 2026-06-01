import { describe, expect, it } from "vitest";
import {
  buildBehaviorSummary,
  formatBehaviorPercent,
  formatBehaviorSampleSize,
  formatBehaviorWinRate,
  getBehaviorGroupLabel,
  getBehaviorSignalLabel,
  getHiddenRecentOutcomeCount,
  selectCompactRecentOutcomes,
  type SymbolBehavior,
  type SymbolBehaviorRecentOutcome,
} from "./symbolBehaviorUi";

describe("symbol behavior UI helpers", () => {
  it("formats percentages and sample sizes conservatively", () => {
    expect(formatBehaviorPercent(1.234)).toBe("+1.23%");
    expect(formatBehaviorPercent(-0.5)).toBe("-0.50%");
    expect(formatBehaviorPercent(0)).toBe("0.00%");
    expect(formatBehaviorPercent(null)).toBe("-");
    expect(formatBehaviorWinRate(62.345)).toBe("62.3%");
    expect(formatBehaviorWinRate(null)).toBe("-");
    expect(formatBehaviorSampleSize(12.9)).toBe("12");
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
    const outcomes = Array.from({ length: 7 }, (_, index) =>
      makeOutcome(`2026-06-0${index + 1}T00:00:00.000Z`),
    );

    expect(selectCompactRecentOutcomes(outcomes, false)).toHaveLength(5);
    expect(selectCompactRecentOutcomes(outcomes, true)).toHaveLength(7);
    expect(
      getHiddenRecentOutcomeCount({ outcomes, expanded: false, compactLimit: 5 }),
    ).toBe(2);
    expect(
      getHiddenRecentOutcomeCount({ outcomes, expanded: true, compactLimit: 5 }),
    ).toBe(0);
  });

  it("builds summary rows from behavior and current context", () => {
    expect(buildBehaviorSummary(makeBehavior())).toEqual([
      { label: "Historical Sample", value: "12" },
      { label: "Outcome Sample", value: "11" },
      { label: "Current Group Sample", value: "7" },
      { label: "Current Signal Sample", value: "5" },
    ]);
  });
});

function makeBehavior(): SymbolBehavior {
  return {
    timeframe: "4h",
    symbol: "SEIUSDT",
    sampleSize: 12,
    eligibleSampleSize: 11,
    horizons: [],
    byGroup: [],
    bySignalLabel: [],
    recentOutcomes: [],
    currentContext: {
      currentSignalLabel: "confirmed",
      currentResultGroup: "eligible",
      matchingGroupSampleSize: 7,
      matchingSignalSampleSize: 5,
      note: "Research only.",
    },
    warnings: [],
  };
}

function makeOutcome(scanTime: string): SymbolBehaviorRecentOutcome {
  return {
    scanTime,
    candleOpenTime: scanTime,
    signalLabel: "confirmed",
    resultGroup: "eligible",
    actionBias: "eligible",
    primaryStructure: "strong_trend",
    priceAtSignal: 1,
    rankScore: 10,
    forwardReturnsPct: { next1: 1, next3: 2, next5: 3 },
    maxUpsidePct: { next1: 2, next3: 3, next5: 4 },
    maxDrawdownPct: { next1: -1, next3: -2, next5: -3 },
    hasEnoughForwardCandles: true,
  };
}
