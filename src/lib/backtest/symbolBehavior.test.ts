import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Candle } from "@/lib/exchanges/types";
import { reviewHistoricalBehavior } from "./symbolBehavior";
import type { ScanResult } from "@/lib/shared/scannerTypes";

const scanCandlesMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/scanner/scanCandles", () => ({
  scanCandles: scanCandlesMock,
  getClosedCandles: (candles: Candle[], now = Date.now()) => {
    const latest = candles.at(-1);
    return latest && latest.closeTime > now ? candles.slice(0, -1) : candles;
  },
}));

describe("symbol historical behavior review", () => {
  beforeEach(() => {
    scanCandlesMock.mockReset();
  });

  it("uses closed candles and returns noSamples when no historical setup matches", () => {
    const candles = makeCandles(270);
    candles.push({ ...candles.at(-1)!, openTime: Date.now(), closeTime: Date.now() + 1_000 });
    scanCandlesMock.mockImplementation((_symbol: string, _timeframe: string, slice: Candle[]) =>
      makeScan({
        phase: slice.length === 270 ? "BREAKOUT_ATTEMPT" : "SQUEEZE",
        signalState: "WATCHLIST",
      }),
    );

    const result = reviewHistoricalBehavior({
      symbol: "BTCUSDT",
      timeframe: "4h",
      limit: 1000,
      matchMode: "standard",
      candles,
    });

    expect(scanCandlesMock).toHaveBeenCalledWith("BTCUSDT", "4h", candles.slice(0, -1));
    expect(result.sampleCount).toBe(0);
    expect(result.sampleQuality).toBe("none");
    expect(result.summaryKey).toBe("backtest.summary.noSamples");
  });

  it("calculates forward return, median, win rate, MFE, and MAE", () => {
    const candles = makeCandles(270);
    scanCandlesMock.mockImplementation((_symbol: string, _timeframe: string, slice: Candle[]) =>
      makeScan({
        phase: "BREAKOUT_ATTEMPT",
        signalState: slice.length === 252 ? "NEUTRAL" : "WATCHLIST",
      }),
    );

    const result = reviewHistoricalBehavior({
      symbol: "BTCUSDT",
      timeframe: "4h",
      limit: 1000,
      matchMode: "standard",
      candles,
    });
    const one = result.horizons.find((horizon) => horizon.candles === 1)!;

    expect(result.sampleCount).toBe(10);
    expect(result.sampleQuality).toBe("medium");
    expect(one.sampleCount).toBe(10);
    expect(one.averageReturnPct).toBe(0.28);
    expect(one.medianReturnPct).toBe(0.28);
    expect(one.winRatePct).toBe(100);
    expect(one.averageMfePct).toBe(0.56);
    expect(one.averageMaePct).toBe(-0.28);
    expect(one.bestReturnPct).toBe(0.29);
    expect(one.worstReturnPct).toBe(0.28);
  });

  it("supports broad, standard, and similar match modes", () => {
    const candles = makeCandles(270);
    scanCandlesMock.mockImplementation((_symbol: string, _timeframe: string, slice: Candle[]) =>
      makeScan({
        phase: "BREAKOUT_ATTEMPT",
        signalState: slice.length % 2 === 0 ? "NEUTRAL" : "WATCHLIST",
      }),
    );

    const broad = reviewHistoricalBehavior({
      symbol: "BTCUSDT",
      timeframe: "4h",
      limit: 1000,
      matchMode: "broad",
      candles,
    });
    const standard = reviewHistoricalBehavior({
      symbol: "BTCUSDT",
      timeframe: "4h",
      limit: 1000,
      matchMode: "standard",
      candles,
    });
    const similar = reviewHistoricalBehavior({
      symbol: "BTCUSDT",
      timeframe: "4h",
      limit: 1000,
      matchMode: "similar",
      candles,
    });

    expect(broad.sampleCount).toBeGreaterThan(standard.sampleCount);
    expect(standard.sampleCount).toBeGreaterThan(0);
    expect(similar.matchMode).toBe("similar");
  });
});

function makeCandles(count: number): Candle[] {
  return Array.from({ length: count }, (_, index) => {
    const close = 100 + index;

    return {
      openTime: index * 1000,
      open: close - 0.5,
      high: close + 1,
      low: close - 2,
      close,
      volume: 1000,
      closeTime: index * 1000 + 999,
    };
  });
}

function makeScan({
  phase,
  signalState,
}: {
  phase: ScanResult["phase"];
  signalState: ScanResult["signal"]["state"];
}): ScanResult {
  return {
    exchange: "binance",
    symbol: "BTCUSDT",
    timeframe: "4h",
    price: 100,
    phase,
    signal: { state: signalState, label: signalState, summary: signalState },
    opportunityScore: 70,
    confirmationScore: 80,
    riskScore: 10,
    rankScore: 65,
    rsi14: 55,
    bbWidthPercentile: 15,
    volumeRatio: 1.2,
    volume: {
      latest: 1000,
      ma20: 1000,
      ma50: 1000,
      ratio20: 1.2,
      ratio50: 1.1,
      dryUp: false,
      expanding: false,
      abnormalSpike: false,
      breakoutConfirmed: false,
      pullbackHealthy: false,
      distributionWarning: false,
      quietCompression: false,
    },
    macd: {
      line: 1,
      signal: 0.8,
      histogram: 0.2,
      histogramRising: true,
      bullishCross: false,
      bearishCross: false,
      aboveZero: true,
    },
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
