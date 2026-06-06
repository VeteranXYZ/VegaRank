import { describe, expect, it } from "vitest";
import { dictionaries } from "./dictionaries";
import {
  formatScannerObservation,
  formatScannerReviewText,
} from "./formatScannerObservation";
import type { ScannerObservation } from "@/lib/shared/scannerTypes";

describe("formatScannerObservation", () => {
  it("renders scanner observations in English", () => {
    expect(
      formatScannerObservation(
        {
          key: "confirmation.reclaimMa50",
          severity: "neutral",
          scope: "confirmation",
        },
        dictionaries.en,
      ),
    ).toBe("Price needs to reclaim MA50.");
  });

  it("renders scanner observations in Chinese", () => {
    expect(
      formatScannerObservation(
        {
          key: "confirmation.reclaimMa50",
          severity: "neutral",
          scope: "confirmation",
        },
        dictionaries.zh,
      ),
    ).toBe("价格需要重新收复 MA50。");
  });

  it("falls back to the key when translation is missing", () => {
    const observation = {
      key: "unknown.observation",
      severity: "neutral",
      scope: "system",
    } as unknown as ScannerObservation;

    expect(formatScannerObservation(observation, dictionaries.en)).toBe(
      "unknown.observation",
    );
  });

  it("formats review templates with params", () => {
    expect(
      formatScannerReviewText(
        {
          key: "review.reason.detectedRisks",
          params: { risks: "overheat_risk" },
        },
        dictionaries.en,
      ),
    ).toBe(
      "Caution: detected overheat_risk, so this is not treated as a clean eligible candidate.",
    );
  });
});
