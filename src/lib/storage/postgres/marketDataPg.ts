import type { Pool, PoolClient } from "pg";
import type { Candle, Market } from "@/lib/exchanges/types";
import {
  classifyUsdtSymbol,
  emptyAssetClassCounts,
  isSymbolAssetClass,
  type SymbolAssetClass,
  type SymbolAssetClassFilter,
  type SymbolClassification,
} from "@/lib/market-data/symbolClassification";
import { createPostgresPool } from "./pool";

export type MarketDataTimeframe = "1h" | "4h" | "1d" | "1w" | "1M";
export const MARKET_DATA_TIMEFRAMES = ["1h", "4h", "1d", "1w", "1M"] as const;

export type PgSymbol = {
  id: number;
  exchange: string;
  market: string;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
  quoteVolume: number | null;
  priceChangePercent: number | null;
  isEnabled: boolean;
  assetClass: SymbolAssetClass;
  isScannerEligible: boolean;
  isBacktestEligible: boolean;
  isMarketContext: boolean;
  metadata: Record<string, unknown>;
  updatedAt: string;
};

export type PgSymbolUpsertInput = Market &
  SymbolClassification & {
    isEnabled: boolean;
    market?: string;
    metadata?: Record<string, unknown>;
  };

export type PgCandle = Candle & {
  id: number;
  symbolId: number;
  symbol: string;
  timeframe: string;
};

export type CandleUpsertStats = {
  inserted: number;
  updated: number;
};

export type MarketDataSyncJobInput = {
  id: string;
  exchange?: string;
  market?: string;
  timeframe: string;
  status: string;
  symbolsTotal: number;
  params: Record<string, unknown>;
};

export type MarketDataSyncJobUpdate = {
  id: string;
  status: string;
  symbolsDone: number;
  candlesInserted: number;
  candlesUpdated: number;
  errorMessage?: string | null;
};

export type MarketDataSyncJobRecord = {
  id: string;
  exchange: string;
  market: string;
  timeframe: string;
  status: string;
  symbolsTotal: number;
  symbolsDone: number;
  candlesInserted: number;
  candlesUpdated: number;
  errorMessage: string | null;
  params: Record<string, unknown>;
  startedAt: string;
  finishedAt: string | null;
};

export type MarketDataCoverageRow = {
  symbolId: number;
  symbol: string;
  assetClass: SymbolAssetClass;
  isScannerEligible: boolean;
  isBacktestEligible: boolean;
  isMarketContext: boolean;
  timeframe: string;
  candleCount: number;
  firstOpenTime: string | null;
  latestOpenTime: string | null;
  latestCloseTime: string | null;
  latestOpenTimeMs: number | null;
  latestCloseTimeMs: number | null;
  isBelowScannerMinimum: boolean;
  isStale: boolean;
};

export type MarketDataCoverageSummary = {
  totalSymbols: number;
  healthy: number;
  belowMinimum: number;
  stale: number;
  scannerEligible: number;
  marketContext: number;
  byAssetClass: Record<SymbolAssetClass, number>;
};

export type SymbolsSummary = {
  total: number;
  enabled: number;
  disabled: number;
  scannerEligible: number;
  backtestEligible: number;
  marketContext: number;
  byAssetClass: Record<SymbolAssetClass, number>;
  topByQuoteVolume: Array<{
    symbol: string;
    assetClass: SymbolAssetClass;
    quoteVolume: number | null;
    isScannerEligible: boolean;
  }>;
};

export type SymbolCandleCoverage = {
  candleCount: number;
  earliestOpenTimeMs: number | null;
  latestOpenTimeMs: number | null;
  latestCloseTimeMs: number | null;
};

type SymbolRow = {
  id: string;
  exchange: string;
  market: string;
  symbol: string;
  base_asset: string;
  quote_asset: string;
  status: string;
  quote_volume: number | string | null;
  price_change_percent: number | string | null;
  is_enabled: boolean;
  asset_class?: string | null;
  is_scanner_eligible?: boolean | null;
  is_backtest_eligible?: boolean | null;
  is_market_context?: boolean | null;
  metadata: Record<string, unknown>;
  updated_at: Date | string;
};

