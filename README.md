# VegaRank

VegaRank is a professional crypto technical research-ranking system for Binance USDT spot markets.

It ranks research candidates by technical structure, volatility compression, confirmation strength, evidence quality, and risk context. It is research-only and is not trading advice.

## What It Does

- Reviews Binance USDT spot markets by 24h quote volume.
- Focuses on larger market moves with supported timeframes `4h`, `1h`, `1d`, `1w`, and `1M`.
- Uses `4h` + `1d` as the core multi-timeframe workflow, with `1h` available for explicitly run production follow-up scans.
- Calculates technical indicators from public candle data.
- Classifies each market into a neutral market phase.
- Produces opportunity, confirmation, risk, and rank scores.
- Explains why a symbol ranked, what would confirm the setup, and what would invalidate it.
- Displays market rankings and a symbol detail chart.

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
- Phase 4: Ranking scoring and `/api/rankings`.
- Phase 5: Rankings UI with filters, table, selection, refresh, and request states.
- Phase 6: Symbol detail page with candlestick chart and overlays.
- Phase 7: In-memory cache, TTLs, response metadata, concurrency limits, and partial scan errors.
- Phase 8: README, known limitations, and final validation.

## Production Operations

Use the [production operations runbook](docs/production-operations.md) for VPS deployment, BaoTa schedules, production scan commands, validation, and troubleshooting.

## Setup

```bash
npm install
npm run dev
```

Dependency versions are pinned in `package.json` and `package-lock.json`; do not
use `"latest"` ranges for Phase 1 stabilization work.

Open:

- `http://127.0.0.1:3000/`
- `http://127.0.0.1:3000/rankings`
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

Production mode on Cloudflare supports remote Binance rankings:

```txt
/api/rankings?source=remote
/api/rankings/mtf?source=remote
```

Remote Binance remains the default ranking source for Cloudflare. Cached latest-rankings
JSON is feature-gated and disabled by default until a production cache reader is
implemented. The app is a private real-time ranking and research tool, not a trading
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

### Cloudflare Pages Production Environment

Cloudflare Pages Production should define the public VegaRank API base URL at
build time so the `/rankings` frontend calls the public API host:

```txt
NEXT_PUBLIC_TRADE_API_BASE_URL=https://api.vegarank.com
```

With this value present, the latest rankings request is built as
`https://api.vegarank.com/api/rankings/latest?...`. If the environment variable
is missing, the frontend defaults to `https://api.vegarank.com`.

### Public Trade API CORS Verification

After deploying or restarting `https://api.vegarank.com`, verify that the public
VegaRank origin receives CORS headers:

```bash
curl -i \
  -H 'Origin: https://vegarank.com' \
  'https://api.vegarank.com/api/rankings/latest?timeframe=4h&assetClass=crypto&limit=100'
```

Expected response headers include:

```txt
Access-Control-Allow-Origin: https://vegarank.com
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

Verify the preflight path does not require a database lookup:

```bash
curl -i -X OPTIONS \
  -H 'Origin: https://vegarank.com' \
  -H 'Access-Control-Request-Method: GET' \
  'https://api.vegarank.com/api/rankings/latest?timeframe=4h&assetClass=crypto&limit=100'
```

Expected: `HTTP 204` and
`Access-Control-Allow-Origin: https://vegarank.com`. After API deploy,
open `https://vegarank.com/rankings`; the latest rankings table should render
without a browser CORS error.

Verify that the latest public crypto ranking run is selecting a full ranking universe
run rather than a small manual/test run:

```bash
curl 'https://api.vegarank.com/api/rankings/latest?timeframe=4h&assetClass=crypto&limit=100' \
  | jq '{ok, symbolsTotal: .run.symbolsTotal, scanned: .run.symbolsScanned, signalsCreated: .run.signalsCreated, latestRunSelection: .summary.latestRunSelection}'
```

Expected `symbolsTotal`, `scanned`, and `signalsCreated` should generally be at
least `300` for the crypto all-symbol ranking run. `latestRunSelection.fallbackUsed`
should be `false` when a full universe run is available.

D1 is not configured in `wrangler.jsonc` for Phase 1. The old migration workflow is intentionally removed.

### Cloudflare Free Batching

Cloudflare Workers Free can hit the external subrequest limit if one invocation ranks hundreds of symbols. As a temporary Phase 1 solution, the Rankings UI processes full-market ranking runs through sequential frontend batches:

