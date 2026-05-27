import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Candle, Exchange, Market, Timeframe } from "@/lib/exchanges/types";
import { safeJsonParse, safeJsonStringify } from "./json";
import type {
  MarketCandleStats,
  MarketCandleUpsertStats,
  MarketDataSyncJob,
  MarketDataSyncJobError,
  MarketDataSyncJobInput,
  MarketDataSyncJobStatus,
  MarketDataSyncJobUpdate,
  MarketDataStoreLike,
  MarketDataSummary,
  MarketDataSyncState,
  MarketDataSyncStatus,
} from "./marketDataModel";
import { initializeMarketDataSchema } from "./sqlite/schema";

export type {
  MarketCandleStats,
  MarketCandleUpsertStats,
  MarketDataSyncJob,
  MarketDataSyncJobError,
  MarketDataSyncJobInput,
  MarketDataSyncJobStatus,
  MarketDataSyncJobUpdate,
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
  }): MarketCandleUpsertStats {
    return this.saveCandles({ exchange, symbol, timeframe, candles });
  }

  saveCandles({
    exchange = "binance",
    symbol,
    timeframe,
    candles,
  }: {
    exchange?: Exchange;
    symbol: string;
    timeframe: Timeframe;
    candles: Candle[];
  }): MarketCandleUpsertStats {
    const normalizedSymbol = symbol.toUpperCase();
    const existsStatement = this.db.prepare(`
      SELECT 1
      FROM market_candles
      WHERE market = 'spot'
        AND source = ?
        AND symbol = ?
        AND timeframe = ?
        AND open_time = ?
      LIMIT 1
    `);
    const marketCandleStatement = this.db.prepare(`
      INSERT INTO market_candles (
        id,
        market,
        source,
        symbol,
        timeframe,
        open_time,
        close_time,
        open,
        high,
        low,
        close,
        volume,
        quote_volume,
        trade_count,
        taker_buy_base_volume,
        taker_buy_quote_volume,
        created_at,
        updated_at
      )
      VALUES (?, 'spot', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(market, source, symbol, timeframe, open_time) DO UPDATE SET
        close_time = excluded.close_time,
        open = excluded.open,
        high = excluded.high,
        low = excluded.low,
        close = excluded.close,
        volume = excluded.volume,
        quote_volume = excluded.quote_volume,
        trade_count = excluded.trade_count,
        taker_buy_base_volume = excluded.taker_buy_base_volume,
        taker_buy_quote_volume = excluded.taker_buy_quote_volume,
        updated_at = excluded.updated_at
    `);
    const legacyStatement = this.db.prepare(`
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
    const now = new Date().toISOString();
    const stats: MarketCandleUpsertStats = {
      received: candles.length,
      inserted: 0,
      updated: 0,
    };

    this.transaction(() => {
      for (const candle of candles) {
        const existing = existsStatement.get(
          exchange,
          normalizedSymbol,
          timeframe,
          candle.openTime,
        );
        marketCandleStatement.run(
          createCandleId({
            source: exchange,
            symbol: normalizedSymbol,
            timeframe,
            openTime: candle.openTime,
          }),
          exchange,
          normalizedSymbol,
          timeframe,
          candle.openTime,
          candle.closeTime,
          candle.open,
          candle.high,
          candle.low,
          candle.close,
          candle.volume,
          candle.quoteVolume ?? null,
          null,
          null,
          null,
          now,
          now,
        );
        if (existing) {
          stats.updated += 1;
        } else {
          stats.inserted += 1;
        }
        legacyStatement.run(
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

    return stats;
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
    const marketRows = this.db
      .prepare(
        `
        SELECT
          open_time AS openTime,
          open,
          high,
          low,
          close,
          volume,
          quote_volume AS quoteVolume,
          close_time AS closeTime
        FROM (
          SELECT *
          FROM market_candles
          WHERE source = ? AND symbol = ? AND timeframe = ?
          ORDER BY open_time DESC
          LIMIT ?
        )
        ORDER BY open_time ASC
      `,
      )
      .all(exchange, normalizedSymbol, timeframe, limit ?? Number.MAX_SAFE_INTEGER) as
      CandleRow[];

    if (marketRows.length > 0) {
      return marketRows.map(toCandle);
    }

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
    return this.getLatestCandleTime({ exchange, symbol, timeframe });
  }

  getLatestCandleTime({
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
        FROM market_candles
        WHERE source = ? AND symbol = ? AND timeframe = ?
      `,
      )
      .get(exchange, symbol.toUpperCase(), timeframe) as
      | { latestOpenTime: number | null }
      | undefined;

    if (row?.latestOpenTime !== null && row?.latestOpenTime !== undefined) {
      return row.latestOpenTime;
    }

    const legacyRow = this.db
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

    return legacyRow?.latestOpenTime ?? null;
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
    return this.getCandleCoverage({ exchange, symbol, timeframe });
  }

  getCandleCoverage({
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
        FROM market_candles
        WHERE source = ? AND symbol = ? AND timeframe = ?
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

    if (row && row.candleCount > 0) {
      return {
        firstOpenTime: row.firstOpenTime,
        lastOpenTime: row.lastOpenTime,
        lastCloseTime: row.lastCloseTime,
        candleCount: row.candleCount,
      };
    }

    const legacyRow = this.db
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
      firstOpenTime: legacyRow?.firstOpenTime ?? null,
      lastOpenTime: legacyRow?.lastOpenTime ?? null,
      lastCloseTime: legacyRow?.lastCloseTime ?? null,
      candleCount: legacyRow?.candleCount ?? 0,
    };
  }

  createMarketDataSyncJob(input: MarketDataSyncJobInput): MarketDataSyncJob {
    const now = new Date().toISOString();
    const job: MarketDataSyncJob = {
      id: input.id ?? `market-sync-${Date.now()}-${randomUUID()}`,
      source: input.source ?? "binance",
      universe: input.universe ?? null,
      symbols: input.symbols.map((symbol) => symbol.toUpperCase()),
      timeframe: input.timeframe,
      status: input.status ?? "running",
      startedAt: now,
      finishedAt: null,
      requestedSymbols: input.symbols.length,
      syncedSymbols: 0,
      failedSymbols: 0,
      candlesFetched: 0,
      candlesInserted: 0,
      candlesUpdated: 0,
      errors: input.errors ?? [],
      errorMessage: null,
      metadata: input.metadata ?? {},
    };

    this.db
      .prepare(
        `
        INSERT INTO market_data_sync_jobs (
          id, source, universe, symbols_json, timeframe, status, started_at,
          finished_at, requested_symbols, synced_symbols, failed_symbols,
          candles_fetched, candles_inserted, candles_updated, error_message,
          errors_json, metadata_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        job.id,
        job.source,
        job.universe,
        safeJsonStringify(job.symbols),
        job.timeframe,
        job.status,
        job.startedAt,
        job.finishedAt,
        job.requestedSymbols,
        job.syncedSymbols,
        job.failedSymbols,
        job.candlesFetched,
        job.candlesInserted,
        job.candlesUpdated,
        job.errorMessage,
        safeJsonStringify(job.errors),
        safeJsonStringify(job.metadata),
      );

    return job;
  }

  finishMarketDataSyncJob(input: MarketDataSyncJobUpdate) {
    const existing = this.getMarketDataSyncJob(input.id);
    if (!existing) {
      return null;
    }

    const metadata = input.metadata
      ? { ...existing.metadata, ...input.metadata }
      : existing.metadata;
    this.db
      .prepare(
        `
        UPDATE market_data_sync_jobs
        SET
          status = ?,
          finished_at = ?,
          synced_symbols = ?,
          failed_symbols = ?,
          candles_fetched = ?,
          candles_inserted = ?,
          candles_updated = ?,
          error_message = ?,
          errors_json = ?,
          metadata_json = ?
        WHERE id = ?
      `,
      )
      .run(
        input.status,
        new Date().toISOString(),
        input.syncedSymbols ?? existing.syncedSymbols,
        input.failedSymbols ?? existing.failedSymbols,
        input.candlesFetched ?? existing.candlesFetched,
        input.candlesInserted ?? existing.candlesInserted,
        input.candlesUpdated ?? existing.candlesUpdated,
        input.errorMessage ?? null,
        safeJsonStringify(input.errors ?? existing.errors),
        safeJsonStringify(metadata),
        input.id,
      );

    return this.getMarketDataSyncJob(input.id);
  }

  listMarketDataSyncJobs({
    limit = 20,
    status,
  }: {
    limit?: number;
    status?: MarketDataSyncJobStatus;
  } = {}) {
    const rows = status
      ? this.db
          .prepare(
            `
            SELECT *
            FROM market_data_sync_jobs
            WHERE status = ?
            ORDER BY started_at DESC
            LIMIT ?
          `,
          )
          .all(status, limit)
      : this.db
          .prepare(
            `
            SELECT *
            FROM market_data_sync_jobs
            ORDER BY started_at DESC
            LIMIT ?
          `,
          )
          .all(limit);

    return (rows as MarketDataSyncJobRow[]).map(toMarketDataSyncJob);
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
      .prepare(
        `
        SELECT
          (SELECT COUNT(*) FROM market_candles) AS count,
          (SELECT COUNT(*) FROM candles) AS legacyCount
      `,
      )
      .get() as CountRow & { legacyCount: number };
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
      candleCount: candleRow.count > 0 ? candleRow.count : candleRow.legacyCount,
      syncedPairs: syncRow.syncedPairs,
      latestSyncedAt: syncRow.latestSyncedAt,
      failedPairs: syncRow.failedPairs ?? 0,
    };
  }

  private initialize() {
    initializeMarketDataSchema(this.db);
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

  private getMarketDataSyncJob(id: string) {
    const row = this.db
      .prepare("SELECT * FROM market_data_sync_jobs WHERE id = ?")
      .get(id) as MarketDataSyncJobRow | undefined;

    return row ? toMarketDataSyncJob(row) : null;
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
  return process.env.MARKET_DATA_DB_PATH
    ? path.resolve(process.cwd(), process.env.MARKET_DATA_DB_PATH)
    : path.join(process.cwd(), ".data", "market-data.sqlite");
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
  quoteVolume?: number | null;
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

type MarketDataSyncJobRow = {
  id: string;
  source: string;
  universe: string | null;
  symbols_json: string;
  timeframe: Timeframe;
  status: MarketDataSyncJobStatus;
  started_at: string;
  finished_at: string | null;
  requested_symbols: number;
  synced_symbols: number;
  failed_symbols: number;
  candles_fetched: number;
  candles_inserted: number;
  candles_updated: number;
  error_message: string | null;
  errors_json: string | null;
  metadata_json: string | null;
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
    quoteVolume: row.quoteVolume ?? undefined,
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

function toMarketDataSyncJob(row: MarketDataSyncJobRow): MarketDataSyncJob {
  const symbols = safeJsonParse<unknown>(row.symbols_json, []);
  const errors = safeJsonParse<unknown>(row.errors_json, []);
  const metadata = safeJsonParse<unknown>(row.metadata_json, {});

  return {
    id: row.id,
    source: row.source,
    universe: row.universe,
    symbols: Array.isArray(symbols)
      ? symbols.filter((item): item is string => typeof item === "string")
      : [],
    timeframe: row.timeframe,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    requestedSymbols: row.requested_symbols,
    syncedSymbols: row.synced_symbols,
    failedSymbols: row.failed_symbols,
    candlesFetched: row.candles_fetched,
    candlesInserted: row.candles_inserted,
    candlesUpdated: row.candles_updated,
    errors: parseSyncJobErrors(errors),
    errorMessage: row.error_message,
    metadata:
      metadata && typeof metadata === "object" && !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>)
        : {},
  };
}

function parseSyncJobErrors(value: unknown): MarketDataSyncJobError[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is MarketDataSyncJobError =>
        item !== null &&
        typeof item === "object" &&
        typeof (item as MarketDataSyncJobError).symbol === "string" &&
        typeof (item as MarketDataSyncJobError).timeframe === "string" &&
        typeof (item as MarketDataSyncJobError).message === "string",
    )
    .map((item) => ({
      symbol: item.symbol,
      timeframe: item.timeframe,
      message: item.message,
    }));
}

function createCandleId({
  source,
  symbol,
  timeframe,
  openTime,
}: {
  source: string;
  symbol: string;
  timeframe: Timeframe;
  openTime: number;
}) {
  return `${source}:${symbol}:${timeframe}:${openTime}`;
}
