import { NextResponse } from "next/server";
import { getResearchStats } from "@/lib/storage/researchStats";

export const runtime = "nodejs";

export async function GET() {
  try {
    const stats = await getResearchStats();
    return NextResponse.json(stats);
  } catch (error) {
    return NextResponse.json(
      {
        storageMode: "disabled",
        totalSnapshots: 0,
        totalSignals: 0,
        totalEvaluations: 0,
        pendingEvaluations: 0,
        insufficientDataCount: 0,
        scoringVersions: [],
        bySignalLabel: [],
        byActionBias: [],
        byRiskType: [],
        byTimeframe: [],
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 200 },
    );
  }
}
