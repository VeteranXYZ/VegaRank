import { createElement, type ComponentType } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  actionCodeByBias,
  groupCodeByResultGroup,
  riskCodeByType,
  scannerCodeVersions,
  signalCodeByLabel,
  setupCodeByAliasOrStructure,
} from "@/lib/vegarank-codebook/codeRegistry";
import { MarketContextPanel } from "@/components/market-context/MarketContextPanel";
import {
  WatchlistPageClient,
  WatchlistSummaryCards,
  WatchlistResearchSummaryPanel,
  WatchlistTable,
  buildWatchlistMtfLatestRankingsUrl,
} from "./WatchlistPageClient";
import {
  DEFAULT_WATCHLIST_SYMBOLS,
  buildWatchlistResearchSummary,
  buildWatchlistRows,
  getWatchlistSummary,
} from "./watchlistUi";
import {
  buildMtfScreenerRowsFromResponse,
  buildMtfScreenerRows,
  type MtfLatestRankingsResponse,
} from "@/components/screener/multiTimeframeScreenerUi";
import { buildWatchlistVisualCheckData } from "./watchlistPreviewData";

describe("WatchlistPageClient", () => {
  it("uses the full multi-timeframe latest API endpoint", () => {
    expect(
      buildWatchlistMtfLatestRankingsUrl({
        assetClass: "crypto",
        tradeApiBaseUrl: "https://api.vegarank.com/",
      }),
    ).toBe("https://api.vegarank.com/api/rankings/mtf-latest?assetClass=crypto");
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
          researchSummary: buildWatchlistResearchSummary(rows),
        }),
        createElement(WatchlistResearchSummaryPanel, {
          summary: buildWatchlistResearchSummary(rows),
        }),
        createElement(WatchlistTable, { rows }),
      ),
    );

    expect(html).toContain("Selected");
    expect(html).toContain("Found");
    expect(html).toContain("Missing");
    expect(html).toContain("Active Candidates");
    expect(html).toContain("Research Watch");
    expect(html).toContain("Watch / Repair");
    expect(html).toContain("Risk First");
    expect(html).toContain("Data Gaps");
    expect(html).not.toContain("Best Research Candidates");
    expect(html).toContain("Latest Snapshot");
    expect(html).toContain("Selected Symbols");
    expect(html).toContain("BTCUSDT");
    expect(html).toContain("SEIUSDT");
    expect(html).toContain("Current Research State");
    expect(html).toContain("4h");
    expect(html).toContain("72.5");
    expect(html).toContain("Missing Snapshot");
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

    expect(html).toContain("N/A");
    expect(html).toContain("Open Research");
    expect(html).toContain("timeframe=1h");
    expect(html).toContain("timeframe=1d");
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

    expect(html).toContain("Showing 8 of 8");
    expect(html).not.toContain("Show More");
    expect(html).not.toContain("show more");
    expect(html).not.toContain("+1 more");
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
    expect(html).toContain("Latest Snapshot");
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

    expect(html).toContain("Remove");
    expect(html.match(/>Remove from Watchlist<\/button>/g)).toHaveLength(2);
  });

  it("renders table-header sort controls for data columns", () => {
    const rows = buildWatchlistRows(
      ["BTC", "ETH"],
      buildMtfScreenerRows({
        "4h": makeResponse("4h", [
          makeItem({ symbol: "BTCUSDT", timeframe: "4h", rankScore: 75 }),
          makeItem({ symbol: "ETHUSDT", timeframe: "4h", rankScore: 65 }),
        ]),
      }),
    );
    const html = renderToStaticMarkup(
      createElement(WatchlistTable, {
        rows,
        sortState: { key: "symbol", direction: "asc" },
        onSortChange: () => undefined,
      }),
    );

    expect(html.match(/<button/g)).toHaveLength(7);
    expect(html.match(/data-sort-key=/g)).toHaveLength(7);
    expect(html).toContain('aria-sort="ascending"');
    expect(html).toContain('data-sort-key="symbol"');
    expect(html).toContain('data-sort-key="1h_rank"');
    expect(html).toContain('data-sort-key="4h_rank"');
    expect(html).toContain('data-sort-key="1d_rank"');
    expect(html).toContain('data-sort-key="1w_rank"');
    expect(html).toContain('data-sort-key="higher_timeframe_safety"');
    expect(html).toContain('data-sort-key="best_short_term_rank"');
    expect(html).toContain("Symbol");
    expect(html).toContain("↑");
    expect(html).toContain("1h");
    expect(html).toContain("4h");
    expect(html).toContain("1d");
    expect(html).toContain("1w");
    expect(html).toContain("Current Research State");
    expect(html).toContain("Risk Context");
    expect(html).not.toContain('data-sort-key="research"');
    expect(html).not.toContain('data-sort-key="remove"');
  });

  it("does not make Research or Remove action columns sortable", () => {
    const rows = buildWatchlistRows(
      ["BTC", "ETH"],
      buildMtfScreenerRows({
        "4h": makeResponse("4h", [
          makeItem({ symbol: "BTCUSDT", timeframe: "4h", rankScore: 75 }),
          makeItem({ symbol: "ETHUSDT", timeframe: "4h", rankScore: 65 }),
        ]),
      }),
    );
    const html = renderToStaticMarkup(
      createElement(WatchlistTable, {
        rows,
        onRemoveSymbol: () => undefined,
        sortState: { key: "symbol", direction: "asc" },
        onSortChange: () => undefined,
      }),
    );

    expect(html.match(/data-sort-key=/g)).toHaveLength(7);
    expect(html).toContain("Research");
    expect(html).toContain("Remove");
    expect(html).not.toContain('data-sort-key="research"');
    expect(html).not.toContain('data-sort-key="remove"');
  });

  it("keeps the rail compact with collapsed import-export and no sort controls", () => {
    const html = renderWatchlistVisualPage();
    const railHtml = extractAsideHtml(html);
    const detailsTag = railHtml.match(/<details[^>]*>/)?.[0] ?? "";

    expect(railHtml).toContain("Symbols");
    expect(railHtml).toContain("Filters");
    expect(railHtml).toContain("Import / Export Watchlist");
    expect(railHtml).toContain("Paste Symbols");
    expect(railHtml).toContain("Copy Watchlist");
    expect(detailsTag).not.toMatch(/\sopen(?:=|\s|>)/);
    expect(railHtml).not.toContain("Sort");
    expect(railHtml).not.toContain("sort controls");
    expect(html).not.toContain("Show more");
    expect(html).not.toContain("Show More");
    expect(html).not.toMatch(/[\u3400-\u9fff]/);
  });

  it("renders semantic watchlist table states without treating missing data as risk", () => {
    const rows = buildWatchlistRows(
      ["AAA", "BBB", "CCC", "DDD", "EEE"],
      buildMtfScreenerRows({
        "1h": makeResponse("1h", [
          makeItem({
            symbol: "AAAUSDT",
            timeframe: "1h",
            resultGroup: "eligible",
            rankScore: 88,
          }),
          makeItem({
            symbol: "BBBUSDT",
            timeframe: "1h",
            resultGroup: "risk",
            rankScore: -12,
          }),
          makeItem({
            symbol: "CCCUSDT",
            timeframe: "1h",
            resultGroup: "neutral",
            rankScore: 0,
          }),
          makeItem({
            symbol: "DDDUSDT",
            timeframe: "1h",
            resultGroup: "overheated",
            rankScore: 93,
          }),
        ]),
      }),
    );
    const html = renderToStaticMarkup(
      createElement(WatchlistTable, { rows }),
    );

    expect(html).toContain("Eligible");
    expect(html).toContain("Risk");
    expect(html).toContain("Neutral");
    expect(html).toContain("Hot");
    expect(html).toContain("Missing");
    expect(html).toContain("N/A");
    expect(html).toContain("border-[var(--eligible-border)]");
    expect(html).toContain("border-[var(--risk-border)]");
    expect(html).toContain("border-[var(--warning-border)]");
    expect(html).toContain("border-[var(--neutral-border)]");
    expect(html).toContain("border-[var(--missing-border)]");
  });

  it("renders a compact terminal command bar for visual-check watchlist", () => {
    const html = renderWatchlistVisualPage();

    expect(html).toContain("terminal-command-bar");
    expect(html).toContain("terminal-command-title");
    expect(html).toContain("Local Watchlist");
    expect(html).toContain("Saved in this browser");
    expect(html).toContain("Latest Snapshot");
    expect(html).toContain("Visible");
    expect(html).toContain("Selected");
    expect(html).toContain("Found");
    expect(html).toContain("Missing");
    expect(html).toContain("Higher Timeframe Risk");
    expect(html).toContain("Broad Risk");
    expect(html).toContain('aria-label="Visual Check Data"');
    expect(html).not.toContain("Watchlist Multi-Timeframe");
    expect(html).not.toContain("<dl");
  });

  it("renders populated visual-check watchlist coverage", () => {
    const visualCheckData = buildWatchlistVisualCheckData();
    const rows = buildWatchlistRows(
      visualCheckData.selectedSymbols,
      buildMtfScreenerRowsFromResponse(visualCheckData.latestData),
    );
    const html = renderToStaticMarkup(
      createElement(
        "div",
        null,
        createElement(WatchlistSummaryCards, {
          summary: getWatchlistSummary(rows),
          researchSummary: buildWatchlistResearchSummary(rows),
        }),
        createElement(WatchlistResearchSummaryPanel, {
          summary: buildWatchlistResearchSummary(rows),
        }),
        createElement(WatchlistTable, {
          rows,
          sourceData: visualCheckData.latestData,
          totalRows: rows.length,
          filteredRows: rows.length,
        }),
      ),
    );

    expect(visualCheckData.selectedSymbols).toContain("MISSINGUSDT");
    expect(html).toContain("BTCUSDT");
    expect(html).toContain("DOGEUSDT");
    expect(html).toContain("MISSINGUSDT");
    expect(html).toContain("Hot");
    expect(html).toContain("Risk");
    expect(html).toContain("Watch");
    expect(html).toContain("Missing Snapshot");
    expect(html).toContain("N/A");
    expect(html).toContain("Open Research");
    expect(html).not.toContain("Show More");
    expect(html).not.toContain("show more");
  });
});

