CREATE TABLE IF NOT EXISTS scan_runs (
  id uuid PRIMARY KEY,
  exchange text NOT NULL DEFAULT 'binance',
  market text NOT NULL DEFAULT 'spot',
  mode text NOT NULL DEFAULT 'single',
  timeframe text NOT NULL,
  universe text NOT NULL,
  status text NOT NULL,
  symbols_total integer NOT NULL DEFAULT 0,
  symbols_scanned integer NOT NULL DEFAULT 0,
  signals_created integer NOT NULL DEFAULT 0,
  symbols_skipped integer NOT NULL DEFAULT 0,
  failed_symbols integer NOT NULL DEFAULT 0,
  params jsonb NOT NULL DEFAULT '{}',
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS scan_runs_status_started_at_idx
  ON scan_runs(status, started_at DESC);

CREATE INDEX IF NOT EXISTS scan_runs_timeframe_started_at_idx
  ON scan_runs(timeframe, started_at DESC);

CREATE TABLE IF NOT EXISTS scan_signals (
  id uuid PRIMARY KEY,
  scan_run_id uuid NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
  symbol_id bigint NOT NULL REFERENCES symbols(id),
  exchange text NOT NULL DEFAULT 'binance',
  market text NOT NULL DEFAULT 'spot',
  symbol text NOT NULL,
  timeframe text NOT NULL,
  scan_time timestamptz NOT NULL DEFAULT now(),
  candle_open_time timestamptz,
  price_at_signal double precision,
  rank_score double precision,
  final_signal_score double precision,
  opportunity_score double precision,
  confirmation_score double precision,
  risk_score double precision,
  trend_score double precision,
  momentum_score double precision,
  volume_score double precision,
  structure_score double precision,
  signal_label text,
  action_bias text,
  primary_structure text,
  secondary_structures jsonb NOT NULL DEFAULT '[]',
  detected_risk_types jsonb NOT NULL DEFAULT '[]',
  factors jsonb NOT NULL DEFAULT '{}',
  next_confirmation jsonb,
  invalidation jsonb,
  raw_metrics jsonb NOT NULL DEFAULT '{}',
  scoring_version text,
  scanner_version text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scan_signals_scan_run_id_idx
  ON scan_signals(scan_run_id);

CREATE INDEX IF NOT EXISTS scan_signals_timeframe_scan_time_rank_score_idx
  ON scan_signals(timeframe, scan_time DESC, rank_score DESC);

CREATE INDEX IF NOT EXISTS scan_signals_symbol_id_timeframe_scan_time_idx
  ON scan_signals(symbol_id, timeframe, scan_time DESC);

CREATE INDEX IF NOT EXISTS scan_signals_symbol_timeframe_scan_time_idx
  ON scan_signals(symbol, timeframe, scan_time DESC);
