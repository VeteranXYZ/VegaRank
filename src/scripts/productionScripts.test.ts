import { readFileSync } from "node:fs";
import path from "node:path";
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
    expect(script).toContain(".data/locks");
    expect(script).toContain("run-1h-production.lock");
    expect(script).toContain(backfillCommand);
    expect(script).toContain(scannerCommand);
    expect(readme).toContain(baotaCommand);
    expect(readme).toContain("every hour at minute 5");
  });
});
