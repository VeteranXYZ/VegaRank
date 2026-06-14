# Provider-Neutral Market Data Foundation

VegaRank ranks research candidates. Market data should be modeled independently from
the current data source so the research universe can grow without making Binance a
permanent product assumption.

Persistent disclaimer: Research-only. Not trading advice.

## Core Concepts

Asset Identity is the research object. For crypto, the canonical asset key is the
exact uppercase base asset, such as `BTC`, `ETH`, or `NEAR`.

Market Listing is a concrete venue listing for an asset:

- `binance` spot `BTCUSDT`
- `coinbase` spot `BTC-USDC`

Data Provider is the technical source used to retrieve listing metadata or OHLCV:

- `native-binance` for the current Binance adapter
- `ccxt` for the current Coinbase supplemental production adapter

Research Universe Row is the final listing selected for VegaRank research ranking.
Only one listing should represent a canonical asset key in the selected universe.

## Phase 32B Scope

This phase adds passive foundation code only:

- shared exchange/provider types
- market symbol identity helpers
- supplemental universe selection helpers
- provider-neutral interface types
- unit tests for exact-base deduplication

It does not change scoring, API behavior, database schema, archive behavior,
production schedules, or existing Binance runtime behavior.

## Binance Primary, Coinbase Supplemental

Binance spot USDT remains primary. Coinbase spot USDC is planned as a supplemental
source for assets not already covered by Binance USDT.

Selection priority:

1. Binance primary listings
2. Coinbase supplemental listings

Deduplication uses exact canonical base asset only:

- Binance `BTCUSDT` -> `BTC`
- Coinbase `BTC-USDC` -> `BTC`
- Binance `NEARUSDT` -> `NEAR`
- Coinbase `NEAR-USDC` -> `NEAR`

If Binance already selected a canonical base asset, the Coinbase listing for that
same exact base is skipped. If Coinbase has an exact base asset not present in the
Binance selected universe, it can be included by the Coinbase supplemental
production run.

## No Aliasing

Phase 32B intentionally does not alias related assets. These remain distinct
canonical asset keys:

- `WBTC` is not `BTC`
- `BNSOL` is not `SOL`
- `1000SATS` is not `SATS`
- `WBETH` is not `ETH`
- `STETH` is not `ETH`

Alias policy should be a separate product decision with explicit data ownership.

## Provider Direction

CCXT is the selected adapter layer for Coinbase supplemental exchange-specific
OHLCV. Binance remains on the existing native Binance production path and is not
migrated to CCXT by the Coinbase supplemental work.

Coin-level metadata can still be useful for discovery, enrichment, and
cross-listing context, but aggregated OHLC must not be treated as Coinbase
exchange-specific candle data.

## Phase 32K Provider Strategy Gate

Phase 32K adds a static provider evaluation framework before any Coinbase
production cron expansion. The current Coinbase manual pipeline works, but the
manual rollout left coverage questions:

- Coinbase `4h` manual scan: 179 total symbols, 89 scanned, 90 skipped.
- Coinbase `1d` manual scan: 179 total symbols, 139 scanned, 40 skipped.

Those skip counts led to the provider capability work. Phase 32R selected the
CCXT-only Coinbase supplemental path. Phase 32T removes the previous live
provider-audit route from active code, tests, package scripts, and candidate
provider listings.

Coinbase supplemental production now uses native CCXT `1h` and `1d`. It derives
Coinbase `4h` only from complete CCXT `1h` buckets and derives Coinbase `1w`
only from complete CCXT `1d` UTC weeks. Coin-level aggregated data must not be
silently mixed into exchange-specific rankings.

See `docs/market-data-source-strategy.md` for the current provider matrix and
evaluation criteria.

## Deferred Work

Coinbase supplemental production integration is active through the explicit
manual command:

```bash
pnpm coinbase:supplemental:production
```

Deferred work:

- no production schedule changes in this phase
- no watchlist Coinbase support in this phase

Coinbase `1h` and `1d` use native CCXT candles. Coinbase `4h` is derived only
from complete CCXT `1h` buckets. Coinbase `1w` is derived only from complete
CCXT `1d` weeks with Monday 00:00:00 UTC as the documented week boundary.

## Historical Coverage Foundation

Provider adapters do not define historical coverage policy. VegaRank owns:

- target candle counts
- request window planning
- candle sorting and deduplication
- gap diagnostics
- candle sufficiency checks
- daily-to-weekly aggregation policy

See `docs/candle-backfill-and-weekly-aggregation.md` for the Phase 32D helper
design. These helpers are foundation code only and do not change production
scanner behavior.

Phase 32E adds manual Coinbase supplemental symbol import and candle backfill.
Production schedules remain Binance-first until a later activation phase.

## Storage And API Impact

The existing Postgres schema already has `exchange`, `market`, and raw `symbol`
fields. Phase 32B does not add migrations.

Current production APIs and scripts remain Binance-first by implementation. Future
Coinbase enablement should thread exchange/provider identity through storage reads,
scan writes, route validation, and watchlist identity deliberately rather than
implicitly accepting dashed symbols everywhere.
