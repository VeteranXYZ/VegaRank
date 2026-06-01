import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MtfScreenerTable } from "./MultiTimeframeScreenerPageClient";
import { buildMtfScreenerRows, type MtfLatestScanResponse } from "./multiTimeframeScreenerUi";

describe("MultiTimeframeScreenerTable", () => {
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
    expect(html).toContain("Open Symbol Research");
    expect(html).toContain(
      'href="/symbol/binance/SEIUSDT?timeframe=1h&amp;assetClass=crypto&amp;from=screener"',
    );
  });
});
