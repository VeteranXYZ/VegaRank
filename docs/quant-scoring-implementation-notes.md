# Quant Scoring Engine v1 Implementation Notes

## Status

Phase 19 replaces the legacy ranking/scoring path with a deterministic,
code-attributed Quant Scoring Engine v1 implemented in
`src/lib/ranking-engine/quantScoring.ts`.

The supported scoring model identifiers are:

- `scoringModelVersion`: `quant-factor-v1`
- `scoringCalibrationVersion`: `deterministic-baseline-1`
- ranking engine protocol version: `19.0.0` stored in the current
  `scannerVersion` contract field

This is a clean-break code contract. Old scan rows are not migrated and are
not considered current if they do not contain a matching embedded
`raw_metrics.codeContract` object with the current ranking engine, code schema, and
scoring model versions.

## Public Contract

VegaRank API output remains the semi-anonymous code contract:

- `groupCode`
- `actionCode`
- `setupCode`
- `riskCode`
- `riskCodes`
- `reasonCodes`
- `signalCodes`
- `qualityCodes`
- `metrics`
- `scannerVersion`
- `codeSchemaVersion`
- `dictionaryVersion`

The public serializers intentionally do not expose readable legacy ranking
fields such as signal labels, action bias enums, primary structure
enums, backend prose observations, raw metrics blobs, review prose, factors, or
confirmation/invalidation text.

Dictionary copy should describe user-facing meaning without exposing private
weights, exact thresholds, or formula prose.

## Deterministic Score Flow

The v1 model is deterministic and explainable. It does not use machine
learning, deep learning, probabilistic prediction, or black-box inference.

The scoring flow is:

1. Normalize existing ranking inputs into a compact derived metric set.
2. Convert indicator evidence into factor-family scores.
3. Combine factor-family scores once into `absoluteSetupScore`.
4. Apply risk and data-quality penalties to produce `riskAdjustedScore`.
5. Compute `confidenceScore` from evidence reliability, not setup quality.
6. Apply universe ranking and MTF context when scan context is available.
7. Classify `groupCode`, `actionCode`, risk codes, setup code, signal codes,
   reason codes, and quality codes from the final score state.

The implemented deterministic formulas follow the Phase 19 specification:

- `absoluteSetupScore` combines trend, momentum, structure, volatility, volume,
  and MTF agreement family scores.
- `setupQualityScore` is currently equal to `absoluteSetupScore`.
- `riskAdjustedScore` subtracts weighted risk and quality penalties.
- `confidenceScore` combines data completeness, MTF agreement, liquidity
  reliability, factor agreement, and quality penalty.
- `universePercentile` ranks symbols by `riskAdjustedScore` within the current
  scan universe.
- `rankScore` combines `riskAdjustedScore`, `universePercentile`, and
  `confidenceScore`.

## Factor Families

Factor-family scores are designed to avoid raw indicator vote stacking:

- Trend family: moving-average alignment, price relationship to major moving
  averages, and nearby constructive cross context.
- Momentum family: RSI state, MACD state, recent high context, and failed
  breakout penalties.
- Price structure family: candle close quality, wick risk, moving-average
  proximity, breakout structure, extension, and failed breakout state.
- Volatility family: Bollinger width percentile / compression context and
  expansion risk.
- Volume / liquidity family: volume ratio, quote-volume reliability, expansion
  confirmation, dry volume, and abnormal spike behavior.
- Risk penalty family: overextension, overheated momentum, failed breakouts,
  weak closes, wick risk, breakdown/distribution phases, thin liquidity, and
  extreme volume behavior.
- Data-quality penalty family: history depth, missing indicator count, missing
  volume evidence, and invalid price data.
- MTF agreement family: neutral single-timeframe fallback and explicit MTF
  agreement score for multi-timeframe scans.
- Confidence family: evidence reliability separated from setup quality.
- Universe ranking family: percentile rank across the scanned symbols.

