import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const backendFiles = [
  "src/lib/ranking-engine/scoring.ts",
  "src/lib/ranking-engine/rankingResultGroups.ts",
  "src/lib/storage/scanEvaluation.ts",
  "src/lib/storage/postgres/rankingResultsPg.ts",
];

const contractFiles = [
  "src/lib/shared/rankingTypes.ts",
  "src/lib/ranking-engine/scoring.ts",
  "src/lib/storage/scanSignalModel.ts",
  "src/lib/storage/sqlite/schema.ts",
];

const removedLegacyFields = [
  "bullishFactors",
  "bearishFactors",
  "riskFactors",
  "neutralFactors",
  "nextConfirmationText",
  "invalidationText",
  "bullishFactorsJson",
  "bearishFactorsJson",
  "riskFactorsJson",
  "neutralFactorsJson",
  "nextConfirmationJson",
  "invalidationJson",
  "bullish_factors_json",
  "bearish_factors_json",
  "risk_factors_json",
  "neutral_factors_json",
  "next_confirmation_json",
  "invalidation_json",
];

describe("scanner language boundary", () => {
  it("keeps backend scanner files free of Chinese display copy", () => {
    for (const file of backendFiles) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/\p{Script=Han}/u);
    }
  });

  it("does not keep legacy Chinese label mappers in scanner scoring", () => {
    const scoring = readFileSync("src/lib/ranking-engine/scoring.ts", "utf8");

    expect(scoring).not.toContain("mapSignalLabelToChinese");
    expect(scoring).not.toContain("mapActionBiasToChinese");
    expect(scoring).not.toContain("mapStructureToChinese");
    expect(scoring).not.toContain("mapRiskTypeToChinese");
  });

  it("does not expose removed factor/text compatibility fields", () => {
    for (const file of contractFiles) {
      const source = readFileSync(file, "utf8");

      for (const field of removedLegacyFields) {
        expect(source, `${file} should not contain ${field}`).not.toContain(field);
      }
    }
  });
});
