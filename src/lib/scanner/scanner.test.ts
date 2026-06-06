import { describe, expect, it, vi } from "vitest";
import type { Candle, Timeframe } from "@/lib/exchanges/types";
import type { IndicatorSnapshot } from "@/lib/indicators";
import { determineMarketPhase } from "./marketPhase";
import { getNextConfirmation } from "./explanations";
import {
  calculateMultiTimeframeRankScore,
  summarizeMultiTimeframe,
} from "./multiTimeframe";
import { getRiskWarnings } from "./riskFilters";
import { scanCandles } from "./scanCandles";
import { calculateScannerScores, clampScore } from "./scoring";
import { deriveScannerSignal } from "./signal";
import type { MarketPhase, ScannerSignalState, ScanResult } from "./types";
import { getVolumeAnalysis } from "./volumeAnalysis";

describe("scanner phase classification", () => {
  it("classifies squeeze when width is low and averages converge", () => {
    expect(
      determineMarketPhase(
        makeSnapshot({
          close: 100,
          ma20: 100,
          ma50: 101,
          ma200: 95,
          bbMiddle: 100,
          bbUpper: 105,
          widthPercentile: 10,
          rsi14: 50,
          volumeRatio: 0.9,
        }),
        [makeCandle()],
      ),
    ).toBe("SQUEEZE");
  });

  it("classifies confirmed breakout before trending", () => {
    expect(
      determineMarketPhase(
        makeSnapshot({
          close: 112,
          ma20: 105,
          ma50: 100,
          ma200: 90,
          bbMiddle: 100,
          bbUpper: 110,
          widthPercentile: 40,
          rsi14: 64,
          volumeRatio: 1.8,
        }),
        [makeCandle()],
      ),
    ).toBe("BREAKOUT_CONFIRMED");
  });

  it("classifies overextended before confirmed breakout when RSI is high", () => {
    expect(
      determineMarketPhase(
        makeSnapshot({
          close: 120,
          ma20: 108,
          ma50: 100,
          ma200: 90,
          bbMiddle: 100,
          bbUpper: 115,
          widthPercentile: 80,
          rsi14: 78,
          volumeRatio: 2,
          priceExtensionFromMA20: 0.11,
        }),
        [makeCandle()],
      ),
    ).toBe("OVEREXTENDED");
  });

  it("classifies breakdown when price is below trend averages with weak RSI", () => {
    expect(
      determineMarketPhase(
        makeSnapshot({
          close: 80,
          ma20: 85,
          ma50: 90,
          ma200: 100,
          bbMiddle: 88,
          bbUpper: 95,
          widthPercentile: 70,
          rsi14: 38,
          volumeRatio: 1.4,
        }),
        [makeCandle()],
      ),
    ).toBe("BREAKDOWN");
  });
});

