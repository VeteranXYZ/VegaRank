import type { MarketContextResponse } from "@/components/market-context/marketContextUi";
import type { RawSymbolChartCandle } from "./symbolChartUi";
import type {
  SignalEvaluationResponse,
  SignalEvaluationHorizonStats,
} from "./symbolResearchUi";
import type {
  SymbolResearchSignal,
  SymbolResearchSuccessResponse,
  SymbolResearchVisualCheckData,
} from "./SymbolResearchPageClient";
import {
  actionCodeByBias,
  groupCodeByResultGroup,
  riskCodeByType,
  scannerCodeVersions,
  setupCodeByAliasOrStructure,
  signalCodeByLabel,
} from "@/lib/vegarank-codebook/codeRegistry";

const scanFinishedAt = "2026-06-04T16:00:00.000Z";
const scanStartedAt = "2026-06-04T15:58:00.000Z";
const scanTime = "2026-06-04T15:59:20.000Z";

export function buildSymbolResearchVisualCheckData(): SymbolResearchVisualCheckData {
  const candles = buildPreviewCandles();
  const signalCandle = candles[candles.length - 4];
  const latestSignal = buildPreviewSignal({
    id: "visual-btc-4h-current",
    timeframe: "4h",
    candleOpenTime: String(signalCandle.openTime),
    scanTime,
    priceAtSignal: Number(signalCandle.close),
    resultGroup: "eligible",
    actionBias: "eligible",
    signalLabel: "confirmed",
    primaryStructure: "trend_continuation",
    statusNote: "Manual review",
    rankScore: 88.2,
    finalSignalScore: 83.4,
    opportunityScore: 86.1,
    confirmationScore: 82.6,
    riskScore: 18.3,
    trendScore: 91.4,
    momentumScore: 77.8,
    volumeScore: 68.5,
    structureScore: 89.7,
    detectedRiskTypes: ["overheat_risk", "liquidity_spike_risk"],
    statusReasons: [
      "Price reclaimed the 20-period moving average after a controlled pullback.",
      "Higher-timeframe context remains constructive.",
      "Risk score is contained relative to rank and confirmation scores.",
    ],
    nextConfirmation: [
      "4h close holds above the prior breakout shelf.",
      "Momentum expands without a new downside risk flag.",
      "BTC market context remains supportive.",
    ],
    invalidation: [
      "4h close loses the reclaim shelf.",
      "1d snapshot flips to risk or overheated without repair.",
      "Volume expansion appears on downside candles.",
    ],
    factors: {
      trend: "4h trend structure is constructive.",
      confirmation: "MA reclaim and score alignment support deeper review.",
      risk: "Downside risk remains defined by the recent pullback low.",
    },
    rawMetrics: {
      atrPct: 2.1,
      relativeVolume: 1.18,
      distanceFromMa20Pct: 1.6,
      distanceFromMa50Pct: 4.8,
    },
  });
  const history = [
    latestSignal,
    buildPreviewSignal({
      id: "visual-btc-4h-secondary",
      scanRunId: "visual-secondary-run",
      timeframe: "4h",
      scanTime: "2026-06-04T17:10:00.000Z",
      candleOpenTime: "2026-06-04T16:00:00.000Z",
      priceAtSignal: 102640,
      resultGroup: "watch",
      actionBias: "watch",
      signalLabel: "watch_retest",
      primaryStructure: "pullback_retest",
      statusNote: "Secondary run context",
      rankScore: 74.8,
      sourceRunIsLikelyFullUniverse: false,
      isSelectedCurrentRun: false,
      isNewerThanSelectedCurrentRun: true,
      statusReasons: ["Newer secondary run shifted the label to watch."],
    }),
    buildPreviewSignal({
      id: "visual-btc-4h-prior-watch",
      timeframe: "4h",
      scanTime: "2026-06-03T20:00:00.000Z",
      candleOpenTime: "2026-06-03T16:00:00.000Z",
      priceAtSignal: 101420,
      resultGroup: "watch",
      actionBias: "watch",
      signalLabel: "base_repair",
      primaryStructure: "range_reclaim",
      statusNote: "Review only",
      rankScore: 71.6,
      isSelectedCurrentRun: false,
      isNewerThanSelectedCurrentRun: false,
      statusReasons: ["Structure was improving, but confirmation was incomplete."],
    }),
    buildPreviewSignal({
      id: "visual-btc-4h-prior-risk",
      timeframe: "4h",
      scanTime: "2026-06-02T12:00:00.000Z",
      candleOpenTime: "2026-06-02T08:00:00.000Z",
      priceAtSignal: 99680,
      resultGroup: "risk",
      actionBias: "risk",
      signalLabel: "distribution_risk",
      primaryStructure: "failed_breakout",
      statusNote: "Risk review",
      rankScore: 35.4,
      riskScore: 72.2,
      detectedRiskTypes: ["failed_breakout", "high_volatility"],
      isSelectedCurrentRun: false,
      isNewerThanSelectedCurrentRun: false,
      statusReasons: ["Breakout failed before the current repair sequence."],
    }),
  ];
  const data: SymbolResearchSuccessResponse = {
    ok: true,
    timeframe: "4h",
    symbol: {
      exchange: "binance",
      market: "spot",
      symbol: "BTCUSDT",
      assetClass: "crypto",
      qualityTier: "core",
      isLowQuality: false,
      qualityFlags: [],
    },
    latest: {
      scanRun: {
        id: "visual-full-run-4h",
        status: "success",
        timeframe: "4h",
        symbolsTotal: 426,
        symbolsScanned: 424,
        signalsCreated: 424,
        finishedAt: scanFinishedAt,
      },
      signal: latestSignal,
    },
    currentSelection: {
      selectedRunId: "visual-full-run-4h",
      selectedSignalId: latestSignal.id,
      selectedTimeframe: "4h",
      selectedRunStartedAt: scanStartedAt,
      selectedRunFinishedAt: scanFinishedAt,
      selectedSignalScanTime: scanTime,
      preferredFullUniverse: true,
      isLikelyFullUniverse: true,
      minExpectedSymbols: 300,
      fallbackUsed: false,
    },
    scoreBreakdown: {
      rankScore: latestSignal.metrics.rankScore,
      finalSignalScore: latestSignal.metrics.finalSignalScore,
      opportunityScore: latestSignal.metrics.opportunityScore,
      confirmationScore: latestSignal.metrics.confirmationScore,
      riskScore: latestSignal.metrics.riskScore,
      trendScore: latestSignal.metrics.trendScore,
      momentumScore: latestSignal.metrics.momentumScore,
      volumeScore: latestSignal.metrics.volumeScore,
      structureScore: latestSignal.metrics.structureScore,
    },
    interpretation: {
      groupCode: latestSignal.groupCode,
      actionCode: latestSignal.actionCode,
      riskCode: latestSignal.riskCode,
      riskCodes: latestSignal.riskCodes,
      setupCode: latestSignal.setupCode,
      phaseCode: latestSignal.phaseCode,
      reasonCodes: latestSignal.reasonCodes,
      signalCodes: latestSignal.signalCodes,
      qualityCodes: latestSignal.qualityCodes,
    },
    history,
    timeframes: [
      buildPreviewSignal({
        id: "visual-btc-1h",
        timeframe: "1h",
        scanTime: "2026-06-04T17:00:00.000Z",
        candleOpenTime: "2026-06-04T16:00:00.000Z",
        resultGroup: "watch",
        actionBias: "watch",
        signalLabel: "watch_retest",
        primaryStructure: "short_term_retest",
        statusNote: "Review only",
        rankScore: 69.5,
      }),
      buildPreviewSignal({
        id: "visual-btc-1d",
        timeframe: "1d",
        scanTime: "2026-06-04T00:05:00.000Z",
        candleOpenTime: "2026-06-04T00:00:00.000Z",
        resultGroup: "eligible",
        actionBias: "eligible",
        signalLabel: "confirmed",
        primaryStructure: "daily_trend",
        statusNote: "Manual review",
        rankScore: 81.3,
      }),
      buildPreviewSignal({
        id: "visual-btc-1w",
        timeframe: "1w",
        scanTime: "2026-06-01T00:05:00.000Z",
        candleOpenTime: "2026-06-01T00:00:00.000Z",
        resultGroup: "watch",
        actionBias: "watch",
        signalLabel: "weekly_watch",
        primaryStructure: "long_term_repair",
        statusNote: "Review only",
        rankScore: 63.8,
      }),
    ],
    behavior: buildPreviewBehavior(),
    behaviorDiagnostics: {
      available: true,
      reason: "ok",
      message:
        "Visual-check behavior sample is populated from frontend mock observations.",
    },
    candles: {
      timeframe: "4h",
      count: candles.length,
      firstOpenTime: String(candles[0].openTime),
      lastOpenTime: String(candles[candles.length - 1].openTime),
      rows: candles,
    },
  };

  return {
    data,
    marketContext: buildPreviewMarketContext(),
    signalEvaluation: buildPreviewSignalEvaluation(),
    apiOriginLabel: "visual-check mock",
    scannerReturnHref: "/screener/visual-check",
  };
}

