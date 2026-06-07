import { describe, expect, it } from "vitest";
import { scannerCodeVersions } from "./codeRegistry";
import { serializeStoredSignalToCodeContract } from "./serializeStoredSignal";

describe("stored scanner signal serializer", () => {
  it("always emits a complete metrics object when stored values are missing", () => {
    const item = serializeStoredSignalToCodeContract({
      id: "signal-1",
      scanRunId: "run-1",
      exchange: "binance",
      market: "spot",
      symbol: "BTCUSDT",
      timeframe: "4h",
      rawMetrics: {
        codeContract: {
          groupCode: "GR_201",
          actionCode: "AC_501",
          setupCode: "TR_601",
          phaseCode: "TR_601",
          signalCodes: ["PX_501"],
          riskCodes: [],
          reasonCodes: [],
          qualityCodes: [],
          ...scannerCodeVersions,
        },
      },
    });

    expect(item.metrics).toEqual({
      score: null,
      rankScore: null,
      riskAdjustedScore: null,
      setupQualityScore: null,
      confidenceScore: null,
      absoluteSetupScore: null,
      universePercentile: null,
      finalSignalScore: null,
      opportunityScore: null,
      confirmationScore: null,
      riskScore: null,
      qualityScore: null,
      trendScore: null,
      momentumScore: null,
      volumeScore: null,
      structureScore: null,
      volatilityScore: null,
      mtfAgreementScore: null,
      riskPenalty: null,
      qualityPenalty: null,
      volumeRank: null,
      historyBars: null,
      volatilityPercentile: null,
      atrExtension: null,
      distanceFromBase: null,
      scoringModelVersion: "quant-factor-v1",
      scoringCalibrationVersion: "deterministic-baseline-1",
      price: null,
      rsi14: null,
      bbPercent: null,
      bbWidthPercentile: null,
      volumeRatio: null,
    });
  });

  it("uses embedded code-contract metrics before legacy physical score columns", () => {
    const item = serializeStoredSignalToCodeContract({
      id: "signal-2",
      scanRunId: "run-2",
      exchange: "binance",
      market: "spot",
      symbol: "ETHUSDT",
      timeframe: "1d",
      rankScore: 11,
      rawMetrics: {
        codeContract: {
          groupCode: "GR_101",
          actionCode: "AC_101",
          setupCode: "ST_201",
          phaseCode: "ST_201",
          signalCodes: ["MO_202"],
          riskCodes: [],
          reasonCodes: [],
          qualityCodes: [],
          metrics: {
            rankScore: 72,
            price: 3210.5,
            historyBars: 400,
          },
          ...scannerCodeVersions,
        },
      },
    });

    expect(item.metrics.rankScore).toBe(72);
    expect(item.metrics.score).toBe(72);
    expect(item.metrics.price).toBe(3210.5);
    expect(item.metrics.historyBars).toBe(400);
  });
});