Raw indicators do not independently add full final-score votes. They are first
normalized into these families, and the final score combines family scores.

## Metrics Schema

`codeContract.metrics` includes the required Phase 19 fields:

- `rankScore`
- `riskAdjustedScore`
- `setupQualityScore`
- `confidenceScore`
- `absoluteSetupScore`
- `universePercentile`
- `trendScore`
- `momentumScore`
- `structureScore`
- `volatilityScore`
- `volumeScore`
- `mtfAgreementScore`
- `riskPenalty`
- `qualityPenalty`
- `historyBars`
- `volumeRank`
- `volatilityPercentile`
- `atrExtension`
- `distanceFromBase`
- `scoringModelVersion`
- `scoringCalibrationVersion`

The shared metrics type also retains short numeric aliases used by existing UI
components, such as `score`, `finalSignalScore`, `opportunityScore`,
`confirmationScore`, `riskScore`, `qualityScore`, `price`, `rsi14`,
`bbPercent`, `bbWidthPercentile`, and `volumeRatio`. These are numeric metrics,
not readable legacy classifications.

## Nullable and Deferred Metrics

The v1 implementation does not fake unavailable metrics.

- `atrExtension` is currently `null` because the active ranking pipeline does
  not provide a stable ATR extension value into scoring.
- `distanceFromBase` is populated only when a defensible moving-average base
  proxy is available.
- `universePercentile` is `null` until the result is processed in a scan context
  and then is filled by `calculateUniversePercentiles`.
- `mtfAgreementScore` is neutral `50` for single-timeframe scoring and is
  recomputed by the MTF ranking path when multiple timeframe rows are available.

Future phases can add richer indicator ingestion, but v1 should keep missing
evidence explicit.

## Code Attribution

The scoring module owns code attribution. It classifies:

- setup quality and context into setup / signal / reason codes
- risk state into `riskCode` and `riskCodes`
- evidence reliability into `qualityCodes`
- final research bucket into `groupCode`
- research workflow action into `actionCode`

Group logic is score-first and no longer preserves legacy classifications:

- severe data-quality issue: `GR_401` or `GR_402`
- elevated risk with hot momentum: `GR_302`
- high-risk poor reward/risk: `GR_301`
- constructive but limited confidence: `GR_201`
- high rank with acceptable risk and confidence: `GR_501` or `GR_601`
- otherwise: `GR_101`

Actions remain research workflow actions only, including watch, wait, monitor,
manual review, avoid chasing, reduce priority, exclude, add to research watch,
and high-priority review semantics. Execution-style language is not part of the
code contract.

## Storage Strategy

Postgres persistence embeds the authoritative code contract in
`scan_signals.raw_metrics.codeContract`. Existing physical columns keep their
legacy names for short-term schema stability, but newly written values are
research codes rather than readable enums.

Current-row queries require:

- embedded `raw_metrics.codeContract`
- current `scannerVersion`
- current `codeSchemaVersion`
- `metrics.scoringModelVersion = quant-factor-v1`

Old rows are intentionally not migrated. They may be cleared after deployment
with:

```sh
npm run scanner:cleanup-legacy
npm run scanner:cleanup-legacy -- --execute
```

The dry run should be checked before executing deletion in production.

## Validation Follow-Up

Phase 19 does not implement the historical validation engine. Later validation
should evaluate:

- `rankScore` decile outcomes
- `riskAdjustedScore` decile outcomes
- median return by `groupCode` after 1 / 3 / 5 / 10 candles
- drawdown behavior by `riskCode`
- positive-rate behavior by `setupCode`
- volatility expansion follow-through for `VO_202`
- chase-risk drawdown behavior for `RK_303`
- high-vs-low MTF agreement comparison
- performance by timeframe
- performance by market regime

The deterministic metrics schema is designed so offline validation can tune
weights or support a lightweight calibration model later without changing the
public code contract.
