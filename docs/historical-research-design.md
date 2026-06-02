# Phase 12.0 Historical Research & Timepoint Validation Design

## 1. Executive Summary

Phase 12 should become a Historical Research and Timepoint Validation workflow for reviewing what the scanner showed at a past point in time, exporting current or filtered research lists, and observing later market behavior from that selected point.

This phase should not become a trading strategy backtester, order simulator, or prediction system. It should help manual review by preserving scanner context, showing later outcome distributions, exposing missing-data limits, and keeping live scanning separate from historical reports.

The safest implementation path is:

1. Build export for the current or filtered Screener result.
2. Build a historical snapshot viewer around stored scan runs and scan signals.
3. Build forward window observation from a selected snapshot.
4. Add distribution, relative performance, drawdown, and market backdrop context after the snapshot and timepoint data model is proven.

## 2. Existing System Inventory

### Production storage

The production runbook states that Postgres stores market candles, `scan_runs`, and `scan_signals`, and that production scanner jobs write those records into Postgres. See `docs/production-operations.md`.

Relevant schema:

- `migrations/001_market_data_pg.sql`
  - `symbols`: Binance spot symbol identity, eligibility, asset class, market context flags, and quote-volume metadata.
  - `market_candles`: candle warehouse keyed by `(symbol_id, timeframe, open_time)`, with `open_time_ms`, `close_time_ms`, OHLCV, quote volume, and indexes by symbol/timeframe/open time.
  - `market_data_sync_jobs`: sync job metadata.
- `migrations/002_scan_results_pg.sql`
  - `scan_runs`: one row per scanner run, with `timeframe`, `universe`, `status`, symbol counters, params, and start/finish times.
  - `scan_signals`: one row per symbol result in a run, with price, rank score, component scores, labels, risk types, factors, raw metrics, scoring version, and scanner version.
- `migrations/003_symbol_universe_pg.sql`
  - Adds `asset_class`, `is_scanner_eligible`, `is_backtest_eligible`, and `is_market_context` to `symbols`.

Production query/storage code:

- `src/lib/storage/postgres/marketDataPg.ts`
  - Upserts Binance symbols and candles.
  - Lists candles by symbol and timeframe.
  - Reports candle coverage and sync jobs.
- `src/lib/storage/postgres/scannerResultsPg.ts`
  - Creates and finishes `scan_runs`.
  - Inserts `scan_signals`.
  - Selects the latest successful run by `scan_runs.id`, ordered by `finished_at desc nulls last, started_at desc`.
  - Can prefer full-universe crypto runs using the full-universe counters and run params.
  - Lists all signals for a run via `listLatestScanSignalsForRun`.
- `src/lib/storage/postgres/symbolResearchPg.ts`
  - Loads the selected latest signal for one symbol/timeframe.
  - Loads symbol signal history.
  - Loads latest symbol signals across timeframes.
  - Loads recent candles and candle coverage.
  - Delegates symbol behavior calculation to `symbolBehaviorPg`.
- `src/lib/storage/postgres/signalEvaluationPg.ts`
  - Computes historical forward observations from `scan_signals` and `market_candles`.
  - It already calculates returns across candle horizons and group/label/structure breakdowns.
  - It uses terms such as expected direction, positive rate, direction match rate, best/worst return in types and internals. That code should be reused carefully only if the future UI reframes output as research observations.

### Local research storage

Local research storage is separate from the current production path:

- `src/lib/storage/sqlite/schema.ts`
  - Defines local `scan_snapshots`, `scan_signals`, `scan_signal_risk_types`, `signal_forward_evaluations`, `market_candles`, and `market_data_sync_jobs`.
- `src/lib/storage/scanSignalModel.ts`
  - Defines local snapshot and signal records.
  - Retention constants are 30 days for signals/snapshots and 90 days for forward evaluations.
- `src/lib/storage/scanEvaluation.ts`
  - Evaluates local stored signals against local candles.
  - It includes outcome labels such as favorable/unfavorable and some older entry/evaluation naming. This is useful implementation history, but the Phase 12 product should avoid those labels in the primary UI.
- `src/lib/storage/scanSnapshots.ts`
  - JSONL snapshot persistence fallback.
- `src/lib/storage/sqlite/scanSignalSqlite.ts`
  - Local structured storage for snapshots, signals, forward evaluations, and aggregate performance groups.

Local storage is useful as a reference for data shape, not as the production source of truth for Phase 12 unless a future subphase explicitly decides to expose it.

