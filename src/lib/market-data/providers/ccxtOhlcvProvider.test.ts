import { describe, expect, it, vi } from "vitest";
import { runCcxtAuditCli } from "../../../../scripts/audit-ccxt-ohlcv";
import {
  auditCcxtOhlcv,
  normalizeSymbolToCcxt,
  type CcxtClientLike,
  type CcxtOhlcvRow,
} from "./ccxtOhlcvProvider";

describe("provider-neutral CCXT OHLCV audit provider", () => {
  it("normalizes Binance joined symbols to CCXT symbols", () => {
    expect(normalizeSymbolToCcxt("BTCUSDT")).toBe("BTC/USDT");
    expect(normalizeSymbolToCcxt("ETHUSDT")).toBe("ETH/USDT");
  });

  it("normalizes Coinbase dashed symbols to CCXT symbols", () => {
    expect(normalizeSymbolToCcxt("AERO-USDC")).toBe("AERO/USDC");
    expect(normalizeSymbolToCcxt("CLANKER-USDC")).toBe("CLANKER/USDC");
  });

  it("uses native 4h when CCXT reports support", async () => {
    const fetchOHLCV = vi.fn(async () => [
      [1_700_000_000_000, 1, 3, 0.5, 2, 100] satisfies CcxtOhlcvRow,
    ]);
    const client = makeClient({
      timeframes: { "1h": "1h", "4h": "4h", "1d": "1d" },
      fetchOHLCV,
    });

    const result = await auditCcxtOhlcv(client, {
      exchange: "binance",
      symbol: "BTCUSDT",
      timeframe: "4h",
      limit: 300,
    });

    expect(fetchOHLCV).toHaveBeenCalledWith("BTC/USDT", "4h", undefined, 300, {});
    expect(result).toMatchObject({
      provider: "ccxt",
      exchange: "binance",
      originalSymbol: "BTCUSDT",
      ccxtSymbol: "BTC/USDT",
      timeframe: "4h",
      nativeTimeframeSupported: true,
      derived: false,
      fetchedCandles: 1,
      generatedCandles: 0,
      scannerEligible: false,
    });
  });

  it("returns unsupported_timeframe when native 4h is unavailable", async () => {
    const fetchOHLCV = vi.fn(async () => []);
    const client = makeClient({
      timeframes: { "1h": "1h", "1d": "1d" },
      fetchOHLCV,
    });

    const result = await auditCcxtOhlcv(client, {
      exchange: "coinbase",
      symbol: "AERO-USDC",
      timeframe: "4h",
      limit: 300,
    });

    expect(fetchOHLCV).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      timeframe: "4h",
      nativeTimeframeSupported: false,
      derived: false,
      unsupportedReason: "unsupported_timeframe",
      fetchedCandles: 0,
      scannerEligible: false,
    });
  });

  it("uses native 1w when CCXT reports support", async () => {
    const fetchOHLCV = vi.fn(async () => makeWeeklyRows(Date.UTC(2025, 0, 6), 2));
    const client = makeClient({
      timeframes: { "1d": "1d", "1w": "1w" },
      fetchOHLCV,
    });

    const result = await auditCcxtOhlcv(client, {
      exchange: "binance",
      symbol: "BTCUSDT",
      timeframe: "1w",
      limit: 300,
    });

    expect(fetchOHLCV).toHaveBeenCalledWith("BTC/USDT", "1w", undefined, 300, {});
    expect(result).toMatchObject({
      timeframe: "1w",
      nativeTimeframeSupported: true,
      derived: false,
      fetchedCandles: 2,
      generatedCandles: 0,
    });
  });

  it("derives 1w from 1d when native 1w is unavailable", async () => {
    const fetchOHLCV = vi.fn(async () => makeDailyRows(Date.UTC(2025, 0, 6), 14));
    const client = makeClient({
      timeframes: { "1d": "1d" },
      fetchOHLCV,
    });

    const result = await auditCcxtOhlcv(client, {
      exchange: "coinbase",
      symbol: "AERO-USDC",
      timeframe: "1w",
      limit: 10,
      nowMs: Date.UTC(2025, 1, 1),
    });

    expect(fetchOHLCV).toHaveBeenCalledWith("AERO/USDC", "1d", undefined, 77, {});
    expect(result).toMatchObject({
      provider: "ccxt",
      sourceTimeframe: "1d",
      timeframe: "1w",
      derived: true,
      derivationMethod: "daily_to_weekly_utc",
      nativeTimeframeSupported: false,
      fetchedCandles: 14,
      generatedCandles: 2,
      enoughForVegaRank200: false,
    });
    expect(result.derivationDiagnostics).toMatchObject({
      sourceDailyCandles: 14,
      generatedWeeklyCandles: 2,
      completeWeeks: 2,
      incompleteWeeksDropped: 0,
      missingDailyWeeksDropped: 0,
      enoughForVegaRank200: false,
    });
  });

  it("drops the incomplete current week by default", async () => {
    const fetchOHLCV = vi.fn(async () => [
      ...makeDailyRows(Date.UTC(2026, 0, 5), 7),
      ...makeDailyRows(Date.UTC(2026, 0, 19), 3),
    ]);
    const client = makeClient({
      timeframes: { "1d": "1d" },
      fetchOHLCV,
    });

    const result = await auditCcxtOhlcv(client, {
      exchange: "coinbase",
      symbol: "CLANKER-USDC",
      timeframe: "1w",
      limit: 10,
      nowMs: Date.UTC(2026, 0, 21),
    });

    expect(result.generatedCandles).toBe(1);
    expect(result.derivationDiagnostics).toMatchObject({
      completeWeeks: 1,
      incompleteWeeksDropped: 1,
      missingDailyWeeksDropped: 0,
    });
    expect(result.candles.map((candle) => candle.openTime)).toEqual([
      Date.UTC(2026, 0, 5),
    ]);
  });

  it("drops a past week when a daily candle is missing", async () => {
    const weekWithMissingDay = makeDailyRows(Date.UTC(2026, 0, 5), 7).filter(
      (row) => row[0] !== Date.UTC(2026, 0, 8),
    );
    const fetchOHLCV = vi.fn(async () => [
      ...weekWithMissingDay,
      ...makeDailyRows(Date.UTC(2026, 0, 12), 7),
    ]);
    const client = makeClient({
      timeframes: { "1d": "1d" },
      fetchOHLCV,
    });

    const result = await auditCcxtOhlcv(client, {
      exchange: "coinbase",
      symbol: "AERO-USDC",
      timeframe: "1w",
      limit: 10,
      nowMs: Date.UTC(2026, 1, 1),
    });

    expect(result.generatedCandles).toBe(1);
    expect(result.derivationDiagnostics).toMatchObject({
      completeWeeks: 1,
      incompleteWeeksDropped: 0,
      missingDailyWeeksDropped: 1,
      gapCount: 1,
    });
    expect(result.candles[0]?.openTime).toBe(Date.UTC(2026, 0, 12));
  });

  it("derives weekly OHLCV values from complete UTC Monday weeks", async () => {
    const fetchOHLCV = vi.fn(async () =>
      makeDailyRows(Date.UTC(2026, 0, 5), 7, {
        openStart: 10,
        highStart: 20,
        lowStart: 5,
        closeStart: 15,
        volumeStart: 100,
      }),
    );
    const client = makeClient({
      timeframes: { "1d": "1d" },
      fetchOHLCV,
    });

    const result = await auditCcxtOhlcv(client, {
      exchange: "coinbase",
      symbol: "AERO-USDC",
      timeframe: "1w",
      limit: 10,
      nowMs: Date.UTC(2026, 1, 1),
    });

    expect(result.candles[0]).toEqual({
      openTime: Date.UTC(2026, 0, 5),
      open: 10,
      high: 26,
      low: 5,
      close: 21,
      volume: 721,
      closeTime: Date.UTC(2026, 0, 12) - 1,
    });
  });

  it("marks scanner eligibility false when derived weekly candles are insufficient", async () => {
    const fetchOHLCV = vi.fn(async () => makeDailyRows(Date.UTC(2026, 0, 5), 14));
    const client = makeClient({
      timeframes: { "1d": "1d" },
      fetchOHLCV,
    });

    const result = await auditCcxtOhlcv(client, {
      exchange: "coinbase",
      symbol: "AERO-USDC",
      timeframe: "1w",
      limit: 300,
      nowMs: Date.UTC(2026, 1, 1),
    });

    expect(result.generatedCandles).toBe(2);
    expect(result.enoughForVegaRank200).toBe(false);
    expect(result.scannerEligible).toBe(false);
    expect(result.derivationDiagnostics?.enoughForVegaRank200).toBe(false);
  });

  it("does not derive 4h from 1h when native 4h is unavailable", async () => {
    const fetchOHLCV = vi.fn(async () => makeDailyRows(Date.UTC(2026, 0, 5), 10));
    const client = makeClient({
      timeframes: { "1h": "1h", "1d": "1d" },
      fetchOHLCV,
    });

    const result = await auditCcxtOhlcv(client, {
      exchange: "coinbase",
      symbol: "AERO-USDC",
      timeframe: "4h",
      limit: 300,
    });

    expect(fetchOHLCV).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      unsupportedReason: "unsupported_timeframe",
      derived: false,
      generatedCandles: 0,
    });
  });

  it("emits compact read-only CLI JSON without candle rows", async () => {
    const messages: unknown[] = [];
    const client = makeClient({
      fetchOHLCV: vi.fn(async () => [
        [1_700_000_000_000, 1, 3, 0.5, 2, 100] satisfies CcxtOhlcvRow,
      ]),
    });

    await runCcxtAuditCli(
      [
        "--exchange=coinbase",
        "--symbols=AERO-USDC",
        "--timeframes=1h",
        "--limit=300",
        "--json",
      ],
      { log: (message) => messages.push(message) },
      client,
    );

    const parsed = JSON.parse(String(messages[0]));
    expect(parsed).toMatchObject({
      provider: "ccxt",
      readOnly: true,
      noDatabaseWrites: true,
      exchange: "coinbase",
      results: [
        {
          exchange: "coinbase",
          originalSymbol: "AERO-USDC",
          ccxtSymbol: "AERO/USDC",
          timeframe: "1h",
          nativeTimeframeSupported: true,
          derived: false,
          fetchedCandles: 1,
          generatedCandles: 0,
          enoughForVegaRank200: false,
        },
      ],
    });
    expect(parsed.results[0]).not.toHaveProperty("candles");
  });
});

