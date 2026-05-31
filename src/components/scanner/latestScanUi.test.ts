import { describe, expect, it } from "vitest";
import {
  formatActionBias,
  formatActionDisplay,
  formatDateTime,
  formatGroupHint,
  formatGroupLabel,
  formatPrice,
  formatQualityTier,
  formatScore,
  formatSignalLabel,
  getDetectedRiskTypeLabels,
  getLatestScanGroupCount,
  getLatestScanGroupSummaryChips,
  getLatestScanScoreRows,
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
    expect(formatActionBias("do_not_chase")).toBe("Do Not Chase");
    expect(formatQualityTier("wrapped_or_staked")).toBe("Wrapped/Staked");
    expect(formatGroupLabel("eligible")).toBe("Eligible");
    expect(formatGroupHint("eligible")).toBe(
      "Candidates worth manual review, not automatic buys.",
    );
    expect(formatGroupHint("watch")).toBe("Monitor for confirmation.");
    expect(formatGroupHint("overheated")).toBe(
      "Strong but extended, do not chase.",
    );
    expect(formatGroupHint("risk")).toBe("Avoid or wait for repair.");
    expect(formatGroupHint("neutral")).toBe("No clear edge.");
    expect(formatGroupHint("insufficient_history")).toBe("Not enough candles.");
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
      { label: "Opportunity", value: "72.2" },
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
    expect(formatActionDisplay("avoid", ["overheat_risk"])).toBe("Avoid");
    expect(formatActionDisplay("do_not_chase", [])).toBe("Do not chase");
    expect(formatActionDisplay("ignore", [])).toBe("Ignore");
    expect(formatActionDisplay("watch_only", [])).toBe("Watch Only");
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
    ]);
  });

  it("normalizes backend group key variants", () => {
    expect(normalizeGroupKey("insufficientHistory")).toBe("insufficient_history");
    expect(normalizeGroupKey("risk")).toBe("risk");
    expect(normalizeGroupKey("unknown")).toBe("neutral");
    expect(getResultGroupSortOrder("eligible")).toBeLessThan(
      getResultGroupSortOrder("risk"),
    );
  });

  it("falls back for invalid dates", () => {
    expect(formatDateTime(null)).toBe("Not available");
    expect(formatDateTime("not-a-date")).toBe("Not available");
  });
});