### Candle history availability

Production candle availability is in `market_candles`.

Relevant code:

- `src/lib/storage/marketDataSync.ts`
  - Local sync defaults: `1h`, `4h`, and `1d` default to 1000 candles, `1w` to 500, and `1M` to 300.
  - Incremental sync fetches from the latest stored open time.
- `src/lib/storage/postgres/marketDataPg.ts`
  - Postgres backfill/upsert stores candle timestamps and OHLCV.
- `README.md`
  - Production guidance says `1h` should target 5000 stored candles, `4h` production scripts target 5000, `1d` targets 3000, and `1w` targets 1000.
  - The README explicitly notes that `1w` may skip newer or recently listed symbols because many symbols lack enough weekly history.

### Current APIs

Production VPS API in `src/server/trade-api.ts`:

- `/api/scan/latest`
  - Current latest single-timeframe stored scan.
  - Uses latest successful `scan_runs.id`.
  - Accepts timeframe, asset class, include flags, and a response limit.
- `/api/scan/mtf-latest`
  - Current multi-timeframe joined screener source.
  - Joins latest selected runs across `1h`, `4h`, `1d`, and `1w`.
  - Returns rows, run metadata, signal counts, and missing counts.
- `/api/symbol/research`
  - Current symbol research source.
  - Returns latest selected signal, history, timeframe snapshots, behavior, candle payload, and current run selection metadata.
- `/api/signal/evaluation`
  - Existing Postgres forward observation endpoint.
  - It is not a complete timepoint validation product and its naming should be reframed before broader UI use.
- `/api/market/context`
  - Current market context using latest selected scanner data for context symbols such as BTC and ETH.
- `/api/candles`
  - Recent candles for a symbol/timeframe.
- `/api/market-data/coverage`
  - Candle coverage by timeframe and asset class.
- `/api/scan/runs`
  - Lists recent scan runs.

Next app APIs:

- `app/api/history/scans/route.ts`
  - Currently returns `501`; persistent scan history is disabled in this deployment.
- `app/api/history/evaluate/route.ts`
  - Runs local research evaluation through the local storage adapter.
- `app/api/history/research-stats/route.ts`
  - Returns local research storage stats.
- `app/api/backtest/symbol/route.ts`
  - No-database per-symbol historical behavior review. It is lazy-loaded and not a production snapshot system.

### Current frontend flows

- `src/components/screener/MultiTimeframeScreenerPageClient.tsx`
  - Fetches `/api/scan/mtf-latest`.
  - Builds joined rows from latest selected timeframe runs.
  - Shows all joined symbols by default.
  - Filters, buckets, search, and sorting are client-side after the full joined row set is loaded.
- `src/components/screener/multiTimeframeScreenerUi.ts`
  - Builds MTF rows, research buckets, sorting, filtering, and symbol research links.
- `src/components/symbol/SymbolResearchPageClient.tsx`
  - Fetches `/api/symbol/research`.
  - Shows current selected run context, score breakdown, history, timeframe availability, candle context, timeline, behavior, and signal evaluation panels.
- `src/components/watchlist/WatchlistPageClient.tsx`
  - Fetches the same MTF latest data and filters it to user-selected symbols.
  - Uses local browser storage for the user's watchlist. Phase 12 should not add more localStorage.
- `app/history/page.tsx`
  - The public History page currently says persistence is disabled.
- `src/components/history/HistoryPageClient.tsx`
  - Older local history UI exists but is not currently used by `app/history/page.tsx`.

### Current evaluation-related code

Reuse candidates:

- `src/lib/storage/postgres/signalEvaluationPg.ts` can provide query patterns for anchoring scan signals to candles and calculating forward returns.
- `src/lib/storage/postgres/symbolBehaviorPg.ts` and `src/lib/backtest/symbolBehavior.ts` can inform symbol-level context, but their current "backtest" framing should not be expanded as the Phase 12 product frame.
- `src/lib/storage/scanEvaluation.ts` can inform local evaluation mechanics, but its outcome labels and entry/evaluation naming should be avoided or heavily reframed.

Avoid as primary product framing:

- "backtest" as the main feature name.
- signal accuracy, win rate, direction match, expected direction, entry/exit, favorable/unfavorable as the central UI vocabulary.

## 3. Product Boundary

Allowed for Phase 12 implementation planning:

