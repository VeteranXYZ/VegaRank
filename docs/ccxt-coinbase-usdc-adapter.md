# CCXT Coinbase USDC Adapter

VegaRank uses CCXT in this phase only as a provider-layer dependency. The
Coinbase adapter lives under the market-data layer and does not change scoring,
database schema, Archive behavior, UI behavior, or production schedules.
CCXT is an adapter layer, not a historical data warehouse; VegaRank owns
deterministic backfill planning, gap diagnostics, and derived candle policy.

Persistent disclaimer: Research-only. Not trading advice.

## Purpose

The Phase 32R Coinbase supplemental production path uses CCXT only. Coinbase
remains supplemental to the Binance-first research universe; Binance ingestion,
scoring, cron, Archive, Watchlist, homepage, and UI behavior are unchanged.

This adapter is not for cross-venue comparison, price-discrepancy workflows, or
venue-routing decisions.

## Symbol Identity

The adapter keeps three identifiers distinct:

- `rawSymbol`: Coinbase product id, such as `BTC-USDC`
- `providerSymbol`: CCXT symbol, such as `BTC/USDC`
- `canonicalAssetKey`: exact uppercase base asset, such as `BTC`

The adapter uses the existing symbol identity helpers from
`src/lib/market-data/symbolIdentity.ts`. It does not duplicate canonical base or
supplemental universe deduplication policy.

## Market Filtering

The Coinbase adapter keeps only markets that are:

- spot markets
- quoted in `USDC`
- active
- complete enough to provide `id`, `symbol`, `base`, and `quote`

It rejects malformed markets, inactive markets, non-spot markets, and non-`USDC`
quote markets.

## Candle Support

Selected Coinbase supplemental VegaRank timeframes:

- `1h`
- `1d`
- `4h` derived from complete CCXT native `1h` buckets
- `1w` derived from complete CCXT native `1d` UTC weeks

The provider validates client-supported CCXT timeframes when the client exposes
them. The production supplemental batch fetches CCXT native `1h` and `1d` only.
It does not fetch native Coinbase `4h` or `1w` candles. Higher intervals are
generated in the market-data backfill layer with strict completeness checks and
diagnostics.

CCXT OHLCV rows are mapped from:

```text
[timestamp, open, high, low, close, volume]
```

to VegaRank `Candle` rows:

- `openTime = timestamp`
- `closeTime = openTime + timeframe duration - 1`
- `open`, `high`, `low`, `close`, and `volume` as finite numbers
- `quoteVolume` omitted unless a future source provides it reliably

Rows are sorted ascending by `openTime` before returning.

## Backfill And Weekly Foundation

Phase 32D adds provider-neutral helpers in
`docs/candle-backfill-and-weekly-aggregation.md` for:

- request window planning
- candle sorting and deduplication
- gap diagnostics and sufficiency checks
- daily-to-weekly aggregation using Monday 00:00:00 UTC week starts

Those helpers are not wired into production jobs in Phase 32D.

Phase 32E adds a manual Coinbase supplemental import and backfill path. See
`docs/coinbase-supplemental-backfill-activation.md`.

Phase 32R formalizes the supplemental production path: CCXT native `1h` and
`1d`, derived `4h` from complete `1h` buckets, and derived `1w` from complete
`1d` UTC weeks.

## Production Command

The intended full configured Coinbase supplemental universe command is:

```bash
pnpm coinbase:supplemental:production
```

It expands to the supplemental batch runner with `--full-universe`, selecting
all configured enabled Coinbase spot `-USDC` symbols from Postgres. The capped
sample command remains:

```bash
pnpm coinbase:supplemental:batch -- --limit-symbols=20
```

## Deprecated / Not Selected Providers

Coinbase Advanced Direct, CryptoCompare, CoinGecko OHLC, and CryptoDataDownload
are not selected for Coinbase production primary or supplemental ingestion.
CoinGecko may remain metadata/context only; the others may remain read-only audit
or manual benchmark references.

## Deferred Work

The adapter intentionally does not implement:

- direct Coinbase `1w` fetching
- production cron integration
- automatic Postgres import or backfill activation
- watchlist Coinbase support
- UI or Archive changes

For `1w`, the direct provider fetch path still returns a controlled unsupported
error. Weekly derivation belongs to the supplemental batch backfill layer.

## Cleanup Plan After Verification

Remove only after the full-universe CCXT supplemental run is verified:

- stale docs that describe Coinbase supplemental production source selection as
  deferred
- old operator notes that require `--allow-large-run` for the intended full
  Coinbase supplemental run
- obsolete audit snapshots that imply Coinbase Advanced, CryptoCompare,
  CoinGecko OHLC, or CryptoDataDownload is an active Coinbase ingestion route

## Testing Boundary

Unit tests use a mocked CCXT-like client. Verification does not require live
Coinbase network calls.