type CandleRow = {
  id: string;
  symbol_id: string;
  symbol: string;
  timeframe: string;
  open_time_ms: string;
  close_time_ms: string;
  open: number | string;
  high: number | string;
  low: number | string;
  close: number | string;
  volume: number | string;
  quote_volume: number | string | null;
};

type LatestCandleRow = {
  latest_open_time_ms: string | null;
};

type SymbolCandleCoverageRow = {
  candle_count: string;
  earliest_open_time_ms: string | null;
  latest_open_time_ms: string | null;
  latest_close_time_ms: string | null;
};

type MarketDataSyncJobRow = {
  id: string;
  exchange: string;
  market: string;
  timeframe: string;
  status: string;
  symbols_total: number;
  symbols_done: number;
  candles_inserted: number;
  candles_updated: number;
  error_message: string | null;
  params: Record<string, unknown>;
  started_at: Date | string;
  finished_at: Date | string | null;
};

type MarketDataCoverageQueryRow = {
  symbol_id: string;
  symbol: string;
  asset_class: string | null;
  is_scanner_eligible: boolean | null;
  is_backtest_eligible: boolean | null;
  is_market_context: boolean | null;
  candle_count: string;
  first_open_time: Date | string | null;
  latest_open_time: Date | string | null;
  latest_close_time: Date | string | null;
  latest_open_time_ms: string | null;
  latest_close_time_ms: string | null;
};

type SymbolsSummaryCountRow = {
  asset_class: string | null;
  total: string;
  enabled: string;
  scanner_eligible: string;
  backtest_eligible: string;
  market_context: string;
};

type TopQuoteVolumeSymbolRow = {
  symbol: string;
  asset_class: string | null;
  quote_volume: number | string | null;
  is_scanner_eligible: boolean | null;
};

type UpsertCandleRow = {
  inserted: boolean;
};

export class PgMarketDataStore {
  private readonly pool: Pool;
  private readonly ownsPool: boolean;

  constructor(pool?: Pool) {
    this.pool = pool ?? createPostgresPool();
    this.ownsPool = pool === undefined;
  }

  async close() {
    if (this.ownsPool) {
      await this.pool.end();
    }
  }

  async upsertSymbols(markets: Market[]) {
    const rows: PgSymbol[] = [];

    for (const market of markets) {
      const exchange = normalizeExchange(market.exchange);
      const marketType = "spot";
      const classification = classifyUsdtSymbol({
        symbol: market.symbol,
        baseAsset: market.baseAsset,
      });
      const result = await this.pool.query<SymbolRow>(
        `
          INSERT INTO symbols (
            exchange, market, symbol, base_asset, quote_asset, status,
            quote_volume, price_change_percent, is_enabled, asset_class,
            is_scanner_eligible, is_backtest_eligible, is_market_context,
            metadata, updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, true, $9, $10, $11, $12,
            '{}'::jsonb, now()
          )
          ON CONFLICT(exchange, market, symbol) DO UPDATE SET
            base_asset = excluded.base_asset,
            quote_asset = excluded.quote_asset,
            status = excluded.status,
            quote_volume = excluded.quote_volume,
            price_change_percent = excluded.price_change_percent,
            is_enabled = excluded.is_enabled,
            updated_at = now()
          RETURNING *
        `,
        [
          exchange,
          marketType,
          normalizeStoredSymbol(market.symbol),
          market.baseAsset,
          market.quoteAsset,
          market.status,
          market.quoteVolume ?? null,
          market.priceChangePercent ?? null,
          classification.assetClass,
          classification.isScannerEligible,
          classification.isBacktestEligible,
          classification.isMarketContext,
        ],
      );

      rows.push(toPgSymbol(result.rows[0]));
    }

    return rows;
  }

