import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SymbolBehaviorPanel } from "./SymbolBehaviorPanel";
import type { SymbolBehavior, SymbolBehaviorRecentOutcome } from "./symbolBehaviorUi";

describe("SymbolBehaviorPanel", () => {
  it("renders populated historical behavior data", () => {
    const html = renderToStaticMarkup(
      createElement(SymbolBehaviorPanel, { behavior: makeBehavior() }),
    );

    expect(html).toContain("Historical Behavior");
    expect(html).toContain("Past scanner signals for this symbol and timeframe");
    expect(html).toContain("Historical Sample");
    expect(html).toContain("12");
    expect(html).toContain("Forward return after 1 candle");
    expect(html).toContain("Avg Return");
    expect(html).toContain("+1.20%");
    expect(html).toContain("Current setup context");
    expect(html).toContain("Eligible");
    expect(html).toContain("Confirmed");
    expect(html).toContain("Recent outcomes");
    expect(html).toContain("Show more outcomes (1 hidden)");
  });

  it("renders empty state when behavior is missing", () => {
    const html = renderToStaticMarkup(
      createElement(SymbolBehaviorPanel, { behavior: null }),
    );

    expect(html).toContain("Not enough historical behavior data yet.");
    expect(html).toContain("More scanner runs with forward candles are needed");
  });

  it("renders small sample warnings and partial forward data", () => {
    const behavior = makeBehavior({
      warnings: ["Limited historical sample size."],
      recentOutcomes: [makeOutcome({ hasEnoughForwardCandles: false })],
    });
    const html = renderToStaticMarkup(
      createElement(SymbolBehaviorPanel, { behavior }),
    );

    expect(html).toContain("Limited historical sample size.");
    expect(html).toContain("Partial");
  });
});

function makeBehavior(
  overrides: Partial<SymbolBehavior> = {},
): SymbolBehavior {
  return {
    timeframe: "4h",
    symbol: "SEIUSDT",
    sampleSize: 12,
    eligibleSampleSize: 11,
    horizons: [
      {
        candles: 1,
        sampleSize: 11,
        averageReturnPct: 1.2,
        medianReturnPct: 0.8,
        winRatePct: 63.6,
        averageMaxUpsidePct: 2.4,
        averageMaxDrawdownPct: -1.1,
        bestReturnPct: 5.3,
        worstReturnPct: -3.2,
      },
      {
        candles: 3,
        sampleSize: 11,
        averageReturnPct: 2.2,
        medianReturnPct: 1.8,
        winRatePct: 72.7,
        averageMaxUpsidePct: 4.4,
        averageMaxDrawdownPct: -2.1,
        bestReturnPct: 8.3,
        worstReturnPct: -4.2,
      },
      {
        candles: 5,
        sampleSize: 11,
        averageReturnPct: 3.2,
        medianReturnPct: 2.8,
        winRatePct: 72.7,
        averageMaxUpsidePct: 5.4,
        averageMaxDrawdownPct: -2.8,
        bestReturnPct: 10.3,
        worstReturnPct: -6.2,
      },
    ],
    byGroup: [],
    bySignalLabel: [],
    recentOutcomes: Array.from({ length: 6 }, (_, index) =>
      makeOutcome({ scanTime: `2026-05-${String(index + 1).padStart(2, "0")}T00:00:00.000Z` }),
    ),
    currentContext: {
      currentSignalLabel: "confirmed",
      currentResultGroup: "eligible",
      matchingGroupSampleSize: 7,
      matchingSignalSampleSize: 5,
      note: "Research only.",
    },
    warnings: [],
    ...overrides,
  };
}

function makeOutcome(
  overrides: Partial<SymbolBehaviorRecentOutcome> = {},
): SymbolBehaviorRecentOutcome {
  const scanTime = overrides.scanTime ?? "2026-05-01T00:00:00.000Z";

  return {
    scanTime,
    candleOpenTime: scanTime,
    signalLabel: "confirmed",
    resultGroup: "eligible",
    actionBias: "eligible",
    primaryStructure: "strong_trend",
    priceAtSignal: 1.23,
    rankScore: 82,
    forwardReturnsPct: { next1: 1.2, next3: 2.1, next5: 3.4 },
    maxUpsidePct: { next1: 2.2, next3: 3.1, next5: 4.4 },
    maxDrawdownPct: { next1: -0.8, next3: -1.4, next5: -2.5 },
    hasEnoughForwardCandles: true,
    ...overrides,
  };
}
