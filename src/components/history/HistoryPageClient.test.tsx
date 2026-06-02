import { describe, expect, it } from "vitest";
import {
  buildHistoricalSnapshotUrl,
  buildHistoricalSnapshotsUrl,
} from "./HistoryPageClient";

describe("HistoryPageClient API URLs", () => {
  it("uses the public trade API historical snapshot endpoints", () => {
    expect(
      buildHistoricalSnapshotsUrl({
        timeframe: "4h",
        assetClass: "crypto",
        limit: 25,
        tradeApiBaseUrl: "https://api.auere.com/",
      }),
    ).toBe(
      "https://api.auere.com/api/history/snapshots?timeframe=4h&assetClass=crypto&limit=25",
    );
    expect(
      buildHistoricalSnapshotUrl({
        runId: "run-history-4h",
        assetClass: "crypto",
        tradeApiBaseUrl: "https://api.auere.com/",
      }),
    ).toBe(
      "https://api.auere.com/api/history/snapshot?runId=run-history-4h&assetClass=crypto",
    );
  });
});
