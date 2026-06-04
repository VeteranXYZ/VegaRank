import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarketContextPanel } from "@/components/market-context/MarketContextPanel";
import { sortDataRows } from "@/components/table/dataTableSorting";
import {
  buildMtfLatestScanUrl,
  getMtfScreenerTableSortValue,
  MtfScreenerCommandBar,
  MtfScreenerDetailRail,
  MtfScreenerExportControls,
  MtfResearchBucketsPanel,
  MtfScreenerTable,
  mtfScreenerProductionCopy,
} from "./MultiTimeframeScreenerPageClient";
import { MtfScreenerVisualCheckPage } from "./MtfScreenerVisualCheckPage";
import {
  buildMtfScreenerRows,
  type MtfLatestScanResponse,
  type MtfLatestScreenerResponse,
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

  it("keeps production screener copy product-focused", () => {
    expect(mtfScreenerProductionCopy.title).toBe("Multi-Timeframe Screener");
    expect(mtfScreenerProductionCopy.description).toBe(
      "Compare joined scanner signals across 1h, 4h, 1d, and 1w.",
    );
    expect(mtfScreenerProductionCopy.description).not.toMatch(
      /frontend-only|visual check|mock|preview/i,
    );
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
    expect(html).toContain("Buckets");
    expect(html).toContain("Full Table");
    expect(html).toContain("Short-term Repair");
    expect(html).toContain("MTF Strength");
    expect(html).toContain("Higher-TF Watchlist");
    expect(html).toContain("Overheated");
    expect(html).toContain("Breakdown Risk");
    expect(html).not.toContain("stronger candidates");
    expect(html).not.toContain("symbols");
    expect(html).not.toContain("Research-only");
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
      "State",
      "Score",
      "HTF",
      "1h",
      "4h",
      "1d",
      "1w",
      "Primary",
      "Notes",
      "Action",
    ]) {
      expect(html).toContain(label);
    }
    expect(html).toContain("Missing");
    expect(html).toContain("Limited HTF Data");
    expect(html).toContain("Limited data");
    expect(html).toContain("Open");
    expect(html).toContain(
      'href="/symbol/binance/SEIUSDT?timeframe=1h&amp;assetClass=crypto&amp;from=screener"',
    );
  });

  it("colors each timeframe score from its state instead of rank thresholds", () => {
    const rows = buildMtfScreenerRows({
      "1h": makeResponse("1h", [
        makeItem({
          symbol: "SEMANTICUSDT",
          timeframe: "1h",
          resultGroup: "watch",
          rankScore: 84.2,
        }),
      ]),
      "4h": makeResponse("4h", [
        makeItem({
          symbol: "SEMANTICUSDT",
          timeframe: "4h",
          resultGroup: "neutral",
          rankScore: 78.1,
        }),
      ]),
      "1d": makeResponse("1d", [
        makeItem({
          symbol: "SEMANTICUSDT",
          timeframe: "1d",
          resultGroup: "risk",
          rankScore: 50.4,
        }),
      ]),
      "1w": makeResponse("1w", [
        makeItem({
          symbol: "SEMANTICUSDT",
          timeframe: "1w",
          resultGroup: "eligible",
          rankScore: 62.3,
        }),
      ]),
    });
    const html = renderToStaticMarkup(createElement(MtfScreenerTable, { rows }));

    expect(html).toMatch(/class="[^"]*text-\[var\(--watch\)\][^"]*">84\.2<\/span>/);
    expect(html).toMatch(/class="[^"]*text-\[var\(--muted\)\][^"]*">78\.1<\/span>/);
    expect(html).toMatch(/class="[^"]*text-\[var\(--risk\)\][^"]*">50\.4<\/span>/);
    expect(html).toMatch(/class="[^"]*text-\[var\(--eligible\)\][^"]*">62\.3<\/span>/);
    expect(html).not.toMatch(/class="[^"]*text-\[var\(--eligible\)\][^"]*">84\.2<\/span>/);
    expect(html).not.toMatch(/class="[^"]*text-\[var\(--eligible\)\][^"]*">78\.1<\/span>/);
    expect(html).not.toMatch(/class="[^"]*text-\[var\(--foreground\)\][^"]*">50\.4<\/span>/);
  });

  it("preserves incoming table row order until a header sort is active", () => {
    const rows = buildMtfScreenerRows({
      "4h": makeResponse("4h", [
        makeItem({ symbol: "AAAUSDT", timeframe: "4h", rankScore: 80 }),
        makeItem({ symbol: "BBBUSDT", timeframe: "4h", rankScore: 60 }),
        makeItem({ symbol: "CCCUSDT", timeframe: "4h", rankScore: 40 }),
      ]),
    });
    const incomingRows = [rows[2], rows[0], rows[1]];
    const html = renderToStaticMarkup(
      createElement(MtfScreenerTable, { rows: incomingRows }),
    );

    expectMarkupOrder(html, ["CCCUSDT", "AAAUSDT", "BBBUSDT"]);
    expect(html).not.toContain("ASC");
    expect(html).not.toContain("DESC");
    expect(html).not.toContain("\u2195");
  });

  it("renders rows in the active header sort order with an accessible sort indicator", () => {
    const rows = buildMtfScreenerRows({
      "4h": makeResponse("4h", [
        makeItem({ symbol: "LOWUSDT", timeframe: "4h", rankScore: 20 }),
        makeItem({ symbol: "HIGHUSDT", timeframe: "4h", rankScore: 90 }),
        makeItem({ symbol: "MIDUSDT", timeframe: "4h", rankScore: 50 }),
      ]),
    });
    const incomingRows = [rows[2], rows[0], rows[1]];
    const sortState = { key: "combined_rank" as const, direction: "desc" as const };
    const visibleRows = sortDataRows(
      incomingRows,
      sortState,
      getMtfScreenerTableSortValue,
    );
    const html = renderToStaticMarkup(
      createElement(MtfScreenerTable, {
        rows: visibleRows,
        sortState,
        onSortChange: noop,
      }),
    );

    expectMarkupOrder(html, ["HIGHUSDT", "MIDUSDT", "LOWUSDT"]);
    expect(html).toContain("\u2193");
    expect(html).not.toContain("\u2195");
    expect(html).toContain('aria-sort="descending"');
  });

  it("renders row count, freshness, and exports in the command workspace", () => {
    const rows = buildMtfScreenerRows({
      "4h": makeResponse("4h", [
        makeItem({ symbol: "AAAUSDT", timeframe: "4h", rankScore: 80 }),
        makeItem({ symbol: "BBBUSDT", timeframe: "4h", rankScore: 60 }),
      ]),
    });
    const commandHtml = renderToStaticMarkup(
      createElement(MtfScreenerCommandBar, {
        title: "Multi-Timeframe Screener",
        datasetLabel: "Latest joined rows",
        statusLabel: "Loaded",
        statusTone: "complete",
        totalRows: 2,
        visibleRows: 1,
        presetId: "custom",
        isFullTableActive: true,
        activeFilterCount: 0,
        sourceData: makeScreenerResponse(),
        onExportVisible: noop,
        onExportAll: noop,
      }),
    );
    const tableHtml = renderToStaticMarkup(
      createElement(MtfScreenerTable, {
        rows: rows.slice(0, 1),
        sourceData: makeScreenerResponse(),
        totalRows: 2,
        filteredRows: 1,
      }),
    );

    expect(commandHtml).toContain("Multi-Timeframe Screener");
    expect(commandHtml).toContain("Screener");
    expect(commandHtml).toContain("MTF Screener");
    expect(commandHtml).toContain("Crypto");
    expect(commandHtml).toContain("research context");
    expect(commandHtml).not.toContain("MTF Joined");
    expect(commandHtml).not.toContain("Research only");
    expect(commandHtml).toContain("Loaded");
    expect(commandHtml).toContain("Rows");
    expect(commandHtml).toContain("Bucket");
    expect(commandHtml).toContain("Filters");
    expect(commandHtml).toContain("1/2");
    expect(commandHtml).toContain("Full Table");
    expect(commandHtml).toContain("No filters");
    expect(commandHtml).toContain("Incoming order");
    expect(commandHtml).toContain("Freshness");
    expect(commandHtml).toContain("4h");
    expect(commandHtml).toContain("8/0");
    expect(commandHtml).toContain("Export Visible");
    expect(commandHtml).toContain("Export All");
    expect(tableHtml).toContain("Joined Symbol Table");
    expect(tableHtml).toContain("Showing 1 of 2 symbols");
    expect(tableHtml).toContain("MTF");
    expect(tableHtml).toContain("States");
    expect(tableHtml).toContain("Hot");
    expect(commandHtml).not.toContain("Show More");
    expect(commandHtml).not.toContain("top-100");
    expect(commandHtml).not.toContain("Pagination");
  });

  it("disables export controls when there are no rows", () => {
    const html = renderToStaticMarkup(
      createElement(MtfScreenerExportControls, {
        visibleRowsCount: 0,
        allRowsCount: 0,
        onExportVisible: noop,
        onExportAll: noop,
      }),
    );

    expect(html).toContain("Screener CSV export");
    expect(html.match(/disabled=\"\"/g)).toHaveLength(2);
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

    expect(html).toContain("+3");
    expect(html).not.toContain("+3 risk notes");
    expect(html).toContain("Failed Breakout Risk");
    expect(html).not.toContain(">1w:</span>");
    expect(html).toContain("Open");
  });

  it("renders the desktop detail rail from current visible rows", () => {
    const rows = buildMtfScreenerRows({
      "4h": makeResponse("4h", [
        makeItem({
          symbol: "BTCUSDT",
          timeframe: "4h",
          resultGroup: "eligible",
          rankScore: 88,
          signalLabel: "eligible pullback",
        }),
        makeItem({
          symbol: "ETHUSDT",
          timeframe: "4h",
          resultGroup: "watch",
          rankScore: 62,
        }),
      ]),
    });
    const html = renderToStaticMarkup(
      createElement(MtfScreenerDetailRail, {
        rows,
        totalRows: 5,
        filteredRows: 2,
        presetId: "custom",
        isFullTableActive: false,
        activeFilterCount: 1,
      }),
    );

    expect(html).toContain("Screener detail rail");
    expect(html).toContain("Detail Rail");
    expect(html).toContain("View State");
    expect(html).toContain("2/5");
    expect(html).toContain("Focus Rows");
    expect(html).toContain("Market Backdrop");
    expect(html).toContain("scanner states unchanged");
    expect(html).toContain("BTCUSDT");
    expect(html).toContain("ETHUSDT");
    expect(html).toContain("State Key");
  });

  it("renders the populated visual-check page with mock rows", () => {
    const html = renderToStaticMarkup(createElement(MtfScreenerVisualCheckPage));

    expect(html).toContain("Visual check");
    expect(html).toContain("Mock joined rows");
    expect(html).toContain("1000PEPEUSDT");
    expect(html).toContain("1000000MOGUSDT");
    expect(html).toContain("ONDOUSDT");
    expect(html).toContain("Freshness");
    expect(html).toContain("Joined Symbol Table");
    expect(html).toContain("Showing 70 of 70 symbols");
    expect(html).toContain("Filters");
    expect(html).toContain("Search symbol");
    expect(html).toContain("Market Backdrop");
    expect(html).not.toContain("BTC, ETH, SEI");
    expect(html).toContain("Detail Rail");
    expect(html).toContain("+2");
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

    expect(html).toContain("Showing 8 of 8 symbols");
    expect(html).not.toContain("Show More");
    expect(html).not.toContain("top-100");
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
    expect(html).toContain("Joined Symbol Table");
  });
});

