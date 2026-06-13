import { classifyUsdtSymbol } from "@/lib/market-data/symbolClassification";
import {
  selectSupplementalUniverse,
  type ResearchUniverseRow,
} from "./supplementalUniverse";
import {
  parseMarketSymbol,
  type MarketListing,
} from "./symbolIdentity";
import type {
  PgSymbol,
  PgSymbolUpsertInput,
} from "@/lib/storage/postgres/marketDataPg";

export type CoinbaseSupplementalSymbolImportPlan = {
  coinbaseListingsFound: number;
  binanceBasesSelected: number;
  coinbaseSkippedBecauseBinanceCovered: number;
  coinbaseImported: number;
  importedSymbols: PgSymbolUpsertInput[];
  skippedListings: MarketListing[];
  selectedRows: ResearchUniverseRow[];
};

export function buildCoinbaseSupplementalSymbolImportPlan({
  binanceSymbols,
  coinbaseListings,
  enableImported = true,
  importedAt = new Date().toISOString(),
}: {
  binanceSymbols: PgSymbol[];
  coinbaseListings: MarketListing[];
  enableImported?: boolean;
  importedAt?: string;
}): CoinbaseSupplementalSymbolImportPlan {
  const primaryListings = binanceSymbols
    .map(pgSymbolToMarketListing)
    .filter((listing): listing is MarketListing => listing !== null);
  const selectedRows = selectSupplementalUniverse({
    primaryListings,
    supplementalListings: coinbaseListings,
  });
  const importedRawSymbols = new Set(
    selectedRows
      .filter((row) => row.exchange === "coinbase")
      .map((row) => row.rawSymbol),
  );
  const skippedListings = coinbaseListings.filter(
    (listing) => !importedRawSymbols.has(listing.rawSymbol),
  );
  const importedSymbols = coinbaseListings
    .filter((listing) => importedRawSymbols.has(listing.rawSymbol))
    .map((listing) =>
      coinbaseListingToPgSymbolUpsertInput({
        listing,
        enableImported,
        importedAt,
      }),
    );

  return {
    coinbaseListingsFound: coinbaseListings.length,
    binanceBasesSelected: new Set(primaryListings.map((listing) => listing.canonicalAssetKey))
      .size,
    coinbaseSkippedBecauseBinanceCovered: skippedListings.length,
    coinbaseImported: importedSymbols.length,
    importedSymbols,
    skippedListings,
    selectedRows,
  };
}

export function coinbaseListingToPgSymbolUpsertInput({
  listing,
  enableImported,
  importedAt,
}: {
  listing: MarketListing;
  enableImported: boolean;
  importedAt: string;
}): PgSymbolUpsertInput {
  const classification = classifyUsdtSymbol({
    symbol: `${listing.baseAsset}USDT`,
    baseAsset: listing.baseAsset,
  });

  return {
    exchange: "coinbase",
    market: "spot",
    symbol: listing.rawSymbol,
    baseAsset: listing.baseAsset,
    quoteAsset: listing.quoteAsset,
    status: listing.status ?? "active",
    quoteVolume: listing.quoteVolume,
    priceChangePercent: listing.priceChangePercent,
    isEnabled: enableImported,
    ...classification,
    metadata: {
      source: "coinbase",
      provider: listing.provider,
      providerSymbol: listing.providerSymbol,
      rawSymbol: listing.rawSymbol,
      canonicalAssetKey: listing.canonicalAssetKey,
      importedAt,
      supplementalUniverse: true,
    },
  };
}

function pgSymbolToMarketListing(symbol: PgSymbol): MarketListing | null {
  if (symbol.exchange !== "binance" || symbol.market !== "spot") {
    return null;
  }

  try {
    return parseMarketSymbol({
      assetClass: "crypto",
      exchange: "binance",
      market: "spot",
      rawSymbol: symbol.symbol,
      baseAsset: symbol.baseAsset,
      quoteAsset: symbol.quoteAsset,
      provider: "native-binance",
      providerSymbol: symbol.symbol,
      sourcePriority: 1,
      quoteVolume: symbol.quoteVolume ?? undefined,
      priceChangePercent: symbol.priceChangePercent ?? undefined,
      status: symbol.status,
    });
  } catch {
    return null;
  }
}
