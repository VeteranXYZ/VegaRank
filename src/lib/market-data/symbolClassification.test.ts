import { describe, expect, it } from "vitest";
import { classifyUsdtSymbol } from "./symbolClassification";

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
});
