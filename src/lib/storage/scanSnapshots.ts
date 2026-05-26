import { mkdir, readFile, appendFile } from "node:fs/promises";
import path from "node:path";
import {
  summarizeScanSnapshots,
  toStoredSnapshot,
  type PersistScanSnapshotInput,
  type ScanSnapshotMode,
  type StoredScanResult,
  type StoredScanSnapshot,
} from "./scanSnapshotModel";

export { summarizeScanSnapshots };
export type {
  PersistScanSnapshotInput,
  ScanSnapshotMode,
  StoredScanResult,
  StoredScanSnapshot,
};

const snapshotsFile = path.join(process.cwd(), ".data", "scan-snapshots.jsonl");

export async function persistScanSnapshot(input: PersistScanSnapshotInput) {
  const snapshot = toStoredSnapshot(input);

  await mkdir(path.dirname(snapshotsFile), { recursive: true });
  await appendFile(snapshotsFile, `${JSON.stringify(snapshot)}\n`, "utf8");

  return snapshot;
}

export async function safePersistScanSnapshot(input: PersistScanSnapshotInput) {
  try {
    return await persistScanSnapshot(input);
  } catch (error) {
    console.warn(
      "Failed to persist scan snapshot:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export async function getRecentScanSnapshots(limit = 20) {
  try {
    const content = await readFile(snapshotsFile, "utf8");
    const snapshots = content
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as StoredScanSnapshot);

    return snapshots.slice(-limit).reverse();
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}
