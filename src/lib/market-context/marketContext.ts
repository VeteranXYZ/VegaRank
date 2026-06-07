import type { ScanResultGroup } from "@/lib/scanner/scanResultGroups";
import type { ActiveScannerCode } from "@/lib/scanner-codebook/codeRegistry";

export const MARKET_CONTEXT_SYMBOLS = ["BTCUSDT", "ETHUSDT"] as const;
export const MARKET_CONTEXT_TIMEFRAMES = ["1w", "1d", "4h"] as const;

export type MarketContextSymbol = (typeof MARKET_CONTEXT_SYMBOLS)[number];
export type MarketContextTimeframe = (typeof MARKET_CONTEXT_TIMEFRAMES)[number];

export type MarketContextRunContext =
  | "full_universe"
  | "selected_full_universe"
  | "smaller_or_manual"
  | "unknown";

export type MarketContextUnavailableReason =
  | "no_latest_signal"
  | "missing_symbol"
  | "insufficient_data";

export type StructuralContext =
  | "long_term_risk_on"
  | "long_term_risk_off"
  | "long_term_mixed"
  | "insufficient_data";

export type DailyMarketContext =
  | "risk_on"
  | "risk_off"
  | "mixed"
  | "unstable"
  | "insufficient_data";

export type TacticalContext =
  | "short_term_repair"
  | "short_term_weakness"
  | "short_term_overextended"
  | "short_term_mixed"
  | "insufficient_data";

export type CombinedMarketContext =
  | "bull_trend_continuation"
  | "bear_market_repair"
  | "risk_off_continuation"
  | "mixed_transition"
  | "unstable_transition"
  | "insufficient_data";

export type MarketContextConfidence = "high" | "medium" | "low";

export type ResearchPosture =
  | "constructive"
  | "cautious"
  | "defensive"
  | "mixed"
  | "insufficient_data";

export type AvailableMarketContextProxy = {
  available: true;
  timeframe: MarketContextTimeframe;
  groupCode: ActiveScannerCode;
  actionCode: ActiveScannerCode;
  riskCode: ActiveScannerCode | null;
  riskCodes: ActiveScannerCode[];
  setupCode: ActiveScannerCode;
  phaseCode: ActiveScannerCode;
  reasonCodes: ActiveScannerCode[];
  signalCodes: ActiveScannerCode[];
  qualityCodes: ActiveScannerCode[];
  metrics: {
    rankScore: number | null;
  };
  scannerVersion: string;
  codeSchemaVersion: string;
  dictionaryVersion: string;
  scanTime: string | null;
  candleOpenTime: string | null;
  runContext: MarketContextRunContext;
};

export type UnavailableMarketContextProxy = {
  available: false;
  timeframe: MarketContextTimeframe;
  reason: MarketContextUnavailableReason;
};

export type MarketContextProxy =
  | AvailableMarketContextProxy
  | UnavailableMarketContextProxy;

export type MarketContextProxyMap = Record<
  MarketContextSymbol,
  Record<MarketContextTimeframe, MarketContextProxy>
>;

export type MarketContextResponse = {
  ok: true;
  assetClass: "crypto";
  generatedAt: string;
  context: {
    structuralContext: StructuralContext;
    marketContext: DailyMarketContext;
    tacticalContext: TacticalContext;
    combinedContext: CombinedMarketContext;
    confidence: MarketContextConfidence;
  };
  summary: {
    title: string;
    description: string;
    researchPosture: ResearchPosture;
    keyPoints: string[];
    warnings: string[];
  };
  proxies: MarketContextProxyMap;
  rules: {
    primaryDriver: "BTCUSDT";
    structuralTimeframe: "1w";
    marketTimeframe: "1d";
    tacticalTimeframe: "4h";
    confirmationAsset: "ETHUSDT";
    researchOnly: true;
  };
};

type ProxyDirection = "risk_on" | "risk_off" | "mixed" | "unstable" | "unavailable";
type EthConfirmationTone =
  | "confirms_risk"
  | "confirms_constructive"
  | "mixed"
  | "diverges"
  | "insufficient";

type EthConfirmation = {
  tone: EthConfirmationTone;
  label: string;
};

const MAJOR_RISK_CODES = new Set<ActiveScannerCode>([
  "RK_302",
  "RK_304",
  "VL_304",
  "RK_305",
]);

