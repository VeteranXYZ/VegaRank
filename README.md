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

Dependency versions are pinned in `package.json` and `package-lock.json`; do not
use `"latest"` ranges for Phase 1 stabilization work.

Open:

- `http://127.0.0.1:3000/`
- `http://127.0.0.1:3000/scanner`
- `http://127.0.0.1:3000/symbol/binance/BTCUSDT`

## Development Commands

```bash
npm run lint
npm test
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

Remote Binance remains the default scanner source for Cloudflare. Cached latest-scan
JSON is feature-gated and disabled by default until a production cache reader is
implemented. The app is a private real-time scanner and research tool, not a trading
bot. Cloudflare Workers should run with:

```txt
DISABLE_LOCAL_SQLITE=true
DEPLOY_TARGET=cloudflare
```

These values are set in `wrangler.jsonc`. Cloudflare production uses Remote Binance only; local SQLite code is isolated behind local Node.js branches. `source=local` returns a friendly `501` in Cloudflare production. `source=cached` also returns a controlled `501` unless `NEXT_PUBLIC_SCANNER_ENABLE_CACHED_SOURCE=true` is explicitly enabled and a cache reader is implemented.

Cloudflare commands:

```bash
npm run build:cloudflare
npm run preview:cloudflare
npm run deploy:cloudflare
```

D1 is not configured in `wrangler.jsonc` for Phase 1. The old migration workflow is intentionally removed.

### Cloudflare Free Batching

Cloudflare Workers Free can hit the external subrequest limit if one invocation scans hundreds of symbols. As a temporary Phase 1 solution, the Scanner UI processes full-market scans through sequential frontend batches:

- API form: `/api/scan?source=remote&timeframe=4h&batchMode=true&batchSize=20&cursor=0`
- MTF API form: `/api/scan/mtf?source=remote&preset=short&batchMode=true&batchSize=8&cursor=0`
- Single-timeframe default batch size: `20`
- Single-timeframe maximum API batch size: `25`
- MTF default batch size: `8`
- MTF maximum API batch size: `10`
- The frontend requests one batch at a time, merges results, deduplicates by symbol/timeframe, then sorts by `rankScore`.

MTF batches are smaller because each symbol needs candles for multiple timeframes. Numeric `maxSymbols` requests such as `maxSymbols=100` still use the normal single-call scan path. The `/scanner` UI defaults to `maxSymbols=100`; manual `ALL` live scans are capped by `SCANNER_MAX_LIVE_SYMBOLS` (default `100`) for Cloudflare stability. Workers Paid or a VPS background scanner may remove the need for this batching later. D1, KV, R2, Queues, and Durable Objects are not required for this phase.

### Historical Behavior Review

Phase 1 includes a no-database per-symbol historical behavior review from the selected-symbol inspector.

- UI entry: `Historical Performance` / `历史表现`, then `Review setup` / `回看此结构`.
- API form: `/api/backtest/symbol?symbol=VANAUSDT&timeframe=4h&matchMode=standard`
- One request reviews one symbol and one timeframe only.
- Supported timeframes are the same medium-to-large scanner intervals: `4h`, `1d`, `1w`, and `1M`.
- Default candle limit is `1000`; the API clamps requests to `300` through `1000`.
- Match modes are `broad`, `standard`, and `similar`.
- Results are lazy-loaded, cached in memory, and not persisted.

This feature answers how the same symbol behaved after similar historical technical structures. It measures forward behavior after matched setups, but it does not simulate entries, exits, position sizing, fees, slippage, PnL curves, or portfolio outcomes. Small samples are weak evidence and should be treated cautiously. It is a research-only structure review, not a full backtesting system, trading simulator, portfolio engine, signal engine, or financial advice. It does not use D1, KV, R2, database persistence, full candle warehousing, or historical backfill.

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
- Excludes stablecoin, fiat-like, commodity-like, and unsuitable bases such as `USDC`, `FDUSD`, `TUSD`, `BUSD`, `DAI`, `USDP`, `USDD`, `RLUSD`, `BFUSD`, `XUSD`, `USD1`, `USDE`, `SUSDE`, `FRAX`, `PAXG`, `XAUT`, `EUR`, `EURI`, `AEUR`, `BRL`, `TRY`, `UAH`, `ZAR`, `IDRT`, `BIDR`, and `U`.
- Excludes wrapped/staking duplicates such as `WBTC`, `WBETH`, and `BNSOL`.
- Excludes fan tokens such as `PSG`, `ATM`, `PORTO`, `LAZIO`, `SANTOS`, `ASR`, `ACM`, `BAR`, `JUV`, `CITY`, and `ALPINE`.
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
- Volume MA50
- Quote Volume MA20 when Binance kline quote volume is available
- Volume Ratio 20 / 50
- Volume dry-up, expansion, abnormal spike, breakout confirmation, healthy pullback, and distribution-warning context
- MACD 12/26/9
- Price extension from MA20

MACD is used as a confirmation input for momentum improvement, crosses, and weakening warnings. It is not treated as a standalone trading signal. KDJ is intentionally not included in Phase 1 to avoid adding noisy or overfit confirmation layers.

Volume analysis uses the volume and quote-volume fields already included in Binance kline responses, so it does not add extra Binance requests. Volume acts as confirmation and risk context: breakout without volume is not treated as strong confirmation, quiet volume during compression is a setup/watchlist clue rather than confirmation, and abnormal volume spikes can increase risk when the structure is extended or distribution-like.

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
  opportunityScore * 0.40 +
  confirmationScore * 0.40 -
  riskScore * 0.30 -
  phase/risk penalties
```

