# Coinbase Supplemental Production Rollout

Persistent disclaimer: Research-only. Not trading advice.

## Current Status

The one-symbol Coinbase dry run succeeded on `AERO-USDC`:

- Coinbase USDC import found 399 products.
- Binance-covered Coinbase products skipped: 220.
- Coinbase-only symbols imported: 179.
- `AERO-USDC` `1d` backfill inserted 250 daily candles with 0 gaps.
- `AERO-USDC` `1w` aggregation generated 30 weekly candles.
- `AERO-USDC` `4h` backfill derived 250 candles from Coinbase `1h`.
- Manual Coinbase scanner runs completed for `1d` and `4h`.
- exact Symbol Research lookup returned the Coinbase scan run.
- Binance production API remained healthy.

The later full manual Coinbase rollout covered 179 Coinbase-only USDC symbols.
Manual scanner coverage remained incomplete:

- `4h`: 179 total symbols, 89 scanned, 90 skipped.
- `1d`: 179 total symbols, 139 scanned, 40 skipped.

Phase 32R formalizes the Coinbase supplemental production source decision:
Coinbase supplemental ingestion uses CCXT only. Coinbase Advanced Direct,
CryptoCompare, CoinGecko OHLC, and CryptoDataDownload are deprecated/not
selected for Coinbase production primary or supplemental ingestion. They may
remain as read-only audit, metadata, or manual benchmark references, but they are
not part of the Coinbase supplemental batch path.

The first medium batch showed that Coinbase `BASE-USDC` rows were being
classified from the raw dashed pair string. Phase 32H refines quality
classification so Coinbase pairs are parsed as base and quote assets before
quality flags are assigned.

## Phase 32G Purpose

Phase 32G moves from one-symbol smoke testing to a controlled 20-symbol medium
batch. It validates:

- batch runtime
- rate-limit behavior
- gap frequency
- scanner completion rate
- symbol quality flag distribution
- sampled Coinbase Symbol Research readability
- Binance production regression safety

This is not full Coinbase production cron activation and not the full
179-symbol rollout.

## Production Command

The intended full Coinbase supplemental production command is:

```bash
pnpm coinbase:supplemental:production
```

This command runs the Coinbase supplemental batch with `--full-universe`. It
selects all configured, enabled Coinbase spot `-USDC` supplemental symbols from
Postgres. It does not require `--allow-large-run`.

Production command dry run:

```bash
pnpm coinbase:supplemental:production -- --dry-run
```

The older capped sample runner remains available for small rollout checks:

```bash
pnpm coinbase:supplemental:batch
```

Sample runner default behavior:

- selects Coinbase `-USDC` symbols already imported into Postgres
- defaults to `--limit-symbols=20`
- refuses more than 50 symbols unless `--allow-large-run` is set
- defaults to `--timeframes=4h,1d,1w`
- defaults to `--scanner-timeframes=4h,1d`
- defaults to conservative `--concurrency=1`
- stops on the first runtime error by default
- does not modify production cron jobs

Safe dry run:

```bash
pnpm coinbase:supplemental:batch -- --dry-run --limit-symbols=20 --timeframes=4h,1d,1w --scanner-timeframes=4h,1d
```

Real 20-symbol sample batch, only after dry-run review:

```bash
pnpm coinbase:supplemental:batch -- --limit-symbols=20 --timeframes=4h,1d,1w --scanner-timeframes=4h,1d
```

Explicit symbol batch:

```bash
pnpm coinbase:supplemental:batch -- --symbols=AERO-USDC,AIOZ-USDC --timeframes=4h,1d,1w --scanner-timeframes=4h,1d
```

## Symbol Selection

If `--symbols` is provided, each symbol must:

- exist in Postgres with `exchange = coinbase`
- use `market = spot`
- preserve the dashed `BASE-USDC` form
- end with `-USDC`
- be enabled and not stored with a disabled status

If `--full-universe` is provided, the runner reads Coinbase symbols from
Postgres, filters to enabled `-USDC` spot rows, sorts by symbol, and selects the
entire configured supplemental universe.

If neither `--symbols` nor `--full-universe` is provided, the sample runner reads
Coinbase symbols from Postgres, filters to enabled `-USDC` spot rows, sorts by
symbol, and applies `--limit-symbols`.

The runner never uses `exchange=all` and never selects Binance rows.

## Candle Backfill

Coinbase supplemental production candles come from CCXT only. For each selected
symbol:

- `1h` fetches Coinbase CCXT native `1h` candles directly.
- `1d` fetches Coinbase CCXT native `1d` candles directly.
- `4h` fetches Coinbase CCXT native `1h` candles, aggregates complete UTC 4h buckets, drops
  partial buckets, and writes generated `4h` candles.
- `1w` fetches Coinbase CCXT native `1d` candles, aggregates Monday UTC weeks, drops
  partial weeks, and writes weekly candles.

The report includes fetched source counts, generated candle counts, gaps,
inserted/updated rows, dropped partial buckets, and dropped partial weeks.

