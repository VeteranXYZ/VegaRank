import {
  MTF_SCREENER_TIMEFRAMES,
  type MtfLatestScanItem,
  type MtfLatestScanRun,
  type MtfLatestScreenerResponse,
  type MtfScreenerTimeframe,
} from "./multiTimeframeScreenerUi";

type PreviewGroup = "eligible" | "watch" | "neutral" | "overheated" | "risk";

type PreviewSymbol = {
  symbol: string;
  groups: Partial<Record<MtfScreenerTimeframe, PreviewGroup>>;
  ranks: Partial<Record<MtfScreenerTimeframe, number>>;
  signals?: Partial<Record<MtfScreenerTimeframe, string>>;
  risks?: Partial<Record<MtfScreenerTimeframe, string[]>>;
};

const previewFinishedAt = "2026-06-03T16:00:00.000Z";

const previewSymbols: PreviewSymbol[] = [
  {
    symbol: "BTCUSDT",
    groups: { "1h": "eligible", "4h": "eligible", "1d": "watch", "1w": "neutral" },
    ranks: { "1h": 92.4, "4h": 88.2, "1d": 71.8, "1w": 61.4 },
    signals: { "1h": "confirmed", "4h": "trend", "1d": "watch" },
  },
  {
    symbol: "ETHUSDT",
    groups: { "1h": "watch", "4h": "eligible", "1d": "watch", "1w": "neutral" },
    ranks: { "1h": 78.6, "4h": 84.5, "1d": 67.3, "1w": 58.1 },
  },
  {
    symbol: "BNBUSDT",
    groups: { "1h": "eligible", "4h": "eligible", "1d": "eligible", "1w": "watch" },
    ranks: { "1h": 86.1, "4h": 82.7, "1d": 76.2, "1w": 63.8 },
    signals: { "1d": "confirmed" },
  },
  {
    symbol: "SOLUSDT",
    groups: { "1h": "eligible", "4h": "watch", "1d": "neutral", "1w": "watch" },
    ranks: { "1h": 81.9, "4h": 73.5, "1d": 48.2, "1w": 54.9 },
  },
  {
    symbol: "SEIUSDT",
    groups: { "1h": "watch", "4h": "watch", "1d": "neutral" },
    ranks: { "1h": 70.2, "4h": 66.8, "1d": 40.1 },
  },
  {
    symbol: "AAVEUSDT",
    groups: { "1h": "overheated", "4h": "eligible", "1d": "neutral", "1w": "watch" },
    ranks: { "1h": 74.7, "4h": 79.4, "1d": 42.6, "1w": 55.4 },
    signals: { "1h": "overheated" },
  },
  {
    symbol: "LINKUSDT",
    groups: { "1h": "neutral", "4h": "watch", "1d": "neutral", "1w": "neutral" },
    ranks: { "1h": 42.3, "4h": 62.7, "1d": 39.9, "1w": 47.6 },
  },
  {
    symbol: "XRPUSDT",
    groups: { "1h": "risk", "4h": "watch", "1d": "risk", "1w": "neutral" },
    ranks: { "1h": 22.6, "4h": 57.8, "1d": 18.2, "1w": 44.9 },
    risks: { "1h": ["distribution_risk"], "1d": ["failed_breakout_risk"] },
  },
  {
    symbol: "DOGEUSDT",
    groups: { "1h": "overheated", "4h": "overheated", "1d": "risk", "1w": "risk" },
    ranks: { "1h": 68.3, "4h": 59.2, "1d": 15.6, "1w": 11.4 },
    risks: {
      "1d": ["distribution_risk"],
      "1w": ["failed_breakout_risk"],
    },
  },
  {
    symbol: "ADAUSDT",
    groups: { "1h": "risk", "4h": "risk", "1d": "neutral", "1w": "neutral" },
    ranks: { "1h": 26.9, "4h": 24.1, "1d": 36.7, "1w": 41.2 },
    risks: { "4h": ["distribution_risk"] },
  },
  {
    symbol: "SUIUSDT",
    groups: { "1h": "watch", "4h": "eligible" },
    ranks: { "1h": 69.4, "4h": 80.2 },
  },
  {
    symbol: "1000PEPEUSDT",
    groups: { "1h": "risk", "4h": "overheated", "1d": "watch" },
    ranks: { "1h": 18.4, "4h": 52.6, "1d": 57.7 },
    risks: {
      "1h": ["liquidity_spike_risk", "failed_breakout_risk"],
      "4h": ["overheat_risk"],
    },
  },
  {
    symbol: "1000000MOGUSDT",
    groups: { "1h": "risk", "4h": "risk", "1d": "overheated", "1w": "watch" },
    ranks: { "1h": 12.1, "4h": 27.9, "1d": 49.6, "1w": 53.8 },
    signals: {
      "1h": "failed_breakout_risk",
      "4h": "distribution_risk",
      "1d": "overheated",
    },
    risks: {
      "1h": ["liquidity_spike_risk", "failed_breakout_risk"],
      "4h": ["distribution_risk"],
      "1d": ["overheat_risk"],
    },
  },
  {
    symbol: "AVAXUSDT",
    groups: { "1h": "neutral", "4h": "neutral", "1d": "watch", "1w": "risk" },
    ranks: { "1h": 45.2, "4h": 49.8, "1d": 58.9, "1w": 19.7 },
    risks: { "1w": ["failed_breakout_risk"] },
  },
];

