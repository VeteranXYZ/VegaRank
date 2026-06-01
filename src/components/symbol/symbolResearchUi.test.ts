import { describe, expect, it } from "vitest";
import {
  buildSymbolResearchDiagnostics,
  buildSymbolResearchSummary,
  buildSymbolResearchTimeframeAvailability,
  buildSymbolResearchTimeframeNavigation,
  buildSymbolResearchUnavailableContent,
  formatSymbolResearchAction,
  formatSymbolResearchDateTime,
  formatSymbolResearchGroup,
  formatSymbolResearchList,
  formatSymbolResearchPrice,
  formatSymbolResearchRunContext,
  formatSymbolResearchScore,
  formatSymbolResearchSetup,
  formatSymbolResearchUnavailableCoverage,
  formatSymbolResearchUnavailableReason,
  formatSymbolResearchUnavailableSelectedRun,
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

  it.each([
    ["risk", "Risk / wait for repair"],
    ["eligible", "Manual review candidate"],
    ["watch", "Watch for confirmation"],
    ["overheated", "Do not chase"],
    ["neutral", "No clear edge"],
  ])("builds a conservative research summary for %s", (resultGroup, stance) => {
    const summary = buildSymbolResearchSummary({
      resultGroup,
      primaryStructure: "healthy_pullback",
      rankScore: 82,
      opportunityScore: 70,
      confirmationScore: 62,
      riskScore: 20,
      detectedRiskTypes: resultGroup === "risk" ? ["trend_breakdown_risk"] : [],
      statusReasons: ["Scanner status reason."],
      factors: {
        bullish: ["constructive_structure"],
        risk: resultGroup === "risk" ? ["risk pressure"] : [],
      },
      nextConfirmation: ["Needs stronger confirmation"],
      invalidation: ["Structure weakens further"],
      isSelectedCurrentRun: true,
      sourceRunIsLikelyFullUniverse: true,
    });

    expect(summary.stance).toBe(stance);
    expect(summary.why.length).toBeGreaterThanOrEqual(2);
    expect(summary.why.length).toBeLessThanOrEqual(4);
    expect(summary.nextConfirmation).toEqual(["Needs stronger confirmation"]);
    expect(summary.invalidation[0]).toBe("Structure weakens further");
    expect(summary.runBasis).toBe("Based on selected full-universe run");
    expect(JSON.stringify(summary)).not.toMatch(
      /\b(buy|sell|long|short|entry|exit|target|take[-\s]?profit|stop[-\s]?loss)\b/i,
    );
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

  it("builds data source diagnostics for selected runs and newer secondary rows", () => {
    const diagnostics = buildSymbolResearchDiagnostics({
      selectedTimeframe: "4h",
      currentSelection: {
        isLikelyFullUniverse: true,
        fallbackUsed: false,
        selectedRunFinishedAt: "2026-05-31T01:27:00.000Z",
        selectedSignalScanTime: "2026-05-31T01:27:30.000Z",
      },
      latestSignal: { isSelectedCurrentRun: true },
      history: [{ isNewerThanSelectedCurrentRun: true }],
    });

    expect(diagnostics.rows.slice(0, 2)).toEqual([
      { label: "Selected Timeframe", value: "4h" },
      { label: "Full-Universe Run", value: "Yes" },
    ]);
    expect(diagnostics.notice).toBe(
      "Newer secondary runs exist. Current classification uses selected full-universe run.",
    );
    expect(diagnostics.hasWarning).toBe(true);
  });

  it("formats insufficient-history unavailable state without hiding the timeframe", () => {
    const content = buildSymbolResearchUnavailableContent({
      symbol: "SEIUSDT",
      timeframe: "1w",
      unavailableReason: "insufficient_history",
      message:
        "No 1w scanner signal for SEIUSDT. The latest full-universe 1w scan ran successfully, but SEIUSDT was skipped because it has only 145 candles. The scanner currently requires 200 candles.",
      selectedRun: {
        status: "success",
        timeframe: "1w",
        symbolsTotal: 413,
        symbolsScanned: 192,
        symbolsSkipped: 221,
        signalsCreated: 192,
        finishedAt: "2026-06-01T04:00:00.000Z",
        isLikelyFullUniverse: true,
      },
      symbolCoverage: {
        timeframe: "1w",
        candleCount: 145,
        requiredCandles: 200,
      },
    });

    expect(content.title).toBe("Timeframe unavailable for this symbol");
    expect(content.isInsufficientHistory).toBe(true);
    expect(content.message).toContain("No 1w scanner signal for SEIUSDT");
    expect(content.details).toEqual(
      expect.arrayContaining([
        { label: "Symbol", value: "SEIUSDT" },
        { label: "Timeframe", value: "1w" },
        { label: "Reason", value: "Insufficient history" },
        { label: "Candles", value: "145 / 200 required" },
        {
          label: "Selected Run",
          value: "1w full-universe run, success, scanned 192 / 413, skipped 221",
        },
        { label: "Signals Created", value: "192" },
      ]),
    );
    expect(content.suggestions).toEqual([
      "Try 4h or 1d for SEIUSDT.",
      "Refresh after the next scanner run; 1w coverage updates as more weekly candles accrue.",
    ]);
  });

  it("uses conservative copy for generic no-signal unavailable state", () => {
    const content = buildSymbolResearchUnavailableContent({
      symbol: "ABCUSDT",
      timeframe: "1d",
      unavailableReason: "not_in_selected_run",
      selectedRun: {
        status: "success",
        symbolsTotal: 413,
        symbolsScanned: 413,
        symbolsSkipped: 0,
        signalsCreated: 412,
        isLikelyFullUniverse: true,
      },
      symbolCoverage: {
        timeframe: "1d",
        candleCount: 500,
        requiredCandles: 200,
      },
    });

    expect(content.title).toBe("Timeframe unavailable for this symbol");
    expect(content.isInsufficientHistory).toBe(false);
    expect(content.message).toBe(
      "No scanner signal is available for this symbol/timeframe from the selected latest run.",
    );
  });

  it("builds timeframe availability rows for available and unavailable timeframes", () => {
    const rows = buildSymbolResearchTimeframeAvailability({
      timeframes: ["4h", "1d", "1w", "1h"],
      selectedTimeframe: "1w",
      signals: [
        {
          timeframe: "4h",
          resultGroup: "eligible",
          actionBias: "eligible",
          rankScore: 81.2,
          scanTime: "2026-06-01T00:00:00.000Z",
          sourceRunIsLikelyFullUniverse: true,
        },
        {
          timeframe: "1d",
          resultGroup: "watch",
          actionBias: "watch_caution",
          rankScore: 64,
          scanTime: "2026-06-01T01:00:00.000Z",
          isSelectedCurrentRun: false,
          sourceRunIsLikelyFullUniverse: true,
        },
        {
          timeframe: "1h",
          resultGroup: "neutral",
          actionBias: "neutral",
          rankScore: 48,
          scanTime: "2026-06-01T02:00:00.000Z",
          isSelectedCurrentRun: false,
          sourceRunIsLikelyFullUniverse: true,
        },
      ],
      unavailable: {
        symbol: "SEIUSDT",
        timeframe: "1w",
        unavailableReason: "insufficient_history",
        selectedRun: {
          timeframe: "1w",
          status: "success",
          symbolsTotal: 413,
          symbolsScanned: 192,
          symbolsSkipped: 221,
          isLikelyFullUniverse: true,
        },
        symbolCoverage: {
          timeframe: "1w",
          candleCount: 145,
          requiredCandles: 200,
        },
      },
    });

    expect(rows.map((row) => [row.timeframe, row.status, row.badgeLabel])).toEqual([
      ["4h", "available", "Available"],
      ["1d", "available", "Available"],
      ["1w", "selected_unavailable", "Insufficient history"],
      ["1h", "available", "Available"],
    ]);
    expect(rows[2]).toMatchObject({
      isSelected: true,
      reason: "Insufficient history",
      candles: "145 / 200 required",
      selectedRun: "1w full-universe run, success, scanned 192 / 413, skipped 221",
    });
    expect(rows[3]).toMatchObject({
      isDisabled: false,
      selectedRun: "Full-universe run",
      reason: "Available",
      rank: "48.0",
    });
  });

  it("does not mark unchecked supported timeframes as broken", () => {
    const rows = buildSymbolResearchTimeframeAvailability({
      timeframes: ["4h", "1d", "1w", "1h"],
      selectedTimeframe: "4h",
      signals: [
        {
          timeframe: "4h",
          resultGroup: "eligible",
          actionBias: "eligible",
          rankScore: 81.2,
          scanTime: "2026-06-01T00:00:00.000Z",
          isSelectedCurrentRun: true,
          sourceRunIsLikelyFullUniverse: true,
        },
      ],
    });

    expect(rows.map((row) => [row.timeframe, row.status, row.reason])).toEqual([
      ["4h", "selected_available", "Available"],
      ["1d", "not_returned", "No latest signal was returned for this timeframe."],
      ["1w", "not_returned", "No latest signal was returned for this timeframe."],
      ["1h", "not_returned", "No latest signal was returned for this timeframe."],
    ]);
  });

  it("builds quick-switch options with supported states", () => {
    const options = buildSymbolResearchTimeframeNavigation({
      timeframes: ["4h", "1d", "1w", "1h"],
      selectedTimeframe: "1d",
    });

    expect(options).toEqual([
      expect.objectContaining({
        timeframe: "4h",
        status: "supported",
        badgeLabel: "Supported",
        isDisabled: false,
      }),
      expect.objectContaining({
        timeframe: "1d",
        status: "selected",
        badgeLabel: "Selected",
        isSelected: true,
        isDisabled: false,
      }),
      expect.objectContaining({
        timeframe: "1w",
        status: "supported",
        badgeLabel: "Supported",
        isDisabled: false,
      }),
      expect.objectContaining({
        timeframe: "1h",
        status: "supported",
        badgeLabel: "Supported",
        isDisabled: false,
      }),
    ]);
  });

  it("formats unavailable reason, selected run, and candle coverage directly", () => {
    expect(formatSymbolResearchUnavailableReason("insufficient_history")).toEqual({
      code: "insufficient_history",
      label: "Insufficient history",
    });
    expect(formatSymbolResearchUnavailableReason("not_in_selected_run")).toEqual({
      code: "not_in_selected_run",
      label: "Not in selected run",
    });
    expect(
      formatSymbolResearchUnavailableSelectedRun({
        timeframe: "1w",
        status: "success",
        symbolsTotal: 413,
        symbolsScanned: 192,
        symbolsSkipped: 221,
        isLikelyFullUniverse: true,
      }),
    ).toBe("1w full-universe run, success, scanned 192 / 413, skipped 221");
    expect(
      formatSymbolResearchUnavailableCoverage({
        candleCount: 145,
        requiredCandles: 200,
      }),
    ).toBe("145 / 200 required");
  });

  it("avoids multi-timeframe wording when only one snapshot exists", () => {
    const base =
      "Snapshot rows may use the selected full-universe signal for the requested timeframe and latest available full-universe signals for other timeframes.";
    const availabilityNote =
      "Unavailable or planned timeframes are omitted from this snapshot unless the API returns enough detail to explain them.";

    expect(getTimeframeSnapshotTitle(0)).toBe("Timeframe Snapshot");
    expect(getTimeframeSnapshotTitle(1)).toBe("Timeframe Snapshot");
    expect(getTimeframeSnapshotTitle(2)).toBe("Multi-Timeframe Snapshot");
    expect(getTimeframeSnapshotNote([{ timeframe: "4h" }])).toBe(
      `Only 4h snapshot is currently available for this symbol. ${base} ${availabilityNote}`,
    );
    expect(getTimeframeSnapshotNote([{ timeframe: "4h" }, { timeframe: "1d" }])).toBe(
      `${base} ${availabilityNote}`,
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

  it("uses raw timeframe snapshots safely when latest signal is missing", () => {
    const snapshots = getSymbolResearchTimeframeSnapshots({
      requestedTimeframe: "4h",
      latestSignal: null,
      timeframes: [{ id: "raw-4h", timeframe: "4h" }],
    });

    expect(snapshots.map((item) => item.id)).toEqual(["raw-4h"]);
  });

  it("keeps other timeframe rows unchanged when replacing requested timeframe", () => {
    const daily = { id: "daily", timeframe: "1d", rankScore: 50 };
    const snapshots = getSymbolResearchTimeframeSnapshots({
      requestedTimeframe: "4h",
      latestSignal: {
        id: "selected-current",
        timeframe: "4h",
        isSelectedCurrentRun: true,
      },
      timeframes: [
        {
          id: "newer-small-4h",
          timeframe: "4h",
          isNewerThanSelectedCurrentRun: true,
        },
        daily,
      ],
    });

    expect(snapshots).toEqual([
      { id: "selected-current", timeframe: "4h", isSelectedCurrentRun: true },
      daily,
    ]);
  });
});
