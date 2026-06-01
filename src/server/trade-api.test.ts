import type http from "node:http";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleTradeApiRequest } from "./trade-api";

const getLatestScanRunMock = vi.hoisted(() => vi.fn());
const listLatestScanSignalsForRunMock = vi.hoisted(() => vi.fn());
const closeMock = vi.hoisted(() => vi.fn());
const getSymbolResearchLatestSignalPgMock = vi.hoisted(() => vi.fn());
const getSymbolSignalHistoryPgMock = vi.hoisted(() => vi.fn());
const getSymbolLatestSignalsByTimeframesPgMock = vi.hoisted(() => vi.fn());
const getSymbolCandlesPgMock = vi.hoisted(() => vi.fn());
const getSymbolCandleCoveragePgMock = vi.hoisted(() => vi.fn());
const getSymbolBehaviorPgMock = vi.hoisted(() => vi.fn());
const closeSymbolResearchMock = vi.hoisted(() => vi.fn());
const pgScannerResultsStoreMock = vi.hoisted(() =>
  vi.fn(function PgScannerResultsStore() {
    return {
      getLatestScanRun: getLatestScanRunMock,
      listLatestScanSignalsForRun: listLatestScanSignalsForRunMock,
      close: closeMock,
    };
  }),
);
const pgSymbolResearchStoreMock = vi.hoisted(() =>
  vi.fn(function PgSymbolResearchStore() {
    return {
      getSymbolResearchLatestSignalPg: getSymbolResearchLatestSignalPgMock,
      getSymbolSignalHistoryPg: getSymbolSignalHistoryPgMock,
      getSymbolLatestSignalsByTimeframesPg: getSymbolLatestSignalsByTimeframesPgMock,
      getSymbolCandlesPg: getSymbolCandlesPgMock,
      getSymbolCandleCoveragePg: getSymbolCandleCoveragePgMock,
      getSymbolBehaviorPg: getSymbolBehaviorPgMock,
      close: closeSymbolResearchMock,
    };
  }),
);

vi.mock("@/lib/storage/postgres/scannerResultsPg", () => ({
  LATEST_SCAN_FULL_UNIVERSE_MIN_SYMBOLS: 300,
  PgScannerResultsStore: pgScannerResultsStoreMock,
  isLikelyFullUniverseRun: ({
    run,
    assetClass,
    minExpectedSymbols = 300,
  }: {
    run: {
      universe?: string;
      symbolsTotal: number;
      symbolsScanned: number;
      signalsCreated: number;
      symbolsSkipped?: number;
      params?: Record<string, unknown>;
    };
    assetClass: string;
    minExpectedSymbols?: number;
  }) =>
    assetClass !== "crypto" ||
    ((run.symbolsTotal >= minExpectedSymbols ||
      run.symbolsScanned >= minExpectedSymbols ||
      run.symbolsScanned + (run.symbolsSkipped ?? 0) >= minExpectedSymbols) &&
      (run.universe === "all-symbols" || run.params?.allSymbols === true)),
}));

vi.mock("@/lib/storage/postgres/symbolResearchPg", () => ({
  PgSymbolResearchStore: pgSymbolResearchStoreMock,
}));

