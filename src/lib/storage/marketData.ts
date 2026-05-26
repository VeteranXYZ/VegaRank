import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Candle, Exchange, Market, Timeframe } from "@/lib/exchanges/types";
import type {
  MarketCandleStats,
  MarketDataStoreLike,
  MarketDataSummary,
  MarketDataSyncState,
  MarketDataSyncStatus,
} from "./marketDataModel";

export type {
  MarketCandleStats,
  MarketDataStoreLike,
  MarketDataSummary,
  MarketDataSyncState,
  MarketDataSyncStatus,
} from "./marketDataModel";

export class MarketDataStore implements MarketDataStoreLike {
  private readonly db: DatabaseSync;

  constructor(dbPath = getDefaultMarketDataDbPath()) {
    if (dbPath !== ":memory:") {
      mkdirSync(path.dirname(dbPath), { recursive: true });
    }

    this.db = new DatabaseSync(dbPath);
    this.initialize();
  }

  close() {
    this.db.close();
  }

  upsertMarkets(markets: Market[]) {
    const statement = this.db.prepare(`
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
    `);
    const updatedAt = new Date().toISOString();

    this.transaction(() => {
      for (const market of markets) {
        statement.run(
          market.exchange,
          market.symbol,
          market.baseAsset,
          market.quoteAsset,
          market.status,
          market.quoteVolume ?? null,
          market.priceChangePercent ?? null,
          updatedAt,
        );
      }
    });
  }

  getMarkets(exchange: Exchange = "binance") {
    const rows = this.db
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
      .all(exchange) as MarketRow[];

    return rows.map(toMarket);
  }

  upsertCandles({
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
    const statement = this.db.prepare(`
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
    `);

    this.transaction(() => {
      for (const candle of candles) {
        statement.run(
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
        );
      }
    });
  }

  getCandles({
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
    const normalizedSymbol = symbol.toUpperCase();
    const rows = this.db
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
      .all(exchange, normalizedSymbol, timeframe, limit ?? Number.MAX_SAFE_INTEGER) as
      CandleRow[];

    return rows.map(toCandle);
  }

  getLatestCandleOpenTime({
    exchange = "binance",
    symbol,
    timeframe,
  }: {
    exchange?: Exchange;
    symbol: string;
    timeframe: Timeframe;
  }) {
    const row = this.db
      .prepare(
        `
        SELECT MAX(open_time) AS latestOpenTime
        FROM candles
        WHERE exchange = ? AND symbol = ? AND timeframe = ?
      `,
      )
      .get(exchange, symbol.toUpperCase(), timeframe) as
      | { latestOpenTime: number | null }
      | undefined;

    return row?.latestOpenTime ?? null;
  }

  getCandleStats({
    exchange = "binance",
    symbol,
    timeframe,
  }: {
    exchange?: Exchange;
    symbol: string;
    timeframe: Timeframe;
  }): MarketCandleStats {
    const row = this.db
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
      .get(exchange, symbol.toUpperCase(), timeframe) as
      | {
          firstOpenTime: number | null;
          lastOpenTime: number | null;
          lastCloseTime: number | null;
          candleCount: number;
        }
      | undefined;

    return {
      firstOpenTime: row?.firstOpenTime ?? null,
      lastOpenTime: row?.lastOpenTime ?? null,
      lastCloseTime: row?.lastCloseTime ?? null,
      candleCount: row?.candleCount ?? 0,
    };
  }

  upsertSyncState(state: MarketDataSyncState) {
    this.db
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
      .run(
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
      );
  }

  getSyncState({
    exchange = "binance",
    symbol,
    timeframe,
  }: {
    exchange?: Exchange;
    symbol: string;
    timeframe: Timeframe;
  }) {
    const row = this.db
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
      .get(exchange, symbol.toUpperCase(), timeframe) as SyncStateRow | undefined;

    return row ? toSyncState(row) : null;
  }

  getSummary(): MarketDataSummary {
    const marketRow = this.db
      .prepare("SELECT COUNT(*) AS count FROM markets")
      .get() as CountRow;
    const candleRow = this.db
      .prepare("SELECT COUNT(*) AS count FROM candles")
      .get() as CountRow;
    const syncRow = this.db
      .prepare(
        `
        SELECT
          COUNT(*) AS syncedPairs,
          MAX(last_synced_at) AS latestSyncedAt,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failedPairs
        FROM sync_state
      `,
      )
      .get() as {
      syncedPairs: number;
      latestSyncedAt: string | null;
      failedPairs: number | null;
    };

    return {
      marketCount: marketRow.count,
      candleCount: candleRow.count,
      syncedPairs: syncRow.syncedPairs,
      latestSyncedAt: syncRow.latestSyncedAt,
      failedPairs: syncRow.failedPairs ?? 0,
    };
  }

  private initialize() {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS markets (
        exchange TEXT NOT NULL,
        symbol TEXT NOT NULL,
        base_asset TEXT NOT NULL,
        quote_asset TEXT NOT NULL,
        status TEXT NOT NULL,
        quote_volume REAL,
        price_change_percent REAL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (exchange, symbol)
      );

      CREATE TABLE IF NOT EXISTS candles (
        exchange TEXT NOT NULL,
        symbol TEXT NOT NULL,
        timeframe TEXT NOT NULL,
        open_time INTEGER NOT NULL,
        open REAL NOT NULL,
        high REAL NOT NULL,
        low REAL NOT NULL,
        close REAL NOT NULL,
        volume REAL NOT NULL,
        close_time INTEGER NOT NULL,
        PRIMARY KEY (exchange, symbol, timeframe, open_time),
        FOREIGN KEY (exchange, symbol)
          REFERENCES markets(exchange, symbol)
          ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS candles_lookup_idx
        ON candles(exchange, symbol, timeframe, open_time DESC);

      CREATE TABLE IF NOT EXISTS sync_state (
        exchange TEXT NOT NULL,
        symbol TEXT NOT NULL,
        timeframe TEXT NOT NULL,
        status TEXT NOT NULL,
        first_open_time INTEGER,
        last_open_time INTEGER,
        last_close_time INTEGER,
        candle_count INTEGER NOT NULL DEFAULT 0,
        last_synced_at TEXT,
        error_message TEXT,
        PRIMARY KEY (exchange, symbol, timeframe),
        FOREIGN KEY (exchange, symbol)
          REFERENCES markets(exchange, symbol)
          ON DELETE CASCADE
      );
    `);
  }

  private transaction(callback: () => void) {
    this.db.exec("BEGIN");

    try {
      callback();
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
}

export function getDefaultMarketDataDbPath() {
  return path.join(process.cwd(), ".data", "market-data.sqlite");
}

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

type CountRow = {
  count: number;
};

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
