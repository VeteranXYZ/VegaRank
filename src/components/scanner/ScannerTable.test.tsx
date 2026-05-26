import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LanguageProvider } from "@/components/providers/LanguageProvider";
import type { ScanResult } from "@/lib/shared/scannerTypes";
import { ScannerTable } from "./ScannerTable";

describe("scanner compact table", () => {
  it("renders compact score and warning cells", () => {
    const html = renderToStaticMarkup(
      <LanguageProvider>
        <ScannerTable
          rows={[makeResult()]}
          signalSummary={[]}
          activeSignal="ALL"
          selectedSymbol="BTCUSDT"
          isLoading={false}
          isFetching={false}
          isError={false}
          errorMessage=""
          cached={false}
          updatedAt="2026-05-25T10:00:00.000Z"
          sourceItemCount={1}
          partialErrors={[]}
          tableSort={null}
          onRefresh={() => undefined}
          onSignalSelect={() => undefined}
          onSelect={() => undefined}
          onSortChange={() => undefined}
        />
      </LanguageProvider>,
    );

    expect(html).toContain("O75");
    expect(html).toContain("C88");
    expect(html).toContain("R12");
    expect(html).toContain("W1");
    expect(html).toContain("MACD");
    expect(html).toContain("20");
    expect(html).toContain("50");
    expect(html).toContain("200");
  });

  it("renders localized MACD table labels", () => {
    const englishHtml = renderToStaticMarkup(
      <LanguageProvider>
        <ScannerTable
          rows={[
            makeResult(),
            makeResult({
              symbol: "ETHUSDT",
              macd: {
                line: 1,
                signal: 0.8,
                histogram: 0.2,
                histogramRising: true,
                bullishCross: false,
                bearishCross: false,
                aboveZero: true,
              },
            }),
          ]}
          signalSummary={[]}
          activeSignal="ALL"
          selectedSymbol="BTCUSDT"
          isLoading={false}
          isFetching={false}
          isError={false}
          errorMessage=""
          cached={false}
          updatedAt="2026-05-25T10:00:00.000Z"
          sourceItemCount={1}
          partialErrors={[]}
          tableSort={null}
          onRefresh={() => undefined}
          onSignalSelect={() => undefined}
          onSelect={() => undefined}
          onSortChange={() => undefined}
        />
      </LanguageProvider>,
    );

    expect(englishHtml).toContain("Cross");
    expect(englishHtml).toContain("Flat");
    expect(englishHtml).not.toContain("+0");
  });
});

function makeResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    exchange: "binance",
    symbol: "BTCUSDT",
    timeframe: "4h",
    price: 100,
    phase: "BREAKOUT_ATTEMPT",
    signal: {
      state: "WATCHLIST",
      label: "Watchlist",
      summary: "Breakout attempt has volume and momentum confirmation.",
    },
    opportunityScore: 75,
    confirmationScore: 88,
    riskScore: 12,
    rankScore: 69.8,
    rsi14: 61,
    bbWidthPercentile: 24,
    volumeRatio: 1.8,
    volume: {
      latest: 1000,
      ma20: 800,
      ma50: 750,
      ratio20: 1.8,
      ratio50: 1.9,
      dryUp: false,
      expanding: true,
      abnormalSpike: false,
      breakoutConfirmed: true,
      pullbackHealthy: false,
      distributionWarning: false,
      quietCompression: false,
    },
    macd: {
      line: 1,
      signal: 0.8,
      histogram: 0.2,
      histogramRising: true,
      bullishCross: true,
      bearishCross: false,
      aboveZero: true,
    },
    maStatus: {
      aboveMA20: true,
      aboveMA50: true,
      aboveMA200: true,
      ma20AboveMA50: true,
      ma50AboveMA200: true,
    },
    reasons: [],
    warnings: [{ key: "warning.breakoutWithoutVolume" }],
    nextConfirmation: [],
    invalidation: [],
    dataQuality: {
      candleCount: 300,
      sufficientHistory: true,
      missingIndicators: [],
    },
    ...overrides,
  };
}
