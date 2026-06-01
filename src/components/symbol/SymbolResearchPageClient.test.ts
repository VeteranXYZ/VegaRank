import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const useQueryMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());
const searchParamsMock = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-query", () => ({
  useQuery: useQueryMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => searchParamsMock(),
}));

import {
  buildScannerReturnHref,
  buildSymbolResearchSwitchHref,
  buildSymbolResearchTimeframeHref,
  buildSymbolResearchUrl,
  formatSymbolResearchApiError,
  getSymbolResearchApiOriginLabel,
  getTradeApiBaseUrl,
  normalizeSymbolResearchInputSymbol,
  SymbolResearchPageClient,
} from "./SymbolResearchPageClient";

const ORIGINAL_ENV = { ...process.env };

describe("symbol research API URL builder", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    process.env = { ...ORIGINAL_ENV, NODE_ENV: "test" };
    delete process.env.NEXT_PUBLIC_TRADE_API_BASE_URL;
  });

  afterAll(() => {
    vi.unstubAllEnvs();
    process.env = ORIGINAL_ENV;
  });

  it("uses NEXT_PUBLIC_TRADE_API_BASE_URL when present", () => {
    vi.stubEnv("NEXT_PUBLIC_TRADE_API_BASE_URL", "https://api.auere.com");

    const url = buildSymbolResearchUrl({
      exchange: "binance",
      symbol: "SEIUSDT",
    });

    expect(url.startsWith("https://api.auere.com")).toBe(true);
    expect(url).toContain("/api/symbol/research?");
  });

  it("falls back to same-origin symbol research API when the env var is missing", () => {
    expect(
      buildSymbolResearchUrl({
        exchange: "binance",
        symbol: "SEIUSDT",
      }),
    ).toBe(
      "/api/symbol/research?exchange=binance&market=spot&symbol=SEIUSDT&timeframe=4h&historyLimit=30&candleLimit=120&includeCandles=true&assetClass=crypto",
    );
  });

  it("uppercases symbol and defaults timeframe to 4h", () => {
    const url = buildSymbolResearchUrl({
      exchange: "binance",
      market: "spot",
      symbol: "seiusdt",
      tradeApiBaseUrl: "https://api.auere.com/",
    });

    expect(url).toContain("symbol=SEIUSDT");
    expect(url).toContain("timeframe=4h");
    expect(url.startsWith("https://api.auere.com/api/symbol/research")).toBe(true);
  });

  it("normalizes trailing slashes from the API base URL", () => {
    expect(getTradeApiBaseUrl("https://api.auere.com///")).toBe(
      "https://api.auere.com",
    );
  });

  it("reports only the API origin for diagnostics", () => {
    expect(getSymbolResearchApiOriginLabel("https://api.auere.com")).toBe(
      "https://api.auere.com",
    );
    expect(getSymbolResearchApiOriginLabel("https://api.auere.com/")).toBe(
      "https://api.auere.com",
    );
    expect(getSymbolResearchApiOriginLabel(undefined)).toBe("same-origin");
    expect(getSymbolResearchApiOriginLabel("")).toBe("same-origin");
    expect(getSymbolResearchApiOriginLabel("/api")).toBe("same-origin");
  });

  it("formats HTTP and API error details without needing the full URL", () => {
    expect(
      formatSymbolResearchApiError(503, {
        ok: false,
        error: { code: "POSTGRES_UNAVAILABLE", message: "Database unavailable" },
      }),
    ).toBe("HTTP 503: POSTGRES_UNAVAILABLE: Database unavailable");
    expect(
      formatSymbolResearchApiError(null, {
        ok: false,
        error: "NO_LATEST_SIGNAL",
      }),
    ).toBe(
      "No scanner signal is available for this symbol/timeframe from the selected latest run.",
    );
    expect(
      formatSymbolResearchApiError(404, {
        ok: false,
        error: "SYMBOL_NOT_FOUND",
      }),
    ).toBe("Symbol not found in scanner universe.");
    expect(
      formatSymbolResearchApiError(400, {
        ok: false,
        error: "INVALID_TIMEFRAME",
      }),
    ).toBe("Invalid timeframe. Try 1h, 4h, 1d, or 1w.");
  });
});

