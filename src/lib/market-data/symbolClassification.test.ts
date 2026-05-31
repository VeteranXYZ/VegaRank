import { describe, expect, it } from "vitest";
import { classifyUsdtSymbol, getSymbolQuality } from "./symbolClassification";

describe("symbol universe classification", () => {
  it("marks default crypto symbols as scanner and backtest eligible", () => {
    expect(classifyUsdtSymbol({ symbol: "BTCUSDT", baseAsset: "BTC" })).toEqual({
      assetClass: "crypto",
      isScannerEligible: true,
      isBacktestEligible: true,
      isMarketContext: false,
    });
  });

  it("excludes stable, fiat, and gold context symbols from the scanner", () => {
    expect(classifyUsdtSymbol({ symbol: "USDCUSDT", baseAsset: "USDC" })).toMatchObject({
      assetClass: "stable",
      isScannerEligible: false,
      isBacktestEligible: false,
      isMarketContext: true,
    });
    expect(classifyUsdtSymbol({ symbol: "EURUSDT", baseAsset: "EUR" })).toMatchObject({
      assetClass: "fiat",
      isScannerEligible: false,
      isBacktestEligible: false,
      isMarketContext: true,
    });
    expect(classifyUsdtSymbol({ symbol: "XAUTUSDT", baseAsset: "XAUT" })).toMatchObject({
      assetClass: "gold",
      isScannerEligible: false,
      isBacktestEligible: true,
      isMarketContext: true,
    });
  });

  it("marks clearly non-standard symbols as special", () => {
    expect(classifyUsdtSymbol({ symbol: "ETHUPUSDT", baseAsset: "ETHUP" })).toEqual({
      assetClass: "special",
      isScannerEligible: false,
      isBacktestEligible: false,
      isMarketContext: false,
    });
    expect(classifyUsdtSymbol({ symbol: "测试USDT", baseAsset: "测试" })).toEqual({
      assetClass: "special",
      isScannerEligible: false,
      isBacktestEligible: false,
      isMarketContext: false,
    });
  });

  it("assigns symbol quality tiers without changing asset class semantics", () => {
    expect(getSymbolQuality("BTCUSDT")).toMatchObject({
      qualityTier: "core",
      isLowQuality: false,
    });
    expect(getSymbolQuality("UUSDT")).toMatchObject({
      qualityTier: "special_or_suspicious",
      isLowQuality: true,
      qualityFlags: ["special_or_suspicious"],
    });
    expect(getSymbolQuality("1000CATUSDT")).toMatchObject({
      qualityTier: "meme",
      isLowQuality: true,
    });
    expect(getSymbolQuality("WBTCUSDT")).toMatchObject({
      qualityTier: "wrapped_or_staked",
      isLowQuality: true,
    });
  });

  it("flags low-history and recent listings", () => {
    const now = new Date("2026-05-31T00:00:00.000Z");

    expect(
      getSymbolQuality("NEWUSDT", {
        candleCount: 120,
        firstOpenTime: "2026-05-01T00:00:00.000Z",
        now,
      }),
    ).toMatchObject({
      qualityTier: "low_history",
      isLowQuality: true,
      qualityFlags: ["low_history", "new_listing"],
    });
  });
});
