import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildScannerReturnHref,
  buildSymbolResearchSwitchHref,
  buildSymbolResearchTimeframeHref,
  buildSymbolResearchUrl,
  formatSymbolResearchApiError,
  getSymbolResearchApiOriginLabel,
  getTradeApiBaseUrl,
  normalizeSymbolResearchInputSymbol,
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
    ).toBe("No selected latest signal found for this symbol/timeframe.");
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