  async upsertImportedSymbols(symbols: PgSymbolUpsertInput[]) {
    const rows: PgSymbol[] = [];

    for (const symbol of symbols) {
      const exchange = normalizeExchange(symbol.exchange);
      const market = normalizeMarket(symbol.market);
      const result = await this.pool.query<SymbolRow>(
        `
          INSERT INTO symbols (
            exchange, market, symbol, base_asset, quote_asset, status,
            quote_volume, price_change_percent, is_enabled, asset_class,
            is_scanner_eligible, is_backtest_eligible, is_market_context,
            metadata, updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
            $14::jsonb, now()
          )
          ON CONFLICT(exchange, market, symbol) DO UPDATE SET
            base_asset = excluded.base_asset,
            quote_asset = excluded.quote_asset,
            status = excluded.status,
            quote_volume = excluded.quote_volume,
            price_change_percent = excluded.price_change_percent,
            is_enabled = excluded.is_enabled,
            asset_class = excluded.asset_class,
            is_scanner_eligible = excluded.is_scanner_eligible,
            is_backtest_eligible = excluded.is_backtest_eligible,
            is_market_context = excluded.is_market_context,
            metadata = symbols.metadata || excluded.metadata,
            updated_at = now()
          RETURNING *
        `,
        [
          exchange,
          market,
          normalizeStoredSymbol(symbol.symbol),
          symbol.baseAsset,
          symbol.quoteAsset,
          symbol.status,
          symbol.quoteVolume ?? null,
          symbol.priceChangePercent ?? null,
          symbol.isEnabled,
          symbol.assetClass,
          symbol.isScannerEligible,
          symbol.isBacktestEligible,
          symbol.isMarketContext,
          JSON.stringify(symbol.metadata ?? {}),
        ],
      );

      rows.push(toPgSymbol(result.rows[0]));
    }

    return rows;
  }

  async listSymbols({
    exchange = "binance",
    market = "spot",
    limit = 500,
    assetClass = "all",
    includeNonScanner = true,
  }: {
    exchange?: string;
    market?: string;
    limit?: number | null;
    assetClass?: SymbolAssetClassFilter;
    includeNonScanner?: boolean;
  } = {}) {
    const params: unknown[] = [];
    const filters = ["is_enabled = true"];
    addIdentityFilters({ filters, params, exchange, market });

    if (assetClass !== "all") {
      params.push(assetClass);
      filters.push(`asset_class = $${params.length}`);
    }

    if (!includeNonScanner) {
      filters.push("is_scanner_eligible = true");
    }

    const limitSql =
      limit === null
        ? ""
        : (() => {
            params.push(limit);
            return `LIMIT $${params.length}`;
          })();

    const result = await this.pool.query<SymbolRow>(
      `
        SELECT *
        FROM symbols
        WHERE ${filters.join("\n          AND ")}
        ORDER BY COALESCE(quote_volume, 0) DESC, symbol ASC
        ${limitSql}
      `,
      params,
    );

    return result.rows.map(toPgSymbol);
  }

  async listSymbolsByNames(
    symbols: string[],
    {
      exchange = "binance",
      market = "spot",
    }: {
      exchange?: string;
      market?: string;
    } = {},
  ) {
    if (symbols.length === 0) {
      return [];
    }

    const normalizedSymbols = symbols.map(normalizeStoredSymbol);
    const params: unknown[] = [normalizedSymbols];
    const filters = ["is_enabled = true", "symbol = ANY($1::text[])"];
    addIdentityFilters({ filters, params, exchange, market });
    const result = await this.pool.query<SymbolRow>(
      `
        SELECT *
        FROM symbols
        WHERE ${filters.join("\n          AND ")}
        ORDER BY COALESCE(quote_volume, 0) DESC, symbol ASC
      `,
      params,
    );

    return result.rows.map(toPgSymbol);
  }

