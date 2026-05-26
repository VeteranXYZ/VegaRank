import { NextResponse } from "next/server";
import pLimit from "p-limit";
import { getCandles } from "@/lib/exchanges/binance";
import {
  isCloudflareDeployTarget,
  isLocalPersistenceDisabled,
  localPersistenceUnavailableMessage,
} from "@/lib/runtime/localPersistence";

export const runtime = "nodejs";

const DEFAULT_SNAPSHOT_LIMIT = 10;
const MAX_SNAPSHOT_LIMIT = 50;
const DEFAULT_HORIZON_CANDLES = 3;
const MAX_HORIZON_CANDLES = 30;
const DEFAULT_RESULT_LIMIT = 50;
const MAX_RESULT_LIMIT = 200;
const EVALUATION_CONCURRENCY = 5;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const snapshotLimit = parseLimit(
    searchParams.get("limit"),
    DEFAULT_SNAPSHOT_LIMIT,
    MAX_SNAPSHOT_LIMIT,
    "limit",
  );
  const horizonCandles = parseLimit(
    searchParams.get("horizon"),
    DEFAULT_HORIZON_CANDLES,
    MAX_HORIZON_CANDLES,
    "horizon",
  );
  const resultLimit = parseLimit(
    searchParams.get("resultLimit"),
    DEFAULT_RESULT_LIMIT,
    MAX_RESULT_LIMIT,
    "resultLimit",
  );

  if (!snapshotLimit.valid) {
    return NextResponse.json({ error: snapshotLimit.error }, { status: 400 });
  }

  if (!horizonCandles.valid) {
    return NextResponse.json({ error: horizonCandles.error }, { status: 400 });
  }

  if (!resultLimit.valid) {
    return NextResponse.json({ error: resultLimit.error }, { status: 400 });
  }

  if (!isCloudflareDeployTarget() && isLocalPersistenceDisabled()) {
    return localPersistenceUnavailableResponse();
  }

  try {
    const snapshotLimitValue = snapshotLimit.value;
    const horizonCandlesValue = horizonCandles.value;
    const resultLimitValue = resultLimit.value;
    const snapshots = isCloudflareDeployTarget()
      ? await getD1Snapshots(snapshotLimitValue)
      : await getLocalSnapshots(snapshotLimitValue);
    const { evaluateForwardPerformance, summarizeForwardEvaluations } =
      await import("@/lib/storage/scanEvaluation");
    const work = snapshots.flatMap((snapshot) =>
      snapshot.results.map((result) => ({ snapshot, result })),
    );
    const limitedWork = work.slice(0, resultLimitValue);
    const gate = pLimit(EVALUATION_CONCURRENCY);
    const evaluations = await Promise.all(
      limitedWork.map(({ snapshot, result }) =>
        gate(async () => {
          const candles = await getEvaluationCandles(
            result.symbol,
            result.timeframe,
          );
          return evaluateForwardPerformance({
            snapshot,
            result,
            candles,
            horizonCandles: horizonCandlesValue,
          });
        }),
      ),
    );

    return NextResponse.json({
      horizonCandles: horizonCandlesValue,
      itemCount: evaluations.length,
      evaluations,
      summary: summarizeForwardEvaluations(evaluations),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to evaluate scan history.",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

async function getEvaluationCandles(
  symbol: string,
  timeframe: Parameters<typeof getCandles>[1],
) {
  if (!isCloudflareDeployTarget()) {
    return getCandles(symbol, timeframe, 1000);
  }

  const store = await createD1MarketDataStore();

  try {
    const candles = await store.getCandles({ symbol, timeframe, limit: 1000 });

    if (candles.length > 0) {
      return candles;
    }
  } finally {
    await store.close?.();
  }

  return getCandles(symbol, timeframe, 1000);
}

async function createD1MarketDataStore() {
  const { createD1MarketDataStore: createStore } = await import(
    "@/lib/storage/d1MarketData"
  );
  return createStore();
}

async function getD1Snapshots(limit: number) {
  const { getRecentScanSnapshotsFromD1 } = await import(
    "@/lib/storage/d1ScanSnapshots"
  );
  return getRecentScanSnapshotsFromD1(limit);
}

async function getLocalSnapshots(limit: number) {
  const { getRecentScanSnapshots } = await import("@/lib/storage/scanSnapshots");
  return getRecentScanSnapshots(limit);
}

function localPersistenceUnavailableResponse() {
  return NextResponse.json(
    { error: localPersistenceUnavailableMessage },
    { status: 501 },
  );
}

function parseLimit(
  value: string | null,
  fallback: number,
  max: number,
  name: string,
) {
  if (value === null) {
    return { valid: true as const, value: fallback };
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    return {
      valid: false as const,
      error: `${name} must be an integer between 1 and ${max}.`,
    };
  }

  return { valid: true as const, value: parsed };
}
