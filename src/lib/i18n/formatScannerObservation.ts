import type { useLanguage } from "@/components/providers/LanguageProvider";
import type {
  ScanEvaluationNote,
  ScannerObservation,
  ScannerReviewText,
  ScannerTextParamValue,
} from "@/lib/shared/scannerTypes";

type Dictionary = ReturnType<typeof useLanguage>["dictionary"];

export function formatScannerObservation(
  observation: ScannerObservation,
  t: Dictionary,
) {
  return formatScannerTemplate(
    t.scannerObservation[observation.key] ?? observation.key,
    observation.params,
  );
}

export function formatScannerReviewText(reviewText: ScannerReviewText, t: Dictionary) {
  return formatScannerTemplate(
    t.scannerReview[reviewText.key] ?? reviewText.key,
    reviewText.params,
  );
}

export function formatScanEvaluationNote(note: ScanEvaluationNote, t: Dictionary) {
  return formatScannerTemplate(
    t.scanEvaluationNote[note.key] ?? note.key,
    note.params,
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

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

export function toScannerReviewText(
  value: unknown,
  t: Dictionary,
): ScannerReviewText | null {
  if (typeof value === "string" && value in t.scannerReview) {
    return { key: value as ScannerReviewText["key"] };
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

function formatScannerTemplate(
  template: string,
  params: Record<string, ScannerTextParamValue> | undefined,
) {
  if (!params) {
    return template;
  }

  return Object.entries(params).reduce(
    (text, [key, value]) =>
      text.replaceAll(`{${key}}`, value === null ? "" : String(value)),
    template,
  );
}
