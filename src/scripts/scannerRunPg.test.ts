import { describe, expect, it, vi } from "vitest";
import type { Candle } from "@/lib/exchanges/types";
import { scanCandles } from "@/lib/ranking-engine/scanCandles";
import { selectSignalCandleOpenTimeMs } from "../../scripts/scanner-run-pg";

describe("scanner-run-pg signal anchors", () => {
  it("preserves a manually supplied Coinbase exchange in scan output", () => {
    const candles = Array.from({ length: 220 }, (_, index) =>
      makeCandle({
        openTime: index * 1000,
        closeTime: index * 1000 + 999,
        close: 100 + index * 0.1,
      }),
    );

    const result = scanCandles("ABC-USDC", "4h", candles, {
      exchange: "coinbase",
    });

    expect(result.exchange).toBe("coinbase");
    expect(result.codeContract?.exchange).toBe("coinbase");
    expect(result.symbol).toBe("ABC-USDC");
  });

  it("keeps Binance as the default scan output exchange", () => {
    const candles = Array.from({ length: 220 }, (_, index) =>
      makeCandle({
        openTime: index * 1000,
        closeTime: index * 1000 + 999,
        close: 100 + index * 0.1,
      }),
    );

    const result = scanCandles("BTCUSDT", "4h", candles);

    expect(result.exchange).toBe("binance");
    expect(result.codeContract?.exchange).toBe("binance");
  });

  it("uses the actual last closed candle open time when the latest candle is still open", () => {
    vi.useFakeTimers();
    vi.setSystemTime(200_000);

    try {
      const result = scanCandles("BTCUSDT", "4h", [
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
      ]);

      expect(selectSignalCandleOpenTimeMs(result)).toBe(199_000);
      expect(result.price).toBeCloseTo(119.9, 6);
    } finally {
      vi.useRealTimers();
    }
  });
});

function makeCandle(overrides: Partial<Candle> = {}): Candle {
  return {
    openTime: overrides.openTime ?? 0,
    closeTime: overrides.closeTime ?? 999,
    open: overrides.open ?? overrides.close ?? 100,
    high: overrides.high ?? overrides.close ?? 100,
    low: overrides.low ?? overrides.close ?? 100,
    close: overrides.close ?? 100,
    volume: overrides.volume ?? 1000,
  };
}
