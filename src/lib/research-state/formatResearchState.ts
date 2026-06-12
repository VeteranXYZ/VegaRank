export const researchStateNotAvailableLabel = "N/A";

export const researchMetricLabels = {
  rankScore: "Rank Score",
  riskAdjustedScore: "Risk-Adjusted Score",
  setupQualityScore: "Setup Quality",
  confidenceScore: "Confidence",
  trendScore: "Trend",
  momentumScore: "Momentum",
  structureScore: "Structure",
  volatilityScore: "Volatility",
  volumeScore: "Liquidity",
  universePercentile: "Universe Percentile",
  riskPenalty: "Risk Penalty",
  qualityPenalty: "Quality Penalty",
  finalSignalScore: "Risk-Adjusted Score",
  opportunityScore: "Setup Quality",
  confirmationScore: "Confidence",
  riskScore: "Risk Penalty",
} as const;

export type ResearchMetricKey = keyof typeof researchMetricLabels;

export function formatResearchMetric(
  value: number | null | undefined,
  decimals = 1,
) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return researchStateNotAvailableLabel;
  }

  return value.toFixed(decimals);
}

export function formatResearchInteger(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return researchStateNotAvailableLabel;
  }

  return Math.trunc(value).toLocaleString();
}

export function formatResearchMetricLabel(key: ResearchMetricKey) {
  return researchMetricLabels[key];
}

export function firstFiniteResearchMetric(
  ...values: Array<number | null | undefined>
) {
  return values.find((value) => typeof value === "number" && Number.isFinite(value));
}

export const researchMissingStateCopy = {
  noLatestSnapshot: "No latest research snapshot available.",
  noArchiveSnapshot: "No archive snapshot available yet.",
  validationPending: "Validation pending",
  partialWindow: "Partial window",
  missingWindow: "Missing window",
  sourceUnavailable: "Source data unavailable",
  unknown: "Unknown",
} as const;
