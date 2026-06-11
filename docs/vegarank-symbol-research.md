# VegaRank Symbol Research

## Purpose

Symbol Research is the single-symbol workspace for reviewing the latest VegaRank ranking result, codebook evidence, timeframe context, archive relationship, watchlist state, and diagnostics.

It is research-only. It does not provide trading advice.

## Page role in research workflow

Symbol Research sits after discovery and comparison:

- Discover: rankings and screener surfaces identify candidates.
- Compare: multi-symbol views compare context.
- Research: Symbol Research reviews one symbol in detail.
- Monitor: watchlist state keeps local follow-up lists.
- Validate: archive and behavior diagnostics support later review.

## Information hierarchy

The page is organized into six primary sections:

1. Symbol Header / workflow actions
2. Research Snapshot
3. Evidence Overview
4. Multi-Timeframe Context
5. Timeline / Archive Context
6. Diagnostics

The current snapshot appears before archive and timeline context. Diagnostics stay collapsed and muted by default.

## Research Snapshot

The snapshot uses existing API and codebook fields:

- Symbol, timeframe, and update time
- Research Group
- Action
- Setup
- Evidence Quality
- Rank Score
- Confidence as evidence reliability
- Risk-Adjusted Score
- Setup Quality
- Risk Context and risk codes

Risk Context is visually separate from evidence strength so a high Rank Score does not override visible risk constraints.

## Decision Context

Decision context is represented as compact label/value rows, not generated prose. The main view avoids AI-style interpretation paragraphs and avoids directional prediction language.

## Evidence Panels

Evidence Overview combines sparse categories into one panel. It uses only:

- codebook labels
- codebook short copy
- metric labels
- factual metric values

Current categories:

- Structure & Setup
- Evidence Codes
- Data Quality

Risk constraints remain separate in Research Snapshot and diagnostics.

## Metric Family Grid

Metrics use readable labels and `N/A` for null values. The page avoids camelCase metric names.

Visible snapshot metrics:

- Rank Score
- Confidence
- Risk-Adjusted Score
- Setup Quality

Evidence metrics include supporting family values such as Trend, Momentum, Structure, Liquidity, Volatility, MTF Agreement, Quality Score, and History Bars when the section has meaningful data.

## Multi-Timeframe Context

The compact multi-timeframe strip shows returned timeframe snapshots using existing signal rows. It does not request new API fields or change chart behavior.

## Timeline and Archive Relationship

Timeline rows remain supporting context. Archive context links to the archive route and shows `No archive snapshot available yet.` when no archive run or snapshot is present in the navigation state.

Archive and timeline content should not push the current Research Snapshot down the page.

## Watchlist Relationship

The local watchlist control remains in the header actions:

- Add to Watchlist
- Remove from Watchlist
- Open Watchlist

No cloud watchlists, alerts, or portfolio behavior are added.

## Diagnostics Boundary

Diagnostics contain muted source and validation details:

- market context
- broad validation
- behavior diagnostics
- timeframe availability
- candle summary
- API/source metadata
- run selection notices

Diagnostics may repeat a main value when it is useful for debugging.

## What this phase does not change

- quant scoring formulas
- scoring behavior
- code values
- codebook dictionary semantics
- API routes
- API response shape
- database schema
- storage filters
- production scripts
- authentication
- watchlist persistence model
- chart library or candle behavior

## Future follow-ups

- richer archive validation UX
- deeper evidence explanations from codebook fields
- explicit MTF agreement model
- chart overlays
- user annotations
- cloud watchlists
- alerting system
