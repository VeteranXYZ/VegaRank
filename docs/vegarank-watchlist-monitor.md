# VegaRank Watchlist Monitor

## 1. Purpose

The VegaRank Watchlist is a lightweight Local Watchlist monitor for selected symbols. It helps users see which symbols are saved locally, what latest research snapshot is available for each symbol, which rows deserve higher-priority research attention, which rows carry risk context, and which rows are missing latest snapshot data.

## 2. Watchlist role in research workflow

The research workflow is:

Discover -> Compare -> Research -> Monitor -> Validate

Watchlist owns the Monitor step. Rankings discovers current research candidates, Screener compares multi-timeframe context, Symbol Research reviews one symbol deeply, Watchlist monitors locally selected symbols against latest snapshots, and Archive validates archived snapshots.

## 3. Local browser boundary

Watchlist symbols are saved locally in the current browser. The page does not add account storage, authentication, cloud persistence, or cross-device synchronization.

The persistent user-facing boundary is:

Saved locally in this browser.

## 4. Latest Snapshot behavior

Each saved symbol is matched against the latest available multi-timeframe research data already returned by the existing latest rankings API. The Watchlist does not request new backend fields and does not recompute scoring.

When a selected symbol has one or more current snapshots, the table shows the selected latest snapshot state, research group, action label, risk context, rank score, confidence, and updated time.

## 5. Summary metrics

The compact summary strip uses existing local rows and latest snapshot data:

- Selected Symbols: total locally saved symbols.
- High Priority: selected rows with current short-term eligible/watch research state.
- Risk Context: selected rows with visible risk context.
- Missing Snapshot: selected rows without latest research snapshot data.
- Latest Snapshot: newest update time visible in the matched rows, or N/A.

## 6. Missing Snapshot behavior

Missing rows stay visible. They are not hidden silently.

For a saved symbol without latest snapshot data:

- Latest Snapshot shows Missing Snapshot.
- Research Group, Action, Rank Score, Confidence, and Updated show N/A.
- Risk Context says No latest research snapshot available.
- Open Research remains available using the symbol identity and the default Symbol Research timeframe.
- Remove remains available.

## 7. Controls and filters

Watchlist controls are compact and table-focused:

- Search Symbol
- Research Group
- Risk Context
- Sort By
- Clear Filters
- Refresh Watchlist

Selected symbol editing, presets, import, and export remain secondary controls under the Selected Symbols details section.

## 8. Table model

The main table is the primary content. It is organized around one row per selected symbol:

- Symbol
- Latest Snapshot
- Research Group
- Action
- Risk Context
- Rank Score
- Confidence
- Updated
- Open Research
- Remove

Values use existing formatter and codebook helpers. Null or non-finite numeric values render as N/A.

## 9. Relationship to Symbol Research

Symbol Research remains the place to add or remove the current symbol from the Local Watchlist. The control continues to show Add to Watchlist, In Watchlist, Remove from Watchlist, and Open Watchlist.

Watchlist Open Research links include `from=watchlist` and preserve available navigation context.

## 10. What this phase does not change

This phase does not change quant scoring formulas, code values, codebook semantics, API routes, API response shape, database schema, storage schema, storage filters, CSV/export schema, or the global site design.

It does not add notes, tags, review status, custom priority, saved-at score comparison, notifications, authentication, account storage, or asset ownership concepts.

## 11. Future follow-ups

Possible future work, outside this phase:

- optional cloud sync
- annotations
- custom tags
- review status
- alerting
- saved-at snapshot comparison
