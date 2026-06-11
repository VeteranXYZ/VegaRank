# Ranking Observation Contract

The rankings API is language-neutral. Backend ranking logic emits stable codes and
structured objects only. Human-readable English or Chinese copy belongs in the
frontend i18n dictionaries.

## Backend Contract

Ranking engine scoring returns observation arrays:

```ts
{
  bullishObservations: ScannerObservation[];
  bearishObservations: ScannerObservation[];
  riskObservations: ScannerObservation[];
  neutralObservations: ScannerObservation[];
  nextConfirmationObservations: ScannerObservation[];
  invalidationObservations: ScannerObservation[];
}
```

Each observation must include:

```ts
{
  key: "factor.priceAboveMa20",
  severity: "positive",
  scope: "trend",
  params?: { [name: string]: string | number | boolean | null }
}
```

Review metadata uses key-based fields:

```ts
{
  statusNoteKey: "review.status.manualReview",
  statusReasonKeys: [
    { key: "review.reason.cleanCandidate" }
  ]
}
```

## Storage Contract

Postgres `jsonb` columns keep structured observations:

```json
{
  "bullish": [
    { "key": "factor.priceAboveMa20", "severity": "positive", "scope": "trend" }
  ],
  "bearish": [],
  "risk": [
    { "key": "risk.overheat", "severity": "risk", "scope": "risk" }
  ],
  "neutral": []
}
```

Local SQLite research storage uses observation-oriented JSON fields such as
`bullish_observations_json`, `risk_observations_json`,
`next_confirmation_observations_json`, and `invalidation_observations_json`.

## Frontend Contract

Frontend components render observations through:

```ts
formatScannerObservation(observation, dictionary)
formatScannerReviewText(reviewText, dictionary)
```

Display copy is allowed in:

- `src/lib/i18n/dictionaries.ts`
- UI tests and preview data
- user-facing components after formatting through i18n

Display copy is not allowed in:

- ranking engine scoring
- ranking-result grouping
- API response builders
- persistence writers

## Display Copy Guidelines

Ranking-result copy should be concise, professional, and research-oriented.
English copy should use neutral wording such as "watch", "needs confirmation",
"risk remains elevated", "structure improving", and "invalidation". Chinese
copy should use terms such as "观察", "需要确认", "风险仍偏高", "结构改善",
"失效条件", and "研究参考".

Keep technical terms unchanged in both languages, including RSI, MACD, MA20,
MA50, MA200, BB%, ATR, OHLCV, ticker symbols, exchange names, and timeframe
values such as 15m, 1h, 4h, 1d, and 1w.

Display copy must not read like trading advice or hype. Backend ranking engine,
storage, server, and shared core files must continue to emit structured keys and
params only; English and Chinese display text belongs in frontend i18n
dictionaries and formatters.

## Removed Legacy Fields

The ranking result no longer exposes these fields:

- `bullishFactors`
- `bearishFactors`
- `riskFactors`
- `neutralFactors`
- `nextConfirmationText`
- `invalidationText`

Do not reintroduce them as compatibility aliases. New code must use observation
arrays only.

## Good API Output

```json
{
  "bullishObservations": [
    { "key": "factor.priceAboveMa20", "severity": "positive", "scope": "trend" }
  ],
  "nextConfirmationObservations": [
    {
      "key": "confirmation.reclaimMa50",
      "severity": "neutral",
      "scope": "confirmation"
    }
  ],
  "statusNoteKey": "review.status.manualReview",
  "statusReasonKeys": [
    { "key": "review.reason.cleanCandidate" }
  ]
}
```

## Bad API Output

```json
{
  "bullishFactors": ["Price has reclaimed MA20."],
  "nextConfirmationText": ["价格需要重新收复 MA50。"],
  "statusNote": "Manual review"
}
```

## Phase 16 Preparation

Do not implement language switching in this phase. Before Phase 16, decide:

- language selection source
- English UI surface
- Chinese UI surface
- export/report localization behavior
- AI assistant localization boundary