  async getSymbol(
    symbol: string,
    {
      exchange = "binance",
      market = "spot",
    }: {
      exchange?: string;
      market?: string;
    } = {},
  ) {
    const params: unknown[] = [normalizeStoredSymbol(symbol)];
    const filters = ["symbol = $1"];
    addIdentityFilters({ filters, params, exchange, market });
    const result = await this.pool.query<SymbolRow>(
      `
        SELECT *
        FROM symbols
        WHERE ${filters.join("\n          AND ")}
        LIMIT 1
      `,
      params,
    );

    return result.rows[0] ? toPgSymbol(result.rows[0]) : null;
  }

  async upsertCandles({
    exchange = "binance",
    market = "spot",
    symbol,
    timeframe,
    candles,
  }: {
    exchange?: string;
    market?: string;
    symbol: string;
    timeframe: MarketDataTimeframe;
    candles: Candle[];
  }): Promise<CandleUpsertStats> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      const dbSymbol = await this.getSymbolForUpdate(client, {
        exchange,
        market,
        symbol,
      });

      if (!dbSymbol) {
        throw new Error(
          `Symbol ${normalizeStoredSymbol(symbol)} is not available for ${normalizeExchange(exchange)} ${normalizeMarket(market)}.`,
        );
      }

      const stats: CandleUpsertStats = { inserted: 0, updated: 0 };

      for (const candle of candles) {
        const result = await client.query<UpsertCandleRow>(
          `
            INSERT INTO market_candles (
              symbol_id, exchange, market, symbol, timeframe, open_time, close_time,
              open_time_ms, close_time_ms, open, high, low, close, volume,
              quote_volume, trade_count, taker_buy_base_volume,
              taker_buy_quote_volume, created_at, updated_at
            )
            VALUES (
              $1, $2, $3, $4, $5, to_timestamp($6::double precision / 1000),
              to_timestamp($7::double precision / 1000), $6, $7, $8, $9, $10,
              $11, $12, $13, NULL, NULL, NULL, now(), now()
            )
            ON CONFLICT(symbol_id, timeframe, open_time) DO UPDATE SET
              close_time = excluded.close_time,
              open_time_ms = excluded.open_time_ms,
              close_time_ms = excluded.close_time_ms,
              open = excluded.open,
              high = excluded.high,
              low = excluded.low,
              close = excluded.close,
              volume = excluded.volume,
              quote_volume = excluded.quote_volume,
              trade_count = excluded.trade_count,
              taker_buy_base_volume = excluded.taker_buy_base_volume,
              taker_buy_quote_volume = excluded.taker_buy_quote_volume,
              updated_at = now()
            RETURNING (xmax = 0) AS inserted
          `,
          [
            dbSymbol.id,
            dbSymbol.exchange,
            dbSymbol.market,
            dbSymbol.symbol,
            timeframe,
            candle.openTime,
            candle.closeTime,
            candle.open,
            candle.high,
            candle.low,
            candle.close,
            candle.volume,
            candle.quoteVolume ?? null,
          ],
        );

        if (result.rows[0]?.inserted) {
          stats.inserted += 1;
        } else {
          stats.updated += 1;
        }
      }

      await client.query("COMMIT");
      return stats;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async listCandles({
    exchange = "binance",
    market = "spot",
    symbol,
    timeframe,
    limit,
  }: {
    exchange?: string;
    market?: string;
    symbol: string;
    timeframe: string;
    limit: number;
  }) {
    const result = await this.pool.query<CandleRow>(
      `
        SELECT
          id,
          symbol_id,
          symbol,
          timeframe,
          open_time_ms,
          close_time_ms,
          open,
          high,
          low,
          close,
          volume,
          quote_volume
        FROM (
          SELECT *
          FROM market_candles
          WHERE exchange = $1
            AND market = $2
            AND symbol = $3
            AND timeframe = $4
          ORDER BY open_time DESC
          LIMIT $5
        ) recent
        ORDER BY open_time_ms ASC
      `,
      [
        normalizeExchange(exchange),
        normalizeMarket(market),
        normalizeStoredSymbol(symbol),
        timeframe,
        limit,
      ],
    );

    return result.rows.map(toPgCandle);
  }

