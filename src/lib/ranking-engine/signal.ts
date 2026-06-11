import {
  scannerSignalLabels,
  scannerSignalOrder,
} from "@/lib/shared/rankingConfig";
import type { MarketPhase, ScannerSignal } from "./types";

export { scannerSignalLabels, scannerSignalOrder };

type SignalInput = {
  phase: MarketPhase;
  opportunityScore: number;
  confirmationScore: number;
  riskScore: number;
  rankScore?: number;
};

export function deriveScannerSignal({
  phase,
  opportunityScore,
  confirmationScore,
  riskScore,
  rankScore = 0,
}: SignalInput): ScannerSignal {
  if (phase === "BREAKDOWN") {
    return {
      state: "WEAK",
      label: scannerSignalLabels.WEAK,
      summary: "Price and momentum are below key trend levels.",
    };
  }

  if (riskScore >= 55 || phase === "OVEREXTENDED" || phase === "DISTRIBUTION") {
    return {
      state: "HIGH_RISK",
      label: scannerSignalLabels.HIGH_RISK,
      summary: "Risk conditions dominate this setup.",
    };
  }

  if (
    phase === "BREAKOUT_CONFIRMED" &&
    confirmationScore >= 80 &&
    riskScore <= 25
  ) {
    return {
      state: "CONFIRMED",
      label: scannerSignalLabels.CONFIRMED,
      summary: "Breakout has trend, momentum, and volume confirmation.",
    };
  }

  if (
    phase === "BREAKOUT_ATTEMPT" &&
    rankScore >= 60 &&
    confirmationScore >= 70 &&
    riskScore <= 25
  ) {
    return {
      state: "WATCHLIST",
      label: scannerSignalLabels.WATCHLIST,
      summary:
        "Breakout attempt has volume and momentum confirmation, but follow-through is still needed.",
    };
  }

  if (
    (phase === "BREAKOUT_CONFIRMED" || phase === "TRENDING") &&
    rankScore >= 60 &&
    confirmationScore >= 70 &&
    riskScore <= 25
  ) {
    return {
      state: phase === "TRENDING" ? "TREND_CONTINUATION" : "WATCHLIST",
      label:
        phase === "TRENDING"
          ? scannerSignalLabels.TREND_CONTINUATION
          : scannerSignalLabels.WATCHLIST,
      summary:
        phase === "TRENDING"
          ? "Trend structure remains constructive with manageable risk."
          : "Breakout structure is constructive, but follow-through is still needed.",
    };
  }

  if (
    (phase === "SQUEEZE" || phase === "BASE_BUILDING") &&
    opportunityScore >= 70 &&
    riskScore <= 35
  ) {
    return {
      state: "WATCHLIST",
      label: scannerSignalLabels.WATCHLIST,
      summary: "Compression or base structure is forming, but confirmation is still needed.",
    };
  }

  if (
    (phase === "TRENDING" || phase === "PULLBACK_HEALTHY") &&
    confirmationScore >= 45 &&
    riskScore <= 40
  ) {
    return {
      state: "TREND_CONTINUATION",
      label: scannerSignalLabels.TREND_CONTINUATION,
      summary: "Trend structure remains constructive with manageable risk.",
    };
  }

  return {
    state: "NEUTRAL",
    label: scannerSignalLabels.NEUTRAL,
    summary: "No clear edge from the current ranking rules.",
  };
}
