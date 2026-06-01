import { describe, expect, it } from "vitest";
import {
  buildMtfScreenerRows,
  buildMtfScreenerRowsFromResponse,
  buildMtfSymbolResearchHref,
  defaultMtfScreenerFilters,
  doesMtfRowMatchPreset,
  filterMtfScreenerRows,
  formatMtfGroup,
  formatMtfRank,
  getMtfPrimarySignal,
  getMtfRiskNotes,
  getMtfSymbolResearchTimeframe,
  type MtfLatestScanItem,
  type MtfLatestScanResponse,
  type MtfScreenerTimeframe,
} from "./multiTimeframeScreenerUi";

describe("multi-timeframe screener helpers", () => {
  it("joins latest scan rows by symbol across timeframes", () => {
    const rows = buildMtfScreenerRows({
      "1h": makeResponse("1h", [
        makeItem({ symbol: "BTCUSDT", timeframe: "1h", resultGroup: "eligible", rankScore: 91 }),
        makeItem({ symbol: "SEIUSDT", timeframe: "1h", resultGroup: "watch", rankScore: 72 }),
      ]),
      "4h": makeResponse("4h", [
        makeItem({ symbol: "btcusdt", timeframe: "4h", resultGroup: "watch", rankScore: 64 }),
      ]),
      "1d": makeResponse("1d", [
        makeItem({ symbol: "BTCUSDT", timeframe: "1d", resultGroup: "neutral", rankScore: 20 }),
      ]),
    });

    const btc = rows.find((row) => row.symbol === "BTCUSDT");
    const sei = rows.find((row) => row.symbol === "SEIUSDT");

    expect(rows.map((row) => row.symbol)).toEqual(["BTCUSDT", "SEIUSDT"]);
    expect(btc?.snapshots["1h"]?.resultGroup).toBe("eligible");
    expect(btc?.snapshots["4h"]?.resultGroup).toBe("watch");
    expect(btc?.snapshots["1d"]?.resultGroup).toBe("neutral");
    expect(sei?.snapshots["4h"]).toBeUndefined();
  });

  it("joins the full multi-timeframe latest API response by symbol", () => {
    const rows = buildMtfScreenerRowsFromResponse({
      ok: true,
      assetClass: "crypto",
      timeframes: ["1h", "4h", "1d", "1w"],
      runs: {
        "1h": makeRun("1h", 2),
        "4h": makeRun("4h", 1),
        "1d": makeRun("1d", 1),
        "1w": null,
      },
      signalCounts: { "1h": 2, "4h": 1, "1d": 1, "1w": 0 },
      missingCounts: { "1h": 0, "4h": 1, "1d": 1, "1w": 2 },
      count: 2,
      rows: [
        {
          symbol: "btcusdt",
          exchange: "binance",
          market: "spot",
          assetClass: "crypto",
          timeframes: {
            "1h": makeItem({
              symbol: "BTCUSDT",
              timeframe: "1h",
              resultGroup: "eligible",
              rankScore: 92,
            }),
            "4h": makeItem({
              symbol: "BTCUSDT",
              timeframe: "4h",
              resultGroup: "watch",
              rankScore: 67,
            }),
            "1d": null,
            "1w": null,
          },
        },
        {
          symbol: "SEIUSDT",
          exchange: "binance",
          market: "spot",
          assetClass: "crypto",
          timeframes: {
            "1h": makeItem({
              symbol: "SEIUSDT",
              timeframe: "1h",
              resultGroup: "watch",
              rankScore: 72,
            }),
            "4h": null,
            "1d": makeItem({
              symbol: "SEIUSDT",
              timeframe: "1d",
              group: "risk",
              resultGroup: null,
              rankScore: 18,
            }),
            "1w": null,
          },
        },
      ],
    });

    const btc = rows.find((row) => row.symbol === "BTCUSDT");
    const sei = rows.find((row) => row.symbol === "SEIUSDT");

    expect(rows.map((row) => row.symbol)).toEqual(["BTCUSDT", "SEIUSDT"]);
    expect(btc?.snapshots["1h"]?.resultGroup).toBe("eligible");
    expect(btc?.snapshots["4h"]?.resultGroup).toBe("watch");
    expect(btc?.snapshots["1d"]).toBeUndefined();
    expect(sei?.snapshots["1d"]?.resultGroup).toBe("risk");
    expect(sei?.snapshots["1w"]).toBeUndefined();
  });

  it("filters by group, minimum rank, and higher-timeframe risk exclusions", () => {
    const rows = buildMtfScreenerRows({
      "1h": makeResponse("1h", [
        makeItem({ symbol: "AAAUSDT", timeframe: "1h", resultGroup: "eligible", rankScore: 88 }),
        makeItem({ symbol: "BBBUSDT", timeframe: "1h", resultGroup: "eligible", rankScore: 58 }),
        makeItem({ symbol: "CCCUSDT", timeframe: "1h", resultGroup: "risk", rankScore: 80 }),
      ]),
      "1d": makeResponse("1d", [
        makeItem({ symbol: "AAAUSDT", timeframe: "1d", resultGroup: "watch", rankScore: 45 }),
        makeItem({ symbol: "BBBUSDT", timeframe: "1d", resultGroup: "risk", rankScore: 12 }),
        makeItem({ symbol: "CCCUSDT", timeframe: "1d", resultGroup: "watch", rankScore: 42 }),
      ]),
    });
    const filters = {
      ...defaultMtfScreenerFilters,
      groups: { ...defaultMtfScreenerFilters.groups, "1h": "eligible" as const },
      minRank: { ...defaultMtfScreenerFilters.minRank, "1h": 70 },
      exclude1dRisk: true,
    };

    expect(filterMtfScreenerRows(rows, filters).map((row) => row.symbol)).toEqual([
      "AAAUSDT",
    ]);
  });

  it("matches preset logic for repair, strength, overheated, and breakdown views", () => {
    const rows = buildMtfScreenerRows({
      "1h": makeResponse("1h", [
        makeItem({ symbol: "REPAIRUSDT", timeframe: "1h", resultGroup: "eligible", rankScore: 85 }),
        makeItem({ symbol: "STRONGUSDT", timeframe: "1h", resultGroup: "eligible", rankScore: 95 }),
        makeItem({ symbol: "HOTUSDT", timeframe: "1h", resultGroup: "overheated", rankScore: 80 }),
        makeItem({ symbol: "RISKUSDT", timeframe: "1h", resultGroup: "risk", rankScore: 10 }),
      ]),
      "4h": makeResponse("4h", [
        makeItem({ symbol: "REPAIRUSDT", timeframe: "4h", resultGroup: "watch", rankScore: 44 }),
        makeItem({ symbol: "STRONGUSDT", timeframe: "4h", resultGroup: "watch", rankScore: 78 }),
        makeItem({ symbol: "HOTUSDT", timeframe: "4h", resultGroup: "neutral", rankScore: 30 }),
        makeItem({ symbol: "RISKUSDT", timeframe: "4h", resultGroup: "neutral", rankScore: 22 }),
      ]),
      "1d": makeResponse("1d", [
        makeItem({ symbol: "REPAIRUSDT", timeframe: "1d", resultGroup: "neutral", rankScore: 20 }),
        makeItem({ symbol: "STRONGUSDT", timeframe: "1d", resultGroup: "eligible", rankScore: 70 }),
      ]),
      "1w": makeResponse("1w", [
        makeItem({ symbol: "REPAIRUSDT", timeframe: "1w", resultGroup: "neutral", rankScore: 12 }),
        makeItem({ symbol: "STRONGUSDT", timeframe: "1w", resultGroup: "watch", rankScore: 55 }),
      ]),
    });

    expect(doesMtfRowMatchPreset(findRow(rows, "REPAIRUSDT"), "short_term_repair")).toBe(true);
    expect(doesMtfRowMatchPreset(findRow(rows, "STRONGUSDT"), "mtf_strength")).toBe(true);
    expect(doesMtfRowMatchPreset(findRow(rows, "HOTUSDT"), "overheated_caution")).toBe(true);
    expect(doesMtfRowMatchPreset(findRow(rows, "RISKUSDT"), "breakdown_risk")).toBe(true);
  });

  it("formats missing timeframe data safely", () => {
    const [row] = buildMtfScreenerRows({
      "1h": makeResponse("1h", [
        makeItem({
          symbol: "BTCUSDT",
          timeframe: "1h",
          resultGroup: "risk",
          rankScore: 12,
          signalLabel: "breakdown_risk",
          detectedRiskTypes: ["distribution_risk"],
        }),
      ]),
    });

    expect(formatMtfGroup(row.snapshots["4h"])).toBe("Not returned");
    expect(formatMtfRank(row.snapshots["4h"])).toBe("-");
    expect(getMtfPrimarySignal(row)).toBe("1h Breakdown Risk / Risk");
    expect(getMtfRiskNotes(row)).toBe("1h: Distribution Risk");
  });

  it("builds symbol research links with a 4h default when present", () => {
    const [row] = buildMtfScreenerRows({
      "1h": makeResponse("1h", [
        makeItem({ symbol: "SEIUSDT", timeframe: "1h", resultGroup: "eligible", rankScore: 91 }),
      ]),
      "4h": makeResponse("4h", [
        makeItem({ symbol: "SEIUSDT", timeframe: "4h", resultGroup: "watch", rankScore: 63 }),
      ]),
    });

    expect(getMtfSymbolResearchTimeframe(row)).toBe("4h");
    expect(buildMtfSymbolResearchHref({ row })).toBe(
      "/symbol/binance/SEIUSDT?timeframe=4h&assetClass=crypto&from=screener",
    );
  });
});

