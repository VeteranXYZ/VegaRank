import { NextResponse } from "next/server";
import {
  isLocalPersistenceDisabled,
  localPersistenceUnavailableMessage,
} from "@/lib/runtime/localPersistence";

export const runtime = "nodejs";

const DEFAULT_HISTORY_LIMIT = 20;
const MAX_HISTORY_LIMIT = 100;

export async function GET(request: Request) {
  if (isLocalPersistenceDisabled()) {
    return localPersistenceUnavailableResponse();
  }

  const { searchParams } = new URL(request.url);
  const limit = parseLimit(
    searchParams.get("limit"),
    DEFAULT_HISTORY_LIMIT,
    MAX_HISTORY_LIMIT,
  );

  if (!limit.valid) {
    return NextResponse.json({ error: limit.error }, { status: 400 });
  }

  try {
    const { getRecentScanSnapshots, summarizeScanSnapshots } = await import(
      "@/lib/storage/scanSnapshots"
    );
    const snapshots = await getRecentScanSnapshots(limit.value);

    return NextResponse.json({
      snapshots,
      itemCount: snapshots.length,
      summary: summarizeScanSnapshots(snapshots),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to read scan history.",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

function localPersistenceUnavailableResponse() {
  return NextResponse.json(
    { error: localPersistenceUnavailableMessage },
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
