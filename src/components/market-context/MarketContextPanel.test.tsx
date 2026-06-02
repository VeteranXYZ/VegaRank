import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarketContextPanel } from "./MarketContextPanel";
import type { MarketContextResponse } from "./marketContextUi";

describe("MarketContextPanel", () => {
  it("renders risk-oriented context with professional research copy", () => {
    const html = renderToStaticMarkup(
      createElement(MarketContextPanel, {
        data: makeMarketContextResponse(),
      }),
    );

    expect(html).toContain("Market Context");
    expect(html).toContain("Risk-oriented transition");
    expect(html).toContain("Confirms broader risk");
    expect(html).toContain("Medium confidence");
    expect(html).toContain("Broad regime");
    expect(html).toContain("BTC structural layer");
    expect(html).toContain("BTC market layer");
    expect(html).toContain("BTC tactical layer");
    expect(html).toContain("ETH confirmation");
    expect(html).toContain("Research implication");
    expect(html).toContain("Backdrop, not signal");
    expect(html).toContain("does not change rankings");
    expect(html).toContain("does not alter symbol-level classifications");
  });

  it("renders constructive and mixed states with concise titles", () => {
    const constructiveHtml = renderToStaticMarkup(
      createElement(MarketContextPanel, {
        data: makeMarketContextResponse({
          context: {
            structuralContext: "long_term_risk_on",
            marketContext: "risk_on",
            tacticalContext: "short_term_repair",
            combinedContext: "bull_trend_continuation",
            confidence: "high",
          },
          summary: {
            title: "Constructive market backdrop",
            description: "Backend summary.",
            researchPosture: "constructive",
            keyPoints: ["ETH confirmation: confirms constructive context."],
            warnings: ["Research-only context. Not a trading signal."],
          },
        }),
      }),
    );
    const mixedHtml = renderToStaticMarkup(
      createElement(MarketContextPanel, {
        data: makeMarketContextResponse({
          context: {
            structuralContext: "long_term_mixed",
            marketContext: "mixed",
            tacticalContext: "short_term_mixed",
            combinedContext: "mixed_transition",
            confidence: "medium",
          },
        }),
      }),
    );

    expect(constructiveHtml).toContain("Constructive backdrop");
    expect(constructiveHtml).toContain("High confidence");
    expect(mixedHtml).toContain("Mixed backdrop");
    expect(mixedHtml).toContain("Mixed market context reduces confidence");
  });

  it("renders an unavailable state without blocking page content", () => {
    const html = renderToStaticMarkup(
      createElement(MarketContextPanel, { isError: true }),
    );

    expect(html).toContain("Market context unavailable");
    expect(html).toContain("Screener and watchlist data are still shown normally");
    expect(html).toContain("Unavailable");
  });

  it("does not render directional trading instruction language", () => {
    const html = renderToStaticMarkup(
      createElement(MarketContextPanel, {
        data: makeMarketContextResponse(),
      }),
    ).toLowerCase();

    expect(html).not.toMatch(/\b(buy|sell|enter|exit|target)\b/);
    expect(html).not.toMatch(/stop\s+loss|position\s+size/);
    expect(html).not.toMatch(/\blong\s+(signal|setup|position)\b/);
    expect(html).not.toMatch(/\bshort\s+(signal|setup|position)\b/);
  });
});

function makeMarketContextResponse(
  overrides: Partial<MarketContextResponse> = {},
): MarketContextResponse {
  const base: MarketContextResponse = {
    ok: true,
    assetClass: "crypto",
    context: {
      structuralContext: "long_term_mixed",
      marketContext: "risk_off",
      tacticalContext: "short_term_weakness",
      combinedContext: "unstable_transition",
      confidence: "medium",
    },
    summary: {
      title: "Risk-oriented transition",
      description:
        "BTC daily and tactical contexts are risk-oriented while weekly BTC remains mixed. ETH confirms broader weakness, so short-term repair signals should be interpreted cautiously.",
      researchPosture: "mixed",
      keyPoints: [
        "BTC 1w structural context: long term mixed.",
        "BTC 1d market context: risk off.",
        "BTC 4h tactical context: short term weakness.",
        "ETH confirmation: confirms broader risk.",
      ],
      warnings: ["Research-only context. Not a trading signal."],
    },
    rules: {
      researchOnly: true,
    },
  };

  return {
    ...base,
    ...overrides,
    context: {
      ...base.context,
      ...overrides.context,
    },
    summary: {
      ...base.summary,
      ...overrides.summary,
    },
  };
}
