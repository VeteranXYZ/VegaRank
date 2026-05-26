import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearMemoryCache } from "@/lib/cache/memory";
import { getEligibleUsdtMarkets } from "./binance";

describe("Binance market eligibility", () => {
  beforeEach(() => {
    clearMemoryCache();
    vi.stubGlobal("fetch", vi.fn(mockBinanceFetch));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearMemoryCache();
  });

  it("excludes stablecoin, fiat-like, and leveraged base assets", async () => {
    const result = await getEligibleUsdtMarkets();

    expect(result.markets.map((market) => market.symbol)).toEqual(["BTCUSDT"]);
    expect(result.totalUsdtPairs).toBe(13);
    expect(result.eligibleCount).toBe(1);
    expect(result.excludedStableOrLeveraged).toBe(12);
  });
});

function mockBinanceFetch(input: RequestInfo | URL) {
  const url = String(input);

  if (url.includes("/api/v3/exchangeInfo")) {
    return jsonResponse({
      symbols: [
        makeSymbol("BTCUSDT", "BTC"),
        makeSymbol("RLUSDUSDT", "RLUSD"),
        makeSymbol("UUSDT", "U"),
        makeSymbol("BRLUSDT", "BRL"),
        makeSymbol("TRYUSDT", "TRY"),
        makeSymbol("UAHUSDT", "UAH"),
        makeSymbol("ZARUSDT", "ZAR"),
        makeSymbol("IDRTUSDT", "IDRT"),
        makeSymbol("BIDRUSDT", "BIDR"),
        makeSymbol("USDDUSDT", "USDD"),
        makeSymbol("SUSDEUSDT", "SUSDE"),
        makeSymbol("ETHUPUSDT", "ETHUP"),
        makeSymbol("BTCDOWNUSDT", "BTCDOWN"),
      ],
    });
  }

  if (url.includes("/api/v3/ticker/24hr")) {
    return jsonResponse([
      { symbol: "BTCUSDT", quoteVolume: "1000000", priceChangePercent: "1" },
      { symbol: "RLUSDUSDT", quoteVolume: "1000000", priceChangePercent: "0" },
      { symbol: "UUSDT", quoteVolume: "1000000", priceChangePercent: "0" },
      { symbol: "BRLUSDT", quoteVolume: "1000000", priceChangePercent: "0" },
      { symbol: "TRYUSDT", quoteVolume: "1000000", priceChangePercent: "0" },
      { symbol: "UAHUSDT", quoteVolume: "1000000", priceChangePercent: "0" },
      { symbol: "ZARUSDT", quoteVolume: "1000000", priceChangePercent: "0" },
      { symbol: "IDRTUSDT", quoteVolume: "1000000", priceChangePercent: "0" },
      { symbol: "BIDRUSDT", quoteVolume: "1000000", priceChangePercent: "0" },
      { symbol: "USDDUSDT", quoteVolume: "1000000", priceChangePercent: "0" },
      { symbol: "SUSDEUSDT", quoteVolume: "1000000", priceChangePercent: "0" },
      { symbol: "ETHUPUSDT", quoteVolume: "1000000", priceChangePercent: "0" },
      { symbol: "BTCDOWNUSDT", quoteVolume: "1000000", priceChangePercent: "0" },
    ]);
  }

  return jsonResponse({ message: "not found" }, 404);
}

function makeSymbol(symbol: string, baseAsset: string) {
  return {
    symbol,
    status: "TRADING",
    baseAsset,
    quoteAsset: "USDT",
    isSpotTradingAllowed: true,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}