  async listCandlesForScan({
    exchange = "binance",
    market = "spot",
    symbol,
    timeframe,
    limit,
  }: {
    exchange?: string;
    market?: string;
    symbol: string;
    timeframe: string;
    limit: number;
  }) {
    return this.listCandles({ exchange, market, symbol, timeframe, limit });
  }

  async getLatestCandleOpenTime({
    exchange = "binance",
    market = "spot",
    symbol,
    timeframe,
  }: {
    exchange?: string;
    market?: string;
    symbol: string;
    timeframe: string;
  }) {
    const result = await this.pool.query<LatestCandleRow>(
      `
        SELECT MAX(open_time_ms) AS latest_open_time_ms
        FROM market_candles
        WHERE exchange = $1
          AND market = $2
          AND symbol = $3
          AND timeframe = $4
      `,
      [
        normalizeExchange(exchange),
        normalizeMarket(market),
        normalizeStoredSymbol(symbol),
        timeframe,
      ],
    );

    const latest = result.rows[0]?.latest_open_time_ms;
    return latest === null || latest === undefined ? null : Number(latest);
  }

  async getCandleCoverageForSymbol({
    exchange = "binance",
    market = "spot",
    symbol,
    timeframe,
  }: {
    exchange?: string;
    market?: string;
    symbol: string;
    timeframe: string;
  }): Promise<SymbolCandleCoverage> {
    const result = await this.pool.query<SymbolCandleCoverageRow>(
      `
        SELECT
          COUNT(*) AS candle_count,
          MIN(open_time_ms) AS earliest_open_time_ms,
          MAX(open_time_ms) AS latest_open_time_ms,
          MAX(close_time_ms) AS latest_close_time_ms
        FROM market_candles
        WHERE exchange = $1
          AND market = $2
          AND symbol = $3
          AND timeframe = $4
      `,
      [
        normalizeExchange(exchange),
        normalizeMarket(market),
        normalizeStoredSymbol(symbol),
        timeframe,
      ],
    );
    const row = result.rows[0];

    return {
      candleCount: Number(row?.candle_count ?? 0),
      earliestOpenTimeMs:
        row?.earliest_open_time_ms === null || row?.earliest_open_time_ms === undefined
          ? null
          : Number(row.earliest_open_time_ms),
      latestOpenTimeMs:
        row?.latest_open_time_ms === null || row?.latest_open_time_ms === undefined
          ? null
          : Number(row.latest_open_time_ms),
      latestCloseTimeMs:
        row?.latest_close_time_ms === null || row?.latest_close_time_ms === undefined
          ? null
          : Number(row.latest_close_time_ms),
    };
  }

  async createMarketDataSyncJob(input: MarketDataSyncJobInput) {
    await this.pool.query(
      `
        INSERT INTO market_data_sync_jobs (
          id, exchange, market, timeframe, status, symbols_total, params, started_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, now())
      `,
      [
        input.id,
        normalizeExchange(input.exchange),
        normalizeMarket(input.market),
        input.timeframe,
        input.status,
        input.symbolsTotal,
        JSON.stringify(input.params),
      ],
    );
  }

  async finishMarketDataSyncJob(input: MarketDataSyncJobUpdate) {
    await this.pool.query(
      `
        UPDATE market_data_sync_jobs
        SET
          status = $2,
          symbols_done = $3,
          candles_inserted = $4,
          candles_updated = $5,
          error_message = $6,
          finished_at = now()
        WHERE id = $1
      `,
      [
        input.id,
        input.status,
        input.symbolsDone,
        input.candlesInserted,
        input.candlesUpdated,
        input.errorMessage ?? null,
      ],
    );
  }

