import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { loadSignalEvaluationPg } from "./signalEvaluationPg";

describe("loadSignalEvaluationPg", () => {
  it("calculates forward returns and down-direction match for risk signals", async () => {
    const queries: string[] = [];
    const paramsList: unknown[][] = [];
    const result = await loadSignalEvaluationPg(
      makePool((sql, params) => {
        queries.push(sql);
        paramsList.push(params);

        return {
          rows: [
            makeEvaluationRow({
              id: "risk-1",
              price_at_signal: "100",
              signal_label: "breakdown_risk",
              action_bias: "avoid",
              primary_structure: "trend_breakdown",
              forward_candles: [
                { close: 90 },
                { close: 80 },
                { close: 70 },
                { close: 60 },
                { close: 50 },
                { close: 40 },
                { close: 30 },
                { close: 20 },
                { close: 10 },
                { close: 5 },
              ],
            }),
            makeEvaluationRow({
              id: "risk-2",
              price_at_signal: "100",
              signal_label: "breakdown_risk",
              action_bias: "avoid",
              primary_structure: "trend_breakdown",
              forward_candles: [
                { close: 105 },
                { close: 100 },
                { close: 90 },
                { close: 80 },
                { close: 70 },
                { close: 60 },
                { close: 50 },
                { close: 40 },
                { close: 30 },
                { close: 20 },
              ],
            }),
          ],
        };
      }),
      {
        exchange: "binance",
        market: "spot",
        timeframe: "4h",
        group: "risk",
        signalLabel: "breakdown_risk",
        horizons: [1, 3, 5, 10],
        minSamples: 2,
        limit: 500,
      },
    );

    expect(result).toMatchObject({
      ok: true,
      expectedDirection: "down",
      sample: {
        sourceSignals: 2,
        completedSignals: 2,
        skippedSignals: 0,
        sampleQuality: "limited",
        warnings: ["limited_sample"],
      },
    });
    expect(result.horizons["1"]).toMatchObject({
      sampleSize: 2,
      avgReturnPct: -2.5,
      medianReturnPct: -2.5,
      positiveRatePct: 50,
      directionMatchRatePct: 50,
      bestReturnPct: 5,
      worstReturnPct: -10,
    });
    expect(result.horizons["5"]).toMatchObject({
      sampleSize: 2,
      avgReturnPct: -40,
      medianReturnPct: -40,
      positiveRatePct: 0,
      directionMatchRatePct: 100,
    });
    expect(result.breakdowns.byGroup).toEqual([
      {
        key: "risk",
        sampleSize: 2,
        avgReturnPct: -40,
        medianReturnPct: -40,
        directionMatchRatePct: 100,
      },
    ]);
    expect(result.interpretation).toMatchObject({
      confidence: "low",
      researchOnly: true,
    });
    expect(paramsList[0]).toEqual([
      "binance",
      "spot",
      "4h",
      "crypto",
      "breakdown_risk",
      500,
      10,
    ]);
    expect(queries[0]).toContain("FROM scan_signals ss");
    expect(queries[0]).toContain("ss.signal_label = $5");
    expect(queries[0]).toContain("ss.action_bias = 'avoid'");
    expect(queries[0]).toContain("LIMIT $6");
    expect(queries[0]).toContain("LIMIT $7");
  });

  it("skips malformed prices and missing future candles without throwing", async () => {
    const result = await loadSignalEvaluationPg(
      makePool(() => ({
        rows: [
          makeEvaluationRow({
            id: "bad-price",
            price_at_signal: "0",
            signal_label: "",
            action_bias: "",
            primary_structure: "neutral",
            forward_candles: [{ close: 101 }],
          }),
          makeEvaluationRow({
            id: "missing-future",
            price_at_signal: "100",
            signal_label: "",
            action_bias: "",
            primary_structure: "neutral",
            forward_candles: [],
          }),
        ],
      })),
      {
        exchange: "binance",
        market: "spot",
        timeframe: "1h",
        symbol: "BTCUSDT",
        group: "neutral",
        horizons: [1, 3],
        minSamples: 10,
      },
    );

    expect(result.expectedDirection).toBe("none");
    expect(result.sample).toEqual({
      sourceSignals: 2,
      completedSignals: 0,
      skippedSignals: 2,
      sampleQuality: "none",
      warnings: [
        "insufficient_completed_horizons",
        "missing_future_candles",
        "neutral_has_no_directional_edge",
        "symbol_filtered_sample",
      ],
    });
    expect(result.horizons).toEqual({
      "1": {
        sampleSize: 0,
        avgReturnPct: null,
        medianReturnPct: null,
        positiveRatePct: null,
        directionMatchRatePct: null,
        bestReturnPct: null,
        worstReturnPct: null,
      },
      "3": {
        sampleSize: 0,
        avgReturnPct: null,
        medianReturnPct: null,
        positiveRatePct: null,
        directionMatchRatePct: null,
        bestReturnPct: null,
        worstReturnPct: null,
      },
    });
    expect(result.breakdowns).toEqual({
      byGroup: [],
      bySignalLabel: [],
      byPrimaryStructure: [],
    });
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

function makeEvaluationRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: overrides.id ?? "signal-1",
    scan_time: overrides.scan_time ?? "2026-05-31T00:00:00.000Z",
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
    forward_candles: overrides.forward_candles ?? [],
  };
}
