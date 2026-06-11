import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Timeframe } from "@/lib/exchanges/types";
import type { MtfPreset } from "@/lib/ranking-engine/multiTimeframe";
import {
  summarizeScanSnapshots,
  toStoredSnapshot,
  type PersistScanSnapshotInput,
  type ScanSnapshotMode,
  type StoredScanResult,
  type StoredScanSnapshot,
} from "./scanSnapshotModel";

type D1Result<T> = {
  results?: T[];
};

type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
  run(): Promise<unknown>;
};

type D1Database = {
  prepare(query: string): D1PreparedStatement;
};

type ScanSnapshotRow = {
  id: string;
  created_at: string;
  exchange: "binance";
  mode: ScanSnapshotMode;
  timeframe: Timeframe | null;
  preset: MtfPreset | null;
  timeframes_json: string | null;
  limit_value: number;
  item_count: number;
  errors_count: number;
  results_json: string;
};

export type ScanHistoryResponse = {
  snapshots: StoredScanSnapshot[];
  itemCount: number;
  summary: ReturnType<typeof summarizeScanSnapshots>;
};

export async function getD1Database() {
  const { env } = await getCloudflareContext({ async: true });
  return ((env as { DB?: D1Database }).DB ?? null) as D1Database | null;
}

export async function persistScanSnapshotToD1(input: PersistScanSnapshotInput) {
  const db = await getD1Database();

  if (!db) {
    throw new Error("D1 binding DB is not configured.");
  }

  const snapshot = toStoredSnapshot(input);

  await db
    .prepare(
      `
      INSERT OR REPLACE INTO scan_snapshots (
        id,
        created_at,
        exchange,
        mode,
        timeframe,
        preset,
        timeframes_json,
        limit_value,
        item_count,
        errors_count,
        results_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .bind(
      snapshot.id,
      snapshot.createdAt,
      snapshot.exchange,
      snapshot.mode,
      snapshot.timeframe ?? null,
      snapshot.preset ?? null,
      snapshot.timeframes ? JSON.stringify(snapshot.timeframes) : null,
      snapshot.limit,
      snapshot.itemCount,
      snapshot.errorsCount,
      JSON.stringify(snapshot.results),
    )
    .run();

  return snapshot;
}

export async function safePersistScanSnapshotToD1(input: PersistScanSnapshotInput) {
  try {
    return await persistScanSnapshotToD1(input);
  } catch (error) {
    console.warn(
      "Failed to persist D1 scan snapshot:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export async function getRecentScanSnapshotsFromD1(limit = 20) {
  const db = await getD1Database();

  if (!db) {
    throw new Error("D1 binding DB is not configured.");
  }

  const { results = [] } = await db
    .prepare(
      `
        SELECT
          id,
          created_at,
          exchange,
          mode,
          timeframe,
          preset,
          timeframes_json,
          limit_value,
          item_count,
          errors_count,
          results_json
        FROM scan_snapshots
        ORDER BY created_at DESC
        LIMIT ?
      `,
    )
    .bind(limit)
    .all<ScanSnapshotRow>()
    .catch((error: unknown) => {
      if (isMissingD1TableError(error)) {
        return { results: [] };
      }

      throw error;
    });

  return results.map(toStoredScanSnapshot);
}

export async function getScanHistoryFromD1(limit = 20): Promise<ScanHistoryResponse> {
  const snapshots = await getRecentScanSnapshotsFromD1(limit);

  return {
    snapshots,
    itemCount: snapshots.length,
    summary: summarizeScanSnapshots(snapshots),
  };
}

function toStoredScanSnapshot(row: ScanSnapshotRow): StoredScanSnapshot {
  return {
    id: row.id,
    createdAt: row.created_at,
    exchange: row.exchange,
    mode: row.mode,
    timeframe: row.timeframe ?? undefined,
    preset: row.preset ?? undefined,
    timeframes: parseJson<Timeframe[]>(row.timeframes_json) ?? undefined,
    limit: row.limit_value,
    itemCount: row.item_count,
    errorsCount: row.errors_count,
    results: parseJson<StoredScanResult[]>(row.results_json) ?? [],
  };
}

function parseJson<T>(value: string | null) {
  if (!value) {
    return null;
  }

  return JSON.parse(value) as T;
}

function isMissingD1TableError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.toLowerCase().includes("no such table")
  );
}
