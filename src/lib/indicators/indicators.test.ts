import { describe, expect, it } from "vitest";
import type { Candle } from "@/lib/exchanges/types";
import {
  calculateBandWidth,
  calculateIndicatorSnapshot,
  calculateSma,
  calculateVolumeSnapshot,
  calculateWidthPercentile,
} from "./index";

describe("indicator calculations", () => {
  it("returns null indicator values for short candle arrays", () => {
    const snapshot = calculateIndicatorSnapshot([
      makeCandle({ index: 0, close: 100, volume: 10 }),
    ]);

    expect(snapshot.close).toBe(100);
    expect(snapshot.ma20).toBeNull();
    expect(snapshot.ma50).toBeNull();
    expect(snapshot.ma200).toBeNull();
    expect(snapshot.bollinger.upper).toBeNull();
    expect(snapshot.rsi14).toBeNull();
    expect(snapshot.volume.current).toBe(10);
    expect(snapshot.volume.ma20).toBeNull();
    expect(snapshot.volume.ratio).toBeNull();
    expect(snapshot.priceExtensionFromMA20).toBeNull();
  });

  it("calculates SMA and volume ratio deterministically", () => {
    const values = Array.from({ length: 20 }, (_, index) => index + 1);

    expect(calculateSma(values, 20)).toBe(10.5);

    const volume = calculateVolumeSnapshot(values);
    expect(volume.current).toBe(20);
    expect(volume.ma20).toBe(10.5);
    expect(volume.ratio).toBeCloseTo(20 / 10.5, 6);
  });

  it("calculates Bollinger width and percentile rank", () => {
    expect(calculateBandWidth(110, 100, 90)).toBe(0.2);
    expect(calculateBandWidth(110, 0, 90)).toBeNull();
    expect(calculateWidthPercentile([0.4, 0.3, 0.2, 0.1], 4)).toBe(25);
    expect(calculateWidthPercentile([0.1, 0.2, 0.3, 0.4], 4)).toBe(100);
  });

  it("calculates a full snapshot when enough history exists", () => {
    const candles = Array.from({ length: 220 }, (_, index) =>
      makeCandle({
        index,
        close: 100 + index * 0.1,
        volume: 1000 + index,
      }),
    );
    const snapshot = calculateIndicatorSnapshot(candles);

    expect(snapshot.ma20).not.toBeNull();
    expect(snapshot.ma50).not.toBeNull();
    expect(snapshot.ma200).not.toBeNull();
    expect(snapshot.bollinger.width).not.toBeNull();
    expect(snapshot.bollinger.widthPercentile).not.toBeNull();
    expect(snapshot.rsi14).not.toBeNull();
    expect(snapshot.volume.ratio).not.toBeNull();
    expect(snapshot.priceExtensionFromMA20).not.toBeNull();
  });
});

function makeCandle({
  index,
  close,
  volume,
}: {
  index: number;
  close: number;
  volume: number;
}): Candle {
  return {
    openTime: index * 60_000,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume,
    closeTime: index * 60_000 + 59_999,
  };
}
