import {
  createCcxtCoinbaseClient,
  createCcxtCoinbaseProvider,
} from "@/lib/market-data/providers/ccxtCoinbaseProvider";
import { buildCoinbaseSupplementalSymbolImportPlan } from "@/lib/market-data/coinbaseSupplementalImport";
import { PgMarketDataStore } from "@/lib/storage/postgres/marketDataPg";

type ImportOptions = {
  dryRun: boolean;
  enableImported: boolean;
};

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const client = await createCcxtCoinbaseClient();
  const provider = createCcxtCoinbaseProvider(client);
  const store = new PgMarketDataStore();

  try {
    const [coinbaseListings, binanceSymbols] = await Promise.all([
      provider.listMarkets(),
      store.listSymbols({
        exchange: "binance",
        market: "spot",
        limit: null,
        assetClass: "all",
        includeNonScanner: true,
      }),
    ]);
    const plan = buildCoinbaseSupplementalSymbolImportPlan({
      coinbaseListings,
      binanceSymbols,
      enableImported: options.enableImported,
    });
    const upserted = options.dryRun
      ? []
      : await store.upsertImportedSymbols(plan.importedSymbols);

    printJson({
      ok: true,
      dryRun: options.dryRun,
      enableImported: options.enableImported,
      coinbaseUsdcProductsFound: plan.coinbaseListingsFound,
      binanceBasesSelected: plan.binanceBasesSelected,
      coinbaseSkippedBecauseBinanceCovered:
        plan.coinbaseSkippedBecauseBinanceCovered,
      coinbaseImported: plan.coinbaseImported,
      createdOrUpdated: options.dryRun ? 0 : upserted.length,
      importedExamples: plan.importedSymbols.slice(0, 20).map((symbol) => symbol.symbol),
      skippedExamples: plan.skippedListings
        .slice(0, 20)
        .map((listing) => listing.rawSymbol),
    });
  } finally {
    await store.close().catch(() => undefined);
  }
}

function parseOptions(args: string[]): ImportOptions {
  const flags = parseFlags(args);

  return {
    dryRun: flags.dryRun === "true",
    enableImported: flags.enableImported === undefined
      ? true
      : parseBoolean(flags.enableImported, "enable-imported"),
  };
}

function parseFlags(args: string[]) {
  const flags: Record<string, string | undefined> = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg.startsWith("--")) {
      continue;
    }

    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    const nextValue = args[index + 1];

    if (inlineValue !== undefined) {
      flags[toCamelCase(rawKey)] = inlineValue;
      continue;
    }

    if (nextValue && !nextValue.startsWith("--")) {
      flags[toCamelCase(rawKey)] = nextValue;
      index += 1;
      continue;
    }

    flags[toCamelCase(rawKey)] = "true";
  }

  return flags;
}

function parseBoolean(value: string, name: string) {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(`${name} must be true or false.`);
}

function toCamelCase(value: string) {
  return value.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function printJson(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

if (process.argv[1]?.endsWith("import-coinbase-usdc-symbols-pg.ts")) {
  main().catch((error) => {
    console.error(
      error instanceof Error
        ? error.message
        : "Coinbase USDC symbol import failed.",
    );
    process.exitCode = 1;
  });
}