- Export current Screener rows.
- Export filtered Screener rows.
- View historical scanner snapshots by run/timepoint.
- Select the nearest available run to a requested timepoint.
- Compare later observed outcomes from a selected timepoint.
- Show outcome distributions, relative performance, drawdown context, and missing-data context.
- Support manual research and research-only reports.

Not allowed:

- Buy/sell recommendations.
- Strategy entry/exit simulation.
- Position sizing.
- Portfolio optimization.
- Signal win-rate as product truth.
- Automatic scanner logic ranking by short-term forward returns.
- Prediction labels.
- High-probability labels.
- "Best picks" or "top opportunities" wording.
- Changing scanner scoring, grouping, ranking, latest-run selection, row caps, pagination, or default full-table behavior.

## 4. Mature Product Pattern Analysis

TradingView Strategy Report:

- Useful pattern: separate historical reports from live scanning.
- Useful pattern: show distributions, drawdown, and time-window summaries in a report surface.
- Not appropriate now: order simulation, entry/exit simulation, strategy PnL, fees, slippage, position sizing, or optimization.

Koyfin:

- Useful pattern: research-oriented market views with historical context and report-style analysis.
- Useful pattern: mix symbol, market backdrop, and timeframe context without implying a decision.
- Not appropriate now: turning scanner groups into portfolio recommendations.

Finviz:

- Useful pattern: high-density screening, filtering, and export.
- Useful pattern: make export available from the current table state.
- Not appropriate now: hiding the table behind default pagination or using "top opportunity" framing.

Portfolio analytics tools:

- Useful pattern: time ranges, distributions, relative performance, drawdown, and volatility context.
- Useful pattern: explicitly show missing observations and sample size.
- Not appropriate now: portfolio optimization, allocation advice, or a strategy leaderboard.

For trade-scanner, the practical pattern is a split between live scanner workbench and historical research report. Live scanner remains about current research triage. Historical Research is a separate read-only report layer.

## 5. Proposed Phase 12 Product Concepts

### Current Screener Export

- User question: "What symbols and research context am I seeing right now?"
- Data required: current in-memory Screener rows from `/api/scan/mtf-latest` after the client builds joined rows.
- Complexity: Low.
- Safety risk: Low if framed as an export of visible research rows.
- Recommended priority: Build first.

### Filtered Screener Export

- User question: "What does my current narrowed research list contain?"
- Data required: current joined rows after client-side filters, search, bucket preset, and sort.
- Complexity: Low.
- Safety risk: Low if export preserves neutral labels and disclaimer.
- Recommended priority: Build first with current export.

### Historical Snapshot

- User question: "What did the scanner show at or near this past time?"
- Data required: `scan_runs` and `scan_signals` for selected timeframe(s), plus symbol eligibility metadata.
- Complexity: Medium.
- Safety risk: Medium because historical report can be mistaken for strategy evidence.
- Recommended priority: Build later, after export.

### Snapshot Nearest-Time Selection

- User question: "Which stored scan run is closest to my selected timepoint?"
- Data required: `scan_runs.started_at`, `scan_runs.finished_at`, `timeframe`, `status`, `universe`, counters, and params.
- Complexity: Medium.
- Safety risk: Low to medium. The UI must show selected run time and distance from requested time.
- Recommended priority: Build with the historical snapshot viewer.

### Timepoint Validation

- User question: "After this historical scanner snapshot, what was later observed over selected windows?"
- Data required: selected snapshot signals plus forward `market_candles` for each symbol/timeframe.
- Complexity: Medium to high for 400+ symbols and multiple windows.
- Safety risk: High if named or displayed as signal accuracy or strategy performance.
- Recommended priority: Build after the snapshot viewer.

### Forward Observation Windows

- User question: "What happened after 1, 3, 5, or 10 completed candles?"
- Data required: anchor candle at or before `scan_signals.candle_open_time` or `scan_time`, then later candles in the same timeframe.
- Complexity: Medium.
- Safety risk: Medium. Keep as observation windows, not target windows.
- Recommended priority: Build after 12.2.

### Outcome Distribution

- User question: "How were later observations distributed across the selected group?"
- Data required: per-symbol forward returns, missing-data markers, and grouping metadata.
- Complexity: Medium.
- Safety risk: Medium. Use median and percentiles, not "worked/failed" labels.
- Recommended priority: Build later.

### Relative Performance Versus BTC and ETH

- User question: "How did this research set move relative to BTC and ETH over the same window?"
- Data required: BTCUSDT and ETHUSDT candles for the same timeframe and anchor/window, plus selected symbol candles.
- Complexity: Medium.
- Safety risk: Low to medium if shown as context.
- Recommended priority: Build later with distribution reports.

