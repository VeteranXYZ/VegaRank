import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  GET as getDataSync,
  POST as postDataSync,
} from "../../app/api/data/sync/route";
import { GET as getHistoryScans } from "../../app/api/archive/scans/route";

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
      new Request("http://localhost/api/archive/scans"),
    );
    const body = await response.json();

    expect(response.status).toBe(501);
    expect(body.error).toContain("Persistent research archive is not enabled");
  });

  it("blocks Cloudflare data sync instead of using a remote database", async () => {
    vi.stubEnv("DEPLOY_TARGET", "cloudflare");

    const response = await postDataSync(
      new Request("http://localhost/api/data/sync", {
        method: "POST",
        body: JSON.stringify({ mode: "incremental", timeframes: ["4h"] }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(501);
    expect(body.error).toContain("Local SQLite storage is only available");
  });
});
