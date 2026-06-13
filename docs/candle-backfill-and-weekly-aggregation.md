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

## Coinbase Boundary

Coinbase `1h`, `4h`, and `1d` remain direct adapter paths through the CCXT
provider module.

Coinbase `1w` direct fetch remains unsupported in the provider. The Phase 32D
weekly helper prepares a later activation path where Coinbase weekly candles can
be derived from daily candles with documented coverage checks.

## Deferred Work

Still deferred:

- live production backfill
- production cron enablement
- Coinbase `1w` production activation
- storage and backfill activation
- watchlist Coinbase support
- production-depth pagination wired into jobs

No exchange-comparison or venue-routing purpose is introduced by these helpers.