### Drawdown Context

- User question: "What downside movement occurred inside the observation window?"
- Data required: forward candle lows from anchor to selected window.
- Complexity: Medium.
- Safety risk: Low if framed as historical drawdown context.
- Recommended priority: Build later with outcome distribution.

### Market Backdrop at Selected Timepoint

- User question: "What was the BTC/ETH and broader market context when this snapshot happened?"
- Data required: BTC/ETH scan signals if available, market-context symbols, and candles around the selected timepoint.
- Complexity: Medium.
- Safety risk: Low if shown as context only.
- Recommended priority: Design more, then build later.

### Symbol-Level Historical Context

- User question: "For this symbol, what scanner history and candle context existed around the selected timepoint?"
- Data required: symbol history from `scan_signals`, candles from `market_candles`, selected run metadata, and possibly behavior rows.
- Complexity: Medium.
- Safety risk: Medium because it can resemble a recommendation if over-summarized.
- Recommended priority: Build later, after snapshot viewer.

### Research-Only Report

- User question: "Can I save or review a neutral report for this snapshot and observed windows?"
- Data required: selected snapshot, filters, observation windows, distributions, missing-data warnings, and disclaimers.
- Complexity: Medium.
- Safety risk: Low if copy is controlled.
- Recommended priority: Build later.

## 6. Feature Feasibility Matrix

| Feature | User value | Data required | Can use existing data? | Needs new API? | Needs schema change? | Complexity | Risk | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 12.1 Export current / filtered Screener result | High | Current joined Screener rows from `/api/scan/mtf-latest` and client filters | Yes | No for client-side CSV/text export | No | Low | Low | Build first |
| 12.2 Historical snapshot viewer | High | `scan_runs`, `scan_signals`, `symbols` | Yes for single-timeframe snapshots; partial for exact MTF joined state | Yes | No initially | Medium | Medium | Build later |
| 12.3 Timepoint outcome comparison | High | Selected snapshot signals and forward `market_candles` | Yes if candle coverage exists | Yes | No initially; maybe later for cached reports | Medium-high | High | Build later |
| 12.4 Distribution / relative performance / drawdown context | Medium-high | Per-symbol forward returns, BTC/ETH candles, drawdown windows | Mostly yes | Yes | No initially; maybe later for materialized summaries | High | Medium-high | Build later |
| Symbol-level historical context panel | Medium | `scan_signals`, `scan_runs`, `market_candles`, existing symbol research data | Yes | Maybe, if separate timepoint endpoint is needed | No initially | Medium | Medium | Build later |
| Market backdrop at historical timepoint | Medium | BTC/ETH candles, market-context scan signals, run metadata | Partial | Yes | No initially | Medium | Low-medium | Design more |
| Existing signal evaluation reuse | Medium | `scan_signals` and `market_candles` | Yes | Existing endpoint exists, but not in final product shape | No | Medium | High if wording is reused unchanged | Design more |
| Strategy order simulation | Low for this product | Orders, positions, fees, slippage, execution rules | No | Yes | Likely | High | High | Cancel / avoid |
| Signal leaderboard by forward return | Superficial | Completed forward observations | Yes | Yes | No | Medium | High | Cancel / avoid |
| Portfolio optimizer | Low for this phase | Portfolio holdings, constraints, returns matrix | No | Yes | Yes | High | High | Cancel / avoid |
| Full historical MTF reconstruction with exact live-client state | High but nuanced | Per-timeframe run pairing, filters, market context, missing symbols | Partial | Yes | Maybe later if run sets need explicit grouping | High | Medium | Design more |

## 7. Data Requirements and Gaps

### 12.1 Export current / filtered Screener result

- Existing data source: current `/api/scan/mtf-latest` response and client-built rows in `MultiTimeframeScreenerPageClient`.
- Missing data: none for exporting what is currently visible or filtered.
- Historical depth assumptions: not relevant.
- Candle coverage assumptions: not relevant.
- Scan run coverage assumptions: current latest selected runs are already loaded.
- Timeframe coverage assumptions: export should include missing timeframe markers already present in the joined row model.
- New-symbol/delisted-symbol issues: export should reflect current row availability only.
- Missing `1w` issue: can be represented as missing data in the exported row.
- Survivorship bias risk: low for current export.
- Performance risks: low; 400+ rows is a small client-side export.
- Are `scan_runs`, `scan_signals`, and `market_candles` enough? Yes, indirectly through the already-loaded API response.

