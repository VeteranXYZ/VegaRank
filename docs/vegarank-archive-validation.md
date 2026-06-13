# VegaRank Archive Validation

## Purpose

Archive is the validation and review center for stored VegaRank research snapshots. It helps users understand which stored run is selected, whether that run has enough completed future-window data, and which snapshot rows can be opened in Symbol Research.

Archive source labels, validation readiness terms, outcome-window language, and missing-data rules are governed by `docs/vegarank-research-state-model.md`.

## Archive role in research workflow

Archive supports the Validate step in the workflow:

Discover -> Compare -> Research -> Monitor -> Validate

It is a research review surface. It does not measure execution results, provide investment advice, or imply directional outcomes.

## Selected Run Summary

Selected Run Summary appears near the top of Archive and shows:

- shortened selected run id
- timeframe
- full or limited universe
- snapshot row count
- completed time
- asset class

The summary avoids raw technical params as primary content. Raw metadata remains in Validation Details when available.

## Validation Readiness

Validation Readiness separates maturity and source-data constraints from outcome values. Supported visible states are:

- Ready for Review
- Partially Ready
- Validation Pending
- Data Missing

The panel explains whether a run is ready for outcome review, has partial future-window data, is still waiting for enough completed future candles, or is missing source data.

## Outcome Summary

Outcome Summary uses research-review language:

- Complete Windows
- Partial Windows
- Missing Windows
- Median Follow-through
- Positive Follow-through
- Drawdown Context

It must not be described with performance-result or prediction-style language.

## Stored Code-Contract Metadata

Archive Snapshot Rows display stored code-contract metadata from the selected archived run. The frontend reads the selected run's stored metadata and does not recompute current ranking state.

Validation Details summaries use the same stored metadata. Group Distribution and Notable Symbols read normalized archive metadata from the selected run, so code-contract rows are grouped by their stored Research Group instead of legacy-only fallback fields.

Stored metadata includes:

- Research Group from `groupCode`
- action or review classification from `actionCode` when available
- Risk Context from `riskCode` / `riskCodes`
- Rank Score from `metrics.rankScore`
- Setup Quality from `metrics.setupQualityScore`
- Evidence Reliability from `metrics.confidenceScore`
- Risk-adjusted score from `metrics.riskAdjustedScore`
- supporting stored metrics such as `metrics.absoluteSetupScore` and `metrics.universePercentile`

Legacy archive rows that truly lack code-contract metadata render conservatively as `Metadata Unavailable` or `N/A`. Archive must not fill missing stored metadata with current ranking state.

## Ranking Quality Diagnostics

Ranking Quality Diagnostics is a secondary, collapsed Archive diagnostics panel inside Validation Details. It supports the Validate step by applying the internal ranking-quality evaluation helper to the currently loaded archive outcome rows when those rows are available.

The panel is research-only. It does not provide trading advice and does not convert diagnostics into recommendations.

The panel is intentionally compact. It reports:

- Window Coverage: Complete Windows, Partial Windows, Missing Windows, Data Support, and Window Coverage Mature / Limited Sample / Data Not Mature state.
- Diagnostic Availability: compact availability rows for Score Bucket Separation, Research Groups, Risk Context, and Evidence Reliability.
- Follow-up Notes: limited-sample, unavailable-field, no-variation, contradictory-context, and calibration-review notes.

Only complete outcome windows are used for primary diagnostics. Partial and missing windows are counted separately. Missing windows are not treated as negative outcomes.

Window coverage maturity is separate from diagnostic availability. A selected run can have mature complete-window coverage while score separation, research-group, risk-context, or evidence-reliability comparisons remain Limited Sample, Unavailable, Not Stored, or No Variation.

Research group, risk context, and evidence reliability diagnostics require stored archive fields with enough variation. Unknown-only research groups, only one research-group bucket, only No Risk Context rows, or missing confidence/evidence fields are reported conservatively instead of shown as full comparison tables.

Diagnostic availability depends on stored `rankScore`, `groupCode`, `riskCodes`, and confidence metrics. If these fields exist in the archive code-contract row, diagnostics read those stored values. If they are missing, diagnostics remain unavailable, not stored, or no-variation.

If Archive has window counts but no loaded outcome rows, the panel may show Data Not Mature or unavailable copy, but it must not fake score buckets, group summaries, risk-context summaries, or evidence reliability details.

Ranking Quality Diagnostics does not modify scoring, automatically calibrate weights, change codebook meanings, change API response shape, change storage format, or require database schema changes.

## Snapshot Rows

Snapshot Rows are a primary Archive area. They show the rows ranked in the selected run and preserve direct access to Symbol Research.

Visible columns include symbol identity, stored Research Group, stored Rank Score, validation state, follow-through, drawdown context, window, and Open Research when the data exists.

Missing outcome values render as `N/A` or a pending status. Missing stored ranking metadata renders as `Metadata Unavailable` or `N/A`.

## Validation Details

Validation Details are secondary and muted. They contain maturity logic and source-data diagnostics such as:

- maturity
- dominant reason
- expected wait
- source data
- window unit
- latest coverage
- coverage lag
- loaded rows
- outcome rows

## Stored Runs selector

Stored Runs acts as a compact stored-run selector. Run items prioritize timeframe, completed time, row count, universe scope, and readiness/source badges. Raw run ids are shortened and secondary.

## Archive to Symbol Research loop

Snapshot row links use the shared research navigation helper. Links include `from=archive` and preserve run, snapshot, timeframe, asset class, and symbol context where available.

Symbol Research source-aware navigation remains compatible with `/archive` query params.

## Pending and missing data states

Archive uses calm missing-state language:

- No archived runs available.
- No snapshot rows available for this run.
- Validation is still pending.
- No complete future windows yet.
- Source data is unavailable.
- Outcome metrics are not available yet.

Empty tables should not render without an explanation.

## Language boundary

Archive primary UI must avoid execution-directed, performance-result, and prediction-style language. Use research-only labels such as Research Group, Rank Score, Risk Context, Evidence Reliability, Stored Metadata, Code-Contract Metadata, Metadata Unavailable, Archived Snapshot, Selected Run, Window Coverage, and Diagnostic Availability.

## What this phase does not change

This Archive metadata adapter does not change:

- quant scoring formulas
- scoring behavior
- code values
- codebook dictionary semantics
- API routes
- API response shape
- database schema
- storage filters
- production scripts
- historical evaluation behavior
- chart libraries or candle behavior

## Future follow-ups

Possible future work:

- richer validation charts
- regime-aware validation grouping
- archive filters
- symbol-level outcome comparison
- annotations
- export removal or redesign