export function createUnavailableMarketContextProxy(
  timeframe: MarketContextTimeframe,
  reason: MarketContextUnavailableReason,
): UnavailableMarketContextProxy {
  return {
    available: false,
    timeframe,
    reason,
  };
}

export function buildMarketContextResponse({
  assetClass,
  generatedAt = new Date().toISOString(),
  proxies,
}: {
  assetClass: "crypto";
  generatedAt?: string;
  proxies: MarketContextProxyMap;
}): MarketContextResponse {
  const btc = proxies.BTCUSDT;
  const eth = proxies.ETHUSDT;
  const structuralContext = classifyStructuralContext(btc["1w"]);
  const marketContext = classifyDailyMarketContext(btc["1d"], eth["1d"]);
  const tacticalContext = classifyTacticalContext(btc["4h"]);
  const combinedContext = classifyCombinedContext({
    structuralContext,
    marketContext,
    tacticalContext,
  });
  const ethConfirmation = classifyEthConfirmation(proxies);
  const warnings = buildWarnings({
    proxies,
    structuralContext,
    marketContext,
    tacticalContext,
    ethConfirmation,
  });
  const confidence = classifyConfidence({
    proxies,
    structuralContext,
    marketContext,
  });
  const summaryBase = getCombinedSummary({
    combinedContext,
    structuralContext,
    marketContext,
    tacticalContext,
    ethConfirmation,
  });

  return {
    ok: true,
    assetClass,
    generatedAt,
    context: {
      structuralContext,
      marketContext,
      tacticalContext,
      combinedContext,
      confidence,
    },
    summary: {
      ...summaryBase,
      keyPoints: buildKeyPoints({
        structuralContext,
        marketContext,
        tacticalContext,
        ethConfirmation,
      }),
      warnings,
    },
    proxies,
    rules: {
      primaryDriver: "BTCUSDT",
      structuralTimeframe: "1w",
      marketTimeframe: "1d",
      tacticalTimeframe: "4h",
      confirmationAsset: "ETHUSDT",
      researchOnly: true,
    },
  };
}

function classifyStructuralContext(proxy: MarketContextProxy): StructuralContext {
  if (!proxy.available) {
    return "insufficient_data";
  }

  const group = getProxyGroup(proxy);

  if (group === "risk") {
    return "long_term_risk_off";
  }

  if (group === "eligible" || group === "watch") {
    return isConstructiveProxy(proxy)
      ? "long_term_risk_on"
      : "long_term_mixed";
  }

  return "long_term_mixed";
}

function classifyDailyMarketContext(
  btcProxy: MarketContextProxy,
  ethProxy: MarketContextProxy,
): DailyMarketContext {
  if (!btcProxy.available) {
    return "insufficient_data";
  }

  const group = getProxyGroup(btcProxy);

  if (group === "risk") {
    return "risk_off";
  }

  if (group === "eligible") {
    return "risk_on";
  }

  if (group === "watch") {
    if (!isConstructiveProxy(btcProxy)) {
      return "mixed";
    }

    return getProxyDirection(ethProxy) === "risk_on" ? "risk_on" : "mixed";
  }

  if (group === "overheated") {
    return "unstable";
  }

  return "mixed";
}

function classifyTacticalContext(proxy: MarketContextProxy): TacticalContext {
  if (!proxy.available) {
    return "insufficient_data";
  }

  if (
    (getProxyGroup(proxy) === "eligible" || getProxyGroup(proxy) === "watch") &&
    isPositiveRank(proxy)
  ) {
    return "short_term_repair";
  }

  if (getProxyGroup(proxy) === "risk") {
    return "short_term_weakness";
  }

  if (getProxyGroup(proxy) === "overheated") {
    return "short_term_overextended";
  }

  return "short_term_mixed";
}

