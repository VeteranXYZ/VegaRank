import { describe, expect, it } from "vitest";
import { summarizeScanSnapshots, type StoredScanSnapshot } from "./scanSnapshots";

describe("scan snapshot summaries", () => {
  it("summarizes stored scan snapshots by mode, signal, phase, and alignment", () => {
    const summary = summarizeScanSnapshots([
      makeSnapshot({
        mode: "mtf",
        createdAt: "2026-05-25T20:00:00.000Z",
        results: [
          {
            symbol: "BTCUSDT",
            signalState: "NEUTRAL",
            phase: "BASE_BUILDING",
            alignment: "CONFLICTING",
          },
          {
            symbol: "ETHUSDT",
            signalState: "HIGH_RISK",
            phase: "OVEREXTENDED",
            alignment: "HIGH_RISK",
          },
        ],
      }),
      makeSnapshot({
        mode: "single",
        createdAt: "2026-05-25T19:00:00.000Z",
        results: [
          {
            symbol: "BNBUSDT",
            signalState: "TREND_CONTINUATION",
            phase: "TRENDING",
          },
        ],
      }),
    ]);

    expect(summary.snapshotCount).toBe(2);
    expect(summary.resultCount).toBe(3);
    expect(summary.latestAt).toBe("2026-05-25T20:00:00.000Z");
    expect(summary.byMode).toEqual({ mtf: 1, single: 1 });
    expect(summary.bySignal).toMatchObject({
      NEUTRAL: 1,
      HIGH_RISK: 1,
      TREND_CONTINUATION: 1,
    });
    expect(summary.byPhase).toMatchObject({
      BASE_BUILDING: 1,
      OVEREXTENDED: 1,
      TRENDING: 1,
    });
    expect(summary.byAlignment).toEqual({
      CONFLICTING: 1,
      HIGH_RISK: 1,
    });
  });
});

function makeSnapshot({
  mode,
  createdAt,
  results,
}: {
  mode: StoredScanSnapshot["mode"];
  createdAt: string;
  results: Array<{
    symbol: string;
    signalState: StoredScanSnapshot["results"][number]["signalState"];
    phase: StoredScanSnapshot["results"][number]["phase"];
    alignment?: NonNullable<
      StoredScanSnapshot["results"][number]["multiTimeframe"]
    >["alignment"];
  }>;
}): StoredScanSnapshot {
  return {
    id: createdAt,
    createdAt,
    exchange: "binance",
    mode,
    timeframe: mode === "single" ? "4h" : undefined,
    preset: mode === "mtf" ? "swing" : undefined,
    timeframes: mode === "mtf" ? ["4h", "1d", "7d"] : undefined,
    limit: 3,
    itemCount: results.length,
    errorsCount: 0,
    results: results.map((result) => ({
      symbol: result.symbol,
      timeframe: "4h",
      price: 100,
      phase: result.phase,
      signalState: result.signalState,
      signalLabel: result.signalState,
      rankScore: 50,
      opportunityScore: 50,
      confirmationScore: 50,
      riskScore: 0,
      multiTimeframe: result.alignment
        ? {
            alignment: result.alignment,
            label: result.alignment,
            rankScore: 50,
            constructiveCount: 1,
            riskCount: 0,
            timeframes: ["4h", "1d", "7d"],
          }
        : undefined,
    })),
  };
}
