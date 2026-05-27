import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearMemoryCache } from "@/lib/cache/memory";
import { fetchBinance, getEligibleUsdtMarkets } from "./binance";

describe("Binance market eligibility", () => {
  beforeEach(() => {
    clearMemoryCache();
    vi.stubGlobal("fetch", vi.fn(mockBinanceFetch));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    clearMemoryCache();
  });

  it("excludes stablecoin, fiat-like, and leveraged base assets", async () => {
    const result = await getEligibleUsdtMarkets();
    const symbols = result.markets.map((market) => market.symbol);

    expect(symbols).toEqual([
      "BTCUSDT",
      "1000SATSUSDT",
      "1INCHUSDT",
      "1MBABYDOGEUSDT",
    ]);
    expect(symbols).not.toEqual(
      expect.arrayContaining([
        "BFUSDUSDT",
        "XUSDUSDT",
        "PAXGUSDT",
        "XAUTUSDT",
        "FRAXUSDT",
        "WBTCUSDT",
        "WBETHUSDT",
        "BNSOLUSDT",
        "PSGUSDT",
        "ATMUSDT",
        "PORTOUSDT",
        "LAZIOUSDT",
        "SANTOSUSDT",
        "ASRUSDT",
        "ACMUSDT",
        "BARUSDT",
        "JUVUSDT",
        "CITYUSDT",
        "ALPINEUSDT",
        "测试USDT",
      ]),
    );
    expect(result.totalUsdtPairs).toBe(35);
    expect(result.eligibleCount).toBe(4);
    expect(result.excludedStableOrLeveraged).toBe(31);
  });

  it("times out slow Binance requests with a clear message", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          });
        });
      }),
    );

    const request = fetchBinance("/api/v3/exchangeInfo");
    const expectation = expect(request).rejects.toThrow(
      "Binance request timed out after 10000ms",
    );
    await vi.advanceTimersByTimeAsync(10_000);

    await expectation;
  });
});

