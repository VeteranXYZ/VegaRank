import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LanguageProvider } from "@/components/providers/LanguageProvider";
import type { ScanResult } from "@/lib/shared/scannerTypes";
import {
  serializeScanResultToCodeContract,
  type ScannerCodeContractResult,
} from "@/lib/scanner-codebook/serializeScanResult";
import {
  phaseCodeByMarketPhase,
  scannerCodeVersions,
} from "@/lib/scanner-codebook/codeRegistry";
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

    expect(html).toContain("O +75");
    expect(html).toContain("C +88");
    expect(html).toContain("R +12");
    expect(html).toContain("W1");
    expect(html).toContain("Breakout Attempt");
    expect(html).toContain("Watch Momentum");
    expect(html).toContain("Watch");
  });

  it("renders code contract rows without legacy signal text", () => {
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

    expect(englishHtml).toContain("BTCUSDT");
    expect(englishHtml).toContain("ETHUSDT");
    expect(englishHtml).toContain("Watch Momentum");
    expect(englishHtml).not.toContain("watch_only");
    expect(englishHtml).not.toContain("breakout_attempt");
    expect(englishHtml).not.toContain("+0");
  });
});

function makeResult(
  overrides: Partial<ScanResult> = {},
): ScannerCodeContractResult {
  const result: ScanResult = {
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
    trendScore: 110,
    momentumScore: 45,
    volumeScore: 40,
    structureScore: 90,
    finalSignalScore: 69.8,
    rankScore: 69.8,
    signalLabel: "watch",
    actionBias: "watch_only",
    primaryStructure: "breakout_attempt",
    secondaryStructures: [],
    detectedRiskTypes: [],
    bullishObservations: [],
    bearishObservations: [],
    riskObservations: [],
    neutralObservations: [],
    nextConfirmationObservations: [],
    invalidationObservations: [],
    rawMetrics: {
      price: 100,
      rsi: 61,
      bbPercent: 55,
      volumeRatio: 1.8,
      macdState: "improving",
      closeAboveMA20: true,
      closeAboveMA50: true,
      closeAboveMA200: true,
      ma20AboveMA50: true,
      ma50AboveMA200: true,
    },
    rsi14: 61,
    bbPercent: 55,
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
    codeContract: {
      exchange: "binance",
      symbol: overrides.symbol ?? "BTCUSDT",
      timeframe: "4h",
      groupCode: "GR_201",
      actionCode: "AC_101",
      riskCode: null,
      riskCodes: [],
      setupCode: "PX_201",
      phaseCode: phaseCodeByMarketPhase.BREAKOUT_ATTEMPT,
      reasonCodes: ["NX_101"],
      signalCodes: ["MO_202"],
      qualityCodes: ["QH_001"],
      metrics: {
        rankScore: 69.8,
        riskAdjustedScore: 69.8,
        setupQualityScore: 75,
        confidenceScore: 88,
        absoluteSetupScore: 75,
        universePercentile: null,
        trendScore: 110,
        momentumScore: 45,
        structureScore: 90,
        volatilityScore: 50,
        volumeScore: 40,
        mtfAgreementScore: 50,
        riskPenalty: 12,
        qualityPenalty: 0,
        historyBars: 300,
        volumeRank: 1.8,
        volatilityPercentile: 24,
        atrExtension: null,
        distanceFromBase: null,
        scoringModelVersion: "quant-factor-v1",
        scoringCalibrationVersion: "deterministic-baseline-1",
        score: 69.8,
        finalSignalScore: 69.8,
        opportunityScore: 75,
        confirmationScore: 88,
        riskScore: 12,
        qualityScore: 100,
        price: 100,
        rsi14: 61,
        bbPercent: 55,
        bbWidthPercentile: 24,
        volumeRatio: 1.8,
      },
      ...scannerCodeVersions,
    },
    ...overrides,
  };

  return serializeScanResultToCodeContract(result);
}