### 12.2 Historical snapshot viewer

- Existing data source: `scan_runs`, `scan_signals`, `symbols`.
- Missing data: there is no API yet for historical run lookup by timepoint. There is no explicit MTF snapshot table tying several timeframe runs into one saved joined screener snapshot.
- Historical depth assumptions: depth depends on production scan schedule and retention policy. Postgres schema does not define retention, but operations may prune or backfill.
- Candle coverage assumptions: not required to display the snapshot, only to provide context.
- Scan run coverage assumptions: full-universe successful runs must exist around the selected timepoint.
- Timeframe coverage assumptions: single timeframe is straightforward; MTF requires selecting nearest runs per timeframe.
- New-symbol/delisted-symbol issues: symbols may not exist in an older run or may be disabled now. Historical display should use the signal row as the source of truth and current `symbols` only for supplemental metadata.
- Missing `1w` issue: weekly scans may have more missing symbols. Snapshot UI must show missing counts per timeframe.
- Survivorship bias risk: medium if the viewer only shows currently enabled symbols. It should start from `scan_signals` for the selected run, not from current enabled symbols.
- Performance risks: medium for all symbols across multiple timeframe runs.
- Are `scan_runs`, `scan_signals`, and `market_candles` enough? Enough for single-timeframe snapshots and partial MTF reconstruction; not enough to prove exact historical client-side MTF joined state if future requirements need a saved MTF run group.

### 12.3 Timepoint outcome comparison

- Existing data source: selected `scan_signals`, anchor candles from `market_candles`, and forward candles from `market_candles`.
- Missing data: no endpoint yet for a selected snapshot outcome report. No cached production table for computed reports.
- Historical depth assumptions: forward windows require candles after the snapshot, and older snapshots require enough retained candle history.
- Candle coverage assumptions: same symbol and timeframe must have anchor and forward candles. Weekly windows need long elapsed time.
- Scan run coverage assumptions: selected run must be successful and preferably full-universe for crypto.
- Timeframe coverage assumptions: compare within the signal timeframe. Cross-timeframe comparison should be separate and explicit.
- New-symbol/delisted-symbol issues: newly listed symbols may lack prior candles; delisted or disabled symbols may lack forward candles.
- Missing `1w` issue: high risk of incomplete weekly observations.
- Survivorship bias risk: medium. Include missing data count and denominator for every metric.
- Performance risks: high if querying 400+ symbols times multiple windows with lateral candle joins.
- Are `scan_runs`, `scan_signals`, and `market_candles` enough? Yes for compute-on-read if coverage is sufficient; caching or materialized summaries may be needed later for speed.

### 12.4 Distribution / relative performance / drawdown context

- Existing data source: selected signal set, forward candles, BTCUSDT/ETHUSDT candles, and grouping metadata.
- Missing data: no report endpoint; no persisted report cache; no explicit benchmark alignment API.
- Historical depth assumptions: relative windows need BTC/ETH coverage for the same timeframe and anchor periods.
- Candle coverage assumptions: every included symbol needs forward candles. Missing data should remain in the report, not be silently dropped.
- Scan run coverage assumptions: selected run(s) must be traceable and shown.
- Timeframe coverage assumptions: use completed candles from the same timeframe as the selected snapshot.
- New-symbol/delisted-symbol issues: include as missing or partial data, not as failed observations.
- Missing `1w` issue: likely; weekly relative reports should warn aggressively.
- Survivorship bias risk: high if excluded rows are hidden. Show missing, partial, and excluded counts.
- Performance risks: high for multiple windows and benchmarks.
- Are `scan_runs`, `scan_signals`, and `market_candles` enough? Enough for initial compute-on-read distribution, but future schema may be needed for cached report results.

## 8. API Design Proposal

These are future proposals only. Do not implement in Phase 12.0.

### `GET /api/screener/export`

- Purpose: Optional server-side export of current Screener rows. Prefer client-side first unless a server-side export becomes necessary.
- Inputs: `format=csv|json`, `assetClass`, optional current filters.
- High-level output shape: CSV or JSON rows with symbol, timeframe groups, rank fields, run ids, run timestamps, missing timeframe markers, and research-only disclaimer metadata.
- Query/performance concerns: If server-side, it should reuse current MTF latest query behavior and avoid row caps by default.
- Schema change: No.
- Safety/copy boundaries: Export as "research rows", not recommendations.

### `GET /api/history/snapshots`