function mockBinanceFetch(input: RequestInfo | URL) {
  const url = String(input);

  if (url.includes("/api/v3/exchangeInfo")) {
    return jsonResponse({
      symbols: [
        makeSymbol("BTCUSDT", "BTC"),
        makeSymbol("1000SATSUSDT", "1000SATS"),
        makeSymbol("1INCHUSDT", "1INCH"),
        makeSymbol("1MBABYDOGEUSDT", "1MBABYDOGE"),
        makeSymbol("测试USDT", "测试"),
        makeSymbol("RLUSDUSDT", "RLUSD"),
        makeSymbol("BFUSDUSDT", "BFUSD"),
        makeSymbol("XUSDUSDT", "XUSD"),
        makeSymbol("PAXGUSDT", "PAXG"),
        makeSymbol("XAUTUSDT", "XAUT"),
        makeSymbol("FRAXUSDT", "FRAX"),
        makeSymbol("WBTCUSDT", "WBTC"),
        makeSymbol("WBETHUSDT", "WBETH"),
        makeSymbol("BNSOLUSDT", "BNSOL"),
        makeSymbol("UUSDT", "U"),
        makeSymbol("BRLUSDT", "BRL"),
        makeSymbol("TRYUSDT", "TRY"),
        makeSymbol("UAHUSDT", "UAH"),
        makeSymbol("ZARUSDT", "ZAR"),
        makeSymbol("IDRTUSDT", "IDRT"),
        makeSymbol("BIDRUSDT", "BIDR"),
        makeSymbol("USDDUSDT", "USDD"),
        makeSymbol("SUSDEUSDT", "SUSDE"),
        makeSymbol("PSGUSDT", "PSG"),
        makeSymbol("ATMUSDT", "ATM"),
        makeSymbol("PORTOUSDT", "PORTO"),
        makeSymbol("LAZIOUSDT", "LAZIO"),
        makeSymbol("SANTOSUSDT", "SANTOS"),
        makeSymbol("ASRUSDT", "ASR"),
        makeSymbol("ACMUSDT", "ACM"),
        makeSymbol("BARUSDT", "BAR"),
        makeSymbol("JUVUSDT", "JUV"),
        makeSymbol("CITYUSDT", "CITY"),
        makeSymbol("ALPINEUSDT", "ALPINE"),
        makeSymbol("ETHUPUSDT", "ETHUP"),
        makeSymbol("BTCDOWNUSDT", "BTCDOWN"),
      ],
    });
  }

  if (url.includes("/api/v3/ticker/24hr")) {
    return jsonResponse([
      { symbol: "BTCUSDT", quoteVolume: "1000000", priceChangePercent: "1" },
      { symbol: "1000SATSUSDT", quoteVolume: "900000", priceChangePercent: "1" },
      { symbol: "1INCHUSDT", quoteVolume: "800000", priceChangePercent: "1" },
      { symbol: "1MBABYDOGEUSDT", quoteVolume: "700000", priceChangePercent: "1" },
      { symbol: "测试USDT", quoteVolume: "2000000", priceChangePercent: "1" },
      { symbol: "RLUSDUSDT", quoteVolume: "1000000", priceChangePercent: "0" },
      { symbol: "BFUSDUSDT", quoteVolume: "1000000", priceChangePercent: "0" },
      { symbol: "XUSDUSDT", quoteVolume: "1000000", priceChangePercent: "0" },
      { symbol: "PAXGUSDT", quoteVolume: "1000000", priceChangePercent: "0" },
      { symbol: "XAUTUSDT", quoteVolume: "1000000", priceChangePercent: "0" },
      { symbol: "FRAXUSDT", quoteVolume: "1000000", priceChangePercent: "0" },
      { symbol: "WBTCUSDT", quoteVolume: "1000000", priceChangePercent: "0" },
      { symbol: "WBETHUSDT", quoteVolume: "1000000", priceChangePercent: "0" },
      { symbol: "BNSOLUSDT", quoteVolume: "1000000", priceChangePercent: "0" },
      { symbol: "UUSDT", quoteVolume: "1000000", priceChangePercent: "0" },
      { symbol: "BRLUSDT", quoteVolume: "1000000", priceChangePercent: "0" },
      { symbol: "TRYUSDT", quoteVolume: "1000000", priceChangePercent: "0" },
      { symbol: "UAHUSDT", quoteVolume: "1000000", priceChangePercent: "0" },
      { symbol: "ZARUSDT", quoteVolume: "1000000", priceChangePercent: "0" },
      { symbol: "IDRTUSDT", quoteVolume: "1000000", priceChangePercent: "0" },
      { symbol: "BIDRUSDT", quoteVolume: "1000000", priceChangePercent: "0" },
      { symbol: "USDDUSDT", quoteVolume: "1000000", priceChangePercent: "0" },
      { symbol: "SUSDEUSDT", quoteVolume: "1000000", priceChangePercent: "0" },
      { symbol: "PSGUSDT", quoteVolume: "1000000", priceChangePercent: "0" },
      { symbol: "ATMUSDT", quoteVolume: "1000000", priceChangePercent: "0" },
      { symbol: "PORTOUSDT", quoteVolume: "1000000", priceChangePercent: "0" },
      { symbol: "LAZIOUSDT", quoteVolume: "1000000", priceChangePercent: "0" },
      { symbol: "SANTOSUSDT", quoteVolume: "1000000", priceChangePercent: "0" },
      { symbol: "ASRUSDT", quoteVolume: "1000000", priceChangePercent: "0" },
      { symbol: "ACMUSDT", quoteVolume: "1000000", priceChangePercent: "0" },
      { symbol: "BARUSDT", quoteVolume: "1000000", priceChangePercent: "0" },
      { symbol: "JUVUSDT", quoteVolume: "1000000", priceChangePercent: "0" },
      { symbol: "CITYUSDT", quoteVolume: "1000000", priceChangePercent: "0" },
      { symbol: "ALPINEUSDT", quoteVolume: "1000000", priceChangePercent: "0" },
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