type PreviewSignalOverrides = Partial<SymbolResearchSignal> & {
  priceAtSignal?: number | null;
  rankScore?: number | null;
  finalSignalScore?: number | null;
  opportunityScore?: number | null;
  confirmationScore?: number | null;
  riskScore?: number | null;
  trendScore?: number | null;
  momentumScore?: number | null;
  volumeScore?: number | null;
  structureScore?: number | null;
  signalLabel?: string | null;
  actionBias?: string | null;
  resultGroup?: keyof typeof groupCodeByResultGroup;
  primaryStructure?: string | null;
  detectedRiskTypes?: string[];
  statusNote?: string | null;
  statusReasons?: string[];
  nextConfirmation?: string[];
  invalidation?: string[];
  factors?: Record<string, unknown>;
  rawMetrics?: Record<string, unknown>;
};

function buildPreviewSignal(overrides: PreviewSignalOverrides = {}): SymbolResearchSignal {
  const resultGroup = overrides.resultGroup ?? "eligible";
  const signalLabel = overrides.signalLabel ?? "confirmed";
  const primaryStructure = overrides.primaryStructure ?? "trend_continuation";
  const riskCodes = (overrides.detectedRiskTypes ?? []).map(
    (risk) => riskCodeByType[risk as keyof typeof riskCodeByType] ?? "RK_201",
  );
  const setupCode =
    setupCodeByAliasOrStructure[
      primaryStructure as keyof typeof setupCodeByAliasOrStructure
    ] ?? "ST_001";
  const rankScore = overrides.metrics?.rankScore ?? overrides.rankScore ?? 88.2;

  return {
    id: overrides.id ?? "visual-signal",
    scanRunId: overrides.scanRunId ?? "visual-full-run-4h",
    symbolId: overrides.symbolId ?? 1,
    exchange: overrides.exchange ?? "binance",
    market: overrides.market ?? "spot",
    symbol: overrides.symbol ?? "BTCUSDT",
    timeframe: overrides.timeframe ?? "4h",
    assetClass: overrides.assetClass ?? "crypto",
    scanTime: overrides.scanTime ?? scanTime,
    candleOpenTime: overrides.candleOpenTime ?? "2026-06-04T12:00:00.000Z",
    groupCode: groupCodeByResultGroup[resultGroup],
    actionCode: getPreviewActionCode(overrides.actionBias ?? "eligible"),
    riskCode: riskCodes[0] ?? null,
    riskCodes,
    setupCode,
    phaseCode: setupCode,
    reasonCodes: riskCodes,
    signalCodes: [
      signalCodeByLabel[signalLabel as keyof typeof signalCodeByLabel] ?? "NX_801",
    ],
    qualityCodes: ["QH_601"],
    metrics: {
      score: rankScore,
      rankScore,
      riskAdjustedScore:
        overrides.metrics?.riskAdjustedScore ??
        overrides.metrics?.finalSignalScore ??
        overrides.finalSignalScore ??
        83.4,
      setupQualityScore:
        overrides.metrics?.setupQualityScore ??
        overrides.metrics?.opportunityScore ??
        overrides.opportunityScore ??
        86.1,
      confidenceScore:
        overrides.metrics?.confidenceScore ??
        overrides.metrics?.confirmationScore ??
        overrides.confirmationScore ??
        82.6,
      absoluteSetupScore:
        overrides.metrics?.absoluteSetupScore ??
        overrides.metrics?.opportunityScore ??
        overrides.opportunityScore ??
        86.1,
      universePercentile: overrides.metrics?.universePercentile ?? null,
      finalSignalScore:
        overrides.metrics?.finalSignalScore ?? overrides.finalSignalScore ?? 83.4,
      opportunityScore:
        overrides.metrics?.opportunityScore ?? overrides.opportunityScore ?? 86.1,
      confirmationScore:
        overrides.metrics?.confirmationScore ?? overrides.confirmationScore ?? 82.6,
      riskScore: overrides.metrics?.riskScore ?? overrides.riskScore ?? 18.3,
      qualityScore: overrides.metrics?.qualityScore ?? 92,
      trendScore: overrides.metrics?.trendScore ?? overrides.trendScore ?? 91.4,
      momentumScore:
        overrides.metrics?.momentumScore ?? overrides.momentumScore ?? 77.8,
      volumeScore: overrides.metrics?.volumeScore ?? overrides.volumeScore ?? 68.5,
      structureScore:
        overrides.metrics?.structureScore ?? overrides.structureScore ?? 89.7,
      volatilityScore: overrides.metrics?.volatilityScore ?? null,
      mtfAgreementScore: overrides.metrics?.mtfAgreementScore ?? null,
      riskPenalty:
        overrides.metrics?.riskPenalty ??
        overrides.metrics?.riskScore ??
        overrides.riskScore ??
        18.3,
      qualityPenalty: overrides.metrics?.qualityPenalty ?? null,
      volumeRank: overrides.metrics?.volumeRank ?? null,
      historyBars: overrides.metrics?.historyBars ?? 720,
      volatilityPercentile: overrides.metrics?.volatilityPercentile ?? null,
      atrExtension: overrides.metrics?.atrExtension ?? null,
      distanceFromBase: overrides.metrics?.distanceFromBase ?? null,
      scoringModelVersion:
        overrides.metrics?.scoringModelVersion ?? "quant-factor-v1",
      scoringCalibrationVersion:
        overrides.metrics?.scoringCalibrationVersion ?? "deterministic-baseline-1",
      price: overrides.metrics?.price ?? overrides.priceAtSignal ?? 102320,
      rsi14: overrides.metrics?.rsi14 ?? null,
      bbPercent: overrides.metrics?.bbPercent ?? null,
      bbWidthPercentile: overrides.metrics?.bbWidthPercentile ?? null,
      volumeRatio: overrides.metrics?.volumeRatio ?? null,
    },
    scoringVersion: overrides.scoringVersion ?? "visual-check",
    scannerVersion: scannerCodeVersions.scannerVersion,
    codeSchemaVersion: scannerCodeVersions.codeSchemaVersion,
    dictionaryVersion: scannerCodeVersions.dictionaryVersion,
    createdAt: overrides.createdAt ?? scanTime,
    scanRunStartedAt: overrides.scanRunStartedAt ?? scanStartedAt,
    scanRunFinishedAt: overrides.scanRunFinishedAt ?? scanFinishedAt,
    sourceRunIsLikelyFullUniverse: overrides.sourceRunIsLikelyFullUniverse ?? true,
    isSelectedCurrentRun: overrides.isSelectedCurrentRun ?? true,
    isNewerThanSelectedCurrentRun:
      overrides.isNewerThanSelectedCurrentRun ?? false,
  };
}

