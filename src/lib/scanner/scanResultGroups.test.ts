import { describe, expect, it } from "vitest";
import {
  classifyScanResultGroup,
  compareScanResultGroupItems,
  getScanResultReview,
  summarizeScanResultGroups,
} from "./scanResultGroups";

describe("scan result grouping", () => {
  it("classifies risk before otherwise high-scoring opportunity labels", () => {
    expect(
      classifyScanResultGroup({
        actionBias: "eligible",
        signalLabel: "confirmed",
        primaryStructure: "trend_breakdown",
        rankScore: 80,
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
    expect(
      classifyScanResultGroup({
        actionBias: "eligible",
        signalLabel: "confirmed",
        primaryStructure: "strong_trend",
        rankScore: 50,
      }),
    ).toBe("eligible");
    expect(classifyScanResultGroup({ signalLabel: "watch" })).toBe("watch");
    expect(classifyScanResultGroup({ actionBias: "avoid" })).toBe("risk");
    expect(classifyScanResultGroup({ actionBias: "ignore" })).toBe("neutral");
  });

  it("keeps neutral setups out of eligible even with confirmed labels", () => {
    expect(
      classifyScanResultGroup({
        actionBias: "eligible",
        signalLabel: "confirmed",
        primaryStructure: "neutral",
        rankScore: 80,
      }),
    ).toBe("watch");
  });

  it("keeps severe risks ahead of overheated and eligible states", () => {
    expect(
      classifyScanResultGroup({
        actionBias: "do_not_chase",
        signalLabel: "distribution_risk",
        primaryStructure: "overextended",
        rankScore: 120,
      }),
    ).toBe("risk");
    expect(
      classifyScanResultGroup({
        actionBias: "eligible",
        signalLabel: "confirmed",
        primaryStructure: "strong_trend",
        detectedRiskTypes: ["trend_breakdown_risk"],
        rankScore: 80,
      }),
    ).toBe("risk");
  });

  it("keeps detected-risk eligible rows in watch when the risk is not severe", () => {
    const signal = {
      actionBias: "eligible",
      signalLabel: "confirmed",
      primaryStructure: "strong_trend",
      detectedRiskTypes: ["overheat_risk"],
      rankScore: 80,
    };

    expect(classifyScanResultGroup(signal)).toBe("watch");
    expect(getScanResultReview(signal)).toMatchObject({
      reviewTier: "watch_caution",
      statusNote: "Caution",
      cautionLevel: "caution",
    });
  });

  it("keeps negative-rank watch rows deterministic and lower priority", () => {
    const negativeWatch = {
      actionBias: "watch_only",
      signalLabel: "watch",
      primaryStructure: "neutral",
      rankScore: -10,
    };

    expect(classifyScanResultGroup(negativeWatch)).toBe("watch");
    expect(getScanResultReview(negativeWatch)).toMatchObject({
      reviewTier: "watch_low",
      statusNote: "Low priority",
    });

    const sorted = [
      { symbol: "LOWUSDT", resultGroup: "watch" as const, rankScore: -10 },
      { symbol: "HIGHUSDT", resultGroup: "watch" as const, rankScore: 12 },
      { symbol: "TIEUSDT", resultGroup: "watch" as const, rankScore: -10 },
    ].sort(compareScanResultGroupItems);

    expect(sorted.map((item) => item.symbol)).toEqual([
      "HIGHUSDT",
      "LOWUSDT",
      "TIEUSDT",
    ]);
  });

  it("assigns high watch status to positive clean watch rows", () => {
    expect(
      getScanResultReview({
        actionBias: "watch_only",
        signalLabel: "watch",
        primaryStructure: "breakout_attempt",
        rankScore: 40,
      }),
    ).toMatchObject({
      reviewTier: "watch_high",
      statusNote: "Needs confirmation",
      cautionLevel: "none",
    });
  });

  it("sorts watch rows by clean positive, caution, and negative priority", () => {
    const sorted = [
      {
        symbol: "NEGUSDT",
        resultGroup: "watch" as const,
        primaryStructure: "healthy_pullback",
        rankScore: -5,
        riskScore: 0,
      },
      {
        symbol: "CAUTIONUSDT",
        resultGroup: "watch" as const,
        primaryStructure: "strong_trend",
        rankScore: 90,
        riskScore: 20,
        detectedRiskTypes: ["overheat_risk"],
      },
      {
        symbol: "CLEANLOWRISKUSDT",
        resultGroup: "watch" as const,
        primaryStructure: "breakout_attempt",
        rankScore: 31,
        riskScore: 5,
      },
      {
        symbol: "CLEANHIGHRISKUSDT",
        resultGroup: "watch" as const,
        primaryStructure: "breakout_attempt",
        rankScore: 33,
        riskScore: 25,
      },
    ].sort(compareScanResultGroupItems);

    expect(sorted.map((item) => item.symbol)).toEqual([
      "CLEANLOWRISKUSDT",
      "CLEANHIGHRISKUSDT",
      "CAUTIONUSDT",
      "NEGUSDT",
    ]);
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
        {
          signalLabel: "confirmed",
          actionBias: "eligible",
          primaryStructure: "strong_trend",
          rankScore: 80,
        },
        {
          signalLabel: "trend",
          actionBias: "eligible",
          primaryStructure: "healthy_pullback",
          rankScore: 60,
        },
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