- Purpose: List historical successful scan runs available for snapshot review.
- Inputs: `timeframe`, `assetClass`, `from`, `to`, `limit`, `includeNonScanner`.
- High-level output shape: run id, timeframe, status, symbols counters, params, started/finished times, full-universe metadata.
- Query/performance concerns: Use `scan_runs_timeframe_started_at_idx`; avoid expensive signal joins in list view.
- Schema change: No.
- Safety/copy boundaries: Label as "Historical snapshots", not performance.

### `GET /api/history/snapshot`

- Purpose: Get a historical snapshot by run id or nearest run to a timepoint.
- Inputs: `runId` or `timepoint`, `timeframe`, `assetClass`, `nearest=before|after|closest`.
- High-level output shape: selected run metadata, requested timepoint, time distance, full-universe metadata, signals/items, missing-data summary.
- Query/performance concerns: For run id, join `scan_signals` to `symbols`. For nearest run, query `scan_runs` first, then signals.
- Schema change: No.
- Safety/copy boundaries: Show "selected stored run" and time distance clearly.

### `GET /api/history/mtf-snapshot`

- Purpose: Reconstruct an MTF snapshot near a timepoint by selecting nearest successful runs for `1h`, `4h`, `1d`, and `1w`.
- Inputs: `timepoint`, `assetClass`, `nearest`, optional timeframe list.
- High-level output shape: selected runs by timeframe, signal counts, missing counts, joined rows by symbol.
- Query/performance concerns: Four run selections plus four signal queries. Avoid response limits by default, but watch payload size.
- Schema change: No initially. A future `scan_run_groups` or `mtf_snapshots` table may be needed if exact run bundles must be preserved.
- Safety/copy boundaries: State that MTF historical reconstruction uses nearest stored runs, not a live scan rerun.

### `GET /api/history/timepoint-observations`

- Purpose: Compute forward window observations for a selected snapshot.
- Inputs: `runId` or `timepoint`, `timeframe`, `windows=1,3,5,10`, `assetClass`, optional filters.
- High-level output shape: selected run, rows with symbol and window returns/drawdown/missing status, aggregate medians/percentiles, missing-data counts.
- Query/performance concerns: Heavy lateral candle joins. Start with one run and bounded windows. Consider server-side timeout and cache later.
- Schema change: No initially; later cache table may be helpful.
- Safety/copy boundaries: Use "forward observation window", "historical observation", and "missing data".

### `GET /api/history/relative-context`

- Purpose: Add BTC/ETH relative performance and market backdrop to a selected timepoint.
- Inputs: `runId` or `timepoint`, `timeframe`, `benchmarks=BTCUSDT,ETHUSDT`, `windows`.
- High-level output shape: benchmark candle coverage, benchmark returns, relative return medians, market backdrop context.
- Query/performance concerns: Benchmark anchors must align with selected observation windows.
- Schema change: No initially.
- Safety/copy boundaries: Context only. No conclusion labels.

### `GET /api/symbol/historical-context`

- Purpose: Show symbol-level context around a selected timepoint.
- Inputs: `exchange`, `market`, `symbol`, `timeframe`, `timepoint` or `runId`.
- High-level output shape: nearest signal history, selected run membership, candle coverage, small context chart payload, missing-data warnings.
- Query/performance concerns: Similar to `/api/symbol/research`, but selected by timepoint rather than latest run.
- Schema change: No initially.
- Safety/copy boundaries: Manual review only.

## 9. UI / UX Design Proposal

### Screener export flow

- Add an export control near the Screener table controls, not a new competing control layer.
- Offer "Export visible research rows" and "Export all joined rows" if both are needed.
- Preserve full-table default visibility.
- Include run ids, run timestamps, selected filters, missing timeframe markers, and the research-only disclaimer in the export metadata.

### Historical snapshot viewer flow

- Keep live Screener and Historical Research separate.
- Entry point can be a new History or Research Reports surface, not a replacement for `/screener`.
- Let the user choose timeframe and timepoint.
- Show selected stored run and distance from requested time.
- Show symbol count, scanned count, skipped count, missing count, and full-universe metadata before the table.
- Use the same neutral group and score vocabulary as current Screener.

### Timepoint validation flow

- Start from a selected historical snapshot.
- Let the user choose forward observation windows in completed candles.
- Show missing-data warnings before summary metrics.
- Show per-symbol rows and aggregate distribution.
- Do not show advice cards or "worked/failed" labels.

### Outcome distribution report