export function buildMtfScreenerPreviewResponse(): MtfLatestScreenerResponse {
  const rows = previewSymbols.map((symbol) => ({
    symbol: symbol.symbol,
    exchange: "binance",
    market: "spot",
    assetClass: "crypto",
    timeframes: buildPreviewTimeframes(symbol),
  }));
  const signalCounts = buildTimeframeCounts((timeframe) =>
    rows.filter((row) => row.timeframes[timeframe]).length,
  );
  const missingCounts = buildTimeframeCounts(
    (timeframe) => rows.length - signalCounts[timeframe],
  );

  return {
    ok: true,
    assetClass: "crypto",
    timeframes: MTF_SCREENER_TIMEFRAMES,
    runs: buildTimeframeRuns(signalCounts),
    signalCounts,
    missingCounts,
    count: rows.length,
    rows,
  };
}

function buildPreviewTimeframes(
  symbol: PreviewSymbol,
): Record<MtfScreenerTimeframe, MtfLatestScanItem | null> {
  const timeframes = {} as Record<MtfScreenerTimeframe, MtfLatestScanItem | null>;

  for (const timeframe of MTF_SCREENER_TIMEFRAMES) {
    const group = symbol.groups[timeframe];

    timeframes[timeframe] = group
      ? buildPreviewItem({
          symbol: symbol.symbol,
          timeframe,
          group,
          rankScore: symbol.ranks[timeframe] ?? null,
          signalLabel: symbol.signals?.[timeframe] ?? getPreviewSignalLabel(group),
          detectedRiskTypes: symbol.risks?.[timeframe] ?? [],
        })
      : null;
  }

  return timeframes;
}

function buildPreviewItem({
  symbol,
  timeframe,
  group,
  rankScore,
  signalLabel,
  detectedRiskTypes,
}: {
  symbol: string;
  timeframe: MtfScreenerTimeframe;
  group: PreviewGroup;
  rankScore: number | null;
  signalLabel: string;
  detectedRiskTypes: string[];
}): MtfLatestScanItem {
  return {
    id: `preview-${timeframe}-${symbol}`,
    scanRunId: `preview-run-${timeframe}`,
    exchange: "binance",
    market: "spot",
    assetClass: "crypto",
    symbol,
    timeframe,
    group,
    resultGroup: group,
    rankScore,
    signalLabel,
    action: getPreviewAction(group),
    actionBias: group === "risk" ? "avoid" : "research",
    reviewTier: group === "eligible" ? "core" : "standard",
    statusNote: getPreviewStatusNote(group),
    statusReasons: detectedRiskTypes.length > 0 ? detectedRiskTypes : [group],
    scanTime: previewFinishedAt,
    detectedRiskTypes,
  };
}

function buildTimeframeCounts(
  getCount: (timeframe: MtfScreenerTimeframe) => number,
) {
  return Object.fromEntries(
    MTF_SCREENER_TIMEFRAMES.map((timeframe) => [timeframe, getCount(timeframe)]),
  ) as Record<MtfScreenerTimeframe, number>;
}

function buildTimeframeRuns(
  signalCounts: Record<MtfScreenerTimeframe, number>,
): Record<MtfScreenerTimeframe, MtfLatestScanRun> {
  return Object.fromEntries(
    MTF_SCREENER_TIMEFRAMES.map((timeframe) => [
      timeframe,
      {
        id: `preview-run-${timeframe}`,
        timeframe,
        status: "completed",
        symbolsTotal: previewSymbols.length,
        symbolsScanned: previewSymbols.length,
        signalsCreated: signalCounts[timeframe],
        symbolsSkipped: previewSymbols.length - signalCounts[timeframe],
        startedAt: "2026-06-03T15:45:00.000Z",
        finishedAt: previewFinishedAt,
        isLikelyFullUniverse: true,
      },
    ]),
  ) as Record<MtfScreenerTimeframe, MtfLatestScanRun>;
}

function getPreviewSignalLabel(group: PreviewGroup) {
  switch (group) {
    case "eligible":
      return "confirmed";
    case "watch":
      return "watch";
    case "overheated":
      return "overheated";
    case "risk":
      return "distribution_risk";
    case "neutral":
      return "neutral";
  }
}

function getPreviewAction(group: PreviewGroup) {
  switch (group) {
    case "eligible":
      return "eligible";
    case "watch":
      return "watch_only";
    case "overheated":
      return "do_not_chase";
    case "risk":
      return "avoid";
    case "neutral":
      return "ignore";
  }
}

function getPreviewStatusNote(group: PreviewGroup) {
  switch (group) {
    case "eligible":
      return "Constructive scanner read";
    case "watch":
      return "Needs confirmation";
    case "overheated":
      return "Extended setup";
    case "risk":
      return "Risk-first review";
    case "neutral":
      return "Baseline context";
  }
}
