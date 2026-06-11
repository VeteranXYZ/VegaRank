import { existsSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getArchiveEvaluate } from "../../app/api/archive/evaluate/route";
import { GET as getArchiveResearchStats } from "../../app/api/archive/research-stats/route";
import { GET as getArchiveScans } from "../../app/api/archive/scans/route";

const getResearchStatsMock = vi.hoisted(() => vi.fn());
const runResearchEvaluationJobMock = vi.hoisted(() => vi.fn());
const getScannerStorageAdapterMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/storage/researchStats", () => ({
  getResearchStats: getResearchStatsMock,
}));

vi.mock("@/lib/storage/researchEvaluationJob", () => ({
  runResearchEvaluationJob: runResearchEvaluationJobMock,
}));

vi.mock("@/lib/storage/storageAdapter", () => ({
  getScannerStorageAdapter: getScannerStorageAdapterMock,
}));

vi.mock("@/lib/storage/scanEvaluation", () => ({
  summarizeForwardEvaluations: () => ({
    evaluationCount: 0,
    completedCount: 0,
    pendingCount: 0,
  }),
}));

describe("archive route surface", () => {
  beforeEach(() => {
    getResearchStatsMock.mockReset();
    runResearchEvaluationJobMock.mockReset();
    getScannerStorageAdapterMock.mockReset();
  });

  it("does not keep old public scanner/history page or API route files", () => {
    for (const routeFile of [
      "app/scanner/page.tsx",
      "app/scanner/visual-check/page.tsx",
      "app/history/page.tsx",
      "app/history/visual-check/page.tsx",
      "app/api/scan/route.ts",
      "app/api/scan/mtf/route.ts",
      "app/api/history/evaluate/route.ts",
      "app/api/history/research-stats/route.ts",
      "app/api/history/scans/route.ts",
    ]) {
      expect(existsSync(path.join(process.cwd(), routeFile)), routeFile).toBe(false);
    }
  });

  it("keeps the VegaRank public page and archive utility route files", () => {
    for (const routeFile of [
      "app/rankings/page.tsx",
      "app/rankings/visual-check/page.tsx",
      "app/archive/page.tsx",
      "app/archive/visual-check/page.tsx",
      "app/api/rankings/route.ts",
      "app/api/rankings/mtf/route.ts",
      "app/api/archive/evaluate/route.ts",
      "app/api/archive/research-stats/route.ts",
      "app/api/archive/scans/route.ts",
    ]) {
      expect(existsSync(path.join(process.cwd(), routeFile)), routeFile).toBe(true);
    }
  });

  it("serves archive utility routes without restoring history aliases", async () => {
    getResearchStatsMock.mockResolvedValue({
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
    });
    runResearchEvaluationJobMock.mockResolvedValue({ evaluated: 0 });
    getScannerStorageAdapterMock.mockResolvedValue({ mode: "disabled" });

    const scansResponse = await getArchiveScans(
      new Request("http://localhost/api/archive/scans"),
    );
    const statsResponse = await getArchiveResearchStats();
    const evaluateResponse = await getArchiveEvaluate(
      new Request("http://localhost/api/archive/evaluate?horizon=24h&limit=10"),
    );

    expect(scansResponse.status).toBe(501);
    expect(statsResponse.status).toBe(200);
    expect(evaluateResponse.status).toBe(200);
  });
});