function getPreviewActionCode(value: string | null | undefined) {
  if (value === "watch" || value === "research") {
    return "AC_201";
  }

  if (value === "risk") {
    return "AC_302";
  }

  return actionCodeByBias[value as keyof typeof actionCodeByBias] ?? "NX_801";
}

function buildPreviewCandles(): RawSymbolChartCandle[] {
  const start = Date.UTC(2026, 4, 15, 0, 0, 0);
  const stepMs = 4 * 60 * 60 * 1000;
  let previousClose = 93_800;

  return Array.from({ length: 120 }, (_, index) => {
    const drift = index < 38 ? 105 : index < 74 ? -45 : 145;
    const wave = Math.sin(index / 4) * 260 + Math.cos(index / 9) * 130;
    const open = previousClose;
    const close = open + drift + wave * 0.18;
    const high = Math.max(open, close) + 330 + Math.abs(Math.sin(index)) * 110;
    const low = Math.min(open, close) - 280 - Math.abs(Math.cos(index)) * 120;
    previousClose = close;

    return {
      openTime: new Date(start + index * stepMs).toISOString(),
      closeTime: new Date(start + (index + 1) * stepMs - 1).toISOString(),
      open: roundPrice(open),
      high: roundPrice(high),
      low: roundPrice(low),
      close: roundPrice(close),
      volume: Math.round(1800 + Math.abs(Math.sin(index / 3)) * 900),
      quoteVolume: Math.round(close * 2200),
    };
  });
}

