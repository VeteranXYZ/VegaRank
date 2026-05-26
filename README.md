# Crypto Technical Scanner

Crypto Technical Scanner is a web-based medium-to-large timeframe technical screening and research tool for Binance USDT spot markets.

It ranks markets by technical structure, volatility compression, confirmation strength, and risk context. It is not a trading bot and does not place trades.

## What It Does

- Scans Binance USDT spot markets by 24h quote volume.
- Focuses on larger market moves with supported timeframes `4h`, `1d`, `1w`, and `1M`.
- Uses `4h` as the minimum timeframe and `4h` + `1d` as the core multi-timeframe workflow.
- Calculates technical indicators from public candle data.
- Classifies each market into a neutral market phase.
- Produces opportunity, confirmation, risk, and rank scores.
- Explains why a symbol ranked, what would confirm the setup, and what would invalidate it.
- Displays a scanner table and a symbol detail chart.

## What It Does Not Do

- It does not place trades.
- It does not connect wallets.
- It does not request private exchange API keys.
- It does not manage portfolios.
- It does not provide financial advice, investment advice, trading recommendations, or profit guarantees.

## Current Status

Implemented MVP phases:

- Phase 1: Next.js App Router scaffold, TypeScript, Tailwind CSS, routes, components, and base types.
- Phase 2: Binance public data layer for markets and candles.
- Phase 3: Indicator calculation layer.
- Phase 4: Scanner scoring and `/api/scan`.
- Phase 5: Scanner UI with filters, table, selection, refresh, and request states.
- Phase 6: Symbol detail page with candlestick chart and overlays.
- Phase 7: In-memory cache, TTLs, response metadata, concurrency limits, and partial scan errors.
- Phase 8: README, known limitations, and final validation.

## Setup

```bash
npm install
npm run dev
```

Open:

- `http://127.0.0.1:3000/`
- `http://127.0.0.1:3000/scanner`
- `http://127.0.0.1:3000/symbol/binance/BTCUSDT`

## Development Commands

```bash
npm run lint
npm run build
npm run build:cloudflare
npm run preview:cloudflare
npm run deploy:cloudflare
npm run start
```

The build script uses `next build --webpack` because the current local environment blocks a Turbopack build operation that attempts to bind a local port during CSS processing.

## Cloudflare Workers Deployment

This app is prepared for Cloudflare Workers deployment via OpenNext for Cloudflare.

Production mode on Cloudflare supports the remote Binance scanner:

```txt
/api/scan?source=remote
/api/scan/mtf?source=remote
```

Remote Binance is the default and sufficient scanner source for Phase 1. The app is a private real-time scanner, not a paid database warehouse. D1, full candle warehousing, historical backfill, and persistent scan history are out of scope unless a future database backend is added. Cloudflare Workers should run with:

```txt
DISABLE_LOCAL_SQLITE=true
NEXT_PUBLIC_DEPLOY_TARGET=cloudflare
```

These values are set in `wrangler.jsonc`. Cloudflare production uses Remote Binance only; local SQLite code is isolated behind local Node.js branches. `source=local` returns a friendly `501` in Cloudflare production.

Cloudflare commands:

```bash
npm run build:cloudflare
npm run preview:cloudflare
npm run deploy:cloudflare
```

D1 is not configured in `wrangler.jsonc` for Phase 1. The old migration workflow is intentionally removed.

## Timeframes

The scanner is designed for medium-to-large timeframe coin selection, not intraday scalping.

Supported public scanner timeframes:

- `4h`
- `1d`
- `1w`
- `1M`

Unsupported lower timeframes intentionally return `400` from public scanner/candle APIs:

- `1h`
- `15m`
- `5m`
- `1m`

The core workflow is to scan eligible Binance USDT pairs on `4h`, confirm structure with `1d`, and optionally inspect `1w` and `1M`. Lower intervals were removed to reduce short-term noise and avoid unnecessary API/database load.

## Data Source

The MVP uses Binance public REST market data only.

The adapter reads from Binance's market-data endpoint:

```txt
https://data-api.binance.vision
```

This avoids regional restrictions that can affect `https://api.binance.com` in some locations. The app does not use private trading endpoints.

Market filtering:

- Includes `TRADING` spot markets quoted in `USDT`.
- Excludes stablecoin, fiat-like, and unsuitable bases such as `USDC`, `FDUSD`, `TUSD`, `BUSD`, `DAI`, `USDP`, `USDD`, `RLUSD`, `USD1`, `USDE`, `SUSDE`, `EUR`, `EURI`, `AEUR`, `BRL`, `TRY`, `UAH`, `ZAR`, `IDRT`, `BIDR`, and `U`.
- Excludes leveraged token suffixes such as `UP`, `DOWN`, `BULL`, `BEAR`, `3L`, `3S`, `5L`, and `5S`, with explicit exceptions for legitimate symbols where needed.
- Sorts by 24h quote volume.