function noop() {}

function expectMarkupOrder(html: string, labels: string[]) {
  const positions = labels.map((label) => html.indexOf(label));

  for (const position of positions) {
    expect(position).toBeGreaterThanOrEqual(0);
  }

  for (let index = 1; index < positions.length; index += 1) {
    expect(positions[index]).toBeGreaterThan(positions[index - 1]);
  }
}

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

function makeScreenerResponse(): MtfLatestScreenerResponse {
  return {
    ok: true,
    assetClass: "crypto",
    timeframes: ["1h", "4h", "1d", "1w"],
    runs: {
      "1h": null,
      "4h": makeRun("4h"),
      "1d": null,
      "1w": null,
    },
    signalCounts: {
      "1h": 0,
      "4h": 8,
      "1d": 0,
      "1w": 0,
    },
    missingCounts: {
      "1h": 0,
      "4h": 0,
      "1d": 0,
      "1w": 0,
    },
    count: 2,
    rows: [],
  };
}

function makeRun(timeframe: "1h" | "4h" | "1d" | "1w") {
  return {
    id: `run-${timeframe}`,
    timeframe,
    status: "success",
    symbolsTotal: 12,
    symbolsScanned: 12,
    signalsCreated: 8,
    symbolsSkipped: 0,
    startedAt: "2026-06-03T12:00:00.000Z",
    finishedAt: "2026-06-03T12:04:00.000Z",
    isLikelyFullUniverse: true,
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
