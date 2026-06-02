import { describe, expect, it } from "vitest";
import type { ScanResultGroup } from "@/lib/scanner/scanResultGroups";
import {
  buildMarketContextResponse,
  createUnavailableMarketContextProxy,
  type AvailableMarketContextProxy,
  type MarketContextProxyMap,
  type MarketContextTimeframe,
} from "./marketContext";

const generatedAt = "2026-06-01T00:00:00.000Z";

describe("market context classification", () => {
  it("classifies aligned constructive BTC and ETH context as bull trend continuation", () => {
    const response = buildMarketContextResponse({
      assetClass: "crypto",
      generatedAt,
      proxies: makeProxyMap({
        BTCUSDT: {
          "1w": signal({ timeframe: "1w", group: "eligible", rankScore: 92 }),
          "1d": signal({ timeframe: "1d", group: "eligible", rankScore: 84 }),
          "4h": signal({ timeframe: "4h", group: "watch", rankScore: 38 }),
        },
        ETHUSDT: {
          "1w": signal({ timeframe: "1w", group: "eligible", rankScore: 88 }),
          "1d": signal({ timeframe: "1d", group: "eligible", rankScore: 76 }),
          "4h": signal({ timeframe: "4h", group: "watch", rankScore: 26 }),
        },
      }),
    });

    expect(response.context).toMatchObject({
      structuralContext: "long_term_risk_on",
      marketContext: "risk_on",
      tacticalContext: "short_term_repair",
      combinedContext: "bull_trend_continuation",
      confidence: "high",
    });
    expect(response.summary.researchPosture).toBe("constructive");
    expect(getEthKeyPoint(response)).toBe(
      "ETH confirmation: confirms constructive context.",
    );
    expect(response.summary.warnings).toContain(
      "Research-only context. Not a trading signal.",
    );
  });

  it("classifies aligned BTC and ETH risk context as risk-off continuation", () => {
    const response = buildMarketContextResponse({
      assetClass: "crypto",
      generatedAt,
      proxies: makeProxyMap({
        BTCUSDT: {
          "1w": riskSignal("1w"),
          "1d": riskSignal("1d"),
          "4h": riskSignal("4h"),
        },
        ETHUSDT: {
          "1w": riskSignal("1w"),
          "1d": riskSignal("1d"),
          "4h": riskSignal("4h"),
        },
      }),
    });

    expect(response.context).toMatchObject({
      structuralContext: "long_term_risk_off",
      marketContext: "risk_off",
      tacticalContext: "short_term_weakness",
      combinedContext: "risk_off_continuation",
      confidence: "high",
    });
    expect(response.summary.title).toBe("Broad risk-off context");
    expect(response.summary.researchPosture).toBe("defensive");
    expect(getEthKeyPoint(response)).toBe(
      "ETH confirmation: confirms broader risk.",
    );
  });

  it("describes mixed weekly BTC with daily and tactical risk as ETH-confirmed broader risk", () => {
    const response = buildMarketContextResponse({
      assetClass: "crypto",
      generatedAt,
      proxies: makeProxyMap({
        BTCUSDT: {
          "1w": signal({
            timeframe: "1w",
            group: "watch",
            rankScore: -3.5,
            signalLabel: "watch",
            actionBias: "watch_only",
          }),
          "1d": riskSignal("1d"),
          "4h": riskSignal("4h"),
        },
        ETHUSDT: {
          "1w": riskSignal("1w"),
          "1d": riskSignal("1d"),
          "4h": riskSignal("4h"),
        },
      }),
    });

    expect(response.context).toMatchObject({
      structuralContext: "long_term_mixed",
      marketContext: "risk_off",
      tacticalContext: "short_term_weakness",
      combinedContext: "unstable_transition",
      confidence: "medium",
    });
    expect(getEthKeyPoint(response)).toBe(
      "ETH confirmation: confirms broader risk.",
    );
    expect(response.summary.title).toBe("Risk-oriented transition");
    expect(response.summary.description).toBe(
      "BTC daily and tactical contexts are risk-oriented while weekly BTC remains mixed. ETH confirms broader weakness, so short-term repair signals should be interpreted cautiously.",
    );
    expect(response.summary.description).not.toContain("Short-term strength");
    expect(response.summary.description).not.toContain("overextension");
  });

  it("classifies daily repair inside weak weekly structure as bear-market repair", () => {
    const response = buildMarketContextResponse({
      assetClass: "crypto",
      generatedAt,
      proxies: makeProxyMap({
        BTCUSDT: {
          "1w": riskSignal("1w"),
          "1d": signal({ timeframe: "1d", group: "eligible", rankScore: 66 }),
          "4h": signal({ timeframe: "4h", group: "watch", rankScore: 22 }),
        },
        ETHUSDT: {
          "1w": riskSignal("1w"),
          "1d": signal({ timeframe: "1d", group: "eligible", rankScore: 48 }),
          "4h": signal({ timeframe: "4h", group: "watch", rankScore: 18 }),
        },
      }),
    });

    expect(response.context.combinedContext).toBe("bear_market_repair");
    expect(response.summary.researchPosture).toBe("cautious");
    expect(response.summary.warnings).toContain(
      "Weekly context remains weak while shorter timeframes are repairing.",
    );
  });

  it("classifies mixed weekly and daily context as mixed transition", () => {
    const response = buildMarketContextResponse({
      assetClass: "crypto",
      generatedAt,
      proxies: makeProxyMap({
        BTCUSDT: {
          "1w": signal({ timeframe: "1w", group: "neutral", rankScore: -4 }),
          "1d": signal({ timeframe: "1d", group: "watch", rankScore: -1 }),
          "4h": signal({ timeframe: "4h", group: "neutral", rankScore: 0 }),
        },
        ETHUSDT: {
          "1w": signal({ timeframe: "1w", group: "neutral", rankScore: -2 }),
          "1d": signal({ timeframe: "1d", group: "watch", rankScore: -3 }),
          "4h": signal({ timeframe: "4h", group: "neutral", rankScore: 0 }),
        },
      }),
    });

    expect(response.context).toMatchObject({
      structuralContext: "long_term_mixed",
      marketContext: "mixed",
      tacticalContext: "short_term_mixed",
      combinedContext: "mixed_transition",
    });
    expect(response.summary.title).toBe("Mixed transition");
  });

  it("classifies overextended short-term context inside weak higher timeframes as unstable", () => {
    const response = buildMarketContextResponse({
      assetClass: "crypto",
      generatedAt,
      proxies: makeProxyMap({
        BTCUSDT: {
          "1w": riskSignal("1w"),
          "1d": signal({ timeframe: "1d", group: "watch", rankScore: -8 }),
          "4h": signal({ timeframe: "4h", group: "overheated", rankScore: 95 }),
        },
        ETHUSDT: {
          "1w": riskSignal("1w"),
          "1d": signal({ timeframe: "1d", group: "watch", rankScore: -4 }),
          "4h": signal({ timeframe: "4h", group: "overheated", rankScore: 82 }),
        },
      }),
    });

    expect(response.context.combinedContext).toBe("unstable_transition");
    expect(response.context.tacticalContext).toBe("short_term_overextended");
    expect(response.summary.warnings).toContain(
      "Short-term context is overextended inside weak higher-timeframe structure.",
    );
  });

  it("returns insufficient data when major BTC proxy data is unavailable", () => {
    const response = buildMarketContextResponse({
      assetClass: "crypto",
      generatedAt,
      proxies: makeProxyMap({
        BTCUSDT: {
          "1w": createUnavailableMarketContextProxy("1w", "no_latest_signal"),
          "1d": signal({ timeframe: "1d", group: "eligible", rankScore: 80 }),
          "4h": signal({ timeframe: "4h", group: "eligible", rankScore: 40 }),
        },
        ETHUSDT: {
          "1w": signal({ timeframe: "1w", group: "eligible", rankScore: 78 }),
          "1d": signal({ timeframe: "1d", group: "eligible", rankScore: 74 }),
          "4h": signal({ timeframe: "4h", group: "eligible", rankScore: 42 }),
        },
      }),
    });

    expect(response.context.combinedContext).toBe("insufficient_data");
    expect(response.context.confidence).toBe("low");
    expect(response.summary.warnings).toContain(
      "Some proxy timeframe data is unavailable.",
    );
  });

  it("keeps BTC primary while lowering confidence when ETH diverges", () => {
    const response = buildMarketContextResponse({
      assetClass: "crypto",
      generatedAt,
      proxies: makeProxyMap({
        BTCUSDT: {
          "1w": riskSignal("1w"),
          "1d": riskSignal("1d"),
          "4h": riskSignal("4h"),
        },
        ETHUSDT: {
          "1w": signal({ timeframe: "1w", group: "eligible", rankScore: 88 }),
          "1d": signal({ timeframe: "1d", group: "eligible", rankScore: 76 }),
          "4h": signal({ timeframe: "4h", group: "eligible", rankScore: 42 }),
        },
      }),
    });

    expect(response.context.combinedContext).toBe("risk_off_continuation");
    expect(response.context.confidence).toBe("low");
    expect(getEthKeyPoint(response)).toBe("ETH confirmation: diverges from BTC.");
    expect(response.summary.warnings).toContain("BTC and ETH context diverge.");
  });

  it("labels ETH as mixed versus BTC when BTC is risk-oriented and ETH is not broadly aligned", () => {
    const response = buildMarketContextResponse({
      assetClass: "crypto",
      generatedAt,
      proxies: makeProxyMap({
        BTCUSDT: {
          "1w": riskSignal("1w"),
          "1d": riskSignal("1d"),
          "4h": riskSignal("4h"),
        },
        ETHUSDT: {
          "1w": signal({ timeframe: "1w", group: "neutral", rankScore: -2 }),
          "1d": signal({ timeframe: "1d", group: "watch", rankScore: -3 }),
          "4h": riskSignal("4h"),
        },
      }),
    });

    expect(response.context.combinedContext).toBe("risk_off_continuation");
    expect(getEthKeyPoint(response)).toBe("ETH confirmation: mixed versus BTC.");
    expect(response.summary.warnings).toContain(
      "ETH confirmation is mixed versus BTC.",
    );
  });

  it("labels missing ETH data as insufficient and does not raise confidence to high", () => {
    const response = buildMarketContextResponse({
      assetClass: "crypto",
      generatedAt,
      proxies: makeProxyMap({
        BTCUSDT: {
          "1w": signal({ timeframe: "1w", group: "eligible", rankScore: 92 }),
          "1d": signal({ timeframe: "1d", group: "eligible", rankScore: 84 }),
          "4h": signal({ timeframe: "4h", group: "watch", rankScore: 38 }),
        },
        ETHUSDT: {
          "1w": createUnavailableMarketContextProxy("1w", "missing_symbol"),
          "1d": createUnavailableMarketContextProxy("1d", "missing_symbol"),
          "4h": createUnavailableMarketContextProxy("4h", "missing_symbol"),
        },
      }),
    });

    expect(response.context.combinedContext).toBe("bull_trend_continuation");
    expect(response.context.confidence).toBe("medium");
    expect(getEthKeyPoint(response)).toBe("ETH confirmation: data insufficient.");
    expect(response.summary.warnings).toContain(
      "ETH confirmation data is insufficient.",
    );
  });
});

