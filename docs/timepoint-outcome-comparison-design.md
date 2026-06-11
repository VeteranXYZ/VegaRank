# Phase 12.3A Timepoint Outcome Comparison Design Narrowing

## 1. Executive Summary

Phase 12.3B should add a minimal, single-snapshot Forward Window Observation workflow to the existing `/archive` page.

The safest first version is:

1. Start from one selected historical single-timeframe `runId`.
2. Use the stored snapshot rows already shown by Phase 12.2.
3. Let the user choose one completed-candle window: 1, 3, 5, or 10 candles.
4. Return every stored row with neutral observation fields and a data status.
5. Show only simple count summaries: observed rows, complete, partial, missing, selected window, and research-only copy.

This is historical observation, not prediction. It is not a strategy backtester, not signal accuracy, and not a win-rate tool. It should support manual review by showing what later candles did after a stored scanner timepoint while keeping missing-data context visible.

## 2. Existing System Inventory

### Historical scan run data

Relevant files:

- `migrations/002_scan_results_pg.sql`
- `src/lib/storage/postgres/scannerResultsPg.ts`
- `src/server/trade-api.ts`
- `src/server/trade-api.test.ts`
- `src/lib/storage/postgres/scannerResultsPg.test.ts`

Current production data:

- `scan_runs` stores one row per scanner run with `id`, `timeframe`, `status`, `universe`, counters, `params`, `started_at`, and `finished_at`.
- `scan_signals` stores one row per symbol in a run with `scan_run_id`, `symbol_id`, `symbol`, `timeframe`, `scan_time`, `candle_open_time`, `price_at_signal`, rank/component scores, labels, risk types, factors, raw metrics, and versions.

Current API behavior:

- `GET /api/archive/snapshots` lists recent successful single-timeframe runs.
- `GET /api/archive/snapshot` validates `runId` as UUID, loads one successful run, then returns all stored rows for that run.
- Invalid `runId` values are rejected before opening Postgres.
- Snapshot detail sets `metadata.limited = false` and returns the full stored row set.

Recommendation:

- Reuse `getHistoricalScanRun` and the existing snapshot row model.
- Add a small future observation helper next to the Postgres history/snapshot storage logic.
- Leave latest-run selection untouched.

### Historical scan signal data

Relevant files:

- `migrations/002_scan_results_pg.sql`
- `src/lib/storage/postgres/scannerResultsPg.ts`
- `src/server/trade-api.ts`

Useful fields for 12.3B:

- `scan_signals.id`
- `scan_signals.scan_run_id`
- `scan_signals.symbol_id`
- `scan_signals.symbol`
- `scan_signals.timeframe`
- `scan_signals.scan_time`
- `scan_signals.candle_open_time`
- `scan_signals.price_at_signal`
- `scan_signals.rank_score`
- `scan_signals.signal_label`
- `scan_signals.action_bias`
- `scan_signals.primary_structure`
- `scan_signals.detected_risk_types`

Recommendation:

- Reuse stored snapshot rows as the observation universe.
- Do not recalculate scanner groups, rank, scoring, or latest-run selection.
- Do not rank rows by observed return.

### Market candle data

Relevant files:

- `migrations/001_market_data_pg.sql`
- `src/lib/storage/postgres/marketDataPg.ts`
- `src/lib/storage/marketDataSync.ts`
- `docs/production-operations.md`
- `README.md`

Current production data:

- `market_candles` stores OHLCV by `symbol_id`, `timeframe`, and `open_time`.
- Important indexes exist on `market_candles(symbol_id, timeframe, open_time desc)` and `(exchange, market, symbol, timeframe, open_time desc)`.
- `PgMarketDataStore.listCandles` can fetch recent candles for one symbol/timeframe.
- `PgMarketDataStore.getCandleCoverageForSymbol` can inspect coverage.

Production coverage facts:

- Production scripts backfill and scan `1h`, `4h`, `1d`, and `1w`.
- The runbook notes that weekly data can be missing for many symbols, and `1w` gaps are usually expected for newer or non-core symbols.

Recommendation:

- Market candle data is sufficient for an initial compute-on-read implementation if enough future candles exist.
- Do not add schema or cache for 12.3B.
- Avoid one query per symbol; use one batched SQL query with lateral candle subqueries.

### Existing signal evaluation code

Relevant files:

- `src/lib/storage/postgres/signalEvaluationPg.ts`
- `src/server/trade-api.ts`

Current behavior:

- `/api/signal/evaluation` computes forward returns from historical `scan_signals` and `market_candles`.
- `signalEvaluationPg` uses lateral joins to find an anchor candle and collect future candles.
- It has default horizons `[1, 3, 5, 10]`.
- It calculates average return, median return, positive rate, direction match rate, best return, and worst return.
- It includes interpretation fields such as expected direction, confidence, direction match, and sample quality.

Recommendation:

- Adapt the query pattern carefully.
- Do not reuse the existing result shape or UI vocabulary for 12.3B.
- Avoid positive rate, direction match, expected direction, confidence, and aggregate interpretation in the first timepoint endpoint.

### Existing symbol behavior and backtest-related code

Relevant files:

- `src/lib/storage/postgres/symbolBehaviorPg.ts`
- `src/lib/backtest/symbolBehavior.ts`
- `app/api/backtest/symbol/route.ts`

Current behavior:

- `symbolBehaviorPg` computes symbol-level historical behavior from prior scanner signals and forward candles.
- `src/lib/backtest/symbolBehavior.ts` provides no-database symbol setup review using similar historical structures.
- These paths include words and concepts such as backtest, favorable/unfavorable, false breakout, sample quality, and historical behavior.

Recommendation:

- Leave these paths untouched.
- Do not reuse their product framing for 12.3B.
- A new small historical observation helper is safer than expanding backtest or symbol-behavior code.

### Current History UI and API

Relevant files:

- `src/components/archive/HistoryPageClient.tsx`
- `src/components/archive/HistoryPageClient.test.tsx`
- `src/components/archive/HistoryDisabledPage.test.tsx`
- `app/archive/page.tsx`

Current behavior:

- `/archive` is live.
- It lists recent successful single-timeframe stored runs.
- It shows one selected stored run.
- It displays full stored snapshot rows.
- It uses deterministic `YYYY-MM-DD HH:mm` formatting.
- It softens unsafe action-like labels for display.
- It does not show forward returns, outcome comparison, distribution, relative performance, win rate, or accuracy.

Recommendation:

- Add 12.3B under the selected stored run on `/archive`.
- Keep single-timeframe scope.
- Keep full row visibility.
- Do not add charts or a large new UI layer.

### Relevant tests

Relevant files:

- `src/server/trade-api.test.ts`
- `src/components/archive/HistoryPageClient.test.tsx`
- `src/components/archive/HistoryDisabledPage.test.tsx`
- `src/lib/storage/postgres/scannerResultsPg.test.ts`
- `src/lib/storage/postgres/signalEvaluationPg.test.ts`
- `src/lib/storage/postgres/symbolBehaviorPg.test.ts`

Current coverage:

- History snapshot list and detail API tests.
- Invalid `runId` validation tests.
- History deterministic date formatting tests.
- History safer label mapping tests.
- Storage query tests for historical run loading.

Recommendation:

- Extend these with focused observation helper/API/UI tests in 12.3B.

## 3. Product Boundary

Allowed for Phase 12.3B:

- Observe what happened after one selected historical snapshot.
- Use a selected `runId` and the selected run's timeframe.
- Calculate forward window observations from completed candles.
- Show missing and partial data states.
- Show per-symbol historical observation fields.
- Summarize row count, complete count, partial count, and missing count.
- Support manual research.

Not allowed for Phase 12.3B:

- Strategy backtesting.
- Entry/exit simulation.
- Position sizing.
- Portfolio optimization.
- Signal accuracy framing.
- Win-rate framing.
- Worked/failed labels.
- Recommendation wording.
- Prediction labels.
- Ranking scanner logic by short-term forward returns.
- A signal leaderboard.
- AI summary.
- Charts.
- MTF historical reconstruction.

## 4. Anchor Time Design

Anchor choice is the highest-risk design decision. The product must not use future candle data as if it was known at scan time.

### Option A: Scan run `finished_at`

Correctness:

- `finished_at` is when the scan run completed, not necessarily the candle used by every signal.
- It is useful as run metadata and a reproducible stored timestamp.

Data availability:

- Available on `scan_runs`.

Reproducibility:

- Strong, because it is stored per run.

Lookahead risk:

- Medium if used to choose the first candle after the run as the base price. That candle's close was not known when the scan finished.

Complexity:

- Low.

User interpretability:

- Easy to explain as "run finished time", but not necessarily the scanner candle anchor.

Recommendation:

- Use as fallback context, not primary price anchor.

### Option B: Scan run `started_at`

Correctness:

- `started_at` is when the scan began. For a full-universe run, many signals are inserted later.

Data availability:

- Available on `scan_runs`.

Reproducibility:

- Strong.

Lookahead risk:

- Medium. It may predate signal insert time and still does not identify the candle the scanner used.

Complexity:

- Low.

User interpretability:

- Easy to show, weak as an observation anchor.

Recommendation:

- Do not use as primary anchor.

### Option C: Scan signal `scan_time`

Correctness:

- Stored per signal.
- In Postgres insert code, each signal receives `scan_time = now()` during insertion, so rows in one run can have slightly different scan times.

Data availability:

- Available on `scan_signals`.

Reproducibility:

- Good, but varies by signal within a run.

Lookahead risk:

- Low to medium if used to find the most recent candle at or before scan time.

Complexity:

- Medium because every row can anchor independently.

User interpretability:

- More complex than a single run anchor.

Recommendation:

- Useful fallback when `candle_open_time` is missing, but not ideal as the first-choice anchor.

### Option D: Stored signal candle close near the run time

Correctness:

- Best fit for the scanner's actual input data.
- `scan_signals.candle_open_time` and `price_at_signal` are stored with each signal.
- Existing evaluation and symbol behavior code already anchor to the latest market candle at or before `COALESCE(candle_open_time, scan_time)`.

Data availability:

- `candle_open_time` and `price_at_signal` are available on `scan_signals`.
- The corresponding candle can be found in `market_candles`.

Reproducibility:

- Strong, because it uses stored scanner output.

Lookahead risk:

- Low if the anchor candle is at or before the scan's stored signal time and future observations start after that candle.

Complexity:

- Medium.

User interpretability:

- Explain as "anchor candle used by the stored scanner row".

Recommendation:

- Recommended primary anchor for 12.3B.

### Option E: First completed candle after scan finished

Correctness:

- This is a clean first observation point after the run.
- It should not be used as the base anchor price because its close was not known when the scan finished.

Data availability:

- Available from `market_candles` if future candles exist.

Reproducibility:

- Good.

Lookahead risk:

- Low if treated as the first observed close. High if treated as the base price.

Complexity:

- Medium.

User interpretability:

- Clear as "1-candle observation" but confusing as the anchor.

Recommendation:

- Use as the first observation endpoint, not the base anchor.

### Recommended anchor approach for 12.3B

Use a per-row stored signal candle anchor:

1. Start with `scan_signals.candle_open_time` and `scan_signals.price_at_signal`.
2. Find the anchor candle in `market_candles` for the same `symbol_id` and timeframe where `open_time <= COALESCE(candle_open_time, scan_time)`, ordered by `open_time desc`, `limit 1`.
3. Use `price_at_signal` as `anchorClose` when present and positive.
4. If `price_at_signal` is missing, use the anchor candle `close`.
5. Future observation candles must satisfy `open_time > anchor.open_time`.

