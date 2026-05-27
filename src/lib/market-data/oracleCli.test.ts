import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  cleanupTestTempDir,
  createTestTempDir,
} from "@/lib/test/testTempDir";

describe("Oracle VPS stage 1 CLI safety", () => {
  it("refuses market sync without an explicit symbol list or core universe", async () => {
    const result = await runNodeScript([
      "scripts/run-ts.mjs",
      "scripts/market.ts",
      "sync",
      "--dry-run",
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("will not default to all markets");
  });

  it("runs local scanner from an empty SQLite candle database without remote fetch", async () => {
    const dir = await createTestTempDir("oracle-cli-empty-market");
    try {
      const result = await runNodeScript(
        [
          "scripts/run-ts.mjs",
          "scripts/scanner.ts",
          "run",
          "--source=local",
          "--symbol=BTCUSDT",
          "--timeframe=4h",
        ],
        {
          MARKET_DATA_DB_PATH: path.join(dir, "market-data.sqlite"),
          SCANNER_RESEARCH_STORAGE: "disabled",
        },
      );

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('"symbolsScanned": 0');
      expect(result.stdout).toContain("Insufficient local candles for BTCUSDT 4h");
    } finally {
      await cleanupTestTempDir(dir);
    }
  });

  it("exports stable latest-scan JSON without local paths when storage is disabled", async () => {
    const result = await runNodeScript(
      ["scripts/run-ts.mjs", "scripts/scanner.ts", "export-latest"],
      { SCANNER_RESEARCH_STORAGE: "disabled" },
    );
    const exported = await readFile(
      path.join(process.cwd(), ".data", "public", "latest-scan.json"),
      "utf8",
    );

    expect(result.status).toBe(0);
    expect(exported).toContain('"results": []');
    expect(exported).not.toContain(process.cwd());
    expect(exported).not.toContain("/Users/");
  });
});

function runNodeScript(
  args: string[],
  env: Record<string, string> = {},
): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (status) => {
      resolve({ status, stdout, stderr });
    });
  });
}