  async listMarketDataSyncJobs({ limit = 10 }: { limit?: number } = {}) {
    const result = await this.pool.query<MarketDataSyncJobRow>(
      `
        SELECT
          id,
          exchange,
          market,
          timeframe,
          status,
          symbols_total,
          symbols_done,
          candles_inserted,
          candles_updated,
          error_message,
          params,
          started_at,
          finished_at
        FROM market_data_sync_jobs
        ORDER BY started_at DESC
        LIMIT $1
      `,
      [limit],
    );

    return result.rows.map(toMarketDataSyncJobRecord);
  }

  async listMarketDataCoverage({
    exchange = "binance",
    market = "spot",
    timeframe,
    limit = 100,
    minCandles = 200,
    assetClass = "all",
    includeNonScanner = true,
  }: {
    exchange?: string;
    market?: string;
    timeframe: string;
    limit?: number;
    minCandles?: number;
    assetClass?: SymbolAssetClassFilter;
    includeNonScanner?: boolean;
  }) {
    const staleBeforeMs = Date.now() - getStaleThresholdMs(timeframe);
    const params: unknown[] = [timeframe];
    const filters = ["s.is_enabled = true"];
    addIdentityFilters({ filters, params, exchange, market, alias: "s" });

    if (assetClass !== "all") {
      params.push(assetClass);
      filters.push(`s.asset_class = $${params.length}`);
    }

    if (!includeNonScanner) {
      filters.push("s.is_scanner_eligible = true");
    }

    const result = await this.pool.query<MarketDataCoverageQueryRow>(
      `
        SELECT
          s.id AS symbol_id,
          s.symbol,
          s.asset_class,
          s.is_scanner_eligible,
          s.is_backtest_eligible,
          s.is_market_context,
          COUNT(c.id) AS candle_count,
          MIN(c.open_time) AS first_open_time,
          MAX(c.open_time) AS latest_open_time,
          MAX(c.close_time) AS latest_close_time,
          MAX(c.open_time_ms) AS latest_open_time_ms,
          MAX(c.close_time_ms) AS latest_close_time_ms
        FROM symbols s
        LEFT JOIN market_candles c
          ON c.symbol_id = s.id
          AND c.timeframe = $1
        WHERE ${filters.join("\n          AND ")}
        GROUP BY
          s.id,
          s.symbol,
          s.asset_class,
          s.is_scanner_eligible,
          s.is_backtest_eligible,
          s.is_market_context
        ORDER BY COALESCE(COUNT(c.id), 0) ASC, s.symbol ASC
      `,
      params,
    );
    const allRows = result.rows.map((row) =>
      toMarketDataCoverageRow({
        row,
        timeframe,
        minCandles,
        staleBeforeMs,
      }),
    );
    const rows = allRows.slice(0, limit);
    const summary = summarizeMarketDataCoverage(allRows);

    return { rows, summary };
  }