This avoids lookahead bias because the base anchor is the stored scanner row/candle, while the 1/3/5/10 windows are explicitly later completed candles.

## 5. Forward Window Design

### Natural time windows

Examples: 4h, 1d, 3d, 7d.

Pros:

- Familiar calendar-style language.

Cons:

- Timeframe mixing gets confusing.
- A 3-day window means different candle counts depending on selected timeframe.
- Weekly snapshots do not map cleanly to short natural windows.
- More risk of users reading the output as a strategy horizon.

Recommendation:

- Postpone.

### Number of completed candles

Examples: 1, 3, 5, 10 future completed candles.

Pros:

- Matches existing signal evaluation horizons.
- Keeps the selected run's timeframe as the unit.
- Avoids mixing natural time and scanner timeframe.
- Easier to test and explain.

Cons:

- Some users need a reminder that 10 candles means different elapsed time for `1h`, `4h`, `1d`, and `1w`.

Recommendation:

- Use for 12.3B.

### Timeframe-specific windows

Examples: custom windows per timeframe, such as `1h`: 4/12/24, `1d`: 1/3/5.

Pros:

- Can be tuned to each timeframe.

Cons:

- Adds product complexity too early.
- Makes cross-run comparison harder.

Recommendation:

- Postpone.

### Recommended forward-window approach for 12.3B

Use completed candle windows based on the selected snapshot timeframe:

- `window=1`
- `window=3`
- `window=5`
- `window=10`

Examples:

- A `4h` selected snapshot uses 1, 3, 5, or 10 future `4h` candles.
- A `1d` selected snapshot uses 1, 3, 5, or 10 future `1d` candles.
- A `1w` selected snapshot uses 1, 3, 5, or 10 future `1w` candles and will often have partial/missing rows until enough weekly candles exist.

The UI should label this as "completed candles", not "days", "targets", or "trade windows".

## 6. Minimal Data Fields for 12.3B

Recommended fields for 12.3B rows:

- `id`
- `scanRunId`
- `symbol`
- `exchange`
- `market`
- `timeframe`
- `group`
- `label`
- `primarySignal`
- `rankScore`
- `anchorTime`
- `anchorClose`
- `window`
- `observedTime`
- `observedClose`
- `observedReturnPct`
- `maxDrawdownPct`
- `dataStatus`
- `missingReason`

Field decisions:

| Field | Include in 12.3B? | Reason |
| --- | --- | --- |
| `symbol` | Yes | Primary row identity. |
| `group` | Yes | Existing research grouping context. |
| `label` | Yes | Existing scanner label context. |
| `primarySignal` | Yes | Existing softened History UI label can be reused. |
| `rankScore` | Yes | Existing snapshot context, not re-ranked by outcome. |
| `anchorTime` | Yes | Needed for auditability. |
| `anchorClose` | Yes | Needed to interpret observed return. |
| `observationWindow` / `window` | Yes | Shows the selected completed-candle window. |
| `observedTime` | Yes | Shows which later candle was observed. |
| `observedClose` | Yes | Neutral candle outcome data. |
| `observedReturnPct` | Yes | Acceptable as historical observation. |
| `maxDrawdownPct` | Yes | Acceptable as historical risk context within the window. |
| `dataStatus` | Yes | Required for missing/partial visibility. |
| `missingReason` | Yes | Required for user trust. |
| Average/median return | No for 12.3B | Save for distribution/report phase. |
| Positive rate | No | Too close to win-rate framing. |
| Direction match | No | Too close to accuracy framing. |
| Best/worst observed | No for 12.3B | Save for later distribution if needed, and use neutral wording. |

Use neutral labels:

- Observed return
- Max drawdown
- Data status
- Missing data
- Partial data
- Complete