describe("scanner scoring", () => {
  it("preserves unclamped score values", () => {
    expect(clampScore(-20)).toBe(-20);
    expect(clampScore(120)).toBe(120);
    expect(clampScore(55)).toBe(55);
  });

  it("calculates component and rank scores from scanner inputs", () => {
    const scores = calculateScannerScores({
      snapshot: makeSnapshot({
        close: 100,
        ma20: 100,
        ma50: 99,
        ma200: 90,
        bbMiddle: 100,
        bbUpper: 110,
        widthPercentile: 10,
        rsi14: 55,
        volumeRatio: 0.9,
      }),
      sufficientHistory: true,
    });

    expect(scores.opportunityScore).toBeGreaterThan(0);
    expect(scores.confirmationScore).toBeGreaterThan(0);
    expect(scores.riskScore).toBeLessThanOrEqual(0);
    expect(scores.rankScore).toBe(scores.finalSignalScore);
    expect(scores.trendScore).toBeGreaterThan(0);
  });

  it("demotes high-risk phases in risk and rank scores", () => {
    const baseSnapshot = makeSnapshot({
      close: 120,
      ma20: 108,
      ma50: 100,
      ma200: 90,
      bbMiddle: 100,
      bbUpper: 115,
      widthPercentile: 80,
      rsi14: 65,
      volumeRatio: 2,
      priceExtensionFromMA20: 0.11,
    });
    const neutralScores = calculateScannerScores({
      snapshot: baseSnapshot,
      sufficientHistory: true,
    });
    const overextendedScores = calculateScannerScores({
      snapshot: baseSnapshot,
      sufficientHistory: true,
      phase: "OVEREXTENDED",
    });

    expect(overextendedScores.riskScore).toBeGreaterThan(neutralScores.riskScore);
    expect(overextendedScores.rankScore).toBeLessThan(neutralScores.rankScore);
  });

  it("lets MACD improve confirmation score modestly", () => {
    const baseSnapshot = makeSnapshot({
      close: 112,
      ma20: 105,
      ma50: 100,
      ma200: 90,
      bbMiddle: 100,
      bbUpper: 110,
      widthPercentile: 40,
      rsi14: 64,
      volumeRatio: 1.4,
    });
    const macdSnapshot = makeSnapshot({
      close: 112,
      ma20: 105,
      ma50: 100,
      ma200: 90,
      bbMiddle: 100,
      bbUpper: 110,
      widthPercentile: 40,
      rsi14: 64,
      volumeRatio: 1.4,
      macd: {
        line: 1.2,
        signal: 1,
        histogram: 0.2,
        histogramRising: true,
        bullishCross: true,
        bearishCross: false,
        aboveZero: true,
      },
    });

    const baseScores = calculateScannerScores({
      snapshot: baseSnapshot,
      sufficientHistory: true,
      phase: "BREAKOUT_ATTEMPT",
    });
    const macdScores = calculateScannerScores({
      snapshot: macdSnapshot,
      sufficientHistory: true,
      phase: "BREAKOUT_ATTEMPT",
    });

    expect(macdScores.confirmationScore).toBeGreaterThan(
      baseScores.confirmationScore,
    );
    expect(macdScores.confirmationScore - baseScores.confirmationScore).toBe(25);
  });

  it("caps opportunity score for breakdown compression structures", () => {
    const scores = calculateScannerScores({
      snapshot: makeSnapshot({
        close: 80,
        ma20: 82,
        ma50: 90,
        ma200: 100,
        bbMiddle: 80,
        bbUpper: 84,
        widthPercentile: 10,
        rsi14: 42,
        volumeRatio: 0.9,
      }),
      sufficientHistory: true,
      phase: "BREAKDOWN",
    });

    expect(scores.opportunityScore).toBeLessThanOrEqual(40);
    expect(scores.rankScore).toBeLessThan(20);
  });

  it("caps opportunity score below both MA50 and MA200 without recovery confirmation", () => {
    const scores = calculateScannerScores({
      snapshot: makeSnapshot({
        close: 80,
        ma20: 80,
        ma50: 90,
        ma200: 100,
        bbMiddle: 80,
        bbUpper: 84,
        widthPercentile: 10,
        rsi14: 50,
        volumeRatio: 0.9,
      }),
      sufficientHistory: true,
      phase: "SQUEEZE",
    });

    expect(scores.opportunityScore).toBeLessThanOrEqual(50);
  });

  it("caps setup-only opportunity when confirmation is very low", () => {
    const scores = calculateScannerScores({
      snapshot: makeSnapshot({
        close: 100,
        ma20: 100,
        ma50: 101,
        ma200: null,
        bbMiddle: 100,
        bbUpper: 105,
        widthPercentile: 10,
        rsi14: 50,
        volumeRatio: 0.9,
      }),
      sufficientHistory: true,
      phase: "SQUEEZE",
    });

    expect(scores.confirmationScore).toBeLessThan(20);
    expect(scores.opportunityScore).toBeGreaterThan(0);
  });

  it("treats squeeze volume dry-up as setup opportunity, not confirmation", () => {
    const scores = calculateScannerScores({
      snapshot: makeSnapshot({
        close: 100,
        ma20: 100,
        ma50: 99,
        ma200: 95,
        bbMiddle: 100,
        bbUpper: 105,
        widthPercentile: 10,
        rsi14: 50,
        volumeRatio: 0.5,
      }),
      sufficientHistory: true,
      phase: "SQUEEZE",
      volume: makeVolume({
        ratio20: 0.5,
        dryUp: true,
        quietCompression: true,
      }),
    });

    expect(scores.opportunityScore).toBeGreaterThanOrEqual(80);
    expect(scores.confirmationScore).toBeGreaterThan(0);
  });

  it("rewards breakout volume expansion as confirmation", () => {
    const baseSnapshot = makeSnapshot({
      close: 112,
      ma20: 105,
      ma50: 100,
      ma200: 90,
      bbMiddle: 100,
      bbUpper: 110,
      widthPercentile: 40,
      rsi14: 64,
      volumeRatio: 1,
    });
    const weakScores = calculateScannerScores({
      snapshot: baseSnapshot,
      sufficientHistory: true,
      phase: "BREAKOUT_ATTEMPT",
      volume: makeVolume({ ratio20: 1 }),
    });
    const confirmedScores = calculateScannerScores({
      snapshot: makeSnapshot({
        close: 112,
        ma20: 105,
        ma50: 100,
        ma200: 90,
        bbMiddle: 100,
        bbUpper: 110,
        widthPercentile: 40,
        rsi14: 64,
        volumeRatio: 1.8,
      }),
      sufficientHistory: true,
      phase: "BREAKOUT_ATTEMPT",
      volume: makeVolume({
        ratio20: 1.8,
        expanding: true,
        breakoutConfirmed: true,
      }),
    });

    expect(confirmedScores.confirmationScore).toBeGreaterThan(
      weakScores.confirmationScore,
    );
  });

  it("raises risk and lowers rank for overextended abnormal volume spikes", () => {
    const snapshot = makeSnapshot({
      close: 113,
      ma20: 104,
      ma50: 100,
      ma200: 90,
      bbMiddle: 104,
      bbUpper: 112,
      widthPercentile: 80,
      rsi14: 70,
      volumeRatio: 3.2,
      priceExtensionFromMA20: 0.086,
    });
    const baseScores = calculateScannerScores({
      snapshot,
      sufficientHistory: true,
      phase: "OVEREXTENDED",
      volume: makeVolume({ ratio20: 1 }),
    });
    const spikeScores = calculateScannerScores({
      snapshot,
      sufficientHistory: true,
      phase: "OVEREXTENDED",
      volume: makeVolume({
        ratio20: 3.2,
        expanding: true,
        abnormalSpike: true,
      }),
    });

    expect(spikeScores.riskScore).toBeGreaterThan(baseScores.riskScore);
    expect(spikeScores.rankScore).toBeLessThan(baseScores.rankScore);
  });

  it("raises risk for high-volume breakdowns", () => {
    const snapshot = makeSnapshot({
      close: 80,
      ma20: 82,
      ma50: 90,
      ma200: 100,
      bbMiddle: 80,
      bbUpper: 84,
      widthPercentile: 25,
      rsi14: 38,
      volumeRatio: 1.8,
    });
    const normalScores = calculateScannerScores({
      snapshot,
      sufficientHistory: true,
      phase: "BREAKDOWN",
      volume: makeVolume({ ratio20: 1 }),
    });
    const highVolumeScores = calculateScannerScores({
      snapshot,
      sufficientHistory: true,
      phase: "BREAKDOWN",
      volume: makeVolume({ ratio20: 1.8, expanding: true }),
    });

    expect(highVolumeScores.riskScore).toBeGreaterThan(normalScores.riskScore);
  });
});

