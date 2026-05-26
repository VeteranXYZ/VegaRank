import type { Candle } from "@/lib/exchanges/types";
import type {
  MarketPhase,
  MultiTimeframeAlignment,
  ScannerSignalState,
} from "@/lib/scanner/types";
import type { StoredScanResult, StoredScanSnapshot } from "./scanSnapshotModel";

export type ForwardEvaluationStatus = "completed" | "pending";

export type ForwardEvaluation = {
  snapshotId: string;
  snapshotCreatedAt: string;
  symbol: string;
  timeframe: StoredScanResult["timeframe"];
  phase: MarketPhase;
  signalState: ScannerSignalState;
  alignment?: MultiTimeframeAlignment;
  entryPrice: number;
  horizonCandles: number;
  status: ForwardEvaluationStatus;
  candlesAvailable: number;
  exitPrice: number | null;
  returnPct: number | null;
  maxUpPct: number | null;
  maxDownPct: number | null;
};

export type EvaluationSummaryBucket = {
  completedCount: number;
  pendingCount: number;
  hitRate: number | null;
  avgReturnPct: number | null;
  avgMaxUpPct: number | null;
  avgMaxDownPct: number | null;
};

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

export function summarizeForwardEvaluations(evaluations: ForwardEvaluation[]) {
  return {
    evaluationCount: evaluations.length,
    completedCount: evaluations.filter((item) => item.status === "completed")
      .length,
    pendingCount: evaluations.filter((item) => item.status === "pending").length,
    bySignal: summarizeBy(evaluations, (item) => item.signalState),
    byPhase: summarizeBy(evaluations, (item) => item.phase),
    byAlignment: summarizeBy(
      evaluations.filter((item) => item.alignment),
      (item) => item.alignment as MultiTimeframeAlignment,
    ),
  };
}

function summarizeBy<T extends string>(
  evaluations: ForwardEvaluation[],
  getKey: (evaluation: ForwardEvaluation) => T,
) {
  const buckets = new Map<T, ForwardEvaluation[]>();

  for (const evaluation of evaluations) {
    const key = getKey(evaluation);
    buckets.set(key, [...(buckets.get(key) ?? []), evaluation]);
  }

  return Object.fromEntries(
    Array.from(buckets.entries()).map(([key, values]) => [
      key,
      summarizeBucket(values),
    ]),
  ) as Record<T, EvaluationSummaryBucket>;
}

function summarizeBucket(values: ForwardEvaluation[]): EvaluationSummaryBucket {
  const completed = values.filter((item) => item.status === "completed");
  const pendingCount = values.length - completed.length;

  if (completed.length === 0) {
    return {
      completedCount: 0,
      pendingCount,
      hitRate: null,
      avgReturnPct: null,
      avgMaxUpPct: null,
      avgMaxDownPct: null,
    };
  }

  return {
    completedCount: completed.length,
    pendingCount,
    hitRate:
      completed.filter((item) => (item.returnPct ?? 0) > 0).length /
      completed.length,
    avgReturnPct: average(completed.map((item) => item.returnPct ?? 0)),
    avgMaxUpPct: average(completed.map((item) => item.maxUpPct ?? 0)),
    avgMaxDownPct: average(completed.map((item) => item.maxDownPct ?? 0)),
  };
}

function toPct(value: number, base: number) {
  if (base === 0) {
    return 0;
  }

  return ((value - base) / base) * 100;
}

function average(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}
