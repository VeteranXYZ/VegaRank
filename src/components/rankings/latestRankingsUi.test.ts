import { describe, expect, it } from "vitest";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { explainCode } from "@/lib/vegarank-codebook/explainCode";
import { groupCodeByResultGroup } from "@/lib/vegarank-codebook/codeRegistry";
import { buildLatestRankingsPreviewResponse } from "./latestRankingsPreviewData";
import {
  formatActionBias,
  formatActionDisplay,
  formatDateTime,
  formatGroupHint,
  formatGroupLabel,
  formatPrimaryStructure,
  formatPrice,
  formatQualityTier,
  formatReviewTierLabel,
  formatScore,
  formatSignalLabel,
  getDetectedRiskTypeLabels,
  getLatestRankingsActionDisplay,
  getLatestRankingsGroupCount,
  getLatestRankingsGroupSummaryChips,
  getLatestRankingsScoreRows,
  getReviewStatusNote,
  getReviewStatusReasons,
  getVisibleReviewReason,
  getResultGroupSortOrder,
  hasDetectedRiskTypes,
  normalizeGroupKey,
} from "./latestRankingsUi";

describe("latest rankings UI helpers", () => {
  it("formats nullable scores and prices safely", () => {
    expect(formatScore(72.256)).toBe("72.3");
    expect(formatScore(null)).toBe("N/A");
    expect(formatPrice(1234.567)).toBe("1,234.57");
    expect(formatPrice(0.000012345)).toBe("0.000012345");
    expect(formatPrice(undefined)).toBe("N/A");
  });

  it("formats readable labels without buy or sell language", () => {
    expect(formatSignalLabel("breakdown_risk")).toBe("Breakdown Risk");
    expect(formatActionBias("do_not_chase")).toBe("Overheated");
    expect(formatQualityTier("wrapped_or_staked")).toBe("Wrapped/Staked");
    expect(formatGroupLabel("eligible")).toBe("Eligible");
    expect(formatGroupHint("eligible")).toBe(
      "Rows worth manual review: positive rank, confirmed/trend, clear setup, and no detected risks.",
    );
    expect(formatGroupHint("watch")).toBe(
      "Monitor for confirmation; lower or negative-rank watch rows remain lower priority.",
    );
    expect(formatGroupHint("overheated")).toBe(
      "Extended conditions require additional review.",
    );
    expect(formatGroupHint("risk")).toBe("Risk context requires repair review.");
    expect(formatGroupHint("neutral")).toBe("Mixed research context.");
    expect(formatGroupHint("insufficient_history")).toBe("Not enough candles.");
    expect(formatReviewTierLabel("watch_high")).toBe("Needs Confirmation");
    expect(formatReviewTierLabel("watch_caution")).toBe("Manual Review");
    expect(formatReviewTierLabel("watch_low")).toBe("Low Priority Review");

    const combinedLabels = [
      formatGroupHint("eligible"),
      formatGroupHint("watch"),
      formatReviewTierLabel("eligible"),
      formatReviewTierLabel("watch_high"),
      formatReviewTierLabel("watch_caution"),
      formatReviewTierLabel("watch_low"),
      getLatestRankingsActionDisplay({
        resultGroup: "watch",
        actionBias: "eligible",
        reviewTier: "watch_low",
      }),
    ].join(" ");

    expect(combinedLabels).not.toMatch(/\b(buy|sell|entry|long|short)\b/i);
  });

  it("formats detailed score rows with readable labels", () => {
    expect(
      getLatestRankingsScoreRows({
        opportunityScore: 72.2,
        confirmationScore: 60,
        riskScore: 24.8,
        trendScore: 55,
        momentumScore: 48,
        volumeScore: 70,
        structureScore: null,
      }),
    ).toEqual([
      { label: "Rank Score", value: "N/A" },
      { label: "Risk-Adjusted Score", value: "N/A" },
      { label: "Setup Quality", value: "72.2" },
      { label: "Confidence", value: "60.0" },
      { label: "Trend", value: "55.0" },
      { label: "Momentum", value: "48.0" },
      { label: "Structure", value: "N/A" },
      { label: "Volatility", value: "N/A" },
      { label: "Liquidity", value: "70.0" },
      { label: "Risk Penalty", value: "24.8" },
      { label: "Quality Penalty", value: "N/A" },
      { label: "Universe Percentile", value: "N/A" },
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
      "Eligible / Manual Review",
    );
    expect(formatActionDisplay("watch_only", ["overheat_risk"])).toBe(
      "Watch / Manual Review",
    );
    expect(formatActionDisplay("avoid", ["overheat_risk"])).toBe("Risk");
    expect(formatActionDisplay("do_not_chase", [])).toBe("Overheated Review");
    expect(formatActionDisplay("ignore", [])).toBe("Low Priority");
    expect(formatActionDisplay("watch_only", [])).toBe("Watch");
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

    expect(getLatestRankingsActionDisplay(neutralEligibleWatch)).toBe(
      "Low Priority Review",
    );
    expect(getLatestRankingsActionDisplay(cautionWatch)).toBe("Manual Review");
    expect(
      getLatestRankingsActionDisplay({
        resultGroup: "watch",
        actionBias: "watch_only",
        reviewTier: "watch_high",
      }),
    ).toBe("Manual Review");
    expect(getLatestRankingsActionDisplay(neutralEligibleWatch)).not.toBe("Eligible");
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
    ).toBe("Manual Review");
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
      "Detected risks: overheat_risk. Treat as manual review, not a clean candidate.",
    ]);
    expect(
      getReviewStatusNote({
        statusNote: "Caution",
        reviewTier: "watch_caution",
        resultGroup: "watch",
      }),
    ).toBe("Manual Review");
    expect(getReviewStatusNote({ reviewTier: "watch_low" })).toBe(
      "Low Priority Review",
    );
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
      "Detected risks: Overheat Risk. Treat as manual review, not a clean candidate.",
      "Neutral structure prevents eligible classification.",
      "Rank score is below zero, so review priority is lower.",
    ]);
    expect(getReviewStatusReasons({ resultGroup: "risk" })).toEqual([
      "Risk conditions take priority over setup score.",
    ]);
  });

  it("formats Chinese ranking row meaning text without legacy English fallbacks", () => {
    const dictionary = dictionaries.zh;

    expect(formatGroupLabel("eligible", dictionary)).toBe("符合条件");
    expect(formatSignalLabel("breakdown_risk", dictionary)).toBe("破位风险");
    expect(formatActionBias("eligible", dictionary)).toBe("符合条件");
    expect(formatPrimaryStructure("extended_breakout", dictionary)).toBe(
      "延伸突破",
    );
    expect(formatPrimaryStructure(null, dictionary)).toBe("未知");
    expect(
      getReviewStatusNote(
        {
          statusNote: "Risk review",
          reviewTier: "risk",
          resultGroup: "risk",
        },
        dictionary,
      ),
    ).toBe("风险复核");
    expect(
      getReviewStatusNote(
        {
          statusNote: "Not enough candles",
          reviewTier: "insufficient_history",
          resultGroup: "insufficient_history",
        },
        dictionary,
      ),
    ).toBe("历史数据不足");
  });

  it("formats visual-check preview rows in Chinese without mixed English result labels", () => {
    const preview = buildLatestRankingsPreviewResponse();
    const groupedItems = Object.entries(preview.groups ?? {});
    const forbiddenEnglishResultText =
      /\b(Manual review|Needs confirmation|Overheated review|Risk review|Low priority|Mixed research context|Not enough candles|Extended Breakout|Base Building|Distribution|Breakdown|Unknown)\b/i;
    const renderedText = groupedItems
      .flatMap(([groupKey, items]) =>
        items.map((item) =>
          [
            explainCode(
              groupCodeByResultGroup[normalizeGroupKey(groupKey)],
              "zh",
            ).label,
            explainCode(item.signalCodes[0], "zh").label,
            explainCode(item.actionCode, "zh").label,
            explainCode(item.setupCode, "zh").label,
          ].join(" "),
        ),
      )
      .join(" ");

    expect(renderedText).toContain("研究观察");
    expect(renderedText).toContain("观察");
    expect(renderedText).toContain("过热");
    expect(renderedText).toContain("基底构建");
    expect(renderedText).toContain("历史样本不足");
    expect(renderedText).not.toMatch(forbiddenEnglishResultText);
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

    expect(getLatestRankingsGroupCount(summary, "risk")).toBe(140);
    expect(getLatestRankingsGroupSummaryChips(summary)).toEqual([
      { group: "eligible", label: "Eligible", count: 12 },
      { group: "watch", label: "Watch", count: 90 },
      { group: "overheated", label: "Overheated", count: 8 },
      { group: "risk", label: "Risk", count: 140 },
      { group: "neutral", label: "Neutral", count: 114 },
      { group: "insufficient_history", label: "Insufficient History", count: 5 },
    ]);

    expect(
      getLatestRankingsGroupCount(
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
