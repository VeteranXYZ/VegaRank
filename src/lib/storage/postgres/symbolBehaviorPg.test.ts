import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { loadSymbolBehaviorPg } from "./symbolBehaviorPg";

describe("loadSymbolBehaviorPg", () => {
  it("returns usable stats when prior signals and forward candles exist", async () => {
    const queries: string[] = [];
    const paramsList: unknown[][] = [];
    const result = await loadSymbolBehaviorPg(
      makePool((sql, params) => {
        queries.push(sql);
        paramsList.push(params);

        return {
          rows: [
            makeBehaviorRow({
              id: "current-excluded-check",
              scan_time: "2026-05-30T00:00:00.000Z",
              price_at_signal: "100",
              signal_label: "confirmed",
              action_bias: "eligible",
              primary_structure: "strong_trend",
              rank_score: "80",
              forward_candles: [
                { close: 110 },
                { close: 120 },
                { close: 130 },
                { close: 140 },
                { close: 150 },
              ],
            }),
            makeBehaviorRow({
              id: "signal-risk",
              scan_time: "2026-05-29T00:00:00.000Z",
              price_at_signal: "200",
              signal_label: "breakdown_risk",
              action_bias: "avoid",
              primary_structure: "trend_breakdown",
              rank_score: "-20",
              forward_candles: [
                { close: 190 },
                { close: 180 },
                { close: 170 },
                { close: 160 },
                { close: 150 },
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

    expect(result.behaviorDiagnostics).toEqual({
      available: true,
      reason: "ok",
      message:
        "Historical behavior is available from prior scanner signals with forward candles.",
    });
    expect(result.behavior).toMatchObject({
      sampleSize: 2,
      currentContext: {
        resultGroup: "eligible",
        signalLabel: "confirmed",
        primaryStructure: "strong_trend",
        timeframe: "4h",
      },
    });
    expect(result.behavior?.horizons["1"]).toMatchObject({
      sampleSize: 2,
      avgReturnPct: 2.5,
      medianReturnPct: 2.5,
      winRatePct: 50,
      bestReturnPct: 10,
      worstReturnPct: -5,
    });
    expect(result.behavior?.horizons["5"]).toMatchObject({
      sampleSize: 2,
      avgReturnPct: 12.5,
      medianReturnPct: 12.5,
      winRatePct: 50,
      bestReturnPct: 50,
      worstReturnPct: -25,
    });
    expect(result.behavior?.byResultGroup.map((row) => row.resultGroup).sort()).toEqual([
      "eligible",
      "risk",
    ]);
    expect(result.behavior?.bySignalLabel.map((row) => row.signalLabel).sort()).toEqual([
      "breakdown_risk",
      "confirmed",
    ]);
    expect(result.behavior?.recentOutcomes[0]).toMatchObject({
      scanTime: "2026-05-30T00:00:00.000Z",
      signalLabel: "confirmed",
      resultGroup: "eligible",
      forwardReturnPct: { "1": 10, "3": 30, "5": 50 },
    });
    expect(result.behavior?.warnings).toEqual([
      "Very limited historical sample size.",
    ]);
    expect(paramsList[0]).toEqual([
      "binance",
      "spot",
      "SEIUSDT",
      "4h",
      "current-signal",
      "crypto",
      80,
    ]);
    expect(queries[0]).toContain("sr.status = 'success'");
    expect(queries[0]).toContain("ss.id <> $5");
    expect(queries[0]).toContain("LIMIT $7");
  });

  it("returns no_prior_signals diagnostics when no prior signals exist", async () => {
    const result = await loadSymbolBehaviorPg(
      makePool(() => ({ rows: [] })),
      {
        exchange: "binance",
        market: "spot",
        symbol: "SEIUSDT",
        timeframe: "1w",
      },
    );

    expect(result).toEqual({
      behavior: null,
      behaviorDiagnostics: {
        available: false,
        reason: "no_prior_signals",
        message:
          "Historical behavior is not available yet because no prior scanner signals were found for this symbol/timeframe.",
      },
    });
  });

  it("returns missing_forward_candles diagnostics when forward data is unavailable", async () => {
    const result = await loadSymbolBehaviorPg(
      makePool(() => ({
        rows: [
          makeBehaviorRow({
            id: "signal-partial",
            price_at_signal: "100",
            forward_candles: [],
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

    expect(result).toEqual({
      behavior: null,
      behaviorDiagnostics: {
        available: false,
        reason: "missing_forward_candles",
        message:
          "Historical behavior is not available yet because prior signals do not have enough forward candles.",
      },
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
