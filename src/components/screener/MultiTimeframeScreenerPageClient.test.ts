import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarketContextPanel } from "@/components/market-context/MarketContextPanel";
import {
  buildMtfLatestScanUrl,
  MtfResearchBucketsPanel,
  MtfScreenerTable,
} from "./MultiTimeframeScreenerPageClient";
import {
  buildMtfScreenerRows,
  type MtfLatestScanResponse,
} from "./multiTimeframeScreenerUi";

describe("MultiTimeframeScreenerTable", () => {
  it("uses the full multi-timeframe latest API endpoint", () => {
    expect(
      buildMtfLatestScanUrl({
        assetClass: "crypto",
        tradeApiBaseUrl: "https://api.auere.com/",
      }),
    ).toBe("https://api.auere.com/api/scan/mtf-latest?assetClass=crypto");
  });

  it("renders the research buckets panel with conservative copy and counts", () => {
    const rows = buildMtfScreenerRows({
      "1h": makeResponse("1h", [
        makeItem({ symbol: "REPAIRUSDT", timeframe: "1h", resultGroup: "watch" }),
        makeItem({ symbol: "MTFUSDT", timeframe: "1h", resultGroup: "eligible" }),
        makeItem({ symbol: "HOTUSDT", timeframe: "1h", resultGroup: "overheated" }),
      ]),
      "4h": makeResponse("4h", [
        makeItem({ symbol: "REPAIRUSDT", timeframe: "4h", resultGroup: "watch" }),
        makeItem({ symbol: "MTFUSDT", timeframe: "4h", resultGroup: "eligible" }),
      ]),
      "1d": makeResponse("1d", [
        makeItem({ symbol: "REPAIRUSDT", timeframe: "1d", resultGroup: "neutral" }),
        makeItem({ symbol: "MTFUSDT", timeframe: "1d", resultGroup: "watch" }),
      ]),
      "1w": makeResponse("1w", [
        makeItem({ symbol: "REPAIRUSDT", timeframe: "1w", resultGroup: "neutral" }),
        makeItem({ symbol: "MTFUSDT", timeframe: "1w", resultGroup: "neutral" }),
      ]),
    });
    const html = renderToStaticMarkup(
      createElement(MtfResearchBucketsPanel, {
        rows,
        presetId: "custom",
        isFullTableActive: true,
        onBucketSelect: noop,
        onClear: noop,
      }),
    );

    expect(html).toContain("Research Buckets");
    expect(html).toContain("research starting points");
    expect(html).toContain("Research-only. Not financial advice.");
    expect(html).toContain("Full Table");
    expect(html).toContain("3 joined symbols");
    expect(html).toContain("Short-term Repair");
    expect(html).toContain("MTF Strength");
    expect(html).toContain("Higher-TF Watchlist");
    expect(html).toContain("matching symbols");
    expect(html).toContain(">2</span>");
    expect(html).not.toContain("Best");
    expect(html).not.toContain("Opportunity");
    expect(html).not.toContain("Picks");
  });

  it("renders missing timeframes and symbol research links", () => {
    const rows = buildMtfScreenerRows({
      "1h": {
        ok: true,
        timeframe: "1h",
        assetClass: "crypto",
        run: null,
        summary: null,
        count: 1,
        items: [
          {
            id: "signal-1h",
            symbol: "SEIUSDT",
            exchange: "binance",
            market: "spot",
            timeframe: "1h",
            resultGroup: "eligible",
            rankScore: 88.2,
            signalLabel: "confirmed",
            detectedRiskTypes: [],
          },
        ],
      } satisfies MtfLatestScanResponse,
    });
    const html = renderToStaticMarkup(
      createElement(MtfScreenerTable, { rows }),
    );

    expect(html).toContain("SEIUSDT");
    expect(html).toContain("Eligible");
    expect(html).toContain("88.2");
    expect(html).toContain("Not returned");
    for (const label of [
      "Symbol",
      "Rank",
      "Higher TF",
      "1h",
      "4h",
      "1d",
      "1w",
      "Group",
      "Signal",
      "Notes",
      "Research",
    ]) {
      expect(html).toContain(label);
    }
    expect(html).toContain("Limited HTF Data");
    expect(html).toContain("1h Research");
    expect(html).toContain(
      'href="/symbol/binance/SEIUSDT?timeframe=1h&amp;assetClass=crypto&amp;from=screener"',
    );
  });

  it("renders compact risk notes with hidden details available", () => {
    const rows = buildMtfScreenerRows({
      "1h": makeResponse("1h", [
        makeItem({
          symbol: "BTCUSDT",
          timeframe: "1h",
          resultGroup: "risk",
          detectedRiskTypes: ["distribution_risk"],
        }),
      ]),
      "4h": makeResponse("4h", [
        makeItem({ symbol: "BTCUSDT", timeframe: "4h", resultGroup: "overheated" }),
      ]),
      "1d": makeResponse("1d", [
        makeItem({ symbol: "BTCUSDT", timeframe: "1d", resultGroup: "risk" }),
      ]),
      "1w": makeResponse("1w", [
        makeItem({
          symbol: "BTCUSDT",
          timeframe: "1w",
          resultGroup: "risk",
          detectedRiskTypes: ["failed_breakout_risk"],
        }),
      ]),
    });
    const html = renderToStaticMarkup(
      createElement(MtfScreenerTable, { rows }),
    );

    expect(html).toContain("+1 more");
    expect(html).toContain("1w:");
    expect(html).toContain("4h Research");
  });

  it("renders all rows without show-more or pagination behavior", () => {
    const symbols = ["AAA", "BBB", "CCC", "DDD", "EEE", "FFF", "GGG", "HHH"];
    const rows = buildMtfScreenerRows({
      "4h": makeResponse(
        "4h",
        symbols.map((symbol, index) =>
          makeItem({
            symbol: `${symbol}USDT`,
            timeframe: "4h",
            resultGroup: index % 2 === 0 ? "watch" : "neutral",
            rankScore: 50 + index,
          }),
        ),
      ),
    });
    const html = renderToStaticMarkup(
      createElement(MtfScreenerTable, { rows }),
    );

    for (const symbol of symbols) {
      expect(html).toContain(`${symbol}USDT`);
    }

    expect(html).toContain("8 research rows");
    expect(html).not.toContain("Show More");
    expect(html).not.toContain("show more");
    expect(html).not.toContain("Pagination");
  });

  it("still renders screener rows when market context is unavailable", () => {
    const rows = buildMtfScreenerRows({
      "4h": makeResponse("4h", [
        makeItem({
          symbol: "BTCUSDT",
          timeframe: "4h",
          resultGroup: "risk",
          rankScore: -24,
        }),
      ]),
    });
    const html = renderToStaticMarkup(
      createElement(
        "div",
        null,
        createElement(MarketContextPanel, { isError: true }),
        createElement(MtfScreenerTable, { rows }),
      ),
    );

    expect(html).toContain("Market context unavailable");
    expect(html).toContain("BTCUSDT");
    expect(html).toContain("Matching Symbols");
  });
});

function noop() {}

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
