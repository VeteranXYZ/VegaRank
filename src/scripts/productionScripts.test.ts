import {
  chmodSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const scriptPath = path.join(
  process.cwd(),
  "scripts/production/run-1h-production.sh",
);
const readText = (filePath: string) => readFileSync(filePath, "utf8");

describe("production scripts", () => {
  it("tracks the hourly 1h production job and README BaoTa command", () => {
    const script = readText(scriptPath);
    const readme = readText(path.join(process.cwd(), "README.md"));
    const backfillCommand =
      "pnpm market:backfill:pg -- --timeframe 1h --all-symbols --asset-class crypto --target-count 5000 --limit 1000 --confirm-large-sync";
    const scannerCommand =
      "pnpm scanner:run:pg -- --timeframe 1h --all-symbols --asset-class crypto --limit 1000 --confirm-large-sync";
    const baotaCommand =
      "cd /home/ubuntu/apps/trade-scanner && /home/ubuntu/apps/trade-scanner/scripts/production/run-1h-production.sh >> /home/ubuntu/apps/trade-scanner/.data/logs/run-1h-production.log 2>&1";

    expect(script).toContain("#!/usr/bin/env bash");
    expect(script).toContain("set -euo pipefail");
    expect(script).toContain("STALE_LOCK_SECONDS=5400");
    expect(script).toContain("source \".env\"");
    expect(script).toContain("DATABASE_URL REDIS_URL");
    expect(script).toContain("Missing required environment variables");
    expect(script).toContain("local status=$?");
    expect(script).toContain("exit \"$status\"");
    expect(script).toContain(".data/locks");
    expect(script).toContain("run-1h-production.lock");
    expect(script).toContain(backfillCommand);
    expect(script).toContain(scannerCommand);
    expect(readme).toContain(baotaCommand);
    expect(readme).toContain("every hour at minute 5");
  });

  it("preserves child command failures and releases the lock", () => {
    const projectDir = mkdtempSync(path.join(os.tmpdir(), "trade-scanner-prod-"));
    const binDir = path.join(projectDir, "bin");
    const fakePnpm = path.join(binDir, "pnpm");

    try {
      mkdirSync(binDir, { recursive: true });
      writeFileSync(
        path.join(projectDir, ".env"),
        [
          "DATABASE_URL=postgres://trade_scanner:test@localhost:5432/trade_scanner",
          "REDIS_URL=redis://localhost:6379",
          "",
        ].join("\n"),
      );
      writeFileSync(
        fakePnpm,
        "#!/usr/bin/env bash\nprintf 'fake pnpm failed\\n' >&2\nexit 7\n",
      );
      chmodSync(fakePnpm, 0o755);

      const result = spawnSync("bash", [scriptPath], {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${binDir}:${process.env.PATH ?? ""}`,
          PROJECT_DIR: projectDir,
        },
      });

      expect(result.status).toBe(7);
      expect(result.stdout).toContain("Loading environment from .env.");
      expect(result.stdout).toContain("Required environment variables are present.");
      expect(result.stdout).toContain(
        "Released lock: .data/locks/run-1h-production.lock",
      );
      expect(result.stdout).toContain("1h production job failed with exit code 7.");
      expect(result.stderr).toContain("fake pnpm failed");
      expect(
        existsSync(path.join(projectDir, ".data/locks/run-1h-production.lock")),
      ).toBe(false);
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });
});