function buildPreviewBehavior(): SymbolResearchSuccessResponse["behavior"] {
  return {
    sampleSize: 28,
    horizons: {
      "1": {
        sampleSize: 28,
        avgReturnPct: 0.74,
        medianReturnPct: 0.52,
        winRatePct: 64.3,
        bestReturnPct: 4.8,
        worstReturnPct: -2.9,
      },
      "3": {
        sampleSize: 27,
        avgReturnPct: 1.86,
        medianReturnPct: 1.42,
        winRatePct: 70.4,
        bestReturnPct: 8.9,
        worstReturnPct: -4.4,
      },
      "5": {
        sampleSize: 25,
        avgReturnPct: 2.35,
        medianReturnPct: 1.96,
        winRatePct: 68,
        bestReturnPct: 12.6,
        worstReturnPct: -6.1,
      },
    },
    byResultGroup: [],
    bySignalLabel: [],
    recentOutcomes: Array.from({ length: 8 }, (_, index) => ({
      scanTime: new Date(Date.UTC(2026, 4, 18 + index, 16, 0, 0)).toISOString(),
      signalLabel: index % 3 === 0 ? "base_repair" : "confirmed",
      resultGroup: index % 4 === 0 ? "watch" : "eligible",
      priceAtSignal: roundPrice(95_600 + index * 780),
      rankScore: 72 + index * 1.7,
      forwardReturnPct: {
        "1": roundPercent(0.4 + index * 0.08),
        "3": roundPercent(1.1 + index * 0.14),
        "5": roundPercent(1.7 + index * 0.19),
      },
      sourceRunIsLikelyFullUniverse: true,
      isSelectedCurrentRun: index === 7,
      isNewerThanSelectedCurrentRun: false,
    })),
    currentContext: {
      signalLabel: "confirmed",
      resultGroup: "eligible",
      primaryStructure: "trend_continuation",
      timeframe: "4h",
    },
    warnings: [],
  };
}

