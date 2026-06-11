import { PgRankingResultsStore } from "@/lib/storage/postgres/rankingResultsPg";

async function main() {
  const execute = process.argv.includes("--execute");
  const store = new PgRankingResultsStore();

  try {
    const legacyCount = await store.countLegacyScanResults();

    if (!execute) {
      console.log(
        `Found ${legacyCount} legacy scan_signals rows. Re-run with --execute to delete them.`,
      );
      return;
    }

    const result = await store.deleteLegacyScanResults();

    console.log(
      `Deleted ${result.signalsDeleted} legacy scan_signals rows and ${result.scanRunsDeleted} orphan scan_runs rows.`,
    );
  } finally {
    await store.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
