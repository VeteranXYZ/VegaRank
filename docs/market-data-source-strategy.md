# Market Data Source Strategy

Persistent disclaimer: VegaRank is a research-ranking system. It is not trading
advice, exchange recommendation, arbitrage software, portfolio management, alerting
software, or trading performance software.

## Phase 32K Scope

Phase 32K evaluates market data source strategy before any Coinbase production
cron expansion. It does not change scoring, database schema, migrations, production
cron, UI, Archive, Watchlist, or current Binance/Coinbase runtime behavior.

Current Coinbase manual pipeline status:

- Coinbase supplemental import, backfill, and scanner runs work manually.
- Full manual rollout covered 179 Coinbase-only USDC symbols.
- Coinbase `4h` manual scan saw `symbolsTotal=179`, `symbolsScanned=89`, and
  `symbolsSkipped=90`.
- Coinbase `1d` manual scan saw `symbolsTotal=179`, `symbolsScanned=139`, and
  `symbolsSkipped=40`.
- Binance production latest rankings remain unaffected.
- Phase 32R selects CCXT as the only Coinbase supplemental production ingestion
  source.
- Phase 32T removes the previous live provider-audit route from active code,
  tests, package scripts, and candidate provider listings.

The skipped Coinbase rows are not accepted as normal production behavior. They
are a decision gate: VegaRank should evaluate provider coverage before continuing
Coinbase productionization.

## VegaRank Data Needs

VegaRank needs OHLCV candles with:

- intervals: `1h`, `4h`, `1d`, and `1w`
- at least 200 candles for scoring readiness
- exchange, market, symbol, base asset, and quote asset identity
- quote asset distinction, especially USDT versus USDC
- stable update cadence and explicit rate-limit handling
- gap reporting for missing source intervals
- source provenance for provider, exchange, market, interval, and derived status
- future expansion path beyond crypto, including equities, ETFs, and macro data

Source identity matters. Coin-level aggregated candles must not be silently mixed
with exchange-specific candles. If a future source provides aggregated `BTC` data,
that series is not interchangeable with Binance `BTCUSDT` or Coinbase `BTC-USDC`
without an explicit source label and product decision.

## Provider Evaluation Criteria

Evaluate each provider on:

- free tier availability and paid cost
- historical depth for at least 200 candles per interval
- support for `1h`, native `4h`, native `1d`, and native `1w`
- exchange-specific candles versus aggregated coin-level candles
- Coinbase pair support, Binance pair support, and USDC pair support
- rate limits and pagination model
- data licensing and Terms of Service risk
- operational reliability and documented error behavior
- gap behavior and missing-candle diagnostics
- product metadata quality
- future equities support

Unverified capabilities should remain `needs_verification` until a future scoped
provider proof is explicitly designed. No generic live provider-audit route is
active after Phase 32T.

## Provider Matrix

