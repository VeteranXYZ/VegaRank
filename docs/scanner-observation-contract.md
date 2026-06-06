# Scanner Observation Contract

The scanner API is language-neutral. Backend scanner logic emits stable codes and
structured objects only. Human-readable English or Chinese copy belongs in the
frontend i18n dictionaries.

## Backend Contract

Scanner scoring returns observation arrays:

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

- scanner scoring
- scan result grouping
- API response builders
- persistence writers

## Removed Legacy Fields

The scanner result no longer exposes these fields:

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