Scanner calculations use only fully closed candles. If Binance returns a currently forming latest candle, the scanner removes it before calculating indicators, scores, and rankings. Chart views may still request recent candles for display.

## Architecture

```txt
UI
  -> Next.js API routes
  -> Exchange adapter
  -> Indicator layer
  -> Scanner layer
  -> Explanation output
```

Important boundaries:

- Exchange access lives in `src/lib/exchanges`.
- Indicator calculations live in `src/lib/indicators`.
- Scanner phase, scoring, warnings, and explanations live in `src/lib/scanner`.
- Chart rendering lives in `src/components/chart`.
- UI state and tables live in `src/components/scanner` and `src/components/symbol`.

## Indicators

The indicator layer wraps `technicalindicators` and exposes app-owned functions.

Implemented:

- SMA20
- SMA50
- SMA200
- Bollinger Bands 20, 2
- Bollinger Band Width
- Bollinger Band Width Percentile over recent valid widths
- RSI14
- Volume MA20
- Volume Ratio
- Price extension from MA20

Short candle arrays return `null` for unavailable indicators instead of throwing.

## Scoring

Each scan result includes:

- `opportunityScore`
- `confirmationScore`
- `riskScore`
- `rankScore`

The rank score is only used for sorting:

```txt
rankScore =
  opportunityScore * 0.45 +
  confirmationScore * 0.35 -
  riskScore * 0.25 -
  phase/risk penalties
```

All component scores remain visible in the UI. Compression remains visible as a reason, but weak structures are capped so breakdowns or prices below both MA50 and MA200 are not ranked as high-opportunity solely because volatility is compressed.

Market phases:

- `BASE_BUILDING`
- `SQUEEZE`
- `BREAKOUT_ATTEMPT`
- `BREAKOUT_CONFIRMED`
- `TRENDING`
- `PULLBACK_HEALTHY`
- `OVEREXTENDED`
- `DISTRIBUTION`
- `BREAKDOWN`

## API Routes

```txt
GET /api/markets?limit=100
GET /api/candles?source=remote&symbol=BTCUSDT&timeframe=4h&limit=300
GET /api/scan?source=remote&timeframe=4h
GET /api/scan?source=remote&timeframe=4h&maxSymbols=200&minQuoteVolume=10000000
GET /api/scan?source=remote&timeframe=4h&maxSymbols=all
GET /api/scan/mtf?source=remote&preset=short
```

Responses include:

- `itemCount`
- `cached`
- `cacheTtlSeconds`
- `cacheExpiresAt`
- `updatedAt`
- `durationMs`
- `eligibleCount`
- `scannedCount`
- `failedCount`
- `usesClosedCandles`
- `lastClosedCandleTime`
- `failureSummary`

The scan route defaults to the full eligible Binance Spot USDT universe with a hard safety cap of 600 symbols. `maxSymbols` is optional and only narrows the scan universe when explicitly provided. It is not the number of displayed result rows. Leave it empty, set it to `ALL` in the UI, or pass `maxSymbols=all` for full-market selection. The scan route uses `p-limit` with concurrency `5`. If one symbol fails, the route returns partial results and a small sampled `errors` array.

## Cache

The MVP uses process-local memory cache.

TTL values:

- Markets / exchangeInfo: 12 hours
- 24h tickers: 30 minutes
- 4h candles: 60 minutes
- 1d candles: 6 hours
- 1w candles: 24 hours
- 1M candles: 72 hours
- 4h scan: 60 minutes
- 1d scan: 6 hours
- 1w scan: 24 hours
- 1M scan: 72 hours

This cache resets when the server process restarts.

## Known Limitations

- The cache is in-memory and not shared across server instances.
- Scoring rules are MVP heuristics and should be tuned with observation.
- The scanner only supports Binance Spot USDT markets.
- Symbol detail supports 4h and 1d in the UI.
- There is no historical signal storage or backtesting.
- There are no user accounts or saved watchlists.
- `npm audit` currently reports a moderate advisory from Next's transitive `postcss <8.5.10` dependency. `npm audit fix --force` would install a breaking downgrade, so it has not been applied.

## Future Roadmap

v2:

- Watchlist with localStorage.
- Multi-timeframe alignment.
- BTC/ETH market regime filter.
- Better liquidity tiers.
- Better chart annotations.

v3:

- PostgreSQL and Prisma.
- Historical signal snapshots.
- Backtesting.
- Watchlist alerts.
- Additional exchange adapters.

v4:

- User accounts.
- Saved scanner templates.
- Custom scoring weights.
- Signal performance analytics.

## Safety Disclaimer

This tool is for technical screening and research only. It does not provide financial advice, investment advice, trading recommendations, or profit guarantees. It does not place trades or connect to user wallets or exchange accounts.

See `PROJECT_SPEC.md` for the full product specification.
