import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LanguageProvider } from "@/components/providers/LanguageProvider";
import { ScannerFilters } from "./ScannerFilters";
import { ScanScopePanel, type ScannerFiltersState } from "./ScannerPageClient";

describe("scanner timeframe filters", () => {
  it("renders medium-to-large timeframes only", () => {
    const html = renderToStaticMarkup(
      <LanguageProvider>
        <ScannerFilters filters={makeFilters()} onChange={() => undefined} />
      </LanguageProvider>,
    );

    expect(html).toContain('value="4h"');
    expect(html).toContain('value="1d"');
    expect(html).toContain('value="1w"');
    expect(html).toContain('value="1M"');
    expect(html).not.toContain('value="1h"');
    expect(html).not.toContain(">1H<");
  });
});

describe("scanner diagnostics panel", () => {
  it("renders cache, timing, capped, and failure diagnostics", () => {
    const html = renderToStaticMarkup(
      <LanguageProvider>
        <ScanScopePanel
          data={
            {
              exchange: "binance",
              timeframe: "4h",
              source: "remote",
              universe: "all-eligible-usdt",
              eligibleCount: 500,
              scannedCount: 500,
              failedCount: 2,
              cached: true,
              durationMs: 1234,
              updatedAt: "2026-05-25T10:00:00.000Z",
              cacheExpiresAt: "2026-05-25T11:00:00.000Z",
              capped: true,
              failureSummary: {
                insufficientHistory: 1,
                fetchFailed: 1,
                indicatorFailed: 1,
                filteredLowVolume: 4,
                excludedStableOrLeveraged: 3,
              },
              results: [],
              itemCount: 0,
            } as never
          }
        />
      </LanguageProvider>,
    );

    expect(html).toContain("Cached");
    expect(html).toContain("Duration");
    expect(html).toContain("Updated at");
    expect(html).toContain("Next refresh estimate");
    expect(html).toContain("Scanner reached the safety cap");
    expect(html).toContain("Insufficient history");
    expect(html).toContain("Low volume filtered");
  });
});

function makeFilters(): ScannerFiltersState {
  return {
    mode: "single",
    source: "remote",
    timeframe: "4h",
    mtfPreset: "short",
    signal: "ALL",
    phase: "ALL",
    minOpportunityScore: 0,
    maxRiskScore: 100,
    minQuoteVolume: 0,
    maxSymbols: "ALL",
    sortBy: "rankScore",
    limit: 50,
  };
}
