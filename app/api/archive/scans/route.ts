import { NextResponse } from "next/server";

const disabledMessage =
  "Persistent research archive is not enabled in this deployment. VegaRank currently uses real-time Remote Binance rankings only.";

export const runtime = "nodejs";

const DEFAULT_HISTORY_LIMIT = 20;
const MAX_HISTORY_LIMIT = 100;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseLimit(
    searchParams.get("limit"),
    DEFAULT_HISTORY_LIMIT,
    MAX_HISTORY_LIMIT,
  );

  if (!limit.valid) {
    return NextResponse.json({ error: limit.error }, { status: 400 });
  }

  return NextResponse.json(
    {
      error: disabledMessage,
      snapshots: [],
      itemCount: 0,
      summary: {
        snapshotCount: 0,
        resultCount: 0,
        latestAt: null,
        byMode: {},
        bySignal: {},
        byPhase: {},
        byAlignment: {},
      },
    },
    { status: 501 },
  );
}

function parseLimit(value: string | null, fallback: number, max: number) {
  if (value === null) {
    return { valid: true as const, value: fallback };
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    return {
      valid: false as const,
      error: `limit must be an integer between 1 and ${max}.`,
    };
  }

  return { valid: true as const, value: parsed };
}
