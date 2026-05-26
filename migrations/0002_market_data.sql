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