function classifyCombinedContext({
  structuralContext,
  marketContext,
  tacticalContext,
}: {
  structuralContext: StructuralContext;
  marketContext: DailyMarketContext;
  tacticalContext: TacticalContext;
}): CombinedMarketContext {
  if (
    structuralContext === "insufficient_data" ||
    marketContext === "insufficient_data"
  ) {
    return "insufficient_data";
  }

  const higherTimeframesWeak =
    structuralContext === "long_term_risk_off" || marketContext === "risk_off";

  if (
    marketContext === "unstable" ||
    (tacticalContext === "short_term_overextended" && higherTimeframesWeak)
  ) {
    return "unstable_transition";
  }

  if (
    structuralContext === "long_term_risk_on" &&
    marketContext === "risk_on"
  ) {
    return "bull_trend_continuation";
  }

  if (
    structuralContext === "long_term_risk_off" &&
    marketContext === "risk_off"
  ) {
    return "risk_off_continuation";
  }

  if (
    structuralContext === "long_term_risk_off" &&
    (marketContext === "mixed" || marketContext === "risk_on")
  ) {
    return "bear_market_repair";
  }

  if (
    structuralContext === "long_term_mixed" &&
    (marketContext === "risk_on" || marketContext === "mixed")
  ) {
    return "mixed_transition";
  }

  return "unstable_transition";
}

function classifyConfidence({
  proxies,
  structuralContext,
  marketContext,
}: {
  proxies: MarketContextProxyMap;
  structuralContext: StructuralContext;
  marketContext: DailyMarketContext;
}): MarketContextConfidence {
  if (
    structuralContext === "insufficient_data" ||
    marketContext === "insufficient_data"
  ) {
    return "low";
  }

  const weeklyPair = getDirectionPair(proxies.BTCUSDT["1w"], proxies.ETHUSDT["1w"]);
  const dailyPair = getDirectionPair(proxies.BTCUSDT["1d"], proxies.ETHUSDT["1d"]);
  const pairs = [weeklyPair, dailyPair];
  const unavailablePairs = pairs.filter((pair) => pair.includes("unavailable"));
  const divergentPairs = pairs.filter(([btcDirection, ethDirection]) =>
    isDivergentDirection(btcDirection, ethDirection),
  );

  if (divergentPairs.length >= 2) {
    return "low";
  }

  if (
    divergentPairs.length === 0 &&
    unavailablePairs.length === 0 &&
    pairs.every(([btcDirection, ethDirection]) => btcDirection === ethDirection)
  ) {
    return "high";
  }

  return "medium";
}

function buildWarnings({
  proxies,
  structuralContext,
  marketContext,
  tacticalContext,
  ethConfirmation,
}: {
  proxies: MarketContextProxyMap;
  structuralContext: StructuralContext;
  marketContext: DailyMarketContext;
  tacticalContext: TacticalContext;
  ethConfirmation: EthConfirmation;
}) {
  const warnings: string[] = [];

  if (ethConfirmation.tone === "diverges") {
    warnings.push("BTC and ETH context diverge.");
  }

  if (ethConfirmation.tone === "mixed") {
    warnings.push("ETH confirmation is mixed versus BTC.");
  }

  if (ethConfirmation.tone === "insufficient") {
    warnings.push("ETH confirmation data is insufficient.");
  }

  if (
    structuralContext === "long_term_risk_off" &&
    (marketContext === "mixed" ||
      marketContext === "risk_on" ||
      tacticalContext === "short_term_repair")
  ) {
    warnings.push(
      "Weekly context remains weak while shorter timeframes are repairing.",
    );
  }

  if (
    tacticalContext === "short_term_overextended" &&
    (structuralContext === "long_term_risk_off" || marketContext === "risk_off")
  ) {
    warnings.push(
      "Short-term context is overextended inside weak higher-timeframe structure.",
    );
  }

  if (hasUnavailableProxy(proxies)) {
    warnings.push("Some proxy timeframe data is unavailable.");
  }

  warnings.push("Research-only context. Not a trading signal.");

  return warnings;
}

function buildKeyPoints({
  structuralContext,
  marketContext,
  tacticalContext,
  ethConfirmation,
}: {
  structuralContext: StructuralContext;
  marketContext: DailyMarketContext;
  tacticalContext: TacticalContext;
  ethConfirmation: EthConfirmation;
}) {
  return [
    `BTC 1w structural context: ${formatContextValue(structuralContext)}.`,
    `BTC 1d market context: ${formatContextValue(marketContext)}.`,
    `BTC 4h tactical context: ${formatContextValue(tacticalContext)}.`,
    `ETH confirmation: ${ethConfirmation.label}.`,
  ];
}

