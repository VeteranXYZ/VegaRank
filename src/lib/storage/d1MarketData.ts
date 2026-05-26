import type { Candle, Exchange, Market, Timeframe } from "@/lib/exchanges/types";
import { getD1Database, isMissingD1TableError, type D1Database } from "./d1";
import {
  emptyMarketDataSummary,
  type MarketCandleStats,
  type MarketDataStoreLike,
  type MarketDataSummary,
  type MarketDataSyncState,
  type MarketDataSyncStatus,
} from "./marketDataModel";

const BATCH_SIZE = 100;

type MarketRow = {
  exchange: Exchange;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
  quoteVolume: number | null;
  priceChangePercent: number | null;
};

type CandleRow = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
};

type SyncStateRow = {
  exchange: Exchange;
  symbol: string;
  timeframe: Timeframe;
  status: MarketDataSyncStatus;
  firstOpenTime: number | null;
  lastOpenTime: number | null;
  lastCloseTime: number | null;
  candleCount: number;
  lastSyncedAt: string | null;
  errorMessage: string | null;
};

export async function createD1MarketDataStore() {
  const db = await getD1Database();

  if (!db) {
    throw new Error("D1 binding DB is not configured.");
  }

  return new D1MarketDataStore(db);
}

export class D1MarketDataStore implements MarketDataStoreLike {
  constructor(private readonly db: D1Database) {}

  close() {}

  async upsertMarkets(markets: Market[]) {
    const updatedAt = new Date().toISOString();
    const statements = markets.map((market) =>
      this.db
        .prepare(
          `
          INSERT INTO markets (
            exchange,
            symbol,
            base_asset,
            quote_asset,
            status,
            quote_volume,
            price_change_percent,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(exchange, symbol) DO UPDATE SET
            base_asset = excluded.base_asset,
            quote_asset = excluded.quote_asset,
            status = excluded.status,
            quote_volume = excluded.quote_volume,
            price_change_percent = excluded.price_change_percent,
            updated_at = excluded.updated_at
        `,
        )
        .bind(
          market.exchange,
          market.symbol.toUpperCase(),
          market.baseAsset,
          market.quoteAsset,
          market.status,
          market.quoteVolume ?? null,
          market.priceChangePercent ?? null,
          updatedAt,
        ),
    );

    await runBatches(this.db, statements);
  }

  async getMarkets(exchange: Exchange = "binance") {
    const { results = [] } = await this.db
      .prepare(
        `
        SELECT
          exchange,
          symbol,
          base_asset AS baseAsset,
          quote_asset AS quoteAsset,
          status,
          quote_volume AS quoteVolume,
          price_change_percent AS priceChangePercent
        FROM markets
        WHERE exchange = ?
        ORDER BY COALESCE(quote_volume, 0) DESC, symbol ASC
      `,
      )
      .bind(exchange)
      .all<MarketRow>()
      .catch((error: unknown) => {
        if (isMissingD1TableError(error)) {
          return { results: [] };
        }

        throw error;
      });

    return results.map(toMarket);
  }

  async upsertCandles({
    exchange = "binance",
    symbol,
    timeframe,
    candles,
  }: {
    exchange?: Exchange;
    symbol: string;
    timeframe: Timeframe;
    candles: Candle[];
  }) {
    const normalizedSymbol = symbol.toUpperCase();
    const statements = candles.map((candle) =>
      this.db
        .prepare(
          `
          INSERT INTO candles (
            exchange,
            symbol,
            timeframe,
            open_time,
            open,
            high,
            low,
            close,
            volume,
            close_time
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(exchange, symbol, timeframe, open_time) DO UPDATE SET
            open = excluded.open,
            high = excluded.high,
            low = excluded.low,
            close = excluded.close,
            volume = excluded.volume,
            close_time = excluded.close_time
        `,
        )
        .bind(
          exchange,
          normalizedSymbol,
          timeframe,
          candle.openTime,
          candle.open,
          candle.high,
          candle.low,
          candle.close,
          candle.volume,
          candle.closeTime,
        ),
    );

    await runBatches(this.db, statements);
  }

  async getCandles({
    exchange = "binance",
    symbol,
    timeframe,
    limit,
  }: {
    exchange?: Exchange;
    symbol: string;
    timeframe: Timeframe;
    limit?: number;
  }) {
    const { results = [] } = await this.db
      .prepare(
        `
        SELECT
          open_time AS openTime,
          open,
          high,
          low,
          close,
          volume,
          close_time AS closeTime
        FROM (
          SELECT *
          FROM candles
          WHERE exchange = ? AND symbol = ? AND timeframe = ?
          ORDER BY open_time DESC
          LIMIT ?
        )
        ORDER BY open_time ASC
      `,
      )
      .bind(exchange, symbol.toUpperCase(), timeframe, limit ?? Number.MAX_SAFE_INTEGER)
      .all<CandleRow>()
      .catch((error: unknown) => {
        if (isMissingD1TableError(error)) {
          return { results: [] };
        }

        throw error;
      });

    return results.map(toCandle);
  }

  async getLatestCandleOpenTime({
    exchange = "binance",
    symbol,
    timeframe,
  }: {
    exchange?: Exchange;
    symbol: string;
    timeframe: Timeframe;
  }) {
    const row = await this.db
      .prepare(
        `
        SELECT MAX(open_time) AS latestOpenTime
        FROM candles
        WHERE exchange = ? AND symbol = ? AND timeframe = ?
      `,
      )
      .bind(exchange, symbol.toUpperCase(), timeframe)
      .first<{ latestOpenTime: number | null }>()
      .catch((error: unknown) => {
        if (isMissingD1TableError(error)) {
          return null;
        }

        throw error;
      });

    return row?.latestOpenTime ?? null;
  }

