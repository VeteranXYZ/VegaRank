import { describe, expect, it } from "vitest";
import {
  firstFiniteResearchMetric,
  formatResearchInteger,
  formatResearchMetric,
  formatResearchMetricLabel,
  researchMissingStateCopy,
  researchStateNotAvailableLabel,
} from "./formatResearchState";

describe("research state formatting", () => {
  it("renders missing metrics as N/A", () => {
    expect(researchStateNotAvailableLabel).toBe("N/A");
    expect(formatResearchMetric(null)).toBe("N/A");
    expect(formatResearchMetric(undefined)).toBe("N/A");
    expect(formatResearchMetric(Number.NaN)).toBe("N/A");
    expect(formatResearchMetric(72.256)).toBe("72.3");
    expect(formatResearchInteger(1200.8)).toBe("1,200");
    expect(formatResearchInteger(null)).toBe("N/A");
  });

  it("keeps UI metric labels readable without exposing camelCase names", () => {
    expect(formatResearchMetricLabel("rankScore")).toBe("Rank Score");
    expect(formatResearchMetricLabel("riskAdjustedScore")).toBe(
      "Risk-Adjusted Score",
    );
    expect(formatResearchMetricLabel("setupQualityScore")).toBe("Setup Quality");
    expect(formatResearchMetricLabel("confidenceScore")).toBe("Confidence");
    expect(formatResearchMetricLabel("volumeScore")).toBe("Liquidity");
  });

  it("supports provenance-safe fallback values", () => {
    expect(firstFiniteResearchMetric(null, undefined, 42, 50)).toBe(42);
    expect(firstFiniteResearchMetric(null, Number.NaN)).toBeUndefined();
  });

  it("centralizes missing and pending state copy", () => {
    expect(researchMissingStateCopy.noLatestSnapshot).toBe(
      "No latest research snapshot available.",
    );
    expect(researchMissingStateCopy.validationPending).toBe("Validation pending");
    expect(researchMissingStateCopy.partialWindow).toBe("Partial window");
    expect(researchMissingStateCopy.missingWindow).toBe("Missing window");
    expect(JSON.stringify(researchMissingStateCopy)).not.toMatch(
      /\b(win rate|success rate|prediction accuracy|buy|sell|long|short)\b/i,
    );
  });
});
