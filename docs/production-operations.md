# Production Operations Runbook

This runbook covers production deployment, ranking job scheduling, verification, and troubleshooting for the VegaRank VPS and public frontend.

## 1. Production Architecture

- The frontend is deployed by Cloudflare Pages from GitHub `main`.
- The public frontend is `https://vegarank.com`.
- The public API is served by the VPS PM2 process `trade-api`.
- The public API host is `https://api.vegarank.com`.
- Postgres stores market candles, `scan_runs`, and `scan_signals`.
- Ranking production jobs write market candle data, runs, and signal records into Postgres.
- The frontend and API read latest stored data. A frontend deploy does not refresh ranking data.
- Restarting PM2 affects only the `trade-api` API process, not the Cloudflare Pages frontend.
- Production scripts are independent of PM2 unless API code changes also need a restart.

## 2. GitHub main -> VPS Update Workflow

Use this workflow when the VPS repo needs the latest files from GitHub `main`.

```bash
cd ~/apps/vegarank
git status
git log --oneline -5
```

Only pull when the working tree is clean:

```bash
git pull origin main
pnpm install --frozen-lockfile
```

If the working tree is not clean:

- Stop.
- Inspect `git status`.
- Do not pull until the local changes are understood.

## 3. Frontend Deployment Workflow

Cloudflare Pages deploys the frontend from GitHub `main`.

- If only frontend, component, test, or documentation files changed, a VPS PM2 restart is not needed.
- If only frontend files changed, pushing to GitHub `main` is enough for Cloudflare Pages to build and deploy.
- A VPS pull is only needed when production scripts, backend API code, or server-side tools need the latest repo files on the VPS.

Validation:

- Cloudflare Pages build should pass.
- Check these public pages:
  - `https://vegarank.com/screener`
  - `https://vegarank.com/watchlist`
  - `https://vegarank.com/symbol/binance/BTCUSDT?timeframe=1h`

## 4. Backend/API Deployment Workflow

If `src/server/trade-api.ts` or API runtime code changes, pull the latest repo on the VPS and restart PM2.

If only docs, frontend files, tests, or scanner scripts changed, PM2 restart is not needed unless those changes affect API runtime behavior.

```bash
cd ~/apps/vegarank
git status
git pull origin main
pnpm install --frozen-lockfile
pnpm build
pm2 restart trade-api --update-env
pm2 status
pm2 logs trade-api --lines 80
```

Then validate:

```bash
pnpm smoke:production
pnpm check:coverage
```

## 5. Production Scan Commands

Production scan commands:

```bash
pnpm production:1h
pnpm production:4h
pnpm production:1d
pnpm production:1w
```

Each command:

- Loads `.env` when present.
- Validates `DATABASE_URL` and `REDIS_URL`.
- Uses a per-timeframe lock in `.data/locks`.
- Backfills market candles for the requested timeframe.
- Runs the scanner across the full crypto universe.
- Writes `scan_runs` and `scan_signals` into Postgres.
- Does not require a PM2 restart.

## 6. Recommended BaoTa Schedule Commands

Do not install these from this runbook automatically. Copy them into BaoTa or another scheduler after confirming the server timezone and desired schedule.

1h:

```bash
cd ~/apps/vegarank && pnpm production:1h >> .data/logs/production-1h.log 2>&1
```

4h:

```bash
cd ~/apps/vegarank && pnpm production:4h >> .data/logs/production-4h.log 2>&1
```

1d:

```bash
cd ~/apps/vegarank && pnpm production:1d >> .data/logs/production-1d.log 2>&1
```

1w:

```bash
cd ~/apps/vegarank && pnpm production:1w >> .data/logs/production-1w.log 2>&1
```

Recommended schedule:

- `1h`: every hour, around minute `06`.
- `4h`: every 4 hours after candle close, for example `00:08`, `04:08`, `08:08`, `12:08`, `16:08`, and `20:08` Los Angeles time if using a local scheduler.
- `1d`: daily after UTC daily candle close, around `17:12` Los Angeles time during PDT.
- `1w`: weekly after UTC weekly candle close, around Sunday `17:20` Los Angeles time during PDT.

Notes:

- Binance candles are UTC-based.
- Scheduler UI may use server local time.
- Confirm actual server timezone with:

```bash
date
timedatectl
```

## 7. Production Validation Checklist

Run:

```bash
pnpm smoke:production
pnpm check:coverage
```

