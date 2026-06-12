# VegaRank Research State Model

## 1. Purpose

This document defines the shared VegaRank research state model used across Rankings, Screener, Symbol Research, Watchlist, and Archive.

The goal is consistent naming, display formatting, source labeling, and interpretation boundaries. This phase aligns visible UI copy and helpers without changing scoring formulas, API routes, API response shape, database schema, storage schema, code values, codebook semantics, or export schemas.

## 2. Product boundary

VegaRank is a professional crypto technical research-ranking system. It shows technical research states, rankings, evidence quality, risk context, multi-timeframe context, and validation context.

It does not provide trading instructions, predict outcomes, measure personal trading performance, or provide investment advice.

Persistent disclaimer:

Research-only. Not trading advice.

## Research State Glossary

| Term | Definition | Used in | Not used for |
| --- | --- | --- | --- |
| Current Snapshot | The latest available VegaRank research snapshot for a symbol, timeframe, and asset class. | Rankings, Symbol Research | Archived rows captured at an older run time. |
| Latest Snapshot | A current snapshot shown from the latest available run or joined latest runs. | Rankings, Watchlist, Screener | Stored run rows or saved watchlist state. |
| Archived Snapshot | Stored research state captured when a run completed. | Archive, Symbol Research Archive Context | Current Symbol Research primary state. |
| Selected Run | The archive run currently selected by the user or URL context. | Archive | Current/latest rankings source state. |
| Stored Run | A completed run stored for archive review. | Archive Stored Runs selector, Archive details | Current Ranking Result labels. |
| Snapshot Row | A row inside a selected or archived snapshot. | Archive tables | Current multi-timeframe joined rows unless explicitly stored. |
| Validation State | The state of future-window data availability for archived rows. | Archive, Symbol Research diagnostics | Current ranking quality or risk state. |
| Validation Readiness | Whether a stored run has enough future-window and source data for validation review. | Archive | Current snapshot freshness. |
| Outcome Window | The selected completed-candle window used for archive validation. | Archive | Current ranking timeframe. |
| Future Window | Future candles after an archived snapshot row. | Archive details and docs | Current data recency. |
| Follow-through | Neutral description of observed future-window movement. | Archive outcome summaries, validation diagnostics | Prediction, certainty, or performance claims. |
| Drawdown Context | Neutral description of downside movement inside the future window. | Archive, validation diagnostics | Personal trading loss or execution language. |
| Evidence Quality | Data and codebook evidence quality attached to a snapshot. | Rankings, Symbol Research | Prediction certainty. |
| Evidence Reliability | Confidence as reliability of technical evidence and data completeness. | Scoring docs, Symbol Research, helpers | Outcome probability. |
| Risk Context | Research risk constraints that affect interpretation. | All pages | A hidden score-only adjustment. |
| Multi-Timeframe Context | Joined current snapshots across 1H, 4H, 1D, and 1W. | Screener, Watchlist, Symbol Research | Outcome certainty. |
| Local Watchlist | Browser-local selected symbols. | Watchlist, Symbol Research control | Portfolio, alert list, or stored historical state. |
| Missing Data | Data that is unavailable, incomplete, or not present in the latest snapshot. | All pages | A negative outcome. |
| Pending Validation | Validation data is not mature enough yet. | Archive | Current snapshot loading state. |
| N/A | Display value for null, unavailable, or non-finite metrics. | All pages | Raw API values or hidden internal fields. |

## 3. State taxonomy

The product has seven shared state families:

- Current Research State
- Archived Research State
- Watchlist State
- Validation State
- Multi-Timeframe State
- Missing / Pending / N/A State
- Risk and Evidence State

These state families describe source and readiness. They do not change score values or codebook meanings.

## 4. Current Research State

Current Research State is the latest available VegaRank research snapshot for a symbol, timeframe, and asset class.

Primary pages:

- Rankings
- Screener
- Watchlist
- Symbol Research

Preferred labels:

- Latest Rankings
- Current Snapshot
- Latest Snapshot
- Research Snapshot
- Ranking Result

Current snapshot time should be labeled as Updated or Latest Snapshot time. It should not be labeled as a stored run time unless the UI is explicitly inside Archive Context.

## 5. Archived Research State

Archived Research State is the stored codes and metrics captured when a run completed.

Primary pages:

- Archive
- Symbol Research Archive Context

Preferred labels:

- Research Archive
- Stored Run
- Selected Run
- Archived Snapshot
- Snapshot Rows

Archived state should not be presented as current. Archive row links can open current Symbol Research, but the archive `runId` and `snapshotId` remain Archive Context.

## 6. Watchlist State

Watchlist State is a locally selected symbol stored in the current browser and displayed against the latest available research snapshot.

Preferred labels:

