import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { calculateIndicatorSnapshot } from "@/lib/indicators";
import { scanCandles } from "@/lib/scanner/scanCandles";
import type {
  ActionBias,
  DetectedRiskType,
  MarketPhase,
  ScannerSignalLabel,
  ScannerSignalState,
} from "@/lib/scanner/types";
import type { Candle, Timeframe } from "@/lib/exchanges/types";
import type { ScanEvaluationNote } from "@/lib/shared/scannerTypes";
import { parseJsonArray, type ScanSignalRecord } from "./scanSignalModel";
import type { StoredScanResult, StoredScanSnapshot } from "./scanSnapshotModel";

export type EvaluationHorizon = "1h" | "4h" | "24h" | "3d" | "7d";
export type ForwardOutcomeLabel =
  | "favorable"
  | "neutral"
  | "unfavorable"
  | "invalidated"
  | "insufficient_data";
export type ForwardEvaluationStatus = "completed" | "pending";

export type SignalForwardEvaluation = {
  id: string;
  signalId: string;
  symbol: string;
  timeframe: Timeframe;
  signalTime: string;
  evaluationTime: string | null;
  horizon: EvaluationHorizon;
  priceAtSignal: number;
  priceAtEvaluation: number | null;
  returnPct: number | null;
  maxReturnPct: number | null;
  maxDrawdownPct: number | null;
  stillAboveMA20: boolean | null;
  stillAboveMA50: boolean | null;
  stillAboveMA200: boolean | null;
  rsiAtEvaluation: number | null;
  riskScoreAtEvaluation: number | null;
  confirmationScoreAtEvaluation: number | null;
  signalLabelAtEvaluation: ScannerSignalLabel | null;
  actionBiasAtEvaluation: ActionBias | null;
  outcomeLabel: ForwardOutcomeLabel;
  notesJson: string;
  metricsJson: string;
};

export type EvaluationSummaryBucket = {
  count: number;
  completedCount: number;
  pendingCount: number;
  avgReturnPct: number | null;
  avgMaxDrawdownPct: number | null;
  favorableRate: number | null;
  unfavorableRate: number | null;
  hitRate: number | null;
  avgMaxUpPct: number | null;
  avgMaxDownPct: number | null;
};

export type ForwardEvaluation = {
  snapshotId: string;
  snapshotCreatedAt: string;
  symbol: string;
  timeframe: StoredScanResult["timeframe"];
  phase: MarketPhase;
  signalState: ScannerSignalState;
  alignment?: StoredScanResult["multiTimeframe"] extends infer M
    ? M extends { alignment: infer A }
      ? A
      : never
    : never;
  entryPrice: number;
  horizonCandles: number;
  status: ForwardEvaluationStatus;
  candlesAvailable: number;
  exitPrice: number | null;
  returnPct: number | null;
  maxUpPct: number | null;
  maxDownPct: number | null;
};

const evaluationsFile = path.join(
  process.cwd(),
  ".data",
  "signal-forward-evaluations.jsonl",
);

