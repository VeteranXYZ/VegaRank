import { describe, expect, it } from "vitest";
import { dictionaries } from "./dictionaries";
import {
  formatScanEvaluationNote,
  formatScannerObservation,
  formatScannerReviewText,
} from "./formatScannerObservation";
import type {
  ScanEvaluationNoteKey,
  ScannerObservation,
  ScannerReviewKey,
} from "@/lib/shared/rankingTypes";

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

  it("keeps ranking result display labels concise and consistent", () => {
    expect(dictionaries.en.signalLabel.overheated).toBe("Overheated");
    expect(dictionaries.en.actionBias.watch_only).toBe("Watch");
    expect(dictionaries.en.primaryStructure.trend_breakdown).toBe(
      "Trend Breakdown",
    );
    expect(dictionaries.en.detectedRiskType.failed_breakout_risk).toBe(
      "Failed Breakout Risk",
    );

    expect(dictionaries.zh.signalLabel.breakdown_risk).toBe("破位风险");
    expect(dictionaries.zh.actionBias.eligible).toBe("符合条件");
    expect(dictionaries.zh.primaryStructure.trend_breakdown).toBe("趋势破位");
    expect(dictionaries.zh.detectedRiskType.failed_breakout_risk).toBe(
      "突破失败风险",
    );
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

  it("renders review reasons in English", () => {
    expect(
      formatScannerReviewText(
        {
          key: "review.reason.detectedRisks",
          params: { risks: "overheat_risk" },
        },
        dictionaries.en,
      ),
    ).toBe(
      "Detected risks: overheat_risk. Treat as manual review, not a clean candidate.",
    );
  });

  it("renders review reasons in Chinese", () => {
    expect(
      formatScannerReviewText(
        {
          key: "review.reason.needsConfirmation",
        },
        dictionaries.zh,
      ),
    ).toBe("结构有意义，但符合条件仍需要进一步确认。");
  });

  it("renders scan evaluation notes in English", () => {
    expect(
      formatScanEvaluationNote(
        {
          key: "evaluation.opportunityOutcomeVerified",
          params: { outcome: "favorable" },
        },
        dictionaries.en,
      ),
    ).toBe("Constructive label observation outcome: favorable.");
  });

  it("renders scan evaluation notes in Chinese", () => {
    expect(
      formatScanEvaluationNote(
        {
          key: "evaluation.riskOutcomeVerified",
          params: { outcome: "invalidated" },
        },
        dictionaries.zh,
      ),
    ).toBe("风险标签观察结果：invalidated。");
  });

  it("falls back to the scan evaluation note key when translation is missing", () => {
    const dictionary = {
      ...dictionaries.en,
      scanEvaluationNote: {} as Record<ScanEvaluationNoteKey, string>,
    };

    expect(
      formatScanEvaluationNote(
        {
          key: "evaluation.insufficientFutureCandles",
        },
        dictionary,
      ),
    ).toBe("evaluation.insufficientFutureCandles");
  });

  it("falls back to the review key when translation is missing", () => {
    const dictionary = {
      ...dictionaries.en,
      scannerReview: {} as Record<ScannerReviewKey, string>,
    };

    expect(
      formatScannerReviewText(
        {
          key: "review.reason.cleanCandidate",
        },
        dictionary,
      ),
    ).toBe("review.reason.cleanCandidate");
  });

  it("does not throw when template params are missing", () => {
    expect(() =>
      formatScannerReviewText(
        {
          key: "review.reason.detectedRisks",
        },
        dictionaries.en,
      ),
    ).not.toThrow();

    expect(
      formatScannerReviewText(
        {
          key: "review.reason.detectedRisks",
        },
        dictionaries.en,
      ),
    ).toBe(
      "Detected risks: n/a. Treat as manual review, not a clean candidate.",
    );

    expect(
      formatScanEvaluationNote(
        {
          key: "evaluation.riskOutcomeVerified",
        },
        dictionaries.zh,
      ),
    ).toBe("风险标签观察结果：无。");
  });

  it("does not leave raw placeholders for null params", () => {
    expect(
      formatScanEvaluationNote(
        {
          key: "evaluation.opportunityOutcomeVerified",
          params: { outcome: null },
        },
        dictionaries.en,
      ),
    ).toBe("Constructive label observation outcome: n/a.");
  });
});