- Local Watchlist
- Selected Symbols
- Saved in this browser
- Latest Snapshot
- Current Research State
- Monitored in this browser

The watchlist stores symbols only. It does not store the full ranking state, saved score, saved group, saved risk, notes, tags, review status, alerts, cloud sync, or portfolio state.

## 7. Validation State

Validation State describes availability and maturity of future-window outcome data for archived snapshot rows.

Preferred labels:

- Validation State
- Validation Readiness
- Outcome Window
- Future Window
- Follow-through
- Drawdown Context
- Pending Validation

Validation state describes data readiness and follow-through context. It does not describe trading success, prediction accuracy, or user performance.

## 8. Multi-Timeframe State

Multi-Timeframe State is a joined view of current research states across 1H, 4H, 1D, and 1W.

Preferred labels:

- Multi-Timeframe Context
- Timeframe Alignment
- Joined Snapshot
- Agreement
- Conflict
- Mixed Context

Timeframe agreement is context, not an instruction or certainty signal. If timeframes disagree, use neutral language such as Mixed context, Conflicting timeframe states, or Risk context differs across timeframes.

## 9. Missing / Pending / N/A State

Display rules:

- Null metric: `N/A`
- Missing score: `N/A`
- Missing code array: omit optional subsection, or show `No additional context` only where it clarifies the section.
- Missing latest snapshot: `No latest research snapshot available.`
- Missing archive snapshot: `No archive snapshot available yet.`
- Validation not mature: `Validation pending`
- Incomplete future window: `Partial window`
- No future window: `Missing window`
- Source data unavailable: `Source data unavailable`
- Unknown status: `Unknown`

Do not render raw `null`, `undefined`, or `NaN` in visible UI.

## 10. Risk State

Risk State is research risk context that constrains interpretation.

Risk Context should remain visible when risk codes exist. A high Rank Score must not visually suppress Risk Context. Risk can appear beside Rank Score, but it must not be collapsed into score alone.

## 11. Evidence State

Evidence State describes evidence quality and reliability.

Confidence means evidence reliability, not outcome probability. Evidence Quality and Confidence should not be phrased as certainty.

## 12. Score and metric formatting

Visible score labels:

| Data field | Visible label |
| --- | --- |
| `rankScore` | Rank Score |
| `riskAdjustedScore` | Risk-Adjusted Score |
| `setupQualityScore` | Setup Quality |
| `confidenceScore` | Confidence |
| `trendScore` | Trend |
| `momentumScore` | Momentum |
| `structureScore` | Structure |
| `volatilityScore` | Volatility |
| `volumeScore` | Liquidity |
| `universePercentile` | Universe Percentile |
| `riskPenalty` | Risk Penalty |
| `qualityPenalty` | Quality Penalty |

Compatibility fields may still exist in data:

- `finalSignalScore` may back Risk-Adjusted Score.
- `opportunityScore` may back Setup Quality.
- `confirmationScore` may back Confidence.
- `riskScore` may back Risk Penalty or Risk Context.

Rules:

- Do not expose camelCase metric names in visible UI.
- Use consistent decimal formatting.
- Use tabular numerics where practical.
- Null metrics render as `N/A`.
- Confidence means evidence reliability.
- High Rank Score does not hide Risk Context.

## 13. Cross-page terminology table

| Concept | Rankings | Screener | Symbol Research | Watchlist | Archive |
| --- | --- | --- | --- | --- | --- |
| Current state | Latest Rankings, Current Snapshot | Joined Snapshot | Research Snapshot, Current Snapshot | Latest Snapshot | Only when explicitly comparing current state |
| Archived state | Avoid primary use | Avoid primary use | Archive Context | Avoid | Archived Snapshot, Stored Run |
| Watchlist state | Add to Watchlist | Optional source context | Local Watchlist control | Local Watchlist, Selected Symbols | Avoid |
| Validation state | Avoid primary use | Avoid primary use | Validation State diagnostics | Avoid | Validation Readiness, Outcome Window |
| Missing data | `N/A`, no latest research snapshot | Missing Snapshot, `N/A` | No latest research snapshot available | No latest research snapshot available | Missing window, Source data unavailable |
| Risk state | Risk Context | Risk Context differs across timeframes | Risk Context | Risk Context | Risk Context at archived time |
| Evidence state | Evidence Quality | Timeframe evidence context | Evidence Overview | Latest snapshot evidence | Archived evidence fields |

## 14. Page-specific state responsibilities

Rankings shows current research state for the latest selected timeframe.

Primary terms:

- Latest Rankings
- Current Snapshot
- Ranking Result
- Research Group
- Risk Context
- Evidence Quality
- Rank Score

Avoid archived state language and validation outcome language as primary content.

Screener shows multi-timeframe state by joining current snapshots.

Primary terms:

- Multi-Timeframe Context
- Timeframe Alignment
- Joined Snapshot
- Agreement
- Conflict

Avoid implying stronger timeframe agreement is an instruction or certainty signal.

Symbol Research shows current research state for one symbol, plus supporting Archive Context when available.

Primary terms:

- Research Snapshot
- Current Snapshot
- Evidence Overview
- Risk Context
- Multi-Timeframe Context
- Archive Context

If current and archive context both appear, label them separately.

Watchlist shows locally selected symbols against current latest state.

Primary terms:

- Local Watchlist
- Selected Symbols
- Saved in this browser
- Latest Snapshot
- Current Research State
- Monitored in this browser

Avoid portfolio, execution, alert, saved-score, or historical-state implications.

Archive shows archived research state and validation state.

Primary terms:

- Research Archive
- Stored Run
- Selected Run
- Archived Snapshot
- Snapshot Rows
- Validation State
- Validation Readiness
- Outcome Window

Avoid current state wording unless explicitly comparing current versus archived state.

## 15. Relationship to codebook

The codebook provides stable code values, labels, and explanation text. This model controls shell copy, state source labels, missing-data display, and metric-label presentation.

Do not change codebook dictionary semantics in this phase. If codebook output is used in the wrong source context, adjust the surrounding UI label rather than changing the codebook value.

## 16. What this phase does not change

This phase does not:

- change quant scoring formulas
- change scoring behavior
- change code values
- change codebook dictionary semantics
- change API routes
- change API response shape
- change database schema
- change storage filters
- change production scripts
- rename routes
- add backend endpoints
- add authentication
- add cloud watchlists
- add notes, tags, priority, or review status
- add alerts
- redesign pages
- change CSV/export schema

## 17. Follow-up phases

Useful follow-ups:

- A Watchlist Monitor phase for saved research queues, notes, tags, review status, or alerts.
- A Current-vs-Archived comparison phase if the product needs explicit current-to-archive deltas.
- Deeper validation charts and grouping once Archive state language has stabilized.
- Broader visual QA after the state labels settle across real production data.

## Score provenance rules

- Rank Score in Rankings is the current latest snapshot score.
- Rank Score in Screener is a joined current-snapshot context value.
- Rank Score in Watchlist is the latest snapshot score for a locally selected symbol.
- Rank Score in Archive is the archived score captured at selected run time.
- Rank Score in Symbol Research is the current snapshot unless it appears under Archive Context.

Do not recompute scores for provenance labels. Clarify where the displayed score came from.

## Freshness and time rules

- Current Snapshot uses Updated or Latest Snapshot time.
- Archived Snapshot uses Completed or Stored Run time.
- Validation data uses readiness and outcome-window context, not current updated time.
- Watchlist displays latest snapshot state, not saved-time state.

Use existing date formatting helpers.

## Query context rules

- `from=archive` means the user navigated from Archive. It does not mean the current Symbol Research snapshot is archived.
- `runId` and `snapshotId` shown in Symbol Research belong under Archive Context.
- `timeframe` applies to current research context unless shown under archive parameters.

Do not over-display query params. Show them only when they clarify state source.

## API field name boundary

Visible UI may display:

- Rank Score
- Selected Run
- Snapshot Rows
- Archived Snapshot

Code and data may still contain:

- `scanRun`
- `signalsCreated`
- `symbolsScanned`
- `scannerVersion`
- `raw_metrics`
- `codeContract`

These are data-contract or storage terms. Do not rename them without a separate API contract migration.

## Cross-page QA matrix

| Page | Current state label | Archived state label | Watchlist state label | Validation state label | Missing/N/A behavior | Score source clarity | Risk/evidence separation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Rankings | Latest Rankings, Current Snapshot | Avoid | Add to Watchlist only | Avoid | `N/A`, no latest research snapshot | Rank Score from latest snapshot | Risk Context and Evidence Quality visible |
| Screener | Joined Snapshot, Multi-Timeframe Context | Avoid | Source only when navigating | Avoid | Missing Snapshot, `N/A` | Joined current snapshots | Risk Context per timeframe |
| Symbol Research | Research Snapshot, Current Snapshot | Archive Context | Local Watchlist control | Validation State diagnostics | No latest research snapshot available, `N/A` | Current unless under Archive Context | Risk Context separate from Evidence Overview |
| Watchlist | Latest Snapshot, Current Research State | Avoid | Local Watchlist, Selected Symbols | Avoid | No latest research snapshot available, `N/A` | Latest snapshot for local symbol | Risk Context remains visible |
| Archive | Avoid unless comparing | Selected Run, Archived Snapshot, Snapshot Rows | Avoid | Validation Readiness, Outcome Window | Validation pending, Partial window, Missing window, `N/A` | Archived score captured at selected run time | Archived risk and validation context remain separate |