export function evaluateSignalForward({
  signal,
  candles,
  horizon,
}: {
  signal: ScanSignalRecord;
  candles: Candle[];
  horizon: EvaluationHorizon;
}): SignalForwardEvaluation {
  const signalTimeMs = Date.parse(signal.scanTime);
  const targetTime = signalTimeMs + horizonToMs(horizon);
  const evaluationCandle = candles.find((candle) => candle.closeTime >= targetTime);
  const futureCandles = candles.filter((candle) => candle.closeTime > signalTimeMs);
  const window = evaluationCandle
    ? futureCandles.filter((candle) => candle.closeTime <= evaluationCandle.closeTime)
    : [];
  const base = {
    id: `${signal.id}:${horizon}`,
    signalId: signal.id,
    symbol: signal.symbol,
    timeframe: signal.timeframe,
    signalTime: signal.scanTime,
    horizon,
    priceAtSignal: signal.priceAtSignal,
  };

  if (!evaluationCandle || window.length === 0) {
    return {
      ...base,
      evaluationTime: null,
      priceAtEvaluation: null,
      returnPct: null,
      maxReturnPct: null,
      maxDrawdownPct: null,
      stillAboveMA20: null,
      stillAboveMA50: null,
      stillAboveMA200: null,
      rsiAtEvaluation: null,
      riskScoreAtEvaluation: null,
      confirmationScoreAtEvaluation: null,
      signalLabelAtEvaluation: null,
      actionBiasAtEvaluation: null,
      outcomeLabel: "insufficient_data",
      notesJson: JSON.stringify(buildInsufficientFutureCandlesNotes()),
      metricsJson: JSON.stringify({ candlesAvailable: futureCandles.length }),
    };
  }

  const priceAtEvaluation = evaluationCandle.close;
  const maxReturnPct = toPct(
    Math.max(...window.map((candle) => candle.high)),
    signal.priceAtSignal,
  );
  const maxDrawdownPct = toPct(
    Math.min(...window.map((candle) => candle.low)),
    signal.priceAtSignal,
  );
  const returnPct = toPct(priceAtEvaluation, signal.priceAtSignal);
  const evaluationCandles = candles.filter(
    (candle) => candle.closeTime <= evaluationCandle.closeTime,
  );
  const indicatorSnapshot = calculateIndicatorSnapshot(evaluationCandles);
  const evaluationScan =
    evaluationCandles.length >= 50
      ? scanCandles(signal.symbol, signal.timeframe, evaluationCandles)
      : null;
  const metrics = {
    returnPct,
    maxReturnPct,
    maxDrawdownPct,
    candlesAvailable: futureCandles.length,
    detectedRiskTypes: parseJsonArray(signal.detectedRiskTypesJson),
  };
  const outcome = calculateForwardOutcome({
    signal,
    returnPct,
    maxDrawdownPct,
    stillAboveMA20:
      indicatorSnapshot.ma20 === null
        ? null
        : indicatorSnapshot.close > indicatorSnapshot.ma20,
    stillAboveMA50:
      indicatorSnapshot.ma50 === null
        ? null
        : indicatorSnapshot.close > indicatorSnapshot.ma50,
    stillAboveMA200:
      indicatorSnapshot.ma200 === null
        ? null
        : indicatorSnapshot.close > indicatorSnapshot.ma200,
    signalLabelAtEvaluation: evaluationScan?.signalLabel ?? null,
    actionBiasAtEvaluation: evaluationScan?.actionBias ?? null,
  });

  return {
    ...base,
    evaluationTime: new Date(evaluationCandle.closeTime).toISOString(),
    priceAtEvaluation,
    returnPct,
    maxReturnPct,
    maxDrawdownPct,
    stillAboveMA20:
      indicatorSnapshot.ma20 === null
        ? null
        : indicatorSnapshot.close > indicatorSnapshot.ma20,
    stillAboveMA50:
      indicatorSnapshot.ma50 === null
        ? null
        : indicatorSnapshot.close > indicatorSnapshot.ma50,
    stillAboveMA200:
      indicatorSnapshot.ma200 === null
        ? null
        : indicatorSnapshot.close > indicatorSnapshot.ma200,
    rsiAtEvaluation: indicatorSnapshot.rsi14,
    riskScoreAtEvaluation: evaluationScan?.riskScore ?? null,
    confirmationScoreAtEvaluation: evaluationScan?.confirmationScore ?? null,
    signalLabelAtEvaluation: evaluationScan?.signalLabel ?? null,
    actionBiasAtEvaluation: evaluationScan?.actionBias ?? null,
    outcomeLabel: outcome,
    notesJson: JSON.stringify(buildOutcomeNotes(signal, outcome)),
    metricsJson: JSON.stringify(metrics),
  };
}