function getCombinedSummary({
  combinedContext,
  structuralContext,
  marketContext,
  tacticalContext,
  ethConfirmation,
}: {
  combinedContext: CombinedMarketContext;
  structuralContext: StructuralContext;
  marketContext: DailyMarketContext;
  tacticalContext: TacticalContext;
  ethConfirmation: EthConfirmation;
}): Pick<MarketContextResponse["summary"], "title" | "description" | "researchPosture"> {
  switch (combinedContext) {
    case "risk_off_continuation":
      return {
        title: "Broad risk-off context",
        description:
          "BTC structural and daily contexts are both risk-oriented. Short-term repair signals should be interpreted cautiously.",
        researchPosture: "defensive",
      };
    case "bear_market_repair":
      return {
        title: "Repair attempt inside weak structure",
        description:
          "BTC long-term structure remains weak, while daily or tactical context shows repair. Short-term strength should be treated as a repair attempt until higher timeframes improve.",
        researchPosture: "cautious",
      };
    case "bull_trend_continuation":
      return {
        title: "Constructive market backdrop",
        description:
          "BTC structural and daily contexts are constructive. Eligible/watch signals may have a more supportive backdrop, subject to symbol-specific risk.",
        researchPosture: "constructive",
      };
    case "unstable_transition":
      if (
        marketContext === "risk_off" &&
        tacticalContext === "short_term_weakness"
      ) {
        return {
          title: "Risk-oriented transition",
          description: buildRiskOrientedTransitionDescription({
            structuralContext,
            ethConfirmation,
          }),
          researchPosture: "defensive",
        };
      }

      return {
        title: "Unstable transition",
        description:
          "Short-term strength or overextension conflicts with weaker higher-timeframe context. Avoid over-interpreting short-term signals.",
        researchPosture: "mixed",
      };
    case "mixed_transition":
      return {
        title: "Mixed transition",
        description:
          "Market context is not fully aligned across timeframes. Symbol-level signals should be interpreted with extra caution.",
        researchPosture: "mixed",
      };
    case "insufficient_data":
      return {
        title: "Market context unavailable",
        description:
          "Major BTC proxy timeframe data is unavailable, so market context cannot be classified with confidence.",
        researchPosture: "insufficient_data",
      };
  }
}

function buildRiskOrientedTransitionDescription({
  structuralContext,
  ethConfirmation,
}: {
  structuralContext: StructuralContext;
  ethConfirmation: EthConfirmation;
}) {
  if (ethConfirmation.tone === "confirms_risk") {
    return `BTC daily and tactical contexts are risk-oriented while weekly BTC ${formatStructuralSummary(structuralContext)}. ETH confirms broader weakness, so short-term repair signals should be interpreted cautiously.`;
  }

  return `BTC daily and tactical contexts are risk-oriented while weekly BTC ${formatStructuralSummary(structuralContext)}. ${formatEthSummarySentence(ethConfirmation)} Short-term repair signals should be interpreted cautiously.`;
}

function classifyEthConfirmation(proxies: MarketContextProxyMap): EthConfirmation {
  const btcDirections = getProxyDirections(proxies.BTCUSDT);
  const ethDirections = getProxyDirections(proxies.ETHUSDT);

  if (ethDirections.some((direction) => direction === "unavailable")) {
    return {
      tone: "insufficient",
      label: "data insufficient",
    };
  }

  if (
    countDirections(btcDirections, "risk_off") >= 2 &&
    countDirections(ethDirections, "risk_off") >= 2
  ) {
    return {
      tone: "confirms_risk",
      label: "confirms broader risk",
    };
  }

  if (
    countDirections(btcDirections, "risk_on") >= 2 &&
    countDirections(ethDirections, "risk_on") >= 2
  ) {
    return {
      tone: "confirms_constructive",
      label: "confirms constructive context",
    };
  }

  if (
    isBroadlyDivergent({
      btcDirections,
      ethDirections,
    })
  ) {
    return {
      tone: "diverges",
      label: "diverges from BTC",
    };
  }

  return {
    tone: "mixed",
    label: "mixed versus BTC",
  };
}

function getProxyDirections(
  proxies: Record<MarketContextTimeframe, MarketContextProxy>,
) {
  return MARKET_CONTEXT_TIMEFRAMES.map((timeframe) =>
    getProxyDirection(proxies[timeframe]),
  );
}

