import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement, type ComponentType } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildLimitedViewWarning,
  buildLatestRunSummaryText,
  buildLatestScanUrl,
  buildSymbolResearchHref,
  buildSymbolResearchPath,
  LatestScanPageClient,
  shouldShowIncompleteCryptoUniverseWarning,
} from "./LatestScanPageClient";
import { buildLatestScanPreviewResponse } from "./latestScanPreviewData";

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

describe("scanner symbol research links", () => {
  it("builds a deterministic symbol detail href with scanner context", () => {
    expect(
      buildSymbolResearchHref({
        exchange: "binance",
        symbol: "seiusdt",
        timeframe: "4h",
        assetClass: "crypto",
        includeLowQuality: true,
        limit: 100,
        from: "scanner",
      }),
    ).toBe(
      "/symbol/binance/SEIUSDT?timeframe=4h&assetClass=crypto&includeLowQuality=true&limit=100&from=scanner",
    );
  });

  it.each(["1d", "1w"] as const)(
    "preserves the active %s scanner timeframe in symbol detail hrefs",
    (timeframe) => {
      expect(
        buildSymbolResearchHref({
          exchange: "binance",
          symbol: "seiusdt",
          timeframe,
          assetClass: "crypto",
          includeLowQuality: false,
          limit: 200,
          from: "scanner",
        }),
      ).toBe(
        `/symbol/binance/SEIUSDT?timeframe=${timeframe}&assetClass=crypto&limit=200&from=scanner`,
      );
    },
  );

  it("preserves only true low-quality scanner context in symbol detail hrefs", () => {
    expect(
      buildSymbolResearchHref({
        exchange: "binance",
        symbol: "seiusdt",
        timeframe: "1w",
        assetClass: "crypto",
        includeLowQuality: "true",
        limit: "500",
        from: "scanner",
      }),
    ).toBe(
      "/symbol/binance/SEIUSDT?timeframe=1w&assetClass=crypto&includeLowQuality=true&limit=500&from=scanner",
    );
  });

  it("builds a safe symbol detail path with timeframe", () => {
    expect(
      buildSymbolResearchPath({
        exchange: "binance",
        symbol: "seiusdt",
        timeframe: "4h",
      }),
    ).toBe("/symbol/binance/SEIUSDT?timeframe=4h");
  });

  it("encodes exchange and symbol path segments", () => {
    expect(
      buildSymbolResearchPath({
        exchange: "binance spot",
        symbol: "sei/usdt",
        timeframe: "1d",
      }),
    ).toBe("/symbol/binance%20spot/SEI%2FUSDT?timeframe=1d");
  });

  it("does not include false low-quality state in symbol detail hrefs", () => {
    expect(
      buildSymbolResearchHref({
        exchange: null,
        symbol: "btc/usdt",
        timeframe: undefined,
        assetClass: "crypto",
        includeLowQuality: false,
        limit: 0,
        from: "scanner",
      }),
    ).toBe("/symbol/binance/BTC%2FUSDT?timeframe=4h&assetClass=crypto&from=scanner");
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
      "Limited view: showing the first 100 returned results from 364 filtered signals",
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

describe("LatestScanPageClient layout", () => {
  it("renders compact terminal strips, utility actions, and one sortable result table", () => {
    const html = renderLatestScanVisualPage();

    expect(html).toContain("terminal-command-band");
    expect(html).toContain("Run Summary");
    expect(html).toContain("Group Counts");
    expect(html).toContain("Latest Scan Rows");
    expect(html).toContain("Copy symbols");
    expect(html).toContain("Export CSV");
    expect(html).toContain('data-sort-key="symbol"');
    expect(html).toContain('data-sort-key="rank"');
    expect(html).toContain('data-sort-key="signal"');
    expect(html).toContain('data-sort-key="action"');
    expect(html).toContain('data-sort-key="setup"');
    expect(html).toContain('data-sort-key="quality"');
    expect(html).toContain('data-sort-key="price"');
    expect(html).toContain("Universe");
    expect(html).toContain("Low-quality");
    expect(html).toContain("Finished");
    expect(html).not.toContain("Interpretation Key");
    expect(html).not.toContain("Latest Scan Summary");
    expect(html).not.toContain("Full Universe Size");
    expect(html).not.toContain("<details");
    expect(html).not.toMatch(/AM|PM|Jun 05/);
  });
});

function renderLatestScanVisualPage() {
  const VisualLatestScanPage = LatestScanPageClient as ComponentType<{
    visualCheckData: ReturnType<typeof buildLatestScanPreviewResponse>;
  }>;
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(VisualLatestScanPage, {
        visualCheckData: buildLatestScanPreviewResponse(),
      }),
    ),
  );
}
