import type { Pool, PoolClient } from "pg";
import { describe, expect, it, vi } from "vitest";
import { PgMarketDataStore, type PgSymbolUpsertInput } from "./marketDataPg";

describe("PgMarketDataStore exchange-aware market data", () => {
  it("upserts Coinbase dashed symbols without changing the stored symbol", async () => {
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const store = new PgMarketDataStore(
      makePool((sql, params) => {
        queries.push({ sql, params });
        return {
          rows: [
            makeSymbolRow({
              exchange: params[0] as string,
              market: params[1] as string,
              symbol: params[2] as string,
              base_asset: params[3] as string,
              quote_asset: params[4] as string,
            }),
          ],
        };
      }),
    );

    const rows = await store.upsertImportedSymbols([
      makeCoinbaseSymbolInput("BTC-USDC", "BTC"),
    ]);

    expect(queries[0]!.params.slice(0, 5)).toEqual([
      "coinbase",
      "spot",
      "BTC-USDC",
      "BTC",
      "USDC",
    ]);
    expect(rows[0]).toMatchObject({
      exchange: "coinbase",
      market: "spot",
      symbol: "BTC-USDC",
      baseAsset: "BTC",
      quoteAsset: "USDC",
    });
  });

  it("keeps Binance as the default symbol listing identity", async () => {
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const store = new PgMarketDataStore(
      makePool((sql, params) => {
        queries.push({ sql, params });
        return {
          rows: [
            makeSymbolRow({
              exchange: "binance",
              market: "spot",
              symbol: "BTCUSDT",
              base_asset: "BTC",
              quote_asset: "USDT",
            }),
          ],
        };
      }),
    );

    const rows = await store.listSymbols({ limit: 1 });

    expect(queries[0]!.params).toEqual(["binance", "spot", 1]);
    expect(queries[0]!.sql).toContain("exchange = $1");
    expect(rows[0]).toMatchObject({
      exchange: "binance",
      symbol: "BTCUSDT",
    });
  });

  it("lists Coinbase symbols by dashed names", async () => {
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const store = new PgMarketDataStore(
      makePool((sql, params) => {
        queries.push({ sql, params });
        return {
          rows: [
            makeSymbolRow({
              exchange: "coinbase",
              market: "spot",
              symbol: "BTC-USDC",
              base_asset: "BTC",
              quote_asset: "USDC",
            }),
          ],
        };
      }),
    );

    const rows = await store.listSymbolsByNames(["btc-usdc"], {
      exchange: "coinbase",
      market: "spot",
    });

    expect(queries[0]!.params).toEqual([["BTC-USDC"], "coinbase", "spot"]);
    expect(rows[0]!.symbol).toBe("BTC-USDC");
  });

  it("upserts Coinbase candles using the symbol exchange and market", async () => {
    const clientQueries: Array<{ sql: string; params: unknown[] }> = [];
    const client = makeClient((sql, params) => {
      clientQueries.push({ sql, params });

      if (sql.includes("SELECT *")) {
        return {
          rows: [
            makeSymbolRow({
              id: "42",
              exchange: "coinbase",
              market: "spot",
              symbol: "BTC-USDC",
              base_asset: "BTC",
              quote_asset: "USDC",
            }),
          ],
        };
      }

      if (sql.includes("INSERT INTO market_candles")) {
        return { rows: [{ inserted: true }] };
      }

      return { rows: [] };
    });
    const store = new PgMarketDataStore(makePool(() => ({ rows: [] }), client));

    const stats = await store.upsertCandles({
      exchange: "coinbase",
      market: "spot",
      symbol: "BTC-USDC",
      timeframe: "4h",
      candles: [
        {
          openTime: 1_000,
          closeTime: 14_400_999,
          open: 1,
          high: 2,
          low: 0.5,
          close: 1.5,
          volume: 100,
        },
      ],
    });

    const selectQuery = clientQueries.find((query) => query.sql.includes("SELECT *"));
    const insertQuery = clientQueries.find((query) =>
      query.sql.includes("INSERT INTO market_candles"),
    );

    expect(stats).toEqual({ inserted: 1, updated: 0 });
    expect(selectQuery?.params).toEqual(["coinbase", "spot", "BTC-USDC"]);
    expect(insertQuery?.params.slice(0, 5)).toEqual([
      42,
      "coinbase",
      "spot",
      "BTC-USDC",
      "4h",
    ]);
  });

  it("fetches Coinbase candles, latest open time, and coverage by exchange", async () => {
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const store = new PgMarketDataStore(
      makePool((sql, params) => {
        queries.push({ sql, params });

        if (sql.includes("COUNT(*) AS candle_count")) {
          return {
            rows: [
              {
                candle_count: "1",
                earliest_open_time_ms: "1000",
                latest_open_time_ms: "1000",
                latest_close_time_ms: "2000",
              },
            ],
          };
        }

        if (sql.includes("MAX(open_time_ms) AS latest_open_time_ms")) {
          return { rows: [{ latest_open_time_ms: "1000" }] };
        }

        return {
          rows: [
            {
              id: "1",
              symbol_id: "42",
              symbol: "BTC-USDC",
              timeframe: "4h",
              open_time_ms: "1000",
              close_time_ms: "2000",
              open: "1",
              high: "2",
              low: "0.5",
              close: "1.5",
              volume: "100",
              quote_volume: null,
            },
          ],
        };
      }),
    );

    const candles = await store.listCandles({
      exchange: "coinbase",
      market: "spot",
      symbol: "BTC-USDC",
      timeframe: "4h",
      limit: 1,
    });
    const latest = await store.getLatestCandleOpenTime({
      exchange: "coinbase",
      market: "spot",
      symbol: "BTC-USDC",
      timeframe: "4h",
    });
    const coverage = await store.getCandleCoverageForSymbol({
      exchange: "coinbase",
      market: "spot",
      symbol: "BTC-USDC",
      timeframe: "4h",
    });

    expect(queries.map((query) => query.params)).toEqual([
      ["coinbase", "spot", "BTC-USDC", "4h", 1],
      ["coinbase", "spot", "BTC-USDC", "4h"],
      ["coinbase", "spot", "BTC-USDC", "4h"],
    ]);
    expect(candles[0]).toMatchObject({ symbol: "BTC-USDC", openTime: 1000 });
    expect(latest).toBe(1000);
    expect(coverage).toEqual({
      candleCount: 1,
      earliestOpenTimeMs: 1000,
      latestOpenTimeMs: 1000,
      latestCloseTimeMs: 2000,
    });
  });
});