export function calculateForwardOutcome({
  signal,
  returnPct,
  maxDrawdownPct,
  stillAboveMA20,
  stillAboveMA50,
  stillAboveMA200,
  signalLabelAtEvaluation,
  actionBiasAtEvaluation,
}: {
  signal: Pick<ScanSignalRecord, "signalLabel" | "actionBias">;
  returnPct: number;
  maxDrawdownPct: number;
  stillAboveMA20: boolean | null;
  stillAboveMA50: boolean | null;
  stillAboveMA200: boolean | null;
  signalLabelAtEvaluation: ScannerSignalLabel | null;
  actionBiasAtEvaluation: ActionBias | null;
}): ForwardOutcomeLabel {
  if (
    signalLabelAtEvaluation === "breakdown_risk" ||
    actionBiasAtEvaluation === "avoid"
  ) {
    if (
      signal.signalLabel === "confirmed" ||
      signal.signalLabel === "watch" ||
      signal.signalLabel === "trend"
    ) {
      return "invalidated";
    }
  }

  switch (signal.signalLabel) {
    case "confirmed":
    case "watch":
    case "trend":
      if (returnPct > 0 && maxDrawdownPct > -5 && stillAboveMA20 !== false) {
        return "favorable";
      }
      if (returnPct < -2 || maxDrawdownPct <= -8 || stillAboveMA50 === false) {
        return "unfavorable";
      }
      return "neutral";
    case "overheated":
      if (maxDrawdownPct <= -3 || signalLabelAtEvaluation === "distribution_risk") {
        return "favorable";
      }
      if (returnPct > 4 && maxDrawdownPct > -2) {
        return "unfavorable";
      }
      return "neutral";
    case "distribution_risk":
      if (returnPct < -1 || maxDrawdownPct <= -3) {
        return "favorable";
      }
      if (returnPct > 3 && maxDrawdownPct > -2) {
        return "unfavorable";
      }
      return "neutral";
    case "weak_bounce":
      if (stillAboveMA50 === false || stillAboveMA200 === false || returnPct <= 0) {
        return "favorable";
      }
      if (stillAboveMA50 === true && returnPct > 2) {
        return "unfavorable";
      }
      return "neutral";
    case "breakdown_risk":
      if (returnPct < 0 || stillAboveMA20 === false) {
        return "favorable";
      }
      if (returnPct > 3 && stillAboveMA20 === true && stillAboveMA50 === true) {
        return "unfavorable";
      }
      return "neutral";
    case "weak":
    case "neutral":
      if (Math.abs(returnPct) < 1.5) {
        return "neutral";
      }
      return returnPct > 0 ? "favorable" : "unfavorable";
    default:
      return "neutral";
  }
}

export async function evaluatePendingSignals({
  signals,
  horizon,
  getCandles,
}: {
  signals: ScanSignalRecord[];
  horizon: EvaluationHorizon;
  getCandles: (signal: ScanSignalRecord) => Candle[] | Promise<Candle[]>;
}) {
  const evaluations: SignalForwardEvaluation[] = [];

  for (const signal of signals) {
    const candles = await getCandles(signal);
    evaluations.push(evaluateSignalForward({ signal, candles, horizon }));
  }

  return evaluations;
}

export async function persistForwardEvaluations(
  evaluations: SignalForwardEvaluation[],
) {
  if (evaluations.length === 0) {
    return [];
  }

  const existing = await getStoredForwardEvaluations();
  const existingIds = new Set(
    existing
      .filter((evaluation) => evaluation.outcomeLabel !== "insufficient_data")
      .map((evaluation) => evaluation.id),
  );
  const next = evaluations.filter((evaluation) => !existingIds.has(evaluation.id));

  if (next.length === 0) {
    return [];
  }

  await mkdir(path.dirname(evaluationsFile), { recursive: true });
  await appendFile(
    evaluationsFile,
    `${next.map((evaluation) => JSON.stringify(evaluation)).join("\n")}\n`,
    "utf8",
  );

  return next;
}

