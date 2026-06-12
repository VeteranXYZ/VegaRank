import { describe, expect, it } from "vitest";
import {
  actionCodeByBias,
  groupCodeByResultGroup,
  riskCodeByType,
  scannerCodeVersions,
  signalCodeByLabel,
  setupCodeByAliasOrStructure,
} from "@/lib/vegarank-codebook/codeRegistry";
import {
  DEFAULT_WATCHLIST_SYMBOLS,
  LEGACY_WATCHLIST_STORAGE_KEY,
  WATCHLIST_STORAGE_KEY,
  addWatchlistSymbol,
  addWatchlistSymbolToStorage,
  applyWatchlistPreset,
  buildWatchlistExportText,
  buildWatchlistResearchSummary,
  buildWatchlistResearchHref,
  buildWatchlistRows,
  defaultWatchlistFilters,
  filterWatchlistRows,
  getWatchlistResearchTimeframe,
  getWatchlistSummary,
  importWatchlistSymbols,
  isSymbolInWatchlist,
  loadWatchlistSymbols,
  parseWatchlistSymbols,
  removeWatchlistSymbol,
  saveWatchlistSymbols,
  sortWatchlistRows,
  watchlistPresets,
  type WatchlistStorage,
} from "./watchlistUi";
import {
  buildMtfScreenerRows,
  type MtfLatestRankingsResponse,
} from "@/components/screener/multiTimeframeScreenerUi";

describe("watchlist symbol parsing", () => {
  it("accepts comma, space, and newline separated symbols", () => {
    expect(parseWatchlistSymbols("BTC, ETH\nSOL  BNB")).toEqual([
      "BTCUSDT",
      "ETHUSDT",
      "SOLUSDT",
      "BNBUSDT",
    ]);
  });

  it("uppercases symbols, appends USDT, and removes duplicates", () => {
    expect(parseWatchlistSymbols("btc BTCUSDT eth, sei/usdt sol-usdt")).toEqual([
      "BTCUSDT",
      "ETHUSDT",
      "SEIUSDT",
      "SOLUSDT",
    ]);
  });
});

describe("watchlist localStorage helpers", () => {
  it("loads defaults when localStorage has no saved watchlist", () => {
    expect(loadWatchlistSymbols(makeStorage(null))).toEqual([
      ...DEFAULT_WATCHLIST_SYMBOLS,
    ]);
  });

  it("saves and loads a normalized watchlist", () => {
    const storage = makeStorage(null);

    saveWatchlistSymbols(storage, ["btc", "ETHUSDT", "btc"]);

    expect(storage.getItem(WATCHLIST_STORAGE_KEY)).toBe(
      JSON.stringify(["BTCUSDT", "ETHUSDT"]),
    );
    expect(loadWatchlistSymbols(storage)).toEqual(["BTCUSDT", "ETHUSDT"]);
  });

  it("migrates the legacy Trade Scanner watchlist key", () => {
    const storage = makeStorage(null);

    storage.setItem(
      LEGACY_WATCHLIST_STORAGE_KEY,
      JSON.stringify(["SOLUSDT", "ETHUSDT"]),
    );

    expect(loadWatchlistSymbols(storage)).toEqual(["SOLUSDT", "ETHUSDT"]);
    expect(storage.getItem(WATCHLIST_STORAGE_KEY)).toBe(
      JSON.stringify(["SOLUSDT", "ETHUSDT"]),
    );
  });

  it("preserves an intentionally cleared watchlist", () => {
    expect(loadWatchlistSymbols(makeStorage("[]"))).toEqual([]);
  });

  it("adds symbols to storage without duplicates and handles unavailable storage", () => {
    const storage = makeStorage(JSON.stringify(["BTCUSDT"]));

    expect(addWatchlistSymbolToStorage({ storage, symbol: "eth" })).toEqual({
      symbol: "ETHUSDT",
      symbols: ["BTCUSDT", "ETHUSDT"],
      added: true,
    });
    expect(addWatchlistSymbolToStorage({ storage, symbol: "ETHUSDT" })).toEqual({
      symbol: "ETHUSDT",
      symbols: ["BTCUSDT", "ETHUSDT"],
      added: false,
    });

    const unavailable = makeThrowingStorage();

    expect(() =>
      addWatchlistSymbolToStorage({ storage: unavailable, symbol: "sei" }),
    ).not.toThrow();
  });
});