Avoid:

- Success
- Failure
- Win
- Loss
- Accuracy
- Worked
- Failed

## 7. Missing and Partial Data Handling

12.3B should never silently drop rows. Every snapshot row should appear with a data status.

Recommended statuses:

- `complete`: anchor exists, anchor price exists, and the selected window has enough future candles.
- `partial`: anchor exists and at least one future candle exists, but fewer than the selected window exists.
- `missing`: anchor or anchor price is missing, or no usable future candles exist.
- `unavailable`: selected run exists but observations cannot be computed due to unsupported timeframe or query failure.

Recommended missing reasons:

- `missing_anchor_candle`
- `missing_anchor_price`
- `insufficient_future_candles`
- `no_future_candles`
- `unsupported_timeframe`
- `run_after_latest_candle`
- `symbol_not_in_candle_store`

Specific cases:

- Symbols without enough future candles: return `partial` if at least one future candle exists; otherwise `missing`.
- Newly listed symbols: often `partial` or `missing`; do not drop.
- Delisted symbols: likely `missing` or `partial`; keep the stored snapshot row.
- Missing candle gaps: mark `partial` if fewer future candles than requested are returned.
- `1w` data gaps: expected; summary should surface partial/missing counts clearly.
- BTC/ETH missing reference candles: not relevant in 12.3B because relative context is postponed.
- Run time after latest available candle: mark rows `missing` or `partial` with `run_after_latest_candle` or `insufficient_future_candles`.

Summary impact:

- Denominators must be full row count.
- Complete, partial, and missing counts should add up to full row count.
- No row should disappear from the table because of missing candles.
- Do not compute win rate, accuracy, or success rate from complete rows.

## 8. Existing Evaluation Code Review

### `signalEvaluationPg`

Safe to reuse:

- The idea of lateral joins from `scan_signals` to an anchor candle.
- The idea of collecting future candles ordered by `open_time asc`.
- Horizon validation concepts for `[1, 3, 5, 10]`.

Unsafe or not suitable for direct reuse:

- It loads recent candidate signals by filters and `limit`; 12.3B must use one selected `runId` and full stored row set.
- It computes `positiveRatePct`, `directionMatchRatePct`, `expectedDirection`, and `confidence`.
- It builds interpretation summaries that can read like signal-performance claims.
- It does not model per-row `complete` / `partial` / `missing` statuses for full-row visibility.

Recommendation:

- Do not call `loadSignalEvaluationPg` directly for 12.3B.
- Create a new small helper with a safer result shape.
- Reuse only query ideas and low-level math patterns after renaming output fields.

### `symbolBehaviorPg`

Safe to reuse:

- Query pattern for anchor plus forward candles.
- Max drawdown calculation ideas.

Unsafe or not suitable for direct reuse:

- Symbol-level behavior is not selected-snapshot based.
- It aggregates prior outcomes for one symbol and current signal context.
- It includes historical behavior diagnostics and aggregate samples not needed in 12.3B.

Recommendation:

- Leave untouched.
- Do not use as the 12.3B product engine.

### `src/lib/backtest/symbolBehavior.ts`

Safe to reuse:

- Nothing directly for 12.3B.

Unsafe or not suitable:

- It is explicitly backtest-like by name and match-mode semantics.
- It uses similar-setup matching rather than stored snapshot rows.
- It is no-database and per-symbol.

Recommendation:

- Avoid for 12.3B.

### New helper recommendation

Add a small future helper in 12.3B, likely near the Postgres scanner/archive storage code:

- `loadHistoricalSnapshotObservationsPg`
- Input: `scanRunId`, `assetClass`, optional `timeframe`, `window`
- Output: selected run metadata, full row observations, summary counts, disclaimer

This helper should be written with neutral naming from the start.

## 9. API Design Proposal for 12.3B

Do not implement this in 12.3A.

### Proposed endpoint

`GET /api/archive/snapshot-observations`

