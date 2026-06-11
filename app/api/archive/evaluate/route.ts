import { NextResponse } from "next/server";
import { summarizeForwardEvaluations } from "@/lib/storage/scanEvaluation";
import { parseEvaluateOptions } from "@/lib/storage/researchCli";
import { runResearchEvaluationJob } from "@/lib/storage/researchEvaluationJob";
import { getScannerStorageAdapter } from "@/lib/storage/storageAdapter";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  let options: ReturnType<typeof parseEvaluateOptions>;

  try {
    options = parseEvaluateOptions(searchParamsToArgs(searchParams));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }

  const job = await runResearchEvaluationJob(options);

  const query = {
    limit: options.limit,
    horizon: options.horizon,
    timeframe: options.timeframe,
  };
  const storage = await getScannerStorageAdapter();
  if (storage.mode === "disabled") {
    return NextResponse.json({
      storageMode: storage.mode,
      horizon: options.horizon,
      horizonCandles: 0,
      itemCount: 0,
      signalsCount: 0,
      evaluations: [],
      job,
      summary: emptySummary(),
    });
  }

  try {
    const signals = await storage.listScanSignals(query);
    const relevantEvaluations = await storage.listForwardEvaluations(query);
    const summary = summarizeForwardEvaluations(relevantEvaluations, signals);
    const [
      bySignalLabel,
      byActionBias,
      byRiskType,
      byTimeframe,
      byScoreBucket,
    ] = await Promise.all([
      storage.getSignalPerformanceByLabel(query),
      storage.getSignalPerformanceByActionBias(query),
      storage.getSignalPerformanceByRiskType(query),
      storage.getSignalPerformanceByTimeframe(query),
      storage.getSignalPerformanceByScoreBucket(query),
    ]);

    return NextResponse.json({
      storageMode: storage.mode,
      horizon: options.horizon,
      horizonCandles: 0,
      itemCount: relevantEvaluations.length,
      signalsCount: signals.length,
      evaluations: relevantEvaluations,
      job,
      summary: {
        ...summary,
        bySignalLabel: groupsToRecord(bySignalLabel),
        byActionBias: groupsToRecord(byActionBias),
        byRiskType: groupsToRecord(byRiskType),
        byTimeframe: groupsToRecord(byTimeframe),
        byScoreBucket: groupsToRecord(byScoreBucket),
        insufficientDataCount: relevantEvaluations.filter(
          (evaluation) => evaluation.outcomeLabel === "insufficient_data",
        ).length,
        latestEvaluationTime:
          relevantEvaluations.find((evaluation) => evaluation.evaluationTime !== null)
            ?.evaluationTime ?? null,
      },
    });
  } finally {
    await storage.close?.();
  }
}

function searchParamsToArgs(searchParams: URLSearchParams) {
  return Array.from(searchParams.entries()).map(([key, value]) => `--${key}=${value}`);
}

function groupsToRecord<T extends { group: string }>(groups: T[]) {
  return Object.fromEntries(groups.map(({ group, ...bucket }) => [group, bucket]));
}

function emptySummary() {
  return {
    evaluationCount: 0,
    completedCount: 0,
    pendingCount: 0,
    bySignalLabel: {},
    byActionBias: {},
    byRiskType: {},
    byTimeframe: {},
    byScoreBucket: {},
    bySignal: {},
    byPhase: {},
    byAlignment: {},
  };
}