function makeClient(overrides: Partial<CcxtClientLike> = {}): CcxtClientLike {
  return {
    has: { fetchOHLCV: true },
    timeframes: { "1h": "1h", "4h": "4h", "1d": "1d", "1w": "1w" },
    fetchOHLCV: vi.fn(async () => []),
    ...overrides,
  };
}

function makeDailyRows(
  startMs: number,
  count: number,
  values: {
    openStart?: number;
    highStart?: number;
    lowStart?: number;
    closeStart?: number;
    volumeStart?: number;
  } = {},
): CcxtOhlcvRow[] {
  const dayMs = 24 * 60 * 60 * 1000;
  const openStart = values.openStart ?? 10;
  const highStart = values.highStart ?? 20;
  const lowStart = values.lowStart ?? 5;
  const closeStart = values.closeStart ?? 15;
  const volumeStart = values.volumeStart ?? 100;

  return Array.from({ length: count }, (_, index) => [
    startMs + index * dayMs,
    openStart + index,
    highStart + index,
    lowStart + index,
    closeStart + index,
    volumeStart + index,
  ]);
}

function makeWeeklyRows(startMs: number, count: number): CcxtOhlcvRow[] {
  const weekMs = 7 * 24 * 60 * 60 * 1000;

  return Array.from({ length: count }, (_, index) => [
    startMs + index * weekMs,
    10 + index,
    20 + index,
    5 + index,
    15 + index,
    100 + index,
  ]);
}
