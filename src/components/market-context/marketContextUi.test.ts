import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildMarketContextPanelView,
  buildMarketContextUrl,
  fetchMarketContext,
  formatMarketContextLabel,
  getEthConfirmationLabel,
  isMarketContextResponse,
  type MarketContextResponse,
} from "./marketContextUi";

describe("marketContextUi", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds the market context API URL", () => {
    expect(
      buildMarketContextUrl({
        assetClass: "crypto",
        tradeApiBaseUrl: "https://api.auere.com/",
      }),
    ).toBe("https://api.auere.com/api/market/context?assetClass=crypto");
  });

  it("fetches the market context endpoint with assetClass crypto", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeMarketContextResponse()),
    });

    vi.stubGlobal("fetch", fetchMock);

    await fetchMarketContext({ assetClass: "crypto", tradeApiBaseUrl: "" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/market/context?assetClass=crypto",
      { signal: undefined },
    );
  });

  it("formats raw context labels without dumping enum names", () => {
    expect(formatMarketContextLabel("long_term_mixed")).toBe("Long-term mixed");
    expect(formatMarketContextLabel("long term mixed")).toBe("Long-term mixed");
    expect(formatMarketContextLabel("risk_off")).toBe("Risk-off");
    expect(formatMarketContextLabel("short_term_weakness")).toBe(
      "Short-term weakness",
    );
    expect(formatMarketContextLabel("medium")).toBe("Medium confidence");
  });

  it("extracts ETH confirmation from summary key points", () => {
    expect(getEthConfirmationLabel(makeMarketContextResponse())).toBe(
      "Confirms broader risk",
    );
  });

  it("builds risk-oriented panel copy from current market context", () => {
    const view = buildMarketContextPanelView({
      data: makeMarketContextResponse(),
    });

    expect(view.title).toBe("Risk-oriented transition");
    expect(view.description).toContain(
      "BTC daily and tactical contexts are risk-oriented",
    );
    expect(view.chips).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Broad regime",
          value: "Risk-oriented transition",
        }),
        expect.objectContaining({
          label: "BTC structural layer",
          value: "Long-term mixed",
        }),
        expect.objectContaining({
          label: "ETH confirmation",
          value: "Confirms broader risk",
        }),
        expect.objectContaining({
          label: "Confidence",
          value: "Medium confidence",
        }),
      ]),
    );
  });

  it("builds constructive and mixed panel titles from stable backend enums", () => {
    expect(
      buildMarketContextPanelView({
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
      }).title,
    ).toBe("Constructive backdrop");

    expect(
      buildMarketContextPanelView({
        data: makeMarketContextResponse({
          context: {
            structuralContext: "long_term_mixed",
            marketContext: "mixed",
            tacticalContext: "short_term_mixed",
            combinedContext: "mixed_transition",
            confidence: "medium",
          },
        }),
      }).title,
    ).toBe("Mixed backdrop");
  });

  it("builds a non-blocking unavailable view", () => {
    const view = buildMarketContextPanelView({ isError: true });

    expect(view.title).toBe("Market context unavailable");
    expect(view.description).toContain("Screener and watchlist data are still shown");
    expect(view.unavailable).toBe(true);
  });

  it("treats ok false and malformed context payloads as unavailable", () => {
    expect(isMarketContextResponse({ ok: false })).toBe(false);
    expect(isMarketContextResponse({ ok: true, context: null })).toBe(false);

    expect(
      buildMarketContextPanelView({
        data: { ok: false } as MarketContextResponse,
      }).unavailable,
    ).toBe(true);
    expect(
      buildMarketContextPanelView({
        data: {
          ok: true,
          context: {
            combinedContext: "mixed_transition",
          },
        } as MarketContextResponse,
      }).title,
    ).toBe("Market context unavailable");
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
