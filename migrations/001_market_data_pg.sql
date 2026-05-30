CREATE TABLE IF NOT EXISTS symbols (
  id bigserial PRIMARY KEY,
  exchange text NOT NULL DEFAULT 'binance',
  market text NOT NULL DEFAULT 'spot',
  symbol text NOT NULL,
  base_asset text NOT NULL,
  quote_asset text NOT NULL,
  status text NOT NULL,
  quote_volume double precision,
  price_change_percent double precision,
  is_enabled boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(exchange, market, symbol)
);

CREATE INDEX IF NOT EXISTS symbols_exchange_market_symbol_idx
  ON symbols(exchange, market, symbol);

CREATE INDEX IF NOT EXISTS symbols_quote_asset_is_enabled_idx
  ON symbols(quote_asset, is_enabled);

CREATE TABLE IF NOT EXISTS market_candles (
  id bigserial PRIMARY KEY,
  symbol_id bigint NOT NULL REFERENCES symbols(id),
  exchange text NOT NULL DEFAULT 'binance',
  market text NOT NULL DEFAULT 'spot',
  symbol text NOT NULL,
  timeframe text NOT NULL,
  open_time timestamptz NOT NULL,
  close_time timestamptz NOT NULL,
  open_time_ms bigint NOT NULL,
  close_time_ms bigint NOT NULL,
  open double precision NOT NULL,
  high double precision NOT NULL,
  low double precision NOT NULL,
  close double precision NOT NULL,
  volume double precision NOT NULL,
  quote_volume double precision,
  trade_count integer,
  taker_buy_base_volume double precision,
  taker_buy_quote_volume double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(symbol_id, timeframe, open_time)
);

CREATE INDEX IF NOT EXISTS market_candles_symbol_timeframe_open_time_idx
  ON market_candles(symbol_id, timeframe, open_time DESC);

CREATE INDEX IF NOT EXISTS market_candles_exchange_market_symbol_timeframe_open_time_idx
  ON market_candles(exchange, market, symbol, timeframe, open_time DESC);

CREATE TABLE IF NOT EXISTS market_data_sync_jobs (
  id uuid PRIMARY KEY,
  exchange text NOT NULL DEFAULT 'binance',
  market text NOT NULL DEFAULT 'spot',
  timeframe text NOT NULL,
  status text NOT NULL,
  symbols_total integer NOT NULL DEFAULT 0,
  symbols_done integer NOT NULL DEFAULT 0,
  candles_inserted integer NOT NULL DEFAULT 0,
  candles_updated integer NOT NULL DEFAULT 0,
  error_message text,
  params jsonb NOT NULL DEFAULT '{}',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS market_data_sync_jobs_status_started_at_idx
  ON market_data_sync_jobs(status, started_at DESC);