describe("watchlist preset and import/export helpers", () => {
  it("applies built-in presets as normalized editable symbol lists", () => {
    expect(watchlistPresets.map((preset) => preset.label)).toEqual([
      "Majors",
      "AI",
      "DeFi",
      "Meme",
      "Layer 1 / Infra",
    ]);
    expect(applyWatchlistPreset("majors")).toEqual([
      "BTCUSDT",
      "ETHUSDT",
      "SOLUSDT",
      "BNBUSDT",
      "XRPUSDT",
      "LINKUSDT",
      "ADAUSDT",
      "DOGEUSDT",
    ]);
  });

  it("normalizes imported symbols and export text", () => {
    const imported = importWatchlistSymbols(" btc, eth\nSEI  btcusdt  ");

    expect(imported).toEqual(["BTCUSDT", "ETHUSDT", "SEIUSDT"]);
    expect(buildWatchlistExportText(imported)).toBe(
      "BTCUSDT, ETHUSDT, SEIUSDT",
    );
    expect(importWatchlistSymbols(" , \n ")).toEqual([]);
  });

  it("adds, removes, and checks watchlist symbols with normalization", () => {
    expect(addWatchlistSymbol(["BTCUSDT"], "eth")).toEqual([
      "BTCUSDT",
      "ETHUSDT",
    ]);
    expect(addWatchlistSymbol(["BTCUSDT"], "btc")).toEqual(["BTCUSDT"]);
    expect(removeWatchlistSymbol(["BTCUSDT", "ETHUSDT"], "btc")).toEqual([
      "ETHUSDT",
    ]);
    expect(isSymbolInWatchlist(["BTCUSDT"], "btc")).toBe(true);
    expect(isSymbolInWatchlist(["BTCUSDT"], "eth")).toBe(false);
  });
});