  async getSymbolsSummary({
    exchange = "binance",
    market = "spot",
    topLimit = 20,
  }: {
    exchange?: string;
    market?: string;
    topLimit?: number;
  } = {}) {
    const countParams: unknown[] = [];
    const topParams: unknown[] = [];
    const countFilters: string[] = [];
    const topFilters = ["is_enabled = true"];
    addIdentityFilters({ filters: countFilters, params: countParams, exchange, market });
    addIdentityFilters({ filters: topFilters, params: topParams, exchange, market });
    topParams.push(topLimit);

    const [countResult, topResult] = await Promise.all([
      this.pool.query<SymbolsSummaryCountRow>(
        `
          SELECT
            asset_class,
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE is_enabled = true) AS enabled,
            COUNT(*) FILTER (WHERE is_scanner_eligible = true) AS scanner_eligible,
            COUNT(*) FILTER (WHERE is_backtest_eligible = true) AS backtest_eligible,
            COUNT(*) FILTER (WHERE is_market_context = true) AS market_context
          FROM symbols
          ${countFilters.length > 0 ? `WHERE ${countFilters.join("\n            AND ")}` : ""}
          GROUP BY asset_class
        `,
        countParams,
      ),
      this.pool.query<TopQuoteVolumeSymbolRow>(
        `
          SELECT
            symbol,
            asset_class,
            quote_volume,
            is_scanner_eligible
          FROM symbols
          WHERE ${topFilters.join("\n            AND ")}
          ORDER BY COALESCE(quote_volume, 0) DESC, symbol ASC
          LIMIT $${topParams.length}
        `,
        topParams,
      ),
    ]);
    const byAssetClass = emptyAssetClassCounts();
    let total = 0;
    let enabled = 0;
    let scannerEligible = 0;
    let backtestEligible = 0;
    let marketContext = 0;

    for (const row of countResult.rows) {
      const assetClass = isSymbolAssetClass(row.asset_class)
        ? row.asset_class
        : "crypto";
      const assetClassTotal = Number(row.total);

      byAssetClass[assetClass] += assetClassTotal;
      total += assetClassTotal;
      enabled += Number(row.enabled);
      scannerEligible += Number(row.scanner_eligible);
      backtestEligible += Number(row.backtest_eligible);
      marketContext += Number(row.market_context);
    }

    return {
      total,
      enabled,
      disabled: total - enabled,
      scannerEligible,
      backtestEligible,
      marketContext,
      byAssetClass,
      topByQuoteVolume: topResult.rows.map((row) => ({
        symbol: row.symbol,
        assetClass: isSymbolAssetClass(row.asset_class) ? row.asset_class : "crypto",
        quoteVolume: toNullableNumber(row.quote_volume),
        isScannerEligible: row.is_scanner_eligible ?? true,
      })),
    } satisfies SymbolsSummary;
  }

  private async getSymbolForUpdate(
    client: PoolClient,
    {
      exchange = "binance",
      market = "spot",
      symbol,
    }: {
      exchange?: string;
      market?: string;
      symbol: string;
    },
  ) {
    const result = await client.query<SymbolRow>(
      `
        SELECT *
        FROM symbols
        WHERE exchange = $1
          AND market = $2
          AND symbol = $3
        LIMIT 1
      `,
      [normalizeExchange(exchange), normalizeMarket(market), normalizeStoredSymbol(symbol)],
    );

    return result.rows[0] ? toPgSymbol(result.rows[0]) : null;
  }
}