function buildPreviewMarketContext(): MarketContextResponse {
  return {
    ok: true,
    assetClass: "crypto",
    generatedAt: "2026-06-04T16:05:00.000Z",
    context: {
      structuralContext: "long_term_constructive",
      marketContext: "risk_on",
      tacticalContext: "short_term_strength",
      combinedContext: "bull_trend_continuation",
      confidence: "high",
    },
    summary: {
      title: "Constructive backdrop",
      description:
        "BTC weekly, daily, and 4h layers are aligned constructively while ETH confirms the broader move.",
      researchPosture: "constructive",
      keyPoints: [
        "BTC 1w structural context: long term constructive.",
        "BTC 1d market context: risk on.",
        "BTC 4h tactical context: short term strength.",
        "ETH confirmation: confirms broader risk-on conditions.",
      ],
      warnings: ["Research-only. Not trading advice."],
    },
    rules: {
      researchOnly: true,
    },
  };
}

function buildPreviewSignalEvaluation(): SignalEvaluationResponse {
  return {
    ok: true,
    filters: {
      assetClass: "crypto",
      exchange: "binance",
      market: "spot",
      timeframe: "4h",
      symbol: null,
      group: "eligible",
      signalLabel: "confirmed",
      primaryStructure: null,
      setupType: null,
      horizons: [1, 3, 5, 10],
    },
    sample: {
      sourceSignals: 312,
      completedSignals: 286,
      skippedSignals: 26,
      sampleQuality: "strong",
      warnings: [],
    },
    expectedDirection: "up",
    horizons: {
      "1": buildPreviewSignalEvaluationHorizon({
        sampleSize: 302,
        medianReturnPct: 0.36,
        directionMatchRatePct: 56,
      }),
      "3": buildPreviewSignalEvaluationHorizon({
        sampleSize: 294,
        medianReturnPct: 0.82,
        directionMatchRatePct: 61,
      }),
      "5": buildPreviewSignalEvaluationHorizon({
        sampleSize: 286,
        avgReturnPct: 1.52,
        medianReturnPct: 1.18,
        positiveRatePct: 64,
        directionMatchRatePct: 64,
      }),
      "10": buildPreviewSignalEvaluationHorizon({
        sampleSize: 244,
        medianReturnPct: 1.56,
        directionMatchRatePct: 63,
      }),
    },
    interpretation: {
      summary:
        "Broad-market history generally supports constructive follow-through for confirmed eligible labels.",
      confidence: "strong",
      researchOnly: true,
    },
  };
}

function buildPreviewSignalEvaluationHorizon(
  overrides: Partial<SignalEvaluationHorizonStats> = {},
): SignalEvaluationHorizonStats {
  return {
    sampleSize: 286,
    avgReturnPct: 1.2,
    medianReturnPct: 0.9,
    positiveRatePct: 62,
    directionMatchRatePct: 61,
    bestReturnPct: 11.8,
    worstReturnPct: -7.4,
    ...overrides,
  };
}

function roundPrice(value: number) {
  return Number(value.toFixed(2));
}

function roundPercent(value: number) {
  return Number(value.toFixed(2));
}
