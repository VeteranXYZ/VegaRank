import { PgMarketDataStore } from "@/lib/storage/postgres/marketDataPg";

async function main() {
  const store = new PgMarketDataStore();

  try {
    const summary = await store.getSymbolsSummary();

    printJson({
      ok: true,
      ...summary,
    });
  } catch {
    printJson({
      ok: false,
      error: {
        code: "POSTGRES_UNAVAILABLE",
        message: "PostgreSQL symbols summary query failed.",
      },
    });
    process.exitCode = 1;
  } finally {
    await store.close().catch(() => undefined);
  }
}

function printJson(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

main().catch(() => {
  printJson({
    ok: false,
    error: {
      code: "SYMBOLS_SUMMARY_FAILED",
      message: "Symbols summary command failed.",
    },
  });
  process.exitCode = 1;
});