- API form: `/api/rankings?source=remote&timeframe=4h&batchMode=true&batchSize=20&cursor=0`
- MTF API form: `/api/rankings/mtf?source=remote&preset=short&batchMode=true&batchSize=8&cursor=0`
- Single-timeframe default batch size: `20`
- Single-timeframe maximum API batch size: `25`
- MTF default batch size: `8`
- MTF maximum API batch size: `10`
- The frontend requests one batch at a time, merges results, deduplicates by symbol/timeframe, then sorts by `rankScore`.

MTF batches are smaller because each symbol needs candles for multiple timeframes. Numeric `maxSymbols` requests such as `maxSymbols=100` still use the normal single-call ranking path. The `/rankings` UI defaults to `maxSymbols=100`; manual `ALL` live ranking runs are capped by `SCANNER_MAX_LIVE_SYMBOLS` (default `100`) for Cloudflare stability. Workers Paid or a VPS background ranking job may remove the need for this batching later. D1, KV, R2, Queues, and Durable Objects are not required for this phase.

### Historical Behavior Review

Phase 1 includes a no-database per-symbol historical behavior review from the selected-symbol inspector.

- UI entry: `Historical Performance` / `历史表现`, then `Review setup` / `回看此结构`.
- API form: `/api/backtest/symbol?symbol=VANAUSDT&timeframe=4h&matchMode=standard`
- One request reviews one symbol and one timeframe only.
- Supported backtest timeframes remain `4h`, `1d`, `1w`, and `1M`.
- Default candle limit is `1000`; the API clamps requests to `300` through `1000`.
- Match modes are `broad`, `standard`, and `similar`.
- Results are lazy-loaded, cached in memory, and not persisted.

This feature answers how the same symbol behaved after similar historical technical structures. It measures forward behavior after matched setups, but it does not simulate entries, exits, position sizing, fees, slippage, PnL curves, or portfolio outcomes. Small samples are weak evidence and should be treated cautiously. It is a research-only structure review, not a full backtesting system, trading simulator, portfolio engine, signal engine, or financial advice. It does not use D1, KV, R2, database persistence, full candle warehousing, or historical backfill.

## Timeframes

VegaRank is designed for medium-to-large timeframe coin selection, not intraday scalping.

Supported public ranking timeframes:

- `4h`
- `1h`
- `1d`
- `1w`
- `1M`

Unsupported lower timeframes intentionally return `400` from public ranking/candle APIs:

- `15m`
- `5m`
- `1m`

The core workflow is to rank eligible Binance USDT pairs on `4h`, confirm structure with `1d`, and optionally inspect `1h`, `1w`, and `1M`. The `1h` path is supported when explicitly backfilled and ranked; it is not automatically scheduled by this runbook.

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

Ranking calculations use only fully closed candles. If Binance returns a currently forming latest candle, the ranking engine removes it before calculating indicators, scores, and rankings. Chart views may still request recent candles for display.

## Architecture

```txt
UI
  -> Next.js API routes
  -> Exchange adapter
  -> Indicator layer
  -> Ranking engine
  -> Explanation output
```

Important boundaries:

- Exchange access lives in `src/lib/exchanges`.
- Indicator calculations live in `src/lib/indicators`.
- Ranking phase, scoring, warnings, and explanations live in `src/lib/ranking-engine`.
- Chart rendering lives in `src/components/chart`.
- UI state and tables live in `src/components/rankings` and `src/components/symbol`.

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

Each ranking result includes:

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

All component scores remain visible in the UI. Structure remains the base layer, while volume mainly adjusts confirmation and risk. Compression remains visible as a reason, but weak structures are capped so breakdowns or prices below both MA50 and MA200 are not ranked as high-opportunity solely because volatility or volume is compressed. VegaRank remains a research/filtering tool, not a trading signal or execution system.

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
GET /api/rankings?source=remote&timeframe=4h
GET /api/rankings?source=remote&timeframe=4h&maxSymbols=200&minQuoteVolume=10000000
GET /api/rankings?source=remote&timeframe=4h&maxSymbols=all
GET /api/rankings?source=remote&timeframe=4h&batchMode=true&batchSize=20&cursor=0
GET /api/rankings/mtf?source=remote&preset=short
GET /api/rankings/mtf?source=remote&preset=short&batchMode=true&batchSize=8&cursor=0
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

