# Candle Backfill And Weekly Aggregation

VegaRank owns market data ingestion rules independently from provider adapters.
CCXT is an adapter layer, not a historical data warehouse.

Persistent disclaimer: Research-only. Not trading advice.

## Phase 32D Scope

Phase 32D adds provider-neutral helpers for:

- candle backfill request planning
- candle sorting and deduplication
- gap diagnostics and sufficiency checks
- daily-to-weekly aggregation using a UTC week boundary

This phase does not change scoring, API behavior, database schema, Archive
behavior, UI behavior, or production schedules.

## Backfill Planning

`src/lib/market-data/candleBackfillPlanner.ts` builds deterministic request
windows from:

- timeframe
- target candle count
- provider max candles per request
- end timestamp
- optional overlap candles
- optional earliest timestamp

The planner is provider-neutral. It supports `1h`, `4h`, `1d`, and `1w`
durations for planning. `1M` is intentionally unsupported by this helper.

Request windows are sorted ascending by `startTimeMs`. `endTimeMs` is treated as
the latest candle open time after flooring to the timeframe boundary. Each
window reports `expectedCandles` and `requestLimit`.

If `earliestTimeMs` prevents the full requested history from being represented,
the plan sets `truncatedByEarliestTime`.

## Candle Quality

`src/lib/market-data/candleQuality.ts` normalizes returned candles before later
processing:

- sorts by `openTime`
- deduplicates by `openTime`
- uses a deterministic last-duplicate-wins policy
- removes candles with non-finite numeric values
- reports missing candle ranges
- reports expected next open time
- reports candle sufficiency without mutating input

Diagnostics are sidecar data. The shared `Candle` type is unchanged.

## Weekly Aggregation

`src/lib/market-data/weeklyAggregation.ts` aggregates normalized daily candles to
weekly candles.

Policy:

- week starts Monday 00:00:00 UTC
- weekly `openTime` is the UTC week start
- weekly `closeTime` is week start plus seven days minus one millisecond
- `open` comes from the first daily candle in the week
- `high` is the max daily high
- `low` is the min daily low
- `close` comes from the last daily candle in the week
- `volume` is summed
- `quoteVolume` is summed when at least one daily candle provides it

Complete weeks require seven aligned daily candles. Partial weeks are dropped by
default. The latest partial week can be included only when explicitly requested.
Earlier partial weeks remain diagnostic-only coverage.

## Intraday Aggregation

`src/lib/market-data/intradayAggregation.ts` aggregates normalized hourly
candles to 4h candles.

Policy:

- 4h buckets align to UTC `00:00`, `04:00`, `08:00`, `12:00`, `16:00`, and
  `20:00`
- 4h `openTime` is the bucket start
- 4h `closeTime` is bucket start plus four hours minus one millisecond
- `open` comes from the first hourly candle in the bucket
- `high` is the max hourly high
- `low` is the min hourly low
- `close` comes from the fourth hourly candle
- `volume` is summed
- `quoteVolume` is summed when at least one hourly candle provides it

Complete 4h buckets require four consecutive aligned hourly candles. Partial
buckets are dropped by default. Diagnostics report complete buckets, partial
buckets, dropped partial buckets, and input gaps.

## Coinbase Boundary

Coinbase `1h` and `1d` remain direct adapter paths through the CCXT provider
module.

Coinbase direct `4h` may not be exposed by the real CCXT client. The manual
Coinbase backfill command derives `4h` candles from fetched `1h` candles using
the intraday aggregation helper.

Coinbase `1w` direct fetch remains unsupported in the provider. The manual
Coinbase backfill command derives `1w` candles from stored `1d` candles with
documented coverage checks.

The Phase 32G medium-batch runner reuses these same rules for controlled
Coinbase supplemental batches. It does not add production cron behavior.

Symbol Research can query manual Coinbase scanner results by exact exchange,
market, symbol, and timeframe. Rankings latest remains on the current Binance
full-universe selection until Coinbase production universe rollout.

## Deferred Work

Still deferred:

- live production backfill
- production cron enablement
- Coinbase production universe rollout
- storage and backfill activation
- watchlist Coinbase support
- production-depth pagination wired into jobs

No exchange-comparison or venue-routing purpose is introduced by these helpers.