function makeResponse(
  timeframe: MtfScreenerTimeframe,
  items: MtfLatestScanItem[],
): MtfLatestScanResponse {
  return {
    ok: true,
    timeframe,
    assetClass: "crypto",
    run: {
      id: `run-${timeframe}`,
      timeframe,
      status: "success",
      symbolsTotal: 400,
      symbolsScanned: 400,
      signalsCreated: items.length,
      symbolsSkipped: 0,
      startedAt: "2026-06-01T00:00:00.000Z",
      finishedAt: "2026-06-01T00:05:00.000Z",
    },
    summary: { totalSignals: items.length, returnedItems: items.length },
    items,
    count: items.length,
  };
}

function makeRun(timeframe: MtfScreenerTimeframe, signalsCreated: number) {
  return {
    id: `run-${timeframe}`,
    timeframe,
    status: "success",
    symbolsTotal: 400,
    symbolsScanned: 400,
    signalsCreated,
    symbolsSkipped: 0,
    startedAt: "2026-06-01T00:00:00.000Z",
    finishedAt: "2026-06-01T00:05:00.000Z",
    isLikelyFullUniverse: true,
  };
}

function findRow(
  rows: ReturnType<typeof buildMtfScreenerRows>,
  symbol: string,
) {
  const row = rows.find((item) => item.symbol === symbol);

  if (!row) {
    throw new Error(`Expected row for ${symbol}`);
  }

  return row;
}

function makeItem(
  overrides: Partial<MtfLatestScanItem> & {
    symbol: string;
    timeframe: MtfScreenerTimeframe;
  },
): MtfLatestScanItem {
  return {
    id: `${overrides.timeframe}-${overrides.symbol}`,
    scanRunId: `run-${overrides.timeframe}`,
    exchange: "binance",
    market: "spot",
    symbol: overrides.symbol,
    timeframe: overrides.timeframe,
    group: overrides.group,
    resultGroup: overrides.resultGroup === undefined ? "neutral" : overrides.resultGroup,
    rankScore: overrides.rankScore ?? 0,
    signalLabel: overrides.signalLabel ?? "watch",
    actionBias: "watch_only",
    reviewTier: "watch_high",
    statusNote: null,
    statusReasons: [],
    primaryStructure: "strong_trend",
    detectedRiskTypes: overrides.detectedRiskTypes ?? [],
  };
}
