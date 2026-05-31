import { describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { PgScannerResultsStore } from "./scannerResultsPg";

describe("PgScannerResultsStore latest scan queries", () => {
  it("selects the latest successful run by run metadata", async () => {
    const queries: string[] = [];
    const store = new PgScannerResultsStore(
      makePool((sql) => {
        queries.push(sql);
        return { rows: [makeRunRow("run-1")] };
      }),
    );

    const run = await store.getLatestScanRun({ timeframe: "4h" });

    expect(run?.id).toBe("run-1");
    expect(queries[0]).toContain("status = 'success'");
    expect(queries[0]).toContain("finished_at DESC NULLS LAST");
    expect(queries[0]).not.toMatch(/max\(scan_time\)/i);
  });

  it("loads all latest signals by scan_run_id instead of max scan_time", async () => {
    const queries: string[] = [];
    const store = new PgScannerResultsStore(
      makePool((sql, params) => {
        queries.push(sql);
        expect(params[0]).toBe("run-1");
        return {
          rows: [
            makeSignalRow({
              id: "signal-1",
              scan_run_id: "run-1",
              symbol: "BTCUSDT",
              scan_time: "2026-05-31T00:00:01.000Z",
            }),
            makeSignalRow({
              id: "signal-2",
              scan_run_id: "run-1",
              symbol: "ETHUSDT",
              scan_time: "2026-05-31T00:00:02.000Z",
            }),
          ],
        };
      }),
    );

    const signals = await store.listLatestScanSignalsForRun({
      scanRunId: "run-1",
      timeframe: "4h",
      assetClass: "crypto",
    });

    expect(signals).toHaveLength(2);
    expect(new Set(signals.map((signal) => signal.scanRunId))).toEqual(
      new Set(["run-1"]),
    );
    expect(queries[0]).toContain("ss.scan_run_id = $1");
    expect(queries[0]).not.toMatch(/scan_time\s*=\s*\(/i);
    expect(queries[0]).not.toMatch(/max\(scan_time\)/i);
  });
});

function makePool(
  query: (sql: string, params: unknown[]) => { rows: unknown[] },
): Pool {
  return {
    query: (sql: string, params: unknown[] = []) => Promise.resolve(query(sql, params)),
    end: () => Promise.resolve(),
  } as unknown as Pool;
}

function makeRunRow(id: string) {
  return {
    id,
    exchange: "binance",
    market: "spot",
    mode: "single",
    timeframe: "4h",
    universe: "all-symbols",
    status: "success",
    symbols_total: 2,
    symbols_scanned: 2,
    signals_created: 2,
    symbols_skipped: 0,
    failed_symbols: 0,
    params: {},
    error_message: null,
    started_at: "2026-05-31T00:00:00.000Z",
    finished_at: "2026-05-31T00:01:00.000Z",
  };
}

function makeSignalRow(
  overrides: Partial<Record<string, unknown>> & {
    id: string;
    scan_run_id: string;
    symbol: string;
    scan_time: string;
  },
) {
  return {
    id: overrides.id,
    scan_run_id: overrides.scan_run_id,
    symbol_id: "1",
    exchange: "binance",
    market: "spot",
    symbol: overrides.symbol,
    timeframe: "4h",
    scan_time: overrides.scan_time,
    candle_open_time: "2026-05-30T20:00:00.000Z",
    price_at_signal: 1,
    rank_score: 50,
    final_signal_score: 50,
    opportunity_score: 50,
    confirmation_score: 50,
    risk_score: 0,
    trend_score: 50,
    momentum_score: 50,
    volume_score: 50,
    structure_score: 50,
    signal_label: "confirmed",
    action_bias: "eligible",
    primary_structure: "strong_trend",
    secondary_structures: [],
    detected_risk_types: [],
    factors: {},
    next_confirmation: null,
    invalidation: null,
    raw_metrics: {},
    scoring_version: "test",
    scanner_version: "test",
    created_at: overrides.scan_time,
    asset_class: "crypto",
    is_scanner_eligible: true,
    is_backtest_eligible: true,
    is_market_context: false,
    candle_count: "1000",
    first_open_time: "2024-01-01T00:00:00.000Z",
  };
}
