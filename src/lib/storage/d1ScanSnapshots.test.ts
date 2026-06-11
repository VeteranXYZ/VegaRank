import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getRecentScanSnapshotsFromD1,
  persistScanSnapshotToD1,
} from "./d1ScanSnapshots";
import type { ScanResult } from "@/lib/ranking-engine/types";

const state = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  throwMissingTable: false,
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(async () => ({
    env: {
      DB: createFakeD1Database(state.rows),
    },
  })),
}));

describe("D1 scan snapshots", () => {
  beforeEach(() => {
    state.rows.length = 0;
    state.throwMissingTable = false;
  });

  it("persists and reads recent scan snapshots", async () => {
    await persistScanSnapshotToD1({
      createdAt: "2026-05-26T02:00:00.000Z",
      exchange: "binance",
      mode: "single",
      timeframe: "4h",
      limit: 1,
      itemCount: 1,
      errorsCount: 0,
      results: [makeResult()],
    });

    const snapshots = await getRecentScanSnapshotsFromD1(20);

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]?.mode).toBe("single");
    expect(snapshots[0]?.timeframe).toBe("4h");
    expect(snapshots[0]?.results[0]?.symbol).toBe("BTCUSDT");
  });

  it("returns an empty history when the D1 table has not been migrated yet", async () => {
    state.throwMissingTable = true;

    await expect(getRecentScanSnapshotsFromD1(20)).resolves.toEqual([]);
  });
});

function createFakeD1Database(rows: Array<Record<string, unknown>>) {
  return {
    prepare(sql: string) {
      return {
        values: [] as unknown[],
        bind(...values: unknown[]) {
          this.values = values;
          return this;
        },
        async run() {
          rows.unshift({
            id: this.values[0],
            created_at: this.values[1],
            exchange: this.values[2],
            mode: this.values[3],
            timeframe: this.values[4],
            preset: this.values[5],
            timeframes_json: this.values[6],
            limit_value: this.values[7],
            item_count: this.values[8],
            errors_count: this.values[9],
            results_json: this.values[10],
          });
        },
        async all<T>() {
          if (state.throwMissingTable) {
            throw new Error("D1_ERROR: no such table: scan_snapshots");
          }

          const limit = Number(this.values[0] ?? rows.length);
          const results = sql.includes("FROM scan_snapshots")
            ? rows.slice(0, limit)
            : [];
          return { results: results as T[] };
        },
      };
    },
  };
}

function makeResult(): ScanResult {
  return {
    exchange: "binance",
    symbol: "BTCUSDT",
    timeframe: "4h",
    price: 100,
    phase: "BASE_BUILDING",
    signal: {
      state: "NEUTRAL",
      label: "Neutral",
      summary: "No clear edge from the current ranking rules.",
    },
    opportunityScore: 50,
    confirmationScore: 30,
    riskScore: 10,
    trendScore: 35,
    momentumScore: 30,
    volumeScore: 25,
    structureScore: 40,
    finalSignalScore: 38,
    rankScore: 42,
    signalLabel: "neutral",
    actionBias: "ignore",
    primaryStructure: "neutral",
    secondaryStructures: [],
    detectedRiskTypes: [],
    bullishObservations: [],
    bearishObservations: [],
    riskObservations: [],
    neutralObservations: [],
    nextConfirmationObservations: [],
    invalidationObservations: [],
    rawMetrics: {
      price: 100,
      rsi: 55,
      bbPercent: null,
      volumeRatio: 1,
      macdState: null,
      closeAboveMA20: true,
      closeAboveMA50: true,
      closeAboveMA200: true,
      ma20AboveMA50: true,
      ma50AboveMA200: true,
    },
    rsi14: 55,
    bbPercent: null,
    bbWidthPercentile: 20,
    volumeRatio: 1,
    volume: {
      latest: 1000,
      ma20: null,
      ma50: null,
      ratio20: 1,
      ratio50: 1,
      dryUp: false,
      expanding: false,
      abnormalSpike: false,
      breakoutConfirmed: false,
      pullbackHealthy: false,
      distributionWarning: false,
    },
    maStatus: {
      aboveMA20: true,
      aboveMA50: true,
      aboveMA200: true,
      ma20AboveMA50: true,
      ma50AboveMA200: true,
    },
    reasons: [],
    warnings: [],
    nextConfirmation: [],
    invalidation: [],
    dataQuality: {
      candleCount: 300,
      sufficientHistory: true,
      missingIndicators: [],
    },
  };
}