This path fits the current API style:

- Existing list: `/api/archive/snapshots`
- Existing detail: `/api/archive/snapshot`
- New observation detail: `/api/archive/snapshot-observations`

### Query params

- `runId`: required UUID.
- `window`: required or defaulted to `3`; valid values: `1`, `3`, `5`, `10`.
- `assetClass`: optional, default `crypto`.
- `timeframe`: optional validation guard; if present, must match the run timeframe.

### Validation rules

- Validate `runId` as UUID before opening Postgres.
- Validate `window` before opening Postgres.
- Validate `timeframe` against `1h`, `4h`, `1d`, `1w` if provided.
- Validate `assetClass` using existing asset-class parser.
- Return clean 400 errors and never expose internal database error codes.

Suggested invalid responses:

```json
{
  "ok": false,
  "service": "trade-api",
  "error": {
    "code": "INVALID_WINDOW",
    "message": "Observation window must be 1, 3, 5, or 10 completed candles."
  }
}
```

```json
{
  "ok": false,
  "service": "trade-api",
  "error": {
    "code": "INVALID_RUN_ID",
    "message": "Invalid run id."
  }
}
```

### High-level response shape

```json
{
  "ok": true,
  "service": "trade-api",
  "source": "postgres",
  "run": {
    "runId": "fcc05284-c7a0-4990-9bcb-5dd165d83c37",
    "timeframe": "4h",
    "startedAt": "2026-06-02T00:00:00.000Z",
    "finishedAt": "2026-06-02T00:05:00.000Z",
    "isLikelyFullUniverse": true
  },
  "metadata": {
    "window": 3,
    "windowUnit": "completed_candles",
    "rowCount": 409,
    "completeCount": 390,
    "partialCount": 5,
    "missingCount": 14,
    "limited": false,
    "disclaimer": "Research-only. Not financial advice. Historical observations are not predictions."
  },
  "rows": [
    {
      "id": "signal-id",
      "symbol": "BTCUSDT",
      "group": "eligible",
      "label": "confirmed",
      "primarySignal": "Manual review",
      "rankScore": 82.4,
      "anchorTime": "2026-06-02T00:00:00.000Z",
      "anchorClose": 100.0,
      "observedTime": "2026-06-02T12:00:00.000Z",
      "observedClose": 102.1,
      "observedReturnPct": 2.1,
      "maxDrawdownPct": -1.2,
      "dataStatus": "complete",
      "missingReason": null
    }
  ]
}
```

### Required behavior

- Load selected historical run by `runId`.
- Load all snapshot rows for the run.
- Load required market candles in a batched query.
- Calculate observations for every row.
- Return the full row set by default.
- Do not add pagination or row caps by default.
- Do not calculate win rate, accuracy, or success rate.
- Do not expose internal database errors.

### Performance concerns

- Typical row count is about 400-600.
- Use one SQL query with lateral joins rather than 400-600 separate candle queries.
- Existing `market_candles_symbol_timeframe_open_time_idx` supports per-symbol timeframe anchor/future lookup.
- Compute-on-read should be acceptable for 12.3B if only one selected run and one window are requested.

### Schema changes

- No schema change for 12.3B.
- No migration for 12.3B.
- Caching/materialized reports should be postponed until production performance proves it is needed.

## 10. UI / UX Proposal for 12.3B

Recommended location:

- Add a compact "Forward Observation" section under the selected stored run on `/archive`, before or above the snapshot table.

Suggested controls:

- Segmented window selector:
  - `1 candle`
  - `3 candles`
  - `5 candles`
  - `10 candles`

Suggested summary strip:

- Rows observed
- Complete
- Partial
- Missing
- Selected window
- Research-only disclaimer

Suggested table columns:

- Symbol
- Group
- Label
- Rank Score
- Anchor Close
- Observed Close
- Observed Return
- Max Drawdown
- Data Status

UI rules:

- Keep this as a compact report section.
- Do not add charts in 12.3B.
- Do not add a distribution report in 12.3B.
- Do not add BTC/ETH relative context in 12.3B.
- Do not add AI summary.
- Do not hide rows behind pagination or Show more.
- Keep all rows visible by default.
- If observation data is loading or unavailable, keep the stored snapshot table visible.

Copy rules:

- Use "Forward Observation", "Observed return", "Max drawdown", "Data status", "Missing data".
- Avoid "backtest", "accuracy", "win rate", "worked", "failed", "success", "prediction", "recommendation".

## 11. Safe Metrics and Unsafe Metrics

Safe metrics for 12.3B:

- Observed return percentage.
- Max drawdown within the selected window.
- Data status.
- Missing count.
- Partial count.
- Complete count.
- Number of observed rows.
- Selected completed-candle window.

Unsafe metrics as primary product labels:

- Win rate.
- Accuracy.
- Success rate.
- Signal worked.
- Signal failed.
- Profit factor.
- Strategy return.
- Prediction score.
- Recommendation score.
- Best signal.
- Top opportunity.

Observed return is acceptable because it is a neutral historical candle calculation from a stored anchor price to a later candle close. Max drawdown is acceptable because it describes historical downside movement inside the selected observation window. Both must be shown with data-status context and without recommendation language.

## 12. Performance and Query Risk

Expected row count:

- Production full-universe crypto snapshots usually appear around 400-600 rows.

Query strategy:

- Do not query candles symbol by symbol in application code.
- Add one Postgres helper query that starts from `scan_signals` for the selected run.
- Join `symbols` for asset-class and eligibility filters.
- Use lateral anchor and forward candle subqueries per row.
- Limit forward candles to the requested window.

Index support:

- `scan_signals_scan_run_id_idx` supports selecting rows by `scan_run_id`.
- `market_candles_symbol_timeframe_open_time_idx` supports anchor and forward candle lookup by symbol/timeframe/open time.
- `scan_runs` primary key supports `runId` lookup.

Compute-on-read:

- Recommended for 12.3B.
- It avoids schema changes and keeps the feature simple.
- It should be tested with production-like 400-600 row fixtures or smoke checks.

Caching:

- Postpone.
- Add only if production latency is unacceptable.

Schema changes:

- Not needed for 12.3B.
- Future materialized observation reports can be considered later if compute-on-read is too slow.

Risk areas:

- `1w` windows may be incomplete for many symbols.
- Newly listed and delisted symbols can create missing future candles.
- If a run is very recent, many rows will be partial or missing.
- If the scan used a candle that is missing from `market_candles`, anchor lookup can fail for that row.

## 13. Recommended 12.3B Scope

Exactly what to build:

- One read-only endpoint: `GET /api/archive/snapshot-observations`.
- One Postgres helper that loads full-row forward observations for one selected run and one completed-candle window.
- One compact `/archive` UI section under the selected stored run.
- One window selector for 1, 3, 5, and 10 completed candles.
- One summary strip with row counts and missing-data counts.
- One observation table that keeps all rows visible.

Likely files to change:

- `src/server/trade-api.ts`
- `src/server/trade-api.test.ts`
- `src/lib/storage/postgres/scannerResultsPg.ts` or a new focused Postgres history observation helper file.
- `src/lib/storage/postgres/scannerResultsPg.test.ts` or a new focused helper test file.
- `src/components/archive/HistoryPageClient.tsx`
- `src/components/archive/HistoryPageClient.test.tsx`

Helper to add:

- `loadHistoricalSnapshotObservationsPg` or equivalent.

API behavior to add:

- Validate params first.
- Load selected run.
- Load all snapshot rows and observation candles.
- Return all rows with `dataStatus`.
- Include `metadata.limited = false`.

UI section to add:

- "Forward Observation" under "Selected Stored Run".
- Window selector.
- Summary strip.
- Observation table.

