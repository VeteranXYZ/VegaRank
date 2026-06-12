import { describe, expect, it } from "vitest";
import {
  buildBehaviorReadout,
  buildBehaviorSampleQuality,
  buildBehaviorSummary,
  buildHistoricalFollowThroughEvaluation,
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
    ).toContain("No prior matching ranking results were found yet");
    expect(
      getBehaviorUnavailableMessage({
        diagnostics: { available: false, reason: "no_latest_signal" },
        coverage: { candleCount: "146", requiredCandles: 200 },
      }),
    ).toContain("Current coverage: 146 / 200 required candles.");
    expect(getBehaviorUnavailableMessage()).toBe(
      "Behavior is currently unavailable for this symbol/timeframe.",
    );
  });

  it("labels behavior readout sample confidence by selected outcome-window sample", () => {
    expect(
      buildBehaviorReadout(
        makeReadoutInput({
          horizons: { "5": makeHorizon(9, 1.2) },
        }),
      ).sampleConfidenceLabel,
    ).toBe("Very limited");
    expect(
      buildBehaviorReadout(
        makeReadoutInput({
          horizons: { "5": makeHorizon(10, 1.2) },
        }),
      ).sampleConfidenceLabel,
    ).toBe("Limited");
    expect(
      buildBehaviorReadout(
        makeReadoutInput({
          horizons: { "5": makeHorizon(20, 1.2) },
        }),
      ).sampleConfidenceLabel,
    ).toBe("Moderate");
    expect(
      buildBehaviorReadout(
        makeReadoutInput({
          horizons: { "5": makeHorizon(50, 1.2) },
        }),
      ).sampleConfidenceLabel,
    ).toBe("Better");
  });

  it("prefers 5, then 3, then 1 candle horizons when usable", () => {
    expect(
      buildBehaviorReadout(
        makeReadoutInput({
          horizons: {
            "1": makeHorizon(20, 0.5),
            "3": makeHorizon(20, 1.5),
            "5": makeHorizon(20, 2.5),
          },
        }),
      ).selectedHorizon,
    ).toBe("5");
    expect(
      buildBehaviorReadout(
        makeReadoutInput({
          horizons: {
            "1": makeHorizon(20, 0.5),
            "3": makeHorizon(20, 1.5),
            "5": makeHorizon(9, 2.5),
          },
        }),
      ).selectedHorizon,
    ).toBe("3");
    expect(
      buildBehaviorReadout(
        makeReadoutInput({
          horizons: {
            "1": makeHorizon(20, 0.5),
            "3": makeHorizon(9, 1.5),
            "5": makeHorizon(9, 2.5),
          },
        }),
      ).selectedHorizon,
    ).toBe("1");
  });

  it("returns insufficient when no horizon has enough usable observations", () => {
    const readout = buildBehaviorReadout(
      makeReadoutInput({
        horizons: {
          "1": makeHorizon(9, 1.2),
          "3": makeHorizon(8, 1.4),
          "5": makeHorizon(7, 1.6),
        },
      }),
    );

    expect(readout.label).toBe("Insufficient sample");
    expect(readout.selectedHorizon).toBeNull();
    expect(readout.horizonAgreement).toBe("insufficient");
  });

  it("classifies horizon agreement as aligned positive, aligned negative, or mixed", () => {
    expect(
      buildBehaviorReadout(
        makeReadoutInput({
          horizons: {
            "1": makeHorizon(20, 0.2, 51),
            "3": makeHorizon(20, 0.3, 55),
            "5": makeHorizon(20, 0.4, 60),
          },
        }),
      ).horizonAgreement,
    ).toBe("aligned_positive");
    expect(
      buildBehaviorReadout(
        makeReadoutInput({
          horizons: {
            "1": makeHorizon(20, -0.2, 44),
            "3": makeHorizon(20, -0.3, 40),
            "5": makeHorizon(20, -0.4, 35),
          },
        }),
      ).horizonAgreement,
    ).toBe("aligned_negative");
    expect(
      buildBehaviorReadout(
        makeReadoutInput({
          horizons: {
            "1": makeHorizon(20, 0.2, 51),
            "3": makeHorizon(20, -0.3, 40),
            "5": makeHorizon(20, 0, 48),
          },
        }),
      ).horizonAgreement,
    ).toBe("mixed");
  });

  it("interprets opportunity context as constructive or weak follow-through", () => {
    expect(
      buildBehaviorReadout(
        makeReadoutInput({
          resultGroup: "eligible",
          horizons: { "5": makeHorizon(20, 1.2, 62) },
        }),
      ).label,
    ).toBe("Strong constructive tendency");
    expect(
      buildBehaviorReadout(
        makeReadoutInput({
          resultGroup: "watch",
          horizons: { "5": makeHorizon(12, -0.4, 42) },
        }),
      ).label,
    ).toBe("Weak follow-through");
  });

  it("interprets risk context as downside continuation or not confirmed", () => {
    expect(
      buildBehaviorReadout(
        makeReadoutInput({
          resultGroup: "risk",
          horizons: { "5": makeHorizon(12, -0.8, 35) },
        }),
      ).label,
    ).toBe("Downside continuation tendency");
    expect(
      buildBehaviorReadout(
        makeReadoutInput({
          resultGroup: "risk",
          horizons: { "5": makeHorizon(12, 0.1, 52) },
        }),
      ).label,
    ).toBe("Risk not confirmed in sample");
  });

  it("handles malformed numeric values without inventing a readout", () => {
    const readout = buildBehaviorReadout(
      makeReadoutInput({
        sampleSize: "bad",
        horizons: {
          "5": {
            sampleSize: "12",
            medianReturnPct: "bad",
            winRatePct: "bad",
          },
        },
      }),
    );

    expect(readout.label).toBe("Insufficient sample");
    expect(readout.historicalBiasLabel).toBe("Not enough usable horizon data");
  });

  it("labels very small behavior samples conservatively", () => {
    const quality = buildBehaviorSampleQuality({
      behavior: makeBehavior({
        sampleSize: 9,
        horizons: {
          "1": makeHorizon(9, 0.5),
          "3": makeHorizon(9, 0.6),
          "5": makeHorizon(9, 0.7),
        },
      }),
    });

    expect(quality?.sampleQualityLabel).toBe("Very limited sample");
    expect(quality?.sampleQualityTone).toBe("warning");
    expect(quality?.hasVerySmallSample).toBe(true);
    expect(quality?.hygieneSummary).toBe(
      "Production history is still accumulating.",
    );
    expect(quality?.caveats).toEqual([]);
  });

  it("labels limited behavior samples without changing the readout classification", () => {
    const quality = buildBehaviorSampleQuality({
      behavior: makeBehavior({
        sampleSize: 12,
        horizons: {
          "1": makeHorizon(12, 0.5),
          "3": makeHorizon(12, 0.6),
          "5": makeHorizon(12, 0.7),
        },
      }),
    });
    const readout = buildBehaviorReadout(
      makeReadoutInput({
        sampleSize: 12,
        horizons: { "5": makeHorizon(12, 0.7) },
      }),
    );

    expect(quality?.sampleQualityLabel).toBe("Limited sample");
    expect(quality?.hasLimitedSample).toBe(true);
    expect(quality?.hygieneSummary).toBe(
      "Treat as research context while the sample grows.",
    );
    expect(quality?.caveats).toEqual([]);
    expect(readout.label).toBe("Constructive tendency");
  });

  it("flags missing longer-horizon samples as incomplete forward candles", () => {
    const quality = buildBehaviorSampleQuality({
      behavior: makeBehavior({
        sampleSize: 20,
        horizons: {
          "1": makeHorizon(20, 0.5),
          "3": makeHorizon(0, 0),
          "5": makeHorizon(4, 0.7),
        },
      }),
    });

    expect(quality?.sampleQualityLabel).toBe(
      "Waiting for more completed forward candles",
    );
    expect(quality?.hygieneSummary).toBe(
      "Longer-horizon observations are still incomplete.",
    );
    expect(quality?.hasLimitedForwardCandles).toBe(true);
    expect(quality?.caveats).toEqual([]);
  });

  it("detects clustered recent observations from valid scan times", () => {
    const quality = buildBehaviorSampleQuality({
      behavior: makeBehavior({
        sampleSize: 20,
        horizons: {
          "1": makeHorizon(20, 0.5),
          "3": makeHorizon(20, 0.6),
          "5": makeHorizon(20, 0.7),
        },
        recentOutcomes: [
          makeOutcome("not-a-date"),
          makeOutcome("2026-06-01T11:38:00.000Z"),
          makeOutcome("2026-06-01T12:05:00.000Z"),
          makeOutcome("2026-06-01T12:12:00.000Z"),
        ],
      }),
    });

    expect(quality?.sampleQualityLabel).toBe("Clustered recent observations");
    expect(quality?.hygieneSummary).toBe(
      "Recent observations appear clustered close together in time.",
    );
    expect(quality?.hasClusteredRuns).toBe(true);
    expect(quality?.caveats).toEqual([]);
  });

  it("keeps very limited 1h sample quality copy compact with distinct caveats", () => {
    const quality = buildBehaviorSampleQuality({
      behavior: makeBehavior({
        sampleSize: 4,
        currentContext: {
          signalLabel: "confirmed",
          resultGroup: "eligible",
          primaryStructure: "strong_trend",
          timeframe: "1h",
        },
        horizons: {
          "1": makeHorizon(4, 0.5),
          "3": makeHorizon(0, 0),
          "5": makeHorizon(0, 0),
        },
        recentOutcomes: [
          makeOutcome("2026-06-01T11:38:00.000Z"),
          makeOutcome("2026-06-01T12:05:00.000Z"),
          makeOutcome("2026-06-01T12:12:00.000Z"),
        ],
      }),
    });

    expect(quality?.sampleQualityLabel).toBe("Very limited sample");
    expect(quality?.hygieneSummary).toBe(
      "Production history is still accumulating.",
    );
    expect(quality?.caveats).toEqual([
      "Clustered recent observations are close together in time.",
      "Longer-horizon observations are still incomplete.",
    ]);
  });

  it("does not crash or flag clustering for malformed or missing scan times only", () => {
    const quality = buildBehaviorSampleQuality({
      behavior: makeBehavior({
        sampleSize: 20,
        horizons: {
          "1": makeHorizon(20, 0.5),
          "3": makeHorizon(20, 0.6),
          "5": makeHorizon(20, 0.7),
        },
        recentOutcomes: [
          makeOutcome("bad"),
          makeOutcome(""),
          makeOutcome("2026-06-01T12:12:00.000Z"),
        ],
      }),
    });

    expect(quality?.sampleQualityLabel).toBe("Clean enough for context");
    expect(quality?.hasClusteredRuns).toBe(false);
  });

  it("flags non-preferred or secondary run context when exposed", () => {
    const quality = buildBehaviorSampleQuality({
      behavior: makeBehavior({
        sampleSize: 20,
        horizons: {
          "1": makeHorizon(20, 0.5),
          "3": makeHorizon(20, 0.6),
          "5": makeHorizon(20, 0.7),
        },
      }),
      signalHistory: [
        {
          scanTime: "2026-06-01T12:12:00.000Z",
          isNewerThanSelectedCurrentRun: true,
          sourceRunIsLikelyFullUniverse: false,
        },
      ],
    });

    expect(quality?.sampleQualityLabel).toBe("Mixed run context");
    expect(quality?.hygieneSummary).toBe(
      "This sample may include non-selected or secondary runs.",
    );
    expect(quality?.hasNonPreferredRuns).toBe(true);
    expect(quality?.caveats).toEqual([]);
  });

  it("does not emit sample quality for unavailable behavior", () => {
    expect(buildBehaviorSampleQuality({ behavior: null })).toBeNull();
  });

  it("evaluates risk results with negative 5-candle median as downside follow-through", () => {
    const evaluation = buildHistoricalFollowThroughEvaluation({
      behavior: makeBehavior({
        currentContext: { resultGroup: "risk", signalLabel: "breakdown_risk" },
        horizons: {
          "1": makeHorizon(16, -0.4, 40),
          "3": makeHorizon(16, -0.9, 30),
          "5": makeHorizon(16, -1.39, 25),
        },
      }),
      diagnostics: { available: true, reason: "ok" },
    });

    expect(evaluation.available).toBe(true);
    expect(evaluation.posture).toBe("Downside follow-through observed");
    expect(evaluation.selectedHorizonLabel).toBe("5 candles");
    expect(evaluation.sampleLabel).toBe("16 completed forward observations");
    expect(evaluation.directionMatchLabel).toBe("75.0% downside follow-through");
    expect(evaluation.medianReturnLabel).toBe("-1.39% median follow-through");
    expect(evaluation.positiveRateLabel).toBe("25.0% positive follow-through");
  });

  it("does not support downside follow-through when risk median is positive", () => {
    const evaluation = buildHistoricalFollowThroughEvaluation({
      behavior: makeBehavior({
        currentContext: { resultGroup: "risk", signalLabel: "failed_breakdown" },
        horizons: { "5": makeHorizon(12, 0.8, 58) },
      }),
      diagnostics: { available: true, reason: "ok" },
    });

    expect(evaluation.posture).toBe(
      "Risk result did not show downside follow-through in this sample",
    );
    expect(evaluation.interpretation).toContain(
      "did not show downside follow-through",
    );
  });

  it("evaluates eligible signals with positive median as upside follow-through", () => {
    const evaluation = buildHistoricalFollowThroughEvaluation({
      behavior: makeBehavior({
        currentContext: { resultGroup: "eligible", signalLabel: "confirmed" },
        horizons: { "5": makeHorizon(22, 1.4, 63) },
      }),
      diagnostics: { available: true, reason: "ok" },
    });

    expect(evaluation.posture).toBe("Upside follow-through observed");
    expect(evaluation.directionMatchLabel).toBe("63.0% upside follow-through");
    expect(evaluation.sampleConfidenceLabel).toBe("Moderate sample");
  });

  it("uses conservative watchlist follow-through wording", () => {
    const evaluation = buildHistoricalFollowThroughEvaluation({
      behavior: makeBehavior({
        currentContext: { resultGroup: "watch", signalLabel: "developing" },
        horizons: { "5": makeHorizon(14, 0.2, 51) },
      }),
      diagnostics: { available: true, reason: "ok" },
    });

    expect(evaluation.posture).toBe("Watchlist follow-through is constructive");
    expect(evaluation.interpretation).toContain("confirmation is still needed");
  });

  it("uses overheated pullback and cooling wording", () => {
    const cooling = buildHistoricalFollowThroughEvaluation({
      behavior: makeBehavior({
        currentContext: { resultGroup: "overheated", signalLabel: "extended" },
        horizons: { "5": makeHorizon(18, -0.6, 38) },
      }),
      diagnostics: { available: true, reason: "ok" },
    });
    const continued = buildHistoricalFollowThroughEvaluation({
      behavior: makeBehavior({
        currentContext: { resultGroup: "overheated", signalLabel: "extended" },
        horizons: { "5": makeHorizon(18, 1.1, 70) },
      }),
      diagnostics: { available: true, reason: "ok" },
    });

    expect(cooling.posture).toBe("Pullback / cooling behavior observed");
    expect(cooling.directionMatchLabel).toBe("62.0% pullback / cooling behavior");
    expect(continued.posture).toBe(
      "Overheated results continued higher in this sample",
    );
    expect(continued.interpretation).toContain(
      "does not remove overextension risk",
    );
    expect(continued.interpretation).not.toMatch(/\bgood\b/i);
  });

  it("shows mixed historical follow-through for neutral context", () => {
    const evaluation = buildHistoricalFollowThroughEvaluation({
      behavior: makeBehavior({
        currentContext: { resultGroup: "neutral", signalLabel: "neutral" },
        horizons: { "5": makeHorizon(20, 0.9, 62) },
      }),
      diagnostics: { available: true, reason: "ok" },
    });

    expect(evaluation.posture).toBe("Mixed historical follow-through");
    expect(evaluation.directionMatchLabel).toBe("Mixed historical match");
  });

  it("renders unavailable evaluation when horizons lack completed samples", () => {
    const sampleQuality = buildBehaviorSampleQuality({
      behavior: makeBehavior({
        sampleSize: 4,
        horizons: {
          "1": makeHorizon(4, 0.2, 50),
          "3": makeHorizon(0, 0),
          "5": makeHorizon(0, 0),
        },
      }),
    });
    const evaluation = buildHistoricalFollowThroughEvaluation({
      behavior: makeBehavior({
        sampleSize: 4,
        horizons: {
          "1": makeHorizon(4, 0.2, 50),
          "3": makeHorizon(0, 0),
          "5": makeHorizon(0, 0),
        },
      }),
      diagnostics: { available: true, reason: "insufficient_sample" },
      sampleQuality,
    });

    expect(evaluation.available).toBe(false);
    expect(evaluation.interpretation).toBe(
      "Not enough completed forward candles for follow-through evaluation.",
    );
    expect(evaluation.caveats).toContain(
      "Production history is still accumulating.",
    );
  });

  it("adds conservative caveats for very limited 1h production history", () => {
    const behavior = makeBehavior({
      sampleSize: 5,
      currentContext: {
        resultGroup: "eligible",
        signalLabel: "confirmed",
        timeframe: "1h",
      },
      horizons: {
        "1": makeHorizon(5, 0.4, 60),
        "3": makeHorizon(0, 0),
        "5": makeHorizon(0, 0),
      },
    });
    const evaluation = buildHistoricalFollowThroughEvaluation({
      behavior,
      diagnostics: { available: true, reason: "ok" },
      sampleQuality: buildBehaviorSampleQuality({ behavior }),
    });

    expect(evaluation.available).toBe(true);
    expect(evaluation.selectedHorizonLabel).toBe("1 candle");
    expect(evaluation.caveats).toEqual(
      expect.arrayContaining([
        "Very limited completed observations.",
        "Production history is still accumulating.",
        "Only the 1-candle horizon is usable; avoid over-weighting it.",
      ]),
    );
  });

  it("handles malformed follow-through numeric fields without crashing", () => {
    const evaluation = buildHistoricalFollowThroughEvaluation({
      behavior: makeBehavior({
        horizons: {
          "5": {
            sampleSize: "7",
            medianReturnPct: "bad",
            winRatePct: "bad",
          },
        },
      }),
      diagnostics: { available: true, reason: "ok" },
    });

    expect(evaluation.available).toBe(false);
    expect(evaluation.directionMatchLabel).toBe("Not available");
  });

  it("handles missing behavior in follow-through evaluation", () => {
    const evaluation = buildHistoricalFollowThroughEvaluation({
      behavior: null,
      diagnostics: { available: false, reason: "no_prior_signals" },
    });

    expect(evaluation.available).toBe(false);
    expect(evaluation.posture).toBe("Insufficient completed forward candles");
  });
});