function toPgSymbol(row: SymbolRow): PgSymbol {
  const assetClass = isSymbolAssetClass(row.asset_class) ? row.asset_class : "crypto";

  return {
    id: Number(row.id),
    exchange: row.exchange,
    market: row.market,
    symbol: row.symbol,
    baseAsset: row.base_asset,
    quoteAsset: row.quote_asset,
    status: row.status,
    quoteVolume: toNullableNumber(row.quote_volume),
    priceChangePercent: toNullableNumber(row.price_change_percent),
    isEnabled: row.is_enabled,
    assetClass,
    isScannerEligible: row.is_scanner_eligible ?? true,
    isBacktestEligible: row.is_backtest_eligible ?? true,
    isMarketContext: row.is_market_context ?? false,
    metadata: row.metadata ?? {},
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function toPgCandle(row: CandleRow): PgCandle {
  return {
    id: Number(row.id),
    symbolId: Number(row.symbol_id),
    symbol: row.symbol,
    timeframe: row.timeframe,
    openTime: Number(row.open_time_ms),
    closeTime: Number(row.close_time_ms),
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
    volume: Number(row.volume),
    quoteVolume: toNullableNumber(row.quote_volume) ?? undefined,
  };
}

function toMarketDataSyncJobRecord(
  row: MarketDataSyncJobRow,
): MarketDataSyncJobRecord {
  return {
    id: row.id,
    exchange: row.exchange,
    market: row.market,
    timeframe: row.timeframe,
    status: row.status,
    symbolsTotal: row.symbols_total,
    symbolsDone: row.symbols_done,
    candlesInserted: row.candles_inserted,
    candlesUpdated: row.candles_updated,
    errorMessage: row.error_message,
    params: row.params ?? {},
    startedAt: new Date(row.started_at).toISOString(),
    finishedAt: row.finished_at ? new Date(row.finished_at).toISOString() : null,
  };
}

function toMarketDataCoverageRow({
  row,
  timeframe,
  minCandles,
  staleBeforeMs,
}: {
  row: MarketDataCoverageQueryRow;
  timeframe: string;
  minCandles: number;
  staleBeforeMs: number;
}): MarketDataCoverageRow {
  const candleCount = Number(row.candle_count);
  const latestCloseTimeMs =
    row.latest_close_time_ms === null ? null : Number(row.latest_close_time_ms);
  const isBelowScannerMinimum = candleCount < minCandles;
  const isStale = latestCloseTimeMs === null || latestCloseTimeMs < staleBeforeMs;
  const assetClass = isSymbolAssetClass(row.asset_class) ? row.asset_class : "crypto";

  return {
    symbolId: Number(row.symbol_id),
    symbol: row.symbol,
    assetClass,
    isScannerEligible: row.is_scanner_eligible ?? true,
    isBacktestEligible: row.is_backtest_eligible ?? true,
    isMarketContext: row.is_market_context ?? false,
    timeframe,
    candleCount,
    firstOpenTime: row.first_open_time
      ? new Date(row.first_open_time).toISOString()
      : null,
    latestOpenTime: row.latest_open_time
      ? new Date(row.latest_open_time).toISOString()
      : null,
    latestCloseTime: row.latest_close_time
      ? new Date(row.latest_close_time).toISOString()
      : null,
    latestOpenTimeMs:
      row.latest_open_time_ms === null ? null : Number(row.latest_open_time_ms),
    latestCloseTimeMs,
    isBelowScannerMinimum,
    isStale,
  };
}

function summarizeMarketDataCoverage(
  rows: MarketDataCoverageRow[],
): MarketDataCoverageSummary {
  const belowMinimum = rows.filter((row) => row.isBelowScannerMinimum).length;
  const stale = rows.filter((row) => row.isStale).length;
  const byAssetClass = emptyAssetClassCounts();

  for (const row of rows) {
    byAssetClass[row.assetClass] += 1;
  }

  return {
    totalSymbols: rows.length,
    healthy: rows.length - new Set([
      ...rows
        .filter((row) => row.isBelowScannerMinimum || row.isStale)
        .map((row) => row.symbol),
    ]).size,
    belowMinimum,
    stale,
    scannerEligible: rows.filter((row) => row.isScannerEligible).length,
    marketContext: rows.filter((row) => row.isMarketContext).length,
    byAssetClass,
  };
}

function getStaleThresholdMs(timeframe: string) {
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;

  switch (timeframe) {
    case "1h":
      return 3 * hour;
    case "4h":
      return 12 * hour;
    case "1d":
      return 3 * day;
    case "1w":
      return 14 * day;
    default:
      return 24 * hour;
  }
}

function toNullableNumber(value: number | string | null) {
  return value === null ? null : Number(value);
}

function addIdentityFilters({
  filters,
  params,
  exchange,
  market,
  alias,
}: {
  filters: string[];
  params: unknown[];
  exchange?: string;
  market?: string;
  alias?: string;
}) {
  const normalizedExchange = normalizeExchange(exchange);
  const normalizedMarket = normalizeMarket(market);
  const prefix = alias ? `${alias}.` : "";

  if (normalizedExchange !== "all") {
    params.push(normalizedExchange);
    filters.push(`${prefix}exchange = $${params.length}`);
  }

  if (normalizedMarket !== "all") {
    params.push(normalizedMarket);
    filters.push(`${prefix}market = $${params.length}`);
  }
}

function normalizeExchange(value: string | undefined) {
  return value?.trim().toLowerCase() || "binance";
}

function normalizeMarket(value: string | undefined) {
  return value?.trim().toLowerCase() || "spot";
}

function normalizeStoredSymbol(value: string) {
  return value.trim().toUpperCase();
}