Tests to add:

- UUID validation and window validation.
- Valid endpoint response with full row set.
- Anchor selection.
- Complete, partial, and missing rows.
- No win-rate/accuracy/success copy.
- No pagination/Show more/row cap UI.

What not to build:

- Distribution reports.
- Charts.
- Relative BTC/ETH performance.
- Market backdrop integration.
- Export of observations.
- MTF historical joined reconstruction.
- Any strategy backtesting or signal leaderboard.

## 14. Postpone / Avoid List

Postpone to 12.4 or later:

- Distribution report.
- Percentile view.
- Relative BTC/ETH performance.
- Market backdrop integration.
- Drawdown context expansion beyond per-row max drawdown.
- Charts.
- Export of observation results.
- Caching or materialized reports.
- MTF historical joined reconstruction.

Avoid:

- Backtesting strategy.
- Entry/exit simulation.
- Position sizing.
- Portfolio optimization.
- Win-rate leaderboard.
- Signal accuracy leaderboard.
- Scanner logic optimization by forward return.
- Recommendation system.
- Prediction labels.

## 15. Tests for Future Implementation

Recommended 12.3B tests:

### Anchor selection tests

- Uses `candle_open_time` anchor when present.
- Falls back to latest candle at or before `scan_time` when `candle_open_time` is missing.
- Does not use the first future candle as the base anchor.
- Uses `price_at_signal` as anchor close when present.
- Falls back to anchor candle close when `price_at_signal` is missing.

### Forward window tests

- `window=1` uses first future completed candle.
- `window=3` uses third future completed candle.
- `window=5` and `window=10` validate correctly.
- Invalid windows return 400 before opening Postgres.

### Missing candle tests

- Missing anchor candle returns `missing`.
- No future candles returns `missing`.
- Fewer future candles than requested returns `partial`.
- Full future candles returns `complete`.

### API validation tests

- Invalid `runId` returns `INVALID_RUN_ID`.
- Malformed UUID does not call Postgres.
- Invalid `window` returns `INVALID_WINDOW`.
- Missing run returns `SNAPSHOT_NOT_FOUND`.
- Internal Postgres errors are sanitized.

### Copy and UI tests

- UI renders "Forward Observation".
- UI renders "Observed return" and "Max drawdown".
- UI does not render "win rate", "accuracy", "worked", "failed", "success rate", "backtest", "buy", or "sell".
- Research-only copy remains visible.

### Full visibility tests

- Response rows length equals full selected snapshot row count.
- Complete, partial, and missing counts add up to row count.
- UI does not render pagination, Show more, top-100, or row cap copy.

### Performance-safe helper tests

- Helper builds a single batched SQL query for observations.
- Query includes `scan_run_id` and selected `window`.
- Query uses the existing timeframe from the selected run.

## 16. Final Recommendation

Phase 12.3B should be implemented, but only as a minimal single-snapshot Forward Window Observation feature.

Minimal safe version:

- One selected `runId`.
- One selected timeframe inherited from the run.
- One selected completed-candle window: 1, 3, 5, or 10.
- Full stored row set returned with `complete`, `partial`, or `missing` status.
- Per-row observed return and max drawdown only.
- Summary counts only.
- Research-only copy.

Must be checked before implementation:

- Production latency for a 400-600 row run with one window.
- How many rows in recent `1w` runs are partial/missing.
- Whether `price_at_signal` and `candle_open_time` are consistently populated in production rows.
- Whether the endpoint should default `window=3` or require explicit window selection.

Must remain out of scope:

- Distribution report.
- Percentiles.
- Relative BTC/ETH context.
- Market backdrop.
- Charts.
- Export.
- MTF historical reconstruction.
- AI summary.
- Strategy backtesting.
- Win-rate or accuracy framing.

No schema changes are needed for 12.3B. No cache is needed for the first implementation unless production testing proves compute-on-read is too slow.
