# Professional English Research Codebook

## Purpose

The English scanner codebook defines the professional research language used to
explain scanner codes. It gives users concise meaning for scanner results
without exposing formulas, private thresholds, proprietary weights, or backend
implementation details.

The codebook is a terminology layer for research ranking. It should help users
understand what a code means, why it matters for research priority, what
evidence or constraint it represents, and how it should affect manual review.

## Product Boundary

trade-scanner is a professional crypto technical research system. It ranks
research candidates and explains technical evidence. It does not issue trading
instructions, predict future prices, or provide investment advice.

Codebook language must keep this boundary clear:

- Use research, review, monitor, wait, reduce priority, and exclude.
- Do not use execution commands or outcome promises.
- Do not imply that a higher rank is a trading instruction.
- Do not present scanner output as investment advice.

## Research-Only Language Rules

Use objective, concise, calm language. Explanations should be constructive when
setup quality improves, cautious when confidence is limited, firm when risk is
elevated, and neutral when evidence is mixed.

Good language:

- "Momentum is improving, but confirmation remains limited."
- "Trading activity is below the preferred research range."
- "Price is extended from its base, increasing chase risk."

Bad language:

- "Triggered because RSI is above a private threshold."
- "The formula says this row should rank higher."
- "This is a signal to trade."

## Entry Responsibilities

The current runtime dictionary shape supports `label` and `short`. Do not add
new fields unless the public API contract is intentionally expanded in a later
phase.

When the product later supports richer entry fields, use these responsibilities:

- `label`: short professional name for headings and detail areas.
- `short`: one-sentence summary for cards, tooltips, and compact descriptions.
- `detail`: fuller research explanation for symbol research and diagnostics.
- `display.badge`: one to three words for badges.
- `display.table`: compact table wording that will not overflow cells.
- `display.detail`: readable detail-panel wording.
- `guidance.do`: research workflow suggestion.
- `guidance.dont`: research boundary or caution.

## Preferred Vocabulary

Use these terms consistently:

- research
- review
- monitor
- watch
- wait
- priority
- evidence
- confirmation
- follow-through
- structure
- compression
- expansion
- extension
- risk
- constraint
- confidence
- reliability
- liquidity
- participation
- volatility
- setup
- regime
- queue

## Forbidden Vocabulary

Avoid execution commands, hype, and prediction claims:

- buy
- sell
- long
- short
- entry
- exit
- take profit
- stop loss
- trade now
- signal to trade
- moon
- pump
- explode
- crash
- guaranteed
- sure thing
- perfect setup
- must buy
- must sell
- will go up
- will dump
- will crash

The terms `trading activity` and `reward-risk` are allowed when describing
liquidity participation or risk context. They must not be used as execution
instructions.

## Domain-Specific Terminology

Research priority means ranking within the scanner research queue. Avoid
"trade priority".

Setup quality means the technical structure appears more or less constructive.
Avoid "buy quality".

Confidence means evidence reliability, not prediction certainty.

Risk-adjusted means risk constraints are included in the rank. It does not
imply a guaranteed better outcome.

Watch means keep visible for review. It does not mean act.

Monitor means track without urgency.

Review manually means human inspection is required.

Avoid chasing means late reaction has poor reward-risk. It does not mean take
the other side.

Reduce priority means lower the research ranking because risk, quality, or
confidence constraints are present.

Exclude means remove from priority research because quality, data, liquidity,
or risk constraints are too severe.

High-priority review means a stronger research candidate. It is not a trading
instruction.

Follow-through means continuation after initial evidence appears.

Compression means volatility or range contraction.

Expansion means volatility or range expansion.

Extension means price is stretched away from a base or reference structure.

Reclaim means price is recovering a prior structure level.

Breakdown risk means weak structure or failed support behavior.

## Factor-Family Terminology

Trend codes should use trend quality, recovery attempt, trend confirmation,
weakening trend, directional structure, and consistency.

Momentum codes should use improving momentum, early expansion, elevated
momentum, fading momentum, failed follow-through, and overheated momentum.

Price-structure codes should use base, range, reclaim, structure repair,
extension from base, breakdown risk, and structure confirmation.

Volatility codes should use compression, squeeze condition, expansion risk,
unstable volatility, and constructive compression. Volatility compression is
not automatically positive; it is constructive only when trend, structure,
liquidity, and risk context support it.

Volume and liquidity codes should use participation, trading activity,
liquidity reliability, preferred research range, thin market risk, and volume
expansion.

Risk codes should use caution, elevated risk, poor reward-risk profile, chase
risk, false breakout risk, and hard risk exclusion.

Quality and history codes should use evidence reliability, history depth,
incomplete coverage, data quality constraint, and confidence constraint.

System and noise codes should use noisy structure, signal quality, execution
quality, follow-through stability, fallback, and unavailable explanation.

## Explanation Templates

Constructive but not confirmed:
"The setup is improving, but confirmation remains limited. The row is better
suited for monitoring than high-priority review."

Constructive with acceptable risk:
"The setup shows constructive evidence, and risk remains acceptable. The row
can remain in the active research queue."

High priority:
"The row combines stronger setup quality, better evidence reliability, and
acceptable risk. It is suitable for high-priority manual review."

Overheated or chase risk:
"Momentum or price extension is elevated. Chasing the move may carry poor
reward-risk, so research priority should be reduced."

Low confidence:
"The scanner has limited reliable evidence for this row. Treat the result
cautiously until more history or confirmation is available."

Liquidity constrained:
"Trading activity is below the preferred research range. Liquidity constraints
reduce confidence in the setup."

Volatility compression:
"Volatility is compressed, which may indicate a developing setup when trend,
structure, and liquidity also support it."

Failed follow-through:
"Recent follow-through is weak or inconsistent. The setup needs cleaner
confirmation before receiving higher priority."

Risk-adjusted priority:
"Setup quality is constructive, but risk constraints reduce the row's final
research priority."

Data-quality exclusion:
"The row is excluded from priority research because data quality or history
depth is not sufficient for a reliable read."

## Disclosure Boundary

Dictionary copy may describe visible meaning, research relevance, and review
boundaries. It must not disclose:

- private formulas
- exact thresholds
- private score weights
- implementation internals
- raw backend indicator votes
- investment advice
- execution instructions
- future price predictions

Public explanations should stay semi-anonymous and code-oriented. Developer
docs may document formulas; dictionary copy should not.

## Manual Coverage Policy

Generated baseline entries are a safety net only. They should keep
`explainCode` stable if a registry code is added before manual copy is written.

Manual English entries are required for active user-facing codes, especially:

- group codes
- action codes
- risk codes
- setup codes
- quality and history codes
- Quant Scoring Engine v1 emitted factor-family codes

Phase 20 coverage audit:

- Active registry codes: 120
- Manual English entries: 120
- Baseline-only active codes: 0

## Relationship to Quant Scoring Engine v1

Quant Scoring Engine v1 is deterministic and code-attributed. It classifies
scanner evidence into group, action, setup, phase, reason, signal, risk, and
quality codes.

The English codebook explains the meaning of those codes in research language.
It does not change scoring formulas, score weights, code values, API shape,
storage schema, scanner versions, or production behavior.

## Relationship to Later Chinese Terminology Phase

The English codebook is the source terminology standard for future Chinese
terminology work. Phase 20 does not rewrite the full Chinese dictionary. A
later phase should align Chinese terminology to the same research-only boundary
while preserving natural Chinese product language.
