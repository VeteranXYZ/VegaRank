import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/components/providers/LanguageProvider";
import {
  HistoricalBehaviorPanel,
  HistoricalBehaviorResult,
} from "./HistoricalBehaviorPanel";
import { dictionaries } from "@/lib/i18n/dictionaries";

describe("historical behavior panel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the manual review controls without auto-running fetch", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const html = renderToStaticMarkup(
      <LanguageProvider>
        <HistoricalBehaviorPanel symbol="BTCUSDT" timeframe="4h" />
      </LanguageProvider>,
    );

    expect(html).toContain("Historical Performance");
    expect(html).toContain("Review setup");
    expect(html).toContain("Standard");
    expect(html).toContain("Broad: matches setup only");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renders a compact success horizon table with risk and help text", () => {
    const html = renderToStaticMarkup(
      <LanguageProvider>
        <HistoricalBehaviorResult
          data={{
            symbol: "BTCUSDT",
            timeframe: "4h",
            limit: 1000,
            matchMode: "standard",
            sampleCount: 12,
            sampleQuality: "medium",
            summaryKey: "backtest.summary.positiveShortTerm",
            falseBreakoutRatePct: 25,
            warnings: [],
            notes: [{ key: "backtest.note.noDatabase" }],
            recentSamples: [
              {
                signalTime: "2026-05-01T00:00:00.000Z",
                signalClose: 100,
                return5K: 3.2,
                mfe5K: 7.5,
                mae5K: -2.1,
              },
            ],
            horizons: [
              {
                candles: 1,
                label: "1K",
                sampleCount: 12,
                averageReturnPct: 1.2,
                medianReturnPct: 0.8,
                winRatePct: 58,
                averageMfePct: 3.1,
                averageMaePct: -1.4,
                bestReturnPct: 8,
                worstReturnPct: -4,
              },
            ],
          }}
        />
      </LanguageProvider>,
    );

    expect(html).toContain("1K");
    expect(html).toContain("Avg");
    expect(html).toContain("1.2%");
    expect(html).toContain("Fakeout rate");
    expect(html).toContain("simplified estimate");
    expect(html).toContain("Avg: average close-to-close return");
    expect(html).toContain("Recent samples");
    expect(html).toContain("5K return");
    expect(html).toMatch(/<details><summary[^>]*>Recent samples<\/summary>/);
  });

  it("renders no sample state with broad mode suggestion", () => {
    const html = renderToStaticMarkup(
      <LanguageProvider>
        <HistoricalBehaviorResult
          data={{
            symbol: "BTCUSDT",
            timeframe: "4h",
            limit: 1000,
            matchMode: "standard",
            sampleCount: 0,
            sampleQuality: "none",
            summaryKey: "backtest.summary.noSamples",
            falseBreakoutRatePct: null,
            warnings: [{ key: "backtest.warning.noSamples" }],
            notes: [],
            recentSamples: [],
            horizons: [],
          }}
        />
      </LanguageProvider>,
    );

    expect(html).toContain("Try Broad mode");
  });

  it("shows small sample warning", () => {
    const html = renderToStaticMarkup(
      <LanguageProvider>
        <HistoricalBehaviorResult
          data={{
            symbol: "BTCUSDT",
            timeframe: "4h",
            limit: 1000,
            matchMode: "standard",
            sampleCount: 6,
            sampleQuality: "low",
            summaryKey: "backtest.summary.smallSample",
            falseBreakoutRatePct: null,
            warnings: [{ key: "backtest.warning.smallSample" }],
            notes: [],
            recentSamples: [],
            horizons: [
              {
                candles: 5,
                label: "5K",
                sampleCount: 6,
                averageReturnPct: 0.1,
                medianReturnPct: 0,
                winRatePct: 50,
                averageMfePct: 1.2,
                averageMaePct: -1.1,
                bestReturnPct: 3,
                worstReturnPct: -2,
              },
            ],
          }}
        />
      </LanguageProvider>,
    );

    expect(html).toContain("Small sample; do not treat as a strong conclusion");
    expect(html).toContain("Low sample");
  });

  it("keeps sample quality labels localized", () => {
    expect(dictionaries.en.backtest.quality.none).toBe("No samples");
    expect(dictionaries.en.backtest.quality.low).toBe("Low sample");
    expect(dictionaries.zh.backtest.quality.none).toBe("无样本");
    expect(dictionaries.zh.backtest.quality.medium).toBe("可参考");
  });
});
