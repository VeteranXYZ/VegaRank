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

These coverage questions are not accepted as production-ready behavior. Before
expanding production cron, VegaRank needs a provider strategy and capability audit
for exchange-specific OHLCV coverage.

Phase 32L added a live read-only provider audit for Coinbase Advanced Direct,
CryptoCompare, CryptoDataDownload, and CoinGecko. Phase 32M extends that audit
with Coinbase Advanced bearer-token support, Coinbase Exchange public comparison,
CryptoCompare provenance labeling, CoinGecko aggregated-only classification,
CryptoDataDownload manual mapping notes, and paid/key-required provider
checklists. It can test Coinbase direct `1h`, `4h`, and `1d` availability
without writing candles, running scanners, changing cron, or changing scoring.
See `docs/live-crypto-ohlcv-provider-audit.md`.

The unauthenticated live audit currently treats Coinbase Advanced HTTP 401
responses as an authentication requirement, not as proof that products or
timeframes are unavailable. Coinbase Advanced direct `1w` remains unavailable in
this audit path.

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

This aggregation path is a controlled fallback, not the preferred long-term data
strategy. Native provider intervals should be preferred when they provide enough
history, stable access, acceptable licensing, and clear exchange/pair provenance.
Coin-level aggregated candles must not be silently mixed with Coinbase
exchange-specific candles.

No Phase 32M change promotes the current derived `4h` or `1w` paths into the
long-term primary source. They remain validation and fallback paths while
authenticated Coinbase Advanced and third-party exchange-specific providers are
evaluated.

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
6. Provider strategy and capability audit before production cron expansion.
7. Production cron design only after manual batches and provider audit are reviewed.

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

## Deferred

- production cron enablement
- full 179-symbol automated production rollout
- watchlist Coinbase support
- CoinGecko metadata layer
- combined Binance/Coinbase latest rankings design
- production-depth retry strategy
- provider capability audit and data source selection

See `docs/market-data-source-strategy.md` for the Phase 32K market data source
evaluation framework.