- Use histogram/table/stat cards for count, median, percentiles, min/max observed, missing count, and drawdown context.
- Include grouping by scanner group and timeframe availability.
- Include relative performance versus BTC/ETH as context, not ranking.

### Symbol-level historical context panel

- Link from a historical snapshot row to a symbol context view.
- Show the selected historical signal, nearby signal history, candle coverage, and forward observation rows.
- Do not overwrite current Symbol Research behavior; this is a historical mode.

### UX constraints

- Do not introduce pagination or row caps as default behavior.
- Do not add "Show more".
- Do not add top-100 behavior.
- If performance becomes an issue, use clear loading states, streaming/report generation, or optional user-selected filters. Do not silently hide rows.
- Major UI rebuild belongs to Phase 14, not Phase 12.

## 10. Safe Metrics and Unsafe Metrics

Safe metrics:

- Number of symbols included.
- Number of symbols missing data.
- Number of partial observations.
- Forward return median.
- Forward return percentiles.
- Relative return versus BTC.
- Relative return versus ETH.
- Max drawdown after timepoint.
- Volatility context.
- Market regime or backdrop at timepoint.
- Distribution by scanner group or research bucket.
- Timeframe availability.
- Candle coverage count and first/latest candle times.
- Selected run distance from requested timepoint.

Unsafe or misleading metrics as primary product labels:

- Signal accuracy.
- Win rate.
- Success rate.
- Prediction score.
- Buy/sell success.
- Guaranteed outcome.
- Best signal.
- Top opportunity.
- Strategy performance.
- Profit prediction.

Some unsafe metrics can be computed internally, such as positive-return percentages or direction-match rates. They should not be the primary UI frame because they invite users to treat scanner labels as trading predictions. If included later, they should be secondary research statistics with denominators, sample quality, and warnings.

## 11. Copy and Safety Rules

Use:

- "Research-only. Not financial advice."
- "Historical observation, not prediction."
- "Manual review required."
- "Forward window observation."
- "Outcome distribution."
- "Missing data warning."
- "Relative performance context."
- "Selected stored run."
- "Nearest stored snapshot."
- "Review group."
- "Research set."

Avoid:

- "This signal worked."
- "This signal failed."
- "Accuracy."
- "Win rate."
- "Buy."
- "Sell."
- "Entry."
- "Exit."
- "Prediction."
- "High probability."
- "Recommended."
- "Best picks."
- "Top opportunities."

## 12. Recommended Subphase Plan

### 12.1 Export Current / Filtered Screener Result

Expected first implementation target.

Why lowest risk:

- It uses rows already loaded by the current Screener.
- It does not require historical queries, new schema, migrations, or scoring changes.
- It supports the research workflow without implying future outcomes.

Likely data source:

- Client-built MTF rows from `buildMtfScreenerRowsFromResponse`.
- Current filter/search/sort state in `MultiTimeframeScreenerPageClient`.

Possible export format:

- CSV first.
- JSON optional later.
- Include export timestamp, source run ids per timeframe, filters, row count, and disclaimer.

UI entry point:

- A compact export button in the Screener table/source controls.
- Avoid another large control section.

Tests needed:

- Export row formatter tests.
- Filtered export includes only filtered/searched rows.
- Full export preserves all joined rows.
- Copy test confirms research-only disclaimer and no recommendation wording.

What not to change:

- No backend API required for first pass.
- No scanner logic changes.
- No pagination, row caps, or hidden limits.
- No localStorage.

### 12.2 Historical Snapshot Viewer

What it should show:

- List of available successful scan runs.
- Nearest stored run for a requested timepoint.
- Snapshot table of `scan_signals` for the selected run.
- Run metadata, full-universe status, symbol counters, missing-data warnings.

Required data:

- `scan_runs`, `scan_signals`, `symbols`.
- Optional candle coverage from `market_candles`.

Nearest-run selection:

- Support "before", "after", and "closest" only if the UI clearly states which was used.
- Default should likely be "closest completed run before or at timepoint" for research reproducibility.

Missing data handling:

- Show if no run exists in the requested range.
- Show if selected run is not likely full-universe.
- Show if symbols are missing in one or more MTF timeframes.

Performance risks:

- Full-universe MTF reconstruction may require several large signal queries.
- Payload size can be large but should remain manageable for 400 to 600 rows.

Tests needed:

- Nearest-run selection logic.
- Full-universe metadata.
- Snapshot query includes all symbols from the run.
- Missing-run and partial-run states.

