import type { Timeframe } from "@/lib/exchanges/types";
import { clampScore } from "./scoring";
import type {
  MultiTimeframeScanSummary,
  ScanResult,
  ScannerSignalState,
} from "./types";

export type MultiTimeframeSummary = Omit<
  MultiTimeframeScanSummary,
  "rankScore" | "timeframes"
>;

export const mtfPresetLabels: Record<MtfPreset, string> = {
  short: "1H / 4H / 1D",
  swing: "4H / 1D / 7D",
  position: "1D / 7D / 1M",
  full: "1H / 4H / 1D / 7D / 1M",
};

export type MtfPreset = "short" | "swing" | "position" | "full";

export const mtfPresetTimeframes: Record<MtfPreset, Timeframe[]> = {
  short: ["1h", "4h", "1d"],
  swing: ["4h", "1d", "7d"],
  position: ["1d", "7d", "1m"],
  full: ["1h", "4h", "1d", "7d", "1m"],
};

const constructiveSignals = new Set<ScannerSignalState>([
  "WATCHLIST",
  "CONFIRMED",
  "TREND_CONTINUATION",
]);
const riskSignals = new Set<ScannerSignalState>(["HIGH_RISK", "WEAK"]);
const higherTimeframes = new Set<Timeframe>(["1d", "7d", "1m"]);

export function summarizeMultiTimeframe(
  results: ScanResult[],
): MultiTimeframeSummary {
  const constructiveCount = results.filter((result) =>
    isConstructive(result.signal.state),
  ).length;
  const riskCount = results.filter((result) => isRisk(result.signal.state)).length;
  const byTimeframe = new Map(results.map((result) => [result.timeframe, result]));
  const oneHour = byTimeframe.get("1h");
  const fourHour = byTimeframe.get("4h");
  const daily = byTimeframe.get("1d");
  const higherRiskCount = results.filter(
    (result) =>
      higherTimeframes.has(result.timeframe) && isRisk(result.signal.state),
  ).length;
  const shortTermConstructive = [oneHour, fourHour].some(
    (result) => result && isConstructive(result.signal.state),
  );
  const coreConstructive =
    Boolean(fourHour && isConstructive(fourHour.signal.state)) &&
    Boolean(daily && isConstructive(daily.signal.state));

  if (riskCount >= 3 || higherRiskCount >= 2) {
    return {
      alignment: "HIGH_RISK",
      label: "High Risk",
      summary: "Multiple timeframes are weak or risk-heavy.",
      constructiveCount,
      riskCount,
    };
  }

  if (coreConstructive && higherRiskCount === 0) {
    return {
      alignment: "STRONG_ALIGNMENT",
      label: "Strong Alignment",
      summary: "4H and 1D structure are constructive without higher-timeframe risk.",
      constructiveCount,
      riskCount,
    };
  }

  if (shortTermConstructive && (!daily || !isRisk(daily.signal.state))) {
    return {
      alignment: "EARLY_4H_SIGNAL",
      label: "Early Signal",
      summary: "Shorter timeframes are improving before full daily confirmation.",
      constructiveCount,
      riskCount,
    };
  }

  if (daily && isConstructive(daily.signal.state)) {
    return {
      alignment: "DAILY_CONFIRMATION",
      label: "Daily Confirmed",
      summary: "Daily structure is constructive, but lower timeframes are mixed.",
      constructiveCount,
      riskCount,
    };
  }

  return {
    alignment: "CONFLICTING",
    label: "Mixed",
    summary: "Timeframes are not aligned enough for a clear structure read.",
    constructiveCount,
    riskCount,
  };
}

export function calculateMultiTimeframeRankScore(
  results: ScanResult[],
  summary: MultiTimeframeSummary,
) {
  const averageRank =
    results.reduce((total, result) => total + result.rankScore, 0) /
    Math.max(results.length, 1);
  const alignmentBonus = getAlignmentBonus(summary.alignment);
  const structureBonus = summary.constructiveCount * 4 - summary.riskCount * 8;

  return clampScore(averageRank + alignmentBonus + structureBonus);
}

function getAlignmentBonus(alignment: MultiTimeframeSummary["alignment"]) {
  switch (alignment) {
    case "STRONG_ALIGNMENT":
      return 25;
    case "DAILY_CONFIRMATION":
      return 15;
    case "EARLY_4H_SIGNAL":
      return 10;
    case "HIGH_RISK":
      return -30;
    case "CONFLICTING":
    default:
      return -10;
  }
}

function isConstructive(signal: ScannerSignalState) {
  return constructiveSignals.has(signal);
}

function isRisk(signal: ScannerSignalState) {
  return riskSignals.has(signal);
}