describe("explainable scanner fixtures", () => {
  it("Case A: classifies a strong trend with overheated risk", () => {
    const scores = calculateScannerScores({
      snapshot: makeSnapshot({
        close: 125,
        ma20: 110,
        ma50: 100,
        ma200: 90,
        bbMiddle: 100,
        bbUpper: 125,
        widthPercentile: 98,
        rsi14: 78,
        volumeRatio: 3.2,
        priceExtensionFromMA20: 0.136,
        macd: improvingMacd(),
      }),
      sufficientHistory: true,
      phase: "OVEREXTENDED",
      volume: makeVolume({ ratio20: 3.2, expanding: true, abnormalSpike: true }),
      candles: [makeCandle({ open: 118, high: 126, low: 116, close: 125 })],
    });

    expect(scores.trendScore).toBeGreaterThan(100);
    expect(scores.riskScore).toBeGreaterThan(70);
    expect(scores.signalLabel).toBe("overheated");
    expect(scores.actionBias).toBe("do_not_chase");
    expect(scores.detectedRiskTypes).toContain("overheat_risk");
    expect(scores.signalLabel).not.toBe("confirmed");
  });

  it("Case B: classifies weak bounce and distribution risk", () => {
    const scores = calculateScannerScores({
      snapshot: makeSnapshot({
        close: 87,
        ma20: 86,
        ma50: 100,
        ma200: 110,
        bbMiddle: 70,
        bbUpper: 90,
        widthPercentile: 89,
        rsi14: 44,
        volumeRatio: 3.2,
        macd: weakeningMacd(),
      }),
      sufficientHistory: true,
      volume: makeVolume({ ratio20: 3.2, expanding: true, abnormalSpike: true }),
      candles: [makeCandle({ open: 86, high: 95, low: 84, close: 87 })],
    });

    expect(["weak_bounce", "distribution_risk"]).toContain(scores.signalLabel);
    expect(["avoid", "watch_only"]).toContain(scores.actionBias);
    expect(scores.riskScore).toBeGreaterThan(70);
    expect(scores.confirmationScore).toBeLessThan(0);
    expect(scores.detectedRiskTypes).toContain("weak_bounce_risk");
    expect(scores.detectedRiskTypes).toContain("distribution_risk");
  });

  it("Case C: classifies a watch candidate near MA50", () => {
    const scores = calculateScannerScores({
      snapshot: makeSnapshot({
        close: 100,
        ma20: 98,
        ma50: 102,
        ma200: 90,
        bbMiddle: 95,
        bbUpper: 105,
        widthPercentile: 50,
        rsi14: 52,
        volumeRatio: 1.3,
        macd: improvingMacd(),
      }),
      sufficientHistory: true,
      volume: makeVolume({ ratio20: 1.3, expanding: false }),
      candles: [makeCandle({ open: 98, high: 101, low: 96, close: 100 })],
    });

    expect(scores.signalLabel).toBe("watch");
    expect(scores.actionBias).toBe("watch_only");
    expect(scores.opportunityScore).toBeGreaterThan(0);
    expect(scores.confirmationScore).toBeGreaterThan(0);
    expect(scores.riskScore).toBeLessThan(70);
    expect(scores.nextConfirmationObservations).toContainEqual({
      key: "confirmation.reclaimMa50",
      severity: "neutral",
      scope: "confirmation",
    });
  });

  it("Case D: classifies a confirmed trend", () => {
    const scores = calculateScannerScores({
      snapshot: makeSnapshot({
        close: 110,
        ma20: 105,
        ma50: 100,
        ma200: 90,
        bbMiddle: 100,
        bbUpper: 115,
        widthPercentile: 65,
        rsi14: 58,
        volumeRatio: 1.4,
        macd: improvingMacd(),
      }),
      sufficientHistory: true,
      volume: makeVolume({ ratio20: 1.4, expanding: false }),
      candles: [makeCandle({ open: 106, high: 111, low: 104, close: 110 })],
    });

    expect(scores.signalLabel).toBe("confirmed");
    expect(scores.actionBias).toBe("eligible");
    expect(scores.confirmationScore).toBeGreaterThan(60);
    expect(scores.trendScore).toBeGreaterThan(0);
    expect(scores.riskScore).toBeLessThan(70);
    expect(scores.detectedRiskTypes).toHaveLength(0);
  });

  it("Case E: classifies breakdown risk", () => {
    const scores = calculateScannerScores({
      snapshot: makeSnapshot({
        close: 95,
        ma20: 100,
        ma50: 101,
        ma200: 90,
        bbMiddle: 100,
        bbUpper: 110,
        widthPercentile: 55,
        rsi14: 42,
        volumeRatio: 2,
        macd: weakeningMacd(),
      }),
      sufficientHistory: true,
      phase: "BREAKDOWN",
      volume: makeVolume({ ratio20: 2, expanding: true }),
      candles: [
        makeCandle({ open: 99, high: 101, low: 98, close: 100 }),
        makeCandle({ open: 100, high: 101, low: 94, close: 95 }),
      ],
    });

    expect(scores.signalLabel).toBe("breakdown_risk");
    expect(scores.actionBias).toBe("avoid");
    expect(scores.detectedRiskTypes).toContain("trend_breakdown_risk");
    expect(scores.riskScore).toBeGreaterThan(70);
    expect(scores.confirmationScore).toBeLessThan(0);
  });

  it("Case F: classifies a neutral mixed setup", () => {
    const scores = calculateScannerScores({
      snapshot: makeSnapshot({
        close: 100,
        ma20: 100,
        ma50: 99,
        ma200: 101,
        bbMiddle: 100,
        bbUpper: 110,
        widthPercentile: 50,
        rsi14: 50,
        volumeRatio: 1,
        macd: flatMacd(),
      }),
      sufficientHistory: true,
      volume: makeVolume({ ratio20: 1 }),
      candles: [makeCandle({ open: 99, high: 101, low: 98, close: 100 })],
    });

    expect(scores.signalLabel).toBe("neutral");
    expect(scores.actionBias).toBe("ignore");
    expect(Math.abs(scores.finalSignalScore)).toBeLessThan(50);
    expect(scores.detectedRiskTypes).toHaveLength(0);
  });
});

