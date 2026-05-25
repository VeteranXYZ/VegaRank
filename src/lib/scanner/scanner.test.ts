import { describe, expect, it } from "vitest";
import type { Candle, Timeframe } from "@/lib/exchanges/types";
import type { IndicatorSnapshot } from "@/lib/indicators";
import { determineMarketPhase } from "./marketPhase";
import {
  calculateMultiTimeframeRankScore,
  summarizeMultiTimeframe,
} from "./multiTimeframe";
import { calculateScannerScores, clampScore } from "./scoring";
import { deriveScannerSignal } from "./signal";
import type { MarketPhase, ScannerSignalState, ScanResult } from "./types";

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
  it("clamps scores to the 0-100 range", () => {
    expect(clampScore(-20)).toBe(0);
    expect(clampScore(120)).toBe(100);
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

    expect(scores.opportunityScore).toBe(100);
    expect(scores.confirmationScore).toBe(50);
    expect(scores.riskScore).toBe(0);
    expect(scores.rankScore).toBeCloseTo(62.5, 6);
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
});

describe("multi-timeframe alignment", () => {
  it("classifies 4H and 1D constructive structure as strong alignment", () => {
    const summary = summarizeMultiTimeframe([
      makeScanResult("1h", "WATCHLIST", "SQUEEZE"),
      makeScanResult("4h", "TREND_CONTINUATION", "TRENDING"),
      makeScanResult("1d", "TREND_CONTINUATION", "TRENDING"),
      makeScanResult("7d", "NEUTRAL", "BASE_BUILDING"),
      makeScanResult("1m", "NEUTRAL", "BASE_BUILDING"),
    ]);

    expect(summary.alignment).toBe("STRONG_ALIGNMENT");
    expect(summary.constructiveCount).toBe(3);
    expect(summary.riskCount).toBe(0);
  });

  it("classifies multiple higher-timeframe risks as high risk", () => {
    const summary = summarizeMultiTimeframe([
      makeScanResult("1h", "WATCHLIST", "SQUEEZE"),
      makeScanResult("4h", "TREND_CONTINUATION", "TRENDING"),
      makeScanResult("1d", "WEAK", "BREAKDOWN"),
      makeScanResult("7d", "HIGH_RISK", "OVEREXTENDED"),
      makeScanResult("1m", "NEUTRAL", "BASE_BUILDING"),
    ]);

    expect(summary.alignment).toBe("HIGH_RISK");
    expect(summary.riskCount).toBe(2);
  });

  it("scores strong multi-timeframe alignment above mixed structures", () => {
    const strongResults = [
      makeScanResult("4h", "TREND_CONTINUATION", "TRENDING"),
      makeScanResult("1d", "TREND_CONTINUATION", "TRENDING"),
      makeScanResult("7d", "NEUTRAL", "BASE_BUILDING"),
    ];
    const mixedResults = [
      makeScanResult("4h", "NEUTRAL", "BASE_BUILDING"),
      makeScanResult("1d", "NEUTRAL", "BASE_BUILDING"),
      makeScanResult("7d", "NEUTRAL", "BASE_BUILDING"),
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
      ma20: volumeRatio === null ? null : 1000 / volumeRatio,
      ratio: volumeRatio,
    },
    priceExtensionFromMA20,
  };
}

function makeCandle(): Candle {
  return {
    openTime: 0,
    open: 100,
    high: 105,
    low: 95,
    close: 100,
    volume: 1000,
    closeTime: 59_999,
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
    rankScore: 50,
    rsi14: 55,
    bbWidthPercentile: 20,
    volumeRatio: 1,
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
