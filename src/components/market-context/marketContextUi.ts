export type MarketContextResponse = {
  ok: boolean;
  assetClass: string;
  generatedAt?: string;
  context: {
    structuralContext: string;
    marketContext: string;
    tacticalContext: string;
    combinedContext: string;
    confidence: string;
  };
  summary: {
    title: string;
    description: string;
    researchPosture: string;
    keyPoints: string[];
    warnings: string[];
  };
  rules?: {
    researchOnly?: boolean;
  };
};

export type MarketContextPanelState = {
  data?: MarketContextResponse;
  isLoading?: boolean;
  isError?: boolean;
};

export type MarketContextChip = {
  label: string;
  value: string;
  tone: "constructive" | "risk" | "mixed" | "neutral";
};

export type MarketContextPanelView = {
  title: string;
  description: string;
  contextNote: string;
  keyPoints: string[];
  chips: MarketContextChip[];
  unavailable: boolean;
};

const labelMap: Record<string, string> = {
  long_term_risk_on: "Long-term constructive",
  long_term_risk_off: "Long-term risk",
  long_term_mixed: "Long-term mixed",
  long_term_constructive: "Long-term constructive",
  long_term_risk: "Long-term risk",
  "long term risk on": "Long-term constructive",
  "long term risk off": "Long-term risk",
  "long term mixed": "Long-term mixed",
  "long term constructive": "Long-term constructive",
  "long term risk": "Long-term risk",
  risk_on: "Risk-on",
  risk_off: "Risk-off",
  "risk on": "Risk-on",
  "risk off": "Risk-off",
  market_mixed: "Mixed market",
  mixed: "Mixed market",
  "mixed market": "Mixed market",
  unstable: "Unstable",
  short_term_repair: "Short-term repair",
  short_term_weakness: "Short-term weakness",
  short_term_overextended: "Short-term overextension",
  short_term_mixed: "Short-term mixed",
  short_term_strength: "Short-term strength",
  "short term repair": "Short-term repair",
  "short term weakness": "Short-term weakness",
  "short term overextended": "Short-term overextension",
  "short term overextension": "Short-term overextension",
  "short term mixed": "Short-term mixed",
  "short term strength": "Short-term strength",
  bull_trend_continuation: "Constructive backdrop",
  bear_market_repair: "Repair inside weak structure",
  risk_off_continuation: "Broad risk-off context",
  mixed_transition: "Mixed backdrop",
  unstable_transition: "Risk-oriented transition",
  insufficient_data: "Insufficient data",
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

export function buildMarketContextUrl({
  assetClass,
  tradeApiBaseUrl = process.env.NEXT_PUBLIC_TRADE_API_BASE_URL,
}: {
  assetClass: string;
  tradeApiBaseUrl?: string;
}) {
  const params = new URLSearchParams({ assetClass });
  const baseUrl = tradeApiBaseUrl?.trim().replace(/\/+$/, "") ?? "";

  return `${baseUrl}/api/market/context?${params.toString()}`;
}

export async function fetchMarketContext({
  assetClass,
  signal,
  tradeApiBaseUrl,
}: {
  assetClass: string;
  signal?: AbortSignal;
  tradeApiBaseUrl?: string;
}): Promise<MarketContextResponse> {
  const response = await fetch(
    buildMarketContextUrl({ assetClass, tradeApiBaseUrl }),
    { signal },
  );

  if (!response.ok) {
    throw new Error(`Failed to load market context (${response.status}).`);
  }

  return (await response.json()) as MarketContextResponse;
}

export function buildMarketContextPanelView({
  data,
  isLoading = false,
  isError = false,
}: MarketContextPanelState): MarketContextPanelView {
  if (isError) {
    return buildUnavailableMarketContextView();
  }

  if (!data) {
    if (isLoading) {
      return {
        title: "Loading market context",
        description:
          "Loading broader BTC/ETH research backdrop. Screener and watchlist data are still shown normally.",
        contextNote:
          "This context is informational and does not alter symbol-level classifications.",
        keyPoints: [],
        chips: [
          {
            label: "Status",
            value: "Loading",
            tone: "neutral",
          },
        ],
        unavailable: false,
      };
    }

    return buildUnavailableMarketContextView();
  }

  const confirmationLabel = getEthConfirmationLabel(data);

  return {
    title: getMarketContextPanelTitle(data),
    description: getMarketContextPanelDescription(data),
    contextNote: getMarketContextPanelNote(data),
    keyPoints: formatMarketContextKeyPoints(data.summary.keyPoints),
    chips: [
      {
        label: "Structural",
        value: formatMarketContextLabel(data.context.structuralContext),
        tone: getContextTone(data.context.structuralContext),
      },
      {
        label: "Market",
        value: formatMarketContextLabel(data.context.marketContext),
        tone: getContextTone(data.context.marketContext),
      },
      {
        label: "Tactical",
        value: formatMarketContextLabel(data.context.tacticalContext),
        tone: getContextTone(data.context.tacticalContext),
      },
      {
        label: "Confirmation",
        value: confirmationLabel,
        tone: getConfirmationTone(confirmationLabel),
      },
      {
        label: "Confidence",
        value: formatMarketContextLabel(data.context.confidence),
        tone: data.context.confidence === "high" ? "constructive" : "mixed",
      },
    ],
    unavailable: false,
  };
}

export function buildUnavailableMarketContextView(): MarketContextPanelView {
  return {
    title: "Market context unavailable",
    description:
      "The market context API could not be loaded. Screener and watchlist data are still shown normally.",
    contextNote:
      "This context is informational and does not alter symbol-level classifications.",
    keyPoints: [],
    chips: [
      {
        label: "Status",
        value: "Unavailable",
        tone: "neutral",
      },
    ],
    unavailable: true,
  };
}

export function formatMarketContextLabel(value: string | null | undefined) {
  const normalized = value?.trim();

  if (!normalized) {
    return "Unavailable";
  }

  return labelMap[normalized] ?? toTitleCase(normalized.replace(/_/g, " "));
}

export function getEthConfirmationLabel(data: MarketContextResponse) {
  const rawPoint = data.summary.keyPoints.find((point) =>
    point.toLowerCase().startsWith("eth confirmation:"),
  );

  if (!rawPoint) {
    return "Data insufficient";
  }

  const value = rawPoint
    .replace(/^eth confirmation:/i, "")
    .trim()
    .replace(/\.+$/, "");

  return value ? toSentenceCase(value) : "Data insufficient";
}

function getMarketContextPanelTitle(data: MarketContextResponse) {
  if (isRiskOrientedContext(data)) {
    return "Risk-oriented transition";
  }

  if (data.context.combinedContext === "bull_trend_continuation") {
    return "Constructive backdrop";
  }

  if (data.context.combinedContext === "mixed_transition") {
    return "Mixed backdrop";
  }

  return data.summary.title || formatMarketContextLabel(data.context.combinedContext);
}

function getMarketContextPanelDescription(data: MarketContextResponse) {
  if (isRiskOrientedContext(data)) {
    return (
      data.summary.description ||
      "BTC daily and tactical structures are risk-oriented while weekly BTC remains mixed. ETH confirms broader weakness, so near-term repair signals should be interpreted cautiously."
    );
  }

  if (data.context.combinedContext === "bull_trend_continuation") {
    return "BTC higher-timeframe and tactical structures are aligned constructively, with ETH providing confirmation. Watchlist signals may deserve closer manual review.";
  }

  if (data.context.combinedContext === "mixed_transition") {
    return "BTC and ETH contexts are not fully aligned. Treat near-term signals as research candidates and rely on symbol-level confirmation.";
  }

  return data.summary.description;
}

function getMarketContextPanelNote(data: MarketContextResponse) {
  if (isRiskOrientedContext(data)) {
    return "This does not invalidate individual near-term setups, but it raises the bar for confirmation.";
  }

  if (data.context.combinedContext === "bull_trend_continuation") {
    return "This is research context only and does not turn scanner results into trade instructions.";
  }

  if (data.context.combinedContext === "mixed_transition") {
    return "Mixed market context reduces confidence in broad conclusions.";
  }

  return "This context is informational and does not alter symbol-level classifications.";
}

function formatMarketContextKeyPoints(keyPoints: string[]) {
  return keyPoints.map((point) => {
    if (!point.includes(":")) {
      return point;
    }

    const [prefix, ...rest] = point.split(":");
    const value = rest.join(":").trim().replace(/\.+$/, "");

    if (prefix.toLowerCase() === "eth confirmation") {
      return `${prefix}: ${toSentenceCase(value)}.`;
    }

    return `${prefix}: ${formatMarketContextLabel(value)}.`;
  });
}

function isRiskOrientedContext(data: MarketContextResponse) {
  return (
    data.context.combinedContext === "unstable_transition" &&
    data.context.marketContext === "risk_off" &&
    data.context.tacticalContext === "short_term_weakness"
  );
}

function getContextTone(value: string): MarketContextChip["tone"] {
  if (
    value.includes("risk_on") ||
    value.includes("constructive") ||
    value.includes("repair")
  ) {
    return "constructive";
  }

  if (
    value.includes("risk_off") ||
    value.includes("risk") ||
    value.includes("weakness")
  ) {
    return "risk";
  }

  if (value.includes("mixed") || value.includes("unstable")) {
    return "mixed";
  }

  return "neutral";
}

function getConfirmationTone(label: string): MarketContextChip["tone"] {
  const normalized = label.toLowerCase();

  if (normalized.includes("risk") || normalized.includes("diverge")) {
    return "risk";
  }

  if (normalized.includes("constructive")) {
    return "constructive";
  }

  if (normalized.includes("mixed")) {
    return "mixed";
  }

  return "neutral";
}

function toSentenceCase(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  return `${trimmed[0].toUpperCase()}${trimmed.slice(1)}`;
}

function toTitleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`)
    .join(" ");
}
