import { describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { PgScannerResultsStore, isLikelyFullUniverseRun } from "./scannerResultsPg";

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

  it("prefers a full crypto universe run over a newer limited run", async () => {
    const queries: string[] = [];
    const store = new PgScannerResultsStore(
      makePool((sql, params) => {
        queries.push(sql);

        if (queries.length === 1) {
          expect(params).toEqual(["4h", 300, "crypto"]);
          return {
            rows: [
              makeRunRow("full-run", {
                symbols_total: 413,
                symbols_scanned: 409,
                signals_created: 409,
                params: { assetClass: "crypto", allSymbols: true },
              }),
            ],
          };
        }

        return {
          rows: [
            makeRunRow("limited-run", {
              symbols_total: 100,
              symbols_scanned: 96,
              signals_created: 96,
              started_at: "2026-05-31T01:00:00.000Z",
              finished_at: "2026-05-31T01:01:00.000Z",
            }),
          ],
        };
      }),
    );

    const run = await store.getLatestScanRun({
      timeframe: "4h",
      assetClass: "crypto",
      preferFullUniverse: true,
    });

    expect(run?.id).toBe("full-run");
    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain("symbols_total >= $2");
    expect(queries[0]).toContain("symbols_scanned + symbols_skipped >= $2");
    expect(queries[0]).toContain("params ? 'assetClass'");
    expect(queries[0]).toContain("universe = 'all-symbols'");
  });

  it("keeps full-universe selection timeframe-specific for daily and weekly runs", async () => {
    const queries: string[] = [];
    const paramsList: unknown[][] = [];
    const store = new PgScannerResultsStore(
      makePool((sql, params) => {
        queries.push(sql);
        paramsList.push(params);
        return {
          rows: [
            makeRunRow(`full-${params[0]}`, {
              timeframe: params[0],
              symbols_total: 413,
              symbols_scanned: params[0] === "1w" ? 221 : 409,
              signals_created: params[0] === "1w" ? 221 : 409,
              symbols_skipped: params[0] === "1w" ? 192 : 4,
              params: { assetClass: "crypto", allSymbols: true },
            }),
          ],
        };
      }),
    );

    const dailyRun = await store.getLatestScanRun({
      timeframe: "1d",
      assetClass: "crypto",
      preferFullUniverse: true,
    });
    const weeklyRun = await store.getLatestScanRun({
      timeframe: "1w",
      assetClass: "crypto",
      preferFullUniverse: true,
    });

    expect(dailyRun?.id).toBe("full-1d");
    expect(dailyRun?.timeframe).toBe("1d");
    expect(weeklyRun?.id).toBe("full-1w");
    expect(weeklyRun?.timeframe).toBe("1w");
    expect(paramsList).toEqual([
      ["1d", 300, "crypto"],
      ["1w", 300, "crypto"],
    ]);
    expect(queries.every((query) => query.includes("WHERE timeframe = $1"))).toBe(
      true,
    );
  });

  it("falls back to the latest successful run when no full crypto run exists", async () => {
    const queries: string[] = [];
    const store = new PgScannerResultsStore(
      makePool(() => {
        queries.push("");

        if (queries.length === 1) {
          return { rows: [] };
        }

        return {
          rows: [
            makeRunRow("limited-run", {
              symbols_total: 100,
              symbols_scanned: 96,
              signals_created: 96,
            }),
          ],
        };
      }),
    );

    const run = await store.getLatestScanRun({
      timeframe: "4h",
      assetClass: "crypto",
      preferFullUniverse: true,
    });

    expect(run?.id).toBe("limited-run");
    expect(queries).toHaveLength(2);
  });

  it("does not apply crypto full-universe selection to other asset classes", async () => {
    const queries: string[] = [];
    const store = new PgScannerResultsStore(
      makePool((sql) => {
        queries.push(sql);
        return { rows: [makeRunRow("stable-run")] };
      }),
    );

    const run = await store.getLatestScanRun({
      timeframe: "4h",
      assetClass: "stable",
      preferFullUniverse: true,
    });

    expect(run?.id).toBe("stable-run");
    expect(queries).toHaveLength(1);
    expect(queries[0]).not.toContain("symbols_total >= $2");
  });

  it("marks full crypto universe runs as likely full universe even when weekly signals are skipped", () => {
    expect(
      isLikelyFullUniverseRun({
        run: makeRunRecord("full-run", {
          symbolsTotal: 413,
          symbolsScanned: 409,
          signalsCreated: 409,
          params: { assetClass: "crypto", allSymbols: true },
        }),
        assetClass: "crypto",
      }),
    ).toBe(true);
    expect(
      isLikelyFullUniverseRun({
        run: makeRunRecord("weekly-full-run", {
          symbolsTotal: 413,
          symbolsScanned: 221,
          symbolsSkipped: 192,
          signalsCreated: 221,
          params: { assetClass: "crypto", allSymbols: true },
        }),
        assetClass: "crypto",
      }),
    ).toBe(true);
    expect(
      isLikelyFullUniverseRun({
        run: makeRunRecord("limited-run", {
          symbolsTotal: 100,
          symbolsScanned: 96,
          signalsCreated: 96,
        }),
        assetClass: "crypto",
      }),
    ).toBe(false);
    expect(
      isLikelyFullUniverseRun({
        run: makeRunRecord("stable-run", {
          symbolsTotal: 4,
          symbolsScanned: 4,
          signalsCreated: 4,
        }),
        assetClass: "stable",
      }),
    ).toBe(true);
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
    expect(queries[0]).toContain("ss.timeframe = $2");
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

function makeRunRow(id: string, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id,
    exchange: "binance",
    market: "spot",
    mode: "single",
    timeframe: overrides.timeframe ?? "4h",
    universe: "all-symbols",
    status: "success",
    symbols_total: overrides.symbols_total ?? 2,
    symbols_scanned: overrides.symbols_scanned ?? 2,
    signals_created: overrides.signals_created ?? 2,
    symbols_skipped: overrides.symbols_skipped ?? 0,
    failed_symbols: 0,
    params: overrides.params ?? {},
    error_message: null,
    started_at: overrides.started_at ?? "2026-05-31T00:00:00.000Z",
    finished_at: overrides.finished_at ?? "2026-05-31T00:01:00.000Z",
  };
}

function makeRunRecord(
  id: string,
  overrides: Partial<{
    symbolsTotal: number;
    symbolsScanned: number;
    signalsCreated: number;
    symbolsSkipped: number;
    params: Record<string, unknown>;
  }> = {},
) {
  return {
    id,
    exchange: "binance",
    market: "spot",
    mode: "single",
    timeframe: "4h",
    universe: "all-symbols",
    status: "success",
    symbolsTotal: overrides.symbolsTotal ?? 2,
    symbolsScanned: overrides.symbolsScanned ?? 2,
    signalsCreated: overrides.signalsCreated ?? 2,
    symbolsSkipped: overrides.symbolsSkipped ?? 0,
    failedSymbols: 0,
    params: overrides.params ?? {},
    errorMessage: null,
    startedAt: "2026-05-31T00:00:00.000Z",
    finishedAt: "2026-05-31T00:01:00.000Z",
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