function getEthKeyPoint(response: ReturnType<typeof buildMarketContextResponse>) {
  return response.summary.keyPoints.find((point) =>
    point.startsWith("ETH confirmation:"),
  );
}

function makeProxyMap(
  overrides: Partial<
    Record<
      keyof MarketContextProxyMap,
      Partial<Record<MarketContextTimeframe, MarketContextProxyMap["BTCUSDT"]["1w"]>>
    >
  >,
): MarketContextProxyMap {
  return {
    BTCUSDT: {
      "1w":
        overrides.BTCUSDT?.["1w"] ??
        createUnavailableMarketContextProxy("1w", "insufficient_data"),
      "1d":
        overrides.BTCUSDT?.["1d"] ??
        createUnavailableMarketContextProxy("1d", "insufficient_data"),
      "4h":
        overrides.BTCUSDT?.["4h"] ??
        createUnavailableMarketContextProxy("4h", "insufficient_data"),
    },
    ETHUSDT: {
      "1w":
        overrides.ETHUSDT?.["1w"] ??
        createUnavailableMarketContextProxy("1w", "insufficient_data"),
      "1d":
        overrides.ETHUSDT?.["1d"] ??
        createUnavailableMarketContextProxy("1d", "insufficient_data"),
      "4h":
        overrides.ETHUSDT?.["4h"] ??
        createUnavailableMarketContextProxy("4h", "insufficient_data"),
    },
  };
}

function riskSignal(timeframe: MarketContextTimeframe) {
  return signal({
    timeframe,
    group: "risk",
    rankScore: -92,
    signalLabel: "breakdown_risk",
    actionBias: "avoid",
    primaryStructure: "trend_breakdown",
    detectedRiskTypes: ["trend_breakdown_risk"],
  });
}

function signal({
  timeframe,
  group,
  rankScore,
  signalLabel = "confirmed",
  actionBias = "eligible",
  primaryStructure = "strong_trend",
  detectedRiskTypes = [],
}: {
  timeframe: MarketContextTimeframe;
  group: ScanResultGroup;
  rankScore: number | null;
  signalLabel?: string | null;
  actionBias?: string | null;
  primaryStructure?: string | null;
  detectedRiskTypes?: string[];
}): AvailableMarketContextProxy {
  return {
    available: true,
    timeframe,
    group,
    signalLabel,
    rankScore,
    actionBias,
    primaryStructure,
    detectedRiskTypes,
    statusNote: "Manual review",
    cautionLevel: "none",
    scanTime: "2026-05-31T00:00:01.000Z",
    candleOpenTime: "2026-05-30T20:00:00.000Z",
    runContext: "selected_full_universe",
  };
}
