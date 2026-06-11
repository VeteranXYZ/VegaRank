import { describe, expect, it } from "vitest";
import type { Candle } from "@/lib/exchanges/types";
import type { ScanEvaluationNote } from "@/lib/shared/rankingTypes";
import {
  evaluateSignalForward,
  getSignalPerformanceByLabel,
  summarizeForwardEvaluations,
} from "./scanEvaluation";
import type { ScanSignalRecord } from "./scanSignalModel";

describe("scan signal forward evaluation", () => {
  it("calculates return, max return, max drawdown, and outcome with enough candles", () => {
    const signal = makeSignal({ signalLabel: "confirmed", priceAtSignal: 100 });
    const evaluation = evaluateSignalForward({
      signal,
      horizon: "4h",
      candles: [
        makeCandle({ closeTime: Date.parse("2026-05-25T01:00:00.000Z"), close: 101, high: 103, low: 99 }),
        makeCandle({ closeTime: Date.parse("2026-05-25T04:00:00.000Z"), close: 105, high: 107, low: 98 }),
      ],
    });

    expect(evaluation.priceAtEvaluation).toBe(105);
    expect(evaluation.returnPct).toBe(5);
    expect(evaluation.maxReturnPct).toBeCloseTo(7, 6);
    expect(evaluation.maxDrawdownPct).toBe(-2);
    expect(evaluation.outcomeLabel).toBe("favorable");
    expect(parseNotes(evaluation.notesJson)).toEqual([
      {
        key: "evaluation.opportunityOutcomeVerified",
        params: { outcome: "favorable" },
      },
    ]);
  });

  it("marks insufficient_data when future candles do not cover the horizon", () => {
    const evaluation = evaluateSignalForward({
      signal: makeSignal({ signalLabel: "watch", priceAtSignal: 100 }),
      horizon: "24h",
      candles: [
        makeCandle({ closeTime: Date.parse("2026-05-25T04:00:00.000Z"), close: 102 }),
      ],
    });

    expect(evaluation.outcomeLabel).toBe("insufficient_data");
    expect(evaluation.returnPct).toBeNull();
    expect(parseNotes(evaluation.notesJson)).toEqual([
      { key: "evaluation.insufficientFutureCandles" },
    ]);
  });

  it("treats distribution_risk followed by pullback as favorable risk validation", () => {
    const evaluation = evaluateSignalForward({
      signal: makeSignal({ signalLabel: "distribution_risk", priceAtSignal: 100 }),
      horizon: "4h",
      candles: [
        makeCandle({ closeTime: Date.parse("2026-05-25T04:00:00.000Z"), close: 96, high: 101, low: 94 }),
      ],
    });

    expect(evaluation.returnPct).toBe(-4);
    expect(evaluation.maxDrawdownPct).toBe(-6);
    expect(evaluation.outcomeLabel).toBe("favorable");
    expect(parseNotes(evaluation.notesJson)).toEqual([
      {
        key: "evaluation.riskOutcomeVerified",
        params: { outcome: "favorable" },
      },
    ]);
  });

  it("keeps generated storage notes free of Chinese display text", () => {
    const source = [
      evaluateSignalForward({
        signal: makeSignal({ signalLabel: "watch", priceAtSignal: 100 }),
        horizon: "24h",
        candles: [
          makeCandle({
            closeTime: Date.parse("2026-05-25T04:00:00.000Z"),
            close: 102,
          }),
        ],
      }).notesJson,
      evaluateSignalForward({
        signal: makeSignal({ signalLabel: "confirmed", priceAtSignal: 100 }),
        horizon: "4h",
        candles: [
          makeCandle({
            closeTime: Date.parse("2026-05-25T04:00:00.000Z"),
            close: 105,
            high: 107,
            low: 98,
          }),
        ],
      }).notesJson,
    ].join("\n");

    expect(source).not.toMatch(/\p{Script=Han}/u);
  });

  it("aggregates performance by signalLabel", () => {
    const confirmed = makeSignal({ id: "confirmed", signalLabel: "confirmed" });
    const watch = makeSignal({ id: "watch", signalLabel: "watch" });
    const evaluations = [
      {
        ...baseEvaluation({ signalId: confirmed.id, outcomeLabel: "favorable" }),
        returnPct: 5,
        maxDrawdownPct: -2,
      },
      {
        ...baseEvaluation({ signalId: confirmed.id, outcomeLabel: "unfavorable" }),
        returnPct: -3,
        maxDrawdownPct: -6,
      },
      {
        ...baseEvaluation({ signalId: watch.id, outcomeLabel: "insufficient_data" }),
        returnPct: null,
        maxDrawdownPct: null,
      },
    ];

    const byLabel = getSignalPerformanceByLabel(evaluations, [confirmed, watch]);
    const summary = summarizeForwardEvaluations(evaluations, [confirmed, watch]);

    expect(byLabel.confirmed).toMatchObject({
      count: 2,
      completedCount: 2,
      avgReturnPct: 1,
      avgMaxDrawdownPct: -4,
      favorableRate: 0.5,
      unfavorableRate: 0.5,
    });
    expect(summary.completedCount).toBe(2);
    expect(summary.pendingCount).toBe(1);
  });
});

