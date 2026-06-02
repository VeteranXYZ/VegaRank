import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarketContextPanel } from "@/components/market-context/MarketContextPanel";
import {
  WatchlistSummaryCards,
  WatchlistResearchSummaryPanel,
  WatchlistTable,
  buildWatchlistMtfLatestScanUrl,
} from "./WatchlistPageClient";
import {
  DEFAULT_WATCHLIST_SYMBOLS,
  buildWatchlistResearchSummary,
  buildWatchlistRows,
  getWatchlistSummary,
} from "./watchlistUi";
import {
  buildMtfScreenerRows,
  type MtfLatestScanResponse,
} from "@/components/screener/multiTimeframeScreenerUi";

describe("WatchlistPageClient", () => {
  it("uses the full multi-timeframe latest API endpoint", () => {
    expect(
      buildWatchlistMtfLatestScanUrl({
        assetClass: "crypto",
        tradeApiBaseUrl: "https://api.auere.com/",
      }),
    ).toBe("https://api.auere.com/api/scan/mtf-latest?assetClass=crypto");
  });

  it("renders default symbols and the watchlist table", () => {
    const rows = buildWatchlistRows(
      DEFAULT_WATCHLIST_SYMBOLS,
      buildMtfScreenerRows({
        "4h": makeResponse("4h", [
          makeItem({
            symbol: "BTCUSDT",
            timeframe: "4h",
            resultGroup: "watch",
            rankScore: 72.5,
          }),
        ]),
      }),
    );
    const html = renderToStaticMarkup(
      createElement(
        "div",
        null,
        createElement(WatchlistSummaryCards, {
          summary: getWatchlistSummary(rows),
        }),
        createElement(WatchlistResearchSummaryPanel, {
          summary: buildWatchlistResearchSummary(rows),
        }),
        createElement(WatchlistTable, { rows }),
      ),
    );

    expect(html).toContain("Total selected symbols");
    expect(html).toContain("Watchlist Research Summary");
    expect(html).toContain("Research posture");
    expect(html).toContain("Selected Symbols");
    expect(html).toContain("BTCUSDT");
    expect(html).toContain("SEIUSDT");
    expect(html).toContain("4h Group");
    expect(html).toContain("4h Rank");
    expect(html).toContain("72.5");
    expect(html).toContain("Not found");
  });

  it("renders missing timeframes and selected research links", () => {
    const rows = buildWatchlistRows(
      ["SEI", "LINK"],
      buildMtfScreenerRows({
        "1h": makeResponse("1h", [
          makeItem({
            symbol: "SEIUSDT",
            timeframe: "1h",
            resultGroup: "eligible",
            rankScore: 81,
          }),
        ]),
        "1d": makeResponse("1d", [
          makeItem({
            symbol: "LINKUSDT",
            timeframe: "1d",
            resultGroup: "risk",
            rankScore: 18,
          }),
        ]),
      }),
    );
    const html = renderToStaticMarkup(
      createElement(WatchlistTable, { rows }),
    );

    expect(html).toContain("Not returned");
    expect(html).toContain("Open 1h Research");
    expect(html).toContain("Open 1d Research");
    expect(html).toContain(
      'href="/symbol/binance/SEIUSDT?timeframe=1h&amp;assetClass=crypto&amp;from=watchlist"',
    );
  });

  it("renders all table rows by default without show-more behavior", () => {
    const symbols = ["AAA", "BBB", "CCC", "DDD", "EEE", "FFF", "GGG", "HHH"];
    const rows = buildWatchlistRows(
      symbols,
      buildMtfScreenerRows({
        "4h": makeResponse(
          "4h",
          symbols.map((symbol, index) =>
            makeItem({
              symbol: `${symbol}USDT`,
              timeframe: "4h",
              resultGroup: index % 2 === 0 ? "watch" : "neutral",
              rankScore: 60 + index,
            }),
          ),
        ),
      }),
    );
    const html = renderToStaticMarkup(
      createElement(WatchlistTable, { rows }),
    );

    for (const symbol of symbols) {
      expect(html).toContain(`${symbol}USDT`);
    }

    expect(html).toContain("8 watchlist rows");
    expect(html).not.toContain("Show More");
    expect(html).not.toContain("show more");
    expect(html).not.toContain("Pagination");
  });

  it("still renders watchlist rows when market context is unavailable", () => {
    const rows = buildWatchlistRows(
      ["BTC", "ETH"],
      buildMtfScreenerRows({
        "4h": makeResponse("4h", [
          makeItem({
            symbol: "BTCUSDT",
            timeframe: "4h",
            resultGroup: "risk",
            rankScore: -24,
          }),
          makeItem({
            symbol: "ETHUSDT",
            timeframe: "4h",
            resultGroup: "risk",
            rankScore: -20,
          }),
        ]),
      }),
    );
    const html = renderToStaticMarkup(
      createElement(
        "div",
        null,
        createElement(MarketContextPanel, { isError: true }),
        createElement(WatchlistTable, { rows }),
      ),
    );

    expect(html).toContain("Market context unavailable");
    expect(html).toContain("BTCUSDT");
    expect(html).toContain("ETHUSDT");
    expect(html).toContain("Selected Symbols");
  });

  it("renders compact remove actions when a row removal handler is provided", () => {
    const rows = buildWatchlistRows(
      ["BTC", "ETH"],
      buildMtfScreenerRows({
        "4h": makeResponse("4h", [
          makeItem({ symbol: "BTCUSDT", timeframe: "4h" }),
          makeItem({ symbol: "ETHUSDT", timeframe: "4h" }),
        ]),
      }),
    );
    const html = renderToStaticMarkup(
      createElement(WatchlistTable, {
        rows,
        onRemoveSymbol: () => undefined,
      }),
    );

    expect(html).toContain("Action");
    expect(html.match(/Remove/g)).toHaveLength(2);
  });
});

function makeResponse(
  timeframe: "1h" | "4h" | "1d" | "1w",
  items: MtfLatestScanResponse["items"],
): MtfLatestScanResponse {
  return {
    ok: true,
    timeframe,
    assetClass: "crypto",
    run: null,
    summary: null,
    count: items.length,
    items,
  };
}

function makeItem(
  overrides: Partial<MtfLatestScanResponse["items"][number]> & {
    symbol: string;
    timeframe: "1h" | "4h" | "1d" | "1w";
  },
): MtfLatestScanResponse["items"][number] {
  return {
    id: `${overrides.timeframe}-${overrides.symbol}`,
    symbol: overrides.symbol,
    exchange: "binance",
    market: "spot",
    timeframe: overrides.timeframe,
    resultGroup: overrides.resultGroup ?? "neutral",
    rankScore: overrides.rankScore ?? 0,
    signalLabel: overrides.signalLabel ?? "watch",
    detectedRiskTypes: overrides.detectedRiskTypes ?? [],
  };
}
