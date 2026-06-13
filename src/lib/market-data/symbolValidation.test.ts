import { describe, expect, it } from "vitest";
import {
  isValidMarketSymbol,
  normalizeMarketSymbolParam,
} from "./symbolValidation";

describe("market symbol validation", () => {
  it("accepts Binance and Coinbase spot symbol formats", () => {
    expect(isValidMarketSymbol("BTCUSDT")).toBe(true);
    expect(isValidMarketSymbol("BTC-USDC")).toBe(true);
  });

  it("rejects unsupported punctuation", () => {
    expect(isValidMarketSymbol("BTC/USDC")).toBe(false);
    expect(isValidMarketSymbol("BTC_USDC")).toBe(false);
    expect(isValidMarketSymbol("BTC.USDC")).toBe(false);
  });

  it("normalizes input before validation", () => {
    const symbol = normalizeMarketSymbolParam(" btc-usdc ");

    expect(symbol).toBe("BTC-USDC");
    expect(isValidMarketSymbol(symbol)).toBe(true);
  });
});
