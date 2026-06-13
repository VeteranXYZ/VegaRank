import { describe, expect, it } from "vitest";
import {
  buildCoinbaseSupplementalSymbolImportPlan,
} from "./coinbaseSupplementalImport";
import { listCoinbaseUsdcSpotListings, type CcxtClientLike } from "./providers/ccxtCoinbaseProvider";
import { parseMarketSymbol, type MarketListing } from "./symbolIdentity";
import type { PgSymbol } from "@/lib/storage/postgres/marketDataPg";

describe("Coinbase supplemental symbol import planning", () => {
  it("skips Coinbase symbols when Binance already covers the exact base", () => {
    const plan = buildCoinbaseSupplementalSymbolImportPlan({
      binanceSymbols: [
        binanceSymbol("BTCUSDT", "BTC"),
        binanceSymbol("ETHUSDT", "ETH"),
      ],
      coinbaseListings: [
        coinbaseListing("BTC-USDC", "BTC"),
        coinbaseListing("ABC-USDC", "ABC"),
      ],
      importedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(plan.coinbaseListingsFound).toBe(2);
    expect(plan.binanceBasesSelected).toBe(2);
    expect(plan.coinbaseSkippedBecauseBinanceCovered).toBe(1);
    expect(plan.coinbaseImported).toBe(1);
    expect(plan.skippedListings.map((listing) => listing.rawSymbol)).toEqual([
      "BTC-USDC",
    ]);
    expect(plan.importedSymbols).toMatchObject([
      {
        exchange: "coinbase",
        market: "spot",
        symbol: "ABC-USDC",
        baseAsset: "ABC",
        quoteAsset: "USDC",
        isEnabled: true,
        metadata: {
          providerSymbol: "ABC/USDC",
          canonicalAssetKey: "ABC",
          supplementalUniverse: true,
        },
      },
    ]);
  });

  it("does not alias related base assets during import planning", () => {
    const plan = buildCoinbaseSupplementalSymbolImportPlan({
      binanceSymbols: [
        binanceSymbol("BTCUSDT", "BTC"),
        binanceSymbol("SOLUSDT", "SOL"),
        binanceSymbol("SATSUSDT", "SATS"),
      ],
      coinbaseListings: [
        coinbaseListing("WBTC-USDC", "WBTC"),
        coinbaseListing("BNSOL-USDC", "BNSOL"),
        coinbaseListing("1000SATS-USDC", "1000SATS"),
      ],
      importedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(plan.importedSymbols.map((symbol) => symbol.symbol).sort()).toEqual([
      "1000SATS-USDC",
      "BNSOL-USDC",
      "WBTC-USDC",
    ]);
  });

  it("uses the Coinbase provider filter before import planning", async () => {
    const client: CcxtClientLike = {
      markets: {
        keep: {
          id: "ABC-USDC",
          symbol: "ABC/USDC",
          base: "ABC",
          quote: "USDC",
          active: true,
          spot: true,
          type: "spot",
        },
        inactive: {
          id: "OLD-USDC",
          symbol: "OLD/USDC",
          base: "OLD",
          quote: "USDC",
          active: false,
          spot: true,
          type: "spot",
        },
        nonUsdc: {
          id: "ABC-USD",
          symbol: "ABC/USD",
          base: "ABC",
          quote: "USD",
          active: true,
          spot: true,
          type: "spot",
        },
        nonSpot: {
          id: "PERP-USDC",
          symbol: "PERP/USDC",
          base: "PERP",
          quote: "USDC",
          active: true,
          spot: false,
          type: "swap",
        },
      },
      fetchOHLCV: async () => [],
    };

    const listings = await listCoinbaseUsdcSpotListings(client);
    const plan = buildCoinbaseSupplementalSymbolImportPlan({
      binanceSymbols: [],
      coinbaseListings: listings,
      importedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(listings.map((listing) => listing.rawSymbol)).toEqual(["ABC-USDC"]);
    expect(plan.importedSymbols.map((symbol) => symbol.symbol)).toEqual([
      "ABC-USDC",
    ]);
  });
});

function coinbaseListing(symbol: string, baseAsset: string): MarketListing {
  return parseMarketSymbol({
    exchange: "coinbase",
    market: "spot",
    rawSymbol: symbol,
    baseAsset,
    quoteAsset: "USDC",
    provider: "ccxt",
    providerSymbol: `${baseAsset}/USDC`,
    sourcePriority: 2,
    status: "active",
  });
}

function binanceSymbol(symbol: string, baseAsset: string): PgSymbol {
  return {
    id: 1,
    exchange: "binance",
    market: "spot",
    symbol,
    baseAsset,
    quoteAsset: "USDT",
    status: "TRADING",
    quoteVolume: null,
    priceChangePercent: null,
    isEnabled: true,
    assetClass: "crypto",
    isScannerEligible: true,
    isBacktestEligible: true,
    isMarketContext: false,
    metadata: {},
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}