All component scores remain visible in the UI. Structure remains the base layer, while volume mainly adjusts confirmation and risk. Compression remains visible as a reason, but weak structures are capped so breakdowns or prices below both MA50 and MA200 are not ranked as high-opportunity solely because volatility or volume is compressed. The scanner remains a research/filtering tool, not a trading signal or execution system.

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
GET /api/scan?source=remote&timeframe=4h&batchMode=true&batchSize=20&cursor=0
GET /api/scan/mtf?source=remote&preset=short
GET /api/scan/mtf?source=remote&preset=short&batchMode=true&batchSize=8&cursor=0
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

The scan route defaults to remote Binance with a live-scan safety limit. Passing
`maxSymbols=all` means "all within the current live safety cap" on Cloudflare-like
runtime paths, not an unbounded all-market background job. The UI defaults to
scanning the top 100 eligible symbols and displaying 50 rows. The single-timeframe
scan route uses `p-limit` with concurrency `3`; MTF uses concurrency `2`. If one
symbol fails, the route returns partial results and a small sampled `errors` array.

Batch responses also include `batchMode`, `cursor`, `nextCursor`, `hasMore`, `batchSize`, `batchIndex`, `totalBatches`, `totalEligibleCount`, and `scannedInBatch`.

## Scanner Workbench

The `/scanner` page is a desktop-first compact technical workbench:

- Dense three-column layout: filters, results table, and selected-symbol inspector.
- Compact status bar shows source, mode, timeframe, scan progress, cache state, duration, and next refresh.
- The table is the primary surface for comparing symbols; it uses compact rows, sticky headers, O/C/R score cells, warning counts, MACD status, and inline MA indicators.
- The right inspector keeps detailed reasoning, warnings, volume context, next confirmation, invalidation, and data quality for the selected row.
- Full-market scans can process all eligible symbols while the default visible row count remains 50.

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

## Signal Research Storage

Local Node.js runs can record scanner output for research. The default mode is
SQLite-first structured storage at `.data/scanner-research.sqlite`, with JSONL kept
as a fallback and migration source. This is research infrastructure only: it does
not place trades, does not connect to private exchange endpoints, and does not use
real trading API keys.

Configure storage with:

- `SCANNER_RESEARCH_STORAGE=sqlite` for local structured storage.
- `SCANNER_RESEARCH_STORAGE=jsonl` for legacy JSONL files.
- `SCANNER_RESEARCH_STORAGE=disabled` to keep live scanner results but skip research writes.

