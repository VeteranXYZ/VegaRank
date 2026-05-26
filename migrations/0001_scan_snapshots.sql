CREATE TABLE IF NOT EXISTS scan_snapshots (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  exchange TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('single', 'mtf')),
  timeframe TEXT,
  preset TEXT,
  timeframes_json TEXT,
  limit_value INTEGER NOT NULL,
  item_count INTEGER NOT NULL,
  errors_count INTEGER NOT NULL,
  results_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS scan_snapshots_created_at_idx
  ON scan_snapshots(created_at DESC);