function renderWatchlistVisualPage() {
  const VisualWatchlistPage = WatchlistPageClient as ComponentType<{
    visualCheckData: ReturnType<typeof buildWatchlistVisualCheckData>;
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
      createElement(VisualWatchlistPage, {
        visualCheckData: buildWatchlistVisualCheckData(),
      }),
    ),
  );
}

function extractAsideHtml(html: string) {
  return html.match(/<aside[\s\S]*?<\/aside>/)?.[0] ?? "";
}

function makeResponse(
  timeframe: "1h" | "4h" | "1d" | "1w",
  items: MtfLatestRankingsResponse["items"],
): MtfLatestRankingsResponse {
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
  overrides: Partial<MtfLatestRankingsResponse["items"][number]> & {
    symbol: string;
    timeframe: "1h" | "4h" | "1d" | "1w";
    group?: "eligible" | "watch" | "risk" | "overheated" | "neutral" | null;
    resultGroup?: "eligible" | "watch" | "risk" | "overheated" | "neutral" | null;
    rankScore?: number | null;
    signalLabel?: keyof typeof signalCodeByLabel;
    actionBias?: keyof typeof actionCodeByBias;
    primaryStructure?: keyof typeof setupCodeByAliasOrStructure;
    detectedRiskTypes?: Array<keyof typeof riskCodeByType>;
  },
): MtfLatestRankingsResponse["items"][number] {
  const resultGroup = overrides.resultGroup ?? overrides.group ?? "neutral";
  const riskCodes = (overrides.detectedRiskTypes ?? []).map(
    (risk) => riskCodeByType[risk] ?? "RK_201",
  );
  const rankScore = overrides.metrics?.rankScore ?? overrides.rankScore ?? 0;

  return {
    id: `${overrides.timeframe}-${overrides.symbol}`,
    scanRunId: `run-${overrides.timeframe}`,
    symbol: overrides.symbol,
    exchange: "binance",
    market: "spot",
    assetClass: "crypto",
    timeframe: overrides.timeframe,
    scanTime: "2026-06-03T12:00:00.000Z",
    candleOpenTime: "2026-06-03T08:00:00.000Z",
    groupCode: groupCodeByResultGroup[resultGroup],
    actionCode: actionCodeByBias[overrides.actionBias ?? "watch_only"],
    riskCode: riskCodes[0] ?? null,
    riskCodes,
    setupCode:
      setupCodeByAliasOrStructure[overrides.primaryStructure ?? "strong_trend"],
    phaseCode:
      setupCodeByAliasOrStructure[overrides.primaryStructure ?? "strong_trend"],
    reasonCodes: riskCodes,
    signalCodes: [signalCodeByLabel[overrides.signalLabel ?? "watch"]],
    qualityCodes: ["QH_001"],
    metrics: {
      score: rankScore,
      rankScore,
      riskAdjustedScore: rankScore,
      setupQualityScore: null,
      confidenceScore: null,
      absoluteSetupScore: null,
      universePercentile: null,
      finalSignalScore: rankScore,
      opportunityScore: null,
      confirmationScore: null,
      riskScore: null,
      qualityScore: null,
      trendScore: null,
      momentumScore: null,
      volumeScore: null,
      structureScore: null,
      volatilityScore: null,
      mtfAgreementScore: null,
      riskPenalty: null,
      qualityPenalty: null,
      volumeRank: null,
      historyBars: null,
      volatilityPercentile: null,
      atrExtension: null,
      distanceFromBase: null,
      scoringModelVersion: "quant-factor-v1",
      scoringCalibrationVersion: "deterministic-baseline-1",
      price: null,
      rsi14: null,
      bbPercent: null,
      bbWidthPercentile: null,
      volumeRatio: null,
    },
    ...scannerCodeVersions,
  };
}
