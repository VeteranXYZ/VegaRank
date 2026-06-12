import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "../app/page";
import { Header } from "@/components/layout/Header";

const pathnameMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: pathnameMock,
}));

describe("public navigation surface", () => {
  beforeEach(() => {
    pathnameMock.mockReset();
    pathnameMock.mockReturnValue("/rankings");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses VegaRank route labels and avoids old scanner/history links in the header", () => {
    const html = renderToStaticMarkup(createElement(Header));

    expect(html).toContain("VegaRank");
    expect(html).toContain('href="/rankings"');
    expect(html).toContain(">Rankings<");
    expect(html).toContain('href="/screener"');
    expect(html).toContain(">Screener<");
    expect(html).toContain('href="/watchlist"');
    expect(html).toContain(">Watchlist<");
    expect(html).toContain('href="/symbol/binance/BTCUSDT"');
    expect(html).toContain(">Symbol<");
    expect(html).toContain('href="/archive"');
    expect(html).toContain(">Archive<");
    expect(html).not.toContain('href="/scanner"');
    expect(html).not.toContain('href="/history"');
  });

  it("uses VegaRank workspace links and avoids old scanner/history routes on home", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          ok: true,
          run: {
            timeframe: "4h",
            universe: "binance:crypto",
            symbolsScanned: 362,
            signalsCreated: 346,
            finishedAt: "2026-06-12T16:30:00.000Z",
          },
          summary: {
            totalSignals: 351,
            returnedItems: 100,
            eligible: 18,
            watch: 42,
          },
          count: 100,
          timeframe: "4h",
          assetClass: "crypto",
        }),
      })),
    );

    const html = renderToStaticMarkup(await HomePage());

    expect(html).toContain("VegaRank");
    expect(html).toContain("Research Candidate Ranking System");
    expect(html).toContain("Latest Research Snapshot");
    expect(html).toContain("Research Workflow");
    expect(html).toContain("Suggested Research Paths");
    expect(html).toContain("Research Status");
    expect(html).toContain('href="/rankings"');
    expect(html).toContain("Market Rankings");
    expect(html).toContain('href="/screener"');
    expect(html).toContain("Multi-Timeframe Screener");
    expect(html).toContain('href="/symbol/binance/BTCUSDT"');
    expect(html).toContain("Symbol Research");
    expect(html).toContain("Open Symbol");
    expect(html).toContain('href="/watchlist"');
    expect(html).toContain("Local Watchlist");
    expect(html).toContain('href="/archive"');
    expect(html).toContain("Research Archive");
    expect(html).toContain("Research-only. Not trading advice.");
    expect(html).toContain("2026-06-12 16:30 UTC");
    expect(html).toContain("Research Rows");
    expect(html).not.toContain('href="/scanner"');
    expect(html).not.toContain('href="/history"');
    expect(html).not.toContain("Find the best trades");
    expect(html).not.toContain("Most profitable setups");
    expect(html).not.toContain("Open BTCUSDT Research");
  });

  it("keeps the home workspace usable when latest snapshot status is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );

    const html = renderToStaticMarkup(await HomePage());

    expect(html).toContain("Snapshot status unavailable");
    expect(html).toContain("Latest snapshot unavailable");
    expect(html).toContain('href="/rankings"');
    expect(html).toContain('href="/screener"');
    expect(html).toContain("Discover -&gt; Compare -&gt; Research -&gt; Monitor -&gt; Validate");
  });
});
