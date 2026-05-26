import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getDataSync } from "../../app/api/data/sync/route";
import { GET as getHistoryScans } from "../../app/api/history/scans/route";

vi.mock("@/lib/storage/marketData", () => {
  throw new Error("Local SQLite storage was imported");
});

vi.mock("@/lib/storage/marketDataSync", () => {
  throw new Error("Local market data sync was imported");
});

vi.mock("@/lib/storage/scanSnapshots", () => {
  throw new Error("Local scan snapshot storage was imported");
});

describe("local persistence route guards", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("DISABLE_LOCAL_SQLITE", "true");
  });

  it("blocks local data sync without importing SQLite storage", async () => {
    const response = await getDataSync();
    const body = await response.json();

    expect(response.status).toBe(501);
    expect(body.error).toContain("Local SQLite storage is only available");
  });

  it("blocks local history without importing filesystem storage", async () => {
    const response = await getHistoryScans(
      new Request("http://localhost/api/history/scans"),
    );
    const body = await response.json();

    expect(response.status).toBe(501);
    expect(body.error).toContain("Local SQLite storage is only available");
  });
});
