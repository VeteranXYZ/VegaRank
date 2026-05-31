import { fetchWithTimeout } from "@/lib/exchanges/binance";
import { getBinancePublicBaseUrl } from "@/lib/market-data/binanceConfig";
import {
  classifyUsdtSymbol,
  emptyAssetClassCounts,
} from "@/lib/market-data/symbolClassification";
import {
  PgMarketDataStore,
  type PgSymbolUpsertInput,
} from "@/lib/storage/postgres/marketDataPg";

type ImportOptions = {
  quote: string;
  enableImported: boolean;
  dryRun: boolean;
};

type BinanceExchangeInfo = {
  symbols: BinanceExchangeSymbol[];
};

type BinanceExchangeSymbol = {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
  isSpotTradingAllowed?: boolean;
  permissions?: string[];
  orderTypes?: string[];
  filters?: BinanceSymbolFilter[];
};

type BinanceSymbolFilter = Record<string, string | number | boolean | null>;

type BinanceTicker24h = {
  symbol: string;
  quoteVolume: string;
  priceChangePercent: string;
};

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const baseUrl = getBinancePublicBaseUrl();
  const [exchangeInfo, tickers] = await Promise.all([
    fetchBinanceJson<BinanceExchangeInfo>("/api/v3/exchangeInfo"),
    fetchBinanceJson<BinanceTicker24h[]>("/api/v3/ticker/24hr"),
  ]);
  const tickerBySymbol = new Map(tickers.map((ticker) => [ticker.symbol, ticker]));
  const importedAt = new Date().toISOString();
  const imported = exchangeInfo.symbols
    .filter((symbol) => {
      return (
        symbol.status === "TRADING" &&
        symbol.isSpotTradingAllowed !== false &&
        symbol.quoteAsset === options.quote
      );
    })
    .map((symbol): PgSymbolUpsertInput => {
      const ticker = tickerBySymbol.get(symbol.symbol);
      const classification = classifyUsdtSymbol({
        symbol: symbol.symbol,
        baseAsset: symbol.baseAsset,
      });

      return {
        exchange: "binance",
        symbol: symbol.symbol,
        baseAsset: symbol.baseAsset,
        quoteAsset: symbol.quoteAsset,
        status: symbol.status,
        quoteVolume: ticker ? Number(ticker.quoteVolume) : 0,
        priceChangePercent: ticker ? Number(ticker.priceChangePercent) : undefined,
        isEnabled: options.enableImported,
        ...classification,
        metadata: {
          source: "binance",
          importedAt,
          permissions: symbol.permissions ?? [],
          orderTypes: symbol.orderTypes ?? [],
          filters: summarizeFilters(symbol.filters ?? []),
        },
      };
    })
    .sort((left, right) => (right.quoteVolume ?? 0) - (left.quoteVolume ?? 0));

  let createdOrUpdated = imported.length;

  if (!options.dryRun) {
    const store = new PgMarketDataStore();

    try {
      createdOrUpdated = (await store.upsertImportedSymbols(imported)).length;
    } finally {
      await store.close().catch(() => undefined);
    }
  }

  const byAssetClass = emptyAssetClassCounts();

  for (const symbol of imported) {
    byAssetClass[symbol.assetClass] += 1;
  }

  printJson({
    ok: true,
    quote: options.quote,
    baseUrl,
    dryRun: options.dryRun,
    imported: imported.length,
    createdOrUpdated,
    byAssetClass,
    scannerEligible: imported.filter((symbol) => symbol.isScannerEligible).length,
    marketContext: imported.filter((symbol) => symbol.isMarketContext).length,
    top20: imported.slice(0, 20).map((symbol) => symbol.symbol),
  });
}

async function fetchBinanceJson<T>(path: string) {
  const response = await fetchWithTimeout(`${getBinancePublicBaseUrl()}${path}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Binance request failed with ${response.status}.`);
  }

  return response.json() as Promise<T>;
}

function summarizeFilters(filters: BinanceSymbolFilter[]) {
  return filters.map((filter) => {
    const filterType = String(filter.filterType ?? "");

    switch (filterType) {
      case "PRICE_FILTER":
        return pickFilter(filter, ["filterType", "minPrice", "maxPrice", "tickSize"]);
      case "LOT_SIZE":
        return pickFilter(filter, ["filterType", "minQty", "maxQty", "stepSize"]);
      case "MIN_NOTIONAL":
      case "NOTIONAL":
        return pickFilter(filter, [
          "filterType",
          "minNotional",
          "maxNotional",
          "applyMinToMarket",
          "applyMaxToMarket",
        ]);
      default:
        return pickFilter(filter, ["filterType"]);
    }
  });
}

function pickFilter(filter: BinanceSymbolFilter, keys: string[]) {
  return Object.fromEntries(
    keys
      .filter((key) => filter[key] !== undefined)
      .map((key) => [key, filter[key]]),
  );
}

function parseOptions(args: string[]): ImportOptions {
  const flags = parseFlags(args);
  const quote = (flags.quote ?? "USDT").trim().toUpperCase();

  if (!/^[A-Z0-9]{2,12}$/.test(quote)) {
    throw new Error("quote must be an uppercase asset code such as USDT.");
  }

  return {
    quote,
    enableImported:
      flags.enableImported === undefined ? true : parseBooleanFlag(flags.enableImported),
    dryRun: flags.dryRun === "true",
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

function parseBooleanFlag(value: string) {
  return value !== "false" && value !== "0";
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
      code: "SYMBOL_IMPORT_FAILED",
      message: "Binance symbols import failed.",
    },
  });
  process.exitCode = 1;
});