describe("watchlist row handling", () => {
  it("marks selected symbols missing when not found in mtf-latest rows", () => {
    const mtfRows = buildMtfScreenerRows({
      "1h": makeResponse("1h", [
        makeItem({ symbol: "BTCUSDT", timeframe: "1h", rankScore: 88 }),
      ]),
    });
    const rows = buildWatchlistRows(["BTC", "MISSING"], mtfRows);

    expect(rows.map((row) => [row.symbol, Boolean(row.mtfRow)])).toEqual([
      ["BTCUSDT", true],
      ["MISSINGUSDT", false],
    ]);
    expect(getWatchlistSummary(rows).missingSymbols).toBe(1);
  });

  it("preserves found symbols with missing timeframe snapshots", () => {
    const mtfRows = buildMtfScreenerRows({
      "1h": makeResponse("1h", [
        makeItem({ symbol: "BTCUSDT", timeframe: "1h", rankScore: 88 }),
      ]),
    });
    const [row] = buildWatchlistRows(["BTC"], mtfRows);

    expect(row.mtfRow?.snapshots["1h"]).toBeDefined();
    expect(row.mtfRow?.snapshots["4h"]).toBeUndefined();
  });

  it("selects the best available research timeframe", () => {
    const withFourHour = buildWatchlistRows(
      ["BTC"],
      buildMtfScreenerRows({
        "1h": makeResponse("1h", [
          makeItem({ symbol: "BTCUSDT", timeframe: "1h" }),
        ]),
        "4h": makeResponse("4h", [
          makeItem({ symbol: "BTCUSDT", timeframe: "4h" }),
        ]),
      }),
    )[0];
    const onlyDaily = buildWatchlistRows(
      ["ETH"],
      buildMtfScreenerRows({
        "1d": makeResponse("1d", [
          makeItem({ symbol: "ETHUSDT", timeframe: "1d" }),
        ]),
      }),
    )[0];
    const missing = buildWatchlistRows(["SOL"], [])[0];

    expect(getWatchlistResearchTimeframe(withFourHour)).toBe("4h");
    expect(buildWatchlistResearchHref({ row: withFourHour })).toBe(
      "/symbol/binance/BTCUSDT?timeframe=4h&assetClass=crypto&from=watchlist",
    );
    expect(getWatchlistResearchTimeframe(onlyDaily)).toBe("1d");
    expect(getWatchlistResearchTimeframe(missing)).toBe("4h");
    expect(buildWatchlistResearchHref({ row: missing })).toBe(
      "/symbol/binance/SOLUSDT?timeframe=4h&assetClass=crypto&from=watchlist",
    );
  });

  it("filters by search, research group, risk context, and missing snapshots", () => {
    const rows = buildWatchlistRows(
      ["AAA", "BBB", "CCC", "DDD"],
      buildMtfScreenerRows({
        "1h": makeResponse("1h", [
          makeItem({
            symbol: "AAAUSDT",
            timeframe: "1h",
            resultGroup: "eligible",
            rankScore: 60,
          }),
          makeItem({ symbol: "BBBUSDT", timeframe: "1h", resultGroup: "watch" }),
          makeItem({ symbol: "CCCUSDT", timeframe: "1h", resultGroup: "risk" }),
        ]),
        "1d": makeResponse("1d", [
          makeItem({ symbol: "BBBUSDT", timeframe: "1d", resultGroup: "risk" }),
        ]),
      }),
    );

    expect(
      filterWatchlistRows(rows, {
        ...defaultWatchlistFilters,
        symbolSearch: "aa",
      }).map((row) => row.symbol),
    ).toEqual(["AAAUSDT"]);
    expect(
      filterWatchlistRows(rows, {
        ...defaultWatchlistFilters,
        researchGroup: "missing",
      }).map((row) => row.symbol),
    ).toEqual(["DDDUSDT"]);
    expect(
      filterWatchlistRows(rows, {
        ...defaultWatchlistFilters,
        researchGroup: "eligible",
      }).map((row) => row.symbol),
    ).toEqual(["AAAUSDT"]);
    expect(
      filterWatchlistRows(rows, {
        ...defaultWatchlistFilters,
        riskContext: "withRisk",
      }).map((row) => row.symbol),
    ).toEqual(["BBBUSDT", "CCCUSDT"]);
    expect(
      filterWatchlistRows(rows, {
        ...defaultWatchlistFilters,
        riskContext: "withoutRisk",
      }).map((row) => row.symbol),
    ).toEqual(["AAAUSDT"]);
  });

  it("sorts by symbol, latest rank score, research group, and updated time", () => {
    const rows = buildWatchlistRows(
      ["CCC", "AAA", "BBB", "DDD"],
      buildMtfScreenerRows({
        "1h": makeResponse("1h", [
          makeItem({ symbol: "AAAUSDT", timeframe: "1h", rankScore: 20 }),
          makeItem({
            symbol: "BBBUSDT",
            timeframe: "1h",
            resultGroup: "watch",
            rankScore: 90,
          }),
        ]),
        "4h": makeResponse("4h", [
          makeItem({
            symbol: "CCCUSDT",
            timeframe: "4h",
            resultGroup: "eligible",
            rankScore: 70,
          }),
        ]),
        "1d": makeResponse("1d", [
          makeItem({ symbol: "AAAUSDT", timeframe: "1d", resultGroup: "risk" }),
          makeItem({ symbol: "BBBUSDT", timeframe: "1d", resultGroup: "watch" }),
          makeItem({ symbol: "CCCUSDT", timeframe: "1d", resultGroup: "watch" }),
        ]),
        "1w": makeResponse("1w", [
          makeItem({ symbol: "BBBUSDT", timeframe: "1w", resultGroup: "watch" }),
          makeItem({ symbol: "CCCUSDT", timeframe: "1w", resultGroup: "watch" }),
        ]),
      }),
    );

    expect(
      sortWatchlistRows(rows, { field: "symbol", direction: "asc" }).map(
        (row) => row.symbol,
      ),
    ).toEqual(["AAAUSDT", "BBBUSDT", "CCCUSDT", "DDDUSDT"]);
    expect(
      sortWatchlistRows(rows, { field: "rank_score", direction: "desc" }).map(
        (row) => row.symbol,
      ),
    ).toEqual(["BBBUSDT", "CCCUSDT", "AAAUSDT", "DDDUSDT"]);
    expect(
      sortWatchlistRows(rows, {
        field: "research_group",
        direction: "desc",
      }).map((row) => row.symbol),
    ).toEqual(["CCCUSDT", "BBBUSDT", "AAAUSDT", "DDDUSDT"]);
    expect(
      sortWatchlistRows(rows, {
        field: "updated",
        direction: "desc",
      }).map((row) => row.symbol),
    ).toEqual(["CCCUSDT", "AAAUSDT", "BBBUSDT", "DDDUSDT"]);
  });
});

