# VegaRank Archive Validation

## Purpose

Archive is the validation and review center for stored VegaRank research snapshots. It helps users understand which stored run is selected, whether that run has enough completed future-window data, and which snapshot rows can be opened in Symbol Research.

Archive source labels, validation readiness terms, outcome-window language, and missing-data rules are governed by `docs/vegarank-research-state-model.md`.

## Archive role in research workflow

Archive supports the Validate step in the workflow:

Discover -> Compare -> Research -> Monitor -> Validate

It is a research review surface. It does not measure trading performance, provide investment advice, or imply buy/sell outcomes.

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

It must not be described as win rate, success rate, profit, or prediction accuracy.

## Snapshot Rows

Snapshot Rows are a primary Archive area. They show the rows ranked in the selected run and preserve direct access to Symbol Research.

Visible columns include symbol identity, research group, research priority, risk context, rank score, validation state, follow-through, drawdown context, window, score components, source versions, and Open Research when the data exists.

Missing outcome values render as `N/A` or a pending status.

## Validation Details

Validation Details are secondary and muted. They contain maturity logic and source-data diagnostics such as:

- maturity
- dominant reason
- expected wait
- source data
- window unit
- latest coverage
- coverage lag
- returned rows
- outcome rows

## Stored Runs selector

Stored Runs acts as a compact stored-run selector. Run items prioritize timeframe, completed time, row count, universe scope, and readiness/source badges. Raw run ids are shortened and secondary.

## Archive to Symbol Research loop

Snapshot row links use the shared research navigation helper. Links include `from=archive` and preserve run, snapshot, timeframe, asset class, and symbol context where available.

Symbol Research source-aware return links remain compatible with `/archive` query params.

## Pending and missing data states

Archive uses calm missing-state language:

- No archived runs available.
- No snapshot rows available for this run.
- Validation is still pending.
- No complete future windows yet.
- Source data is unavailable.
- Outcome metrics are not available yet.

Empty tables should not render without an explanation.

## Forbidden language

Archive primary UI must avoid:

- buy
- sell
- long
- short
- entry
- exit
- take profit
- stop loss
- profit
- profit target
- guaranteed
- alpha call
- trade signal
- trading signal
- win rate
- success rate
- successful trade
- failed trade
- prediction accuracy

## What this phase does not change

Phase 25C does not change:

- quant scoring formulas
- scoring behavior
- code values
- codebook dictionary semantics
- API routes
- API response shape
- database schema
- storage filters
- production scripts
- backtest engine behavior
- chart libraries or candle behavior

## Future follow-ups

Possible future work:

- richer validation charts
- regime-aware validation grouping
- archive filters
- symbol-level outcome comparison
- annotations
- export removal or redesign
