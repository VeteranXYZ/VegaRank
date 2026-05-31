ALTER TABLE symbols
  ADD COLUMN IF NOT EXISTS asset_class text NOT NULL DEFAULT 'crypto',
  ADD COLUMN IF NOT EXISTS is_scanner_eligible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_backtest_eligible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_market_context boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS symbols_enabled_scanner_eligible_idx
  ON symbols(is_enabled, is_scanner_eligible);

CREATE INDEX IF NOT EXISTS symbols_asset_class_enabled_idx
  ON symbols(asset_class, is_enabled);

CREATE INDEX IF NOT EXISTS symbols_market_context_idx
  ON symbols(is_market_context)
  WHERE is_market_context = true;

UPDATE symbols
SET
  asset_class = 'crypto',
  is_scanner_eligible = true,
  is_backtest_eligible = true,
  is_market_context = false
WHERE exchange = 'binance'
  AND market = 'spot';

UPDATE symbols
SET
  asset_class = 'stable',
  is_scanner_eligible = false,
  is_backtest_eligible = false,
  is_market_context = true
WHERE exchange = 'binance'
  AND market = 'spot'
  AND (
    symbol IN (
      'USDCUSDT',
      'FDUSDUSDT',
      'USDPUSDT',
      'TUSDUSDT',
      'BUSDUSDT',
      'DAIUSDT',
      'PYUSDUSDT',
      'USD1USDT',
      'RLUSDUSDT'
    )
    OR base_asset IN (
      'USDC',
      'FDUSD',
      'USDP',
      'TUSD',
      'BUSD',
      'DAI',
      'PYUSD',
      'USD1',
      'RLUSD',
      'USDD',
      'USDE',
      'SUSDE',
      'USDS',
      'FRAX',
      'BFUSD'
    )
  );

UPDATE symbols
SET
  asset_class = 'fiat',
  is_scanner_eligible = false,
  is_backtest_eligible = false,
  is_market_context = true
WHERE exchange = 'binance'
  AND market = 'spot'
  AND (
    symbol IN ('EURUSDT', 'GBPUSDT', 'TRYUSDT', 'BRLUSDT', 'AUDUSDT')
    OR base_asset IN ('EUR', 'GBP', 'TRY', 'BRL', 'AUD', 'AEUR', 'EURI', 'UAH', 'ZAR', 'IDRT', 'BIDR')
  );

UPDATE symbols
SET
  asset_class = 'gold',
  is_scanner_eligible = false,
  is_backtest_eligible = true,
  is_market_context = true
WHERE exchange = 'binance'
  AND market = 'spot'
  AND (
    symbol IN ('PAXGUSDT', 'XAUTUSDT')
    OR base_asset IN ('PAXG', 'XAUT')
  );

UPDATE symbols
SET
  asset_class = 'special',
  is_scanner_eligible = false,
  is_backtest_eligible = false,
  is_market_context = false
WHERE exchange = 'binance'
  AND market = 'spot'
  AND asset_class = 'crypto'
  AND (
    symbol !~ '^[A-Z0-9]+$'
    OR base_asset !~ '^[A-Z0-9]+$'
    OR (base_asset LIKE '%UP' AND base_asset <> 'JUP')
    OR base_asset ~ '(DOWN|BULL|BEAR|3L|3S|5L|5S)$'
  );