describe("watchlist research summary", () => {
  it("summarizes a broad risk watchlist", () => {
    const rows = buildWatchlistRows(
      ["AAA", "BBB", "CCC"],
      buildMtfScreenerRows({
        "4h": makeResponse("4h", [
          makeItem({ symbol: "AAAUSDT", timeframe: "4h", resultGroup: "risk" }),
          makeItem({ symbol: "BBBUSDT", timeframe: "4h", resultGroup: "risk" }),
          makeItem({ symbol: "CCCUSDT", timeframe: "4h", resultGroup: "watch" }),
        ]),
        "1d": makeResponse("1d", [
          makeItem({ symbol: "AAAUSDT", timeframe: "1d", resultGroup: "risk" }),
          makeItem({ symbol: "BBBUSDT", timeframe: "1d", resultGroup: "watch" }),
          makeItem({ symbol: "CCCUSDT", timeframe: "1d", resultGroup: "neutral" }),
        ]),
        "1w": makeResponse("1w", [
          makeItem({ symbol: "AAAUSDT", timeframe: "1w", resultGroup: "watch" }),
          makeItem({ symbol: "BBBUSDT", timeframe: "1w", resultGroup: "risk" }),
          makeItem({ symbol: "CCCUSDT", timeframe: "1w", resultGroup: "neutral" }),
        ]),
      }),
    );
    const summary = buildWatchlistResearchSummary(rows);

    expect(summary.conditionLabel).toBe("Broad risk");
    expect(summary.researchPosture).toBe("Defensive review");
    expect(summary.counts.broadRiskSymbols).toBe(2);
    expect(summary.highestRiskSymbols.map((item) => item.symbol)).toContain(
      "AAAUSDT",
    );
  });

  it("summarizes short-term repair inside higher-timeframe risk", () => {
    const rows = buildWatchlistRows(
      ["REPAIR"],
      buildMtfScreenerRows({
        "1h": makeResponse("1h", [
          makeItem({
            symbol: "REPAIRUSDT",
            timeframe: "1h",
            resultGroup: "eligible",
            rankScore: 84,
          }),
        ]),
        "1d": makeResponse("1d", [
          makeItem({
            symbol: "REPAIRUSDT",
            timeframe: "1d",
            resultGroup: "risk",
          }),
        ]),
        "1w": makeResponse("1w", [
          makeItem({
            symbol: "REPAIRUSDT",
            timeframe: "1w",
            resultGroup: "neutral",
          }),
        ]),
      }),
    );
    const summary = buildWatchlistResearchSummary(rows);

    expect(summary.conditionLabel).toBe(
      "Short-term repair inside higher-timeframe risk",
    );
    expect(summary.researchPosture).toBe("Repair review only");
    expect(summary.counts.repairInsideRiskSymbols).toBe(1);
    expect(summary.bestResearchCandidates[0]).toMatchObject({
      symbol: "REPAIRUSDT",
      timeframe: "1h",
    });
    expect(summary.bestResearchCandidates[0]?.reason).toContain(
      "1d risk remains",
    );
  });

  it("detects cleaner research candidates without over-penalizing missing 1w data", () => {
    const rows = buildWatchlistRows(
      ["CLEAN"],
      buildMtfScreenerRows({
        "4h": makeResponse("4h", [
          makeItem({
            symbol: "CLEANUSDT",
            timeframe: "4h",
            resultGroup: "watch",
            rankScore: 72,
          }),
        ]),
        "1d": makeResponse("1d", [
          makeItem({
            symbol: "CLEANUSDT",
            timeframe: "1d",
            resultGroup: "neutral",
          }),
        ]),
      }),
    );
    const summary = buildWatchlistResearchSummary(rows);

    expect(summary.conditionLabel).toBe("Higher-timeframe improving");
    expect(summary.researchPosture).toBe("Selective watchlist review");
    expect(summary.bestResearchCandidates[0]).toMatchObject({
      symbol: "CLEANUSDT",
      timeframe: "4h",
    });
    expect(summary.bestResearchCandidates[0]?.reason).toContain(
      "1w missing snapshot",
    );
  });

  it("lists missing 1d and 1w data separately from not-found symbols", () => {
    const rows = buildWatchlistRows(
      ["PARTIAL", "MISSING"],
      buildMtfScreenerRows({
        "1h": makeResponse("1h", [
          makeItem({ symbol: "PARTIALUSDT", timeframe: "1h" }),
        ]),
      }),
    );
    const summary = buildWatchlistResearchSummary(rows);

    expect(summary.counts.missingImportantDataSymbols).toBe(2);
    expect(summary.missingDataSymbols).toEqual([
      {
        symbol: "PARTIALUSDT",
        timeframe: "1h",
        reason: "Missing 1d and 1w data.",
        rankScore: null,
      },
      {
        symbol: "MISSINGUSDT",
        timeframe: "4h",
        reason: "No latest research snapshot available.",
        rankScore: null,
      },
    ]);
  });

  it("handles an empty watchlist as insufficient data", () => {
    const summary = buildWatchlistResearchSummary([]);

    expect(summary.conditionLabel).toBe("Insufficient data");
    expect(summary.researchPosture).toBe("Data incomplete");
    expect(summary.counts.totalSelectedSymbols).toBe(0);
    expect(summary.bestResearchCandidates).toEqual([]);
    expect(summary.highestRiskSymbols).toEqual([]);
    expect(summary.missingDataSymbols).toEqual([]);
  });
});

