import { describe, expect, it } from "vitest";
import {
  buildObservationSummary,
  classifyObservationCoverage,
  type ObservationSummaryRow,
} from "./historyObservationSummary";

describe("historyObservationSummary", () => {
  it("calculates overall metrics from complete rows only", () => {
    const summary = buildObservationSummary({
      rows: [
        makeRow({
          symbol: "AAAUSDT",
          group: "eligible",
          dataStatus: "complete",
          observedChangePct: 6,
          maxDrawdownPct: -4,
        }),
        makeRow({
          symbol: "BBBUSDT",
          group: "eligible",
          dataStatus: "complete",
          observedChangePct: 2,
          maxDrawdownPct: -2,
        }),
        makeRow({
          symbol: "CCCUSDT",
          group: "risk",
          dataStatus: "complete",
          observedChangePct: -4,
          maxDrawdownPct: -8,
        }),
        makeRow({
          symbol: "PARTIALUSDT",
          group: "risk",
          dataStatus: "partial",
          observedChangePct: 100,
          maxDrawdownPct: -50,
        }),
        makeRow({
          symbol: "MISSINGUSDT",
          group: "watch",
          dataStatus: "missing",
          observedChangePct: -100,
          maxDrawdownPct: -90,
        }),
      ],
    });

    expect(summary.totalRows).toBe(5);
    expect(summary.completeCount).toBe(3);
    expect(summary.partialCount).toBe(1);
    expect(summary.missingCount).toBe(1);
    expect(summary.medianObservedChangePct).toBe(2);
    expect(summary.averageObservedChangePct).toBeCloseTo(1.3333, 4);
    expect(summary.medianMaxDrawdownPct).toBe(-4);
  });

  it("classifies observation coverage without confidence language", () => {
    expect(
      classifyObservationCoverage({ completeCount: 8, totalRows: 10 }),
    ).toBe("Strong");
    expect(
      classifyObservationCoverage({ completeCount: 4, totalRows: 10 }),
    ).toBe("Mixed");
    expect(
      classifyObservationCoverage({ completeCount: 3, totalRows: 10 }),
    ).toBe("Limited");
    expect(
      classifyObservationCoverage({ completeCount: 0, totalRows: 0 }),
    ).toBe("Limited");
  });

  it("groups distribution metrics by scanner group", () => {
    const summary = buildObservationSummary({
      rows: [
        makeRow({
          symbol: "ELIGIBLEA",
          group: "eligible",
          dataStatus: "complete",
          observedChangePct: 8,
          maxDrawdownPct: -1,
        }),
        makeRow({
          symbol: "ELIGIBLEB",
          group: "eligible",
          dataStatus: "partial",
          observedChangePct: 80,
          maxDrawdownPct: -80,
        }),
        makeRow({
          symbol: "RISK A",
          group: "risk",
          dataStatus: "complete",
          observedChangePct: -6,
          maxDrawdownPct: -9,
        }),
        makeRow({
          symbol: "RISK B",
          group: "risk",
          dataStatus: "complete",
          observedChangePct: -2,
          maxDrawdownPct: -5,
        }),
        makeRow({
          symbol: "UNKNOWN",
          group: null,
          dataStatus: "missing",
          observedChangePct: 100,
          maxDrawdownPct: -100,
        }),
      ],
    });

    expect(summary.groups).toEqual([
      expect.objectContaining({
        groupLabel: "Eligible",
        rows: 2,
        complete: 1,
        partial: 1,
        missing: 0,
        medianObservedChangePct: 8,
        averageObservedChangePct: 8,
        medianMaxDrawdownPct: -1,
      }),
      expect.objectContaining({
        groupLabel: "Risk",
        rows: 2,
        complete: 2,
        partial: 0,
        missing: 0,
        medianObservedChangePct: -4,
        averageObservedChangePct: -4,
        medianMaxDrawdownPct: -7,
      }),
      expect.objectContaining({
        groupLabel: "Unknown",
        rows: 1,
        complete: 0,
        partial: 0,
        missing: 1,
        medianObservedChangePct: null,
        averageObservedChangePct: null,
        medianMaxDrawdownPct: null,
      }),
    ]);
  });

  it("builds notable examples from complete rows only", () => {
    const summary = buildObservationSummary({
      rows: [
        makeRow({
          symbol: "BIGUP",
          group: "watch",
          dataStatus: "complete",
          observedChangePct: 20,
          maxDrawdownPct: -3,
        }),
        makeRow({
          symbol: "SMALLUP",
          group: "eligible",
          dataStatus: "complete",
          observedChangePct: 5,
          maxDrawdownPct: -2,
        }),
        makeRow({
          symbol: "BIGDOWN",
          group: "risk",
          dataStatus: "complete",
          observedChangePct: -12,
          maxDrawdownPct: -18,
        }),
        makeRow({
          symbol: "PARTIALUP",
          group: "eligible",
          dataStatus: "partial",
          observedChangePct: 100,
          maxDrawdownPct: -100,
        }),
        makeRow({
          symbol: "MISSINGDOWN",
          group: "risk",
          dataStatus: "missing",
          observedChangePct: -100,
          maxDrawdownPct: -100,
        }),
      ],
    });

    expect(
      summary.notable.largestPositiveObservedChanges.map((row) => row.symbol),
    ).toEqual(["BIGUP", "SMALLUP"]);
    expect(
      summary.notable.largestNegativeObservedChanges.map((row) => row.symbol),
    ).toEqual(["BIGDOWN"]);
    expect(summary.notable.largestObservedDrawdowns.map((row) => row.symbol)).toEqual([
      "BIGDOWN",
      "BIGUP",
      "SMALLUP",
    ]);
  });

  it("returns safe empty metrics when no complete rows exist", () => {
    const summary = buildObservationSummary({
      rows: [
        makeRow({
          symbol: "PARTIAL",
          group: "watch",
          dataStatus: "partial",
          observedChangePct: 10,
          maxDrawdownPct: -10,
        }),
        makeRow({
          symbol: "MISSING",
          group: "risk",
          dataStatus: "missing",
          observedChangePct: -10,
          maxDrawdownPct: -10,
        }),
      ],
    });

    expect(summary.medianObservedChangePct).toBeNull();
    expect(summary.averageObservedChangePct).toBeNull();
    expect(summary.medianMaxDrawdownPct).toBeNull();
    expect(summary.hasPartialOnlyCoverage).toBe(true);
    expect(summary.notable.largestPositiveObservedChanges).toEqual([]);
    expect(summary.notable.largestNegativeObservedChanges).toEqual([]);
    expect(summary.notable.largestObservedDrawdowns).toEqual([]);
  });
});

function makeRow(
  overrides: Partial<ObservationSummaryRow> & {
    symbol: string;
    dataStatus: ObservationSummaryRow["dataStatus"];
  },
): ObservationSummaryRow {
  return {
    symbol: overrides.symbol,
    group: "group" in overrides ? overrides.group : "neutral",
    observedChangePct: overrides.observedChangePct ?? 0,
    maxDrawdownPct: overrides.maxDrawdownPct ?? 0,
    dataStatus: overrides.dataStatus,
  };
}
