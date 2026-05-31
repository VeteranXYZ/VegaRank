import { describe, expect, it } from "vitest";
import {
  classifyScanResultGroup,
  compareScanResultGroupItems,
  summarizeScanResultGroups,
} from "./scanResultGroups";

describe("scan result grouping", () => {
  it("classifies risk before otherwise high-scoring opportunity labels", () => {
    expect(
      classifyScanResultGroup({
        actionBias: "eligible",
        signalLabel: "confirmed",
        primaryStructure: "trend_breakdown",
      }),
    ).toBe("risk");
    expect(
      classifyScanResultGroup({
        actionBias: "do_not_chase",
        signalLabel: "trend",
        primaryStructure: "overextended",
      }),
    ).toBe("overheated");
  });

  it("groups eligible, watch, risk, and neutral signals", () => {
    expect(classifyScanResultGroup({ actionBias: "eligible" })).toBe("eligible");
    expect(classifyScanResultGroup({ signalLabel: "watch" })).toBe("watch");
    expect(classifyScanResultGroup({ actionBias: "avoid" })).toBe("risk");
    expect(classifyScanResultGroup({ actionBias: "ignore" })).toBe("neutral");
  });

  it("sorts by display group before rank score", () => {
    const sorted = [
      { symbol: "RISKUSDT", resultGroup: "risk" as const, rankScore: 200 },
      { symbol: "WATCHUSDT", resultGroup: "watch" as const, rankScore: 40 },
      { symbol: "BUYUSDT", resultGroup: "eligible" as const, rankScore: 80 },
    ].sort(compareScanResultGroupItems);

    expect(sorted.map((item) => item.symbol)).toEqual([
      "BUYUSDT",
      "WATCHUSDT",
      "RISKUSDT",
    ]);
  });

  it("summarizes both semantic groups and raw labels", () => {
    expect(
      summarizeScanResultGroups([
        { signalLabel: "confirmed", actionBias: "eligible" },
        { signalLabel: "trend", actionBias: "eligible" },
        { signalLabel: "breakdown_risk", actionBias: "avoid" },
      ]),
    ).toMatchObject({
      totalSignals: 3,
      eligible: 2,
      risk: 1,
      confirmed: 1,
      trend: 1,
      breakdownRisk: 1,
      avoid: 1,
      eligibleSignals: 2,
    });
  });
});