The ranking route defaults to remote Binance with a live-ranking safety limit. Passing
`maxSymbols=all` means "all within the current live safety cap" on Cloudflare-like
runtime paths, not an unbounded all-market background job. The UI defaults to
ranking the top 100 eligible symbols and displaying 50 rows. The single-timeframe
ranking route uses `p-limit` with concurrency `3`; MTF uses concurrency `2`. If one
symbol fails, the route returns partial results and a small sampled `errors` array.

Batch responses also include `batchMode`, `cursor`, `nextCursor`, `hasMore`, `batchSize`, `batchIndex`, `totalBatches`, `totalEligibleCount`, and `scannedInBatch`.

## Rankings Workbench

The `/rankings` page is a desktop-first compact technical workbench:

- Dense three-column layout: filters, results table, and selected-symbol inspector.
- Compact status bar shows source, mode, timeframe, ranking progress, cache state, duration, and next refresh.
- The table is the primary surface for comparing symbols; it uses compact rows, sticky headers, O/C/R score cells, warning counts, MACD status, and inline MA indicators.
- The right inspector keeps detailed reasoning, warnings, volume context, next confirmation, invalidation, and data quality for the selected row.
- Full-market ranking runs can process all eligible symbols while the default visible row count remains 50.

## Cache

The MVP uses process-local memory cache.

TTL values:

- Markets / exchangeInfo: 12 hours
- 24h tickers: 30 minutes
- 4h candles: 60 minutes
- 1h candles: 30 minutes
- 1d candles: 6 hours
- 1w candles: 24 hours
- 1M candles: 72 hours
- 4h ranking: 60 minutes
- 1h ranking: 30 minutes
- 1d ranking: 6 hours
- 1w ranking: 24 hours
- 1M ranking: 72 hours

This cache resets when the server process restarts.

## Signal Research Storage

Local Node.js runs can record ranking output for research. The default mode is
SQLite-first structured storage at `.data/scanner-research.sqlite`, with JSONL kept
as a fallback and migration source. This is research infrastructure only: it does
not place trades, does not connect to private exchange endpoints, and does not use
real trading API keys.

Configure storage with:

- `SCANNER_RESEARCH_STORAGE=sqlite` for local structured storage.
- `SCANNER_RESEARCH_STORAGE=jsonl` for legacy JSONL files.
- `SCANNER_RESEARCH_STORAGE=disabled` to keep live ranking results but skip research writes.

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
  supports `--horizon=1h|4h|24h|3d|7d`, `--limit=100`, and supported ranking
  `--timeframe=4h|1h|1d|1w|1M`.
- `research:prune` is dry-run by default. Add `--execute` to delete old rows using
  the provided retention windows.
- `research:stats` prints storage mode, database path in local development, record
  counts, scoring version distribution, label/action/risk/timeframe counts, pending
  evaluations, insufficient data count, and latest ranking/evaluation times.
- `research:inspect` prints recent signals with scores, labels, risk types, and
  any saved evaluation status.

Forward evaluation runs through `/api/archive/evaluate?horizon=24h&limit=500`. It
only evaluates candles that already exist in local synced market data. If there are
no completed horizons yet, the Research Archive evaluation panel shows
`Not enough evaluated data yet.` An `insufficient_data` outcome means the signal is
stored, but the local candle database does not yet contain enough later candles for
that horizon. It is not a failure and it is not a forecast.

The status API `/api/archive/research-stats` returns the same basic storage summary
for the UI and local checks without exposing secrets.

### PostgreSQL Latest Ranking Results

PostgreSQL ranking results must be read by latest successful `scan_runs.id`, not by
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

### Multi-timeframe Production Update

Use the PostgreSQL-backed backfill and ranking job commands for production
multi-timeframe coverage. The `--limit` flag on `market:backfill:pg` is the
Binance page size; `1d` backfills target `1000` stored candles by default and
`1w` backfills target `500` weekly candles or as much history as Binance has.
For `1h`, pass `--target-count 5000` explicitly; do not use the full `50000`
target for this phase.

1. Backfill 1d candles:

```bash
pnpm market:backfill:pg -- --timeframe 1d --all-symbols --asset-class crypto --limit 500 --confirm-large-sync
```

2. Run the 1d ranking job:

