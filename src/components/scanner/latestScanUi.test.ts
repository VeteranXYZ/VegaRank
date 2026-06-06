import { describe, expect, it } from "vitest";
import {
  formatActionBias,
  formatActionDisplay,
  formatDateTime,
  formatGroupHint,
  formatGroupLabel,
  formatPrice,
  formatQualityTier,
  formatReviewTierLabel,
  formatScore,
  formatSignalLabel,
  getDetectedRiskTypeLabels,
  getLatestScanActionDisplay,
  getLatestScanGroupCount,
  getLatestScanGroupSummaryChips,
  getLatestScanScoreRows,
  getReviewStatusNote,
  getReviewStatusReasons,
  getVisibleReviewReason,
  getResultGroupSortOrder,
  hasDetectedRiskTypes,
  normalizeGroupKey,
} from "./latestScanUi";

describe("latest scan UI helpers", () => {
  it("formats nullable scores and prices safely", () => {
    expect(formatScore(72.256)).toBe("72.3");
    expect(formatScore(null)).toBe("-");
    expect(formatPrice(1234.567)).toBe("1,234.57");
    expect(formatPrice(0.000012345)).toBe("0.000012345");
    expect(formatPrice(undefined)).toBe("-");
  });

  it("formats readable labels without buy or sell language", () => {
    expect(formatSignalLabel("breakdown_risk")).toBe("Breakdown Risk");
    expect(formatActionBias("do_not_chase")).toBe("Overheated Review");
    expect(formatQualityTier("wrapped_or_staked")).toBe("Wrapped/Staked");
    expect(formatGroupLabel("eligible")).toBe("Eligible");
    expect(formatGroupHint("eligible")).toBe(
      "Candidates worth manual review: positive rank, confirmed/trend, clear setup, and no detected risks.",
    );
    expect(formatGroupHint("watch")).toBe(
      "Monitor for confirmation; lower or negative-rank watch rows are lower priority.",
    );
    expect(formatGroupHint("overheated")).toBe(
      "Extended conditions require additional review.",
    );
    expect(formatGroupHint("risk")).toBe("Risk context requires repair review.");
    expect(formatGroupHint("neutral")).toBe("Mixed research context.");
    expect(formatGroupHint("insufficient_history")).toBe("Not enough candles.");
    expect(formatReviewTierLabel("watch_high")).toBe("Needs confirmation");
    expect(formatReviewTierLabel("watch_caution")).toBe("Caution");
    expect(formatReviewTierLabel("watch_low")).toBe("Low priority");

    const combinedLabels = [
      formatGroupHint("eligible"),
      formatGroupHint("watch"),
      formatReviewTierLabel("eligible"),
      formatReviewTierLabel("watch_high"),
      formatReviewTierLabel("watch_caution"),
      formatReviewTierLabel("watch_low"),
      getLatestScanActionDisplay({
        resultGroup: "watch",
        actionBias: "eligible",
        reviewTier: "watch_low",
      }),
    ].join(" ");

    expect(combinedLabels).not.toMatch(/\b(buy|sell|entry|long|short)\b/i);
  });

  it("formats detailed score rows with readable labels", () => {
    expect(
      getLatestScanScoreRows({
        opportunityScore: 72.2,
        confirmationScore: 60,
        riskScore: 24.8,
        trendScore: 55,
        momentumScore: 48,
        volumeScore: 70,
        structureScore: null,
      }),
    ).toEqual([
      { label: "Setup Score", value: "72.2" },
      { label: "Confirmation", value: "60.0" },
      { label: "Risk", value: "24.8" },
      { label: "Trend", value: "55.0" },
      { label: "Momentum", value: "48.0" },
      { label: "Volume", value: "70.0" },
      { label: "Structure", value: "-" },
    ]);
  });

  it("detects and formats backend risk type conflicts", () => {
    expect(hasDetectedRiskTypes(["overheat_risk"])).toBe(true);
    expect(getDetectedRiskTypeLabels(["overheat_risk", "distribution_risk"])).toEqual([
      "Overheat Risk",
      "Distribution Risk",
    ]);
    expect(hasDetectedRiskTypes([])).toBe(false);
    expect(hasDetectedRiskTypes([{ type: "overheat_risk" }])).toBe(false);
  });

  it("moves risk conflicts into readable action wording", () => {
    expect(formatActionDisplay("eligible", ["overheat_risk"])).toBe(
      "Eligible / Caution",
    );
    expect(formatActionDisplay("watch_only", ["overheat_risk"])).toBe(
      "Watch / Caution",
    );
    expect(formatActionDisplay("avoid", ["overheat_risk"])).toBe("Risk Review");
    expect(formatActionDisplay("do_not_chase", [])).toBe("Overheated review");
    expect(formatActionDisplay("ignore", [])).toBe("Low Priority Review");
    expect(formatActionDisplay("watch_only", [])).toBe("Watch Only");
  });

  it("uses conservative Watch action labels and visible reasons", () => {
    const neutralEligibleWatch = {
      resultGroup: "watch",
      actionBias: "eligible",
      reviewTier: "watch_low",
      primaryStructure: "neutral",
      rankScore: 112.75,
      detectedRiskTypes: [],
    };
    const cautionWatch = {
      resultGroup: "watch",
      actionBias: "eligible",
      reviewTier: "watch_caution",
      primaryStructure: "strong_trend",
      rankScore: 128,
      detectedRiskTypes: ["overheat_risk"],
    };
    const weakBounceWatch = {
      resultGroup: "watch",
      actionBias: "watch_only",
      reviewTier: "watch_caution",
      primaryStructure: "weak_bounce",
      rankScore: 12,
      detectedRiskTypes: ["weak_bounce_risk"],
    };
    const negativeWatch = {
      resultGroup: "watch",
      actionBias: "watch_only",
      reviewTier: "watch_low",
      primaryStructure: "healthy_pullback",
      rankScore: -5,
      detectedRiskTypes: [],
    };

    expect(getLatestScanActionDisplay(neutralEligibleWatch)).toBe(
      "Low priority review",
    );
    expect(getLatestScanActionDisplay(cautionWatch)).toBe("Caution review");
    expect(
      getLatestScanActionDisplay({
        resultGroup: "watch",
        actionBias: "watch_only",
        reviewTier: "watch_high",
      }),
    ).toBe("Review only");
    expect(getLatestScanActionDisplay(neutralEligibleWatch)).not.toBe("Eligible");
    expect(getVisibleReviewReason(neutralEligibleWatch)).toBe("Neutral setup");
    expect(getVisibleReviewReason(cautionWatch)).toBe("Detected risk");
    expect(getVisibleReviewReason(weakBounceWatch)).toBe("Weak bounce risk");
    expect(getVisibleReviewReason(negativeWatch)).toBe("Negative rank");
  });

  it("explains review status from API fields or safe fallbacks", () => {
    expect(
      getReviewStatusNote({
        statusNoteKey: "review.status.caution",
        reviewTier: "watch_caution",
        resultGroup: "watch",
      }),
    ).toBe("Caution");
    expect(
      getReviewStatusReasons({
        statusReasonKeys: [
          {
            key: "review.reason.detectedRisks",
            params: { risks: "overheat_risk" },
          },
        ],
      }),
    ).toEqual([
      "Caution: detected overheat_risk, so this is not treated as a clean eligible candidate.",
    ]);
    expect(
      getReviewStatusNote({
        statusNote: "Caution",
        reviewTier: "watch_caution",
        resultGroup: "watch",
      }),
    ).toBe("Caution");
    expect(getReviewStatusNote({ reviewTier: "watch_low" })).toBe("Low priority");
    expect(
      getReviewStatusReasons({
        statusReasons: [
          "Caution: detected overheat risk, so this is not treated as a clean eligible candidate.",
        ],
      }),
    ).toEqual([
      "Caution: detected overheat risk, so this is not treated as a clean eligible candidate.",
    ]);
    expect(
      getReviewStatusReasons({
        resultGroup: "watch",
        detectedRiskTypes: ["overheat_risk"],
        primaryStructure: "neutral",
        rankScore: -1,
      }),
    ).toEqual([
      "Caution: detected Overheat Risk, so this is not treated as a clean eligible candidate.",
      "Neutral setup type prevents clean eligible classification.",
      "Low priority watch because rank score is below zero.",
    ]);
    expect(getReviewStatusReasons({ resultGroup: "risk" })).toEqual([
      "Risk group has priority over setup score.",
    ]);
  });

  it("returns full-scan group counts for summary chips", () => {
    const summary = {
      eligible: 12,
      watch: 90,
      overheated: 8,
      risk: 140,
      neutral: 114,
      insufficient_history: 5,
    };

    expect(getLatestScanGroupCount(summary, "risk")).toBe(140);
    expect(getLatestScanGroupSummaryChips(summary)).toEqual([
      { group: "eligible", label: "Eligible", count: 12 },
      { group: "watch", label: "Watch", count: 90 },
      { group: "overheated", label: "Overheated", count: 8 },
      { group: "risk", label: "Risk", count: 140 },
      { group: "neutral", label: "Neutral", count: 114 },
      { group: "insufficient_history", label: "Insufficient History", count: 5 },
    ]);

    expect(
      getLatestScanGroupCount(
        {
          eligible: 3,
          totalByGroup: { eligible: 26 },
        },
        "eligible",
      ),
    ).toBe(26);
  });

  it("normalizes backend group key variants", () => {
    expect(normalizeGroupKey("insufficientHistory")).toBe("insufficient_history");
    expect(normalizeGroupKey("risk")).toBe("risk");
    expect(normalizeGroupKey("unknown")).toBe("neutral");
    expect(getResultGroupSortOrder("eligible")).toBeLessThan(
      getResultGroupSortOrder("risk"),
    );
  });

  it("formats dates with neutral numeric 24-hour output", () => {
    expect(formatDateTime("2026-06-05T08:05:00")).toBe("2026-06-05 08:05");
    expect(formatDateTime("2026-06-05T18:05:00")).toBe("2026-06-05 18:05");
    expect(formatDateTime("2026-06-05T08:05:00")).not.toMatch(
      /AM|PM|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|年|月|日/,
    );
  });

  it("falls back for invalid dates", () => {
    expect(formatDateTime(null)).toBe("Not available");
    expect(formatDateTime("not-a-date")).toBe("Not available");
  });
});
