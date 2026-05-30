import type { Pool, PoolClient } from "pg";
import type { Candle, Market } from "@/lib/exchanges/types";
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
  metadata: Record<string, unknown>;
  updatedAt: string;
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
      const result = await this.pool.query<SymbolRow>(
        `
          INSERT INTO symbols (
            exchange, market, symbol, base_asset, quote_asset, status,
            quote_volume, price_change_percent, is_enabled, metadata, updated_at
          )
          VALUES ($1, 'spot', $2, $3, $4, $5, $6, $7, true, '{}'::jsonb, now())
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
          market.exchange,
          market.symbol.toUpperCase(),
          market.baseAsset,
          market.quoteAsset,
          market.status,
          market.quoteVolume ?? null,
          market.priceChangePercent ?? null,
        ],
      );

      rows.push(toPgSymbol(result.rows[0]));
    }

    return rows;
  }

  async listSymbols({ limit = 500 }: { limit?: number } = {}) {
    const result = await this.pool.query<SymbolRow>(
      `
        SELECT *
        FROM symbols
        WHERE is_enabled = true
        ORDER BY COALESCE(quote_volume, 0) DESC, symbol ASC
        LIMIT $1
      `,
      [limit],
    );

    return result.rows.map(toPgSymbol);
  }

  async getSymbol(symbol: string) {
    const result = await this.pool.query<SymbolRow>(
      `
        SELECT *
        FROM symbols
        WHERE exchange = 'binance'
          AND market = 'spot'
          AND symbol = $1
        LIMIT 1
      `,
      [symbol.toUpperCase()],
    );

    return result.rows[0] ? toPgSymbol(result.rows[0]) : null;
  }

  async upsertCandles({
    symbol,
    timeframe,
    candles,
  }: {
    symbol: string;
    timeframe: MarketDataTimeframe;
    candles: Candle[];
  }): Promise<CandleUpsertStats> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      const dbSymbol = await this.getSymbolForUpdate(client, symbol);

      if (!dbSymbol) {
        throw new Error(`Symbol ${symbol.toUpperCase()} is not available in symbols.`);
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
    symbol,
    timeframe,
    limit,
  }: {
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
          WHERE exchange = 'binance'
            AND market = 'spot'
            AND symbol = $1
            AND timeframe = $2
          ORDER BY open_time DESC
          LIMIT $3
        ) recent
        ORDER BY open_time_ms ASC
      `,
      [symbol.toUpperCase(), timeframe, limit],
    );

    return result.rows.map(toPgCandle);
  }

  async createMarketDataSyncJob(input: MarketDataSyncJobInput) {
    await this.pool.query(
      `
        INSERT INTO market_data_sync_jobs (
          id, exchange, market, timeframe, status, symbols_total, params, started_at
        )
        VALUES ($1, 'binance', 'spot', $2, $3, $4, $5::jsonb, now())
      `,
      [
        input.id,
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

  private async getSymbolForUpdate(client: PoolClient, symbol: string) {
    const result = await client.query<SymbolRow>(
      `
        SELECT *
        FROM symbols
        WHERE exchange = 'binance'
          AND market = 'spot'
          AND symbol = $1
        LIMIT 1
      `,
      [symbol.toUpperCase()],
    );

    return result.rows[0] ? toPgSymbol(result.rows[0]) : null;
  }
}

function toPgSymbol(row: SymbolRow): PgSymbol {
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

function toNullableNumber(value: number | string | null) {
  return value === null ? null : Number(value);
}
