# Live Crypto OHLCV Provider Audit

Persistent disclaimer: VegaRank is a research-ranking system. It is not trading
advice, exchange recommendation, arbitrage software, portfolio management,
alerting software, or a trading performance dashboard.

## Purpose

Phase 32L added a live, read-only audit tool for crypto OHLCV providers. Phase
32M extends that tool so it can honestly test authenticated Coinbase Advanced
requests and compare third-party options before any production data source is
changed.

The audit does not:

- change scoring
- change database schema
- add migrations
- write candles to the database
- run scanners
- change production cron
- change UI, Archive, or Watchlist behavior
- change existing Binance or Coinbase production behavior

## Why Coinbase Productionization Is Paused

The current Coinbase supplemental manual pipeline works, but coverage questions
remain:

- Coinbase `4h` manual scan: 179 total symbols, 89 scanned, 90 skipped.
- Coinbase `1d` manual scan: 179 total symbols, 139 scanned, 40 skipped.

Those gaps should be explained before Coinbase is promoted into automated
production schedules. Hand-aggregated candles can remain a temporary fallback
and diagnostic path, but they should not become VegaRank's long-term primary
market data strategy.

## Exchange-Specific Versus Aggregated OHLCV

Exchange-specific OHLCV is tied to a concrete venue listing, such as Binance
`BTCUSDT` or Coinbase `AERO-USDC`.

Aggregated coin-level OHLCV is tied to an asset, such as `BTC`, often expressed
against `USD`. It can be useful for broad context or metadata, but it must not be
silently mixed into exchange-specific rankings.

The live audit records:

- provider id
- provider symbol used
- exchange-specific status
- aggregated-only status
- quote asset preservation
- native interval support
- fetched candle count
- first and last candle timestamps
- 200-candle readiness
- gap count when determinable
- auth/key blockage
- HTTP status, sanitized endpoint kind, provider granularity, and failure
  category when useful
- data-use warnings
- decision summary and provider checklist

## Providers Tested

Phase 32M includes live probes for:

- Coinbase Advanced Direct: exchange-specific Coinbase product candles. `1h`,
  `4h`, and `1d` are requested directly with `COINBASE_ADVANCED_BEARER_TOKEN`.
  Without credentials, the probe reports `auth_required` without making a
  network request. If credentials are rejected, the response is sanitized and
  reported as an auth failure. `1w` is reported unsupported rather than derived.
- Coinbase Exchange public: read-only comparator for old public product candles.
  It probes native public `1h` and `1d` where product ids exist. `4h` and `1w`
  are reported unsupported rather than guessed or derived.
- CryptoCompare: crypto historical OHLCV probe using inferred base/quote and
  exchange parameters where possible. Results are labeled as exchange-specific,
  aggregated, or uncertain based on source provenance. API-key or plan blocks
  are reported without throwing.
- CoinGecko: aggregated coin-level OHLC probe. Results are labeled
  aggregated-only and are not eligible as exchange-specific primary data.
- CryptoDataDownload: safe placeholder probe. It reports
  `needs_manual_url_mapping` rather than scraping pages or guessing brittle CSV
  URLs.

Paid or key-gated providers such as CoinAPI, Kaiko, Polygon, and Tiingo can be
included in the report as `paid_or_key_required`. The audit does not add secrets
or API keys.

## How To Run

JSON output:

```bash
pnpm market-data:providers:live-audit -- --providers=coinbase_advanced_direct,coinbase_exchange_public,cryptocompare,cryptodatadownload,coingecko --symbols=AERO-USDC,CLANKER-USDC,BNKR-USDC,BTCUSDT,ETHUSDT --timeframes=1h,4h,1d,1w --lookback-days=365 --json
```

Markdown output:

```bash
pnpm market-data:providers:live-audit -- --providers=coinbase_advanced_direct,coinbase_exchange_public,cryptocompare,cryptodatadownload,coingecko --limit-symbols=10 --timeframes=1h,4h,1d,1w --lookback-days=365 --markdown
```

Optional environment variables:

- `COINBASE_ADVANCED_BEARER_TOKEN`
- `CRYPTOCOMPARE_API_KEY`
- `COINGECKO_API_KEY`

Do not commit secrets. If a provider requires a key and no key is available, the
audit should report `auth_required`, `paid_or_key_required`, or
`limited_test_unavailable`.

Current unauthenticated VPS audit results showed Coinbase Advanced returning
HTTP 401 for `1h`, `4h`, and `1d`; Phase 32M treats that as an auth state rather
than a provider-coverage result. Coinbase Advanced may require auth even for
endpoints that appear public in documentation or examples.

## Interpreting Results

`unsupported` means the provider does not expose the requested native interval in
this audit path. Coinbase Advanced `1w` is the expected example.

`auth_required` means the provider rejected the request due to missing or
insufficient credentials.

`auth_rejected` means credentials were present but the provider rejected them.
The audit output must not include bearer tokens, API keys, or signed URLs.

`paid_or_key_required` means the provider is intentionally not probed without a
commercial/API-key decision.

`aggregated_only` means the provider result is not tied to a concrete exchange
listing. It may be useful for context, but not as an exchange-specific primary
source.

`insufficient_history` means the request returned usable candles but fewer than
the 200-candle VegaRank scoring threshold.

`symbol_mapping_missing` means the script did not know how to map the requested
symbol into that provider's identifier. This is not the same as provider outage.

`needs_manual_url_mapping` means a provider probably needs explicit URL or dataset
mapping before safe automation.

The decision summary includes:

- `productionReadyPrimaryCandidates`
- `requiresAuthCandidates`
- `paidOrKeyRequiredCandidates`
- `metadataOnlyCandidates`
- `blockedCandidates`
- `recommendedNextPhase`

CoinGecko remains `aggregatedOnly: true` even when its OHLC request succeeds. It
is suitable only for metadata or broad market context unless a future, separate
exchange-specific endpoint is proven.

## Native Versus Derived Intervals

The live audit does not hand-aggregate lower intervals into higher intervals.
Native support is reported separately from provider-aggregated or unsupported
availability. If future phases compare derived candles, the report must label
them as derived and preserve source provenance.

Current Coinbase production backfill still relies on CCXT direct `1d`, derived
`1w` from `1d`, and derived `4h` from `1h`. That remains a validation/fallback
path only. Phase 32M does not enable production cron and does not change
production ingestion.

## References

- Coinbase Advanced Trade Get Product Candles:
  `https://docs.cdp.coinbase.com/api-reference/advanced-trade-api/rest-api/products/get-product-candles`
- Coinbase Exchange Get Product Candles:
  `https://docs.cdp.coinbase.com/exchange/reference/exchangerestapi_getproductcandles`
- CoinGecko Coin OHLC Chart by ID:
  `https://docs.coingecko.com/reference/coins-id-ohlc`
- CryptoCompare historical API:
  `https://developers.coindesk.com/documentation/legacy/Historical/dataHistohour`
- CryptoDataDownload exchange data:
  `https://www.cryptodatadownload.com/data/binance/`
