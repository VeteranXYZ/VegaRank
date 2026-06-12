# VegaRank Research Workflow

## 1. Purpose

This contract defines the first layer of VegaRank's research workflow system. It connects the public research pages into a clear loop:

Discover -> Compare -> Research -> Monitor -> Validate

The goal is navigational clarity and URL-based context preservation. This phase does not change scoring, data fetching semantics, API response shape, storage schema, or product positioning.

State names, source labels, missing-data rules, and cross-page terminology are defined in `docs/vegarank-research-state-model.md`.

## 2. Product boundary

VegaRank is a professional crypto technical research-ranking system. It supports research workflow, review, and validation. It does not issue trading instructions and is not investment advice.

Persistent disclaimer:

Research-only. Not trading advice.

## 3. Research loop

Discover starts in Market Rankings, where users find current market research candidates.

Compare continues in Multi-Timeframe Screener, where users review joined multi-timeframe context.

Research happens on Symbol Research, where one symbol's current structure, risk, evidence, and multi-timeframe state are reviewed.

Monitor happens in Watchlist, where selected symbols are tracked against the latest research snapshot.

Validate happens in Research Archive, where stored runs, snapshots, maturity, and outcomes are reviewed.

## 4. Page responsibilities

`/rankings`: Discover current market research candidates from latest ranked results.

`/screener`: Compare multi-timeframe snapshots and filter for context alignment, risk, or watch states.

`/symbol/[exchange]/[symbol]`: Research one symbol's latest selected snapshot, evidence, risk context, chart context, timeframe availability, and history.

`/watchlist`: Monitor locally selected symbols against the latest joined research snapshot.

`/archive`: Validate prior runs, source snapshot rows, observation readiness, and stored validation rows.

## 5. Primary / secondary / diagnostic actions

Discover:
Primary action: Open Research.
Secondary actions: Add to Watchlist, Compare Timeframes.
Diagnostic actions: Review ranking source metadata and evidence quality.

Compare:
Primary action: Open Research.
Secondary actions: Add to Watchlist where available, return to Rankings.
Diagnostic actions: Review missing timeframe rows, risk notes, and joined snapshot freshness.

Research:
Primary action: Add to Watchlist or Remove from Watchlist.
Secondary actions: Back to source, Review Archive, Compare Timeframes.
Diagnostic actions: Review data source, timeframe availability, validation, behavior, and timeline panels.

Monitor:
Primary action: Open Research.
Secondary actions: Remove from Watchlist, Open Archive.
Diagnostic actions: Review missing symbols and multi-timeframe risk context.

Validate:
Primary action: View Snapshot.
Secondary actions: Open Symbol Research, compare current ranking.
Diagnostic actions: Review readiness, maturity, missing data, and source versions.

## 6. URL context model

URL parameters are preferred over global state because they are shareable, browser-native, resilient to refresh, and keep navigation state close to the route that needs it. This phase uses small readable params instead of introducing a state store.

Supported workflow params:

- `from`: source page for Symbol Research return links. Valid values are `rankings`, `screener`, `watchlist`, and `archive`.
- `timeframe`: selected research timeframe when useful.
- `assetClass`: selected asset class when useful.
- `group`: page-specific group filter context when useful.
- `risk`: page-specific risk filter context when useful.
- `sort`: page-specific sort context, encoded as `field:direction`.
- `q`: symbol search query.
- `runId`: archive run context.
- `snapshotId`: archive row or snapshot context.
- `symbol`: symbol context for archive/watchlist URLs when useful.

Existing rankings params `includeLowQuality` and `limit` remain supported for compatibility with the current rankings page.

Intentionally not preserved in this phase:

- transient loading state
- hover, expanded row, or scroll position
- chart viewport state
- clipboard/import editor contents
- unsaved watchlist editor draft state
- hidden diagnostic panel open/closed state

## 7. Navigation contract

All Open Research links should point to:

`/symbol/[exchange]/[symbol]`

Symbol links should be built with the shared research navigation helper. Components should not manually concatenate complex query strings.

Open Research links should include `from` when the source page is known and preserve practical context:

- Rankings: `timeframe`, `assetClass`, `includeLowQuality`, `limit`, `sort`
- Screener: `assetClass`, `timeframe` when present, `group`, `risk`, `sort`, `q`
- Watchlist: `assetClass`, `risk`, `sort`, `q`
- Archive: `timeframe`, `assetClass`, `runId`, `snapshotId`

Empty params are omitted. Unknown source values are ignored.

## 8. Source-aware return behavior

Symbol Research reads `from` and builds a subtle source-aware return action:

- `from=rankings` returns to `/rankings`
- `from=screener` returns to `/screener`
- `from=watchlist` returns to `/watchlist`
- `from=archive` returns to `/archive`

Preserved params are passed back to the source route where useful. If `from` is missing or invalid, Symbol Research keeps the existing neutral fallback to Market Rankings.

## 9. Watchlist relationship

Watchlist storage remains local browser storage. This phase does not add authentication, accounts, alerts, or cloud watchlist persistence.

Rankings and Screener remain discovery surfaces. Symbol Research remains the primary place to add or remove the current symbol from the watchlist. Watchlist rows use `from=watchlist` when opening Symbol Research.

## 10. Archive relationship

Symbol Research includes a Review Archive action that preserves symbol, timeframe, and asset class when useful.

Archive snapshot and observation rows use `from=archive` when opening current Symbol Research. Archive links preserve run and snapshot row context where available. This phase does not change archive data fetching logic and does not turn Symbol Research into historical replay.

## 11. What this phase intentionally does not do

This phase does not:

- change quant scoring formulas
- change scoring behavior
- change code registry values
- change codebook dictionary semantics
- change API routes
- change API response shape
- change database schema
- change storage filters
- change PM2, cron, or deployment runtime names
- change CSV/export schema
- redesign pages
- add authentication
- add alerts
- add cloud watchlist storage
- add AI assistant behavior
- add trading advice language

## 12. Future workflow phases

Future phases can deepen the workflow without changing this contract:

- deeper symbol evidence panels
- archive validation UX
- watchlist research queue
- screener multi-timeframe intelligence
- richer archive-to-current comparison affordances
- saved research views if authentication is introduced later
