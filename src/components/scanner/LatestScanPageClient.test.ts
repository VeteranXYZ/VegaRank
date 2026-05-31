import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildLimitedViewWarning,
  buildLatestRunSummaryText,
  buildLatestScanUrl,
  shouldShowIncompleteCryptoUniverseWarning,
} from "./LatestScanPageClient";

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

describe("latest scan summary helpers", () => {
  it("summarizes the full latest scan run in practical wording", () => {
    expect(
      buildLatestRunSummaryText({
        symbolsTotal: 413,
        symbolsScanned: 409,
        signalsCreated: 409,
        symbolsSkipped: 4,
        returnedItems: 100,
        totalSignals: 409,
        lowQualityExcluded: 12,
      }),
    ).toBe(
      "Full universe size: 413 · Scanned: 409 · Signals created: 409 · Skipped: 4 · Filtered signals shown: 100 of 409 · Low-quality excluded: 12",
    );
  });

  it("warns when a crypto latest scan is too small to look like a full universe", () => {
    expect(
      shouldShowIncompleteCryptoUniverseWarning({
        assetClass: "crypto",
        symbolsTotal: 299,
      }),
    ).toBe(true);
    expect(
      shouldShowIncompleteCryptoUniverseWarning({
        assetClass: "crypto",
        symbolsTotal: 413,
      }),
    ).toBe(false);
    expect(
      shouldShowIncompleteCryptoUniverseWarning({
        assetClass: "stable",
        symbolsTotal: 20,
      }),
    ).toBe(false);
  });

  it("explains when API limit hides part of the filtered signal set", () => {
    expect(
      buildLimitedViewWarning({
        count: 100,
        returnedItems: 100,
        totalSignals: 364,
      }),
    ).toBe(
      "Limited view: showing the first 100 returned results from 364 filtered signals. Some groups may not appear until you increase API Limit.",
    );
    expect(
      buildLimitedViewWarning({
        count: 364,
        returnedItems: 364,
        totalSignals: 364,
      }),
    ).toBeNull();
  });
});