describe("symbol research navigation helpers", () => {
  it("builds scanner return hrefs from preserved query state", () => {
    expect(
      buildScannerReturnHref(
        new URLSearchParams("from=scanner&timeframe=4h&assetClass=crypto&limit=100"),
      ),
    ).toBe("/scanner?timeframe=4h&assetClass=crypto&limit=100");
    expect(
      buildScannerReturnHref(
        new URLSearchParams(
          "timeframe=1d&assetClass=stable&includeLowQuality=true&limit=200",
        ),
      ),
    ).toBe(
      "/scanner?timeframe=1d&assetClass=stable&includeLowQuality=true&limit=200",
    );
    expect(buildScannerReturnHref(new URLSearchParams())).toBe("/scanner");
  });

  it("falls back to current symbol research context for scanner returns", () => {
    expect(
      buildScannerReturnHref(new URLSearchParams(), {
        timeframe: "1w",
        assetClass: "crypto",
      }),
    ).toBe("/scanner?timeframe=1w&assetClass=crypto");
    expect(
      buildScannerReturnHref(
        new URLSearchParams("limit=200&includeLowQuality=true"),
        {
          timeframe: "1d",
          assetClass: "stable",
        },
      ),
    ).toBe(
      "/scanner?timeframe=1d&assetClass=stable&includeLowQuality=true&limit=200",
    );
  });

  it("does not preserve false low-quality query state", () => {
    expect(
      buildScannerReturnHref(
        new URLSearchParams("timeframe=4h&includeLowQuality=false&limit=100"),
      ),
    ).toBe("/scanner?timeframe=4h&limit=100");
  });

  it("builds timeframe switch hrefs while preserving scanner context", () => {
    expect(
      buildSymbolResearchTimeframeHref({
        exchange: "binance",
        symbol: "seiusdt",
        timeframe: "1d",
        searchParams: new URLSearchParams(
          "timeframe=4h&assetClass=crypto&includeLowQuality=true&limit=100&from=scanner",
        ),
      }),
    ).toBe(
      "/symbol/binance/SEIUSDT?timeframe=1d&assetClass=crypto&includeLowQuality=true&limit=100&from=scanner",
    );
  });

  it("normalizes symbol input and builds symbol switch hrefs", () => {
    expect(normalizeSymbolResearchInputSymbol("  sei/usdt  ")).toBe("SEI/USDT");
    expect(normalizeSymbolResearchInputSymbol("   ")).toBe("");

    expect(
      buildSymbolResearchSwitchHref({
        exchange: "binance",
        symbol: "  ethusdt ",
        timeframe: "4h",
        searchParams: new URLSearchParams("assetClass=crypto&limit=100&from=scanner"),
      }),
    ).toBe("/symbol/binance/ETHUSDT?timeframe=4h&assetClass=crypto&limit=100&from=scanner");
  });
});

describe("SymbolResearchPageClient unavailable state", () => {
  beforeEach(() => {
    pushMock.mockReset();
    searchParamsMock.mockReset();
    searchParamsMock.mockReturnValue(
      new URLSearchParams("timeframe=1w&assetClass=crypto&from=scanner"),
    );
    useQueryMock.mockReset();
  });

  it("renders insufficient-history unavailable copy with navigation controls", () => {
    useQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
      data: {
        ok: false,
        error: "NO_LATEST_SIGNAL",
        errorCode: "NO_LATEST_SIGNAL",
        unavailableReason: "insufficient_history",
        message:
          "No 1w scanner signal for SEIUSDT. The latest full-universe 1w scan ran successfully, but SEIUSDT was skipped because it has only 145 weekly candles. The scanner currently requires 200 candles.",
        timeframe: "1w",
        symbol: {
          exchange: "binance",
          market: "spot",
          symbol: "SEIUSDT",
          assetClass: "crypto",
        },
        selectedRun: {
          id: "full-1w",
          timeframe: "1w",
          status: "success",
          symbolsTotal: 413,
          symbolsScanned: 192,
          symbolsSkipped: 221,
          signalsCreated: 192,
          finishedAt: "2026-06-01T04:00:00.000Z",
          isLikelyFullUniverse: true,
        },
        symbolCoverage: {
          timeframe: "1w",
          candleCount: 145,
          requiredCandles: 200,
          firstOpenTime: "2023-08-14T00:00:00.000Z",
          lastOpenTime: "2026-05-25T00:00:00.000Z",
        },
      },
    });

    const html = renderToStaticMarkup(
      createElement(SymbolResearchPageClient, {
        exchange: "binance",
        symbol: "SEIUSDT",
      }),
    );

    expect(html).toContain("Timeframe unavailable for this symbol");
    expect(html).toContain("No 1w scanner signal for SEIUSDT");
    expect(html).toContain("145 / 200 required");
    expect(html).toContain("1w full-universe run, success, scanned 192 / 413, skipped 221");
    expect(html).toContain("Timeframe Availability");
    expect(html).toContain("1w (selected)");
    expect(html).toContain("Insufficient history");
    expect(html).toContain("Planned / Not configured");
    expect(html).toContain("Not configured");
    expect(html).toContain("Try 4h or 1d for SEIUSDT.");
    expect(html).toContain(
      "Refresh after the next scanner run; 1w coverage updates as more weekly candles accrue.",
    );
    expect(html).toContain("Back to Scanner");
    expect(html).toContain("Refresh");
    expect(html).toContain("Open Symbol");
    expect(html).toContain('href="/scanner?timeframe=1w&amp;assetClass=crypto');
    expect(html).toContain('href="/symbol/binance/SEIUSDT?timeframe=4h');
    expect(html).toContain('href="/symbol/binance/SEIUSDT?timeframe=1d');
    expect(html).toContain('href="/symbol/binance/SEIUSDT?timeframe=1w');
    expect(html).not.toContain('href="/symbol/binance/SEIUSDT?timeframe=1h');
  });
});