export async function getStoredForwardEvaluations(limit?: number) {
  try {
    const content = await readFile(evaluationsFile, "utf8");
    const evaluations = content
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as SignalForwardEvaluation);
    const deduped = Array.from(
      new Map(evaluations.map((evaluation) => [evaluation.id, evaluation])).values(),
    );

    return typeof limit === "number" ? deduped.slice(-limit).reverse() : deduped;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

export function getSignalPerformanceByLabel(
  evaluations: SignalForwardEvaluation[],
  signals: ScanSignalRecord[],
) {
  return summarizeBySignalProperty(evaluations, signals, (signal) => signal.signalLabel);
}

export function getSignalPerformanceByActionBias(
  evaluations: SignalForwardEvaluation[],
  signals: ScanSignalRecord[],
) {
  return summarizeBySignalProperty(evaluations, signals, (signal) => signal.actionBias);
}

export function getSignalPerformanceByRiskType(
  evaluations: SignalForwardEvaluation[],
  signals: ScanSignalRecord[],
) {
  const signalMap = new Map(signals.map((signal) => [signal.id, signal]));
  const buckets = new Map<DetectedRiskType, SignalForwardEvaluation[]>();

  for (const evaluation of evaluations) {
    const signal = signalMap.get(evaluation.signalId);
    if (!signal) continue;

    for (const riskType of parseJsonArray(signal.detectedRiskTypesJson)) {
      const key = riskType as DetectedRiskType;
      buckets.set(key, [...(buckets.get(key) ?? []), evaluation]);
    }
  }

  return summarizeBuckets(buckets);
}

export function getSignalPerformanceByTimeframe(
  evaluations: SignalForwardEvaluation[],
) {
  return summarizeByEvaluationProperty(evaluations, (evaluation) => evaluation.timeframe);
}

export function getSignalPerformanceByScoreBucket(
  evaluations: SignalForwardEvaluation[],
  signals: ScanSignalRecord[],
) {
  return summarizeBySignalProperty(evaluations, signals, (signal) =>
    getScoreBucket(signal.finalSignalScore),
  );
}

export function summarizeForwardEvaluations(
  evaluations: SignalForwardEvaluation[],
  signals: ScanSignalRecord[] = [],
) {
  const completed = evaluations.filter(
    (evaluation) => evaluation.outcomeLabel !== "insufficient_data",
  );

  return {
    evaluationCount: evaluations.length,
    completedCount: completed.length,
    pendingCount: evaluations.length - completed.length,
    bySignalLabel: getSignalPerformanceByLabel(evaluations, signals),
    byActionBias: getSignalPerformanceByActionBias(evaluations, signals),
    byRiskType: getSignalPerformanceByRiskType(evaluations, signals),
    byTimeframe: getSignalPerformanceByTimeframe(evaluations),
    byScoreBucket: getSignalPerformanceByScoreBucket(evaluations, signals),
    // Backward-compatible aliases for the existing history UI.
    bySignal: summarizeByEvaluationProperty(evaluations, (item) => item.signalLabelAtEvaluation ?? "unknown"),
    byPhase: {},
    byAlignment: {},
  };
}

export function evaluateForwardPerformance({
  snapshot,
  result,
  candles,
  horizonCandles,
}: {
  snapshot: StoredScanSnapshot;
  result: StoredScanResult;
  candles: Candle[];
  horizonCandles: number;
}): ForwardEvaluation {
  const snapshotTime = new Date(snapshot.createdAt).getTime();
  const futureCandles = candles.filter((candle) => candle.openTime > snapshotTime);
  const window = futureCandles.slice(0, horizonCandles);
  const base = {
    snapshotId: snapshot.id,
    snapshotCreatedAt: snapshot.createdAt,
    symbol: result.symbol,
    timeframe: result.timeframe,
    phase: result.phase,
    signalState: result.signalState,
    alignment: result.multiTimeframe?.alignment,
    entryPrice: result.price,
    horizonCandles,
    candlesAvailable: futureCandles.length,
  };

  if (window.length < horizonCandles) {
    return {
      ...base,
      status: "pending",
      exitPrice: null,
      returnPct: null,
      maxUpPct: null,
      maxDownPct: null,
    };
  }

  const exitPrice = window.at(-1)?.close ?? result.price;
  const highestHigh = Math.max(...window.map((candle) => candle.high));
  const lowestLow = Math.min(...window.map((candle) => candle.low));

  return {
    ...base,
    status: "completed",
    exitPrice,
    returnPct: toPct(exitPrice, result.price),
    maxUpPct: toPct(highestHigh, result.price),
    maxDownPct: toPct(lowestLow, result.price),
  };
}

function summarizeBySignalProperty<T extends string>(
  evaluations: SignalForwardEvaluation[],
  signals: ScanSignalRecord[],
  getKey: (signal: ScanSignalRecord) => T,
) {
  const signalMap = new Map(signals.map((signal) => [signal.id, signal]));
  const buckets = new Map<T, SignalForwardEvaluation[]>();

  for (const evaluation of evaluations) {
    const signal = signalMap.get(evaluation.signalId);
    if (!signal) continue;

    const key = getKey(signal);
    buckets.set(key, [...(buckets.get(key) ?? []), evaluation]);
  }

  return summarizeBuckets(buckets);
}

function summarizeByEvaluationProperty<T extends string>(
  evaluations: SignalForwardEvaluation[],
  getKey: (evaluation: SignalForwardEvaluation) => T,
) {
  const buckets = new Map<T, SignalForwardEvaluation[]>();

  for (const evaluation of evaluations) {
    const key = getKey(evaluation);
    buckets.set(key, [...(buckets.get(key) ?? []), evaluation]);
  }

  return summarizeBuckets(buckets);
}

function summarizeBuckets<T extends string>(
  buckets: Map<T, SignalForwardEvaluation[]>,
) {
  return Object.fromEntries(
    Array.from(buckets.entries()).map(([key, values]) => [
      key,
      summarizeBucket(values),
    ]),
  ) as Record<T, EvaluationSummaryBucket>;
}

function summarizeBucket(values: SignalForwardEvaluation[]): EvaluationSummaryBucket {
  const completed = values.filter(
    (item) => item.outcomeLabel !== "insufficient_data",
  );
  const pendingCount = values.length - completed.length;

  if (completed.length === 0) {
    return {
      count: values.length,
      completedCount: 0,
      pendingCount,
      avgReturnPct: null,
      avgMaxDrawdownPct: null,
      favorableRate: null,
      unfavorableRate: null,
      hitRate: null,
      avgMaxUpPct: null,
      avgMaxDownPct: null,
    };
  }

  return {
    count: values.length,
    completedCount: completed.length,
    pendingCount,
    avgReturnPct: averageNullable(completed.map((item) => item.returnPct)),
    avgMaxDrawdownPct: averageNullable(
      completed.map((item) => item.maxDrawdownPct),
    ),
    favorableRate:
      completed.filter((item) => item.outcomeLabel === "favorable").length /
      completed.length,
    unfavorableRate:
      completed.filter((item) => item.outcomeLabel === "unfavorable").length /
      completed.length,
    hitRate:
      completed.filter((item) => (item.returnPct ?? 0) > 0).length /
      completed.length,
    avgMaxUpPct: averageNullable(completed.map((item) => item.maxReturnPct)),
    avgMaxDownPct: averageNullable(completed.map((item) => item.maxDrawdownPct)),
  };
}

function buildOutcomeNotes(
  signal: Pick<ScanSignalRecord, "signalLabel">,
  outcome: ForwardOutcomeLabel,
): ScanEvaluationNote[] {
  if (outcome === "insufficient_data") {
    return buildInsufficientFutureCandlesNotes();
  }

  if (
    signal.signalLabel === "distribution_risk" ||
    signal.signalLabel === "overheated" ||
    signal.signalLabel === "breakdown_risk" ||
    signal.signalLabel === "weak_bounce"
  ) {
    return [
      {
        key: "evaluation.riskOutcomeVerified",
        params: { outcome },
      },
    ];
  }

  return [
    {
      key: "evaluation.opportunityOutcomeVerified",
      params: { outcome },
    },
  ];
}

function buildInsufficientFutureCandlesNotes(): ScanEvaluationNote[] {
  return [{ key: "evaluation.insufficientFutureCandles" }];
}

function getScoreBucket(score: number) {
  if (score >= 100) return "score_gte_100";
  if (score >= 50) return "score_50_100";
  if (score >= 0) return "score_0_50";
  return "score_lt_0";
}

function horizonToMs(horizon: EvaluationHorizon) {
  const hour = 60 * 60 * 1000;

  switch (horizon) {
    case "1h":
      return hour;
    case "4h":
      return 4 * hour;
    case "24h":
      return 24 * hour;
    case "3d":
      return 3 * 24 * hour;
    case "7d":
      return 7 * 24 * hour;
  }
}

function toPct(value: number, base: number) {
  if (base === 0) {
    return 0;
  }

  return ((value - base) / base) * 100;
}

function averageNullable(values: Array<number | null>) {
  const concrete = values.filter((value): value is number => value !== null);
  return concrete.length === 0 ? null : average(concrete);
}

function average(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}
