# Coinbase Supplemental Backfill Activation

Phase 32E adds a manual, non-cron activation path for Coinbase USDC supplemental
market data.

Persistent disclaimer: Research-only. Not trading advice.

## Scope

This phase enables manual development and staging workflows for:

- Coinbase USDC spot market discovery
- Binance-first supplemental universe selection
- Coinbase-only symbol import into Postgres
- Coinbase `1h`, `4h`, and `1d` candle backfill through the CCXT adapter
- Coinbase `1w` candle creation from stored daily candles
- exchange-aware scanner storage when manually invoked
- dashed Coinbase symbol validation for backend routes

Production cron jobs remain unchanged.

## Universe Rule

Binance spot USDT remains primary. Coinbase spot USDC only fills base assets not
already covered by Binance.

Deduplication uses exact canonical base asset only:

- Binance `BTCUSDT` covers base `BTC`, so Coinbase `BTC-USDC` is skipped.
- Binance `ETHUSDT` covers base `ETH`, so Coinbase `ETH-USDC` is skipped.
- Coinbase `ABC-USDC` is included only when Binance `ABCUSDT` is not present.

No aliasing is applied. `WBTC`, `BNSOL`, `1000SATS`, `WBETH`, and `STETH` remain
distinct base assets.

## Manual Symbol Import

Dry run:

```bash
pnpm import:coinbase-usdc -- --dry-run
```

Write Coinbase-only symbols:

```bash
pnpm import:coinbase-usdc
```

The import command logs:

- Coinbase USDC products found
- Binance bases selected
- Coinbase products skipped because Binance already covers the base
- Coinbase-only symbols imported
- imported and skipped examples

## Manual Candle Backfill

Direct Coinbase adapter paths:

```bash
pnpm backfill:coinbase-usdc -- --timeframe=1h --limit-symbols=5 --target-candles=300
pnpm backfill:coinbase-usdc -- --timeframe=4h --limit-symbols=5 --target-candles=300
pnpm backfill:coinbase-usdc -- --timeframe=1d --limit-symbols=5 --target-candles=300
```

Target explicit symbols:

```bash
pnpm backfill:coinbase-usdc -- --timeframe=4h --symbols=ABC-USDC,XYZ-USDC --target-candles=300
```

The script uses provider-neutral backfill windows from
`src/lib/market-data/candleBackfillPlanner.ts`, normalizes returned candles with
`src/lib/market-data/candleQuality.ts`, and writes candles as:

- `exchange = coinbase`
- `market = spot`
- `symbol = BTC-USDC`

## Weekly Aggregation

Coinbase direct `1w` fetch remains unsupported.

Manual weekly creation reads stored Coinbase `1d` candles and writes aggregated
`1w` candles:

```bash
pnpm backfill:coinbase-usdc -- --timeframe=1w --limit-symbols=5 --target-candles=52
```

Weekly aggregation uses Monday 00:00:00 UTC as the week boundary and drops
incomplete weeks by default. The command logs dropped partial weeks and detected
gaps.

## Inspect Stored Coinbase Candles

Example SQL:

```sql
SELECT exchange, market, symbol, timeframe, COUNT(*) AS candles
FROM market_candles
WHERE exchange = 'coinbase'
GROUP BY exchange, market, symbol, timeframe
ORDER BY symbol, timeframe;
```

Example backend candle request when the API is pointed at the same Postgres
database:

```bash
curl "http://127.0.0.1:3000/api/candles?exchange=coinbase&symbol=ABC-USDC&timeframe=4h&limit=20"
```

## Manual Scanner Path

The PostgreSQL scanner keeps Binance as the default exchange. Coinbase must be
requested explicitly:

```bash
pnpm scanner:run:pg -- --exchange=coinbase --symbols=ABC-USDC --timeframe=4h --limit=500
```

The scanner preserves the stored symbol exchange in scan run metadata and scan
signal rows. Scoring math and codebook meanings are unchanged.

## Still Deferred

- production cron enablement
- large-scale production backfill
- storage/backfill production job activation
- watchlist Coinbase support
- cross-source comparison workflows
- CoinGecko metadata layer
- UI redesign
