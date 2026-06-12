# VegaRank UI Copy System

## 1. Purpose

VegaRank UI shell copy should read as a professional crypto technical research-ranking product. The interface must describe rankings, research snapshots, validation context, and manual review without implying trading advice, execution, or prediction.

Persistent disclaimer: `Research-only. Not trading advice.`

This document governs visible UI shell copy only. It does not rename API fields, database columns, storage keys, codebook values, scoring formulas, PM2 processes, cron jobs, or deployment runtime names.

For the canonical research state glossary, score provenance rules, and page-specific source labels, see `docs/vegarank-research-state-model.md`.

## 2. Page roles

- Market Rankings: latest ranked research results across the current market universe.
- Multi-Timeframe Screener: joined multi-timeframe research snapshots across supported timeframes.
- Watchlist: selected symbols monitored against the latest research snapshot.
- Research Archive: stored runs, archive snapshots, maturity, and validation context.
- Symbol Research: single-symbol research snapshot with current context, multi-timeframe context, timeline, validation, behavior, and related runs.

## 3. Button standards

- Use verb plus object where space allows: `Refresh Rankings`, `Refresh Screener`, `Refresh Watchlist`, `Refresh Archive`, `Refresh Research`.
- Use `Open Research` for symbol research navigation.
- Use `View Details` and `Close` for local detail panels.
- Use `Clear Filters`, `Reset View`, `Add to Watchlist`, and `Remove from Watchlist`.
- Avoid vague labels such as `Open`, `Check`, or `Details` when a specific action is available.

## 4. Filter standards

Preferred labels include:

- `Timeframe`
- `Asset Class`
- `Research Group`
- `Research Priority`
- `Setup`
- `Risk Context`
- `Evidence Quality`
- `Rank Score`
- `Confidence`
- `Liquidity`
- `Search Symbol`
- `Exchange`
- `Market`
- `Sort By`
- `Show Low Quality`
- `Show High Priority`

Filters may continue to display codebook meanings through `explainCode` and `explainCodes`. Do not hard-code codebook explanations in component shell copy.

## 5. Table column standards

Common visible columns:

- `Rank`
- `Symbol`
- `Timeframe`
- `Research Group`
- `Research Priority`
- `Setup`
- `Risk Context`
- `Evidence Quality`
- `Rank Score`
- `Risk-Adjusted Score`
- `Setup Quality`
- `Confidence`
- `Trend`
- `Momentum`
- `Structure`
- `Volatility`
- `Liquidity`
- `Updated`
- `Snapshot`
- `Run`
- `Open Research`

Do not expose camelCase metric names. Do not rename API response fields or sort/filter keys.

## 6. Status/loading/empty/error states

Preferred loading states:

- `Loading rankings...`
- `Loading research snapshot...`
- `Loading archive runs...`
- `Loading symbol research...`
- `Loading watchlist...`

Preferred empty states:

- `No latest research snapshot available.`
- `No symbols match the current filters.`
- `No watchlist symbols yet.`
- `No archived runs available.`
- `No validation outcomes available yet.`
- `No research snapshot is available for this symbol.`

Preferred error states:

- `Unable to load rankings.`
- `Unable to load research snapshot.`
- `Unable to load archive data.`
- `Unable to load symbol research.`
- `Unable to load watchlist.`
- `Try refreshing the page or adjusting filters.`

## 7. Archive wording

Use:

- `Research Archive`
- `Stored Runs`
- `Selected Run`
- `Archive Snapshot`
- `Snapshot Rows`
- `Outcome Summary`
- `Validation Readiness`
- `Source Data`
- `Maturity Logic`
- `Setup Evolution`
- `Completed Candles`
- `Future Window`

Avoid visible copy such as `History`, `Selected Scan`, `Scan Rows`, `Scan History`, `Historical trades`, `Trading outcome`, and `Profit outcome`.

## 8. Rankings wording

Use:

- `Market Rankings`
- `Latest Rankings`
- `Ranked Universe`
- `Ranking Summary`
- `Ranking Results`
- `Selected Result`
- `Result Details`
- `Research Group`
- `Research Priority`
- `Risk Context`
- `Evidence Quality`
- `Filtered Results`

Avoid visible copy such as `Scanner`, `Scanner Output`, `Latest Scan`, `Scan Result`, `Filtered Signals`, and `Raw Scanner Signal`.

## 9. Symbol Research wording

Use:

- `Research Snapshot`
- `Current Context`
- `Multi-Timeframe Context`
- `Timeline`
- `Validation`
- `Behavior`
- `Risk Context`
- `Evidence Quality`
- `Related Runs`

Avoid trading-advice language and prediction framing.

## 10. Forbidden terms

Do not introduce these terms in visible UI shell copy:

- `buy`
- `sell`
- `long`
- `short`
- `entry`
- `exit`
- `take profit`
- `stop loss`
- `profit target`
- `guaranteed`
- `alpha call`
- `moon`
- `pump`
- `trade signal`
- `trading signal`
- `strong buy`
- `must buy`
- `perfect setup`

Technical runtime names, API paths, DB fields, storage keys, and historical documentation may still contain legacy terms when renaming them would change behavior or contract semantics.

## 11. CSV/export decision

This phase updates low-risk export labels and generated filenames where the UI controls the copy:

- rankings export label: `Export Rankings`
- screener export label: `Export Screener`
- watchlist import/export label: `Import / Export Watchlist`
- generated filenames: `vegarank-rankings-YYYY-MM-DD.csv`, `vegarank-screener-YYYY-MM-DD.csv`

CSV column headers are updated only where tests and consumers are clearly internal. Remaining contract-like CSV field names should be handled as a Phase 24 compatibility review.

## 12. Relationship to English/Chinese codebooks

The UI shell copy system sits above the Phase 20 professional English codebook and Phase 21 Chinese terminology system.

- Components may format code meanings through codebook helpers.
- This phase must not rewrite codebook dictionary semantics.
- Direct Chinese shell mappings may be updated only when the mapping is already supported and local.
- A full Chinese shell pass remains a separate follow-up.

## 13. Follow-up items

- Audit CSV columns and any downstream consumers before broader export header changes.
- Complete a direct Chinese shell copy pass for labels touched in this phase.
- Review legacy components that are not part of the current cutover routes before deleting or rewriting them.
- Continue classifying remaining legacy terms as internal implementation, API contract, DB/runtime naming, test coverage, historical documentation, or visible copy.
