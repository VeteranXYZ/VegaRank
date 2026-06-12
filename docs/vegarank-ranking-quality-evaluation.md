# VegaRank Ranking Quality Evaluation

## 1. Purpose

Phase 28 adds the first internal Ranking Quality Evaluation layer for archived VegaRank rows. The layer asks whether ranking states produce meaningful separation in later validation context.

The output is diagnostic and structured. It is intended for internal review before any Archive UI integration.

## 2. Product Boundary

VegaRank is a crypto market structure research-ranking system. The evaluation layer helps assess which ranking states deserve calibration review, not what a user should do with a market.

This phase does not simulate opening actions, closing actions, holding-period rules, sizing, fees, slippage, P/L, strategy returns, or market-action outcomes.

## 3. What Ranking Quality Means

Ranking quality means separation between research states:

- Higher score buckets compared with lower score buckets.
- High Priority compared with Watch and Neutral.
- Risk Context compared with No Risk Context.
- High Confidence compared with Low Confidence.
- Timeframe summaries that show different maturity and follow-through context.

Quality is not defined as the maximum future price move.

## 4. What Ranking Quality Does Not Mean

Ranking Quality Evaluation does not produce investment advice, execution instructions, or scoring changes. It does not label a row as right or wrong.

It only summarizes validation context from archived rows and flags where assumptions need review.

## 5. Evaluation Data Sources

The helper operates on normalized archived rows that already contain:

- `rankScore`
- `riskAdjustedScore`
- `confidenceScore`
- research group
- timeframe
- risk context markers
- complete, partial, or missing outcome-window status
- observed follow-through
- drawdown context

The helper does not require database schema changes or API response changes.

## 6. Outcome Window Model

Outcome windows are validation context only.

Primary metrics are computed from complete windows:

- median follow-through
- average follow-through
- positive follow-through share
- follow-through interquartile range
- median drawdown context
- worst drawdown context

Partial windows and missing windows are counted, but they are not treated as negative outcomes.

## 7. Score Bucket Evaluation

Score buckets are deterministic fixed ranges:

- `score_lt_0`
- `score_0_20`
- `score_20_40`
- `score_40_60`
- `score_60_80`
- `score_80_100`
- `score_gte_100`
- `score_unknown`

The primary comparison is top non-empty score bucket versus bottom non-empty score bucket.

## 8. Research Group Evaluation

Research groups are normalized into:

- High Priority
- Watch
- Neutral
- Risk
- Overheated
- Insufficient History
- Other
- Unknown

The primary comparison is High Priority versus Watch / Neutral.

## 9. Risk Context Evaluation

Rows are summarized as Risk Context or No Risk Context.

Risk Context is present when the row explicitly marks risk context, has risk codes or risk types, or is in a risk-oriented group. The diagnostic compares drawdown context and follow-through context against rows without risk context.

## 10. Confidence / Evidence Reliability Evaluation

Confidence buckets are:

- Low Confidence
- Mid Confidence
- High Confidence
- Confidence Unknown

The primary diagnostic compares High Confidence with Low Confidence. It checks whether high-confidence rows have more mature windows and more stable follow-through context.

## 11. Timeframe Split

Timeframe summaries are grouped by normalized timeframe code. They report the same complete-window-first metrics and sample warnings as the other summaries.

This phase does not produce timeframe-specific calibration. Timeframe differences are follow-up candidates.

## 12. Multi-Timeframe Agreement Follow-Up

Multi-timeframe agreement is a future calibration-review dimension. Phase 28 keeps the helper input generic so agreement fields can be added later without changing the current output shape.

## 13. Missing / Partial / Immature Data Handling

Complete windows are used for primary summary metrics.

Partial windows are limited evidence and are counted separately.

Missing windows are counted separately and are not negative outcomes.

Immature data reduces interpretation strength.

## 14. Interpretation Rules

Diagnostic labels are:

- Clear Separation
- Weak Separation
- No Clear Separation
- Contradictory Context
- Limited Sample
- Data Not Mature

Safety thresholds:

- `MIN_COMPLETE_WINDOWS_FOR_INTERPRETATION = 20`
- `MIN_TOTAL_ROWS_FOR_BUCKET = 10`

These thresholds protect diagnostics from over-interpretation. They are not scoring thresholds.

If a bucket or group is below the threshold, the helper still reports counts and metrics where available, but labels the result as Limited Sample or Data Not Mature.

## 15. What This Phase Does Not Change

Phase 28 does not change:

- quant scoring weights
- penalties
- group mappings
- thresholds
- code values
- classification logic
- API response shape
- database schema
- storage filters
- public UI behavior

Archive UI integration is deferred until the helper output stabilizes.

## 16. Future Calibration Phases

Follow-up notes use neutral labels:

- calibration candidate
- needs more data
- needs timeframe split
- needs risk penalty review

Findings do not automatically change scoring. Any scoring update must happen in a later calibration phase with separate review.
