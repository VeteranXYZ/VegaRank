import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  buildMtfLatestScanUrl,
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
    expect(html).toContain("Screener Rank");
    expect(html).toContain("Higher TF");
    expect(html).toContain("Limited HTF Data");
    expect(html).toContain("Open 1h Research");
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
    expect(html).toContain("Open 4h Research");
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
