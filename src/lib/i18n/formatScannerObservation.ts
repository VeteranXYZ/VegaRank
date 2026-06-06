import { dictionaries } from "@/lib/i18n/dictionaries";
import type {
  ScanEvaluationNote,
  ScannerObservation,
  ScannerReviewText,
  ScannerTextParamValue,
} from "@/lib/shared/scannerTypes";

type Dictionary = (typeof dictionaries)[keyof typeof dictionaries];

const legacyScannerReviewKeyByValue: Record<string, ScannerReviewText["key"]> = {
  "manual review": "review.status.manualReview",
  "manual review required": "review.status.manualReview",
  "manual review still required": "review.status.manualReview",
  "manual review context": "review.status.manualReview",
  eligible: "review.status.manualReview",
  "needs confirmation": "review.status.needsConfirmation",
  "confirmation review": "review.status.needsConfirmation",
  "review only": "review.status.needsConfirmation",
  watch: "review.status.needsConfirmation",
  watch_high: "review.status.needsConfirmation",
  "caution": "review.status.caution",
  "caution review": "review.status.caution",
  watch_caution: "review.status.caution",
  "overheated review": "review.status.doNotChase",
  overheated: "review.status.doNotChase",
  "risk review": "review.status.avoid",
  "risk review only": "review.status.avoid",
  "repair review": "review.status.avoid",
  risk: "review.status.avoid",
  "low priority": "review.status.lowPriority",
  "low priority review": "review.status.lowPriority",
  watch_low: "review.status.lowPriority",
  "mixed research context": "review.status.noClearEdge",
  "mixed context": "review.status.noClearEdge",
  "neutral": "review.status.noClearEdge",
  "not enough candles": "review.status.notEnoughCandles",
  "not enough history": "review.status.notEnoughCandles",
  "insufficient history": "review.status.notEnoughCandles",
  insufficient_history: "review.status.notEnoughCandles",
  "insufficient data": "review.status.notEnoughCandles",
};

export function formatScannerObservation(
  observation: ScannerObservation,
  t: Dictionary,
) {
  return formatScannerTemplate(
    t.scannerObservation[observation.key] ?? observation.key,
    observation.params,
    t.common.notAvailable,
  );
}

export function formatScannerReviewText(reviewText: ScannerReviewText, t: Dictionary) {
  return formatScannerTemplate(
    t.scannerReview[reviewText.key] ?? reviewText.key,
    reviewText.params,
    t.common.notAvailable,
  );
}

export function formatScanEvaluationNote(note: ScanEvaluationNote, t: Dictionary) {
  return formatScannerTemplate(
    t.scanEvaluationNote[note.key] ?? note.key,
    note.params,
    t.common.notAvailable,
  );
}

export function formatScannerReviewValue(
  value: unknown,
  t: Dictionary,
  fallback = "",
) {
  const reviewText = toScannerReviewText(value, t);

  if (reviewText) {
    return formatScannerReviewText(reviewText, t);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return t === dictionaries.en ? value.trim() : fallback || t.scannerResultFallback.unknown;
  }

  return fallback;
}

export function toScannerReviewText(
  value: unknown,
  t: Dictionary,
): ScannerReviewText | null {
  if (typeof value === "string" && value in t.scannerReview) {
    return { key: value as ScannerReviewText["key"] };
  }

  if (typeof value === "string") {
    const legacyKey =
      legacyScannerReviewKeyByValue[normalizeScannerReviewValue(value)];

    if (legacyKey) {
      return { key: legacyKey };
    }
  }

  if (
    value &&
    typeof value === "object" &&
    "key" in value &&
    typeof value.key === "string" &&
    value.key in t.scannerReview
  ) {
    return value as ScannerReviewText;
  }

  return null;
}

function normalizeScannerReviewValue(value: string) {
  return value.trim().replace(/\s+/g, " ").replace(/[.。]+$/g, "").toLowerCase();
}

function formatScannerTemplate(
  template: string,
  params: Record<string, ScannerTextParamValue> | undefined,
  missingParamFallback: string,
) {
  const withParams = Object.entries(params ?? {}).reduce(
    (text, [key, value]) =>
      text.replaceAll(
        `{${key}}`,
        value === null ? missingParamFallback : String(value),
      ),
    template,
  );

  return withParams.replace(/\{[^{}]+\}/g, missingParamFallback);
}
