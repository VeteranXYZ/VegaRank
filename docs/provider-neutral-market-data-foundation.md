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
- `ccxt` for future CEX adapters such as Coinbase
- `coingecko` for future asset discovery, metadata, and enrichment

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
Binance selected universe, it can be included by a future runtime integration.

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

CCXT is the planned CEX adapter layer for exchange-specific OHLCV beyond the
current native Binance adapter. Phase 32B does not add CCXT as a dependency.

CoinGecko is better suited for asset discovery, metadata, enrichment, and cross-listing
context. It should not replace a Coinbase exchange-specific candle source.

## Deferred Work

Coinbase runtime integration is deferred:

- no live Coinbase candle fetching in this phase
- no production schedule changes in this phase
- no watchlist Coinbase support in this phase

Coinbase public candles directly cover `1h`, `4h`, and `1d`. VegaRank `1w` uses
a provider-neutral daily-to-weekly aggregation foundation added after Phase 32B,
with Monday 00:00:00 UTC as the documented week boundary. Production activation
of that path remains deferred.

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