function makeBehavior(overrides: Partial<SymbolBehavior> = {}): SymbolBehavior {
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
    ...overrides,
  };
}

function makeHorizon(
  sampleSize: number,
  avgReturnPct: number,
  winRatePct = 60,
) {
  return {
    sampleSize,
    avgReturnPct,
    medianReturnPct: avgReturnPct,
    winRatePct,
    bestReturnPct: 5,
    worstReturnPct: -2,
  };
}

function makeReadoutInput(
  overrides: Partial<SymbolBehavior> & {
    resultGroup?: string | null;
    currentGroup?: string | null;
    signalLabel?: string | null;
  } = {},
) {
  return {
    resultGroup: "eligible",
    signalLabel: "confirmed",
    sampleSize: 30,
    horizons: {
      "1": makeHorizon(20, 0.5),
      "3": makeHorizon(20, 1),
      "5": makeHorizon(20, 1.5),
    },
    warnings: [],
    ...overrides,
  };
}

function makeOutcome(
  scanTime: string,
  overrides: Partial<SymbolBehaviorRecentOutcome> = {},
): SymbolBehaviorRecentOutcome {
  return {
    scanTime,
    signalLabel: "confirmed",
    resultGroup: "eligible",
    priceAtSignal: 1,
    rankScore: 10,
    forwardReturnPct: { "1": 1, "3": 2, "5": 3 },
    ...overrides,
  };
}