No Coinbase Advanced, Coinbase Exchange public, CryptoCompare, CoinGecko OHLC,
or CryptoDataDownload candle client is used by this batch. Coin-level aggregated
candles must not be mixed with Coinbase exchange-specific candles.

## Scanner Run

The runner creates manual Coinbase scan runs for the requested scanner
timeframes. It preserves:

- `exchange = coinbase`
- `market = spot`
- dashed symbol values such as `AERO-USDC`

The report records scanned, skipped, failed, signal count, skip reason, rank
score, and group code where available.

Coinbase symbols are not mixed into Binance latest full-universe runs.

## Report Shape

The command prints structured JSON with:

- `ok`
- `dryRun`
- `symbolsSelected`
- `symbols`
- `timeframesBackfilled`
- `scannerTimeframes`
- `perSymbol`
- `totals`
- `sampledApiChecks`
- `nextRecommendedCommand`

`totals` includes candle writes, gap counts, dropped partial buckets/weeks,
scanner counts, failures, duration, quality tier distribution, and quality flag
distribution.

## Quality Classification

Coinbase `BASE-USDC` symbols are parsed as base/quote pairs for quality
classification:

- `AERO-USDC` uses base `AERO`, quote `USDC`.
- `AIOZ-USDC` uses base `AIOZ`, quote `USDC`.
- `BADGER-USDC` uses base `BADGER`, quote `USDC`.

The quote asset `USDC` does not make the base asset stable-like. Stable-like
quality applies to stable-like base assets such as `DAI`, `PYUSD`, `EURC`,
`USDT`, `USDC`, `FDUSD`, and similar base identities.

Low-history and new-listing flags remain data-quality context and can still
appear when candle count or listing age justifies them.

## Verification

Sampled Symbol Research check:

```bash
curl -s "https://api.vegarank.com/api/symbol/research?exchange=coinbase&symbol=AERO-USDC&timeframe=4h&assetClass=crypto" -o /tmp/coinbase-batch-symbol.json
head -c 1000 /tmp/coinbase-batch-symbol.json
echo
```

Binance health check:

```bash
curl -s "https://api.vegarank.com/health"
echo
```

Binance latest rankings regression check:

```bash
time timeout 30s curl -s "https://api.vegarank.com/api/rankings/latest?timeframe=4h&assetClass=crypto&limit=5" -o /tmp/binance-latest-after-batch.json
echo "status=$?"
ls -lh /tmp/binance-latest-after-batch.json
head -c 500 /tmp/binance-latest-after-batch.json
echo
```

## Interpreting Results

Gaps indicate missing source candles in the requested range. A small number of
gaps should be reviewed before expanding the batch.

Dropped partial 4h buckets are expected when the latest `1h` source window does
not complete a UTC 4h bucket.

Dropped partial weekly buckets are expected near the current week boundary.

Skipped scanner rows usually mean insufficient stored candle history for the
requested timeframe or a scanner data-quality guard.

## Suggested Progression

1. Optional 20-symbol sample dry run.
2. Optional 20-symbol sample real batch.
3. Full-universe production dry run:
   `pnpm coinbase:supplemental:production -- --dry-run`
4. Full-universe production batch:
   `pnpm coinbase:supplemental:production`
5. API validation for explicit Coinbase latest rankings and Symbol Research.
6. Production cron design only after manual full-universe runs are reviewed.

Useful live audit command:

```bash
pnpm market-data:providers:live-audit -- --providers=coinbase_advanced_direct,coinbase_exchange_public,cryptocompare,cryptodatadownload,coingecko --symbols=AERO-USDC,CLANKER-USDC,BNKR-USDC,BTCUSDT,ETHUSDT --timeframes=1h,4h,1d,1w --lookback-days=365 --json
```

Authenticated Coinbase Advanced audit, if credentials are available:

```bash
COINBASE_ADVANCED_BEARER_TOKEN=... pnpm market-data:providers:live-audit -- --providers=coinbase_advanced_direct --symbols=AERO-USDC,CLANKER-USDC,BNKR-USDC --timeframes=1h,4h,1d,1w --lookback-days=365 --json
```

CoinGecko remains aggregated-only and must not be used as an exchange-specific
primary source even when its OHLC endpoint succeeds. Production cron remains
disabled until the provider audit decision summary supports a separate
production-source change.

## Cleanup Plan After Verification

Remove only after this phase has been verified in production:

- outdated docs that describe Coinbase Advanced, CryptoCompare, CoinGecko OHLC,
  or CryptoDataDownload as candidate production Coinbase OHLCV sources
- stale sample-output JSON or markdown from old provider audits that imply a
  non-CCXT Coinbase supplemental route
- old operator notes that require `--allow-large-run` for the intended full
  Coinbase supplemental run
- any archived wrong-route data exports that mix aggregated coin-level candles
  with exchange-specific Coinbase symbols

## Deferred

- production cron enablement
- watchlist Coinbase support
- CoinGecko metadata layer
- combined Binance/Coinbase latest rankings design
- production-depth retry strategy

See `docs/market-data-source-strategy.md` for the Phase 32K market data source
evaluation framework.