```bash
pnpm scanner:run:pg -- --timeframe 1d --all-symbols --asset-class crypto --limit 500 --confirm-large-sync
```

3. Verify latest 1d results:

```bash
curl 'https://api.vegarank.com/api/rankings/latest?timeframe=1d&assetClass=crypto&limit=100' \
  | jq '{ok, count, run: {timeframe: .run.timeframe, symbolsTotal: .run.symbolsTotal, symbolsScanned: .run.symbolsScanned, signalsCreated: .run.signalsCreated}, latestRunSelection: .summary.latestRunSelection, totalByGroup: .summary.totalByGroup}'
```

4. Backfill 1w candles:

```bash
pnpm market:backfill:pg -- --timeframe 1w --all-symbols --asset-class crypto --limit 500 --confirm-large-sync
```

5. Run the 1w ranking job:

```bash
pnpm scanner:run:pg -- --timeframe 1w --all-symbols --asset-class crypto --limit 500 --confirm-large-sync
```

6. Verify latest 1w results:

```bash
curl 'https://api.vegarank.com/api/rankings/latest?timeframe=1w&assetClass=crypto&limit=100' \
  | jq '{ok, count, run: {timeframe: .run.timeframe, symbolsTotal: .run.symbolsTotal, symbolsScanned: .run.symbolsScanned, signalsCreated: .run.signalsCreated}, latestRunSelection: .summary.latestRunSelection, totalByGroup: .summary.totalByGroup}'
```

7. Verify Symbol Research for both timeframes:

```bash
curl 'https://api.vegarank.com/api/symbol/research?exchange=binance&symbol=SEIUSDT&timeframe=1d' \
  | jq '{ok, timeframe, latest: {scanTime: .latest.signal.scanTime, resultGroup: .latest.signal.resultGroup, isSelectedCurrentRun: .latest.signal.isSelectedCurrentRun, sourceRunIsLikelyFullUniverse: .latest.signal.sourceRunIsLikelyFullUniverse}, candles: {count: .candles.count, rowsCount: (.candles.rows | length)}, historyCount: (.history | length)}'

curl 'https://api.vegarank.com/api/symbol/research?exchange=binance&symbol=SEIUSDT&timeframe=1w' \
  | jq '{ok, timeframe, latest: {scanTime: .latest.signal.scanTime, resultGroup: .latest.signal.resultGroup, isSelectedCurrentRun: .latest.signal.isSelectedCurrentRun, sourceRunIsLikelyFullUniverse: .latest.signal.sourceRunIsLikelyFullUniverse}, candles: {count: .candles.count, rowsCount: (.candles.rows | length)}, historyCount: (.history | length)}'
```

8. Backfill 1h candles with an explicit 5000-candle target:

```bash
pnpm market:backfill:pg -- --timeframe 1h --all-symbols --asset-class crypto --target-count 5000 --limit 1000 --confirm-large-sync
```

9. Run the 1h ranking job after backfill completes:

```bash
pnpm scanner:run:pg -- --timeframe 1h --all-symbols --asset-class crypto --limit 1000 --confirm-large-sync
```

10. Verify latest 1h results and Symbol Research:

```bash
curl 'https://api.vegarank.com/api/rankings/latest?timeframe=1h&assetClass=crypto&limit=100' \
  | jq '{ok, timeframe, count, run: {timeframe: .run.timeframe, symbolsTotal: .run.symbolsTotal, symbolsScanned: .run.symbolsScanned, signalsCreated: .run.signalsCreated}, latestRunSelection: .summary.latestRunSelection, totalByGroup: .summary.totalByGroup}'

curl 'https://api.vegarank.com/api/symbol/research?exchange=binance&symbol=BTCUSDT&timeframe=1h' \
  | jq '{ok, timeframe, latest: {scanTime: .latest.signal.scanTime, resultGroup: .latest.signal.resultGroup, isSelectedCurrentRun: .latest.signal.isSelectedCurrentRun, sourceRunIsLikelyFullUniverse: .latest.signal.sourceRunIsLikelyFullUniverse}, behaviorAvailable: .behaviorDiagnostics.available, behaviorReason: .behaviorDiagnostics.reason}'
```

11. Restart the public API after code changes:

```bash
pm2 restart trade-api --update-env
```

Expected caveats:

- `1w` may skip newer or recently listed symbols because there are fewer weekly
  candles. Those skips are counted in `symbols_skipped`; fake signals are not
  created for insufficient history.