describe("trade-api CORS", () => {
  beforeEach(() => {
    resetScannerMocks();
    resetSymbolResearchMocks();
  });

  it("allows the production scanner origin on latest-scan GET requests", async () => {
    const response = await requestTradeApi("/api/scan/latest?timeframe=4h", {
      headers: { Origin: "https://s.bitcoinmind.com" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://s.bitcoinmind.com",
    );
    expect(response.headers.get("access-control-allow-methods")).toBe(
      "GET, OPTIONS",
    );
    expect(response.headers.get("access-control-allow-headers")).toBe(
      "Content-Type",
    );
  });

  it("allows the local development origin on latest-scan GET requests", async () => {
    const response = await requestTradeApi("/api/scan/latest?timeframe=4h", {
      headers: { Origin: "http://localhost:3000" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:3000",
    );
  });

  it("does not set Access-Control-Allow-Origin for disallowed origins", async () => {
    const response = await requestTradeApi("/api/scan/latest?timeframe=4h", {
      headers: { Origin: "https://example.com" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("returns preflight responses without hitting Postgres", async () => {
    const response = await requestTradeApi("/api/scan/latest?timeframe=4h", {
      method: "OPTIONS",
      headers: {
        Origin: "https://s.bitcoinmind.com",
        "Access-Control-Request-Method": "GET",
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://s.bitcoinmind.com",
    );
    expect(response.headers.get("access-control-allow-methods")).toBe(
      "GET, OPTIONS",
    );
    expect(response.headers.get("access-control-allow-headers")).toBe(
      "Content-Type",
    );
    expect(pgScannerResultsStoreMock).not.toHaveBeenCalled();
  });

  it("returns symbol research preflight responses without hitting Postgres", async () => {
    const response = await requestTradeApi(
      "/api/symbol/research?exchange=binance&market=spot&symbol=SEIUSDT&timeframe=4h",
      {
        method: "OPTIONS",
        headers: {
          Origin: "https://s.bitcoinmind.com",
          "Access-Control-Request-Method": "GET",
        },
      },
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://s.bitcoinmind.com",
    );
    expect(pgSymbolResearchStoreMock).not.toHaveBeenCalled();
  });
});

describe("trade-api latest scan run selection", () => {
  beforeEach(() => {
    resetScannerMocks();
    resetSymbolResearchMocks();
  });

  it("requests full-universe selection for default crypto scanner latest scans", async () => {
    getLatestScanRunMock.mockResolvedValue(
      makeRun("full-run", {
        symbolsTotal: 413,
        symbolsScanned: 409,
        signalsCreated: 409,
        params: { assetClass: "crypto", allSymbols: true },
      }),
    );

    const response = await requestTradeApi(
      "/api/scan/latest?timeframe=4h&assetClass=crypto&limit=100",
    );
    const body = JSON.parse(response.body);

    expect(response.status).toBe(200);
    expect(body.run.id).toBe("full-run");
    expect(getLatestScanRunMock).toHaveBeenCalledWith({
      timeframe: "4h",
      assetClass: "crypto",
      preferFullUniverse: true,
      minExpectedSymbols: 300,
    });
    expect(body.summary.latestRunSelection).toEqual({
      preferredFullUniverse: true,
      isLikelyFullUniverse: true,
      minExpectedSymbols: 300,
      fallbackUsed: false,
    });
  });

  it("passes daily and weekly timeframes through latest scan metadata", async () => {
    getLatestScanRunMock.mockImplementation(({ timeframe }: { timeframe: string }) =>
      Promise.resolve(
        makeRun(`full-${timeframe}`, {
          timeframe,
          symbolsTotal: 413,
          symbolsScanned: timeframe === "1w" ? 221 : 409,
          signalsCreated: timeframe === "1w" ? 221 : 409,
          symbolsSkipped: timeframe === "1w" ? 192 : 4,
          params: { assetClass: "crypto", allSymbols: true },
        }),
      ),
    );

    const dailyResponse = await requestTradeApi(
      "/api/scan/latest?timeframe=1d&assetClass=crypto&limit=100",
    );
    const weeklyResponse = await requestTradeApi(
      "/api/scan/latest?timeframe=1w&assetClass=crypto&limit=100",
    );
    const dailyBody = JSON.parse(dailyResponse.body);
    const weeklyBody = JSON.parse(weeklyResponse.body);

    expect(dailyResponse.status).toBe(200);
    expect(dailyBody.timeframe).toBe("1d");
    expect(dailyBody.run).toMatchObject({ id: "full-1d", timeframe: "1d" });
    expect(dailyBody.summary.latestRunSelection).toMatchObject({
      preferredFullUniverse: true,
      isLikelyFullUniverse: true,
      fallbackUsed: false,
    });

    expect(weeklyResponse.status).toBe(200);
    expect(weeklyBody.timeframe).toBe("1w");
    expect(weeklyBody.run).toMatchObject({ id: "full-1w", timeframe: "1w" });
    expect(weeklyBody.summary.latestRunSelection).toMatchObject({
      preferredFullUniverse: true,
      isLikelyFullUniverse: true,
      fallbackUsed: false,
    });
    expect(getLatestScanRunMock).toHaveBeenNthCalledWith(1, {
      timeframe: "1d",
      assetClass: "crypto",
      preferFullUniverse: true,
      minExpectedSymbols: 300,
    });
    expect(getLatestScanRunMock).toHaveBeenNthCalledWith(2, {
      timeframe: "1w",
      assetClass: "crypto",
      preferFullUniverse: true,
      minExpectedSymbols: 300,
    });
  });

  it("marks fallback metadata when only a limited crypto run is returned", async () => {
    getLatestScanRunMock.mockResolvedValue(
      makeRun("limited-run", {
        symbolsTotal: 100,
        symbolsScanned: 96,
        signalsCreated: 96,
      }),
    );

    const response = await requestTradeApi(
      "/api/scan/latest?timeframe=4h&assetClass=crypto&limit=100",
    );
    const body = JSON.parse(response.body);

    expect(response.status).toBe(200);
    expect(body.run.id).toBe("limited-run");
    expect(body.summary.latestRunSelection).toEqual({
      preferredFullUniverse: true,
      isLikelyFullUniverse: false,
      minExpectedSymbols: 300,
      fallbackUsed: true,
    });
  });

  it("does not force crypto full-universe selection for non-crypto or includeNonScanner requests", async () => {
    getLatestScanRunMock.mockResolvedValue(
      makeRun("small-stable-run", {
        symbolsTotal: 4,
        symbolsScanned: 4,
        signalsCreated: 4,
      }),
    );

    const stableResponse = await requestTradeApi(
      "/api/scan/latest?timeframe=4h&assetClass=stable&limit=100",
    );
    const stableBody = JSON.parse(stableResponse.body);

    expect(stableResponse.status).toBe(200);
    expect(getLatestScanRunMock).toHaveBeenLastCalledWith({
      timeframe: "4h",
      assetClass: "stable",
      preferFullUniverse: false,
      minExpectedSymbols: 300,
    });
    expect(stableBody.summary.latestRunSelection).toMatchObject({
      preferredFullUniverse: false,
      isLikelyFullUniverse: true,
      fallbackUsed: false,
    });

    await requestTradeApi(
      "/api/scan/latest?timeframe=4h&assetClass=crypto&includeNonScanner=true&limit=100",
    );

    expect(getLatestScanRunMock).toHaveBeenLastCalledWith({
      timeframe: "4h",
      assetClass: "crypto",
      preferFullUniverse: false,
      minExpectedSymbols: 300,
    });
  });
});

describe("trade-api symbol research", () => {
  beforeEach(() => {
    resetScannerMocks();
    resetSymbolResearchMocks();
  });

  it("requires a symbol", async () => {
    const response = await requestTradeApi("/api/symbol/research?timeframe=4h");
    const body = JSON.parse(response.body);

    expect(response.status).toBe(400);
    expect(body.error).toBe("SYMBOL_REQUIRED");
    expect(pgSymbolResearchStoreMock).not.toHaveBeenCalled();
  });

  it("rejects invalid timeframes", async () => {
    const response = await requestTradeApi(
      "/api/symbol/research?symbol=SEIUSDT&timeframe=4h;drop",
    );
    const body = JSON.parse(response.body);

    expect(response.status).toBe(400);
    expect(body.error).toBe("INVALID_TIMEFRAME");
    expect(pgSymbolResearchStoreMock).not.toHaveBeenCalled();
  });

  it("returns a stable research response shape", async () => {
    getSymbolResearchLatestSignalPgMock.mockResolvedValue({
      symbol: makeResearchSymbol("SEIUSDT"),
      scanRun: makeRun("full-run", {
        symbolsTotal: 413,
        symbolsScanned: 409,
        signalsCreated: 409,
      }),
      signal: makeResearchSignal({ id: "signal-latest", symbol: "SEIUSDT" }),
    });
    getSymbolSignalHistoryPgMock.mockResolvedValue([
      makeResearchSignal({ id: "signal-history", symbol: "SEIUSDT" }),
    ]);
    getSymbolLatestSignalsByTimeframesPgMock.mockResolvedValue([
      makeResearchSignal({ id: "signal-4h", symbol: "SEIUSDT", timeframe: "4h" }),
      makeResearchSignal({ id: "signal-1d", symbol: "SEIUSDT", timeframe: "1d" }),
    ]);
    getSymbolCandlesPgMock.mockResolvedValue([
      makeResearchCandle({ openTime: 1000, close: 1.1 }),
      makeResearchCandle({ openTime: 2000, close: 1.2 }),
    ]);
    getSymbolBehaviorPgMock.mockResolvedValue(makeResearchBehavior());

    const response = await requestTradeApi(
      "/api/symbol/research?exchange=binance&market=spot&symbol=seiusdt&timeframe=4h",
    );
    const body = JSON.parse(response.body);

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.service).toBe("trade-api");
    expect(body.source).toBe("postgres");
    expect(body.timeframe).toBe("4h");
    expect(body.symbol.symbol).toBe("SEIUSDT");
    expect(body.latest.scanRun.id).toBe("full-run");
    expect(body.latest.signal.id).toBe("signal-latest");
    expect(body.latest.signal.resultGroup).toBe("eligible");
    expect(body.latest.signal.reviewTier).toBe("eligible");
    expect(body.latest.signal.isSelectedCurrentRun).toBe(true);
    expect(body.currentSelection).toMatchObject({
      selectedRunId: "full-run",
      selectedSignalId: "signal-latest",
      selectedTimeframe: "4h",
      selectedSignalScanTime: body.latest.signal.scanTime,
      preferredFullUniverse: true,
      isLikelyFullUniverse: true,
      fallbackUsed: false,
    });
    expect(body.currentSelection.selectedSignalId).toBe(body.latest.signal.id);
    expect(body.currentSelection.selectedTimeframe).toBe(body.latest.signal.timeframe);
    expect(body.currentSelection.selectedSignalScanTime).toBe(
      body.latest.signal.scanTime,
    );
    expect(body.scoreBreakdown).toMatchObject({
      rankScore: 82,
      finalSignalScore: 76,
      opportunityScore: 74,
    });
    expect(body.interpretation).toMatchObject({
      group: "eligible",
      action: "Manual review",
      setupType: "Strong Trend",
    });
    expect(body.history).toHaveLength(1);
    expect(body.timeframes).toHaveLength(2);
    expect(body.candles).toMatchObject({
      timeframe: "4h",
      count: 2,
      firstOpenTime: "1970-01-01T00:00:01.000Z",
      lastOpenTime: "1970-01-01T00:00:02.000Z",
    });
    expect(body.behavior).toMatchObject({
      timeframe: "4h",
      symbol: "SEIUSDT",
      sampleSize: 12,
      eligibleSampleSize: 11,
      currentContext: {
        currentSignalLabel: "confirmed",
        currentResultGroup: "eligible",
      },
    });
    expect(getSymbolResearchLatestSignalPgMock).toHaveBeenCalledWith({
      exchange: "binance",
      market: "spot",
      symbol: "SEIUSDT",
      timeframe: "4h",
      assetClass: "crypto",
      includeNonScanner: false,
      includeMarketContext: false,
    });
    expect(getSymbolBehaviorPgMock).toHaveBeenCalledWith({
      exchange: "binance",
      market: "spot",
      symbol: "SEIUSDT",
      timeframe: "4h",
      currentSignal: expect.objectContaining({ id: "signal-latest" }),
      assetClass: "crypto",
      includeNonScanner: false,
      includeMarketContext: false,
    });
  });

  it("keeps symbol research available when behavior calculation fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    getSymbolResearchLatestSignalPgMock.mockResolvedValue({
      symbol: makeResearchSymbol("SEIUSDT"),
      scanRun: makeRun("full-run", {
        symbolsTotal: 413,
        symbolsScanned: 409,
        signalsCreated: 409,
      }),
      signal: makeResearchSignal({ id: "signal-latest", symbol: "SEIUSDT" }),
    });
    getSymbolBehaviorPgMock.mockRejectedValue(
      Object.assign(new Error("behavior failed"), { code: "BEHAVIOR_FAILED" }),
    );

    try {
      const response = await requestTradeApi(
        "/api/symbol/research?exchange=binance&market=spot&symbol=seiusdt&timeframe=4h",
      );
      const body = JSON.parse(response.body);

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.latest.signal.id).toBe("signal-latest");
      expect(body.behavior).toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(
        "trade-api symbol behavior unavailable:",
        "BEHAVIOR_FAILED",
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("returns requested timeframe metadata for daily and weekly symbol research", async () => {
    getSymbolResearchLatestSignalPgMock.mockImplementation(
      ({ timeframe }: { timeframe: string }) =>
        Promise.resolve({
          symbol: makeResearchSymbol("SEIUSDT"),
          scanRun: makeRun(`full-${timeframe}`, {
            timeframe,
            symbolsTotal: 413,
            symbolsScanned: timeframe === "1w" ? 221 : 409,
            signalsCreated: timeframe === "1w" ? 221 : 409,
            symbolsSkipped: timeframe === "1w" ? 192 : 4,
            params: { assetClass: "crypto", allSymbols: true },
          }),
          signal: makeResearchSignal({
            id: `signal-${timeframe}`,
            scanRunId: `full-${timeframe}`,
            symbol: "SEIUSDT",
            timeframe,
            scanRunSymbolsTotal: 413,
            scanRunSymbolsScanned: timeframe === "1w" ? 221 : 409,
            scanRunSignalsCreated: timeframe === "1w" ? 221 : 409,
          }),
        }),
    );
    getSymbolCandlesPgMock.mockImplementation(({ timeframe }: { timeframe: string }) =>
      Promise.resolve([
        makeResearchCandle({ openTime: 1000, close: 1.1, timeframe }),
        makeResearchCandle({ openTime: 2000, close: 1.2, timeframe }),
      ]),
    );

    const dailyResponse = await requestTradeApi(
      "/api/symbol/research?exchange=binance&symbol=SEIUSDT&timeframe=1d",
    );
    const weeklyResponse = await requestTradeApi(
      "/api/symbol/research?exchange=binance&symbol=SEIUSDT&timeframe=1w",
    );
    const dailyBody = JSON.parse(dailyResponse.body);
    const weeklyBody = JSON.parse(weeklyResponse.body);

    expect(dailyResponse.status).toBe(200);
    expect(dailyBody.timeframe).toBe("1d");
    expect(dailyBody.latest.signal).toMatchObject({
      id: "signal-1d",
      timeframe: "1d",
      isSelectedCurrentRun: true,
      sourceRunIsLikelyFullUniverse: true,
    });
    expect(dailyBody.candles).toMatchObject({ timeframe: "1d", count: 2 });
    expect(dailyBody.candles.rows.every((row: { timeframe: string }) => row.timeframe === "1d")).toBe(
      true,
    );

    expect(weeklyResponse.status).toBe(200);
    expect(weeklyBody.timeframe).toBe("1w");
    expect(weeklyBody.latest.signal).toMatchObject({
      id: "signal-1w",
      timeframe: "1w",
      isSelectedCurrentRun: true,
      sourceRunIsLikelyFullUniverse: true,
    });
    expect(weeklyBody.candles).toMatchObject({ timeframe: "1w", count: 2 });
    expect(weeklyBody.candles.rows.every((row: { timeframe: string }) => row.timeframe === "1w")).toBe(
      true,
    );
  });

  it("keeps selected current classification when history includes newer non-preferred rows", async () => {
    getSymbolResearchLatestSignalPgMock.mockResolvedValue({
      symbol: makeResearchSymbol("SEIUSDT"),
      scanRun: makeRun("full-run", {
        symbolsTotal: 413,
        symbolsScanned: 409,
        signalsCreated: 409,
        params: { assetClass: "crypto", allSymbols: true },
      }),
      signal: makeResearchSignal({
        id: "selected-risk",
        scanRunId: "full-run",
        symbol: "SEIUSDT",
        scanTime: "2026-05-31T18:27:00.000Z",
        signalLabel: "breakdown_risk",
        actionBias: "avoid",
        primaryStructure: "trend_breakdown",
        rankScore: 20,
      }),
    });
    getSymbolSignalHistoryPgMock.mockResolvedValue([
      makeResearchSignal({
        id: "newer-limited",
        scanRunId: "limited-run",
        symbol: "SEIUSDT",
        scanTime: "2026-05-31T20:05:00.000Z",
        scanRunSymbolsTotal: 25,
        scanRunSymbolsScanned: 25,
        scanRunSignalsCreated: 25,
      }),
      makeResearchSignal({
        id: "selected-risk",
        scanRunId: "full-run",
        symbol: "SEIUSDT",
        scanTime: "2026-05-31T18:27:00.000Z",
        signalLabel: "breakdown_risk",
        actionBias: "avoid",
        primaryStructure: "trend_breakdown",
        rankScore: 20,
      }),
    ]);
    getSymbolLatestSignalsByTimeframesPgMock.mockResolvedValue([
      makeResearchSignal({
        id: "newer-limited",
        scanRunId: "limited-run",
        symbol: "SEIUSDT",
        scanTime: "2026-05-31T20:05:00.000Z",
        scanRunSymbolsTotal: 25,
        scanRunSymbolsScanned: 25,
        scanRunSignalsCreated: 25,
      }),
    ]);

    const response = await requestTradeApi(
      "/api/symbol/research?exchange=binance&market=spot&symbol=seiusdt&timeframe=4h",
    );
    const body = JSON.parse(response.body);

    expect(response.status).toBe(200);
    expect(body.timeframe).toBe("4h");
    expect(body.latest.signal.id).toBe("selected-risk");
    expect(body.latest.signal.resultGroup).toBe("risk");
    expect(body.history[0]).toMatchObject({
      id: "newer-limited",
      isSelectedCurrentRun: false,
      isNewerThanSelectedCurrentRun: true,
      sourceRunIsLikelyFullUniverse: false,
    });
    expect(body.history[1]).toMatchObject({
      id: "selected-risk",
      isSelectedCurrentRun: true,
      isNewerThanSelectedCurrentRun: false,
    });
    expect(body.timeframes[0]).toMatchObject({
      id: "newer-limited",
      isNewerThanSelectedCurrentRun: true,
      sourceRunIsLikelyFullUniverse: false,
    });
  });

  it("returns NO_LATEST_SIGNAL when the selected run has no signal for the symbol", async () => {
    getSymbolResearchLatestSignalPgMock.mockResolvedValue({
      symbol: makeResearchSymbol("SEIUSDT"),
      scanRun: makeRun("full-run"),
      signal: null,
    });
    getSymbolCandleCoveragePgMock.mockResolvedValue({
      timeframe: "4h",
      candleCount: 250,
      firstOpenTime: "2026-01-01T00:00:00.000Z",
      lastOpenTime: "2026-05-31T20:00:00.000Z",
    });

    const response = await requestTradeApi(
      "/api/symbol/research?symbol=SEIUSDT&timeframe=4h",
    );
    const body = JSON.parse(response.body);

    expect(response.status).toBe(404);
    expect(body.error).toBe("NO_LATEST_SIGNAL");
    expect(body.errorCode).toBe("NO_LATEST_SIGNAL");
    expect(body.unavailableReason).toBe("not_in_selected_run");
    expect(body.latest.signal).toBeNull();
    expect(body.symbolCoverage).toMatchObject({
      timeframe: "4h",
      candleCount: 250,
      requiredCandles: 200,
      lastOpenTime: "2026-05-31T20:00:00.000Z",
    });
    expect(getSymbolSignalHistoryPgMock).not.toHaveBeenCalled();
    expect(getSymbolCandlesPgMock).not.toHaveBeenCalled();
  });

  it("returns insufficient-history metadata when a sparse weekly symbol was skipped", async () => {
    getSymbolResearchLatestSignalPgMock.mockResolvedValue({
      symbol: makeResearchSymbol("SEIUSDT"),
      scanRun: makeRun("full-1w", {
        timeframe: "1w",
        symbolsTotal: 413,
        symbolsScanned: 192,
        symbolsSkipped: 221,
        signalsCreated: 192,
        params: { assetClass: "crypto", allSymbols: true },
      }),
      signal: null,
    });
    getSymbolCandleCoveragePgMock.mockResolvedValue({
      timeframe: "1w",
      candleCount: 145,
      firstOpenTime: "2023-08-14T00:00:00.000Z",
      lastOpenTime: "2026-05-25T00:00:00.000Z",
    });

    const response = await requestTradeApi(
      "/api/symbol/research?exchange=binance&symbol=SEIUSDT&timeframe=1w",
    );
    const body = JSON.parse(response.body);

    expect(response.status).toBe(404);
    expect(body).toMatchObject({
      ok: false,
      error: "NO_LATEST_SIGNAL",
      errorCode: "NO_LATEST_SIGNAL",
      unavailableReason: "insufficient_history",
      timeframe: "1w",
      message:
        "No 1w scanner signal for SEIUSDT. The latest full-universe 1w scan ran successfully and skipped 221 symbols, and SEIUSDT was skipped because it has only 145 weekly candles. The scanner currently requires 200 candles.",
      selectedRun: {
        id: "full-1w",
        timeframe: "1w",
        status: "success",
        symbolsTotal: 413,
        symbolsScanned: 192,
        symbolsSkipped: 221,
        signalsCreated: 192,
        isLikelyFullUniverse: true,
      },
      symbolCoverage: {
        timeframe: "1w",
        candleCount: 145,
        requiredCandles: 200,
        firstOpenTime: "2023-08-14T00:00:00.000Z",
        lastOpenTime: "2026-05-25T00:00:00.000Z",
      },
    });
    expect(getSymbolCandleCoveragePgMock).toHaveBeenCalledWith({
      exchange: "binance",
      market: "spot",
      symbol: "SEIUSDT",
      timeframe: "1w",
    });
    expect(getSymbolSignalHistoryPgMock).not.toHaveBeenCalled();
    expect(getSymbolCandlesPgMock).not.toHaveBeenCalled();
  });
});

async function requestTradeApi(
  path: string,
  init: { method?: string; headers?: Record<string, string> } = {},
) {
  const { response, headers, getHeader } = createMockResponse();

  await handleTradeApiRequest(
    {
      method: init.method ?? "GET",
      url: path,
      headers: normalizeHeaders(init.headers ?? {}),
    } as http.IncomingMessage,
    response as unknown as http.ServerResponse,
  );

  return {
    status: response.statusCode,
    headers: {
      get: getHeader,
    },
    body: response.body,
    rawHeaders: headers,
  };
}

function normalizeHeaders(headers: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]),
  );
}

function createMockResponse() {
  const headers = new Map<string, string>();
  const response = {
    statusCode: 200,
    body: "",
    setHeader(name: string, value: number | string | string[]) {
      headers.set(name.toLowerCase(), formatHeaderValue(value));
      return this;
    },
    writeHead(
      statusCode: number,
      reasonOrHeaders?: string | http.OutgoingHttpHeaders,
      headersArg?: http.OutgoingHttpHeaders,
    ) {
      this.statusCode = statusCode;
      const nextHeaders =
        typeof reasonOrHeaders === "object" ? reasonOrHeaders : headersArg;

      if (nextHeaders) {
        for (const [name, value] of Object.entries(nextHeaders)) {
          if (value !== undefined) {
            headers.set(name.toLowerCase(), formatHeaderValue(value));
          }
        }
      }

      return this;
    },
    end(chunk?: string | Buffer) {
      if (chunk) {
        this.body += chunk.toString();
      }

      return this;
    },
  };

  return {
    response,
    headers,
    getHeader: (name: string) => headers.get(name.toLowerCase()) ?? null,
  };
}

function formatHeaderValue(value: number | string | string[]) {
  return Array.isArray(value) ? value.join(", ") : String(value);
}

function resetScannerMocks() {
  getLatestScanRunMock.mockReset();
  getLatestScanRunMock.mockResolvedValue(null);
  listLatestScanSignalsForRunMock.mockReset();
  listLatestScanSignalsForRunMock.mockResolvedValue([]);
  closeMock.mockReset();
  closeMock.mockResolvedValue(undefined);
  pgScannerResultsStoreMock.mockClear();
}

function resetSymbolResearchMocks() {
  getSymbolResearchLatestSignalPgMock.mockReset();
  getSymbolResearchLatestSignalPgMock.mockResolvedValue({
    symbol: null,
    scanRun: null,
    signal: null,
  });
  getSymbolSignalHistoryPgMock.mockReset();
  getSymbolSignalHistoryPgMock.mockResolvedValue([]);
  getSymbolLatestSignalsByTimeframesPgMock.mockReset();
  getSymbolLatestSignalsByTimeframesPgMock.mockResolvedValue([]);
  getSymbolCandlesPgMock.mockReset();
  getSymbolCandlesPgMock.mockResolvedValue([]);
  getSymbolCandleCoveragePgMock.mockReset();
  getSymbolCandleCoveragePgMock.mockResolvedValue({
    timeframe: "4h",
    candleCount: 0,
    firstOpenTime: null,
    lastOpenTime: null,
  });
  getSymbolBehaviorPgMock.mockReset();
  getSymbolBehaviorPgMock.mockResolvedValue(null);
  closeSymbolResearchMock.mockReset();
  closeSymbolResearchMock.mockResolvedValue(undefined);
  pgSymbolResearchStoreMock.mockClear();
}

function makeRun(
  id: string,
  overrides: Partial<{
    timeframe: string;
    symbolsTotal: number;
    symbolsScanned: number;
    signalsCreated: number;
    symbolsSkipped: number;
    params: Record<string, unknown>;
  }> = {},
) {
  return {
    id,
    exchange: "binance",
    market: "spot",
    mode: "single",
    timeframe: overrides.timeframe ?? "4h",
    universe: "all-symbols",
    status: "success",
    symbolsTotal: overrides.symbolsTotal ?? 2,
    symbolsScanned: overrides.symbolsScanned ?? 2,
    signalsCreated: overrides.signalsCreated ?? 2,
    symbolsSkipped: overrides.symbolsSkipped ?? 0,
    failedSymbols: 0,
    params: overrides.params ?? {},
    errorMessage: null,
    startedAt: "2026-05-31T00:00:00.000Z",
    finishedAt: "2026-05-31T00:01:00.000Z",
  };
}

function makeResearchSymbol(symbol: string) {
  return {
    id: 1,
    exchange: "binance",
    market: "spot",
    symbol,
    baseAsset: symbol.replace(/USDT$/, ""),
    quoteAsset: "USDT",
    status: "TRADING",
    quoteVolume: 1000000,
    priceChangePercent: 1.2,
    isEnabled: true,
    assetClass: "crypto",
    isScannerEligible: true,
    isBacktestEligible: true,
    isMarketContext: false,
    metadata: {},
    updatedAt: "2026-05-31T00:00:00.000Z",
  };
}

function makeResearchSignal(
  overrides: Partial<{
    id: string;
    scanRunId: string;
    symbol: string;
    timeframe: string;
    rankScore: number | null;
    primaryStructure: string | null;
    detectedRiskTypes: unknown[];
    scanTime: string;
    signalLabel: string | null;
    actionBias: string | null;
    scanRunSymbolsTotal: number | null;
    scanRunSymbolsScanned: number | null;
    scanRunSignalsCreated: number | null;
  }> = {},
) {
  return {
    id: overrides.id ?? "signal-1",
    scanRunId: overrides.scanRunId ?? "full-run",
    symbolId: 1,
    exchange: "binance",
    market: "spot",
    symbol: overrides.symbol ?? "SEIUSDT",
    timeframe: overrides.timeframe ?? "4h",
    scanTime: overrides.scanTime ?? "2026-05-31T00:00:01.000Z",
    candleOpenTime: "2026-05-30T20:00:00.000Z",
    priceAtSignal: 1.23,
    rankScore: overrides.rankScore ?? 82,
    finalSignalScore: 76,
    opportunityScore: 74,
    confirmationScore: 68,
    riskScore: 14,
    trendScore: 72,
    momentumScore: 64,
    volumeScore: 54,
    structureScore: 80,
    signalLabel: overrides.signalLabel ?? "confirmed",
    actionBias: overrides.actionBias ?? "eligible",
    primaryStructure: overrides.primaryStructure ?? "strong_trend",
    secondaryStructures: [],
    detectedRiskTypes: overrides.detectedRiskTypes ?? [],
    factors: {},
    nextConfirmation: ["Hold above latest range"],
    invalidation: ["Loses recent support"],
    rawMetrics: {},
    scoringVersion: "test",
    scannerVersion: "test",
    createdAt: "2026-05-31T00:00:02.000Z",
    scanRunStartedAt: "2026-05-31T00:00:00.000Z",
    scanRunFinishedAt: "2026-05-31T00:01:00.000Z",
    scanRunSymbolsTotal: overrides.scanRunSymbolsTotal ?? 413,
    scanRunSymbolsScanned: overrides.scanRunSymbolsScanned ?? 409,
    scanRunSignalsCreated: overrides.scanRunSignalsCreated ?? 409,
    scanRunParams: { assetClass: "crypto", allSymbols: true },
    assetClass: "crypto",
    isScannerEligible: true,
    isBacktestEligible: true,
    isMarketContext: false,
    candleCount: 1000,
    firstOpenTime: "2024-01-01T00:00:00.000Z",
  };
}

function makeResearchCandle({
  openTime,
  close,
  timeframe = "4h",
}: {
  openTime: number;
  close: number;
  timeframe?: string;
}) {
  return {
    id: openTime,
    symbolId: 1,
    exchange: "binance",
    market: "spot",
    symbol: "SEIUSDT",
    timeframe,
    openTime,
    closeTime: openTime + 1000,
    open: close - 0.1,
    high: close + 0.2,
    low: close - 0.2,
    close,
    volume: 100,
    quoteVolume: 150,
  };
}

function makeResearchBehavior() {
  return {
    timeframe: "4h",
    symbol: "SEIUSDT",
    sampleSize: 12,
    eligibleSampleSize: 11,
    horizons: [
      {
        candles: 1,
        sampleSize: 11,
        averageReturnPct: 1.2,
        medianReturnPct: 0.8,
        winRatePct: 63.6,
        averageMaxUpsidePct: 2.4,
        averageMaxDrawdownPct: -1.1,
        bestReturnPct: 5.3,
        worstReturnPct: -3.2,
      },
    ],
    byGroup: [],
    bySignalLabel: [],
    recentOutcomes: [],
    currentContext: {
      currentSignalLabel: "confirmed",
      currentResultGroup: "eligible",
      matchingGroupSampleSize: 7,
      matchingSignalSampleSize: 5,
      note: "Research only.",
    },
    warnings: [],
  };
}
