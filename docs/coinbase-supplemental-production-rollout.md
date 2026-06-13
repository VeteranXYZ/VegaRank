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

## Batch Command

The batch runner is:

```bash
pnpm coinbase:supplemental:batch
```

Default behavior:

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

Real 20-symbol medium batch, only after dry-run review:

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

If `--symbols` is not provided, the runner reads Coinbase symbols from Postgres,
filters to enabled `-USDC` spot rows, sorts by symbol, and applies
`--limit-symbols`.

The runner never uses `exchange=all` and never selects Binance rows.

## Candle Backfill

For each selected symbol:

- `4h` fetches Coinbase `1h` candles, aggregates complete UTC 4h buckets, drops
  partial buckets, and writes generated `4h` candles.
- `1d` fetches Coinbase `1d` candles directly through the provider adapter,
  normalizes, gap-checks, and writes daily candles.
- `1w` reads stored Coinbase `1d` candles, aggregates Monday UTC weeks, drops
  partial weeks, and writes weekly candles.

The report includes fetched source counts, generated candle counts, gaps,
inserted/updated rows, dropped partial buckets, and dropped partial weeks.

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

1. 20-symbol dry run.
2. 20-symbol real manual batch.
3. 50-symbol dry run.
4. 50-symbol real manual batch.
5. Full 179-symbol manual backfill and scanner validation.
6. Production cron design only after manual batches are reviewed.

## Deferred

- production cron enablement
- full 179-symbol automated production rollout
- watchlist Coinbase support
- CoinGecko metadata layer
- combined Binance/Coinbase latest rankings design
- production-depth retry strategy
