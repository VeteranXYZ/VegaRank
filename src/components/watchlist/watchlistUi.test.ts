import { describe, expect, it } from "vitest";
import {
  DEFAULT_WATCHLIST_SYMBOLS,
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
  type MtfLatestScanResponse,
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
    expect(getWatchlistResearchTimeframe(missing)).toBeNull();
    expect(buildWatchlistResearchHref({ row: missing })).toBeNull();
  });

  it("filters by search, missing rows, higher timeframe risk, and short-term watch", () => {
    const rows = buildWatchlistRows(
      ["AAA", "BBB", "CCC", "DDD"],
      buildMtfScreenerRows({
        "1h": makeResponse("1h", [
          makeItem({
            symbol: "AAAUSDT",
            timeframe: "1h",
            resultGroup: "eligible",
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
        hideMissing: true,
      }).map((row) => row.symbol),
    ).toEqual(["AAAUSDT", "BBBUSDT", "CCCUSDT"]);
    expect(
      filterWatchlistRows(rows, {
        ...defaultWatchlistFilters,
        exclude1dRisk: true,
      }).map((row) => row.symbol),
    ).toEqual(["AAAUSDT", "CCCUSDT", "DDDUSDT"]);
    expect(
      filterWatchlistRows(rows, {
        ...defaultWatchlistFilters,
        onlyShortTermWatch: true,
      }).map((row) => row.symbol),
    ).toEqual(["AAAUSDT", "BBBUSDT"]);
  });

  it("sorts by symbol, rank, higher-timeframe safety, and best short-term rank", () => {
    const rows = buildWatchlistRows(
      ["CCC", "AAA", "BBB", "DDD"],
      buildMtfScreenerRows({
        "1h": makeResponse("1h", [
          makeItem({ symbol: "AAAUSDT", timeframe: "1h", rankScore: 20 }),
          makeItem({ symbol: "BBBUSDT", timeframe: "1h", rankScore: 90 }),
        ]),
        "4h": makeResponse("4h", [
          makeItem({ symbol: "CCCUSDT", timeframe: "4h", rankScore: 70 }),
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
      sortWatchlistRows(rows, { field: "1h_rank", direction: "desc" }).map(
        (row) => row.symbol,
      ),
    ).toEqual(["BBBUSDT", "AAAUSDT", "CCCUSDT", "DDDUSDT"]);
    expect(
      sortWatchlistRows(rows, {
        field: "higher_timeframe_safety",
        direction: "desc",
      }).map((row) => row.symbol),
    ).toEqual(["CCCUSDT", "BBBUSDT", "AAAUSDT", "DDDUSDT"]);
    expect(
      sortWatchlistRows(rows, {
        field: "best_short_term_rank",
        direction: "desc",
      }).map((row) => row.symbol),
    ).toEqual(["BBBUSDT", "CCCUSDT", "AAAUSDT", "DDDUSDT"]);
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
    expect(summary.researchPosture).toBe("Repair candidates only");
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
      "1w not returned",
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
        timeframe: null,
        reason: "Not found in latest MTF response.",
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
  let value = initialValue;

  return {
    getItem: (key: string) => (key === WATCHLIST_STORAGE_KEY ? value : null),
    setItem: (key: string, nextValue: string) => {
      if (key === WATCHLIST_STORAGE_KEY) {
        value = nextValue;
      }
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
  items: MtfLatestScanResponse["items"],
): MtfLatestScanResponse {
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
  overrides: Partial<MtfLatestScanResponse["items"][number]> & {
    symbol: string;
    timeframe: "1h" | "4h" | "1d" | "1w";
  },
): MtfLatestScanResponse["items"][number] {
  return {
    id: `${overrides.timeframe}-${overrides.symbol}`,
    symbol: overrides.symbol,
    exchange: "binance",
    market: "spot",
    timeframe: overrides.timeframe,
    resultGroup: overrides.resultGroup ?? "neutral",
    rankScore: overrides.rankScore ?? 0,
    signalLabel: overrides.signalLabel ?? "watch",
    detectedRiskTypes: overrides.detectedRiskTypes ?? [],
  };
}
