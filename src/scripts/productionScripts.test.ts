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
const sharedScriptPath = path.join(
  process.cwd(),
  "scripts/production/run-timeframe-production.sh",
);
const readText = (filePath: string) => readFileSync(filePath, "utf8");
const productionConfigs = [
  { timeframe: "1h", staleLockSeconds: "5400", targetCount: "5000" },
  { timeframe: "4h", staleLockSeconds: "14400", targetCount: "5000" },
  { timeframe: "1d", staleLockSeconds: "43200", targetCount: "3000" },
  { timeframe: "1w", staleLockSeconds: "86400", targetCount: "1000" },
] as const;

describe("production scripts", () => {
  it("tracks production timeframe scripts, package commands, and README BaoTa commands", () => {
    const sharedScript = readText(sharedScriptPath);
    const readme = readText(path.join(process.cwd(), "README.md"));
    const packageJson = JSON.parse(
      readText(path.join(process.cwd(), "package.json")),
    ) as { scripts: Record<string, string> };

    expect(sharedScript).toContain("#!/usr/bin/env bash");
    expect(sharedScript).toContain("set -euo pipefail");
    expect(sharedScript).toContain("source \".env\"");
    expect(sharedScript).toContain("DATABASE_URL REDIS_URL");
    expect(sharedScript).toContain("Missing required environment variables");
    expect(sharedScript).toContain("local status=$?");
    expect(sharedScript).toContain("exit \"$status\"");
    expect(sharedScript).toContain(".data/locks");
    expect(sharedScript).toContain("run-${TIMEFRAME}-production.lock");
    expect(sharedScript).toContain("pnpm market:backfill:pg");
    expect(sharedScript).toContain("pnpm scanner:run:pg");

    for (const { timeframe, staleLockSeconds, targetCount } of productionConfigs) {
      const wrapperPath = path.join(
        process.cwd(),
        `scripts/production/run-${timeframe}-production.sh`,
      );
      const wrapper = readText(wrapperPath);

      expect(sharedScript).toContain(`STALE_LOCK_SECONDS=${staleLockSeconds}`);
      expect(sharedScript).toContain(`TARGET_COUNT=${targetCount}`);
      expect(wrapper).toContain("set -euo pipefail");
      expect(wrapper).toContain(`run-timeframe-production.sh\" ${timeframe}`);
      expect(packageJson.scripts[`production:${timeframe}`]).toBe(
        `bash scripts/production/run-${timeframe}-production.sh`,
      );
      expect(readme).toContain(`pnpm production:${timeframe}`);
      expect(readme).toContain(`production-${timeframe}.log`);
    }

    expect(readme).toContain(
      "cd /home/ubuntu/apps/trade-scanner && /home/ubuntu/apps/trade-scanner/scripts/production/run-1h-production.sh >> /home/ubuntu/apps/trade-scanner/.data/logs/run-1h-production.log 2>&1",
    );
  });

  it.each(productionConfigs)(
    "runs %s backfill and scanner with timeframe-specific config",
    ({ timeframe, targetCount }) => {
      const projectDir = mkdtempSync(path.join(os.tmpdir(), "trade-scanner-prod-"));
      const binDir = path.join(projectDir, "bin");
      const fakePnpm = path.join(binDir, "pnpm");
      const callsFile = path.join(projectDir, "pnpm-calls.log");
      const wrapperPath = path.join(
        process.cwd(),
        `scripts/production/run-${timeframe}-production.sh`,
      );

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
          [
            "#!/usr/bin/env bash",
            "printf '%s\\n' \"$*\" >> \"$PNPM_CALLS_FILE\"",
            "exit 0",
            "",
          ].join("\n"),
        );
        chmodSync(fakePnpm, 0o755);

        const result = spawnSync("bash", [wrapperPath], {
          cwd: process.cwd(),
          encoding: "utf8",
          env: {
            ...process.env,
            PATH: `${binDir}:${process.env.PATH ?? ""}`,
            PNPM_CALLS_FILE: callsFile,
            PROJECT_DIR: projectDir,
          },
        });
        const calls = readText(callsFile);

        expect(result.status).toBe(0);
        expect(result.stdout).toContain(`Starting ${timeframe} production job.`);
        expect(result.stdout).toContain(
          `Acquired lock: .data/locks/run-${timeframe}-production.lock`,
        );
        expect(result.stdout).toContain(
          `Released lock: .data/locks/run-${timeframe}-production.lock`,
        );
        expect(calls).toContain(
          `market:backfill:pg -- --timeframe ${timeframe} --all-symbols --asset-class crypto --target-count ${targetCount} --limit 1000 --confirm-large-sync`,
        );
        expect(calls).toContain(
          `scanner:run:pg -- --timeframe ${timeframe} --all-symbols --asset-class crypto --limit 1000 --confirm-large-sync`,
        );
      } finally {
        rmSync(projectDir, { recursive: true, force: true });
      }
    },
  );

  it("rejects invalid production timeframe arguments clearly", () => {
    const result = spawnSync("bash", [sharedScriptPath, "2h"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Usage:");
    expect(result.stderr).toContain("<1h|4h|1d|1w>");
  });

  it("preserves child command failures and releases the timeframe lock", () => {
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