function countDirections(
  directions: ProxyDirection[],
  direction: ProxyDirection,
) {
  return directions.filter((value) => value === direction).length;
}

function isBroadlyDivergent({
  btcDirections,
  ethDirections,
}: {
  btcDirections: ProxyDirection[];
  ethDirections: ProxyDirection[];
}) {
  const btcRiskCount = countDirections(btcDirections, "risk_off");
  const btcConstructiveCount = countDirections(btcDirections, "risk_on");
  const ethRiskCount = countDirections(ethDirections, "risk_off");
  const ethConstructiveCount = countDirections(ethDirections, "risk_on");

  return (
    (btcRiskCount >= 2 && ethConstructiveCount >= 2) ||
    (btcConstructiveCount >= 2 && ethRiskCount >= 2)
  );
}

function formatStructuralSummary(structuralContext: StructuralContext) {
  switch (structuralContext) {
    case "long_term_risk_on":
      return "remains constructive";
    case "long_term_risk_off":
      return "remains weak";
    case "long_term_mixed":
      return "remains mixed";
    case "insufficient_data":
      return "is unavailable";
  }
}

function formatEthSummarySentence(ethConfirmation: EthConfirmation) {
  switch (ethConfirmation.tone) {
    case "confirms_constructive":
      return "ETH is constructive, creating cross-asset tension.";
    case "diverges":
      return "ETH diverges from BTC, reducing confidence.";
    case "insufficient":
      return "ETH confirmation data is insufficient.";
    case "mixed":
      return "ETH confirmation is mixed versus BTC.";
    case "confirms_risk":
      return "ETH confirms broader weakness.";
  }
}

function getDirectionPair(
  btcProxy: MarketContextProxy,
  ethProxy: MarketContextProxy,
): [ProxyDirection, ProxyDirection] {
  return [getProxyDirection(btcProxy), getProxyDirection(ethProxy)];
}

function getProxyDirection(proxy: MarketContextProxy): ProxyDirection {
  if (!proxy.available) {
    return "unavailable";
  }

  const group = getProxyGroup(proxy);

  if (group === "risk") {
    return "risk_off";
  }

  if (group === "overheated") {
    return "unstable";
  }

  if (
    (group === "eligible" || group === "watch") &&
    isConstructiveProxy(proxy)
  ) {
    return "risk_on";
  }

  return "mixed";
}

function isDivergentDirection(
  btcDirection: ProxyDirection,
  ethDirection: ProxyDirection,
) {
  if (btcDirection === "unavailable" || ethDirection === "unavailable") {
    return false;
  }

  if (btcDirection === "risk_off") {
    return ethDirection === "risk_on";
  }

  if (btcDirection === "risk_on") {
    return ethDirection === "risk_off";
  }

  return btcDirection === "unstable" && ethDirection === "risk_on";
}

function isConstructiveProxy(proxy: AvailableMarketContextProxy) {
  return isPositiveRank(proxy) && !hasMajorDetectedRisk(proxy);
}

function isPositiveRank(proxy: AvailableMarketContextProxy) {
  return (proxy.metrics.rankScore ?? Number.NEGATIVE_INFINITY) > 0;
}

function hasMajorDetectedRisk(proxy: AvailableMarketContextProxy) {
  return proxy.riskCodes.some((riskCode) => MAJOR_RISK_CODES.has(riskCode));
}

function getProxyGroup(proxy: AvailableMarketContextProxy): ScanResultGroup {
  switch (proxy.groupCode) {
    case "GR_601":
    case "GR_501":
      return "eligible";
    case "GR_201":
    case "GR_101":
      return "watch";
    case "GR_302":
      return "overheated";
    case "GR_301":
      return "risk";
    case "GR_402":
    case "GR_401":
      return "insufficient_history";
    default:
      return "neutral";
  }
}

function hasUnavailableProxy(proxies: MarketContextProxyMap) {
  return MARKET_CONTEXT_SYMBOLS.some((symbol) =>
    MARKET_CONTEXT_TIMEFRAMES.some(
      (timeframe) => !proxies[symbol][timeframe].available,
    ),
  );
}

function formatContextValue(value: string) {
  return value.replace(/_/g, " ");
}
