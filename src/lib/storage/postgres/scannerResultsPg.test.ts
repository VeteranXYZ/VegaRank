import { describe, expect, it } from "vitest";
import type { Pool } from "pg";
import {
  PgScannerResultsStore,
  isLikelyFullUniverseRun,
  normalizeHistoricalSnapshotObservationWindow,
} from "./scannerResultsPg";

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
    expect(queries[0]).toContain("WITH filtered_signals AS");
    expect(queries[0]).toContain("FROM filtered_signals");
    expect(queries[0]).toContain("JOIN filtered_symbols");
    expect(queries[0]).not.toContain("symbol_id IN");
    expect(queries[0]).not.toMatch(/scan_time\s*=\s*\(/i);
    expect(queries[0]).not.toMatch(/max\(scan_time\)/i);
  });

  it("computes latest-scan candle coverage from filtered scanner rows only", async () => {
    const queries: string[] = [];
    const store = new PgScannerResultsStore(
      makePool((sql, params) => {
        queries.push(sql);
        expect(params).toEqual(["run-1", "4h", "crypto"]);

        return {
          rows: [
            makeSignalRow({
              id: "signal-1",
              scan_run_id: "run-1",
              symbol: "BTCUSDT",
              scan_time: "2026-05-31T00:00:01.000Z",
            }),
          ],
        };
      }),
    );

    await store.listLatestScanSignalsForRun({
      scanRunId: "run-1",
      timeframe: "4h",
      assetClass: "crypto",
      includeNonScanner: false,
      includeMarketContext: false,
    });

    expect(queries[0]).toContain("WITH filtered_signals AS");
    expect(queries[0]).toContain("s.asset_class = $3");
    expect(queries[0]).toContain("s.is_scanner_eligible = true");
    expect(queries[0]).toContain("s.is_market_context = false");
    expect(queries[0]).toContain("JOIN filtered_symbols fs");
    expect(queries[0]).toContain("WHERE mc.timeframe = $2");
    expect(queries[0]).not.toMatch(
      /SELECT symbol_id\s+FROM scan_signals\s+WHERE scan_run_id = \$1/i,
    );
  });

  it("lists recent successful historical runs by timeframe and asset class", async () => {
    const queries: string[] = [];
    const paramsList: unknown[][] = [];
    const store = new PgScannerResultsStore(
      makePool((sql, params) => {
        queries.push(sql);
        paramsList.push(params);
        return {
          rows: [
            makeRunRow("history-run", {
              timeframe: "4h",
              symbols_total: 413,
              symbols_scanned: 409,
              signals_created: 409,
              params: { assetClass: "crypto", allSymbols: true },
            }),
          ],
        };
      }),
    );

    const runs = await store.listHistoricalScanRuns({
      timeframe: "4h",
      assetClass: "crypto",
      limit: 25,
    });

    expect(runs).toHaveLength(1);
    expect(runs[0]?.id).toBe("history-run");
    expect(paramsList[0]).toEqual(["4h", 25, "crypto"]);
    expect(queries[0]).toContain("sr.timeframe = $1");
    expect(queries[0]).toContain("sr.status = 'success'");
    expect(queries[0]).toContain("lower(sr.params->>'assetClass') = $3");
    expect(queries[0]).toContain("LIMIT $2");
  });

  it("loads one successful historical run with optional timeframe and asset filters", async () => {
    const queries: string[] = [];
    const paramsList: unknown[][] = [];
    const store = new PgScannerResultsStore(
      makePool((sql, params) => {
        queries.push(sql);
        paramsList.push(params);
        return { rows: [makeRunRow("history-run", { timeframe: "1d" })] };
      }),
    );

    const run = await store.getHistoricalScanRun({
      scanRunId: "history-run",
      timeframe: "1d",
      assetClass: "crypto",
    });

    expect(run?.id).toBe("history-run");
    expect(run?.timeframe).toBe("1d");
    expect(paramsList[0]).toEqual(["history-run", "1d", "crypto"]);
    expect(queries[0]).toContain("sr.id = $1");
    expect(queries[0]).toContain("sr.status = 'success'");
    expect(queries[0]).toContain("sr.timeframe = $2");
    expect(queries[0]).toContain("lower(sr.params->>'assetClass') = $3");
    expect(queries[0]).toContain("LIMIT 1");
  });

  it("computes complete forward observations from stored signal anchors", async () => {
    const queries: string[] = [];
    const paramsList: unknown[][] = [];
    const store = new PgScannerResultsStore(
      makePool((sql, params) => {
        queries.push(sql);
        paramsList.push(params);

        if (queries.length === 1) {
          return { rows: [makeRunRow("history-run", { timeframe: "4h" })] };
        }

        return {
          rows: [
            makeObservationRow({
              id: "signal-1",
              scan_run_id: "history-run",
              symbol: "SEIUSDT",
              anchor_close: 100,
              anchor_source: "stored_signal",
              forward_candles: [
                { close: 102, low: 98 },
                { close: 104, low: 97 },
                { close: 106, low: 96 },
              ],
            }),
          ],
        };
      }),
    );

    const result = await store.getHistoricalSnapshotObservations({
      scanRunId: "history-run",
      assetClass: "crypto",
      window: 3,
    });

    expect(result.run?.id).toBe("history-run");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      symbol: "SEIUSDT",
      anchorClose: 100,
      anchorSource: "stored_signal",
      observedClose: 106,
      observedChangePct: 6,
      maxDrawdownPct: -4,
      dataStatus: "complete",
      missingReason: null,
      forwardCandlesAvailable: 3,
    });
    expect(paramsList[1]).toEqual(["history-run", "4h", 3, "crypto"]);
    expect(queries).toHaveLength(2);
    expect(queries[1]).toContain("LEFT JOIN LATERAL");
    expect(queries[1]).toContain("LIMIT $3");
    expect(queries[1]).toContain("c.open_time > observation_anchor.anchor_time");
    expect(queries[1]).toContain("latest_market.latest_market_open_time");
  });

  it("returns partial observations without dropping rows", async () => {
    const store = new PgScannerResultsStore(
      makePool(() => ({
        rows: [
          makeObservationRow({
            id: "partial-signal",
            scan_run_id: "history-run",
            symbol: "PARTIALUSDT",
            anchor_close: 100,
            anchor_source: "nearest_prior_candle",
            forward_candles: [
              { close: 98, low: 95 },
              { close: 99, low: 96 },
            ],
          }),
          makeObservationRow({
            id: "complete-signal",
            scan_run_id: "history-run",
            symbol: "COMPLETEUSDT",
            anchor_close: 50,
            anchor_source: "stored_signal",
            forward_candles: [
              { close: 51, low: 49 },
              { close: 52, low: 48 },
              { close: 53, low: 47 },
              { close: 54, low: 46 },
              { close: 55, low: 45 },
            ],
          }),
        ],
      })),
    );

    const rows = await store.listHistoricalSnapshotObservationsForRun({
      scanRunId: "history-run",
      timeframe: "4h",
      assetClass: "crypto",
      window: 5,
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      symbol: "PARTIALUSDT",
      anchorSource: "nearest_prior_candle",
      observedClose: 99,
      observedChangePct: -1,
      maxDrawdownPct: -5,
      dataStatus: "partial",
      missingReason: "insufficient_future_candles",
      forwardCandlesAvailable: 2,
    });
    expect(rows[1]).toMatchObject({
      symbol: "COMPLETEUSDT",
      observedClose: 55,
      observedChangePct: 10,
      maxDrawdownPct: -10,
      dataStatus: "complete",
      missingReason: null,
      forwardCandlesAvailable: 5,
    });
  });

  it("returns missing observations when anchor or future candles are unavailable", async () => {
    const store = new PgScannerResultsStore(
      makePool(() => ({
        rows: [
          makeObservationRow({
            id: "missing-anchor",
            scan_run_id: "history-run",
            symbol: "ANCHORUSDT",
            anchor_time: null,
            anchor_close: null,
            anchor_source: "unavailable",
            forward_candles: [],
          }),
          makeObservationRow({
            id: "missing-forward",
            scan_run_id: "history-run",
            symbol: "FUTUREUSDT",
            anchor_close: 100,
            anchor_source: "stored_signal",
            forward_candles: [],
          }),
        ],
      })),
    );

    const rows = await store.listHistoricalSnapshotObservationsForRun({
      scanRunId: "history-run",
      timeframe: "4h",
      assetClass: "crypto",
      window: 3,
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      symbol: "ANCHORUSDT",
      anchorSource: "unavailable",
      observedClose: null,
      observedChangePct: null,
      maxDrawdownPct: null,
      dataStatus: "missing",
      missingReason: "missing_anchor",
    });
    expect(rows[1]).toMatchObject({
      symbol: "FUTUREUSDT",
      observedClose: null,
      observedChangePct: null,
      maxDrawdownPct: null,
      dataStatus: "missing",
      missingReason: "no_future_candles",
    });
  });

  it("marks stored anchors after the latest market candle as stale market data", async () => {
    const store = new PgScannerResultsStore(
      makePool(() => ({
        rows: [
          makeObservationRow({
            id: "bad-anchor",
            scan_run_id: "history-run",
            symbol: "STALEUSDT",
            anchor_time: "2026-06-01T20:00:00.000Z",
            anchor_close: 100,
            anchor_source: "stored_signal",
            latest_market_open_time: "2026-05-31T00:00:00.000Z",
            forward_candles: [],
          }),
        ],
      })),
    );

    const rows = await store.listHistoricalSnapshotObservationsForRun({
      scanRunId: "history-run",
      timeframe: "4h",
      assetClass: "crypto",
      window: 3,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      symbol: "STALEUSDT",
      anchorTime: "2026-06-01T20:00:00.000Z",
      latestMarketOpenTime: "2026-05-31T00:00:00.000Z",
      dataStatus: "missing",
      missingReason: "run_after_latest_candle",
      forwardCandlesAvailable: 0,
    });
  });

  it("summarizes latest market candle coverage for observation readiness", async () => {
    const queries: string[] = [];
    const paramsList: unknown[][] = [];
    const store = new PgScannerResultsStore(
      makePool((sql, params) => {
        queries.push(sql);
        paramsList.push(params);

        return {
          rows: [
            {
              latest_open_time: "2026-06-01T20:00:00.000Z",
              symbol_count: "100",
            },
            {
              latest_open_time: "2026-05-31T00:00:00.000Z",
              symbol_count: "308",
            },
            {
              latest_open_time: null,
              symbol_count: "5",
            },
          ],
        };
      }),
    );

    const coverage = await store.getHistoricalObservationMarketCandleCoverage({
      timeframe: "4h",
      assetClass: "crypto",
    });

    expect(coverage).toEqual({
      timeframe: "4h",
      assetClass: "crypto",
      totalSymbols: 413,
      symbolsWithCandles: 408,
      latestOpenTime: "2026-06-01T20:00:00.000Z",
      latestOpenTimeSymbolCount: 100,
      buckets: [
        {
          latestOpenTime: "2026-06-01T20:00:00.000Z",
          symbolCount: 100,
        },
        {
          latestOpenTime: "2026-05-31T00:00:00.000Z",
          symbolCount: 308,
        },
        {
          latestOpenTime: null,
          symbolCount: 5,
        },
      ],
    });
    expect(paramsList[0]).toEqual(["4h", "crypto"]);
    expect(queries[0]).toContain("LEFT JOIN LATERAL");
    expect(queries[0]).toContain("ORDER BY c.open_time DESC");
    expect(queries[0]).toContain("s.is_scanner_eligible = true");
    expect(queries[0]).toContain("s.is_market_context = false");
  });

  it("validates supported forward observation windows", async () => {
    expect(normalizeHistoricalSnapshotObservationWindow(1)).toBe(1);
    expect(normalizeHistoricalSnapshotObservationWindow(3)).toBe(3);
    expect(normalizeHistoricalSnapshotObservationWindow(5)).toBe(5);
    expect(normalizeHistoricalSnapshotObservationWindow(10)).toBe(10);
    expect(normalizeHistoricalSnapshotObservationWindow(2)).toBeNull();
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

function makeObservationRow(
  overrides: Partial<Record<string, unknown>> & {
    id: string;
    scan_run_id: string;
    symbol: string;
  },
) {
  return {
    ...makeSignalRow({
      id: overrides.id,
      scan_run_id: overrides.scan_run_id,
      symbol: overrides.symbol,
      scan_time:
        typeof overrides.scan_time === "string"
          ? overrides.scan_time
          : "2026-05-31T00:00:01.000Z",
    }),
    anchor_time: overrides.anchor_time ?? "2026-05-30T20:00:00.000Z",
    anchor_close: overrides.anchor_close ?? 100,
    anchor_source: overrides.anchor_source ?? "stored_signal",
    latest_market_open_time:
      overrides.latest_market_open_time ?? "2026-06-01T20:00:00.000Z",
    forward_candles: overrides.forward_candles ?? [],
  };
}
