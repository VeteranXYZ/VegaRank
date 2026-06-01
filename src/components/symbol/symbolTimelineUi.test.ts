import { describe, expect, it } from "vitest";
import {
  formatTimelineDate,
  formatTimelineScore,
  getCompactSignalHistory,
  getTimelineGroupLabel,
  getTimelineRiskText,
  normalizeSignalHistory,
} from "./symbolTimelineUi";

describe("symbol timeline UI helpers", () => {
  it("normalizes empty history safely", () => {
    expect(normalizeSignalHistory([])).toEqual([]);
    expect(normalizeSignalHistory(null)).toEqual([]);
  });

  it("formats invalid dates without crashing", () => {
    expect(formatTimelineDate("not-a-date")).toBe("Not available");
    expect(formatTimelineDate(null)).toBe("Not available");
  });

  it("sorts by scanTime descending without mutating the source array", () => {
    const history = [
      {
        id: "older",
        scanTime: "2026-05-30T00:00:00.000Z",
        candleOpenTime: "2026-05-29T20:00:00.000Z",
      },
      {
        id: "newer",
        scanTime: "2026-05-31T00:00:00.000Z",
        candleOpenTime: "2026-05-30T20:00:00.000Z",
      },
    ];

    expect(normalizeSignalHistory(history).map((item) => item.key)).toEqual([
      "newer",
      "older",
    ]);
    expect(history.map((item) => item.id)).toEqual(["older", "newer"]);
  });

  it("formats missing scores safely", () => {
    expect(formatTimelineScore(null)).toBe("-");
    expect(formatTimelineScore(undefined)).toBe("-");
    expect(formatTimelineScore(Number.NaN)).toBe("-");
    expect(formatTimelineScore(72.24)).toBe("72.2");
  });

  it("formats risk types readably", () => {
    expect(getTimelineRiskText(["weak_bounce_risk", "failed_breakout_risk"])).toBe(
      "Weak Bounce Risk, Failed Breakout Risk",
    );
    expect(getTimelineRiskText([{ risk: true }])).toBe("No specific risk types noted.");
  });

  it("uses a safe group label fallback", () => {
    expect(getTimelineGroupLabel("eligible")).toBe("Eligible");
    expect(getTimelineGroupLabel("unknown_group")).toBe("Neutral");
  });

  it("carries current-run context into normalized rows", () => {
    expect(
      normalizeSignalHistory([
        {
          id: "newer-limited",
          scanTime: "2026-05-31T20:05:00.000Z",
          isNewerThanSelectedCurrentRun: true,
          sourceRunIsLikelyFullUniverse: false,
        },
      ])[0]?.runContextText,
    ).toBe("Newer non-preferred run");
  });

  it("keeps selected current run in compact history even when it is not newest", () => {
    const normalized = normalizeSignalHistory([
      makeHistoryRow("newest", "2026-05-31T20:00:00.000Z", "eligible"),
      makeHistoryRow("middle", "2026-05-31T16:00:00.000Z", "watch"),
      makeHistoryRow("selected", "2026-05-31T12:00:00.000Z", "risk", {
        isSelectedCurrentRun: true,
        sourceRunIsLikelyFullUniverse: true,
      }),
      makeHistoryRow("oldest", "2026-05-31T08:00:00.000Z", "neutral"),
    ]);

    const compact = getCompactSignalHistory(normalized, 2);

    expect(compact.items.map((item) => item.key)).toEqual(["newest", "selected"]);
    expect(compact.hiddenCount).toBe(2);
  });

  it("marks newer non-preferred rows as secondary", () => {
    const [item] = normalizeSignalHistory([
      makeHistoryRow("newer-limited", "2026-05-31T20:00:00.000Z", "eligible", {
        isNewerThanSelectedCurrentRun: true,
        sourceRunIsLikelyFullUniverse: false,
      }),
    ]);

    expect(item?.isSecondaryRun).toBe(true);
    expect(item?.timelineTone).toBe("secondary");
  });

  it("deduplicates obvious duplicate rows during history normalization", () => {
    const normalized = normalizeSignalHistory([
      makeHistoryRow("duplicate-a", "2026-05-31T20:00:00.000Z", "eligible", {
        scanRunId: "run-1",
        symbol: "SEIUSDT",
        timeframe: "4h",
        signalLabel: "confirmed",
        rankScore: 82,
      }),
      makeHistoryRow("duplicate-b", "2026-05-31T20:00:00.000Z", "eligible", {
        scanRunId: "run-1",
        symbol: "SEIUSDT",
        timeframe: "4h",
        signalLabel: "confirmed",
        rankScore: 82,
      }),
    ]);

    expect(normalized.map((item) => item.key)).toEqual(["duplicate-a"]);
  });

  it("keeps newest non-preferred row visible and reports hidden count after dedupe", () => {
    const normalized = normalizeSignalHistory([
      makeHistoryRow("newer-limited", "2026-05-31T20:00:00.000Z", "eligible", {
        scanRunId: "limited-run",
        symbol: "SEIUSDT",
        timeframe: "4h",
        signalLabel: "confirmed",
        rankScore: 90,
        isNewerThanSelectedCurrentRun: true,
        sourceRunIsLikelyFullUniverse: false,
      }),
      makeHistoryRow("duplicate-limited", "2026-05-31T20:00:00.000Z", "eligible", {
        scanRunId: "limited-run",
        symbol: "SEIUSDT",
        timeframe: "4h",
        signalLabel: "confirmed",
        rankScore: 90,
        isNewerThanSelectedCurrentRun: true,
        sourceRunIsLikelyFullUniverse: false,
      }),
      makeHistoryRow("selected", "2026-05-31T12:00:00.000Z", "risk", {
        isSelectedCurrentRun: true,
        sourceRunIsLikelyFullUniverse: true,
      }),
      makeHistoryRow("old", "2026-05-30T12:00:00.000Z", "neutral"),
    ]);

    const compact = getCompactSignalHistory(normalized, 2);

    expect(compact.items.map((item) => item.key)).toEqual([
      "newer-limited",
      "selected",
    ]);
    expect(compact.totalCount).toBe(3);
    expect(compact.hiddenCount).toBe(1);
  });
});

function makeHistoryRow(
  id: string,
  scanTime: string,
  resultGroup: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    scanTime,
    resultGroup,
    ...overrides,
  };
}
