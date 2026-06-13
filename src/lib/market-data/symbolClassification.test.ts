import { describe, expect, it } from "vitest";
import {
  classifyUsdtSymbol,
  getSymbolQuality,
  parseSymbolQualityIdentity,
} from "./symbolClassification";

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

  it("does not mark normal Coinbase USDC pairs stable-like or suspicious due to quote or dash", () => {
    for (const symbol of [
      "AERO-USDC",
      "AIOZ-USDC",
      "AKT-USDC",
      "ABT-USDC",
      "BADGER-USDC",
    ]) {
      const quality = getSymbolQuality(symbol, {
        exchange: "coinbase",
        baseAsset: symbol.split("-")[0],
        quoteAsset: "USDC",
        assetClass: "crypto",
      });

      expect(quality.qualityTier).not.toBe("stable_like");
      expect(quality.qualityFlags).not.toContain("stable_like");
      expect(quality.qualityFlags).not.toContain("special_or_suspicious");
    }
  });

  it("keeps Coinbase stable-like base assets stable-like", () => {
    for (const symbol of ["DAI-USDC", "PYUSD-USDC", "EURC-USDC", "USDT-USDC"]) {
      expect(
        getSymbolQuality(symbol, {
          exchange: "coinbase",
          baseAsset: symbol.split("-")[0],
          quoteAsset: "USDC",
          assetClass: "crypto",
        }),
      ).toMatchObject({
        qualityTier: "stable_like",
        qualityFlags: ["stable_like"],
      });
    }
  });

  it("preserves Binance quality behavior for core and stable-like USDT pairs", () => {
    expect(getSymbolQuality("BTCUSDT")).toMatchObject({
      qualityTier: "core",
      isLowQuality: false,
      qualityFlags: [],
    });
    expect(getSymbolQuality("ETHUSDT")).toMatchObject({
      qualityTier: "core",
      isLowQuality: false,
      qualityFlags: [],
    });
    expect(getSymbolQuality("USDCUSDT")).toMatchObject({
      qualityTier: "stable_like",
      qualityFlags: ["stable_like"],
    });
    expect(getSymbolQuality("FDUSDUSDT")).toMatchObject({
      qualityTier: "stable_like",
      qualityFlags: ["stable_like"],
    });
  });

  it("parses dashed Coinbase symbols into base and quote assets", () => {
    expect(parseSymbolQualityIdentity("AERO-USDC")).toMatchObject({
      baseAsset: "AERO",
      quoteAsset: "USDC",
      isDashedPair: true,
      isMalformedPair: false,
    });
    expect(parseSymbolQualityIdentity("BADGER-USDC")).toMatchObject({
      baseAsset: "BADGER",
      quoteAsset: "USDC",
      isDashedPair: true,
      isMalformedPair: false,
    });
    expect(parseSymbolQualityIdentity("AERO--USDC")).toMatchObject({
      baseAsset: "AERO--USDC",
      quoteAsset: null,
      isDashedPair: true,
      isMalformedPair: true,
    });
  });

  it("does not mark mixed letter-number Coinbase bases suspicious solely because they contain digits", () => {
    expect(
      getSymbolQuality("A8-USDC", {
        exchange: "coinbase",
        baseAsset: "A8",
        quoteAsset: "USDC",
        assetClass: "crypto",
      }),
    ).toMatchObject({
      qualityTier: "normal",
      qualityFlags: [],
    });
  });

  it("keeps all-numeric Coinbase bases explicit as special or suspicious", () => {
    expect(
      getSymbolQuality("00-USDC", {
        exchange: "coinbase",
        baseAsset: "00",
        quoteAsset: "USDC",
        assetClass: "crypto",
      }),
    ).toMatchObject({
      qualityTier: "special_or_suspicious",
      qualityFlags: ["special_or_suspicious"],
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
