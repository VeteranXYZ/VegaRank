import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { loadSymbolBehaviorPg } from "./symbolBehaviorPg";

describe("loadSymbolBehaviorPg", () => {
  it("computes forward return statistics and groups by result group and signal label", async () => {
    const queries: string[] = [];
    const paramsList: unknown[][] = [];
    const result = await loadSymbolBehaviorPg(
      makePool((sql, params) => {
        queries.push(sql);
        paramsList.push(params);

        return {
          rows: [
            makeBehaviorRow({
              id: "signal-eligible",
              price_at_signal: "100",
              signal_label: "confirmed",
              action_bias: "eligible",
              primary_structure: "strong_trend",
              rank_score: "80",
              forward_candles: [
                { close: 110, high: 115, low: 95 },
                { close: 120, high: 125, low: 90 },
                { close: 130, high: 135, low: 85 },
                { close: 140, high: 145, low: 80 },
                { close: 150, high: 155, low: 75 },
              ],
            }),
            makeBehaviorRow({
              id: "signal-risk",
              price_at_signal: "200",
              signal_label: "breakdown_risk",
              action_bias: "avoid",
              primary_structure: "trend_breakdown",
              rank_score: "-20",
              forward_candles: [
                { close: 190, high: 205, low: 185 },
                { close: 180, high: 200, low: 175 },
                { close: 170, high: 195, low: 165 },
                { close: 160, high: 190, low: 155 },
                { close: 150, high: 185, low: 145 },
              ],
            }),
          ],
        };
      }),
      {
        exchange: "binance",
        market: "spot",
        symbol: "seiusdt",
        timeframe: "4h",
        currentSignal: {
          id: "current-signal",
          signalLabel: "confirmed",
          actionBias: "eligible",
          primaryStructure: "strong_trend",
          rankScore: 82,
          detectedRiskTypes: [],
        },
      },
    );

    expect(result).toMatchObject({
      timeframe: "4h",
      symbol: "SEIUSDT",
      sampleSize: 2,
      eligibleSampleSize: 2,
      currentContext: {
        currentSignalLabel: "confirmed",
        currentResultGroup: "eligible",
        matchingGroupSampleSize: 1,
        matchingSignalSampleSize: 1,
      },
    });
    expect(result.horizons[0]).toMatchObject({
      candles: 1,
      sampleSize: 2,
      averageReturnPct: 2.5,
      medianReturnPct: 2.5,
      winRatePct: 50,
      averageMaxUpsidePct: 8.75,
      averageMaxDrawdownPct: -6.25,
      bestReturnPct: 10,
      worstReturnPct: -5,
    });
    expect(result.horizons[2]).toMatchObject({
      candles: 5,
      sampleSize: 2,
      averageReturnPct: 12.5,
      medianReturnPct: 12.5,
      winRatePct: 50,
      bestReturnPct: 50,
      worstReturnPct: -25,
    });
    expect(result.byGroup.map((row) => row.group).sort()).toEqual([
      "eligible",
      "risk",
    ]);
    expect(result.bySignalLabel.map((row) => row.signalLabel).sort()).toEqual([
      "breakdown_risk",
      "confirmed",
    ]);
    expect(result.recentOutcomes[0]).toMatchObject({
      signalLabel: "confirmed",
      resultGroup: "eligible",
      forwardReturnsPct: { next1: 10, next3: 30, next5: 50 },
      maxUpsidePct: { next1: 15, next3: 35, next5: 55 },
      maxDrawdownPct: { next1: -5, next3: -15, next5: -25 },
      hasEnoughForwardCandles: true,
    });
    expect(result.warnings).toEqual(["Very limited historical sample size."]);
    expect(paramsList[0]).toEqual([
      "binance",
      "spot",
      "SEIUSDT",
      "4h",
      "current-signal",
      "crypto",
      150,
    ]);
    expect(queries[0]).toContain("sr.status = 'success'");
    expect(queries[0]).toContain("ss.id <> $5");
    expect(queries[0]).toContain("LIMIT $7");
  });

  it("handles missing forward candles with null horizon values and warnings", async () => {
    const result = await loadSymbolBehaviorPg(
      makePool(() => ({
        rows: [
          makeBehaviorRow({
            id: "signal-partial",
            price_at_signal: "100",
            forward_candles: [{ close: 101, high: 103, low: 99 }],
          }),
        ],
      })),
      {
        exchange: "binance",
        market: "spot",
        symbol: "SEIUSDT",
        timeframe: "4h",
      },
    );

    expect(result.sampleSize).toBe(1);
    expect(result.eligibleSampleSize).toBe(0);
    expect(result.horizons[0]).toMatchObject({
      candles: 1,
      sampleSize: 1,
      averageReturnPct: 1,
      medianReturnPct: 1,
    });
    expect(result.horizons[1]).toMatchObject({
      candles: 3,
      sampleSize: 0,
      averageReturnPct: null,
      medianReturnPct: null,
      winRatePct: null,
    });
    expect(result.recentOutcomes[0]).toMatchObject({
      forwardReturnsPct: { next1: 1, next3: null, next5: null },
      hasEnoughForwardCandles: false,
    });
    expect(result.warnings).toEqual([
      "Not enough forward candles for reliable outcome statistics.",
      "Very limited historical sample size.",
    ]);
  });

  it("returns an empty behavior payload when there are no historical signals", async () => {
    const result = await loadSymbolBehaviorPg(
      makePool(() => ({ rows: [] })),
      {
        exchange: "binance",
        market: "spot",
        symbol: "SEIUSDT",
        timeframe: "1w",
      },
    );

    expect(result).toMatchObject({
      timeframe: "1w",
      symbol: "SEIUSDT",
      sampleSize: 0,
      eligibleSampleSize: 0,
      byGroup: [],
      bySignalLabel: [],
      recentOutcomes: [],
      warnings: [
        "Not enough historical behavior data yet.",
        "Not enough forward candles for reliable outcome statistics.",
        "Very limited historical sample size.",
      ],
    });
    expect(result.horizons).toHaveLength(3);
    expect(result.horizons.every((row) => row.sampleSize === 0)).toBe(true);
  });
});

function makePool(
  query: (sql: string, params: unknown[]) => { rows: unknown[] },
): Pool {
  return {
    query: (sql: string, params: unknown[] = []) =>
      Promise.resolve(query(sql, params)),
    end: () => Promise.resolve(),
  } as unknown as Pool;
}

function makeBehaviorRow(overrides: Partial<Record<string, unknown>>) {
  return {
    id: overrides.id ?? "signal-1",
    scan_run_id: "run-1",
    scan_time: overrides.scan_time ?? "2026-05-31T00:00:01.000Z",
    candle_open_time:
      overrides.candle_open_time ?? "2026-05-30T20:00:00.000Z",
    price_at_signal: overrides.price_at_signal ?? "100",
    rank_score: overrides.rank_score ?? "25",
    risk_score: overrides.risk_score ?? "10",
    signal_label: overrides.signal_label ?? "watch",
    action_bias: overrides.action_bias ?? "watch_only",
    primary_structure: overrides.primary_structure ?? "base_building",
    detected_risk_types: overrides.detected_risk_types ?? [],
    anchor_open_time:
      overrides.anchor_open_time ?? "2026-05-30T20:00:00.000Z",
    anchor_close: overrides.anchor_close ?? "100",
    forward_candles: overrides.forward_candles ?? [],
  };
}
