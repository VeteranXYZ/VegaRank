import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const TEST_TEMP_ROOT = path.join(process.cwd(), ".tmp", "test");

export function createTestTempPath(prefix: string) {
  return path.join(
    TEST_TEMP_ROOT,
    `${sanitizePrefix(prefix)}-${Date.now()}-${crypto.randomUUID()}`,
  );
}

export async function createTestTempDir(prefix: string) {
  const dir = createTestTempPath(prefix);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function cleanupTestTempDir(dir: string) {
  const resolvedDir = path.resolve(dir);
  const resolvedRoot = path.resolve(TEST_TEMP_ROOT);

  if (!resolvedDir.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`Refusing to cleanup unsafe test dir: ${dir}`);
  }

  await fs.rm(resolvedDir, { recursive: true, force: true });
}

function sanitizePrefix(prefix: string) {
  return prefix.replace(/[^a-zA-Z0-9_-]/g, "-");
}