function parseNotes(notesJson: string) {
  return JSON.parse(notesJson) as ScanEvaluationNote[];
}

function makeSignal(overrides: Partial<ScanSignalRecord> = {}): ScanSignalRecord {
  return {
    id: "signal",
    snapshotId: "snapshot",
    symbol: "BTCUSDT",
    timeframe: "4h",
    scanTime: "2026-05-25T00:00:00.000Z",
    priceAtSignal: 100,
    scoringVersion: "explainable-v1",
    finalSignalScore: 50,
    opportunityScore: 70,
    confirmationScore: 70,
    riskScore: 20,
    trendScore: 100,
    momentumScore: 45,
    volumeScore: 20,
    structureScore: 80,
    signalLabel: "confirmed",
    actionBias: "eligible",
    primaryStructure: "strong_trend",
    secondaryStructuresJson: "[]",
    detectedRiskTypesJson: "[]",
    bullishObservationsJson: "[]",
    bearishObservationsJson: "[]",
    riskObservationsJson: "[]",
    neutralObservationsJson: "[]",
    nextConfirmationObservationsJson: "[]",
    invalidationObservationsJson: "[]",
    rawMetricsJson: "{}",
    legacySignal: "CONFIRMED",
    legacyRankScore: 50,
    legacyWarningsJson: "[]",
    ...overrides,
  };
}

function makeCandle({
  closeTime,
  close,
  high = close,
  low = close,
}: {
  closeTime: number;
  close: number;
  high?: number;
  low?: number;
}): Candle {
  return {
    openTime: closeTime - 1,
    open: close,
    high,
    low,
    close,
    volume: 1000,
    closeTime,
  };
}

function baseEvaluation({
  signalId,
  outcomeLabel,
}: {
  signalId: string;
  outcomeLabel: "favorable" | "unfavorable" | "insufficient_data";
}) {
  return {
    id: `${signalId}:24h`,
    signalId,
    symbol: "BTCUSDT",
    timeframe: "4h" as const,
    signalTime: "2026-05-25T00:00:00.000Z",
    evaluationTime: "2026-05-26T00:00:00.000Z",
    horizon: "24h" as const,
    priceAtSignal: 100,
    priceAtEvaluation: 100,
    returnPct: 0,
    maxReturnPct: 0,
    maxDrawdownPct: 0,
    stillAboveMA20: true,
    stillAboveMA50: true,
    stillAboveMA200: true,
    rsiAtEvaluation: 55,
    riskScoreAtEvaluation: 20,
    confirmationScoreAtEvaluation: 80,
    signalLabelAtEvaluation: "confirmed" as const,
    actionBiasAtEvaluation: "eligible" as const,
    outcomeLabel,
    notesJson: "[]",
    metricsJson: "{}",
  };
}
