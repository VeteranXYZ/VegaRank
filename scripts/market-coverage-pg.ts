import { PgMarketDataStore } from "@/lib/storage/postgres/marketDataPg";
import {
  isSymbolAssetClassFilter,
  type SymbolAssetClassFilter,
} from "@/lib/market-data/symbolClassification";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const timeframe = flags.timeframe ?? "4h";
  const assetClass = parseAssetClass(flags.assetClass);
  const includeNonScanner = flags.includeNonScanner === "true";
  const limit = parseInteger({
    value: flags.limit,
    fallback: DEFAULT_LIMIT,
    min: 1,
    max: MAX_LIMIT,
    name: "limit",
  });
  const store = new PgMarketDataStore();

  try {
    const { rows, summary } = await store.listMarketDataCoverage({
      timeframe,
      limit,
      assetClass,
      includeNonScanner,
    });

    printJson({
      ok: true,
      timeframe,
      assetClass,
      includeNonScanner,
      itemCount: rows.length,
      summary,
      rows,
    });
  } catch {
    printJson({
      ok: false,
      error: {
        code: "POSTGRES_UNAVAILABLE",
        message: "PostgreSQL coverage query failed.",
      },
    });
    process.exitCode = 1;
  } finally {
    await store.close().catch(() => undefined);
  }
}

function parseAssetClass(value: string | undefined): SymbolAssetClassFilter {
  const assetClass = value?.trim().toLowerCase() ?? "crypto";

  if (!isSymbolAssetClassFilter(assetClass)) {
    throw new Error("asset-class must be one of crypto, stable, fiat, gold, special, all.");
  }

  return assetClass;
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

function parseInteger({
  value,
  fallback,
  min,
  max,
  name,
}: {
  value: string | undefined;
  fallback: number;
  min: number;
  max: number;
  name: string;
}) {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }

  return parsed;
}

function toCamelCase(value: string) {
  return value.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function printJson(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

main().catch(() => {
  printJson({
    ok: false,
    error: {
      code: "MARKET_COVERAGE_FAILED",
      message: "Market coverage command failed.",
    },
  });
  process.exitCode = 1;
});
