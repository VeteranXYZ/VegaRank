import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SymbolBehaviorPanel } from "./SymbolBehaviorPanel";
import type {
  SymbolBehavior,
  SymbolBehaviorDiagnostics,
  SymbolBehaviorRecentOutcome,
} from "./symbolBehaviorUi";

describe("SymbolBehaviorPanel", () => {
  it("renders available historical behavior data", () => {
    const html = renderToStaticMarkup(
      createElement(SymbolBehaviorPanel, {
        behavior: makeBehavior(),
        diagnostics: makeDiagnostics(true),
      }),
    );

    expect(html).toContain("Historical Behavior");
    expect(html).toContain("Historical observations");
    expect(html).toContain("not a prediction");
    expect(html).toContain("Historical Sample");
    expect(html).toContain("Forward return after 1 candle");
    expect(html).toContain("Avg Return");
    expect(html).toContain("+1.20%");
    expect(html).toContain("Current context");
    expect(html).toContain("Eligible");
    expect(html).toContain("Confirmed");
    expect(html).toContain("Strong Trend");
    expect(html).toContain("Recent outcomes");
    expect(html).toContain("Show more outcomes (1 hidden)");
  });

  it("renders unavailable diagnostics without crashing", () => {
    const html = renderToStaticMarkup(
      createElement(SymbolBehaviorPanel, {
        behavior: null,
        diagnostics: makeDiagnostics(false, "no_prior_signals", "No prior signals."),
      }),
    );

    expect(html).toContain(
      "Historical behavior is not available for this symbol/timeframe yet.",
    );
    expect(html).toContain("No prior signals.");
  });

  it("renders small sample warnings", () => {
    const behavior = makeBehavior({
      warnings: ["Limited historical sample size."],
      recentOutcomes: [makeOutcome()],
    });
    const html = renderToStaticMarkup(
      createElement(SymbolBehaviorPanel, {
        behavior,
        diagnostics: makeDiagnostics(true),
      }),
    );

    expect(html).toContain("Limited historical sample size.");
    expect(html).toContain("Next 1");
    expect(html).toContain("+1.20%");
  });
});

function makeDiagnostics(
  available: boolean,
  reason: SymbolBehaviorDiagnostics["reason"] = available
    ? "ok"
    : "unknown",
  message = available
    ? "Historical behavior is available."
    : "Historical behavior is not available.",
): SymbolBehaviorDiagnostics {
  return { available, reason, message };
}

function makeBehavior(overrides: Partial<SymbolBehavior> = {}): SymbolBehavior {
  return {
    sampleSize: 12,
    horizons: {
      "1": makeHorizon(11, 1.2),
      "3": makeHorizon(11, 2.2),
      "5": makeHorizon(11, 3.2),
    },
    byResultGroup: [],
    bySignalLabel: [],
    recentOutcomes: Array.from({ length: 6 }, (_, index) =>
      makeOutcome({
        scanTime: `2026-05-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
      }),
    ),
    currentContext: {
      signalLabel: "confirmed",
      resultGroup: "eligible",
      primaryStructure: "strong_trend",
      timeframe: "4h",
    },
    warnings: [],
    ...overrides,
  };
}

function makeHorizon(sampleSize: number, avgReturnPct: number) {
  return {
    sampleSize,
    avgReturnPct,
    medianReturnPct: avgReturnPct - 0.4,
    winRatePct: 63.6,
    bestReturnPct: 5.3,
    worstReturnPct: -3.2,
  };
}

function makeOutcome(
  overrides: Partial<SymbolBehaviorRecentOutcome> = {},
): SymbolBehaviorRecentOutcome {
  return {
    scanTime: "2026-05-01T00:00:00.000Z",
    signalLabel: "confirmed",
    resultGroup: "eligible",
    priceAtSignal: 1.23,
    rankScore: 82,
    forwardReturnPct: { "1": 1.2, "3": 2.1, "5": 3.4 },
    ...overrides,
  };
}
