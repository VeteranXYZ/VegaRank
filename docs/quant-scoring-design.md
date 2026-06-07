# Quant Scoring Design

## Purpose

The scanner is a research-ranking system. It should rank technical research
candidates across a universe, explain scanner evidence through stable codes,
and avoid implying trade execution or investment advice.

Quant Scoring Engine v1 should be deterministic, explainable, and attributable
to scanner codes. It should use existing indicator inputs first and expose a
compact metrics schema that can later be validated and calibrated offline.

## External Quant Research Principles

The design follows broad public quantitative research principles without
copying proprietary strategies or implementing any outside strategy directly.

- Multi-factor ranking: combine independent families of evidence instead of
  relying on one indicator.
- Cross-sectional scoring: compare symbols against the current universe because
  the product scans hundreds of assets.
- Trend-following: sustained moving-average alignment and constructive price
  structure can support higher research priority.
- Momentum continuation and exhaustion: constructive momentum can support
  continuation, while late momentum, extension, or failed follow-through can
  increase chase risk.
- Volatility compression and expansion: compression can indicate setup
  development, while expansion has different implications depending on trend,
  structure, and risk context.
- Liquidity filtering: low or unstable liquidity should reduce reliability and
  can exclude symbols from research priority.
- Risk-adjusted ranking: raw setup quality should be penalized for extension,
  volatility, weak structure, poor liquidity, and low-quality data.
- Multi-timeframe confirmation: alignment across relevant timeframes should
  improve confidence; conflict should reduce confidence.
- Historical validation: codes and score deciles should later be evaluated
  against forward outcomes and drawdowns.

These principles shape the research-ranking framework only. They are not a
promise of predictive performance and are not an external trading strategy.

## Factor De-duplication and Correlation Control

The model must avoid double-counting highly correlated indicators.

RSI, rate-of-change style measures, MACD histogram, and stochastic-like
measures should not each independently add full final-score votes as separate
signals. Moving-average conditions should also not stack without limit.

The intended structure is:

1. Raw indicators generate sub-signals.
2. Sub-signals are grouped into factor families.
3. Each family score is normalized to a common range.
4. The final model combines factor-family scores, not raw indicator votes.

Factor families:

- trend
- momentum
- price structure
- volatility
- volume / liquidity
- risk penalty
- data quality penalty
- multi-timeframe agreement
- confidence
- universe ranking

This keeps related indicators useful while limiting correlated evidence from
overpowering the final `rankScore`.

## Market Regime Awareness

The v1 scorer should be designed so a later regime layer can classify the broad
environment before interpreting the same symbol signal.

Planned regime labels:

- trend regime
- range regime
- high-volatility regime
- low-volatility compression regime
- risk-off regime
- liquidity-thin regime

The same signal may have different meaning under different regimes.

Momentum expansion during a constructive trend regime may support watchlist
priority. Momentum expansion during an unstable high-volatility regime may
increase chase risk instead.

Phase 18/19 should not implement the full regime classifier. The scoring schema
should preserve enough metrics and codes so future phases can evaluate score
behavior by regime.

## Absolute Scores vs Universe Ranking

The scanner should distinguish symbol-level setup quality from cross-sectional
research priority.

- `absoluteSetupScore`: how technically constructive the symbol looks by
  itself.
- `universePercentile`: how the symbol ranks against the current scan universe.
- `rankScore`: final research priority after risk, quality, confidence, and
  cross-sectional context.

Because the scanner evaluates hundreds of assets, cross-sectional ranking is
central. A technically acceptable setup may still rank poorly if many other
symbols have stronger risk-adjusted evidence in the same scan.

## Confidence Separation

Confidence is not the same as setup quality.

- `setupQualityScore`: how constructive the technical setup appears.
- `confidenceScore`: how reliable the scanner evidence is.
- `riskAdjustedScore`: setup quality after risk and quality penalties.
- `rankScore`: final research priority.

Examples:

- A new low-history asset may have a strong `setupQualityScore` but a low
  `confidenceScore`.
- A core liquid asset may have a moderate `setupQualityScore` but a high
  `confidenceScore`.

This separation prevents strong-looking but low-evidence setups from being
ranked as if they were equally reliable.

## Scoring Disclosure Boundary

Internal formulas, thresholds, and private weights may be documented in
developer docs.

Public API responses should expose scanner codes, scores, and compact metrics,
but not long prose explaining private formulas. Dictionary explanations should
describe user-facing meaning without revealing exact thresholds, private
weights, or proprietary formulas.

The public contract should remain semi-anonymous:

- group/action/setup/risk/reason/signal/quality codes
- metrics
- scanner/code/dictionary versions

It should not expose backend prose, raw private indicator votes, or readable
legacy classifier enums.

## Deterministic v1 Formula

Initial deterministic formula:

```text
rawOpportunityScore =
  0.20 * trendScore
+ 0.18 * momentumScore
+ 0.18 * structureScore
+ 0.14 * volatilityScore
+ 0.12 * volumeScore
+ 0.18 * mtfAgreementScore

absoluteSetupScore = clamp(rawOpportunityScore, 0, 100)

setupQualityScore = absoluteSetupScore

riskAdjustedScore = clamp(
  setupQualityScore
  - 0.45 * riskPenalty
  - 0.35 * qualityPenalty,
  0,
  100
)

confidenceScore = clamp(
  0.35 * dataCompletenessScore
+ 0.25 * mtfAgreementScore
+ 0.20 * liquidityReliabilityScore
+ 0.20 * factorAgreementScore
- 0.35 * qualityPenalty,
  0,
  100
)

universePercentile = percentile rank of riskAdjustedScore

rankScore = clamp(
  0.60 * riskAdjustedScore
+ 0.25 * universePercentile
+ 0.15 * confidenceScore,
  0,
  100
)
```

If MTF context is unavailable, v1 may use neutral `50` while documenting the
fallback. If universe context is unavailable, `universePercentile` should remain
`null` until a scan-level pass can fill it.

## Calibration and Validation Plan

Later phases should evaluate the scoring model through historical outcomes.
Phase 18/19 should not implement the validation engine.

Required validation views:

- `rankScore` decile outcomes
- `riskAdjustedScore` decile outcomes
- `groupCode` median return after 1 / 3 / 5 / 10 candles
- `riskCode` drawdown analysis
- `setupCode` positive-rate analysis
- `VO_202` volatility expansion follow-through
- `RK_303` chase-risk drawdown behavior
- MTF agreement high-vs-low comparison
- performance by timeframe
- performance by market regime

Validation should evaluate both return and adverse excursion. A high forward
return with large interim drawdown is different from a clean follow-through
path, and the code taxonomy should support that analysis.

## Deterministic v1, Model-Calibrated Later

The v1 scoring model should be deterministic, explainable, and code-attributed.

Do not add machine learning in Phase 18 or Phase 19. Do not add deep learning.
Do not add black-box predictions.

The metrics schema should still be stable enough for future offline validation
to tune weights or support a lightweight calibration model later. Any future
model-calibrated layer should remain subordinate to the public scanner code
contract and should be validated before production use.