Legacy JSONL files are `.data/scan-signal-snapshots.jsonl`,
`.data/scan-signals.jsonl`, and `.data/signal-forward-evaluations.jsonl`.
SQLite stores the same records in `scan_snapshots`, `scan_signals`,
`scan_signal_risk_types`, and `signal_forward_evaluations`.

The current scoring version is `explainable-v1`; it is stored on every signal so
future scoring changes can be evaluated separately. The first retention policy is
conservative and documented in code: scan snapshots and scan signals are intended to
retain 30 days, and forward evaluations 90 days. Automatic pruning is not enabled;
use the manual prune command below when you want to apply retention.

### Research Storage Operations

The project includes lightweight maintenance commands for local development and
future VPS scheduling:

```bash
npm run research:migrate
npm run research:evaluate -- --horizon=24h --limit=100
npm run research:prune -- --dry-run --signal-days=30
npm run research:prune -- --execute --signal-days=30 --snapshot-days=30 --evaluation-days=90
npm run research:stats
npm run research:inspect -- --symbol=BTCUSDT --limit=10
```

Command behavior:

- `research:migrate` imports the legacy JSONL files into SQLite. It is idempotent
  and uses record ids plus `signal_id + horizon` uniqueness to avoid duplicate
  forward evaluations.
- `research:evaluate` checks pending signals for a completed future horizon. It
  supports `--horizon=1h|4h|24h|3d|7d`, `--limit=100`, and supported scanner
  `--timeframe=4h|1d|1w|1M`.
- `research:prune` is dry-run by default. Add `--execute` to delete old rows using
  the provided retention windows.
- `research:stats` prints storage mode, database path in local development, record
  counts, scoring version distribution, label/action/risk/timeframe counts, pending
  evaluations, insufficient data count, and latest scan/evaluation times.
- `research:inspect` prints recent signals with scores, labels, risk types, and
  any saved evaluation status.

Forward evaluation runs through `/api/history/evaluate?horizon=24h&limit=500`. It
only evaluates candles that already exist in local synced market data. If there are
no completed horizons yet, the scanner Research / Evaluation panel shows
`Not enough evaluated data yet.` An `insufficient_data` outcome means the signal is
stored, but the local candle database does not yet contain enough later candles for
that horizon. It is not a failure and it is not a forecast.

The status API `/api/history/research-stats` returns the same basic storage summary
for the UI and local checks without exposing secrets.

### PostgreSQL Latest Scan Results

PostgreSQL scanner results must be read by latest successful `scan_runs.id`, not by
`max(scan_time)`. A single scan run inserts many `scan_signals` rows, and each row
can have a slightly different `scan_time`.

```sql
with latest_run as (
  select id
  from scan_runs
  where timeframe = '4h'
    and status = 'success'
  order by finished_at desc nulls last, started_at desc
  limit 1
)
select *
from scan_signals
where scan_run_id = (select id from latest_run);
```

The current PostgreSQL run counters are `symbols_total`, `symbols_scanned`,
`symbols_skipped`, and `failed_symbols`.

### VPS Evaluation Scheduling

Do not deploy these examples directly from this repository state; they are reference
commands for a future Oracle VPS or PostgreSQL-backed deployment. Keep the scanner
job that records new signals separate from the evaluation job that validates
already-recorded signals.

Cron examples:

```cron
*/30 * * * * cd /path/to/project && npm run research:evaluate -- --horizon=1h --limit=100
0 */4 * * * cd /path/to/project && npm run research:evaluate -- --horizon=4h --limit=100
30 0 * * * cd /path/to/project && npm run research:evaluate -- --horizon=24h --limit=200
```

Minimal systemd timer shape:

```ini
# /etc/systemd/system/scanner-research-evaluate.service
[Service]
WorkingDirectory=/path/to/project
ExecStart=/usr/bin/npm run research:evaluate -- --horizon=24h --limit=200

# /etc/systemd/system/scanner-research-evaluate.timer
[Timer]
OnCalendar=*-*-* 00:30:00
Persistent=true
```

The evaluation job does not pull a full Binance history by itself. It evaluates
signals only when future candles are already present in the local market-data store.
The result is a statistical research record, not a trading recommendation or return
guarantee.

## Oracle VPS First Stage Runbook

