import { describe, expect, it } from "vitest";
import {
  formatSymbolResearchAction,
  formatSymbolResearchDateTime,
  formatSymbolResearchGroup,
  formatSymbolResearchList,
  formatSymbolResearchPrice,
  formatSymbolResearchRunContext,
  formatSymbolResearchScore,
  formatSymbolResearchSetup,
  getSymbolResearchTimeframeSnapshots,
  getTimeframeSnapshotNote,
  getTimeframeSnapshotTitle,
  getSymbolResearchCandleSummary,
  getSymbolResearchScoreRows,
  hasNewerSymbolResearchHistoryRows,
} from "./symbolResearchUi";

describe("symbol research UI helpers", () => {
  it("formats nullable numbers safely", () => {
    expect(formatSymbolResearchScore(82.28)).toBe("82.3");
    expect(formatSymbolResearchScore(null)).toBe("-");
    expect(formatSymbolResearchPrice(1234.567)).toBe("1,234.57");
    expect(formatSymbolResearchPrice(undefined)).toBe("-");
    expect(formatSymbolResearchDateTime("not-a-date")).toBe("Not available");
  });

  it("uses conservative research labels", () => {
    const labels = [
      formatSymbolResearchAction("eligible"),
      formatSymbolResearchAction("watch_caution"),
      formatSymbolResearchAction("watch_low"),
      formatSymbolResearchAction("overheated"),
      formatSymbolResearchAction("risk"),
      formatSymbolResearchAction("neutral"),
      formatSymbolResearchGroup("eligible"),
      formatSymbolResearchSetup("healthy_pullback"),
    ];

    expect(labels).toContain("Manual review");
    expect(labels).toContain("Caution review");
    expect(labels).toContain("Low priority review");
    expect(labels).toContain("Do not chase");
    expect(labels).toContain("Avoid or wait for repair");
    expect(labels.join(" ")).not.toMatch(/\b(buy|sell|entry|long|short)\b/i);
  });

  it("formats score rows with readable labels", () => {
    expect(
      getSymbolResearchScoreRows({
        rankScore: 81.2,
        finalSignalScore: 70,
        opportunityScore: null,
        confirmationScore: 62.1,
        riskScore: 20,
        trendScore: 54,
        momentumScore: 49,
        volumeScore: 34,
        structureScore: 88,
      }),
    ).toEqual([
      { label: "Rank", value: "81.2" },
      { label: "Final Signal", value: "70.0" },
      { label: "Opportunity", value: "-" },
      { label: "Confirmation", value: "62.1" },
      { label: "Risk", value: "20.0" },
      { label: "Trend", value: "54.0" },
      { label: "Momentum", value: "49.0" },
      { label: "Volume", value: "34.0" },
      { label: "Structure", value: "88.0" },
    ]);
  });

  it("summarizes candles without assuming data is present", () => {
    expect(getSymbolResearchCandleSummary({ rows: [] })).toEqual({
      latestClose: null,
      recentHigh: null,
      recentLow: null,
    });
    expect(
      getSymbolResearchCandleSummary({
        rows: [
          { openTime: 1, high: 10, low: 7, close: 9 },
          { openTime: 2, high: 12, low: 6, close: 11 },
        ],
      }),
    ).toEqual({
      latestClose: 11,
      recentHigh: 12,
      recentLow: 6,
    });
  });

  it("formats raw backend lists into readable labels", () => {
    expect(formatSymbolResearchList(["weak_bounce_risk", "strong_trend"])).toEqual([
      "Weak Bounce Risk",
      "Strong Trend",
    ]);
    expect(formatSymbolResearchList([{ type: "risk" }])).toEqual([]);
  });

  it("labels run context without making newer rows look current", () => {
    expect(
      formatSymbolResearchRunContext({
        isSelectedCurrentRun: true,
        sourceRunIsLikelyFullUniverse: true,
      }),
    ).toBe("Selected full-universe run");
    expect(
      formatSymbolResearchRunContext({
        isNewerThanSelectedCurrentRun: true,
        sourceRunIsLikelyFullUniverse: false,
      }),
    ).toBe("Newer non-preferred run");
    expect(formatSymbolResearchRunContext({ sourceRunIsLikelyFullUniverse: true })).toBe(
      "Full-universe run",
    );
    expect(formatSymbolResearchRunContext({ sourceRunIsLikelyFullUniverse: false })).toBe(
      "Smaller/manual run",
    );
  });

  it("detects newer history rows that need a current-selection notice", () => {
    expect(
      hasNewerSymbolResearchHistoryRows([
        { isSelectedCurrentRun: true },
        { isNewerThanSelectedCurrentRun: true },
      ]),
    ).toBe(true);
    expect(hasNewerSymbolResearchHistoryRows([{ isSelectedCurrentRun: true }])).toBe(
      false,
    );
  });

  it("avoids multi-timeframe wording when only one snapshot exists", () => {
    expect(getTimeframeSnapshotTitle(0)).toBe("Timeframe Snapshot");
    expect(getTimeframeSnapshotTitle(1)).toBe("Timeframe Snapshot");
    expect(getTimeframeSnapshotTitle(2)).toBe("Multi-Timeframe Snapshot");
    expect(getTimeframeSnapshotNote([{ timeframe: "4h" }])).toBe(
      "Only 4h snapshot is currently available for this symbol.",
    );
    expect(getTimeframeSnapshotNote([{ timeframe: "4h" }, { timeframe: "1d" }])).toBe(
      null,
    );
  });

  it("prefers the selected current signal for the requested timeframe snapshot", () => {
    const latestSignal = {
      id: "selected-current",
      timeframe: "4h",
      isSelectedCurrentRun: true,
      sourceRunIsLikelyFullUniverse: true,
    };
    const snapshots = getSymbolResearchTimeframeSnapshots({
      requestedTimeframe: "4h",
      latestSignal,
      timeframes: [
        {
          id: "newer-limited",
          timeframe: "4h",
          isNewerThanSelectedCurrentRun: true,
          sourceRunIsLikelyFullUniverse: false,
        },
        { id: "daily", timeframe: "1d" },
      ],
    });

    expect(snapshots.map((item) => item.id)).toEqual(["selected-current", "daily"]);
  });
});