describe("scanner candle quality", () => {
  it("removes the currently open candle before scanner calculations", () => {
    vi.useFakeTimers();
    vi.setSystemTime(200_000);

    try {
      const candles = [
        ...Array.from({ length: 200 }, (_, index) =>
          makeCandle({
            openTime: index * 1000,
            closeTime: index * 1000 + 999,
            close: 100 + index * 0.1,
          }),
        ),
        makeCandle({
          openTime: 200_000,
          closeTime: 300_000,
          close: 250,
        }),
      ];
      const result = scanCandles("BTCUSDT", "4h", candles);

      expect(result.price).toBeCloseTo(119.9, 6);
      expect(result.dataQuality.candleCount).toBe(200);
      expect(result.dataQuality.usesClosedCandles).toBe(true);
      expect(result.dataQuality.lastClosedCandleOpenTime).toBe(199_000);
      expect(result.dataQuality.lastClosedCandleCloseTime).toBe(199_999);
      expect(result.dataQuality.lastClosedCandleTime).toBe(199_999);
      expect(result.macd?.line).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("scanner volume analysis", () => {
  it("detects breakout volume confirmation", () => {
    const volume = getVolumeAnalysis({
      phase: "BREAKOUT_ATTEMPT",
      snapshot: makeSnapshot({
        close: 112,
        ma20: 105,
        ma50: 100,
        ma200: 90,
        bbMiddle: 100,
        bbUpper: 110,
        widthPercentile: 40,
        rsi14: 64,
        volumeRatio: 1.8,
      }),
      candles: [makeCandle({ close: 112, volume: 1800 })],
    });

    expect(volume.expanding).toBe(true);
    expect(volume.breakoutConfirmed).toBe(true);
  });

  it("detects healthy pullback volume contraction", () => {
    const volume = getVolumeAnalysis({
      phase: "PULLBACK_HEALTHY",
      snapshot: makeSnapshot({
        close: 101,
        ma20: 100,
        ma50: 98,
        ma200: 90,
        bbMiddle: 100,
        bbUpper: 110,
        widthPercentile: 45,
        rsi14: 52,
        volumeRatio: 0.8,
      }),
      candles: [makeCandle({ open: 100, close: 101, high: 102, low: 99 })],
    });

    expect(volume.pullbackHealthy).toBe(true);
    expect(volume.distributionWarning).toBe(false);
  });

  it("detects distribution-like volume near extension", () => {
    const volume = getVolumeAnalysis({
      phase: "OVEREXTENDED",
      snapshot: makeSnapshot({
        close: 113,
        ma20: 104,
        ma50: 100,
        ma200: 90,
        bbMiddle: 104,
        bbUpper: 114,
        widthPercentile: 70,
        rsi14: 78,
        volumeRatio: 2,
        priceExtensionFromMA20: 0.09,
      }),
      candles: [makeCandle({ open: 116, close: 113, high: 120, low: 112 })],
    });

    expect(volume.distributionWarning).toBe(true);
  });
});

describe("scanner MACD warnings", () => {
  it("warns when price is extended but MACD momentum is weakening", () => {
    const warnings = getRiskWarnings({
      phase: "BREAKOUT_ATTEMPT",
      snapshot: makeSnapshot({
        close: 112,
        ma20: 105,
        ma50: 100,
        ma200: 90,
        bbMiddle: 100,
        bbUpper: 110,
        widthPercentile: 40,
        rsi14: 64,
        volumeRatio: 1.4,
        macd: {
          line: 1,
          signal: 0.8,
          histogram: 0.2,
          histogramRising: false,
          bullishCross: false,
          bearishCross: false,
          aboveZero: true,
        },
      }),
      candles: [makeCandle()],
      sufficientHistory: true,
    });

    expect(warnings).toContainEqual({
      key: "warning.macdMomentumWeakening",
    });
  });

  it("warns on MACD bearish cross during a constructive structure", () => {
    const warnings = getRiskWarnings({
      phase: "TRENDING",
      snapshot: makeSnapshot({
        close: 105,
        ma20: 102,
        ma50: 100,
        ma200: 90,
        bbMiddle: 102,
        bbUpper: 110,
        widthPercentile: 40,
        rsi14: 60,
        volumeRatio: 1.2,
        macd: {
          line: 0.8,
          signal: 1,
          histogram: -0.2,
          histogramRising: false,
          bullishCross: false,
          bearishCross: true,
          aboveZero: true,
        },
      }),
      candles: [makeCandle()],
      sufficientHistory: true,
    });

    expect(warnings).toContainEqual({
      key: "warning.macdBearishCross",
    });
  });
});

describe("scanner volume warnings", () => {
  it("warns when a breakout lacks volume confirmation", () => {
    const warnings = getRiskWarnings({
      phase: "BREAKOUT_ATTEMPT",
      snapshot: makeSnapshot({
        close: 112,
        ma20: 105,
        ma50: 100,
        ma200: 90,
        bbMiddle: 100,
        bbUpper: 110,
        widthPercentile: 40,
        rsi14: 64,
        volumeRatio: 0.8,
      }),
      volume: makeVolume({ ratio20: 0.8 }),
      candles: [makeCandle({ close: 112 })],
      sufficientHistory: true,
    });

    expect(warnings).toContainEqual({ key: "warning.breakoutWithoutVolume" });
  });

  it("warns on distribution-like volume", () => {
    const warnings = getRiskWarnings({
      phase: "OVEREXTENDED",
      snapshot: makeSnapshot({
        close: 113,
        ma20: 104,
        ma50: 100,
        ma200: 90,
        bbMiddle: 104,
        bbUpper: 114,
        widthPercentile: 70,
        rsi14: 78,
        volumeRatio: 2,
        priceExtensionFromMA20: 0.09,
      }),
      volume: makeVolume({
        ratio20: 2,
        expanding: true,
        distributionWarning: true,
      }),
      candles: [makeCandle({ open: 116, close: 113, high: 120, low: 112 })],
      sufficientHistory: true,
    });

    expect(warnings).toContainEqual({ key: "warning.distributionVolume" });
  });
});

describe("scanner signal labels", () => {
  it("prioritizes high-risk states", () => {
    expect(
      deriveScannerSignal({
        phase: "OVEREXTENDED",
        opportunityScore: 90,
        confirmationScore: 90,
        riskScore: 40,
      }).state,
    ).toBe("HIGH_RISK");
  });

  it("labels confirmed breakouts when confirmation is strong and risk is contained", () => {
    expect(
      deriveScannerSignal({
        phase: "BREAKOUT_CONFIRMED",
        opportunityScore: 35,
        confirmationScore: 95,
        riskScore: 20,
      }).state,
    ).toBe("CONFIRMED");
  });

  it("labels compression setups as watchlist items before confirmation", () => {
    expect(
      deriveScannerSignal({
        phase: "SQUEEZE",
        opportunityScore: 85,
        confirmationScore: 20,
        riskScore: 10,
      }).state,
    ).toBe("WATCHLIST");
  });

  it("labels breakdowns as weak even when risk score is high", () => {
    expect(
      deriveScannerSignal({
        phase: "BREAKDOWN",
        opportunityScore: 5,
        confirmationScore: 0,
        riskScore: 80,
      }).state,
    ).toBe("WEAK");
  });

  it("does not label high-confirmation breakout attempts as neutral", () => {
    const signal = deriveScannerSignal({
      phase: "BREAKOUT_ATTEMPT",
      opportunityScore: 55,
      confirmationScore: 100,
      riskScore: 0,
      rankScore: 70,
    });

    expect(signal.state).toBe("WATCHLIST");
    expect(signal.summary).toBe(
      "Breakout attempt has volume and momentum confirmation, but follow-through is still needed.",
    );
  });

  it("labels confirmed breakouts with strong confirmation and low risk as confirmed", () => {
    expect(
      deriveScannerSignal({
        phase: "BREAKOUT_CONFIRMED",
        opportunityScore: 35,
        confirmationScore: 85,
        riskScore: 20,
        rankScore: 60,
      }).state,
    ).toBe("CONFIRMED");
  });
});

describe("scanner explanations", () => {
  it("returns structured keys with dynamic params instead of UI copy", () => {
    expect(
      getNextConfirmation({
        phase: "SQUEEZE",
        snapshot: makeSnapshot({
          close: 100,
          ma20: 100,
          ma50: 101,
          ma200: 95,
          bbMiddle: 100,
          bbUpper: 105,
          widthPercentile: 10,
          rsi14: 50,
          volumeRatio: 0.9,
        }),
        sufficientHistory: true,
        timeframe: "4h",
      }),
    ).toContainEqual({
      key: "confirmation.closeAboveUpperBollinger",
      params: { timeframe: "4h" },
    });
  });
});

describe("multi-timeframe alignment", () => {
  it("classifies 4H and 1D constructive structure as strong alignment", () => {
    const summary = summarizeMultiTimeframe([
      makeScanResult("4h", "TREND_CONTINUATION", "TRENDING"),
      makeScanResult("1d", "TREND_CONTINUATION", "TRENDING"),
      makeScanResult("1w", "NEUTRAL", "BASE_BUILDING"),
      makeScanResult("1M", "NEUTRAL", "BASE_BUILDING"),
    ]);

    expect(summary.alignment).toBe("STRONG_ALIGNMENT");
    expect(summary.constructiveCount).toBe(2);
    expect(summary.riskCount).toBe(0);
  });

  it("classifies multiple higher-timeframe risks as high risk", () => {
    const summary = summarizeMultiTimeframe([
      makeScanResult("4h", "TREND_CONTINUATION", "TRENDING"),
      makeScanResult("1d", "WEAK", "BREAKDOWN"),
      makeScanResult("1w", "HIGH_RISK", "OVEREXTENDED"),
      makeScanResult("1M", "NEUTRAL", "BASE_BUILDING"),
    ]);

    expect(summary.alignment).toBe("HIGH_RISK");
    expect(summary.riskCount).toBe(2);
  });

  it("scores strong multi-timeframe alignment above mixed structures", () => {
    const strongResults = [
      makeScanResult("4h", "TREND_CONTINUATION", "TRENDING"),
      makeScanResult("1d", "TREND_CONTINUATION", "TRENDING"),
      makeScanResult("1w", "NEUTRAL", "BASE_BUILDING"),
    ];
    const mixedResults = [
      makeScanResult("4h", "NEUTRAL", "BASE_BUILDING"),
      makeScanResult("1d", "NEUTRAL", "BASE_BUILDING"),
      makeScanResult("1w", "NEUTRAL", "BASE_BUILDING"),
    ];

    expect(
      calculateMultiTimeframeRankScore(
        strongResults,
        summarizeMultiTimeframe(strongResults),
      ),
    ).toBeGreaterThan(
      calculateMultiTimeframeRankScore(
        mixedResults,
        summarizeMultiTimeframe(mixedResults),
      ),
    );
  });
});

function improvingMacd(): IndicatorSnapshot["macd"] {
  return {
    line: 1.2,
    signal: 1,
    histogram: 0.2,
    histogramRising: true,
    bullishCross: false,
    bearishCross: false,
    aboveZero: true,
  };
}

function weakeningMacd(): IndicatorSnapshot["macd"] {
  return {
    line: 0.8,
    signal: 1,
    histogram: -0.2,
    histogramRising: false,
    bullishCross: false,
    bearishCross: false,
    aboveZero: false,
  };
}

function flatMacd(): IndicatorSnapshot["macd"] {
  return {
    line: 1,
    signal: 0.98,
    histogram: 0.02,
    histogramRising: false,
    bullishCross: false,
    bearishCross: false,
    aboveZero: true,
  };
}

function makeSnapshot({
  close,
  ma20,
  ma50,
  ma200,
  bbMiddle,
  bbUpper,
  widthPercentile,
  rsi14,
  volumeRatio,
  priceExtensionFromMA20 = ma20 ? (close - ma20) / ma20 : null,
  macd = {
    line: null,
    signal: null,
    histogram: null,
    histogramRising: false,
    bullishCross: false,
    bearishCross: false,
    aboveZero: false,
  },
}: {
  close: number;
  ma20: number | null;
  ma50: number | null;
  ma200: number | null;
  bbMiddle: number | null;
  bbUpper: number | null;
  widthPercentile: number | null;
  rsi14: number | null;
  volumeRatio: number | null;
  priceExtensionFromMA20?: number | null;
  macd?: IndicatorSnapshot["macd"];
}): IndicatorSnapshot {
  return {
    close,
    ma20,
    ma50,
    ma200,
    bollinger: {
      upper: bbUpper,
      middle: bbMiddle,
      lower:
        bbMiddle !== null && bbUpper !== null
          ? bbMiddle - (bbUpper - bbMiddle)
          : null,
      width:
        bbMiddle !== null && bbUpper !== null
          ? ((bbUpper - bbMiddle) * 2) / bbMiddle
          : null,
      widthPercentile,
    },
    rsi14,
    volume: {
      current: 1000,
      latest: 1000,
      ma20: volumeRatio === null ? null : 1000 / volumeRatio,
      ma50: volumeRatio === null ? null : 1000 / volumeRatio,
      ratio: volumeRatio,
      ratio20: volumeRatio,
      ratio50: volumeRatio,
      quoteVolumeLatest: 100_000,
      quoteVolumeMA20: 100_000,
      dryUp: volumeRatio !== null && volumeRatio < 0.6,
      expanding: volumeRatio !== null && volumeRatio >= 1.5,
      abnormalSpike: volumeRatio !== null && volumeRatio >= 3,
    },
    macd,
    priceExtensionFromMA20,
  };
}

function makeCandle(overrides: Partial<Candle> = {}): Candle {
  return {
    openTime: 0,
    open: 100,
    high: 105,
    low: 95,
    close: 100,
    volume: 1000,
    closeTime: 59_999,
    ...overrides,
  };
}

function makeScanResult(
  timeframe: Timeframe,
  signalState: ScannerSignalState,
  phase: MarketPhase,
): ScanResult {
  return {
    exchange: "binance",
    symbol: "BTCUSDT",
    timeframe,
    price: 100,
    phase,
    signal: {
      state: signalState,
      label: signalState,
      summary: signalState,
    },
    opportunityScore: 50,
    confirmationScore: 50,
    riskScore: signalState === "HIGH_RISK" || signalState === "WEAK" ? 60 : 0,
    trendScore: 100,
    momentumScore: 45,
    volumeScore: 15,
    structureScore: 75,
    finalSignalScore: 50,
    rankScore: 50,
    signalLabel: "trend",
    actionBias: "watch_only",
    primaryStructure: "strong_trend",
    secondaryStructures: [],
    detectedRiskTypes: [],
    bullishObservations: [],
    bearishObservations: [],
    riskObservations: [],
    neutralObservations: [],
    nextConfirmationObservations: [],
    invalidationObservations: [],
    rawMetrics: {
      price: 100,
      rsi: 55,
      bbPercent: 55,
      volumeRatio: 1,
      macdState: "improving",
      closeAboveMA20: true,
      closeAboveMA50: true,
      closeAboveMA200: true,
      ma20AboveMA50: true,
      ma50AboveMA200: true,
    },
    rsi14: 55,
    bbPercent: 55,
    bbWidthPercentile: 20,
    volumeRatio: 1,
    volume: makeVolume(),
    maStatus: {
      aboveMA20: true,
      aboveMA50: true,
      aboveMA200: true,
      ma20AboveMA50: true,
      ma50AboveMA200: true,
    },
    reasons: [],
    warnings: [],
    nextConfirmation: [],
    invalidation: [],
    dataQuality: {
      candleCount: 300,
      sufficientHistory: true,
      missingIndicators: [],
    },
  };
}

function makeVolume(overrides: Partial<ScanResult["volume"]> = {}) {
  return {
    latest: 1000,
    ma20: 1000,
    ma50: 1000,
    ratio20: 1,
    ratio50: 1,
    quoteVolumeLatest: 100_000,
    quoteVolumeMA20: 100_000,
    dryUp: false,
    expanding: false,
    abnormalSpike: false,
    breakoutConfirmed: false,
    pullbackHealthy: false,
    distributionWarning: false,
    quietCompression: false,
    ...overrides,
  };
}
