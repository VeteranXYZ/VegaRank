import { describe, expect, it } from "vitest";
import {
  actionCodeByBias,
  groupCodeByResultGroup,
  riskCodeByType,
  scannerCodeVersions,
  signalCodeByLabel,
  setupCodeByAliasOrStructure,
} from "@/lib/scanner-codebook/codeRegistry";
import {
  buildMtfScreenerRows,
  buildMtfScreenerRowsFromResponse,
  buildMtfSymbolResearchHref,
  countMtfResearchBuckets,
  defaultMtfScreenerFilters,
  doesMtfRowMatchPreset,
  doesMtfRowMatchResearchBucket,
  filterMtfScreenerRowsBySearch,
  filterMtfScreenerRows,
  formatMtfScreenerRowsCsv,
  formatMtfCombinedRank,
  formatMtfGroup,
  formatMtfRank,
  getMtfScreenerExportFilename,
  getMtfScreenerExportRows,
  getMtfCombinedRank,
  getMtfHigherTimeframeHealth,
  getMtfPrimarySignal,
  getMtfPresetDescription,
  getMtfRiskNotes,
  getMtfRiskNotesSummary,
  getMtfSymbolResearchTimeframe,
  mtfResearchBuckets,
  mtfScreenerPresetIds,
  sortMtfScreenerRows,
  type MtfLatestScanItem,
  type MtfLatestScanResponse,
  type MtfScreenerRow,
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

  it("filters by symbol search case-insensitively", () => {
    const rows = buildMtfScreenerRows({
      "1h": makeResponse("1h", [
        makeItem({ symbol: "BTCUSDT", timeframe: "1h", rankScore: 88 }),
        makeItem({ symbol: "ETHUSDT", timeframe: "1h", rankScore: 78 }),
        makeItem({ symbol: "SEIUSDT", timeframe: "1h", rankScore: 68 }),
      ]),
    });

    expect(filterMtfScreenerRowsBySearch(rows, "btc").map((row) => row.symbol)).toEqual([
      "BTCUSDT",
    ]);
    expect(filterMtfScreenerRowsBySearch(rows, "USDT")).toHaveLength(3);
    expect(filterMtfScreenerRowsBySearch(rows, "   ")).toHaveLength(3);
  });

  it("calculates display-only screener rank from available weighted ranks", () => {
    const [row] = buildMtfScreenerRows({
      "1h": makeResponse("1h", [
        makeItem({ symbol: "BTCUSDT", timeframe: "1h", rankScore: 90 }),
      ]),
      "4h": makeResponse("4h", [
        makeItem({ symbol: "BTCUSDT", timeframe: "4h", rankScore: 60 }),
      ]),
      "1w": makeResponse("1w", [
        makeItem({ symbol: "BTCUSDT", timeframe: "1w", rankScore: 30 }),
      ]),
    });

    expect(getMtfCombinedRank(row)).toBe(60);
    expect(formatMtfCombinedRank(row)).toBe("60.0");
  });

  it("leaves combined rank empty when all timeframe ranks are missing", () => {
    const [row] = buildMtfScreenerRows({
      "1h": makeResponse("1h", [
        makeItem({ symbol: "BTCUSDT", timeframe: "1h", rankScore: null }),
      ]),
    });

    expect(getMtfCombinedRank(row)).toBeNull();
    expect(formatMtfCombinedRank(row)).toBe("-");
  });

  it("sorts by rank fields while keeping missing ranks last", () => {
    const rows = buildMtfScreenerRows({
      "1h": makeResponse("1h", [
        makeItem({ symbol: "AAAUSDT", timeframe: "1h", rankScore: 10 }),
        makeItem({ symbol: "CCCUSDT", timeframe: "1h", rankScore: 30 }),
      ]),
      "4h": makeResponse("4h", [
        makeItem({ symbol: "BBBUSDT", timeframe: "4h", rankScore: 99 }),
      ]),
    });

    expect(
      sortMtfScreenerRows(rows, { field: "1h_rank", direction: "desc" }).map(
        (row) => row.symbol,
      ),
    ).toEqual(["CCCUSDT", "AAAUSDT", "BBBUSDT"]);
    expect(
      sortMtfScreenerRows(rows, { field: "1h_rank", direction: "asc" }).map(
        (row) => row.symbol,
      ),
    ).toEqual(["AAAUSDT", "CCCUSDT", "BBBUSDT"]);
  });

  it("sorts by combined rank and higher-timeframe safety", () => {
    const rows = buildMtfScreenerRows({
      "1h": makeResponse("1h", [
        makeItem({ symbol: "SAFEUSDT", timeframe: "1h", rankScore: 60 }),
        makeItem({ symbol: "RISKUSDT", timeframe: "1h", rankScore: 90 }),
      ]),
      "1d": makeResponse("1d", [
        makeItem({ symbol: "SAFEUSDT", timeframe: "1d", resultGroup: "watch", rankScore: 70 }),
        makeItem({ symbol: "RISKUSDT", timeframe: "1d", resultGroup: "risk", rankScore: 20 }),
      ]),
      "1w": makeResponse("1w", [
        makeItem({ symbol: "SAFEUSDT", timeframe: "1w", resultGroup: "neutral", rankScore: 50 }),
        makeItem({ symbol: "RISKUSDT", timeframe: "1w", resultGroup: "risk", rankScore: 10 }),
      ]),
    });

    expect(
      sortMtfScreenerRows(rows, {
        field: "combined_rank",
        direction: "desc",
      }).map((row) => row.symbol),
    ).toEqual(["SAFEUSDT", "RISKUSDT"]);
    expect(
      sortMtfScreenerRows(rows, {
        field: "higher_timeframe_safety",
        direction: "desc",
      }).map((row) => row.symbol),
    ).toEqual(["SAFEUSDT", "RISKUSDT"]);
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

  it("defines research buckets for each existing preset", () => {
    expect(mtfResearchBuckets.map((bucket) => bucket.id)).toEqual([
      ...mtfScreenerPresetIds,
    ]);
    expect(mtfResearchBuckets.map((bucket) => bucket.label)).toEqual([
      "Short-term Observation",
      "MTF Strength",
      "Higher-TF Watchlist",
      "Overheated",
      "Breakdown Risk",
    ]);

    for (const bucket of mtfResearchBuckets) {
      expect(bucket.description.length).toBeGreaterThan(0);
      expect(bucket.implication.length).toBeGreaterThan(0);
    }
  });

  it("counts research buckets from the full joined row set", () => {
    const rows = makeResearchBucketRows();
    const counts = countMtfResearchBuckets(rows);

    expect(getBucketCount(counts, "short_term_repair")).toBe(1);
    expect(getBucketCount(counts, "mtf_strength")).toBe(1);
    expect(getBucketCount(counts, "higher_timeframe_safe_watchlist")).toBe(3);
    expect(getBucketCount(counts, "overheated_caution")).toBe(1);
    expect(getBucketCount(counts, "breakdown_risk")).toBe(1);
  });

  it("keeps research bucket matching aligned with preset behavior", () => {
    const rows = makeResearchBucketRows();
    const counts = countMtfResearchBuckets(rows);

    for (const bucket of mtfResearchBuckets) {
      expect(getBucketCount(counts, bucket.id)).toBe(
        filterMtfScreenerRows(rows, defaultMtfScreenerFilters, bucket.id).length,
      );

      for (const row of rows) {
        expect(doesMtfRowMatchResearchBucket(row, bucket.id)).toBe(
          doesMtfRowMatchPreset(row, bucket.id),
        );
      }
    }
  });

  it("returns zero research bucket counts for empty rows", () => {
    expect(countMtfResearchBuckets([]).map((bucket) => bucket.count)).toEqual([
      0, 0, 0, 0, 0,
    ]);
  });

  it("labels higher-timeframe health states", () => {
    expect(
      getMtfHigherTimeframeHealth(
        makeHealthRow({ oneDayGroup: "watch", oneWeekGroup: "neutral" }),
      ).label,
    ).toBe("Higher TF OK");
    expect(
      getMtfHigherTimeframeHealth(makeHealthRow({ oneDayGroup: "risk" })).label,
    ).toBe("1d Risk");
    expect(
      getMtfHigherTimeframeHealth(makeHealthRow({ oneWeekGroup: "risk" })).label,
    ).toBe("1w Risk");
    expect(
      getMtfHigherTimeframeHealth(
        makeHealthRow({ oneDayGroup: "risk", oneWeekGroup: "risk" }),
      ).label,
    ).toBe("Higher TF Risk");
    expect(getMtfHigherTimeframeHealth(makeHealthRow({ oneDayGroup: "watch" })).label).toBe(
      "Limited HTF Data",
    );
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
    expect(getMtfPrimarySignal(row)).toBe("1h False Breakout Risk / Risk");
    expect(getMtfRiskNotes(row)).toBe("1h: Poor Reward-Risk");
  });

  it("summarizes risk notes with accessible hidden details", () => {
    const [row] = buildMtfScreenerRows({
      "1h": makeResponse("1h", [
        makeItem({
          symbol: "BTCUSDT",
          timeframe: "1h",
          resultGroup: "risk",
          detectedRiskTypes: ["distribution_risk"],
        }),
      ]),
      "4h": makeResponse("4h", [
        makeItem({ symbol: "BTCUSDT", timeframe: "4h", resultGroup: "overheated" }),
      ]),
      "1d": makeResponse("1d", [
        makeItem({ symbol: "BTCUSDT", timeframe: "1d", resultGroup: "risk" }),
      ]),
      "1w": makeResponse("1w", [
        makeItem({
          symbol: "BTCUSDT",
          timeframe: "1w",
          resultGroup: "risk",
          detectedRiskTypes: ["failed_breakout_risk"],
        }),
      ]),
    });
    const summary = getMtfRiskNotesSummary(row, 2);

    expect(summary.visibleNotes).toHaveLength(2);
    expect(summary.visibleNotes[0]).toContain("1w:");
    expect(summary.visibleNotes[1]).toContain("1h:");
    expect(summary.hiddenCount).toBe(2);
    expect(summary.hiddenNotes).toEqual([
      "1d: Risk",
      "4h: Overheated",
    ]);

    const chineseSummary = getMtfRiskNotesSummary(row, 4, "zh");

    expect(chineseSummary.notes).toContain("1d: 风险");
    expect(chineseSummary.notes).toContain("4h: 过热");
  });

  it("returns active preset explanation text", () => {
    expect(getMtfPresetDescription("mtf_strength")).toBe(
      "Aligned constructive structure across timeframes.",
    );
    expect(getMtfPresetDescription("custom")).toBeNull();
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

  it("formats screener rows as research-only CSV with useful headers", () => {
    const rows = buildMtfScreenerRows({
      "1h": makeResponse("1h", [
        makeItem({
          symbol: "BTCUSDT",
          timeframe: "1h",
          resultGroup: "eligible",
          rankScore: 91.25,
          signalLabel: "confirmed",
        }),
      ]),
      "4h": makeResponse("4h", [
        makeItem({
          symbol: "BTCUSDT",
          timeframe: "4h",
          resultGroup: "risk",
          rankScore: 24,
          detectedRiskTypes: ["distribution_risk"],
        }),
      ]),
    });
    const csv = formatMtfScreenerRowsCsv({
      rows,
      exportType: "visible_rows",
      exportedAt: "2026-06-02T15:00:00.000Z",
      assetClass: "crypto",
      runs: {
        "1h": makeRun("1h", 1),
        "4h": makeRun("4h", 1),
      },
    });

    expect(csv.split("\n")[0]).toContain("export_type,exported_at,asset_class");
    expect(csv.split("\n")[0]).toContain(
      "1h_group_code,1h_action_code,1h_setup_code",
    );
    expect(csv.split("\n")[0]).toContain("4h_run_id,4h_scan_time");
    expect(csv).toContain("visible_rows,2026-06-02T15:00:00.000Z,crypto");
    expect(csv).toContain("BTCUSDT");
    expect(csv).toContain("PX_501");
    expect(csv).toContain("RK_302");
    expect(csv).toContain("/symbol/binance/BTCUSDT?timeframe=4h&assetClass=crypto&from=screener");
    expect(csv).toContain("Research-only. Not financial advice.");
  });

  it("escapes CSV commas, quotes, and newlines", () => {
    const row: MtfScreenerRow = {
      symbol: 'QUOTE"USDT',
      exchange: "binance,spot",
      market: "spot\nmarket",
      snapshots: {
        "1h": {
          ...makeItem({
            symbol: 'QUOTE"USDT',
            timeframe: "1h",
            resultGroup: "risk",
            detectedRiskTypes: ["distribution_risk", "failed_breakout_risk"],
          }),
          timeframe: "1h",
          resultGroup: "risk",
        },
      },
    };
    const csv = formatMtfScreenerRowsCsv({
      rows: [row],
      exportType: "visible_rows",
      exportedAt: "2026-06-02T15:00:00.000Z",
    });

    expect(csv).toContain('"QUOTE""USDT"');
    expect(csv).toContain('"binance,spot"');
    expect(csv).toContain('"spot\nmarket"');
    expect(csv).toContain("RK_302|RK_305");
  });

  it("selects visible or all joined rows for export without changing row order", () => {
    const allRows = buildMtfScreenerRows({
      "4h": makeResponse("4h", [
        makeItem({ symbol: "AAAUSDT", timeframe: "4h", rankScore: 10 }),
        makeItem({ symbol: "BBBUSDT", timeframe: "4h", rankScore: 20 }),
      ]),
    });
    const visibleRows = sortMtfScreenerRows(allRows, {
      field: "4h_rank",
      direction: "desc",
    }).slice(0, 1);

    expect(
      getMtfScreenerExportRows({
        exportType: "visible_rows",
        visibleRows,
        allRows,
      }).map((row) => row.symbol),
    ).toEqual(["BBBUSDT"]);
    expect(
      getMtfScreenerExportRows({
        exportType: "all_joined_rows",
        visibleRows,
        allRows,
      }).map((row) => row.symbol),
    ).toEqual(["AAAUSDT", "BBBUSDT"]);
  });

  it("builds safe export filenames", () => {
    expect(
      getMtfScreenerExportFilename({
        exportType: "visible_rows",
        exportedAt: "2026-06-02T15:00:00.000Z",
      }),
    ).toBe("trade-scanner-visible-rows-2026-06-02.csv");
    expect(
      getMtfScreenerExportFilename({
        exportType: "all_joined_rows",
        exportedAt: "2026-06-02T15:00:00.000Z",
      }),
    ).toBe("trade-scanner-all-joined-rows-2026-06-02.csv");
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

function makeHealthRow({
  oneDayGroup,
  oneWeekGroup,
}: {
  oneDayGroup?: "eligible" | "watch" | "risk" | "overheated" | "neutral";
  oneWeekGroup?: "eligible" | "watch" | "risk" | "overheated" | "neutral";
}) {
  const [row] = buildMtfScreenerRows({
    ...(oneDayGroup
      ? {
          "1d": makeResponse("1d", [
            makeItem({
              symbol: "BTCUSDT",
              timeframe: "1d",
              resultGroup: oneDayGroup,
            }),
          ]),
        }
      : {}),
    ...(oneWeekGroup
      ? {
          "1w": makeResponse("1w", [
            makeItem({
              symbol: "BTCUSDT",
              timeframe: "1w",
              resultGroup: oneWeekGroup,
            }),
          ]),
        }
      : {}),
  });

  if (!row) {
    throw new Error("Expected health row");
  }

  return row;
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

function makeResearchBucketRows() {
  return buildMtfScreenerRows({
    "1h": makeResponse("1h", [
      makeItem({ symbol: "REPAIRUSDT", timeframe: "1h", resultGroup: "watch" }),
      makeItem({ symbol: "MTFUSDT", timeframe: "1h", resultGroup: "eligible" }),
      makeItem({ symbol: "HOTUSDT", timeframe: "1h", resultGroup: "overheated" }),
    ]),
    "4h": makeResponse("4h", [
      makeItem({ symbol: "REPAIRUSDT", timeframe: "4h", resultGroup: "watch" }),
      makeItem({ symbol: "MTFUSDT", timeframe: "4h", resultGroup: "eligible" }),
      makeItem({ symbol: "HTFUSDT", timeframe: "4h", resultGroup: "watch" }),
      makeItem({ symbol: "RISKUSDT", timeframe: "4h", resultGroup: "risk" }),
    ]),
    "1d": makeResponse("1d", [
      makeItem({ symbol: "REPAIRUSDT", timeframe: "1d", resultGroup: "neutral" }),
      makeItem({ symbol: "MTFUSDT", timeframe: "1d", resultGroup: "watch" }),
      makeItem({ symbol: "HTFUSDT", timeframe: "1d", resultGroup: "neutral" }),
    ]),
    "1w": makeResponse("1w", [
      makeItem({ symbol: "REPAIRUSDT", timeframe: "1w", resultGroup: "neutral" }),
      makeItem({ symbol: "MTFUSDT", timeframe: "1w", resultGroup: "neutral" }),
      makeItem({ symbol: "HTFUSDT", timeframe: "1w", resultGroup: "neutral" }),
    ]),
  });
}

function getBucketCount(
  counts: ReturnType<typeof countMtfResearchBuckets>,
  bucketId: (typeof mtfScreenerPresetIds)[number],
) {
  const bucket = counts.find((item) => item.id === bucketId);

  if (!bucket) {
    throw new Error(`Expected count for ${bucketId}`);
  }

  return bucket.count;
}

function makeItem(
  overrides: Partial<MtfLatestScanItem> & {
    symbol: string;
    timeframe: MtfScreenerTimeframe;
    group?: MtfLatestScanItem["groupCode"] | "eligible" | "watch" | "risk" | "overheated" | "neutral" | null;
    resultGroup?: "eligible" | "watch" | "risk" | "overheated" | "neutral" | null;
    rankScore?: number | null;
    signalLabel?: keyof typeof signalCodeByLabel;
    actionBias?: keyof typeof actionCodeByBias;
    primaryStructure?: keyof typeof setupCodeByAliasOrStructure;
    detectedRiskTypes?: Array<keyof typeof riskCodeByType>;
  },
): MtfLatestScanItem {
  const resultGroup = overrides.resultGroup ?? normalizeFixtureGroup(overrides.group) ?? "neutral";
  const riskCodes = (overrides.detectedRiskTypes ?? []).map(
    (risk) => riskCodeByType[risk] ?? "RK_201",
  );
  const rankScore =
    overrides.metrics?.rankScore ??
    (Object.prototype.hasOwnProperty.call(overrides, "rankScore")
      ? overrides.rankScore ?? null
      : 0);

  return {
    id: `${overrides.timeframe}-${overrides.symbol}`,
    scanRunId: `run-${overrides.timeframe}`,
    exchange: "binance",
    market: "spot",
    assetClass: "crypto",
    symbol: overrides.symbol,
    timeframe: overrides.timeframe,
    scanTime: "2026-06-03T12:00:00.000Z",
    candleOpenTime: "2026-06-03T08:00:00.000Z",
    groupCode: groupCodeByResultGroup[resultGroup],
    actionCode: actionCodeByBias[overrides.actionBias ?? "watch_only"],
    riskCode: riskCodes[0] ?? null,
    riskCodes,
    setupCode:
      setupCodeByAliasOrStructure[overrides.primaryStructure ?? "strong_trend"],
    phaseCode:
      setupCodeByAliasOrStructure[overrides.primaryStructure ?? "strong_trend"],
    reasonCodes: riskCodes,
    signalCodes: [signalCodeByLabel[overrides.signalLabel ?? "watch"]],
    qualityCodes: ["QH_001"],
    metrics: {
      score: rankScore,
      rankScore,
      riskAdjustedScore: rankScore,
      setupQualityScore: null,
      confidenceScore: null,
      absoluteSetupScore: null,
      universePercentile: null,
      finalSignalScore: rankScore,
      opportunityScore: null,
      confirmationScore: null,
      riskScore: null,
      qualityScore: null,
      trendScore: null,
      momentumScore: null,
      volumeScore: null,
      structureScore: null,
      volatilityScore: null,
      mtfAgreementScore: null,
      riskPenalty: null,
      qualityPenalty: null,
      volumeRank: null,
      historyBars: null,
      volatilityPercentile: null,
      atrExtension: null,
      distanceFromBase: null,
      scoringModelVersion: "quant-factor-v1",
      scoringCalibrationVersion: "deterministic-baseline-1",
      price: null,
      rsi14: null,
      bbPercent: null,
      bbWidthPercentile: null,
      volumeRatio: null,
    },
    ...scannerCodeVersions,
  };
}

function normalizeFixtureGroup(value: unknown) {
  return typeof value === "string" && value in groupCodeByResultGroup
    ? (value as keyof typeof groupCodeByResultGroup)
    : null;
}
