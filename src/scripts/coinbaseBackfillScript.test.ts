import { describe, expect, it, vi } from "vitest";
import { parseCoinbaseBackfillOptions } from "../../scripts/backfill-coinbase-usdc-candles-pg";

describe("Coinbase backfill script options", () => {
  it("parses symbols, symbol limit, target candles, and weekly timeframe", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    try {
      expect(
        parseCoinbaseBackfillOptions([
          "--timeframe=1w",
          "--symbols=btc-usdc,ABC-USDC",
          "--limit-symbols=5",
          "--target-candles=300",
          "--max-candles-per-request=200",
          "--concurrency=1",
        ]),
      ).toMatchObject({
        timeframe: "1w",
        symbols: ["BTC-USDC", "ABC-USDC"],
        limitSymbols: 5,
        targetCandles: 300,
        providerMaxCandlesPerRequest: 200,
        concurrency: 1,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects unsupported timeframes", () => {
    expect(() => parseCoinbaseBackfillOptions(["--timeframe=1M"])).toThrow(
      "timeframe must be one of",
    );
  });
});