function makeCoinbaseSymbolInput(symbol: string, baseAsset: string): PgSymbolUpsertInput {
  return {
    exchange: "coinbase",
    market: "spot",
    symbol,
    baseAsset,
    quoteAsset: "USDC",
    status: "active",
    quoteVolume: undefined,
    isEnabled: true,
    assetClass: "crypto",
    isScannerEligible: true,
    isBacktestEligible: true,
    isMarketContext: false,
  };
}

function makePool(
  query: (sql: string, params: unknown[]) => { rows: unknown[] },
  client?: PoolClient,
): Pool {
  return {
    query: (sql: string, params: unknown[] = []) => Promise.resolve(query(sql, params)),
    connect: () => Promise.resolve(client),
    end: () => Promise.resolve(),
  } as unknown as Pool;
}

function makeClient(
  query: (sql: string, params: unknown[]) => { rows: unknown[] },
): PoolClient {
  return {
    query: (sql: string, params: unknown[] = []) => Promise.resolve(query(sql, params)),
    release: vi.fn(),
  } as unknown as PoolClient;
}

function makeSymbolRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: overrides.id ?? "1",
    exchange: overrides.exchange ?? "binance",
    market: overrides.market ?? "spot",
    symbol: overrides.symbol ?? "BTCUSDT",
    base_asset: overrides.base_asset ?? "BTC",
    quote_asset: overrides.quote_asset ?? "USDT",
    status: overrides.status ?? "TRADING",
    quote_volume: overrides.quote_volume ?? null,
    price_change_percent: overrides.price_change_percent ?? null,
    is_enabled: overrides.is_enabled ?? true,
    asset_class: overrides.asset_class ?? "crypto",
    is_scanner_eligible: overrides.is_scanner_eligible ?? true,
    is_backtest_eligible: overrides.is_backtest_eligible ?? true,
    is_market_context: overrides.is_market_context ?? false,
    metadata: overrides.metadata ?? {},
    updated_at: overrides.updated_at ?? "2026-01-01T00:00:00.000Z",
  };
}