- `1h` may initially have limited Historical Behavior samples. Backfill and scan
  it explicitly before enabling a schedule; this repository does not install cron
  or BaoTa tasks automatically.

### Production Timeframe Scripts

The repo-tracked `scripts/production/run-*-production.sh` scripts are intended
for BaoTa / BT Panel to call after each timeframe's candle close. They create
`.data/logs` and `.data/locks`, use independent timeframe-specific lock files to
prevent overlapping runs, clean stale locks, then run the PostgreSQL market
backfill before the ranking job.

Tracked runner commands:

| Timeframe | Package command | Stale lock | Backfill target |
| --- | --- | ---: | ---: |
| 1h | `pnpm production:1h` | 5400s | 5000 |
| 4h | `pnpm production:4h` | 14400s | 5000 |
| 1d | `pnpm production:1d` | 43200s | 3000 |
| 1w | `pnpm production:1w` | 86400s | 1000 |

Manual one-off run from the VPS project directory:

```bash
cd /home/ubuntu/apps/trade-scanner
mkdir -p .data/logs .data/locks
pnpm production:4h
```

Suggested BaoTa scheduled task commands:

```bash
# 1h: hourly, slightly after the hour
cd /home/ubuntu/apps/trade-scanner && pnpm production:1h >> .data/logs/production-1h.log 2>&1

# 4h: every 4 hours, after candle close
cd /home/ubuntu/apps/trade-scanner && pnpm production:4h >> .data/logs/production-4h.log 2>&1

# 1d: daily after UTC daily candle close
cd /home/ubuntu/apps/trade-scanner && pnpm production:1d >> .data/logs/production-1d.log 2>&1

# 1w: weekly after UTC weekly candle close
cd /home/ubuntu/apps/trade-scanner && pnpm production:1w >> .data/logs/production-1w.log 2>&1
```

If BaoTa requires absolute script paths instead of package commands, call the
matching wrapper directly, for example:

```bash
cd /home/ubuntu/apps/trade-scanner && /home/ubuntu/apps/trade-scanner/scripts/production/run-1h-production.sh >> /home/ubuntu/apps/trade-scanner/.data/logs/run-1h-production.log 2>&1
```

Log checks:

```bash
tail -n 120 .data/logs/production-4h.log
tail -f .data/logs/production-4h.log
```

Production API verification:

```bash
curl 'https://api.vegarank.com/api/rankings/latest?timeframe=4h&assetClass=crypto&limit=5' \
  | jq '{ok, timeframe, count, run: {id: .run.id, status: .run.status, symbolsTotal: .run.symbolsTotal, symbolsScanned: .run.symbolsScanned, signalsCreated: .run.signalsCreated}, latestRunSelection: .summary.latestRunSelection}'

pnpm smoke:production
pnpm check:coverage
```

Operational notes:

- GitHub main -> VPS is `git pull origin main`.
- VPS/local -> GitHub main is `git add`, `git commit`, and `git push`.
- Cloudflare Pages deploys the frontend from GitHub main.
- `pm2 restart trade-api --update-env` affects only the VPS `trade-api`.

### VPS Evaluation Scheduling

Do not deploy these examples directly from this repository state; they are reference
commands for a future Oracle VPS or PostgreSQL-backed deployment. Keep the ranking
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
sync, local ranking runs, signal persistence, forward evaluation, and latest-rankings
JSON export. It is intentionally separate from Cloudflare. Cloudflare `/rankings`
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

The sync job, ranking job, evaluation job, and export job should remain separate.
Cloudflare should not perform heavy all-market ranking runs; the VPS background workflow is
where larger local datasets should be accumulated.

## Known Limitations

- The cache is in-memory and not shared across server instances.
- Scoring rules are MVP heuristics and should be tuned with observation.
- VegaRank currently supports Binance Spot USDT markets.
- Symbol Research depends on PostgreSQL scan coverage for the requested
  timeframe; `4h`, `1h`, `1d`, and `1w` are the production coverage targets.
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
- Saved ranking templates.
- Custom scoring weights.
- Signal performance analytics.

## Safety Disclaimer

This tool is for technical screening and research only. It does not provide financial advice, investment advice, trading recommendations, or profit guarantees. It does not place trades or connect to user wallets or exchange accounts.

See `PROJECT_SPEC.md` for the full product specification.