| provider | providerType | freeTier | exchangeSpecific | aggregatedOnly | intervalsSupported | historicalDepth | CoinbaseUSDCLikely | BinanceLikely | equitiesPossible | APIKeyRequired | licensingRisk | implementationComplexity | fitForVegaRank | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Binance native klines | exchange_native_api | yes | yes | no | Native `1h`, `4h`, `1d`, `1w` | Good for listed Binance spot pairs; varies by listing age | no | yes | no | no | medium | low | strong_candidate | Keep current production behavior unchanged. |
| Coinbase through CCXT | exchange_abstraction | yes | yes | no | Production supplemental path uses native `1h` and `1d`; VegaRank derives `4h` from `1h` and `1w` from `1d` | Product-specific; validated by batch diagnostics | yes | no | no | no | medium | medium | supplemental_only | Selected as the only Coinbase supplemental production ingestion source; Binance remains primary. |
| CoinLore | metadata | yes | no | yes | OHLCV suitability needs verification | Needs verification | no | no | no | no | needs_verification | low | metadata_only | Do not treat as exchange-specific OHLCV. |
| TokenDatabase | metadata | needs_verification | no | yes | Needs verification | Needs verification | needs_verification | needs_verification | no | needs_verification | needs_verification | high | audit_only | Keep explicitly unknown until documentation is verified. |
| Twelve Data | mixed_market_data | partial | needs_verification | needs_verification | Broad intervals likely; crypto venue semantics need verification | Plan-limited; needs 200-candle audit | needs_verification | needs_verification | yes | yes | needs_verification | medium | candidate | Interesting for future equities, but crypto exchange specificity is unproven. |
| Polygon crypto | mixed_market_data | partial | needs_verification | partial | Aggregate bars can express intervals; venue semantics need verification | Plan-dependent | needs_verification | needs_verification | yes | yes | medium | medium | candidate | Multi-asset path, but aggregated crypto bars need explicit labels. |
| Tiingo crypto | mixed_market_data | partial | needs_verification | partial | Requested intervals need verification | Plan-dependent | needs_verification | needs_verification | yes | yes | needs_verification | medium | candidate | Include in future equities audit. |
| CoinAPI | mixed_market_data | partial | yes | no | OHLCV periods likely cover requested intervals | Paid-plan dependent | yes | yes | no | yes | medium | medium | strong_candidate | Strong paid/low-cost candidate if terms and coverage fit. |
| Kaiko | institutional_vendor | no | yes | no | Institutional OHLCV likely covers requested intervals | Likely deep but commercial | yes | yes | no | yes | low | high | audit_only | Likely high quality, may exceed low-cost target. |
| Tardis.dev | derivatives_or_tick_vendor | partial | yes | no | Candle support needs verification; raw data may require aggregation | Likely deep for supported instruments | needs_verification | yes | no | partial | medium | high | audit_only | Avoid if it forces VegaRank to build candle infrastructure. |
| BackDB | unknown_or_unsuitable | needs_verification | needs_verification | needs_verification | Needs verification | Needs verification | needs_verification | needs_verification | needs_verification | needs_verification | needs_verification | high | audit_only | Keep as unknown candidate only. |
| CoinMarketCap | metadata | partial | partial | yes | Treat as metadata unless OHLCV terms are verified | Plan-dependent | needs_verification | needs_verification | no | yes | needs_verification | medium | metadata_only | Applicable mainly for metadata and cross-listing context. |
| DefiLlama | metadata | yes | no | yes | Not a primary exchange OHLCV source | Not applicable to venue candles | no | no | no | no | medium | low | metadata_only | Useful for protocol context, not candle sourcing. |
| Nasdaq Data Link / Quandl datasets | mixed_market_data | partial | needs_verification | needs_verification | Dataset-specific | Dataset-specific | needs_verification | needs_verification | yes | yes | needs_verification | high | audit_only | Relevant for future multi-asset research, not immediate Coinbase fix. |

## Recommended Architecture

Add a provider registry that treats each market data source as a capability profile,
not just an implementation module. The registry should expose:

- provider id and provider type
- exchange-specific versus aggregated-only semantics
- interval support and whether candles are native or derived
- market and quote-asset support
- free-tier, licensing, rate-limit, and pagination notes
- intended role: primary, fallback, audit candidate, metadata, manual import, or unsuitable

Future storage should add source provenance with candles before mixing providers
inside production workflows. Provenance should eventually record:

- provider id
- exchange and market
- raw symbol and provider symbol
- interval
- native versus derived candle status
- source interval when derived
- retrieval time or batch id

Primary/fallback policy should prefer exchange-specific native candles. Aggregation
is a fallback only when:

- the provider lacks the native interval
- lower-interval coverage is complete enough
- the derived candle is explicitly labeled as derived
- gap diagnostics prove enough history for scoring

VegaRank should avoid hand-aggregating as the default strategy. Manual `4h`
aggregation from `1h` is acceptable as a controlled fallback, not as evidence that
Coinbase production coverage is solved.

## Current Near-Term Path

Do not replace Binance and do not cron Coinbase in this phase.

Current Coinbase supplemental production backfill is now CCXT-only:

- `1h` comes from CCXT native `1h`.
- `1d` comes from CCXT native `1d`.
- `4h` is derived from complete CCXT `1h` buckets.
- `1w` is derived from complete CCXT `1d` UTC weeks.

This is the selected supplemental path for Coinbase. It does not replace Binance
as the production primary source.

The removed provider-audit route should not be revived by default. Any future
third-party market-data provider work should start as a new scoped phase with
explicit licensing, provenance, coverage, and production-role criteria.
