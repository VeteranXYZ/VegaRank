import type http from "node:http";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  actionCodeByBias,
  groupCodeByResultGroup,
  riskCodeByType,
  scannerCodeVersions,
  setupCodeByAliasOrStructure,
  signalCodeByLabel,
} from "@/lib/vegarank-codebook/codeRegistry";
import { handleTradeApiRequest } from "./trade-api";

const getLatestRankingRunMock = vi.hoisted(() => vi.fn());
const listLatestRankingSignalsForRunMock = vi.hoisted(() => vi.fn());
const listScanRunsMock = vi.hoisted(() => vi.fn());
const listHistoricalScanRunsMock = vi.hoisted(() => vi.fn());
const getHistoricalScanRunMock = vi.hoisted(() => vi.fn());
const getHistoricalSnapshotObservationsMock = vi.hoisted(() => vi.fn());
const listHistoricalSnapshotObservationsForRunMock = vi.hoisted(() => vi.fn());
const getHistoricalObservationMarketCandleCoverageMock = vi.hoisted(() =>
  vi.fn(),
);
const closeMock = vi.hoisted(() => vi.fn());
const getSymbolResearchLatestSignalPgMock = vi.hoisted(() => vi.fn());
const getSymbolSignalHistoryPgMock = vi.hoisted(() => vi.fn());
const getSymbolLatestSignalsByTimeframesPgMock = vi.hoisted(() => vi.fn());
const getSymbolCandlesPgMock = vi.hoisted(() => vi.fn());
const getSymbolCandleCoveragePgMock = vi.hoisted(() => vi.fn());
const getSymbolBehaviorPgMock = vi.hoisted(() => vi.fn());
const closeSymbolResearchMock = vi.hoisted(() => vi.fn());
const getSignalEvaluationPgMock = vi.hoisted(() => vi.fn());
const closeSignalEvaluationMock = vi.hoisted(() => vi.fn());
const pgScannerResultsStoreMock = vi.hoisted(() =>
  vi.fn(function PgRankingResultsStore() {
    return {
      getLatestRankingRun: getLatestRankingRunMock,
      listLatestRankingSignalsForRun: listLatestRankingSignalsForRunMock,
      listScanRuns: listScanRunsMock,
      listHistoricalScanRuns: listHistoricalScanRunsMock,
      getHistoricalScanRun: getHistoricalScanRunMock,
      getHistoricalSnapshotObservations: getHistoricalSnapshotObservationsMock,
      listHistoricalSnapshotObservationsForRun:
        listHistoricalSnapshotObservationsForRunMock,
      getHistoricalObservationMarketCandleCoverage:
        getHistoricalObservationMarketCandleCoverageMock,
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
const pgSignalEvaluationStoreMock = vi.hoisted(() =>
  vi.fn(function PgSignalEvaluationStore() {
    return {
      getSignalEvaluationPg: getSignalEvaluationPgMock,
      close: closeSignalEvaluationMock,
    };
  }),
);

vi.mock("@/lib/storage/postgres/rankingResultsPg", () => ({
  HISTORICAL_SNAPSHOT_OBSERVATION_WINDOWS: [1, 3, 5, 10],
  LATEST_SCAN_FULL_UNIVERSE_MIN_SYMBOLS: 300,
  PgRankingResultsStore: pgScannerResultsStoreMock,
  normalizeHistoricalSnapshotObservationWindow: (value: number) =>
    [1, 3, 5, 10].includes(value) ? value : null,
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

vi.mock("@/lib/storage/postgres/signalEvaluationPg", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/storage/postgres/signalEvaluationPg")>();

  return {
    ...actual,
    PgSignalEvaluationStore: pgSignalEvaluationStoreMock,
  };
});

beforeEach(() => {
  resetSignalEvaluationMocks();
});

describe("trade-api CORS", () => {
  beforeEach(() => {
    resetScannerMocks();
    resetSymbolResearchMocks();
  });

  it("allows the production scanner origin on latest-rankings GET requests", async () => {
    const response = await requestTradeApi("/api/rankings/latest?timeframe=4h", {
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

  it("allows the local development origin on latest-rankings GET requests", async () => {
    const response = await requestTradeApi("/api/rankings/latest?timeframe=4h", {
      headers: { Origin: "http://localhost:3000" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:3000",
    );
  });

  it("does not set Access-Control-Allow-Origin for disallowed origins", async () => {
    const response = await requestTradeApi("/api/rankings/latest?timeframe=4h", {
      headers: { Origin: "https://example.com" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("returns preflight responses without hitting Postgres", async () => {
    const response = await requestTradeApi("/api/rankings/latest?timeframe=4h", {
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

describe("trade-api route cutover", () => {
  const historyRunId = "fcc05284-c7a0-4990-9bcb-5dd165d83c37";

  beforeEach(() => {
    resetScannerMocks();
    resetSymbolResearchMocks();
  });

  it("serves VegaRank rankings and archive API routes", async () => {
    getLatestRankingRunMock.mockImplementation(({ timeframe }: { timeframe: string }) =>
      Promise.resolve(
        makeRun(`full-${timeframe}`, {
          timeframe,
          symbolsTotal: 413,
          symbolsScanned: 409,
          signalsCreated: 0,
          params: { assetClass: "crypto", allSymbols: true },
        }),
      ),
    );
    listScanRunsMock.mockResolvedValue([
      makeRun("list-run", {
        symbolsTotal: 413,
        symbolsScanned: 409,
        signalsCreated: 0,
      }),
    ]);
    listHistoricalScanRunsMock.mockResolvedValue([
      makeRun(historyRunId, {
        symbolsTotal: 413,
        symbolsScanned: 409,
        signalsCreated: 0,
        params: { assetClass: "crypto", allSymbols: true },
      }),
    ]);
    getHistoricalScanRunMock.mockResolvedValue(
      makeRun(historyRunId, {
        symbolsTotal: 413,
        symbolsScanned: 409,
        signalsCreated: 0,
        params: { assetClass: "crypto", allSymbols: true },
      }),
    );
    getHistoricalSnapshotObservationsMock.mockResolvedValue({
      run: makeRun(historyRunId, {
        symbolsTotal: 413,
        symbolsScanned: 409,
        signalsCreated: 0,
        params: { assetClass: "crypto", allSymbols: true },
      }),
      rows: [],
    });

    const requiredRoutes = [
      "/api/rankings/latest?timeframe=4h&assetClass=crypto&limit=100",
      "/api/rankings/mtf-latest?assetClass=crypto",
      "/api/rankings/runs?limit=1",
      "/api/archive/snapshots?timeframe=4h&assetClass=crypto",
      `/api/archive/snapshot?runId=${historyRunId}&assetClass=crypto`,
      "/api/archive/observation-readiness?timeframe=4h&assetClass=crypto&window=3",
      `/api/archive/snapshot-observations?runId=${historyRunId}&assetClass=crypto&window=3`,
    ];

    for (const path of requiredRoutes) {
      const response = await requestTradeApi(path);
      const body = JSON.parse(response.body);

      expect(response.status, path).toBe(200);
      expect(body.error, path).not.toBe("NOT_FOUND");
      expect(response.headers.get("location"), path).toBeNull();
    }
  });

  it("does not serve legacy scan or history API routes", async () => {
    const legacyRoutes = [
      "/api/scan/latest",
      "/api/scan/mtf-latest",
      "/api/scan/runs",
      "/api/history/snapshots",
      "/api/history/snapshot",
      "/api/history/observation-readiness",
      "/api/history/snapshot-observations",
      "/api/history/evaluate",
      "/api/history/research-stats",
      "/api/history/scans",
    ];

    for (const path of legacyRoutes) {
      const response = await requestTradeApi(path);
      const body = JSON.parse(response.body);

      expect(response.status, path).toBe(404);
      expect(body.error, path).toBe("NOT_FOUND");
      expect(response.headers.get("location"), path).toBeNull();
    }
  });
});

describe("trade-api signal evaluation", () => {
  beforeEach(() => {
    resetScannerMocks();
    resetSymbolResearchMocks();
  });

  it("returns historical signal evaluation with normalized filters", async () => {
    getSignalEvaluationPgMock.mockResolvedValue(
      makeSignalEvaluationResponse({
        filters: {
          assetClass: "crypto",
          exchange: "binance",
          market: "spot",
          timeframe: "1h",
          symbol: "BTCUSDT",
          group: "risk",
          signalLabel: "breakdown_risk",
          primaryStructure: "trend_breakdown",
          setupType: "trend_breakdown",
          horizons: [1, 3, 5, 10],
        },
        expectedDirection: "down",
      }),
    );

    const response = await requestTradeApi(
      "/api/signal/evaluation?timeframe=1h&symbol=btcusdt&group=risk&signalLabel=breakdown_risk&setupType=trend_breakdown&horizons=1,3,5,10&minSamples=12&limit=250&includeBreakdowns=false",
    );
    const body = JSON.parse(response.body);

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.service).toBe("trade-api");
    expect(body.source).toBe("postgres");
    expect(body.expectedDirection).toBe("down");
    expect(getSignalEvaluationPgMock).toHaveBeenCalledWith({
      assetClass: "crypto",
      exchange: "binance",
      market: "spot",
      timeframe: "1h",
      symbol: "BTCUSDT",
      group: "risk",
      signalLabel: "breakdown_risk",
      primaryStructure: null,
      setupType: "trend_breakdown",
      horizons: [1, 3, 5, 10],
      minSamples: 12,
      limit: 250,
      includeBreakdowns: false,
    });
    expect(closeSignalEvaluationMock).toHaveBeenCalled();
  });

  it("uses conservative defaults for broad evaluation requests", async () => {
    getSignalEvaluationPgMock.mockResolvedValue(makeSignalEvaluationResponse());

    const response = await requestTradeApi("/api/signal/evaluation");

    expect(response.status).toBe(200);
    expect(getSignalEvaluationPgMock).toHaveBeenCalledWith({
      assetClass: "crypto",
      exchange: "binance",
      market: "spot",
      timeframe: "4h",
      symbol: null,
      group: null,
      signalLabel: null,
      primaryStructure: null,
      setupType: null,
      horizons: [1, 3, 5, 10],
      minSamples: 10,
      limit: 5000,
      includeBreakdowns: true,
    });
  });

  it("rejects invalid evaluation filters before opening the store", async () => {
    const response = await requestTradeApi(
      "/api/signal/evaluation?timeframe=15m&group=buy",
    );
    const body = JSON.parse(response.body);

    expect(response.status).toBe(400);
    expect(body.error).toBe("INVALID_TIMEFRAME");
    expect(pgSignalEvaluationStoreMock).not.toHaveBeenCalled();
  });

  it("rejects invalid horizon lists", async () => {
    const response = await requestTradeApi(
      "/api/signal/evaluation?horizons=1,0,abc",
    );
    const body = JSON.parse(response.body);

    expect(response.status).toBe(400);
    expect(body.error).toBe("INVALID_HORIZONS");
    expect(pgSignalEvaluationStoreMock).not.toHaveBeenCalled();
  });
});

describe("trade-api latest rankings run selection", () => {
  beforeEach(() => {
    resetScannerMocks();
    resetSymbolResearchMocks();
  });

  it("requests full-universe selection for default crypto latest rankings", async () => {
    getLatestRankingRunMock.mockResolvedValue(
      makeRun("full-run", {
        symbolsTotal: 413,
        symbolsScanned: 409,
        signalsCreated: 409,
        params: { assetClass: "crypto", allSymbols: true },
      }),
    );

    const response = await requestTradeApi(
      "/api/rankings/latest?timeframe=4h&assetClass=crypto&limit=100",
    );
    const body = JSON.parse(response.body);

    expect(response.status).toBe(200);
    expect(body.run.id).toBe("full-run");
    expect(getLatestRankingRunMock).toHaveBeenCalledWith({
      timeframe: "4h",
      assetClass: "crypto",
      preferFullUniverse: true,
      minExpectedSymbols: 300,
    });
    expect(listLatestRankingSignalsForRunMock).toHaveBeenCalledWith({
      scanRunId: "full-run",
      timeframe: "4h",
      assetClass: "crypto",
      includeNonScanner: false,
      includeMarketContext: false,
      includeCoverage: false,
    });
    expect(body.summary.latestRunSelection).toEqual({
      preferredFullUniverse: true,
      isLikelyFullUniverse: true,
      minExpectedSymbols: 300,
      fallbackUsed: false,
    });
  });

  it("passes hourly, daily, and weekly timeframes through latest rankings metadata", async () => {
    getLatestRankingRunMock.mockImplementation(({ timeframe }: { timeframe: string }) =>
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
      "/api/rankings/latest?timeframe=1d&assetClass=crypto&limit=100",
    );
    const weeklyResponse = await requestTradeApi(
      "/api/rankings/latest?timeframe=1w&assetClass=crypto&limit=100",
    );
    const hourlyResponse = await requestTradeApi(
      "/api/rankings/latest?timeframe=1h&assetClass=crypto&limit=100",
    );
    const dailyBody = JSON.parse(dailyResponse.body);
    const weeklyBody = JSON.parse(weeklyResponse.body);
    const hourlyBody = JSON.parse(hourlyResponse.body);

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
    expect(hourlyResponse.status).toBe(200);
    expect(hourlyBody.timeframe).toBe("1h");
    expect(hourlyBody.run).toMatchObject({ id: "full-1h", timeframe: "1h" });
    expect(hourlyBody.summary.latestRunSelection).toMatchObject({
      preferredFullUniverse: true,
      isLikelyFullUniverse: true,
      fallbackUsed: false,
    });
    expect(getLatestRankingRunMock).toHaveBeenNthCalledWith(1, {
      timeframe: "1d",
      assetClass: "crypto",
      preferFullUniverse: true,
      minExpectedSymbols: 300,
    });
    expect(getLatestRankingRunMock).toHaveBeenNthCalledWith(2, {
      timeframe: "1w",
      assetClass: "crypto",
      preferFullUniverse: true,
      minExpectedSymbols: 300,
    });
    expect(getLatestRankingRunMock).toHaveBeenNthCalledWith(3, {
      timeframe: "1h",
      assetClass: "crypto",
      preferFullUniverse: true,
      minExpectedSymbols: 300,
    });
  });

  it("marks fallback metadata when only a limited crypto run is returned", async () => {
    getLatestRankingRunMock.mockResolvedValue(
      makeRun("limited-run", {
        symbolsTotal: 100,
        symbolsScanned: 96,
        signalsCreated: 96,
      }),
    );

    const response = await requestTradeApi(
      "/api/rankings/latest?timeframe=4h&assetClass=crypto&limit=100",
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
    getLatestRankingRunMock.mockResolvedValue(
      makeRun("small-stable-run", {
        symbolsTotal: 4,
        symbolsScanned: 4,
        signalsCreated: 4,
      }),
    );

    const stableResponse = await requestTradeApi(
      "/api/rankings/latest?timeframe=4h&assetClass=stable&limit=100",
    );
    const stableBody = JSON.parse(stableResponse.body);

    expect(stableResponse.status).toBe(200);
    expect(getLatestRankingRunMock).toHaveBeenLastCalledWith({
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
      "/api/rankings/latest?timeframe=4h&assetClass=crypto&includeNonScanner=true&limit=100",
    );

    expect(getLatestRankingRunMock).toHaveBeenLastCalledWith({
      timeframe: "4h",
      assetClass: "crypto",
      preferFullUniverse: false,
      minExpectedSymbols: 300,
    });
  });

  it("keeps latest rankings responses limited for rankings UI visibility", async () => {
    getLatestRankingRunMock.mockResolvedValue(
      makeRun("full-run", {
        symbolsTotal: 413,
        symbolsScanned: 409,
        signalsCreated: 3,
        params: { assetClass: "crypto", allSymbols: true },
      }),
    );
    listLatestRankingSignalsForRunMock.mockResolvedValue([
      makeResearchSignal({ id: "signal-btc", symbol: "BTCUSDT", rankScore: 92 }),
      makeResearchSignal({ id: "signal-eth", symbol: "ETHUSDT", rankScore: 88 }),
      makeResearchSignal({ id: "signal-sei", symbol: "SEIUSDT", rankScore: 84 }),
    ]);

    const response = await requestTradeApi(
      "/api/rankings/latest?timeframe=4h&assetClass=crypto&limit=1",
    );
    const body = JSON.parse(response.body);

    expect(response.status).toBe(200);
    expect(body.count).toBe(1);
    expect(body.items).toHaveLength(1);
    expectPublicScannerCodeContract(body.items[0]);
    expect(body.summary).toMatchObject({
      totalSignals: 3,
      returnedItems: 1,
    });
  });
});

describe("trade-api historical snapshots", () => {
  const historyRunId = "fcc05284-c7a0-4990-9bcb-5dd165d83c37";

  beforeEach(() => {
    resetScannerMocks();
    resetSymbolResearchMocks();
  });

  it("lists recent successful single-timeframe historical snapshots", async () => {
    listHistoricalScanRunsMock.mockResolvedValue([
      makeRun(historyRunId, {
        timeframe: "4h",
        symbolsTotal: 413,
        symbolsScanned: 409,
        signalsCreated: 409,
        symbolsSkipped: 4,
        params: { assetClass: "crypto", allSymbols: true },
      }),
    ]);

    const response = await requestTradeApi(
      "/api/archive/snapshots?timeframe=4h&assetClass=crypto",
    );
    const body = JSON.parse(response.body);

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.service).toBe("trade-api");
    expect(body.source).toBe("postgres");
    expect(body.metadata).toMatchObject({
      timeframe: "4h",
      assetClass: "crypto",
      count: 1,
      limit: 25,
    });
    expect(body.metadata.disclaimer).toContain("Historical observations are not predictions");
    expect(body.snapshots[0]).toMatchObject({
      runId: historyRunId,
      timeframe: "4h",
      status: "success",
      symbolsScanned: 409,
      signalsCreated: 409,
      skipped: 4,
      isLikelyFullUniverse: true,
    });
    expect(listHistoricalScanRunsMock).toHaveBeenCalledWith({
      timeframe: "4h",
      assetClass: "crypto",
      limit: 25,
    });
    expect(closeMock).toHaveBeenCalled();
  });

  it("returns full stored rows for a selected historical snapshot", async () => {
    getHistoricalScanRunMock.mockResolvedValue(
      makeRun(historyRunId, {
        timeframe: "4h",
        symbolsTotal: 413,
        symbolsScanned: 409,
        signalsCreated: 2,
        params: { assetClass: "crypto", allSymbols: true },
      }),
    );
    listLatestRankingSignalsForRunMock.mockResolvedValue([
      makeResearchSignal({
        id: "risk-signal",
        scanRunId: historyRunId,
        symbol: "RISKUSDT",
        rankScore: 120,
        signalLabel: "breakdown_risk",
        actionBias: "avoid",
        primaryStructure: "trend_breakdown",
        detectedRiskTypes: ["trend_breakdown_risk"],
      }),
      makeResearchSignal({
        id: "eligible-signal",
        scanRunId: historyRunId,
        symbol: "SEIUSDT",
        rankScore: 82,
      }),
    ]);

    const response = await requestTradeApi(
      `/api/archive/snapshot?runId=${historyRunId}&assetClass=crypto`,
    );
    const body = JSON.parse(response.body);

    expect(response.status).toBe(200);
    expect(body.run).toMatchObject({
      runId: historyRunId,
      timeframe: "4h",
      scannerVersion: scannerCodeVersions.scannerVersion,
      scoringVersion: "test",
      isLikelyFullUniverse: true,
    });
    expect(body.metadata).toMatchObject({
      rowCount: 2,
      limited: false,
      timeframe: "4h",
      assetClass: "crypto",
    });
    expect(body.rows.map((row: { symbol: string }) => row.symbol)).toEqual([
      "SEIUSDT",
      "RISKUSDT",
    ]);
    expect(body.rows[0]).toMatchObject({
      symbol: "SEIUSDT",
      groupCode: "GR_501",
      actionCode: "AC_501",
      setupCode: "TR_601",
    });
    expectPublicScannerCodeContract(body.rows[0]);
    expect(body.rows[1]).toMatchObject({
      symbol: "RISKUSDT",
      groupCode: "GR_301",
      riskCodes: ["RK_302"],
    });
    expectPublicScannerCodeContract(body.rows[1]);
    expect(getHistoricalScanRunMock).toHaveBeenCalledWith({
      scanRunId: historyRunId,
      timeframe: undefined,
      assetClass: "crypto",
    });
    expect(listLatestRankingSignalsForRunMock).toHaveBeenCalledWith({
      scanRunId: historyRunId,
      timeframe: "4h",
      assetClass: "crypto",
      includeNonScanner: false,
      includeMarketContext: false,
      includeCoverage: false,
    });
  });

  it("rejects invalid historical snapshot filters before opening the store", async () => {
    const timeframeResponse = await requestTradeApi(
      "/api/archive/snapshots?timeframe=15m",
    );
    const runResponse = await requestTradeApi(
      "/api/archive/snapshot?runId=../../secret",
    );
    const negativeRunResponse = await requestTradeApi(
      "/api/archive/snapshot?runId=-1",
    );
    const malformedRunResponse = await requestTradeApi(
      "/api/archive/snapshot?runId=abc",
    );

    expect(timeframeResponse.status).toBe(400);
    expect(JSON.parse(timeframeResponse.body).error).toBe("INVALID_TIMEFRAME");
    expect(runResponse.status).toBe(400);
    expect(JSON.parse(runResponse.body).error).toMatchObject({
      code: "INVALID_RUN_ID",
      message: "Invalid run id.",
    });
    expect(negativeRunResponse.status).toBe(400);
    expect(JSON.parse(negativeRunResponse.body).error).toMatchObject({
      code: "INVALID_RUN_ID",
      message: "Invalid run id.",
    });
    expect(malformedRunResponse.status).toBe(400);
    expect(JSON.parse(malformedRunResponse.body).error).toMatchObject({
      code: "INVALID_RUN_ID",
      message: "Invalid run id.",
    });
    expect(negativeRunResponse.body).not.toContain("22P02");
    expect(negativeRunResponse.body).not.toContain(
      "Dependency health check failed",
    );
    expect(pgScannerResultsStoreMock).not.toHaveBeenCalled();
  });

  it("returns forward observations for a selected historical snapshot", async () => {
    getHistoricalSnapshotObservationsMock.mockResolvedValue({
      run: makeRun(historyRunId, {
        timeframe: "4h",
        symbolsTotal: 413,
        symbolsScanned: 409,
        signalsCreated: 3,
        params: { assetClass: "crypto", allSymbols: true },
      }),
      rows: [
        makeObservationRecord({
          id: "complete-signal",
          scanRunId: historyRunId,
          symbol: "SEIUSDT",
          dataStatus: "complete",
          observedChangePct: 2.5,
          maxDrawdownPct: -1.25,
          missingReason: null,
        }),
        makeObservationRecord({
          id: "partial-signal",
          scanRunId: historyRunId,
          symbol: "RISKUSDT",
          signalLabel: "breakdown_risk",
          actionBias: "avoid",
          primaryStructure: "trend_breakdown",
          detectedRiskTypes: ["trend_breakdown_risk"],
          dataStatus: "partial",
          observedChangePct: -1,
          maxDrawdownPct: -3.5,
          missingReason: "insufficient_future_candles",
        }),
        makeObservationRecord({
          id: "missing-signal",
          scanRunId: historyRunId,
          symbol: "NEWUSDT",
          dataStatus: "missing",
          observedClose: null,
          observedChangePct: null,
          maxDrawdownPct: null,
          missingReason: "no_future_candles",
        }),
      ],
    });

    const response = await requestTradeApi(
      `/api/archive/snapshot-observations?runId=${historyRunId}&assetClass=crypto&window=3`,
    );
    const body = JSON.parse(response.body);

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.service).toBe("trade-api");
    expect(body.source).toBe("postgres");
    expect(body.metadata).toMatchObject({
      window: 3,
      selectedWindow: 3,
      windowUnit: "completed_candles",
      rowCount: 3,
      completeCount: 1,
      partialCount: 1,
      missingCount: 1,
      limited: false,
      timeframe: "4h",
      assetClass: "crypto",
    });
    expect(body.summary).toEqual({
      totalRows: 3,
      returnedRows: 3,
      completeCount: 1,
      partialCount: 1,
      missingCount: 1,
      window: 3,
      timeframe: "4h",
      runId: historyRunId,
    });
    expect(body.metadata.disclaimer).toContain(
      "Historical observations are not predictions",
    );
    expect(body.rows).toHaveLength(3);
    const rowsBySymbol = new Map(
      body.rows.map((row: { symbol: string }) => [row.symbol, row]),
    );

    expect(rowsBySymbol.get("SEIUSDT")).toMatchObject({
      symbol: "SEIUSDT",
      groupCode: "GR_501",
      actionCode: "AC_501",
      anchorSource: "stored_signal",
      window: 3,
      observedChangePct: 2.5,
      maxDrawdownPct: -1.25,
      dataStatus: "complete",
      missingReason: null,
    });
    expectPublicScannerCodeContract(
      rowsBySymbol.get("SEIUSDT") as Record<string, unknown>,
    );
    expect(rowsBySymbol.get("RISKUSDT")).toMatchObject({
      symbol: "RISKUSDT",
      groupCode: "GR_301",
      riskCodes: ["RK_302"],
      dataStatus: "partial",
      missingReason: "insufficient_future_candles",
    });
    expectPublicScannerCodeContract(
      rowsBySymbol.get("RISKUSDT") as Record<string, unknown>,
    );
    expect(rowsBySymbol.get("SEIUSDT")).toHaveProperty("observedChangePct");
    expect(rowsBySymbol.get("SEIUSDT")).not.toHaveProperty("winRate");
    expect(rowsBySymbol.get("SEIUSDT")).not.toHaveProperty("accuracy");
    expect(rowsBySymbol.get("SEIUSDT")).not.toHaveProperty("worked");
    expect(rowsBySymbol.get("SEIUSDT")).not.toHaveProperty("failed");
    expect(rowsBySymbol.get("SEIUSDT")).not.toHaveProperty("recommendation");
    expect(getHistoricalSnapshotObservationsMock).toHaveBeenCalledWith({
      scanRunId: historyRunId,
      timeframe: undefined,
      assetClass: "crypto",
      window: 3,
    });
  });

  it("returns a safe observation summary when a run has signals but no rows are returned", async () => {
    getHistoricalSnapshotObservationsMock.mockResolvedValue({
      run: makeRun(historyRunId, {
        timeframe: "4h",
        symbolsTotal: 413,
        symbolsScanned: 413,
        signalsCreated: 413,
        params: { assetClass: "crypto", allSymbols: true },
      }),
      rows: [],
    });

    const response = await requestTradeApi(
      `/api/archive/snapshot-observations?runId=${historyRunId}&assetClass=crypto&window=3`,
    );
    const body = JSON.parse(response.body);

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.rows).toEqual([]);
    expect(body.metadata).toMatchObject({
      rowCount: 0,
      completeCount: 0,
      partialCount: 0,
      missingCount: 0,
    });
    expect(body.summary).toEqual({
      totalRows: 413,
      returnedRows: 0,
      completeCount: 0,
      partialCount: 0,
      missingCount: 413,
      window: 3,
      timeframe: "4h",
      runId: historyRunId,
    });
  });

  it("rejects invalid historical observation inputs before opening the store", async () => {
    const invalidWindowResponse = await requestTradeApi(
      `/api/archive/snapshot-observations?runId=${historyRunId}&window=2`,
    );
    const malformedRunResponse = await requestTradeApi(
      "/api/archive/snapshot-observations?runId=abc&window=3",
    );

    expect(invalidWindowResponse.status).toBe(400);
    expect(JSON.parse(invalidWindowResponse.body).error).toMatchObject({
      code: "INVALID_WINDOW",
    });
    expect(malformedRunResponse.status).toBe(400);
    expect(JSON.parse(malformedRunResponse.body).error).toMatchObject({
      code: "INVALID_RUN_ID",
      message: "Invalid run id.",
    });
    expect(pgScannerResultsStoreMock).not.toHaveBeenCalled();
  });

  it("sanitizes internal errors from historical observation requests", async () => {
    getHistoricalSnapshotObservationsMock.mockRejectedValue({ code: "22P02" });

    const response = await requestTradeApi(
      `/api/archive/snapshot-observations?runId=${historyRunId}&window=3`,
    );
    const body = JSON.parse(response.body);

    expect(response.status).toBe(503);
    expect(body.error).toBe("INTERNAL_ERROR");
    expect(response.body).not.toContain("22P02");
    expect(response.body).not.toContain("Dependency health check failed");
  });

  it("returns observation readiness with an older full-universe recommendation", async () => {
    const olderRunId = "f4a432e8-d387-4708-b94b-b6717b66e628";
    const selectedRun = makeRun(historyRunId, {
      symbolsTotal: 413,
      symbolsScanned: 409,
      signalsCreated: 409,
      params: { assetClass: "crypto", allSymbols: true },
    });
    const olderRun = makeRun(olderRunId, {
      symbolsTotal: 413,
      symbolsScanned: 409,
      signalsCreated: 409,
      params: { assetClass: "crypto", allSymbols: true },
    });

    listHistoricalScanRunsMock.mockResolvedValue([selectedRun, olderRun]);
    getHistoricalScanRunMock.mockResolvedValue(selectedRun);
    getHistoricalObservationMarketCandleCoverageMock.mockResolvedValue(
      makeObservationCoverage({
        latestOpenTime: "2026-06-01T20:00:00.000Z",
        latestOpenTimeSymbolCount: 100,
        buckets: [
          { latestOpenTime: "2026-06-01T20:00:00.000Z", symbolCount: 100 },
          { latestOpenTime: "2026-05-31T00:00:00.000Z", symbolCount: 313 },
        ],
      }),
    );
    listHistoricalSnapshotObservationsForRunMock.mockImplementation(
      ({ scanRunId }: { scanRunId: string }) =>
        Promise.resolve(
          scanRunId === historyRunId
            ? [
                makeObservationRecord({
                  id: "selected-missing-1",
                  scanRunId,
                  symbol: "AAAUSDT",
                  anchorTime: "2026-05-31T00:00:00.000Z",
                  observedClose: null,
                  observedChangePct: null,
                  maxDrawdownPct: null,
                  dataStatus: "missing",
                  missingReason: "no_future_candles",
                  forwardCandlesAvailable: 0,
                }),
                makeObservationRecord({
                  id: "selected-missing-2",
                  scanRunId,
                  symbol: "BBBUSDT",
                  anchorTime: "2026-06-01T20:00:00.000Z",
                  observedClose: null,
                  observedChangePct: null,
                  maxDrawdownPct: null,
                  dataStatus: "missing",
                  missingReason: "no_future_candles",
                  forwardCandlesAvailable: 0,
                }),
              ]
            : [
                makeObservationRecord({
                  id: "older-partial",
                  scanRunId,
                  symbol: "SEIUSDT",
                  dataStatus: "partial",
                  missingReason: "insufficient_future_candles",
                  forwardCandlesAvailable: 1,
                }),
              ],
        ),
    );

    const response = await requestTradeApi(
      `/api/archive/observation-readiness?timeframe=4h&runId=${historyRunId}&assetClass=crypto&window=3`,
    );
    const body = JSON.parse(response.body);

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.selectedRun).toMatchObject({
      state: "not_ready",
      blocker: "market_data_coverage",
      diagnosticBlocker: "stale_market_data",
      rowCount: 2,
      completeCount: 0,
      partialCount: 0,
      missingCount: 2,
      dominantMissingReason: "no_future_candles",
      latestAnchorTime: "2026-06-01T20:00:00.000Z",
      expectedCompleteTime: "2026-06-02T08:00:00.000Z",
      latestCoverageTime: "2026-06-01T20:00:00.000Z",
      coverageLagMs: 43_200_000,
      coverageLagCandles: 3,
    });
    expect(body.recommendedRun).toMatchObject({
      state: "ready",
      isLimited: false,
      partialCount: 1,
      run: {
        runId: olderRunId,
        isLikelyFullUniverse: true,
      },
    });
    expect(body.observationRun.run.runId).toBe(olderRunId);
    expect(body.coverage).toMatchObject({
      latestOpenTime: "2026-06-01T20:00:00.000Z",
      latestOpenTimeSymbolCount: 100,
      latestOpenTimeCoveragePct: 24.21,
    });
    expect(body.metadata).toMatchObject({
      timeframe: "4h",
      window: 3,
      blocker: "market_data_coverage",
      diagnosticBlocker: "stale_market_data",
      candidateLimit: 25,
    });
    expect(listHistoricalSnapshotObservationsForRunMock).toHaveBeenCalledWith({
      scanRunId: historyRunId,
      timeframe: "4h",
      assetClass: "crypto",
      includeNonScanner: false,
      includeMarketContext: false,
      window: 3,
    });
  });

  it("reports market coverage as the blocker when no run is observable", async () => {
    const staleRun = makeRun(historyRunId, {
      symbolsTotal: 413,
      symbolsScanned: 409,
      signalsCreated: 409,
      params: { assetClass: "crypto", allSymbols: true },
    });

    listHistoricalScanRunsMock.mockResolvedValue([staleRun]);
    getHistoricalScanRunMock.mockResolvedValue(staleRun);
    getHistoricalObservationMarketCandleCoverageMock.mockResolvedValue(
      makeObservationCoverage({
        latestOpenTime: "2026-05-31T00:00:00.000Z",
        latestOpenTimeSymbolCount: 413,
      }),
    );
    listHistoricalSnapshotObservationsForRunMock.mockResolvedValue([
      makeObservationRecord({
        id: "missing",
        scanRunId: historyRunId,
        symbol: "SEIUSDT",
        anchorTime: "2026-06-01T20:00:00.000Z",
        observedClose: null,
        observedChangePct: null,
        maxDrawdownPct: null,
        dataStatus: "missing",
        missingReason: "no_future_candles",
        forwardCandlesAvailable: 0,
      }),
    ]);

    const response = await requestTradeApi(
      `/api/archive/observation-readiness?timeframe=4h&runId=${historyRunId}&window=3`,
    );
    const body = JSON.parse(response.body);

    expect(response.status).toBe(200);
    expect(body.selectedRun.blocker).toBe("market_data_coverage");
    expect(body.selectedRun.diagnosticBlocker).toBe("stale_market_data");
    expect(body.selectedRun.coverageLagCandles).toBe(14);
    expect(body.recommendedRun).toBeNull();
    expect(body.observationRun).toBeNull();
    expect(body.coverage.latestOpenTime).toBe("2026-05-31T00:00:00.000Z");
  });

  it("distinguishes a too-recent selected run from stale market data", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-02T06:00:00.000Z"));

    try {
      const recentRun = makeRun(historyRunId, {
        symbolsTotal: 413,
        symbolsScanned: 409,
        signalsCreated: 409,
        params: { assetClass: "crypto", allSymbols: true },
      });

      listHistoricalScanRunsMock.mockResolvedValue([recentRun]);
      getHistoricalScanRunMock.mockResolvedValue(recentRun);
      getHistoricalObservationMarketCandleCoverageMock.mockResolvedValue(
        makeObservationCoverage({
          latestOpenTime: "2026-06-02T08:00:00.000Z",
          latestOpenTimeSymbolCount: 413,
        }),
      );
      listHistoricalSnapshotObservationsForRunMock.mockResolvedValue([
        makeObservationRecord({
          id: "too-recent",
          scanRunId: historyRunId,
          symbol: "BTCUSDT",
          anchorTime: "2026-06-02T00:00:00.000Z",
          observedClose: null,
          observedChangePct: null,
          maxDrawdownPct: null,
          dataStatus: "missing",
          missingReason: "no_future_candles",
          forwardCandlesAvailable: 0,
        }),
      ]);

      const response = await requestTradeApi(
        `/api/archive/observation-readiness?timeframe=4h&runId=${historyRunId}&window=3`,
      );
      const body = JSON.parse(response.body);

      expect(response.status).toBe(200);
      expect(body.selectedRun).toMatchObject({
        state: "not_ready",
        blocker: "time_maturity",
        diagnosticBlocker: "waiting_for_future_candles",
        latestAnchorTime: "2026-06-02T00:00:00.000Z",
        expectedCompleteTime: "2026-06-02T12:00:00.000Z",
        latestCoverageTime: "2026-06-02T08:00:00.000Z",
        coverageLagCandles: 1,
      });
      expect(body.metadata.diagnosticBlocker).toBe("waiting_for_future_candles");
    } finally {
      vi.useRealTimers();
    }
  });

  it("falls back to a limited observable run when no full-universe run is observable", async () => {
    const selectedRun = makeRun(historyRunId, {
      symbolsTotal: 413,
      symbolsScanned: 409,
      signalsCreated: 409,
      params: { assetClass: "crypto", allSymbols: true },
    });
    const limitedRun = makeRun("244271a6-0802-46d4-a61d-74f93cf7591a", {
      symbolsTotal: 100,
      symbolsScanned: 96,
      signalsCreated: 96,
    });

    listHistoricalScanRunsMock.mockResolvedValue([selectedRun, limitedRun]);
    getHistoricalScanRunMock.mockResolvedValue(selectedRun);
    listHistoricalSnapshotObservationsForRunMock.mockImplementation(
      ({ scanRunId }: { scanRunId: string }) =>
        Promise.resolve(
          scanRunId === selectedRun.id
            ? [
                makeObservationRecord({
                  id: "selected-missing",
                  scanRunId,
                  symbol: "AAAUSDT",
                  observedClose: null,
                  observedChangePct: null,
                  maxDrawdownPct: null,
                  dataStatus: "missing",
                  missingReason: "no_future_candles",
                  forwardCandlesAvailable: 0,
                }),
              ]
            : [
                makeObservationRecord({
                  id: "limited-complete",
                  scanRunId,
                  symbol: "SEIUSDT",
                  dataStatus: "complete",
                  missingReason: null,
                }),
              ],
        ),
    );

    const response = await requestTradeApi(
      `/api/archive/observation-readiness?timeframe=4h&runId=${historyRunId}&window=3`,
    );
    const body = JSON.parse(response.body);

    expect(response.status).toBe(200);
    expect(body.recommendedRun).toMatchObject({
      state: "ready",
      isLimited: true,
      run: {
        runId: limitedRun.id,
        isLikelyFullUniverse: false,
      },
    });
    expect(body.observationRun.run.runId).toBe(limitedRun.id);
  });

  it("rejects invalid observation readiness filters before opening the store", async () => {
    const invalidWindowResponse = await requestTradeApi(
      `/api/archive/observation-readiness?timeframe=4h&runId=${historyRunId}&window=2`,
    );
    const malformedRunResponse = await requestTradeApi(
      "/api/archive/observation-readiness?timeframe=4h&runId=abc&window=3",
    );
    const invalidTimeframeResponse = await requestTradeApi(
      `/api/archive/observation-readiness?timeframe=15m&runId=${historyRunId}&window=3`,
    );

    expect(invalidWindowResponse.status).toBe(400);
    expect(JSON.parse(invalidWindowResponse.body).error).toMatchObject({
      code: "INVALID_WINDOW",
    });
    expect(malformedRunResponse.status).toBe(400);
    expect(JSON.parse(malformedRunResponse.body).error).toMatchObject({
      code: "INVALID_RUN_ID",
    });
    expect(invalidTimeframeResponse.status).toBe(400);
    expect(JSON.parse(invalidTimeframeResponse.body).error).toBe(
      "INVALID_TIMEFRAME",
    );
    expect(pgScannerResultsStoreMock).not.toHaveBeenCalled();
  });
});

describe("trade-api market context", () => {
  beforeEach(() => {
    resetScannerMocks();
    resetSymbolResearchMocks();
  });

  it("returns read-only market context from selected BTC and ETH latest runs", async () => {
    getLatestRankingRunMock.mockImplementation(({ timeframe }: { timeframe: string }) =>
      Promise.resolve(
        makeRun(`full-${timeframe}`, {
          timeframe,
          symbolsTotal: 413,
          symbolsScanned: 409,
          signalsCreated: 409,
          params: { assetClass: "crypto", allSymbols: true },
        }),
      ),
    );
    listLatestRankingSignalsForRunMock.mockImplementation(
      ({ timeframe }: { timeframe: string }) => {
        const signalsByTimeframe: Record<
          string,
          ReturnType<typeof makeResearchSignal>[]
        > = {
          "1w": [
            makeResearchSignal({
              id: "btc-1w",
              scanRunId: "full-1w",
              symbol: "BTCUSDT",
              timeframe: "1w",
              rankScore: 92,
            }),
            makeResearchSignal({
              id: "eth-1w",
              scanRunId: "full-1w",
              symbol: "ETHUSDT",
              timeframe: "1w",
              rankScore: 88,
            }),
          ],
          "1d": [
            makeResearchSignal({
              id: "btc-1d",
              scanRunId: "full-1d",
              symbol: "BTCUSDT",
              timeframe: "1d",
              rankScore: 84,
            }),
            makeResearchSignal({
              id: "eth-1d",
              scanRunId: "full-1d",
              symbol: "ETHUSDT",
              timeframe: "1d",
              rankScore: 76,
            }),
          ],
          "4h": [
            makeResearchSignal({
              id: "btc-4h",
              scanRunId: "full-4h",
              symbol: "BTCUSDT",
              timeframe: "4h",
              rankScore: 42,
              signalLabel: "watch",
              actionBias: "watch_only",
            }),
            makeResearchSignal({
              id: "eth-4h",
              scanRunId: "full-4h",
              symbol: "ETHUSDT",
              timeframe: "4h",
              rankScore: 34,
              signalLabel: "watch",
              actionBias: "watch_only",
            }),
          ],
        };

        return Promise.resolve(signalsByTimeframe[timeframe] ?? []);
      },
    );

    const response = await requestTradeApi(
      "/api/market/context?assetClass=crypto",
    );
    const body = JSON.parse(response.body);

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.service).toBe("trade-api");
    expect(body.source).toBe("postgres");
    expect(body.assetClass).toBe("crypto");
    expect(body.context).toMatchObject({
      structuralContext: "long_term_risk_on",
      marketContext: "risk_on",
      tacticalContext: "short_term_repair",
      combinedContext: "bull_trend_continuation",
      confidence: "high",
    });
    expect(body.proxies.BTCUSDT["1d"]).toMatchObject({
      available: true,
      timeframe: "1d",
      groupCode: "GR_501",
      signalCodes: ["PX_501"],
      metrics: { rankScore: 84 },
      runContext: "selected_full_universe",
    });
    expectPublicScannerCodeContract(body.proxies.BTCUSDT["1d"]);
    expect(body.proxies.ETHUSDT["4h"]).toMatchObject({
      available: true,
      groupCode: "GR_101",
    });
    expectPublicScannerCodeContract(body.proxies.ETHUSDT["4h"]);
    expect(body.rules).toMatchObject({
      primaryDriver: "BTCUSDT",
      confirmationAsset: "ETHUSDT",
      researchOnly: true,
    });
    expect(getLatestRankingRunMock).toHaveBeenNthCalledWith(1, {
      timeframe: "1w",
      assetClass: "crypto",
      preferFullUniverse: true,
      minExpectedSymbols: 300,
    });
    expect(getLatestRankingRunMock).toHaveBeenNthCalledWith(3, {
      timeframe: "4h",
      assetClass: "crypto",
      preferFullUniverse: true,
      minExpectedSymbols: 300,
    });
    expect(listLatestRankingSignalsForRunMock).toHaveBeenCalledWith({
      scanRunId: "full-1d",
      timeframe: "1d",
      assetClass: "crypto",
      includeNonScanner: false,
      includeMarketContext: false,
      includeCoverage: false,
    });
    expect(closeMock).toHaveBeenCalled();
  });

  it("rejects unsupported asset classes before opening Postgres", async () => {
    const response = await requestTradeApi(
      "/api/market/context?assetClass=stable",
    );
    const body = JSON.parse(response.body);

    expect(response.status).toBe(400);
    expect(body.error).toBe("UNSUPPORTED_ASSET_CLASS");
    expect(pgScannerResultsStoreMock).not.toHaveBeenCalled();
  });

  it("marks missing runs and missing symbols as unavailable proxy states", async () => {
    getLatestRankingRunMock.mockImplementation(({ timeframe }: { timeframe: string }) =>
      Promise.resolve(
        timeframe === "1w"
          ? null
          : makeRun(`full-${timeframe}`, {
              timeframe,
              symbolsTotal: 413,
              symbolsScanned: 409,
              signalsCreated: 1,
              params: { assetClass: "crypto", allSymbols: true },
            }),
      ),
    );
    listLatestRankingSignalsForRunMock.mockImplementation(
      ({ timeframe }: { timeframe: string }) => {
        if (timeframe === "1d") {
          return Promise.resolve([
            makeResearchSignal({
              id: "eth-1d",
              scanRunId: "full-1d",
              symbol: "ETHUSDT",
              timeframe: "1d",
              rankScore: 44,
            }),
          ]);
        }

        return Promise.resolve([
          makeResearchSignal({
            id: "btc-4h",
            scanRunId: "full-4h",
            symbol: "BTCUSDT",
            timeframe: "4h",
            rankScore: -74,
            signalLabel: "breakdown_risk",
            actionBias: "avoid",
            primaryStructure: "trend_breakdown",
            detectedRiskTypes: ["trend_breakdown_risk"],
          }),
        ]);
      },
    );

    const response = await requestTradeApi("/api/market/context");
    const body = JSON.parse(response.body);

    expect(response.status).toBe(200);
    expect(body.context.combinedContext).toBe("insufficient_data");
    expect(body.context.confidence).toBe("low");
    expect(body.proxies.BTCUSDT["1w"]).toEqual({
      available: false,
      timeframe: "1w",
      reason: "no_latest_signal",
    });
    expect(body.proxies.BTCUSDT["1d"]).toEqual({
      available: false,
      timeframe: "1d",
      reason: "missing_symbol",
    });
    expect(body.proxies.BTCUSDT["4h"]).toMatchObject({
      available: true,
      groupCode: "GR_301",
      riskCodes: ["RK_302"],
      runContext: "selected_full_universe",
    });
    expectPublicScannerCodeContract(body.proxies.BTCUSDT["4h"]);
    expect(body.summary.warnings).toContain(
      "Some proxy timeframe data is unavailable.",
    );
    expect(listLatestRankingSignalsForRunMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ timeframe: "1w" }),
    );
  });
});

describe("trade-api multi-timeframe latest screener", () => {
  beforeEach(() => {
    resetScannerMocks();
    resetSymbolResearchMocks();
  });

  it("returns full selected-run signals joined by symbol across screener timeframes", async () => {
    getLatestRankingRunMock.mockImplementation(({ timeframe }: { timeframe: string }) =>
      Promise.resolve(
        timeframe === "1w"
          ? null
          : makeRun(`full-${timeframe}`, {
              timeframe,
              symbolsTotal: 413,
              symbolsScanned: 409,
              signalsCreated: timeframe === "1d" ? 1 : 2,
              params: { assetClass: "crypto", allSymbols: true },
            }),
      ),
    );
    listLatestRankingSignalsForRunMock.mockImplementation(
      ({ timeframe }: { timeframe: string }) => {
        const signalsByTimeframe: Record<
          string,
          ReturnType<typeof makeResearchSignal>[]
        > = {
          "1h": [
            makeResearchSignal({
              id: "1h-btc",
              scanRunId: "full-1h",
              symbol: "BTCUSDT",
              timeframe: "1h",
              rankScore: 92,
            }),
            makeResearchSignal({
              id: "1h-sei",
              scanRunId: "full-1h",
              symbol: "SEIUSDT",
              timeframe: "1h",
              rankScore: 72,
              signalLabel: "watch",
              actionBias: "watch_only",
            }),
          ],
          "4h": [
            makeResearchSignal({
              id: "4h-btc",
              scanRunId: "full-4h",
              symbol: "BTCUSDT",
              timeframe: "4h",
              rankScore: 82,
            }),
            makeResearchSignal({
              id: "4h-eth",
              scanRunId: "full-4h",
              symbol: "ETHUSDT",
              timeframe: "4h",
              rankScore: 80,
            }),
          ],
          "1d": [
            makeResearchSignal({
              id: "1d-sei",
              scanRunId: "full-1d",
              symbol: "SEIUSDT",
              timeframe: "1d",
              rankScore: 18,
              signalLabel: "breakdown_risk",
              actionBias: "avoid",
              primaryStructure: "trend_breakdown",
            }),
          ],
          "1w": [],
        };

        return Promise.resolve(signalsByTimeframe[timeframe] ?? []);
      },
    );

    const response = await requestTradeApi(
      "/api/rankings/mtf-latest?assetClass=crypto",
    );
    const body = JSON.parse(response.body);
    const btc = body.rows.find((row: { symbol: string }) => row.symbol === "BTCUSDT");
    const sei = body.rows.find((row: { symbol: string }) => row.symbol === "SEIUSDT");
    const eth = body.rows.find((row: { symbol: string }) => row.symbol === "ETHUSDT");

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.service).toBe("trade-api");
    expect(body.source).toBe("postgres");
    expect(body.timeframes).toEqual(["1h", "4h", "1d", "1w"]);
    expect(body.signalCounts).toEqual({ "1h": 2, "4h": 2, "1d": 1, "1w": 0 });
    expect(body.missingCounts).toEqual({ "1h": 1, "4h": 1, "1d": 2, "1w": 3 });
    expect(body.count).toBe(3);
    expect(body.runs["1h"]).toMatchObject({
      id: "full-1h",
      timeframe: "1h",
      status: "success",
      isLikelyFullUniverse: true,
      latestRunSelection: {
        preferredFullUniverse: true,
        isLikelyFullUniverse: true,
        fallbackUsed: false,
      },
    });
    expect(body.runs["1w"]).toBeNull();
    expect(btc.timeframes["1h"]).toMatchObject({
      id: "1h-btc",
      symbol: "BTCUSDT",
      groupCode: "GR_501",
      actionCode: "AC_501",
      setupCode: "TR_601",
      scanTime: "2026-05-31T00:00:01.000Z",
    });
    expectPublicScannerCodeContract(btc.timeframes["1h"]);
    expect(btc.timeframes["4h"]).toMatchObject({ id: "4h-btc" });
    expectPublicScannerCodeContract(btc.timeframes["4h"]);
    expect(btc.timeframes["1d"]).toBeNull();
    expect(btc.timeframes["1w"]).toBeNull();
    expect(sei.timeframes["1d"]).toMatchObject({
      id: "1d-sei",
      groupCode: "GR_301",
    });
    expectPublicScannerCodeContract(sei.timeframes["1d"]);
    expect(eth.timeframes["1h"]).toBeNull();
    expect(eth.timeframes["4h"]).toMatchObject({ id: "4h-eth" });
    expectPublicScannerCodeContract(eth.timeframes["4h"]);
    expect(getLatestRankingRunMock).toHaveBeenNthCalledWith(1, {
      timeframe: "1h",
      assetClass: "crypto",
      preferFullUniverse: true,
      minExpectedSymbols: 300,
    });
    expect(getLatestRankingRunMock).toHaveBeenNthCalledWith(4, {
      timeframe: "1w",
      assetClass: "crypto",
      preferFullUniverse: true,
      minExpectedSymbols: 300,
    });
    expect(listLatestRankingSignalsForRunMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ timeframe: "1w" }),
    );
    expect(listLatestRankingSignalsForRunMock).toHaveBeenCalledWith({
      scanRunId: "full-1h",
      timeframe: "1h",
      assetClass: "crypto",
      includeNonScanner: false,
      includeMarketContext: false,
      includeCoverage: false,
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
    expect(body.latest.signal.groupCode).toBe("GR_501");
    expect(body.latest.signal.actionCode).toBe("AC_501");
    expectPublicScannerCodeContract(body.latest.signal);
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
      groupCode: "GR_501",
      actionCode: "AC_501",
      setupCode: "TR_601",
    });
    expect(body.history).toHaveLength(1);
    expectPublicScannerCodeContract(body.history[0]);
    expect(body.timeframes).toHaveLength(2);
    expectPublicScannerCodeContract(body.timeframes[0]);
    expectPublicScannerCodeContract(body.timeframes[1]);
    expect(body.candles).toMatchObject({
      timeframe: "4h",
      count: 2,
      firstOpenTime: "1970-01-01T00:00:01.000Z",
      lastOpenTime: "1970-01-01T00:00:02.000Z",
    });
    expect(body.behavior).toMatchObject({
      sampleSize: 12,
      currentContext: {
        signalLabel: "confirmed",
        resultGroup: "eligible",
        primaryStructure: "strong_trend",
        timeframe: "4h",
      },
    });
    expect(body.behavior.horizons["1"]).toMatchObject({
      sampleSize: 11,
      avgReturnPct: 1.2,
    });
    expect(body.behaviorDiagnostics).toEqual({
      available: true,
      reason: "ok",
      message:
        "Historical behavior is available from prior ranking results with forward candles.",
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
    expect(getSymbolLatestSignalsByTimeframesPgMock).toHaveBeenCalledWith({
      exchange: "binance",
      market: "spot",
      symbol: "SEIUSDT",
      timeframes: ["4h", "1h", "1d", "1w", "1M"],
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
      expect(body.behavior).toBeNull();
      expect(body.behaviorDiagnostics).toEqual({
        available: false,
        reason: "calculation_failed",
        message:
          "Historical behavior is not available because the behavior calculation failed.",
      });
      expect(warnSpy).toHaveBeenCalledWith(
        "trade-api symbol behavior unavailable:",
        "BEHAVIOR_FAILED",
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("returns requested timeframe metadata for hourly, daily, and weekly symbol research", async () => {
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
    const hourlyResponse = await requestTradeApi(
      "/api/symbol/research?exchange=binance&symbol=SEIUSDT&timeframe=1h",
    );
    const dailyBody = JSON.parse(dailyResponse.body);
    const weeklyBody = JSON.parse(weeklyResponse.body);
    const hourlyBody = JSON.parse(hourlyResponse.body);

    expect(dailyResponse.status).toBe(200);
    expect(dailyBody.timeframe).toBe("1d");
    expect(dailyBody.latest.signal).toMatchObject({
      id: "signal-1d",
      timeframe: "1d",
      isSelectedCurrentRun: true,
      sourceRunIsLikelyFullUniverse: true,
    });
    expectPublicScannerCodeContract(dailyBody.latest.signal);
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
    expectPublicScannerCodeContract(weeklyBody.latest.signal);
    expect(weeklyBody.candles).toMatchObject({ timeframe: "1w", count: 2 });
    expect(weeklyBody.candles.rows.every((row: { timeframe: string }) => row.timeframe === "1w")).toBe(
      true,
    );
    expect(hourlyResponse.status).toBe(200);
    expect(hourlyBody.timeframe).toBe("1h");
    expect(hourlyBody.latest.signal).toMatchObject({
      id: "signal-1h",
      timeframe: "1h",
      isSelectedCurrentRun: true,
      sourceRunIsLikelyFullUniverse: true,
    });
    expectPublicScannerCodeContract(hourlyBody.latest.signal);
    expect(hourlyBody.candles).toMatchObject({ timeframe: "1h", count: 2 });
    expect(hourlyBody.candles.rows.every((row: { timeframe: string }) => row.timeframe === "1h")).toBe(
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
    expect(body.latest.signal.groupCode).toBe("GR_301");
    expectPublicScannerCodeContract(body.latest.signal);
    expect(body.history[0]).toMatchObject({
      id: "newer-limited",
      isSelectedCurrentRun: false,
      isNewerThanSelectedCurrentRun: true,
      sourceRunIsLikelyFullUniverse: false,
    });
    expectPublicScannerCodeContract(body.history[0]);
    expect(body.history[1]).toMatchObject({
      id: "selected-risk",
      isSelectedCurrentRun: true,
      isNewerThanSelectedCurrentRun: false,
    });
    expectPublicScannerCodeContract(body.history[1]);
    expect(body.timeframes[0]).toMatchObject({
      id: "newer-limited",
      isNewerThanSelectedCurrentRun: true,
      sourceRunIsLikelyFullUniverse: false,
    });
    expectPublicScannerCodeContract(body.timeframes[0]);
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
    expect(body.behavior).toBeNull();
    expect(body.behaviorDiagnostics).toEqual({
      available: false,
      reason: "no_latest_signal",
      message:
        "Historical behavior is unavailable because no latest ranking result exists for this symbol/timeframe.",
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
        "No 1w ranking result for SEIUSDT. The latest full-universe 1w ranking run completed and skipped 221 symbols, and SEIUSDT was skipped because it has only 145 weekly candles. VegaRank currently requires 200 candles.",
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
    expect(body.behavior).toBeNull();
    expect(body.behaviorDiagnostics).toEqual({
      available: false,
      reason: "no_latest_signal",
      message:
        "Historical behavior is unavailable because no latest ranking result exists for this symbol/timeframe.",
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
  getLatestRankingRunMock.mockReset();
  getLatestRankingRunMock.mockResolvedValue(null);
  listLatestRankingSignalsForRunMock.mockReset();
  listLatestRankingSignalsForRunMock.mockResolvedValue([]);
  listScanRunsMock.mockReset();
  listScanRunsMock.mockResolvedValue([]);
  listHistoricalScanRunsMock.mockReset();
  listHistoricalScanRunsMock.mockResolvedValue([]);
  getHistoricalScanRunMock.mockReset();
  getHistoricalScanRunMock.mockResolvedValue(null);
  getHistoricalSnapshotObservationsMock.mockReset();
  getHistoricalSnapshotObservationsMock.mockResolvedValue({ run: null, rows: [] });
  listHistoricalSnapshotObservationsForRunMock.mockReset();
  listHistoricalSnapshotObservationsForRunMock.mockResolvedValue([]);
  getHistoricalObservationMarketCandleCoverageMock.mockReset();
  getHistoricalObservationMarketCandleCoverageMock.mockResolvedValue(
    makeObservationCoverage(),
  );
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
  getSymbolBehaviorPgMock.mockResolvedValue({
    behavior: null,
    behaviorDiagnostics: {
      available: false,
      reason: "no_prior_signals",
      message:
        "Historical behavior is not available yet because no prior ranking results were found for this symbol/timeframe.",
    },
  });
  closeSymbolResearchMock.mockReset();
  closeSymbolResearchMock.mockResolvedValue(undefined);
  pgSymbolResearchStoreMock.mockClear();
}

function resetSignalEvaluationMocks() {
  getSignalEvaluationPgMock.mockReset();
  getSignalEvaluationPgMock.mockResolvedValue(makeSignalEvaluationResponse());
  closeSignalEvaluationMock.mockReset();
  closeSignalEvaluationMock.mockResolvedValue(undefined);
  pgSignalEvaluationStoreMock.mockClear();
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
  const readableSignalLabel = overrides.signalLabel ?? "confirmed";
  const readableActionBias = overrides.actionBias ?? "eligible";
  const readablePrimaryStructure = overrides.primaryStructure ?? "strong_trend";
  const riskCodes = (overrides.detectedRiskTypes ?? []).map((risk) =>
    typeof risk === "string"
      ? riskCodeByType[risk as keyof typeof riskCodeByType] ?? risk
      : "RK_201",
  );
  const signalCode =
    signalCodeByLabel[readableSignalLabel as keyof typeof signalCodeByLabel] ??
    readableSignalLabel ??
    "NX_801";
  const actionCode =
    actionCodeByBias[readableActionBias as keyof typeof actionCodeByBias] ??
    readableActionBias ??
    "NX_801";
  const setupCode =
    setupCodeByAliasOrStructure[
      readablePrimaryStructure as keyof typeof setupCodeByAliasOrStructure
    ] ??
    readablePrimaryStructure ??
    "NX_801";
  const groupCode = getFixtureGroupCode({
    signalLabel: readableSignalLabel,
    actionBias: readableActionBias,
    primaryStructure: readablePrimaryStructure,
    riskCodes,
  });
  const codeContract = {
    groupCode,
    actionCode,
    riskCode: riskCodes[0] ?? null,
    riskCodes,
    setupCode,
    phaseCode: setupCode,
    reasonCodes: riskCodes,
    signalCodes: [signalCode],
    qualityCodes: [],
    scannerVersion: scannerCodeVersions.scannerVersion,
    codeSchemaVersion: scannerCodeVersions.codeSchemaVersion,
    dictionaryVersion: scannerCodeVersions.dictionaryVersion,
  };

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
    signalLabel: signalCode,
    actionBias: actionCode,
    primaryStructure: setupCode,
    groupCode,
    actionCode,
    riskCode: riskCodes[0] ?? null,
    riskCodes,
    setupCode,
    phaseCode: setupCode,
    reasonCodes: riskCodes,
    signalCodes: [signalCode],
    qualityCodes: [],
    codeSchemaVersion: scannerCodeVersions.codeSchemaVersion,
    dictionaryVersion: scannerCodeVersions.dictionaryVersion,
    secondaryStructures: [],
    detectedRiskTypes: riskCodes,
    factors: codeContract,
    nextConfirmation: ["Hold above latest range"],
    invalidation: ["Loses recent support"],
    rawMetrics: { codeContract },
    scoringVersion: "test",
    scannerVersion: scannerCodeVersions.scannerVersion,
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

function makeObservationRecord(
  overrides: NonNullable<Parameters<typeof makeResearchSignal>[0]> &
    Partial<{
      anchorTime: string | null;
      anchorClose: number | null;
      anchorSource: "stored_signal" | "nearest_prior_candle" | "unavailable";
      window: 1 | 3 | 5 | 10;
      observedClose: number | null;
      observedChangePct: number | null;
      maxDrawdownPct: number | null;
      dataStatus: "complete" | "partial" | "missing";
      missingReason:
        | "missing_anchor"
        | "no_future_candles"
        | "insufficient_future_candles"
        | null;
      forwardCandlesAvailable: number;
    }> = {},
) {
  return {
    ...makeResearchSignal(overrides),
    anchorTime: overrides.anchorTime ?? "2026-05-31T00:00:00.000Z",
    anchorClose: overrides.anchorClose ?? 100,
    anchorSource: overrides.anchorSource ?? "stored_signal",
    window: overrides.window ?? 3,
    observedClose: overrides.observedClose ?? 102.5,
    observedChangePct: overrides.observedChangePct ?? 2.5,
    maxDrawdownPct: overrides.maxDrawdownPct ?? -1.25,
    dataStatus: overrides.dataStatus ?? "complete",
    missingReason: overrides.missingReason ?? null,
    forwardCandlesAvailable: overrides.forwardCandlesAvailable ?? 3,
  };
}

function getFixtureGroupCode({
  signalLabel,
  actionBias,
  primaryStructure,
  riskCodes,
}: {
  signalLabel: string | null;
  actionBias: string | null;
  primaryStructure: string | null;
  riskCodes: string[];
}) {
  if (
    actionBias === "avoid" ||
    signalLabel === "breakdown_risk" ||
    signalLabel === "distribution_risk" ||
    primaryStructure === "trend_breakdown" ||
    primaryStructure === "distribution_risk" ||
    riskCodes.length > 0
  ) {
    return groupCodeByResultGroup.risk;
  }

  if (
    actionBias === "do_not_chase" ||
    signalLabel === "overheated" ||
    primaryStructure === "overextended"
  ) {
    return groupCodeByResultGroup.overheated;
  }

  if (
    actionBias === "eligible" &&
    (signalLabel === "confirmed" || signalLabel === "trend") &&
    primaryStructure !== "neutral"
  ) {
    return groupCodeByResultGroup.eligible;
  }

  if (
    actionBias === "eligible" ||
    actionBias === "watch_only" ||
    signalLabel === "watch" ||
    signalLabel === "weak_bounce"
  ) {
    return groupCodeByResultGroup.watch;
  }

  return groupCodeByResultGroup.neutral;
}

function makeObservationCoverage(
  overrides: Partial<{
    timeframe: string;
    totalSymbols: number;
    symbolsWithCandles: number;
    latestOpenTime: string | null;
    latestOpenTimeSymbolCount: number;
    buckets: Array<{ latestOpenTime: string | null; symbolCount: number }>;
  }> = {},
) {
  return {
    timeframe: overrides.timeframe ?? "4h",
    assetClass: "crypto" as const,
    totalSymbols: overrides.totalSymbols ?? 413,
    symbolsWithCandles: overrides.symbolsWithCandles ?? 413,
    latestOpenTime:
      overrides.latestOpenTime ?? "2026-06-02T12:00:00.000Z",
    latestOpenTimeSymbolCount: overrides.latestOpenTimeSymbolCount ?? 413,
    buckets: overrides.buckets ?? [
      {
        latestOpenTime: overrides.latestOpenTime ?? "2026-06-02T12:00:00.000Z",
        symbolCount: overrides.latestOpenTimeSymbolCount ?? 413,
      },
    ],
  };
}

const scannerCodePattern = /^(GR|QH|VL|PX|MO|TR|VO|RK|ST|AC|NX)_\d{3}$/;
const legacyScannerResultFields = [
  "group",
  "resultGroup",
  "signalLabel",
  "action",
  "actionBias",
  "setupType",
  "primaryStructure",
  "detectedRiskTypes",
  "factors",
  "rawMetrics",
  "observations",
  "reviewReason",
  "reviewStatus",
  "reviewTier",
  "statusNote",
  "statusNoteKey",
  "statusReasons",
  "statusReasonKeys",
  "nextConfirmation",
  "invalidation",
] as const;

function expectPublicScannerCodeContract(item: Record<string, unknown>) {
  for (const field of legacyScannerResultFields) {
    expect(item).not.toHaveProperty(field);
  }

  expectCodeValue(item.groupCode);
  expectCodeValue(item.actionCode);
  expectNullableCodeValue(item.riskCode);
  expectCodeValue(item.setupCode);
  expectCodeValue(item.phaseCode);
  expectCodeArray(item.riskCodes);
  expectCodeArray(item.reasonCodes);
  expectCodeArray(item.signalCodes);
  expectCodeArray(item.qualityCodes);
  expect(item.metrics).toBeTruthy();
  expect(typeof item.scannerVersion).toBe("string");
  expect(typeof item.codeSchemaVersion).toBe("string");
  expect(typeof item.dictionaryVersion).toBe("string");
}

function expectCodeValue(value: unknown) {
  expect(typeof value).toBe("string");
  expect(value).toMatch(scannerCodePattern);
}

function expectNullableCodeValue(value: unknown) {
  if (value === null) {
    return;
  }

  expectCodeValue(value);
}

function expectCodeArray(value: unknown) {
  expect(Array.isArray(value)).toBe(true);

  for (const code of value as unknown[]) {
    expect(code).not.toBeUndefined();
    expectCodeValue(code);
  }
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
    behavior: {
      sampleSize: 12,
      horizons: {
        "1": {
          sampleSize: 11,
          avgReturnPct: 1.2,
          medianReturnPct: 0.8,
          winRatePct: 63.6,
          bestReturnPct: 5.3,
          worstReturnPct: -3.2,
        },
        "3": {
          sampleSize: 11,
          avgReturnPct: 2.2,
          medianReturnPct: 1.8,
          winRatePct: 72.7,
          bestReturnPct: 8.3,
          worstReturnPct: -4.2,
        },
        "5": {
          sampleSize: 11,
          avgReturnPct: 3.2,
          medianReturnPct: 2.8,
          winRatePct: 72.7,
          bestReturnPct: 10.3,
          worstReturnPct: -6.2,
        },
      },
      byResultGroup: [],
      bySignalLabel: [],
      recentOutcomes: [],
      currentContext: {
        signalLabel: "confirmed",
        resultGroup: "eligible",
        primaryStructure: "strong_trend",
        timeframe: "4h",
      },
      warnings: [],
    },
    behaviorDiagnostics: {
      available: true,
      reason: "ok",
      message:
        "Historical behavior is available from prior ranking results with forward candles.",
    },
  };
}

function makeSignalEvaluationResponse(
  overrides: Partial<{
    filters: {
      assetClass: string;
      exchange: string;
      market: string;
      timeframe: string;
      symbol: string | null;
      group: string | null;
      signalLabel: string | null;
      primaryStructure: string | null;
      setupType: string | null;
      horizons: number[];
    };
    expectedDirection: string;
  }> = {},
) {
  return {
    ok: true,
    filters: overrides.filters ?? {
      assetClass: "crypto",
      exchange: "binance",
      market: "spot",
      timeframe: "4h",
      symbol: null,
      group: null,
      signalLabel: null,
      primaryStructure: null,
      setupType: null,
      horizons: [1, 3, 5, 10],
    },
    sample: {
      sourceSignals: 0,
      completedSignals: 0,
      skippedSignals: 0,
      sampleQuality: "none",
      warnings: ["insufficient_completed_horizons"],
    },
    expectedDirection: overrides.expectedDirection ?? "none",
    horizons: {
      "1": makeSignalEvaluationHorizon(),
      "3": makeSignalEvaluationHorizon(),
      "5": makeSignalEvaluationHorizon(),
      "10": makeSignalEvaluationHorizon(),
    },
    interpretation: {
      summary:
        "No completed historical follow-through sample is available for these filters.",
      confidence: "none",
      researchOnly: true,
    },
    breakdowns: {
      byGroup: [],
      bySignalLabel: [],
      byPrimaryStructure: [],
    },
  };
}

function makeSignalEvaluationHorizon() {
  return {
    sampleSize: 0,
    avgReturnPct: null,
    medianReturnPct: null,
    positiveRatePct: null,
    directionMatchRatePct: null,
    bestReturnPct: null,
    worstReturnPct: null,
  };
}