Expected results:

- `smoke:production` should PASS.
- `check:coverage` should PASS or WARN.
- WARN is acceptable for:
  - high `1w` missing count, because many symbols lack enough weekly history.
  - non-core symbols missing `1w`.
- FAIL means investigate before trusting production data.

Quick API checks:

```bash
curl -s 'https://api.vegarank.com/api/rankings/mtf-latest?assetClass=crypto' | jq '{ok, count, signalCounts, missingCounts}'
```

```bash
curl -s 'https://api.vegarank.com/api/market/context?assetClass=crypto' | jq '{ok, context, title: .summary.title}'
```

```bash
curl -s 'https://api.vegarank.com/api/symbol/research?exchange=binance&symbol=BTCUSDT&timeframe=1h' | jq '{ok, timeframe, group: .latest.signal.resultGroup, signalLabel: .latest.signal.signalLabel, behaviorAvailable: .behaviorDiagnostics.available}'
```

## 8. Freshness Troubleshooting

Check latest runs for all production timeframes:

```bash
for tf in 1h 4h 1d 1w; do
  echo "===== $tf ====="
  curl -s "https://api.vegarank.com/api/rankings/latest?timeframe=$tf&assetClass=crypto&limit=5" \
    | jq '{
      ok,
      timeframe,
      count,
      run: {
        id: .run.id,
        status: .run.status,
        symbolsTotal: .run.symbolsTotal,
        symbolsScanned: .run.symbolsScanned,
        signalsCreated: .run.signalsCreated,
        startedAt: .run.startedAt,
        finishedAt: .run.finishedAt
      },
      latestRunSelection: .summary.latestRunSelection
    }'
done
```

If one timeframe is stale, run that production command manually. Example:

```bash
pnpm production:4h
```

Then rerun:

```bash
pnpm check:coverage
```

## 9. Log Checks

Production script logs:

```bash
tail -n 120 .data/logs/production-1h.log
tail -n 120 .data/logs/production-4h.log
tail -n 120 .data/logs/production-1d.log
tail -n 120 .data/logs/production-1w.log
```

PM2 logs:

```bash
pm2 status
pm2 logs trade-api --lines 80
```

Production script logs show scanner job and backfill failures. PM2 logs show API server failures.

Do not confuse scanner job failures with frontend Cloudflare deployment issues.

## 10. Lock Handling

- Production scripts use `.data/locks`.
- If a job is already active, the script exits `0`.
- Stale locks are removed automatically after the timeframe-specific threshold.
- Do not manually delete locks unless sure no job is running.

Useful commands:

```bash
ls -l .data/locks
cat .data/locks/*.lock 2>/dev/null || true
```

## 11. Common Problems and Responses

| Problem | Response |
| --- | --- |
| `check:coverage` FAIL because `4h` is stale | Run `pnpm production:4h`, then `pnpm check:coverage`. If stale again later, check the BaoTa `4h` schedule. |
| `smoke:production` fails but coverage passes | API endpoint or runtime issue. Check PM2 logs and restart `trade-api` only if needed. |
| Coverage warns about `1w` missing count | Usually acceptable. Weekly history is limited for many symbols. |
| `BTCUSDT` or `ETHUSDT` missing `1w` | Investigate immediately. Core weekly coverage should exist. |
| `latestRunSelection.fallbackUsed` is `true` | Investigate whether the full-universe run failed or a smaller/manual run was selected. |
| `EADDRINUSE` in PM2 logs | A previous process may be occupying API port `3000`. Check PM2 status and port usage before restarting repeatedly. |

Useful port command:

```bash
sudo lsof -i :3000
```

## 12. Safety Rules

- Stop when a command fails.
- Do not continue blindly after a failed install, test, build, or production job.
- Do not run `git pull` with a dirty working tree.
- Do not restart PM2 for frontend-only changes.
- Do not change coverage thresholds just to make checks pass.
- Do not run production scripts repeatedly in parallel.
- Do not manually edit the production database unless explicitly planned.

## 13. Validation for Documentation Changes

For this documentation change, run:

```bash
./node_modules/.bin/vitest run
./node_modules/.bin/eslint .
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/next build --webpack
git diff --check
```

Since this runbook and README link are documentation-only changes, PM2 restart is not required.

Cloudflare Pages deployment is not functionally required for a documentation-only change, but committing docs to GitHub `main` is fine.
