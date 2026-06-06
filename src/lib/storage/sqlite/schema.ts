import type { DatabaseSync } from "node:sqlite";

export function initializeScannerResearchSchema(db: DatabaseSync) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS scan_snapshots (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      total_symbols INTEGER NOT NULL,
      source TEXT,
      scanner_version TEXT,
      scoring_version TEXT NOT NULL,
      market_context_json TEXT,
      metadata_json TEXT
    );

    CREATE INDEX IF NOT EXISTS scan_snapshots_created_at_idx
      ON scan_snapshots(created_at);
    CREATE INDEX IF NOT EXISTS scan_snapshots_timeframe_idx
      ON scan_snapshots(timeframe);
    CREATE INDEX IF NOT EXISTS scan_snapshots_scoring_version_idx
      ON scan_snapshots(scoring_version);

    CREATE TABLE IF NOT EXISTS scan_signals (
      id TEXT PRIMARY KEY,
      snapshot_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      scan_time TEXT NOT NULL,
      price_at_signal REAL,
      final_signal_score REAL,
      opportunity_score REAL,
      confirmation_score REAL,
      risk_score REAL,
      trend_score REAL,
      momentum_score REAL,
      volume_score REAL,
      structure_score REAL,
      signal_label TEXT,
      action_bias TEXT,
      primary_structure TEXT,
      secondary_structures_json TEXT,
      detected_risk_types_json TEXT,
      bullish_observations_json TEXT,
      bearish_observations_json TEXT,
      risk_observations_json TEXT,
      neutral_observations_json TEXT,
      next_confirmation_observations_json TEXT,
      invalidation_observations_json TEXT,
      raw_metrics_json TEXT,
      legacy_signal TEXT,
      legacy_rank_score REAL,
      legacy_warnings_json TEXT,
      scoring_version TEXT NOT NULL,
      scanner_version TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (snapshot_id)
        REFERENCES scan_snapshots(id)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS scan_signals_snapshot_id_idx
      ON scan_signals(snapshot_id);
    CREATE INDEX IF NOT EXISTS scan_signals_symbol_timeframe_scan_time_idx
      ON scan_signals(symbol, timeframe, scan_time);
    CREATE INDEX IF NOT EXISTS scan_signals_signal_label_timeframe_scan_time_idx
      ON scan_signals(signal_label, timeframe, scan_time);
    CREATE INDEX IF NOT EXISTS scan_signals_action_bias_timeframe_scan_time_idx
      ON scan_signals(action_bias, timeframe, scan_time);
    CREATE INDEX IF NOT EXISTS scan_signals_primary_structure_timeframe_scan_time_idx
      ON scan_signals(primary_structure, timeframe, scan_time);
    CREATE INDEX IF NOT EXISTS scan_signals_scoring_version_scan_time_idx
      ON scan_signals(scoring_version, scan_time);
    CREATE INDEX IF NOT EXISTS scan_signals_risk_score_idx
      ON scan_signals(risk_score);
    CREATE INDEX IF NOT EXISTS scan_signals_confirmation_score_idx
      ON scan_signals(confirmation_score);
    CREATE INDEX IF NOT EXISTS scan_signals_final_signal_score_idx
      ON scan_signals(final_signal_score);

    CREATE TABLE IF NOT EXISTS scan_signal_risk_types (
      signal_id TEXT NOT NULL,
      risk_type TEXT NOT NULL,
      symbol TEXT,
      timeframe TEXT,
      scan_time TEXT,
      scoring_version TEXT,
      PRIMARY KEY (signal_id, risk_type),
      FOREIGN KEY (signal_id)
        REFERENCES scan_signals(id)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS scan_signal_risk_types_lookup_idx
      ON scan_signal_risk_types(risk_type, timeframe, scan_time);

    CREATE TABLE IF NOT EXISTS signal_forward_evaluations (
      id TEXT PRIMARY KEY,
      signal_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      signal_time TEXT NOT NULL,
      evaluation_time TEXT,
      horizon TEXT NOT NULL,
      price_at_signal REAL,
      price_at_evaluation REAL,
      return_pct REAL,
      max_return_pct REAL,
      max_drawdown_pct REAL,
      still_above_ma20 INTEGER,
      still_above_ma50 INTEGER,
      still_above_ma200 INTEGER,
      rsi_at_evaluation REAL,
      risk_score_at_evaluation REAL,
      confirmation_score_at_evaluation REAL,
      signal_label_at_evaluation TEXT,
      action_bias_at_evaluation TEXT,
      outcome_label TEXT NOT NULL,
      notes_json TEXT,
      metrics_json TEXT,
      scoring_version TEXT,
      scanner_version TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (signal_id)
        REFERENCES scan_signals(id)
        ON DELETE CASCADE,
      UNIQUE(signal_id, horizon)
    );

    CREATE INDEX IF NOT EXISTS signal_forward_evaluations_signal_id_idx
      ON signal_forward_evaluations(signal_id);
    CREATE INDEX IF NOT EXISTS signal_forward_evaluations_symbol_timeframe_horizon_idx
      ON signal_forward_evaluations(symbol, timeframe, horizon);
    CREATE INDEX IF NOT EXISTS signal_forward_evaluations_horizon_evaluation_time_idx
      ON signal_forward_evaluations(horizon, evaluation_time);
    CREATE INDEX IF NOT EXISTS signal_forward_evaluations_outcome_horizon_idx
      ON signal_forward_evaluations(outcome_label, horizon);
    CREATE INDEX IF NOT EXISTS signal_forward_evaluations_scoring_horizon_idx
      ON signal_forward_evaluations(scoring_version, horizon);
    CREATE INDEX IF NOT EXISTS signal_forward_evaluations_signal_time_idx
      ON signal_forward_evaluations(signal_time);
  `);
}

export function initializeMarketDataSchema(db: DatabaseSync) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS market_candles (
      id TEXT PRIMARY KEY,
      market TEXT NOT NULL DEFAULT 'spot',
      source TEXT NOT NULL DEFAULT 'binance',
      symbol TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      open_time INTEGER NOT NULL,
      close_time INTEGER NOT NULL,
      open REAL NOT NULL,
      high REAL NOT NULL,
      low REAL NOT NULL,
      close REAL NOT NULL,
      volume REAL NOT NULL,
      quote_volume REAL,
      trade_count INTEGER,
      taker_buy_base_volume REAL,
      taker_buy_quote_volume REAL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(market, source, symbol, timeframe, open_time)
    );

    CREATE INDEX IF NOT EXISTS market_candles_symbol_timeframe_open_idx
      ON market_candles(symbol, timeframe, open_time);
    CREATE INDEX IF NOT EXISTS market_candles_source_symbol_timeframe_open_idx
      ON market_candles(source, symbol, timeframe, open_time);
    CREATE INDEX IF NOT EXISTS market_candles_timeframe_open_idx
      ON market_candles(timeframe, open_time);

    CREATE TABLE IF NOT EXISTS market_data_sync_jobs (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL DEFAULT 'binance',
      universe TEXT,
      symbols_json TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      requested_symbols INTEGER NOT NULL DEFAULT 0,
      synced_symbols INTEGER NOT NULL DEFAULT 0,
      failed_symbols INTEGER NOT NULL DEFAULT 0,
      candles_fetched INTEGER NOT NULL DEFAULT 0,
      candles_inserted INTEGER NOT NULL DEFAULT 0,
      candles_updated INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      errors_json TEXT,
      metadata_json TEXT
    );

    CREATE INDEX IF NOT EXISTS market_data_sync_jobs_started_at_idx
      ON market_data_sync_jobs(started_at);
    CREATE INDEX IF NOT EXISTS market_data_sync_jobs_status_idx
      ON market_data_sync_jobs(status);
    CREATE INDEX IF NOT EXISTS market_data_sync_jobs_timeframe_idx
      ON market_data_sync_jobs(timeframe);
  `);

  ensureColumn(
    db,
    "market_data_sync_jobs",
    "candles_inserted",
    "INTEGER NOT NULL DEFAULT 0",
  );
  ensureColumn(
    db,
    "market_data_sync_jobs",
    "candles_updated",
    "INTEGER NOT NULL DEFAULT 0",
  );
  ensureColumn(db, "market_data_sync_jobs", "errors_json", "TEXT");
}

function ensureColumn(
  db: DatabaseSync,
  table: string,
  column: string,
  definition: string,
) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
  }>;

  if (rows.some((row) => row.name === column)) {
    return;
  }

  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