The Oracle VPS first stage is a local Node.js workflow for background market data
sync, local scanner runs, signal persistence, forward evaluation, and latest-scan
JSON export. It is intentionally separate from Cloudflare. Cloudflare `/scanner`
continues to default to `source=remote`; cached latest JSON is disabled by default
and should only be enabled after a real cache reader is wired.

No trading API is used. There are no private Binance API keys, no order endpoints,
and no automated trading behavior.

Local market candles are stored in `.data/market-data.sqlite` by default. Set
`MARKET_DATA_DB_PATH=/path/to/market-data.sqlite` to override this for a VPS or
isolated test run. This preserves the existing market-data database path. Research
signals and evaluations remain in `.data/scanner-research.sqlite` by default. The
market-data schema now includes:

- `market_candles`
- `market_data_sync_jobs`

The older local `candles` table is kept for compatibility. New sync writes use the
structured `market_candles` table, while local scans read `market_candles` first
and fall back to legacy `candles` rows when needed.

`market_data_sync_jobs.status` uses `running`, `success`, `partial_success`,
`failed`, and `skipped`. Sync summaries report `candlesFetched` as the number of
rows returned by Binance, plus exact local `candlesInserted` and `candlesUpdated`
counts from SQLite upsert checks. Duplicate candles do not create duplicate rows
because `market_candles` has a unique key on `(market, source, symbol, timeframe,
open_time)`.

CLI commands:

```bash
npm run market:sync -- --universe=core --timeframe=4h --lookback=500
npm run market:sync -- --symbol=BTCUSDT --timeframe=4h --lookback=500
npm run market:sync -- --symbols=BTCUSDT,ETHUSDT --timeframes=4h,1d
npm run market:stats
npm run market:inspect -- --symbol=BTCUSDT --timeframe=4h --limit=20

npm run scanner:run -- --source=local --symbol=BTCUSDT --timeframe=4h
npm run scanner:run -- --source=local --universe=core --timeframe=4h
npm run scanner:export-latest
```

Safety behavior:

- `market:sync` requires `--symbol`, `--symbols`, or `--universe=core`.
- It never defaults to all Binance markets.
- `--lookback` is capped at `1000` candles.
- A single symbol failure is recorded and reported without killing the whole job;
  the command exits non-zero only if all requested pairs fail.
- `scanner:run --source=local` reads only local SQLite `market_candles` data. It
  does not request Binance. If local candles are insufficient, it skips the symbol
  and prints a warning.
- `research:evaluate` reads local market candles through the market-data store. It
  does not perform market sync or remote backfill.

`scanner:export-latest` writes stable JSON files for future Cloudflare cache
reading:

- `.data/public/latest-scan.json`
- `.data/public/latest-scan-4h.json`
- `.data/public/latest-scan-1d.json`

These exports include `generatedAt`, `timeframe`, `scoringVersion`, `source`,
`results`, `summary`, `warnings`, and `researchStats`. They intentionally omit
secrets, absolute local paths, hostnames, and server metadata. If there are no scan
records yet, the files contain a stable empty state instead of fake data.

Example VPS separation:

```cron
15 */4 * * * cd /path/to/project && npm run market:sync -- --universe=core --timeframe=4h --lookback=500
25 */4 * * * cd /path/to/project && npm run scanner:run -- --source=local --universe=core --timeframe=4h
35 */4 * * * cd /path/to/project && npm run research:evaluate -- --horizon=24h --limit=200
40 */4 * * * cd /path/to/project && npm run scanner:export-latest
```

The sync job, scanner job, evaluation job, and export job should remain separate.
Cloudflare should not perform heavy all-market scans; the VPS background workflow is
where larger local datasets should be accumulated.

## Known Limitations

- The cache is in-memory and not shared across server instances.
- Scoring rules are MVP heuristics and should be tuned with observation.
- The scanner only supports Binance Spot USDT markets.
- Symbol detail supports 4h and 1d in the UI.
- Signal research storage is local SQLite/JSONL research infrastructure, not trading advice or portfolio/PnL simulation.
- The selected-symbol historical behavior review is per-symbol, lazy-loaded, no-database, and research-only.
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