  async getCandleStats({
    exchange = "binance",
    symbol,
    timeframe,
  }: {
    exchange?: Exchange;
    symbol: string;
    timeframe: Timeframe;
  }): Promise<MarketCandleStats> {
    const row = await this.db
      .prepare(
        `
        SELECT
          MIN(open_time) AS firstOpenTime,
          MAX(open_time) AS lastOpenTime,
          MAX(close_time) AS lastCloseTime,
          COUNT(*) AS candleCount
        FROM candles
        WHERE exchange = ? AND symbol = ? AND timeframe = ?
      `,
      )
      .bind(exchange, symbol.toUpperCase(), timeframe)
      .first<MarketCandleStats>()
      .catch((error: unknown) => {
        if (isMissingD1TableError(error)) {
          return null;
        }

        throw error;
      });

    return {
      firstOpenTime: row?.firstOpenTime ?? null,
      lastOpenTime: row?.lastOpenTime ?? null,
      lastCloseTime: row?.lastCloseTime ?? null,
      candleCount: row?.candleCount ?? 0,
    };
  }

  async upsertSyncState(state: MarketDataSyncState) {
    await this.db
      .prepare(
        `
        INSERT INTO sync_state (
          exchange,
          symbol,
          timeframe,
          status,
          first_open_time,
          last_open_time,
          last_close_time,
          candle_count,
          last_synced_at,
          error_message
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(exchange, symbol, timeframe) DO UPDATE SET
          status = excluded.status,
          first_open_time = excluded.first_open_time,
          last_open_time = excluded.last_open_time,
          last_close_time = excluded.last_close_time,
          candle_count = excluded.candle_count,
          last_synced_at = excluded.last_synced_at,
          error_message = excluded.error_message
      `,
      )
      .bind(
        state.exchange,
        state.symbol.toUpperCase(),
        state.timeframe,
        state.status,
        state.firstOpenTime,
        state.lastOpenTime,
        state.lastCloseTime,
        state.candleCount,
        state.lastSyncedAt,
        state.errorMessage,
      )
      .run();
  }

  async getSyncState({
    exchange = "binance",
    symbol,
    timeframe,
  }: {
    exchange?: Exchange;
    symbol: string;
    timeframe: Timeframe;
  }) {
    const row = await this.db
      .prepare(
        `
        SELECT
          exchange,
          symbol,
          timeframe,
          status,
          first_open_time AS firstOpenTime,
          last_open_time AS lastOpenTime,
          last_close_time AS lastCloseTime,
          candle_count AS candleCount,
          last_synced_at AS lastSyncedAt,
          error_message AS errorMessage
        FROM sync_state
        WHERE exchange = ? AND symbol = ? AND timeframe = ?
      `,
      )
      .bind(exchange, symbol.toUpperCase(), timeframe)
      .first<SyncStateRow>()
      .catch((error: unknown) => {
        if (isMissingD1TableError(error)) {
          return null;
        }

        throw error;
      });

    return row ? toSyncState(row) : null;
  }

  async getSummary(): Promise<MarketDataSummary> {
    try {
      const marketRow = await this.db
        .prepare("SELECT COUNT(*) AS count FROM markets")
        .first<{ count: number }>();
      const candleRow = await this.db
        .prepare("SELECT COUNT(*) AS count FROM candles")
        .first<{ count: number }>();
      const syncRow = await this.db
        .prepare(
          `
          SELECT
            COUNT(*) AS syncedPairs,
            MAX(last_synced_at) AS latestSyncedAt,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failedPairs
          FROM sync_state
        `,
        )
        .first<{
          syncedPairs: number;
          latestSyncedAt: string | null;
          failedPairs: number | null;
        }>();

      return {
        marketCount: marketRow?.count ?? 0,
        candleCount: candleRow?.count ?? 0,
        syncedPairs: syncRow?.syncedPairs ?? 0,
        latestSyncedAt: syncRow?.latestSyncedAt ?? null,
        failedPairs: syncRow?.failedPairs ?? 0,
      };
    } catch (error) {
      if (isMissingD1TableError(error)) {
        return emptyMarketDataSummary;
      }

      throw error;
    }
  }
}

async function runBatches(
  db: D1Database,
  statements: ReturnType<D1Database["prepare"]>[],
) {
  for (let index = 0; index < statements.length; index += BATCH_SIZE) {
    const chunk = statements.slice(index, index + BATCH_SIZE);

    if (chunk.length === 0) {
      continue;
    }

    if (db.batch) {
      await db.batch(chunk);
      continue;
    }

    await Promise.all(chunk.map((statement) => statement.run()));
  }
}

function toMarket(row: MarketRow): Market {
  return {
    exchange: row.exchange,
    symbol: row.symbol,
    baseAsset: row.baseAsset,
    quoteAsset: row.quoteAsset,
    status: row.status,
    quoteVolume: row.quoteVolume ?? undefined,
    priceChangePercent: row.priceChangePercent ?? undefined,
  };
}

function toCandle(row: CandleRow): Candle {
  return {
    openTime: row.openTime,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume,
    closeTime: row.closeTime,
  };
}

function toSyncState(row: SyncStateRow): MarketDataSyncState {
  return {
    exchange: row.exchange,
    symbol: row.symbol,
    timeframe: row.timeframe,
    status: row.status,
    firstOpenTime: row.firstOpenTime,
    lastOpenTime: row.lastOpenTime,
    lastCloseTime: row.lastCloseTime,
    candleCount: row.candleCount,
    lastSyncedAt: row.lastSyncedAt,
    errorMessage: row.errorMessage,
  };
}
