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
  it("renders available behavior data", () => {
    const html = renderToStaticMarkup(
      createElement(SymbolBehaviorPanel, {
        behavior: makeBehavior(),
        diagnostics: makeDiagnostics(true),
      }),
    );

    expect(html).toContain("Behavior");
    expect(html).toContain("How similar prior ranking results behaved");
    expect(html).toContain("for this symbol and timeframe only");
    expect(html).toContain("Behavior Readout");
    expect(html).toContain("Constructive tendency");
    expect(html).toContain("Evidence Reliability");
    expect(html).toContain("Selected Horizon");
    expect(html).toContain("Horizon Agreement");
    expect(html).toContain("Historical Bias");
    expect(html).toContain(
      "Prior similar ranking results tended to show constructive follow-through",
    );
    expect(html).toContain("Sample Quality");
    expect(html).toContain("Limited sample");
    expect(html).toContain("Treat as research context while the sample grows.");
    expect(html).not.toContain("Limited but usable sample");
    expect(html).toContain("Behavior Evaluation");
    expect(html).toContain("Upside follow-through observed");
    expect(html).toContain("Same symbol / same timeframe / similar ranking context");
    expect(html).toContain("11 completed forward observations");
    expect(html).toContain("63.6% upside follow-through");
    expect(html).toContain("Sample size");
    expect(html).toContain("Forward horizon observations");
    expect(html).toContain("1 candle");
    expect(html).toContain("Avg Change");
    expect(html).toContain("+1.20%");
    expect(html).toContain("Current context");
    expect(html).toContain("Eligible");
    expect(html).toContain("Confirmed");
    expect(html).toContain("Strong Trend");
    expect(html).toContain("Recent Observations");
    expect(html).toContain("Showing 6 of 6 recent observations");
    expect(html).not.toContain(
      "Several recent observations are close together in time",
    );
  });

  it("renders unavailable diagnostics without crashing", () => {
    const html = renderToStaticMarkup(
      createElement(SymbolBehaviorPanel, {
        behavior: null,
        diagnostics: makeDiagnostics(false, "no_prior_signals", "No prior signals."),
      }),
    );

    expect(html).toContain(
      "No prior matching ranking results",
    );
    expect(html).toContain("No prior matching ranking results were found yet");
    expect(html).not.toContain("Behavior Readout");
    expect(html).not.toContain("Sample Quality");
    expect(html).toContain("Behavior Evaluation");
    expect(html).toContain(
      "Not enough completed forward candles for follow-through evaluation.",
    );
  });

  it("renders no_latest_signal coverage for insufficient history", () => {
    const html = renderToStaticMarkup(
      createElement(SymbolBehaviorPanel, {
        behavior: null,
        diagnostics: makeDiagnostics(false, "no_latest_signal"),
        coverage: { candleCount: 146, requiredCandles: 200 },
      }),
    );

    expect(html).toContain("No current latest ranking result");
    expect(html).toContain("Current coverage: 146 / 200 required candles.");
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

    expect(html).toContain("Limited sample");
    expect(html).not.toContain("Limited sample — useful as context");
    expect(html).toContain("Next 1");
    expect(html).toContain("+1.20%");
  });

  it("does not crash when available behavior has missing horizons and outcomes", () => {
    const html = renderToStaticMarkup(
      createElement(SymbolBehaviorPanel, {
        behavior: {
          sampleSize: "2",
          horizons: {},
          recentOutcomes: [
            {
              scanTime: null,
              resultGroup: null,
              signalLabel: null,
              rankScore: "bad",
              forwardReturnPct: {},
            },
          ],
        },
        diagnostics: makeDiagnostics(true),
      }),
    );

    expect(html).toContain("Sample size");
    expect(html).toContain("—");
    expect(html).toContain("Unknown");
    expect(html).toContain(
      "Not enough completed forward candles for follow-through evaluation.",
    );
  });

  it("limits visible recent outcomes and shows a count note", () => {
    const html = renderToStaticMarkup(
      createElement(SymbolBehaviorPanel, {
        behavior: makeBehavior({
          recentOutcomes: Array.from({ length: 12 }, (_, index) =>
            makeOutcome({
              scanTime: `2026-05-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
            }),
          ),
        }),
        diagnostics: makeDiagnostics(true),
      }),
    );

    expect(html).toContain("Showing 10 of 12 recent observations");
    expect(html).toContain("Show all observations (2 hidden)");
  });

  it("renders clustered recent outcomes note only when clustered observations are detected", () => {
    const html = renderToStaticMarkup(
      createElement(SymbolBehaviorPanel, {
        behavior: makeBehavior({
          sampleSize: 20,
          horizons: {
            "1": makeHorizon(20, 1.2),
            "3": makeHorizon(20, 2.2),
            "5": makeHorizon(20, 3.2),
          },
          recentOutcomes: [
            makeOutcome({ scanTime: "2026-06-01T11:38:00.000Z" }),
            makeOutcome({ scanTime: "2026-06-01T12:05:00.000Z" }),
            makeOutcome({ scanTime: "2026-06-01T12:12:00.000Z" }),
          ],
        }),
        diagnostics: makeDiagnostics(true),
      }),
    );

    expect(html).toContain("Clustered recent observations");
    expect(html).toContain(
      "Several recent observations are close together in time",
    );
    expect(html).toContain(
      "Recent observations appear clustered close together in time.",
    );
    expect(html).toContain("Behavior Evaluation");
    expect(html).not.toContain(
      "Some recent observations appear clustered and may reflect development or non-scheduled runs.",
    );
  });

  it("renders very limited 1h sample quality without repeated sample caveats", () => {
    const html = renderToStaticMarkup(
      createElement(SymbolBehaviorPanel, {
        behavior: makeBehavior({
          sampleSize: 4,
          horizons: {
            "1": makeHorizon(4, 1.2),
            "3": makeHorizon(0, 0),
            "5": makeHorizon(0, 0),
          },
          recentOutcomes: [
            makeOutcome({ scanTime: "2026-06-01T11:38:00.000Z" }),
            makeOutcome({ scanTime: "2026-06-01T12:05:00.000Z" }),
            makeOutcome({ scanTime: "2026-06-01T12:12:00.000Z" }),
          ],
          currentContext: {
            signalLabel: "confirmed",
            resultGroup: "eligible",
            primaryStructure: "strong_trend",
            timeframe: "1h",
          },
          warnings: [
            "Very limited historical sample size.",
            "Limited historical sample size.",
          ],
        }),
        diagnostics: makeDiagnostics(true),
      }),
    );

    expect(html).toContain("Insufficient sample");
    expect(html).toContain("Very limited sample");
    expect(html).toContain("Production history is still accumulating.");
    expect(html).toContain(
      "Longer-horizon observations are still incomplete.",
    );
    expect(html).toContain(
      "Clustered recent observations are close together in time.",
    );
    expect(html).toContain("Behavior Evaluation");
    expect(html).not.toContain(
      "Very limited sample: more completed forward candles are needed.",
    );
    expect(html).not.toContain("Very limited sample; treat as research context.");
    expect(html).not.toContain("Limited sample — useful as context");
    expect(countOccurrences(html, "research context")).toBeLessThanOrEqual(1);
  });

  it("renders mixed run context caveat from existing signal history metadata", () => {
    const html = renderToStaticMarkup(
      createElement(SymbolBehaviorPanel, {
        behavior: makeBehavior({
          sampleSize: 20,
          horizons: {
            "1": makeHorizon(20, 1.2),
            "3": makeHorizon(20, 2.2),
            "5": makeHorizon(20, 3.2),
          },
        }),
        diagnostics: makeDiagnostics(true),
        signalHistory: [
          {
            scanTime: "2026-06-01T12:05:00.000Z",
            isNewerThanSelectedCurrentRun: true,
            sourceRunIsLikelyFullUniverse: false,
          },
        ],
      }),
    );

    expect(html).toContain("Mixed run context");
    expect(html).toContain(
      "This sample may include non-selected or secondary runs.",
    );
  });
});

function countOccurrences(value: string, needle: string) {
  return value.split(needle).length - 1;
}

function makeDiagnostics(
  available: boolean,
  reason: SymbolBehaviorDiagnostics["reason"] = available
    ? "ok"
    : "unknown",
  message = available
    ? "Behavior is available."
    : "Behavior is not available.",
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