### 12.3 Timepoint Outcome Comparison

What it should do:

- Start from a selected historical snapshot.
- Compute forward observations over selected completed-candle windows.
- Preserve the original snapshot row set and show missing data.

Forward observation windows:

- Use candle counts such as 1, 3, 5, and 10 completed candles.
- Avoid "target" language.

Relative BTC/ETH comparison:

- Compute benchmark returns using the same timeframe and observation window.
- Show relative performance context, not a recommendation.

Missing candles:

- If anchor or forward candles are missing, mark the row as missing or partial.
- Never drop missing rows silently.

No accuracy/win-rate framing:

- Use median, percentiles, observation count, missing count, and drawdown.

Tests needed:

- Anchor candle selection.
- Forward window completion.
- Missing data denominator handling.
- BTC/ETH relative calculation.
- Copy safety checks.

### 12.4 Distribution / Relative Performance / Drawdown Context

What it should add:

- Distribution report for selected snapshot or filtered research set.
- Percentile view of forward observations.
- Drawdown context over the same windows.
- Market backdrop at selected timepoint.

Why after 12.2/12.3:

- Distribution reports are only trustworthy once snapshot selection and per-row observations are correct.
- More complex summaries amplify missing-data and survivorship-bias risks.

Tests needed:

- Percentile calculations.
- Drawdown calculations.
- Relative benchmark alignment.
- Missing-data rollups.
- Group distribution summaries.

## 13. Risks and Open Questions

- Is existing production scan history complete enough for meaningful historical snapshots, or are early runs too sparse/manual?
- Is there a retention policy for Postgres `scan_runs`, `scan_signals`, and `market_candles`?
- Can historical MTF joined state be reconstructed accurately enough by nearest per-timeframe run selection, or is a future run-group table needed?
- Do current `scan_signals` preserve enough fields for all historical report needs, especially UI-friendly factor explanations and run context?
- Is `market_candles` coverage deep enough for the requested windows across 400+ symbols?
- How should the product handle symbols that were newly listed after the selected timepoint?
- How should the product handle delisted or disabled symbols that remain in historical `scan_signals`?
- How should missing `1w` candles be presented without overwhelming the report?
- What timeout and payload size are acceptable for 400+ symbols across multiple windows?
- Should export be CSV only first, or CSV plus JSON?
- Is a future schema change needed for report caching, run grouping, or persisted exports?
- Should existing `signalEvaluationPg` be reused directly, wrapped with safer API/copy, or avoided until rewritten as timepoint observation logic?
- How should the UI differentiate current Symbol Research from historical symbol context?

## 14. Final Recommendation

Build first:

- 12.1 Export current and filtered Screener results.
- Keep it client-side first.
- Include run metadata, filter state, missing timeframe markers, and research-only copy.

Build later:

- 12.2 Historical Snapshot Viewer using `scan_runs` and `scan_signals`.
- 12.3 Timepoint Outcome Comparison using selected snapshot signals and `market_candles`.
- 12.4 Distribution, relative performance, drawdown, and market backdrop reports after 12.2 and 12.3 are correct.

Postpone:

- Historical MTF exact-state reconstruction until nearest-run semantics are designed and tested.
- Market backdrop at historical timepoint until BTC/ETH run/candle coverage rules are explicit.
- Symbol-level historical context until the snapshot viewer exists.

Cancel or avoid:

- Strategy order simulation.
- Entry/exit simulation.
- Position sizing.
- Portfolio optimization.
- Signal leaderboard by forward return.
- Any "accuracy", "win rate", "high probability", "best pick", or "top opportunity" product framing.

Existing data sufficiency:

- 12.1: sufficient now.
- 12.2: sufficient for single-timeframe snapshots; partial for MTF joined reconstruction.
- 12.3: sufficient if forward candle coverage exists; no schema change required for initial compute-on-read.
- 12.4: mostly sufficient for initial reports, but performance may require future caching or materialized summaries.

Future schema/API needs:

- New APIs are likely needed for historical run listing, snapshot lookup, MTF nearest snapshot reconstruction, timepoint observations, relative context, and symbol historical context.
- No migrations should be created for Phase 12.0.
- Future migrations may be useful for cached reports or explicit MTF run grouping if compute-on-read is too slow or nearest-run reconstruction is too ambiguous.

Phase 12 should stay a research-only design and implementation track. The first shipped feature should be Screener export because it is useful, low risk, and does not alter runtime scanner behavior or product boundaries.