function makeStorage(initialValue: string | null): WatchlistStorage {
  const values = new Map<string, string>();

  if (initialValue !== null) {
    values.set(WATCHLIST_STORAGE_KEY, initialValue);
  }

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, nextValue: string) => {
      values.set(key, nextValue);
    },
  };
}

function makeThrowingStorage(): WatchlistStorage {
  return {
    getItem: () => {
      throw new Error("Storage unavailable");
    },
    setItem: () => {
      throw new Error("Storage unavailable");
    },
  };
}

function makeResponse(
  timeframe: "1h" | "4h" | "1d" | "1w",
  items: MtfLatestRankingsResponse["items"],
): MtfLatestRankingsResponse {
  return {
    ok: true,
    timeframe,
    assetClass: "crypto",
    run: null,
    summary: null,
    count: items.length,
    items,
  };
}

function makeItem(
  overrides: Partial<MtfLatestRankingsResponse["items"][number]> & {
    symbol: string;
    timeframe: "1h" | "4h" | "1d" | "1w";
    group?: "eligible" | "watch" | "risk" | "overheated" | "neutral" | null;
    resultGroup?: "eligible" | "watch" | "risk" | "overheated" | "neutral" | null;
    rankScore?: number | null;
    signalLabel?: keyof typeof signalCodeByLabel;
    actionBias?: keyof typeof actionCodeByBias;
    primaryStructure?: keyof typeof setupCodeByAliasOrStructure;
    detectedRiskTypes?: Array<keyof typeof riskCodeByType>;
  },
): MtfLatestRankingsResponse["items"][number] {
  const resultGroup = overrides.resultGroup ?? overrides.group ?? "neutral";
  const riskCodes = (overrides.detectedRiskTypes ?? []).map(
    (risk) => riskCodeByType[risk] ?? "RK_201",
  );
  const rankScore = overrides.metrics?.rankScore ?? overrides.rankScore ?? 0;

  return {
    id: `${overrides.timeframe}-${overrides.symbol}`,
    scanRunId: `run-${overrides.timeframe}`,
    symbol: overrides.symbol,
    exchange: "binance",
    market: "spot",
    assetClass: "crypto",
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
