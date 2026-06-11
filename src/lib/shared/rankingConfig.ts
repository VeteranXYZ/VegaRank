import type { Timeframe } from "./timeframes";

export const scannerSignalOrder = [
  "WATCHLIST",
  "CONFIRMED",
  "TREND_CONTINUATION",
  "HIGH_RISK",
  "WEAK",
  "NEUTRAL",
] as const;

export const scannerSignalLabels: Record<
  (typeof scannerSignalOrder)[number],
  string
> = {
  WATCHLIST: "Watchlist",
  CONFIRMED: "Confirmed",
  TREND_CONTINUATION: "Trend",
  HIGH_RISK: "High Risk",
  WEAK: "Weak",
  NEUTRAL: "Neutral",
};

export type MtfPreset = "short" | "swing" | "position" | "full";

export const mtfPresetLabels: Record<MtfPreset, string> = {
  short: "4H / 1D",
  swing: "4H / 1D / 1W",
  position: "1D / 1W / 1M",
  full: "4H / 1D / 1W / 1M",
};

export const mtfPresetTimeframes: Record<MtfPreset, Timeframe[]> = {
  short: ["4h", "1d"],
  swing: ["4h", "1d", "1w"],
  position: ["1d", "1w", "1M"],
  full: ["4h", "1d", "1w", "1M"],
};
