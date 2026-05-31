import { afterEach, describe, expect, it, vi } from "vitest";
import { buildLatestScanUrl } from "./LatestScanPageClient";

const originalTradeApiBaseUrl = process.env.NEXT_PUBLIC_TRADE_API_BASE_URL;

describe("latest scan API URL builder", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    if (originalTradeApiBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_TRADE_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_TRADE_API_BASE_URL = originalTradeApiBaseUrl;
    }
  });

  it("uses NEXT_PUBLIC_TRADE_API_BASE_URL when present", () => {
    vi.stubEnv("NEXT_PUBLIC_TRADE_API_BASE_URL", "https://api.auere.com");

    const url = buildLatestScanUrl({
      timeframe: "4h",
      assetClass: "crypto",
      limit: 100,
    });

    expect(url).toBe(
      "https://api.auere.com/api/scan/latest?timeframe=4h&assetClass=crypto&limit=100",
    );
    expect(url.startsWith("https://api.auere.com")).toBe(true);
  });

  it("falls back to same-origin latest-scan API when the env var is missing", () => {
    delete process.env.NEXT_PUBLIC_TRADE_API_BASE_URL;

    const url = buildLatestScanUrl({
      timeframe: "4h",
      assetClass: "crypto",
      limit: 100,
    });

    expect(url).toBe("/api/scan/latest?timeframe=4h&assetClass=crypto&limit=100");
  });

  it("defaults the latest-scan limit to 100", () => {
    const url = buildLatestScanUrl({
      timeframe: "4h",
      assetClass: "crypto",
      tradeApiBaseUrl: "https://api.auere.com",
    });

    expect(url).toContain("limit=100");
  });
});
