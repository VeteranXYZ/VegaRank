import http from "node:http";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import Redis from "ioredis";
import {
  getSymbolQuality,
  isSymbolAssetClassFilter,
  type SymbolAssetClassFilter,
} from "@/lib/market-data/symbolClassification";
import {
  MARKET_CONTEXT_SYMBOLS,
  MARKET_CONTEXT_TIMEFRAMES,
  buildMarketContextResponse,
  createUnavailableMarketContextProxy,
  type AvailableMarketContextProxy,
  type MarketContextProxyMap,
  type MarketContextRunContext,
  type MarketContextTimeframe,
} from "@/lib/market-context/marketContext";
import { buildLatestScanResponse } from "@/lib/scanner/latestScanResponse";
import {
  classifyScanResultGroup,
  compareScanResultGroupItems,
  getScanResultReview,
  type ScanResultGroup,
} from "@/lib/scanner/scanResultGroups";
import { PgMarketDataStore } from "@/lib/storage/postgres/marketDataPg";
import {
  HISTORICAL_SNAPSHOT_OBSERVATION_WINDOWS,
  LATEST_SCAN_FULL_UNIVERSE_MIN_SYMBOLS,
  PgScannerResultsStore,
  isLikelyFullUniverseRun,
  normalizeHistoricalSnapshotObservationWindow,
  type HistoricalObservationMarketCandleCoverage,
  type HistoricalSnapshotObservationRecord,
  type HistoricalSnapshotObservationWindow,
  type LatestScanSignalRecord,
  type ScanRunRecord,
} from "@/lib/storage/postgres/scannerResultsPg";
import {
  PgSymbolResearchStore,
  type SymbolResearchCandleCoverageRecord,
  type SymbolResearchCandleRecord,
  type SymbolResearchSignalRecord,
} from "@/lib/storage/postgres/symbolResearchPg";
import {
  PgSignalEvaluationStore,
  SIGNAL_EVALUATION_DEFAULT_HORIZONS,
  SIGNAL_EVALUATION_DEFAULT_LIMIT,
  SIGNAL_EVALUATION_DEFAULT_MIN_SAMPLES,
  SIGNAL_EVALUATION_GROUPS,
  SIGNAL_EVALUATION_MAX_HORIZON,
  SIGNAL_EVALUATION_MAX_LIMIT,
  type SignalEvaluationGroup,
} from "@/lib/storage/postgres/signalEvaluationPg";

type ServiceCheck = {
  ok: boolean;
  code?: string;
  message?: string;
};

type StatusResponse = {
  ok: boolean;
  service: "trade-api";
  postgres: ServiceCheck;
  redis: ServiceCheck;
};

const serviceName = "trade-api" as const;
const defaultHost = "127.0.0.1";
const defaultPort = "3000";
const SYMBOL_RESEARCH_REQUIRED_CANDLES = 200;
const MTF_LATEST_TIMEFRAMES = ["1h", "4h", "1d", "1w"] as const;
const SIGNAL_EVALUATION_TIMEFRAMES = ["1h", "4h", "1d", "1w"] as const;
const HISTORY_SNAPSHOT_TIMEFRAMES = ["1h", "4h", "1d", "1w"] as const;
const HISTORY_RESEARCH_DISCLAIMER =
  "Research-only. Not financial advice. Historical observations are not predictions.";
const HISTORY_OBSERVATION_READINESS_CANDIDATE_LIMIT = 25;
const allowedOrigins = new Set([
  "https://s.bitcoinmind.com",
  "http://localhost:3000",
]);

type MtfLatestTimeframe = (typeof MTF_LATEST_TIMEFRAMES)[number];
type MtfLatestSignalItem = ReturnType<typeof buildMtfLatestSignalItem>;
type MtfLatestTimeframeMap<T> = Record<MtfLatestTimeframe, T>;
type SignalEvaluationTimeframe = (typeof SIGNAL_EVALUATION_TIMEFRAMES)[number];
type HistorySnapshotTimeframe = (typeof HISTORY_SNAPSHOT_TIMEFRAMES)[number];
type MtfLatestRunMetadata = Pick<
  ScanRunRecord,
  | "id"
  | "timeframe"
  | "status"
  | "symbolsTotal"
  | "symbolsScanned"
  | "symbolsSkipped"
  | "signalsCreated"
  | "startedAt"
  | "finishedAt"
> & {
  isLikelyFullUniverse: boolean;
  latestRunSelection: ReturnType<typeof buildLatestRunSelectionMetadata>;
};
type HistoryObservationReadinessState =
  | "ready"
  | "not_ready"
  | "unavailable";
type HistoryObservationReadinessBlocker =
  | "observable"
  | "time_maturity"
  | "market_data_coverage"
  | "mixed"
  | "unavailable"
  | "no_runs";
type HistoryObservationRunAssessment = {
  run: ScanRunRecord;
  state: HistoryObservationReadinessState;
  blocker: HistoryObservationReadinessBlocker;
  isObservable: boolean;
  isLimited: boolean;
  rowCount: number;
  completeCount: number;
  partialCount: number;
  missingCount: number;
  dominantMissingReason: string | null;
  dominantMissingReasonCount: number;
  latestAnchorTime: string | null;
  expectedCompleteTime: string | null;
};

export function createTradeApiServer() {
  return http.createServer(handleTradeApiRequest);
}

export async function handleTradeApiRequest(
  request: http.IncomingMessage,
  response: http.ServerResponse,
) {
  setCorsHeaders(response, getCorsHeaders(request));

  try {
    const url = new URL(
      request.url ?? "/",
      `http://${request.headers.host ?? defaultHost}`,
    );

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    if (request.method !== "GET") {
      sendJson(response, 405, {
        ok: false,
        service: serviceName,
        error: "METHOD_NOT_ALLOWED",
      });
      return;
    }

    if (url.pathname === "/health") {
      sendJson(response, 200, { ok: true, service: serviceName });
      return;
    }

    if (url.pathname === "/api/status") {
      const [postgres, redis] = await Promise.all([
        checkPostgres(),
        checkRedis(),
      ]);
      const payload: StatusResponse = {
        ok: postgres.ok && redis.ok,
        service: serviceName,
        postgres,
        redis,
      };

      sendJson(response, payload.ok ? 200 : 503, payload);
      return;
    }

    if (url.pathname === "/api/symbols/summary") {
      await handleSymbolsSummary(response);
      return;
    }

    if (url.pathname === "/api/symbols") {
      await handleSymbols(response, url);
      return;
    }

    if (url.pathname === "/api/candles") {
      await handleCandles(response, url);
      return;
    }

    if (url.pathname === "/api/symbol/research") {
      await handleSymbolResearch(response, url);
      return;
    }

    if (url.pathname === "/api/signal/evaluation") {
      await handleSignalEvaluation(response, url);
      return;
    }

    if (url.pathname === "/api/market/context") {
      await handleMarketContext(response, url);
      return;
    }

    if (url.pathname === "/api/market-sync/jobs") {
      await handleMarketSyncJobs(response, url);
      return;
    }

    if (url.pathname === "/api/market-data/coverage") {
      await handleMarketDataCoverage(response, url);
      return;
    }

    if (url.pathname === "/api/scan/latest") {
      await handleLatestScan(response, url);
      return;
    }

    if (url.pathname === "/api/scan/mtf-latest") {
      await handleMtfLatestScan(response, url);
      return;
    }

    if (url.pathname === "/api/history/snapshots") {
      await handleHistorySnapshots(response, url);
      return;
    }

    if (url.pathname === "/api/history/snapshot") {
      await handleHistorySnapshot(response, url);
      return;
    }

    if (url.pathname === "/api/history/observation-readiness") {
      await handleHistoryObservationReadiness(response, url);
      return;
    }

    if (url.pathname === "/api/history/snapshot-observations") {
      await handleHistorySnapshotObservations(response, url);
      return;
    }

    if (url.pathname === "/api/scan/runs") {
      await handleScanRuns(response, url);
      return;
    }

    sendJson(response, 404, {
      ok: false,
      service: serviceName,
      error: "NOT_FOUND",
    });
  } catch {
    sendJson(response, 500, {
      ok: false,
      service: serviceName,
      error: "INTERNAL_ERROR",
    });
  }
}

export function startTradeApiServer() {
  loadDotEnv();

  const host = process.env.API_HOST ?? defaultHost;
  const port = parsePort(process.env.PORT ?? defaultPort);
  const server = createTradeApiServer();

  server.on("error", (error) => {
    const code = getSafeErrorCode(error) ?? "SERVER_LISTEN_FAILED";
    console.error(`${serviceName} failed to start: ${code}`);
    process.exitCode = 1;
  });

  server.listen(port, host, () => {
    console.info(`${serviceName} listening on http://${host}:${port}`);
  });

  return server;
}

if (isTradeApiEntrypoint()) {
  startTradeApiServer();
}

async function checkPostgres(): Promise<ServiceCheck> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return {
      ok: false,
      code: "DATABASE_URL_MISSING",
      message: "PostgreSQL connection is not configured.",
    };
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 2_000,
    idleTimeoutMillis: 1_000,
    max: 1,
  });

  try {
    await pool.query("select 1");
    return { ok: true };
  } catch (error) {
    return sanitizeConnectionError(error, "POSTGRES_UNAVAILABLE");
  } finally {
    await pool.end().catch(() => undefined);
  }
}

async function checkRedis(): Promise<ServiceCheck> {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    return {
      ok: false,
      code: "REDIS_URL_MISSING",
      message: "Redis connection is not configured.",
    };
  }

  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    connectTimeout: 2_000,
    commandTimeout: 2_000,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
  });

  redis.on("error", () => undefined);

  try {
    await redis.connect();
    await redis.ping();
    return { ok: true };
  } catch (error) {
    return sanitizeConnectionError(error, "REDIS_UNAVAILABLE");
  } finally {
    redis.disconnect();
  }
}

async function handleSymbols(response: http.ServerResponse, url: URL) {
  const limit = parseBoundedInteger({
    value: url.searchParams.get("limit"),
    fallback: 500,
    min: 1,
    max: 1000,
    name: "limit",
  });

  if (!limit.valid) {
    sendJson(response, 400, { ok: false, service: serviceName, error: limit.error });
    return;
  }

  const store = new PgMarketDataStore();

  try {
    const symbols = await store.listSymbols({ limit: limit.value });

    sendJson(response, 200, {
      ok: true,
      service: serviceName,
      source: "postgres",
      symbols,
      itemCount: symbols.length,
    });
  } catch (error) {
    sendJson(response, 503, {
      ok: false,
      service: serviceName,
      source: "postgres",
      error: sanitizeConnectionError(error, "POSTGRES_UNAVAILABLE"),
    });
  } finally {
    await store.close().catch(() => undefined);
  }
}

async function handleSymbolsSummary(response: http.ServerResponse) {
  const store = new PgMarketDataStore();

  try {
    const summary = await store.getSymbolsSummary();

    sendJson(response, 200, {
      ok: true,
      service: serviceName,
      source: "postgres",
      ...summary,
    });
  } catch (error) {
    sendJson(response, 503, {
      ok: false,
      service: serviceName,
      source: "postgres",
      error: sanitizeConnectionError(error, "POSTGRES_UNAVAILABLE"),
    });
  } finally {
    await store.close().catch(() => undefined);
  }
}

async function handleCandles(response: http.ServerResponse, url: URL) {
  const symbol = url.searchParams.get("symbol")?.trim().toUpperCase() ?? "";
  const timeframe = url.searchParams.get("timeframe")?.trim() ?? "";
  const limit = parseBoundedInteger({
    value: url.searchParams.get("limit"),
    fallback: 100,
    min: 1,
    max: 1000,
    name: "limit",
  });

  if (!/^[A-Z0-9]{5,30}$/.test(symbol)) {
    sendJson(response, 400, {
      ok: false,
      service: serviceName,
      error: "INVALID_SYMBOL",
    });
    return;
  }

  if (!/^[A-Za-z0-9]{1,8}$/.test(timeframe)) {
    sendJson(response, 400, {
      ok: false,
      service: serviceName,
      error: "INVALID_TIMEFRAME",
    });
    return;
  }

  if (!limit.valid) {
    sendJson(response, 400, { ok: false, service: serviceName, error: limit.error });
    return;
  }

  const store = new PgMarketDataStore();

  try {
    const candles = await store.listCandles({
      symbol,
      timeframe,
      limit: limit.value,
    });

    sendJson(response, 200, {
      ok: true,
      service: serviceName,
      source: "postgres",
      symbol,
      timeframe,
      candles,
      itemCount: candles.length,
    });
  } catch (error) {
    sendJson(response, 503, {
      ok: false,
      service: serviceName,
      source: "postgres",
      error: sanitizeConnectionError(error, "POSTGRES_UNAVAILABLE"),
    });
  } finally {
    await store.close().catch(() => undefined);
  }
}

async function handleSymbolResearch(response: http.ServerResponse, url: URL) {
  const exchange = normalizeIdentityParam(
    url.searchParams.get("exchange"),
    "binance",
  );
  const market = normalizeIdentityParam(url.searchParams.get("market"), "spot");
  const symbolInput = url.searchParams.get("symbol")?.trim() ?? "";
  const symbol = symbolInput.toUpperCase();
  const timeframe = url.searchParams.get("timeframe")?.trim() ?? "4h";
  const assetClass = parseAssetClassParam(url.searchParams.get("assetClass"));
  const includeNonScanner = parseBooleanParam(url.searchParams.get("includeNonScanner"));
  const includeMarketContext = parseBooleanParam(
    url.searchParams.get("includeMarketContext"),
  );
  const includeCandles =
    url.searchParams.get("includeCandles") === null
      ? true
      : parseBooleanParam(url.searchParams.get("includeCandles"));
  const historyLimit = parseBoundedInteger({
    value: url.searchParams.get("historyLimit"),
    fallback: 30,
    min: 1,
    max: 100,
    name: "limit",
  });
  const candleLimit = parseBoundedInteger({
    value: url.searchParams.get("candleLimit"),
    fallback: 120,
    min: 1,
    max: 500,
    name: "limit",
  });

  if (!symbol || !/^[A-Z0-9]{2,30}$/.test(symbol)) {
    sendJson(response, 400, {
      ok: false,
      service: serviceName,
      error: "SYMBOL_REQUIRED",
    });
    return;
  }

  if (
    !exchange ||
    !market ||
    !/^[a-z0-9_-]{1,30}$/.test(exchange) ||
    !/^[a-z0-9_-]{1,30}$/.test(market)
  ) {
    sendJson(response, 404, {
      ok: false,
      service: serviceName,
      error: "SYMBOL_NOT_FOUND",
    });
    return;
  }

  if (!/^[A-Za-z0-9]{1,8}$/.test(timeframe)) {
    sendJson(response, 400, {
      ok: false,
      service: serviceName,
      error: "INVALID_TIMEFRAME",
    });
    return;
  }

  if (!assetClass.valid) {
    sendJson(response, 400, {
      ok: false,
      service: serviceName,
      error: "INVALID_ASSET_CLASS",
    });
    return;
  }

  if (!historyLimit.valid) {
    sendJson(response, 400, {
      ok: false,
      service: serviceName,
      error: historyLimit.error,
    });
    return;
  }

  if (!candleLimit.valid) {
    sendJson(response, 400, {
      ok: false,
      service: serviceName,
      error: candleLimit.error,
    });
    return;
  }

  const store = new PgSymbolResearchStore();

  try {
    const preferFullUniverse = shouldPreferFullUniverseLatestRun({
      assetClass: assetClass.value,
      includeNonScanner,
    });
    const latest = await store.getSymbolResearchLatestSignalPg({
      exchange,
      market,
      symbol,
      timeframe,
      assetClass: assetClass.value,
      includeNonScanner,
      includeMarketContext,
    });
    const currentSelection = buildSymbolResearchCurrentSelectionMetadata({
      run: latest.scanRun,
      signal: latest.signal,
      assetClass: assetClass.value,
      preferredFullUniverse: preferFullUniverse,
    });

    if (!latest.symbol) {
      sendJson(response, 404, {
        ok: false,
        service: serviceName,
        source: "postgres",
        error: "SYMBOL_NOT_FOUND",
      });
      return;
    }

    if (!latest.signal) {
      const unavailable = await buildSymbolResearchUnavailableMetadata({
        store,
        latest,
        exchange,
        market,
        symbol,
        timeframe,
        assetClass: assetClass.value,
        preferredFullUniverse: preferFullUniverse,
      });

      sendJson(response, 404, {
        ok: false,
        service: serviceName,
        source: "postgres",
        error: "NO_LATEST_SIGNAL",
        errorCode: "NO_LATEST_SIGNAL",
        unavailableReason: unavailable.unavailableReason,
        message: unavailable.message,
        timeframe,
        symbol: {
          exchange: latest.symbol.exchange,
          market: latest.symbol.market,
          symbol: latest.symbol.symbol,
          assetClass: latest.symbol.assetClass,
        },
        latest: {
          scanRun: latest.scanRun,
          signal: null,
        },
        currentSelection,
        selectedRun: unavailable.selectedRun,
        symbolCoverage: unavailable.symbolCoverage,
        behavior: null,
        behaviorDiagnostics: buildSymbolBehaviorDiagnostics({
          available: false,
          reason: "no_latest_signal",
          message:
            "Historical behavior is unavailable because no latest scanner signal exists for this symbol/timeframe.",
        }),
      });
      return;
    }

    const [historySignals, timeframeSignals, candles, behaviorResult] = await Promise.all([
      store.getSymbolSignalHistoryPg({
        exchange,
        market,
        symbol,
        timeframe,
        historyLimit: historyLimit.value,
        assetClass: assetClass.value,
        includeNonScanner,
        includeMarketContext,
      }),
      store.getSymbolLatestSignalsByTimeframesPg({
        exchange,
        market,
        symbol,
        timeframes: ["4h", "1h", "1d", "1w", "1M"],
        assetClass: assetClass.value,
        includeNonScanner,
        includeMarketContext,
      }),
      includeCandles
        ? store.getSymbolCandlesPg({
            exchange,
            market,
            symbol,
            timeframe,
            candleLimit: candleLimit.value,
          })
        : Promise.resolve([]),
      loadSymbolBehaviorSafely({
        store,
        exchange,
        market,
        symbol,
        timeframe,
        currentSignal: latest.signal,
        assetClass: assetClass.value,
        includeNonScanner,
        includeMarketContext,
      }),
    ]);
    const latestSignal = enrichSymbolResearchSignal(latest.signal, {
      currentSignal: latest.signal,
      assetClass: assetClass.value,
    });
    const quality = getSymbolQuality(latest.symbol.symbol, {
      assetClass: latest.symbol.assetClass,
      candleCount: latestSignal.candleCount,
      firstOpenTime: latestSignal.firstOpenTime,
    });

    sendJson(response, 200, {
      ok: true,
      service: serviceName,
      source: "postgres",
      timeframe,
      symbol: {
        exchange: latest.symbol.exchange,
        market: latest.symbol.market,
        symbol: latest.symbol.symbol,
        assetClass: latest.symbol.assetClass,
        qualityTier: quality.qualityTier,
        isLowQuality: quality.isLowQuality,
        qualityFlags: quality.qualityFlags,
      },
      latest: {
        scanRun: latest.scanRun,
        signal: latestSignal,
      },
      currentSelection,
      scoreBreakdown: buildSymbolResearchScoreBreakdown(latestSignal),
      interpretation: buildSymbolResearchInterpretation(latestSignal),
      history: historySignals.map((signal) =>
        enrichSymbolResearchSignal(signal, {
          currentSignal: latest.signal,
          assetClass: assetClass.value,
        }),
      ),
      timeframes: timeframeSignals.map((signal) =>
        enrichSymbolResearchSignal(signal, {
          currentSignal: latest.signal,
          assetClass: assetClass.value,
        }),
      ),
      behavior: behaviorResult.behavior,
      behaviorDiagnostics: behaviorResult.behaviorDiagnostics,
      candles: buildSymbolResearchCandlesPayload({ timeframe, candles }),
    });
  } catch {
    sendJson(response, 503, {
      ok: false,
      service: serviceName,
      source: "postgres",
      error: "INTERNAL_ERROR",
    });
  } finally {
    await store.close().catch(() => undefined);
  }
}

async function handleSignalEvaluation(response: http.ServerResponse, url: URL) {
  const exchange = normalizeIdentityParam(
    url.searchParams.get("exchange"),
    "binance",
  );
  const market = normalizeIdentityParam(url.searchParams.get("market"), "spot");
  const timeframe = url.searchParams.get("timeframe")?.trim() ?? "4h";
  const assetClass = parseAssetClassParam(url.searchParams.get("assetClass"));
  const symbolInput = url.searchParams.get("symbol")?.trim() ?? "";
  const symbol = symbolInput ? symbolInput.toUpperCase() : null;
  const group = parseSignalEvaluationGroupParam(url.searchParams.get("group"));
  const signalLabel = parseOptionalTokenParam(
    url.searchParams.get("signalLabel"),
    "INVALID_SIGNAL_LABEL",
  );
  const primaryStructure = parseOptionalTokenParam(
    url.searchParams.get("primaryStructure"),
    "INVALID_PRIMARY_STRUCTURE",
  );
  const setupType = parseOptionalTokenParam(
    url.searchParams.get("setupType"),
    "INVALID_SETUP_TYPE",
  );
  const horizons = parseSignalEvaluationHorizonsParam(
    url.searchParams.get("horizons"),
  );
  const minSamples = parseBoundedInteger({
    value: url.searchParams.get("minSamples"),
    fallback: SIGNAL_EVALUATION_DEFAULT_MIN_SAMPLES,
    min: 1,
    max: 1000,
    name: "minSamples",
  });
  const limit = parseBoundedInteger({
    value: url.searchParams.get("limit"),
    fallback: SIGNAL_EVALUATION_DEFAULT_LIMIT,
    min: 1,
    max: SIGNAL_EVALUATION_MAX_LIMIT,
    name: "limit",
  });
  const includeBreakdowns =
    url.searchParams.get("includeBreakdowns") === null
      ? true
      : parseBooleanParam(url.searchParams.get("includeBreakdowns"));

  if (!assetClass.valid) {
    sendJson(response, 400, {
      ok: false,
      service: serviceName,
      error: "INVALID_ASSET_CLASS",
    });
    return;
  }

  if (
    !exchange ||
    !market ||
    !/^[a-z0-9_-]{1,30}$/.test(exchange) ||
    !/^[a-z0-9_-]{1,30}$/.test(market)
  ) {
    sendJson(response, 400, {
      ok: false,
      service: serviceName,
      error: "INVALID_MARKET",
    });
    return;
  }

  if (!isSignalEvaluationTimeframe(timeframe)) {
    sendJson(response, 400, {
      ok: false,
      service: serviceName,
      error: "INVALID_TIMEFRAME",
    });
    return;
  }

  if (symbol !== null && !/^[A-Z0-9]{2,30}$/.test(symbol)) {
    sendJson(response, 400, {
      ok: false,
      service: serviceName,
      error: "INVALID_SYMBOL",
    });
    return;
  }

  if (!group.valid) {
    sendJson(response, 400, {
      ok: false,
      service: serviceName,
      error: "INVALID_GROUP",
    });
    return;
  }

  if (!signalLabel.valid) {
    sendJson(response, 400, {
      ok: false,
      service: serviceName,
      error: signalLabel.error,
    });
    return;
  }

  if (!primaryStructure.valid) {
    sendJson(response, 400, {
      ok: false,
      service: serviceName,
      error: primaryStructure.error,
    });
    return;
  }

  if (!setupType.valid) {
    sendJson(response, 400, {
      ok: false,
      service: serviceName,
      error: setupType.error,
    });
    return;
  }

  if (!horizons.valid) {
    sendJson(response, 400, {
      ok: false,
      service: serviceName,
      error: "INVALID_HORIZONS",
    });
    return;
  }

  if (!minSamples.valid) {
    sendJson(response, 400, {
      ok: false,
      service: serviceName,
      error: minSamples.error,
    });
    return;
  }

  if (!limit.valid) {
    sendJson(response, 400, {
      ok: false,
      service: serviceName,
      error: limit.error,
    });
    return;
  }

  const store = new PgSignalEvaluationStore();

  try {
    const evaluation = await store.getSignalEvaluationPg({
      assetClass: assetClass.value,
      exchange,
      market,
      timeframe,
      symbol,
      group: group.value,
      signalLabel: signalLabel.value,
      primaryStructure: primaryStructure.value,
      setupType: setupType.value,
      horizons: horizons.value,
      minSamples: minSamples.value,
      limit: limit.value,
      includeBreakdowns,
    });

    sendJson(response, 200, {
      ...evaluation,
      service: serviceName,
      source: "postgres",
    });
  } catch (error) {
    sendJson(response, 503, {
      ok: false,
      service: serviceName,
      source: "postgres",
      error: sanitizeConnectionError(error, "POSTGRES_UNAVAILABLE"),
    });
  } finally {
    await store.close().catch(() => undefined);
  }
}

async function handleMarketSyncJobs(response: http.ServerResponse, url: URL) {
  const limit = parseBoundedInteger({
    value: url.searchParams.get("limit"),
    fallback: 10,
    min: 1,
    max: 100,
    name: "limit",
  });

  if (!limit.valid) {
    sendJson(response, 400, { ok: false, service: serviceName, error: limit.error });
    return;
  }

  const store = new PgMarketDataStore();

  try {
    const jobs = await store.listMarketDataSyncJobs({ limit: limit.value });

    sendJson(response, 200, {
      ok: true,
      count: jobs.length,
      jobs,
    });
  } catch (error) {
    sendJson(response, 503, {
      ok: false,
      error: sanitizeConnectionError(error, "POSTGRES_UNAVAILABLE"),
    });
  } finally {
    await store.close().catch(() => undefined);
  }
}

async function handleMarketDataCoverage(response: http.ServerResponse, url: URL) {
  const timeframe = url.searchParams.get("timeframe")?.trim() ?? "4h";
  const assetClass = parseAssetClassParam(url.searchParams.get("assetClass"));
  const includeNonScanner = parseBooleanParam(url.searchParams.get("includeNonScanner"));
  const limit = parseBoundedInteger({
    value: url.searchParams.get("limit"),
    fallback: 100,
    min: 1,
    max: 500,
    name: "limit",
  });

  if (!/^[A-Za-z0-9]{1,8}$/.test(timeframe)) {
    sendJson(response, 400, {
      ok: false,
      service: serviceName,
      error: "INVALID_TIMEFRAME",
    });
    return;
  }

  if (!assetClass.valid) {
    sendJson(response, 400, {
      ok: false,
      service: serviceName,
      error: "INVALID_ASSET_CLASS",
    });
    return;
  }

  if (!limit.valid) {
    sendJson(response, 400, { ok: false, service: serviceName, error: limit.error });
    return;
  }

  const store = new PgMarketDataStore();

  try {
    const { rows, summary } = await store.listMarketDataCoverage({
      timeframe,
      limit: limit.value,
      assetClass: assetClass.value,
      includeNonScanner,
    });

    sendJson(response, 200, {
      ok: true,
      timeframe,
      assetClass: assetClass.value,
      includeNonScanner,
      itemCount: rows.length,
      summary,
      rows,
    });
  } catch (error) {
    sendJson(response, 503, {
      ok: false,
      timeframe,
      assetClass: assetClass.value,
      includeNonScanner,
      itemCount: 0,
      summary: {
        totalSymbols: 0,
        healthy: 0,
        belowMinimum: 0,
        stale: 0,
        scannerEligible: 0,
        marketContext: 0,
        byAssetClass: {
          crypto: 0,
          stable: 0,
          fiat: 0,
          gold: 0,
          special: 0,
        },
      },
      rows: [],
      error: sanitizeConnectionError(error, "POSTGRES_UNAVAILABLE"),
    });
  } finally {
    await store.close().catch(() => undefined);
  }
}

async function handleMarketContext(response: http.ServerResponse, url: URL) {
  const assetClass = parseAssetClassParam(url.searchParams.get("assetClass"));

  if (!assetClass.valid) {
    sendJson(response, 400, {
      ok: false,
      service: serviceName,
      error: "INVALID_ASSET_CLASS",
    });
    return;
  }

  if (assetClass.value !== "crypto") {
    sendJson(response, 400, {
      ok: false,
      service: serviceName,
      error: "UNSUPPORTED_ASSET_CLASS",
      assetClass: assetClass.value,
    });
    return;
  }

  const store = new PgScannerResultsStore();
  const preferFullUniverse = shouldPreferFullUniverseLatestRun({
    assetClass: assetClass.value,
    includeNonScanner: false,
  });

  try {
    const timeframeResults = await Promise.all(
      MARKET_CONTEXT_TIMEFRAMES.map(async (timeframe) => {
        const run = await store.getLatestScanRun({
          timeframe,
          assetClass: assetClass.value,
          preferFullUniverse,
          minExpectedSymbols: LATEST_SCAN_FULL_UNIVERSE_MIN_SYMBOLS,
        });

        if (!run) {
          return {
            timeframe,
            run: null,
            signals: [],
          };
        }

        const signals = await store.listLatestScanSignalsForRun({
          scanRunId: run.id,
          timeframe,
          assetClass: assetClass.value,
          includeNonScanner: false,
          includeMarketContext: false,
        });

        return {
          timeframe,
          run: buildMtfLatestRunMetadata({
            run,
            assetClass: assetClass.value,
            preferredFullUniverse: preferFullUniverse,
          }),
          signals,
        };
      }),
    );
    const proxies = createMarketContextProxyMap();

    for (const result of timeframeResults) {
      const runContext = getMarketContextRunContext(result.run);
      const signalsBySymbol = new Map(
        result.signals.map((signal) => [
          signal.symbol.trim().toUpperCase(),
          signal,
        ]),
      );

      for (const symbol of MARKET_CONTEXT_SYMBOLS) {
        const signal = signalsBySymbol.get(symbol);

        proxies[symbol][result.timeframe] = signal
          ? buildAvailableMarketContextProxy({
              signal,
              timeframe: result.timeframe,
              runContext,
            })
          : createUnavailableMarketContextProxy(
              result.timeframe,
              result.run ? "missing_symbol" : "no_latest_signal",
            );
      }
    }

    sendJson(response, 200, {
      ...buildMarketContextResponse({
        assetClass: assetClass.value,
        proxies,
      }),
      service: serviceName,
      source: "postgres",
    });
  } catch (error) {
    sendJson(response, 503, {
      ok: false,
      service: serviceName,
      source: "postgres",
      error: sanitizeConnectionError(error, "POSTGRES_UNAVAILABLE"),
    });
  } finally {
    await store.close().catch(() => undefined);
  }
}

async function handleLatestScan(response: http.ServerResponse, url: URL) {
  const timeframe = url.searchParams.get("timeframe")?.trim() ?? "4h";
  const assetClass = parseAssetClassParam(url.searchParams.get("assetClass"));
  const includeLowQuality = parseBooleanParam(url.searchParams.get("includeLowQuality"));
  const includeNonScanner = parseBooleanParam(url.searchParams.get("includeNonScanner"));
  const includeMarketContext = parseBooleanParam(
    url.searchParams.get("includeMarketContext"),
  );
  const limit = parseBoundedInteger({
    value: url.searchParams.get("limit"),
    fallback: 100,
    min: 1,
    max: 500,
    name: "limit",
  });

  if (!/^[A-Za-z0-9]{1,8}$/.test(timeframe)) {
    sendJson(response, 400, {
      ok: false,
      service: serviceName,
      error: "INVALID_TIMEFRAME",
    });
    return;
  }

  if (!assetClass.valid) {
    sendJson(response, 400, {
      ok: false,
      service: serviceName,
      error: "INVALID_ASSET_CLASS",
    });
    return;
  }

  if (!limit.valid) {
    sendJson(response, 400, { ok: false, service: serviceName, error: limit.error });
    return;
  }

  const store = new PgScannerResultsStore();
  const preferFullUniverse = shouldPreferFullUniverseLatestRun({
    assetClass: assetClass.value,
    includeNonScanner,
  });

  try {
    const run = await store.getLatestScanRun({
      timeframe,
      assetClass: assetClass.value,
      preferFullUniverse,
      minExpectedSymbols: LATEST_SCAN_FULL_UNIVERSE_MIN_SYMBOLS,
    });

    if (!run) {
      sendJson(response, 200, {
        ok: true,
        run: null,
        timeframe,
        assetClass: assetClass.value,
        includeLowQuality,
        includeNonScanner,
        includeMarketContext,
        summary: null,
        groups: null,
        items: [],
        count: 0,
      });
      return;
    }

    const signals = await store.listLatestScanSignalsForRun({
      scanRunId: run.id,
      timeframe,
      assetClass: assetClass.value,
      includeNonScanner,
      includeMarketContext,
    });
    const latestScan = buildLatestScanResponse({
      run,
      signals,
      limit: limit.value,
      includeLowQuality,
    });
    const latestRunSelection = buildLatestRunSelectionMetadata({
      run,
      assetClass: assetClass.value,
      preferredFullUniverse: preferFullUniverse,
    });

    sendJson(response, 200, {
      ...latestScan,
      summary: {
        ...latestScan.summary,
        latestRunSelection,
      },
      service: serviceName,
      source: "postgres",
      timeframe,
      assetClass: assetClass.value,
      includeLowQuality,
      includeNonScanner,
      includeMarketContext,
      count: latestScan.items.length,
    });
  } catch (error) {
    sendJson(response, 503, {
      ok: false,
      error: sanitizeConnectionError(error, "POSTGRES_UNAVAILABLE"),
    });
  } finally {
    await store.close().catch(() => undefined);
  }
}

async function handleMtfLatestScan(response: http.ServerResponse, url: URL) {
  const assetClass = parseAssetClassParam(url.searchParams.get("assetClass"));
  const includeNonScanner = parseBooleanParam(url.searchParams.get("includeNonScanner"));
  const includeMarketContext = parseBooleanParam(
    url.searchParams.get("includeMarketContext"),
  );

  if (!assetClass.valid) {
    sendJson(response, 400, {
      ok: false,
      service: serviceName,
      error: "INVALID_ASSET_CLASS",
    });
    return;
  }

  const store = new PgScannerResultsStore();
  const preferFullUniverse = shouldPreferFullUniverseLatestRun({
    assetClass: assetClass.value,
    includeNonScanner,
  });

  try {
    const timeframeResults = await Promise.all(
      MTF_LATEST_TIMEFRAMES.map(async (timeframe) => {
        const run = await store.getLatestScanRun({
          timeframe,
          assetClass: assetClass.value,
          preferFullUniverse,
          minExpectedSymbols: LATEST_SCAN_FULL_UNIVERSE_MIN_SYMBOLS,
        });

        if (!run) {
          return {
            timeframe,
            run: null,
            items: [],
          };
        }

        const signals = await store.listLatestScanSignalsForRun({
          scanRunId: run.id,
          timeframe,
          assetClass: assetClass.value,
          includeNonScanner,
          includeMarketContext,
        });

        return {
          timeframe,
          run: buildMtfLatestRunMetadata({
            run,
            assetClass: assetClass.value,
            preferredFullUniverse: preferFullUniverse,
          }),
          items: signals.map((signal) =>
            buildMtfLatestSignalItem(signal, timeframe),
          ),
        };
      }),
    );
    const runs = createMtfTimeframeMap<MtfLatestRunMetadata | null>(null);
    const signalCounts = createMtfTimeframeMap<number>(0);
    const rowsBySymbol = new Map<
      string,
      {
        symbol: string;
        exchange: string;
        market: string;
        assetClass: string;
        timeframes: MtfLatestTimeframeMap<MtfLatestSignalItem | null>;
      }
    >();

    for (const result of timeframeResults) {
      runs[result.timeframe] = result.run;
      signalCounts[result.timeframe] = result.items.length;

      for (const item of result.items) {
        const symbol = item.symbol.trim().toUpperCase();

        if (!symbol) {
          continue;
        }

        const existing = rowsBySymbol.get(symbol) ?? {
          symbol,
          exchange: item.exchange,
          market: item.market,
          assetClass: item.assetClass,
          timeframes: createMtfTimeframeMap<MtfLatestSignalItem | null>(null),
        };

        existing.timeframes[result.timeframe] = item;
        rowsBySymbol.set(symbol, existing);
      }
    }

    const rows = [...rowsBySymbol.values()].sort((left, right) =>
      left.symbol.localeCompare(right.symbol),
    );
    const missingCounts = createMtfTimeframeMap<number>(0);

    for (const timeframe of MTF_LATEST_TIMEFRAMES) {
      missingCounts[timeframe] = rows.filter(
        (row) => row.timeframes[timeframe] === null,
      ).length;
    }

    sendJson(response, 200, {
      ok: true,
      service: serviceName,
      source: "postgres",
      assetClass: assetClass.value,
      includeNonScanner,
      includeMarketContext,
      timeframes: MTF_LATEST_TIMEFRAMES,
      runs,
      signalCounts,
      missingCounts,
      count: rows.length,
      rows,
    });
  } catch (error) {
    sendJson(response, 503, {
      ok: false,
      service: serviceName,
      source: "postgres",
      error: sanitizeConnectionError(error, "POSTGRES_UNAVAILABLE"),
    });
  } finally {
    await store.close().catch(() => undefined);
  }
}

function shouldPreferFullUniverseLatestRun({
  assetClass,
  includeNonScanner,
}: {
  assetClass: SymbolAssetClassFilter;
  includeNonScanner: boolean;
}) {
  return assetClass === "crypto" && !includeNonScanner;
}

function buildLatestRunSelectionMetadata({
  run,
  assetClass,
  preferredFullUniverse,
}: {
  run: Awaited<ReturnType<PgScannerResultsStore["getLatestScanRun"]>>;
  assetClass: SymbolAssetClassFilter;
  preferredFullUniverse: boolean;
}) {
  if (!run) {
    return {
      preferredFullUniverse,
      isLikelyFullUniverse: false,
      minExpectedSymbols: LATEST_SCAN_FULL_UNIVERSE_MIN_SYMBOLS,
      fallbackUsed: false,
    };
  }

  const isLikelyFullUniverse = isLikelyFullUniverseRun({
    run,
    assetClass,
    minExpectedSymbols: LATEST_SCAN_FULL_UNIVERSE_MIN_SYMBOLS,
  });

  return {
    preferredFullUniverse,
    isLikelyFullUniverse,
    minExpectedSymbols: LATEST_SCAN_FULL_UNIVERSE_MIN_SYMBOLS,
    fallbackUsed: preferredFullUniverse && !isLikelyFullUniverse,
  };
}

function buildMtfLatestRunMetadata({
  run,
  assetClass,
  preferredFullUniverse,
}: {
  run: ScanRunRecord;
  assetClass: SymbolAssetClassFilter;
  preferredFullUniverse: boolean;
}): MtfLatestRunMetadata {
  const latestRunSelection = buildLatestRunSelectionMetadata({
    run,
    assetClass,
    preferredFullUniverse,
  });

  return {
    id: run.id,
    timeframe: run.timeframe,
    status: run.status,
    symbolsTotal: run.symbolsTotal,
    symbolsScanned: run.symbolsScanned,
    symbolsSkipped: run.symbolsSkipped,
    signalsCreated: run.signalsCreated,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    isLikelyFullUniverse: latestRunSelection.isLikelyFullUniverse,
    latestRunSelection,
  };
}

function buildMtfLatestSignalItem(
  signal: LatestScanSignalRecord,
  timeframe: MtfLatestTimeframe,
) {
  const quality = getSymbolQuality(signal.symbol, {
    assetClass: signal.assetClass,
    candleCount: signal.candleCount,
    firstOpenTime: signal.firstOpenTime,
  });
  const resultGroup = classifyScanResultGroup(signal);
  const review = getScanResultReview({ ...signal, resultGroup });

  return {
    ...signal,
    ...quality,
    timeframe,
    group: resultGroup,
    resultGroup,
    action: review.statusNote,
    setupType: signal.primaryStructure,
    ...review,
  };
}

function createMarketContextProxyMap(): MarketContextProxyMap {
  return {
    BTCUSDT: createMarketContextTimeframeMap(),
    ETHUSDT: createMarketContextTimeframeMap(),
  };
}

function createMarketContextTimeframeMap() {
  return {
    "1w": createUnavailableMarketContextProxy("1w", "insufficient_data"),
    "1d": createUnavailableMarketContextProxy("1d", "insufficient_data"),
    "4h": createUnavailableMarketContextProxy("4h", "insufficient_data"),
  };
}

function getMarketContextRunContext(
  run: MtfLatestRunMetadata | null,
): MarketContextRunContext {
  if (!run) {
    return "unknown";
  }

  if (
    run.latestRunSelection.preferredFullUniverse &&
    run.latestRunSelection.isLikelyFullUniverse
  ) {
    return "selected_full_universe";
  }

  return run.isLikelyFullUniverse ? "full_universe" : "smaller_or_manual";
}

function buildAvailableMarketContextProxy({
  signal,
  timeframe,
  runContext,
}: {
  signal: LatestScanSignalRecord;
  timeframe: MarketContextTimeframe;
  runContext: MarketContextRunContext;
}): AvailableMarketContextProxy {
  const group = classifyScanResultGroup(signal);
  const review = getScanResultReview({ ...signal, resultGroup: group });

  return {
    available: true,
    timeframe,
    group,
    signalLabel: signal.signalLabel,
    rankScore: signal.rankScore,
    actionBias: signal.actionBias,
    primaryStructure: signal.primaryStructure,
    detectedRiskTypes: normalizeMarketContextRiskTypes(signal.detectedRiskTypes),
    statusNote: review.statusNote,
    cautionLevel: review.cautionLevel,
    scanTime: signal.scanTime,
    candleOpenTime: signal.candleOpenTime,
    runContext,
  };
}

function normalizeMarketContextRiskTypes(value: unknown[] | null | undefined) {
  return (Array.isArray(value) ? value : []).filter(
    (riskType): riskType is string => typeof riskType === "string",
  );
}

function createMtfTimeframeMap<T>(value: T): MtfLatestTimeframeMap<T> {
  return {
    "1h": value,
    "4h": value,
    "1d": value,
    "1w": value,
  };
}

type EnrichedSymbolResearchSignal = SymbolResearchSignalRecord & {
  resultGroup: ScanResultGroup;
  sourceRunIsLikelyFullUniverse: boolean | null;
  isSelectedCurrentRun: boolean;
  isNewerThanSelectedCurrentRun: boolean;
} & ReturnType<typeof getScanResultReview>;

function enrichSymbolResearchSignal(
  signal: SymbolResearchSignalRecord,
  {
    currentSignal,
    assetClass,
  }: {
    currentSignal?: SymbolResearchSignalRecord | null;
    assetClass?: SymbolAssetClassFilter;
  } = {},
): EnrichedSymbolResearchSignal {
  const resultGroup = classifyScanResultGroup(signal);
  const review = getScanResultReview({ ...signal, resultGroup });
  const isSamePrimaryTimeframe =
    currentSignal?.timeframe !== undefined && signal.timeframe === currentSignal.timeframe;
  const isSelectedCurrentRun =
    Boolean(currentSignal?.scanRunId) &&
    isSamePrimaryTimeframe &&
    signal.scanRunId === currentSignal?.scanRunId;

  return {
    ...signal,
    resultGroup,
    ...review,
    sourceRunIsLikelyFullUniverse: getSymbolResearchSourceRunLikelyFullUniverse({
      signal,
      assetClass: assetClass ?? signal.assetClass,
    }),
    isSelectedCurrentRun,
    isNewerThanSelectedCurrentRun:
      Boolean(currentSignal) &&
      isSamePrimaryTimeframe &&
      !isSelectedCurrentRun &&
      isAfterDate(signal.scanTime, currentSignal?.scanTime),
  };
}

function buildSymbolResearchCurrentSelectionMetadata({
  run,
  signal,
  assetClass,
  preferredFullUniverse,
}: {
  run: Awaited<ReturnType<PgScannerResultsStore["getLatestScanRun"]>>;
  signal: SymbolResearchSignalRecord | null;
  assetClass: SymbolAssetClassFilter;
  preferredFullUniverse: boolean;
}) {
  return {
    ...buildLatestRunSelectionMetadata({
      run,
      assetClass,
      preferredFullUniverse,
    }),
    selectedRunId: run?.id ?? null,
    selectedSignalId: signal?.id ?? null,
    selectedTimeframe: run?.timeframe ?? signal?.timeframe ?? null,
    selectedRunStartedAt: run?.startedAt ?? null,
    selectedRunFinishedAt: run?.finishedAt ?? null,
    selectedSignalScanTime: signal?.scanTime ?? null,
  };
}

async function loadSymbolBehaviorSafely({
  store,
  exchange,
  market,
  symbol,
  timeframe,
  currentSignal,
  assetClass,
  includeNonScanner,
  includeMarketContext,
}: {
  store: PgSymbolResearchStore;
  exchange: string;
  market: string;
  symbol: string;
  timeframe: string;
  currentSignal: SymbolResearchSignalRecord;
  assetClass: SymbolAssetClassFilter;
  includeNonScanner: boolean;
  includeMarketContext: boolean;
}) {
  try {
    return await store.getSymbolBehaviorPg({
      exchange,
      market,
      symbol,
      timeframe,
      currentSignal,
      assetClass,
      includeNonScanner,
      includeMarketContext,
    });
  } catch (error) {
    console.warn(
      "trade-api symbol behavior unavailable:",
      getSafeErrorCode(error) ?? "UNKNOWN",
    );
    return {
      behavior: null,
      behaviorDiagnostics: buildSymbolBehaviorDiagnostics({
        available: false,
        reason: "calculation_failed",
        message:
          "Historical behavior is not available because the behavior calculation failed.",
      }),
    };
  }
}

function buildSymbolBehaviorDiagnostics({
  available,
  reason,
  message,
}: {
  available: boolean;
  reason:
    | "ok"
    | "no_prior_signals"
    | "missing_forward_candles"
    | "insufficient_sample"
    | "calculation_failed"
    | "no_latest_signal"
    | "unknown";
  message: string;
}) {
  return { available, reason, message };
}

type SymbolResearchUnavailableReason =
  | "insufficient_history"
  | "not_in_selected_run"
  | "unknown";

async function buildSymbolResearchUnavailableMetadata({
  store,
  latest,
  exchange,
  market,
  symbol,
  timeframe,
  assetClass,
  preferredFullUniverse,
}: {
  store: PgSymbolResearchStore;
  latest: Awaited<
    ReturnType<PgSymbolResearchStore["getSymbolResearchLatestSignalPg"]>
  >;
  exchange: string;
  market: string;
  symbol: string;
  timeframe: string;
  assetClass: SymbolAssetClassFilter;
  preferredFullUniverse: boolean;
}) {
  const coverage = await store.getSymbolCandleCoveragePg({
    exchange,
    market,
    symbol,
    timeframe,
  });
  const selectedRun = buildSymbolResearchUnavailableSelectedRun({
    run: latest.scanRun,
    assetClass,
    preferredFullUniverse,
  });
  const unavailableReason = getSymbolResearchUnavailableReason({
    scanRun: latest.scanRun,
    coverage,
  });
  const symbolCoverage = {
    timeframe,
    candleCount: coverage.candleCount,
    requiredCandles: SYMBOL_RESEARCH_REQUIRED_CANDLES,
    firstOpenTime: coverage.firstOpenTime,
    lastOpenTime: coverage.lastOpenTime,
  };

  return {
    unavailableReason,
    message: getSymbolResearchUnavailableMessage({
      symbol: latest.symbol?.symbol ?? symbol.toUpperCase(),
      timeframe,
      unavailableReason,
      selectedRun,
      symbolCoverage,
    }),
    selectedRun,
    symbolCoverage,
  };
}

function buildSymbolResearchUnavailableSelectedRun({
  run,
  assetClass,
  preferredFullUniverse,
}: {
  run: Awaited<ReturnType<PgScannerResultsStore["getLatestScanRun"]>>;
  assetClass: SymbolAssetClassFilter;
  preferredFullUniverse: boolean;
}) {
  if (!run) {
    return null;
  }

  const latestRunSelection = buildLatestRunSelectionMetadata({
    run,
    assetClass,
    preferredFullUniverse,
  });

  return {
    id: run.id,
    timeframe: run.timeframe,
    status: run.status,
    symbolsTotal: run.symbolsTotal,
    symbolsScanned: run.symbolsScanned,
    symbolsSkipped: run.symbolsSkipped,
    signalsCreated: run.signalsCreated,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    isLikelyFullUniverse: latestRunSelection.isLikelyFullUniverse,
  };
}

function getSymbolResearchUnavailableReason({
  scanRun,
  coverage,
}: {
  scanRun: Awaited<ReturnType<PgScannerResultsStore["getLatestScanRun"]>>;
  coverage: SymbolResearchCandleCoverageRecord;
}): SymbolResearchUnavailableReason {
  if (!scanRun) {
    return "unknown";
  }

  if (coverage.candleCount < SYMBOL_RESEARCH_REQUIRED_CANDLES) {
    return "insufficient_history";
  }

  return "not_in_selected_run";
}

function getSymbolResearchUnavailableMessage({
  symbol,
  timeframe,
  unavailableReason,
  selectedRun,
  symbolCoverage,
}: {
  symbol: string;
  timeframe: string;
  unavailableReason: SymbolResearchUnavailableReason;
  selectedRun: ReturnType<typeof buildSymbolResearchUnavailableSelectedRun>;
  symbolCoverage: {
    candleCount: number;
    requiredCandles: number;
  };
}) {
  if (unavailableReason === "insufficient_history") {
    const runDescription = selectedRun?.isLikelyFullUniverse
      ? `The latest full-universe ${timeframe} scan ran successfully`
      : `The selected ${timeframe} scan ran`;
    const skippedDescription =
      typeof selectedRun?.symbolsSkipped === "number" && selectedRun.symbolsSkipped > 0
        ? ` and skipped ${selectedRun.symbolsSkipped} symbols`
        : "";
    const candleLabel = getSymbolResearchCandleLabel(timeframe);

    return `No ${timeframe} scanner signal for ${symbol}. ${runDescription}${skippedDescription}, and ${symbol} was skipped because it has only ${symbolCoverage.candleCount} ${candleLabel}. The scanner currently requires ${symbolCoverage.requiredCandles} candles.`;
  }

  if (unavailableReason === "not_in_selected_run") {
    return "No scanner signal is available for this symbol/timeframe from the selected latest run.";
  }

  return `No selected latest ${timeframe} scanner run is available yet.`;
}

function getSymbolResearchCandleLabel(timeframe: string) {
  switch (timeframe) {
    case "1w":
      return "weekly candles";
    case "1d":
      return "daily candles";
    case "4h":
      return "4h candles";
    case "1h":
      return "hourly candles";
    default:
      return "candles";
  }
}

function getSymbolResearchSourceRunLikelyFullUniverse({
  signal,
  assetClass,
}: {
  signal: SymbolResearchSignalRecord;
  assetClass: SymbolAssetClassFilter;
}) {
  if (
    signal.scanRunSymbolsTotal == null ||
    signal.scanRunSymbolsScanned == null ||
    signal.scanRunSignalsCreated == null
  ) {
    return null;
  }

  return isLikelyFullUniverseRun({
    run: {
      id: signal.scanRunId,
      exchange: signal.exchange,
      market: signal.market,
      mode: "single",
      timeframe: signal.timeframe,
      universe: "unknown",
      status: "success",
      symbolsTotal: signal.scanRunSymbolsTotal,
      symbolsScanned: signal.scanRunSymbolsScanned,
      signalsCreated: signal.scanRunSignalsCreated,
      symbolsSkipped: 0,
      failedSymbols: 0,
      params: signal.scanRunParams,
      errorMessage: null,
      startedAt: signal.scanRunStartedAt ?? signal.scanTime,
      finishedAt: signal.scanRunFinishedAt,
    },
    assetClass,
    minExpectedSymbols: LATEST_SCAN_FULL_UNIVERSE_MIN_SYMBOLS,
  });
}

function isAfterDate(left: string | null | undefined, right: string | null | undefined) {
  if (!left || !right) {
    return false;
  }

  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);

  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
    return false;
  }

  return leftTime > rightTime;
}

function buildSymbolResearchScoreBreakdown(signal: SymbolResearchSignalRecord) {
  return {
    rankScore: signal.rankScore,
    finalSignalScore: signal.finalSignalScore,
    opportunityScore: signal.opportunityScore,
    confirmationScore: signal.confirmationScore,
    riskScore: signal.riskScore,
    trendScore: signal.trendScore,
    momentumScore: signal.momentumScore,
    volumeScore: signal.volumeScore,
    structureScore: signal.structureScore,
  };
}

function buildSymbolResearchInterpretation(signal: EnrichedSymbolResearchSignal) {
  return {
    group: signal.resultGroup,
    label: toReadableLabel(signal.signalLabel),
    action: getSymbolResearchActionLabel(signal),
    setupType: toReadableLabel(signal.primaryStructure),
    statusNote: signal.statusNote,
    reasons: signal.statusReasons,
    nextConfirmation: signal.nextConfirmation,
    invalidation: signal.invalidation,
  };
}

function getSymbolResearchActionLabel(signal: EnrichedSymbolResearchSignal) {
  if (signal.resultGroup === "eligible") {
    return "Manual review";
  }

  if (signal.resultGroup === "watch") {
    if (signal.reviewTier === "watch_caution") {
      return "Caution review";
    }

    if (signal.reviewTier === "watch_low") {
      return "Low priority review";
    }

    return "Review only";
  }

  if (signal.resultGroup === "overheated") {
    return "Do not chase";
  }

  if (signal.resultGroup === "risk") {
    return "Avoid or wait for repair";
  }

  if (signal.resultGroup === "insufficient_history") {
    return "Not enough candles";
  }

  return "No clear edge";
}

function buildSymbolResearchCandlesPayload({
  timeframe,
  candles,
}: {
  timeframe: string;
  candles: SymbolResearchCandleRecord[];
}) {
  const first = candles[0] ?? null;
  const last = candles[candles.length - 1] ?? null;

  return {
    timeframe,
    count: candles.length,
    firstOpenTime: first ? toIsoTime(first.openTime) : null,
    lastOpenTime: last ? toIsoTime(last.openTime) : null,
    rows: candles,
  };
}

function toIsoTime(value: number) {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeIdentityParam(value: string | null, fallback: string) {
  return (value?.trim() || fallback).toLowerCase();
}

function toReadableLabel(value: string | null | undefined) {
  if (!value) {
    return "Unknown";
  }

  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

async function handleScanRuns(response: http.ServerResponse, url: URL) {
  const limit = parseBoundedInteger({
    value: url.searchParams.get("limit"),
    fallback: 10,
    min: 1,
    max: 500,
    name: "limit",
  });

  if (!limit.valid) {
    sendJson(response, 400, { ok: false, service: serviceName, error: limit.error });
    return;
  }

  const store = new PgScannerResultsStore();

  try {
    const runs = await store.listScanRuns({ limit: limit.value });

    sendJson(response, 200, {
      ok: true,
      count: runs.length,
      runs,
    });
  } catch (error) {
    sendJson(response, 503, {
      ok: false,
      error: sanitizeConnectionError(error, "POSTGRES_UNAVAILABLE"),
    });
  } finally {
    await store.close().catch(() => undefined);
  }
}

async function handleHistorySnapshots(response: http.ServerResponse, url: URL) {
  const timeframe = parseHistorySnapshotTimeframeParam(
    url.searchParams.get("timeframe"),
  );
  const assetClass = parseAssetClassParam(url.searchParams.get("assetClass"));
  const limit = parseBoundedInteger({
    value: url.searchParams.get("limit"),
    fallback: 25,
    min: 1,
    max: 100,
    name: "limit",
  });

  if (!timeframe.valid) {
    sendJson(response, 400, {
      ok: false,
      service: serviceName,
      error: "INVALID_TIMEFRAME",
    });
    return;
  }

  if (!assetClass.valid) {
    sendJson(response, 400, {
      ok: false,
      service: serviceName,
      error: "INVALID_ASSET_CLASS",
    });
    return;
  }

  if (!limit.valid) {
    sendJson(response, 400, { ok: false, service: serviceName, error: limit.error });
    return;
  }

  const store = new PgScannerResultsStore();

  try {
    const runs = await store.listHistoricalScanRuns({
      timeframe: timeframe.value,
      assetClass: assetClass.value,
      limit: limit.value,
    });
    const snapshots = runs.map((run) =>
      buildHistoricalSnapshotRunMetadata({
        run,
        assetClass: assetClass.value,
      }),
    );

    sendJson(response, 200, {
      ok: true,
      service: serviceName,
      source: "postgres",
      snapshots,
      metadata: {
        timeframe: timeframe.value,
        assetClass: assetClass.value,
        count: snapshots.length,
        limit: limit.value,
        disclaimer: HISTORY_RESEARCH_DISCLAIMER,
      },
    });
  } catch (error) {
    sendJson(response, 503, {
      ok: false,
      service: serviceName,
      source: "postgres",
      error: sanitizeConnectionError(error, "POSTGRES_UNAVAILABLE"),
    });
  } finally {
    await store.close().catch(() => undefined);
  }
}

async function handleHistorySnapshot(response: http.ServerResponse, url: URL) {
  const runId = parseHistoryRunIdParam(url.searchParams.get("runId"));
  const timeframe = parseOptionalHistorySnapshotTimeframeParam(
    url.searchParams.get("timeframe"),
  );
  const assetClass = parseAssetClassParam(url.searchParams.get("assetClass"));

  if (!runId.valid) {
    sendJson(response, 400, {
      ok: false,
      service: serviceName,
      error: {
        code: "INVALID_RUN_ID",
        message: "Invalid run id.",
      },
    });
    return;
  }

  if (!timeframe.valid) {
    sendJson(response, 400, {
      ok: false,
      service: serviceName,
      error: "INVALID_TIMEFRAME",
    });
    return;
  }

  if (!assetClass.valid) {
    sendJson(response, 400, {
      ok: false,
      service: serviceName,
      error: "INVALID_ASSET_CLASS",
    });
    return;
  }

  const store = new PgScannerResultsStore();

  try {
    const run = await store.getHistoricalScanRun({
      scanRunId: runId.value,
      timeframe: timeframe.value ?? undefined,
      assetClass: assetClass.value,
    });

    if (!run) {
      sendJson(response, 404, {
        ok: false,
        service: serviceName,
        source: "postgres",
        error: "SNAPSHOT_NOT_FOUND",
      });
      return;
    }

    const signals = await store.listLatestScanSignalsForRun({
      scanRunId: run.id,
      timeframe: run.timeframe,
      assetClass: assetClass.value,
      includeNonScanner: false,
      includeMarketContext: false,
    });
    const rows = signals
      .map(buildHistoricalSnapshotRow)
      .sort(compareScanResultGroupItems);
    const scannerVersion = firstNonEmpty(rows.map((row) => row.scannerVersion));
    const scoringVersion = firstNonEmpty(rows.map((row) => row.scoringVersion));

    sendJson(response, 200, {
      ok: true,
      service: serviceName,
      source: "postgres",
      run: {
        ...buildHistoricalSnapshotRunMetadata({
          run,
          assetClass: assetClass.value,
        }),
        params: run.params,
        scannerVersion,
        scoringVersion,
      },
      rows,
      metadata: {
        rowCount: rows.length,
        limited: false,
        timeframe: run.timeframe,
        assetClass: assetClass.value,
        disclaimer: HISTORY_RESEARCH_DISCLAIMER,
      },
    });
  } catch (error) {
    sendJson(response, 503, {
      ok: false,
      service: serviceName,
      source: "postgres",
      error: sanitizeConnectionError(error, "POSTGRES_UNAVAILABLE"),
    });
  } finally {
    await store.close().catch(() => undefined);
  }
}

async function handleHistoryObservationReadiness(
  response: http.ServerResponse,
  url: URL,
) {
  const timeframe = parseHistorySnapshotTimeframeParam(
    url.searchParams.get("timeframe"),
  );
  const rawRunId = url.searchParams.get("runId");
  const runId =
    rawRunId === null || rawRunId.trim() === ""
      ? ({ valid: true, value: null } as const)
      : parseHistoryRunIdParam(rawRunId);
  const assetClass = parseAssetClassParam(url.searchParams.get("assetClass"));
  const window = parseHistoryObservationWindowParam(
    url.searchParams.get("window"),
  );

  if (!timeframe.valid) {
    sendJson(response, 400, {
      ok: false,
      service: serviceName,
      error: "INVALID_TIMEFRAME",
    });
    return;
  }

  if (!runId.valid) {
    sendJson(response, 400, {
      ok: false,
      service: serviceName,
      error: {
        code: "INVALID_RUN_ID",
        message: "Invalid run id.",
      },
    });
    return;
  }

  if (!window.valid) {
    sendJson(response, 400, {
      ok: false,
      service: serviceName,
      error: {
        code: "INVALID_WINDOW",
        message: `Observation window must be ${HISTORICAL_SNAPSHOT_OBSERVATION_WINDOWS.join(", ")} completed candles.`,
      },
    });
    return;
  }

  if (!assetClass.valid) {
    sendJson(response, 400, {
      ok: false,
      service: serviceName,
      error: "INVALID_ASSET_CLASS",
    });
    return;
  }

  const store = new PgScannerResultsStore();

  try {
    const [runs, coverage] = await Promise.all([
      store.listHistoricalScanRuns({
        timeframe: timeframe.value,
        assetClass: assetClass.value,
        limit: HISTORY_OBSERVATION_READINESS_CANDIDATE_LIMIT,
      }),
      store.getHistoricalObservationMarketCandleCoverage({
        timeframe: timeframe.value,
        assetClass: assetClass.value,
        includeNonScanner: false,
        includeMarketContext: false,
      }),
    ]);
    const selectedRun = runId.value
      ? await store.getHistoricalScanRun({
          scanRunId: runId.value,
          timeframe: timeframe.value,
          assetClass: assetClass.value,
        })
      : runs[0] ?? null;

    if (runId.value && !selectedRun) {
      sendJson(response, 404, {
        ok: false,
        service: serviceName,
        source: "postgres",
        error: "SNAPSHOT_NOT_FOUND",
      });
      return;
    }

    const selectedAssessment = selectedRun
      ? await buildHistoryObservationRunAssessment({
          store,
          run: selectedRun,
          assetClass: assetClass.value,
          window: window.value,
          coverage,
        })
      : null;
    const candidateRuns = selectedRun
      ? runs.filter((run) => run.id !== selectedRun.id)
      : runs;
    const recommendation =
      selectedAssessment?.state === "ready"
        ? null
        : await findRecommendedHistoryObservationRun({
            store,
            runs: candidateRuns,
            assetClass: assetClass.value,
            window: window.value,
            coverage,
          });
    const observationRun =
      selectedAssessment?.state === "ready"
        ? selectedAssessment
        : recommendation;
    const readinessBlocker =
      selectedAssessment?.blocker ??
      (runs.length === 0 ? "no_runs" : "unavailable");

    sendJson(response, 200, {
      ok: true,
      service: serviceName,
      source: "postgres",
      selectedRun: selectedAssessment
        ? buildHistoryObservationReadinessRun({
            assessment: selectedAssessment,
            assetClass: assetClass.value,
          })
        : null,
      recommendedRun: recommendation
        ? buildHistoryObservationReadinessRun({
            assessment: recommendation,
            assetClass: assetClass.value,
          })
        : null,
      observationRun: observationRun
        ? buildHistoryObservationReadinessRun({
            assessment: observationRun,
            assetClass: assetClass.value,
          })
        : null,
      coverage: buildHistoryObservationCoverage(coverage),
      metadata: {
        timeframe: timeframe.value,
        assetClass: assetClass.value,
        window: window.value,
        selectedWindow: window.value,
        windowUnit: "completed_candles",
        blocker: readinessBlocker,
        candidateCount: runs.length,
        candidateLimit: HISTORY_OBSERVATION_READINESS_CANDIDATE_LIMIT,
        fullUniverseMinExpectedSymbols: LATEST_SCAN_FULL_UNIVERSE_MIN_SYMBOLS,
        disclaimer: HISTORY_RESEARCH_DISCLAIMER,
      },
    });
  } catch (error) {
    sendJson(response, 503, {
      ok: false,
      service: serviceName,
      source: "postgres",
      error: sanitizeConnectionError(error, "POSTGRES_UNAVAILABLE"),
    });
  } finally {
    await store.close().catch(() => undefined);
  }
}

async function handleHistorySnapshotObservations(
  response: http.ServerResponse,
  url: URL,
) {
  const runId = parseHistoryRunIdParam(url.searchParams.get("runId"));
  const timeframe = parseOptionalHistorySnapshotTimeframeParam(
    url.searchParams.get("timeframe"),
  );
  const assetClass = parseAssetClassParam(url.searchParams.get("assetClass"));
  const window = parseHistoryObservationWindowParam(
    url.searchParams.get("window"),
  );

  if (!runId.valid) {
    sendJson(response, 400, {
      ok: false,
      service: serviceName,
      error: {
        code: "INVALID_RUN_ID",
        message: "Invalid run id.",
      },
    });
    return;
  }

  if (!window.valid) {
    sendJson(response, 400, {
      ok: false,
      service: serviceName,
      error: {
        code: "INVALID_WINDOW",
        message: `Observation window must be ${HISTORICAL_SNAPSHOT_OBSERVATION_WINDOWS.join(", ")} completed candles.`,
      },
    });
    return;
  }

  if (!timeframe.valid) {
    sendJson(response, 400, {
      ok: false,
      service: serviceName,
      error: "INVALID_TIMEFRAME",
    });
    return;
  }

  if (!assetClass.valid) {
    sendJson(response, 400, {
      ok: false,
      service: serviceName,
      error: "INVALID_ASSET_CLASS",
    });
    return;
  }

  const store = new PgScannerResultsStore();

  try {
    const observations = await store.getHistoricalSnapshotObservations({
      scanRunId: runId.value,
      timeframe: timeframe.value ?? undefined,
      assetClass: assetClass.value,
      window: window.value,
    });

    if (!observations.run) {
      sendJson(response, 404, {
        ok: false,
        service: serviceName,
        source: "postgres",
        error: "SNAPSHOT_NOT_FOUND",
      });
      return;
    }

    const rows = observations.rows
      .map(buildHistoricalSnapshotObservationRow)
      .sort(compareScanResultGroupItems);
    const counts = buildHistoricalSnapshotObservationCounts(rows);

    sendJson(response, 200, {
      ok: true,
      service: serviceName,
      source: "postgres",
      run: buildHistoricalSnapshotRunMetadata({
        run: observations.run,
        assetClass: assetClass.value,
      }),
      rows,
      metadata: {
        window: window.value,
        selectedWindow: window.value,
        windowUnit: "completed_candles",
        rowCount: rows.length,
        completeCount: counts.complete,
        partialCount: counts.partial,
        missingCount: counts.missing,
        limited: false,
        timeframe: observations.run.timeframe,
        assetClass: assetClass.value,
        disclaimer: HISTORY_RESEARCH_DISCLAIMER,
      },
    });
  } catch {
    sendJson(response, 503, {
      ok: false,
      service: serviceName,
      source: "postgres",
      error: "INTERNAL_ERROR",
    });
  } finally {
    await store.close().catch(() => undefined);
  }
}

function buildHistoricalSnapshotRunMetadata({
  run,
  assetClass,
}: {
  run: ScanRunRecord;
  assetClass: SymbolAssetClassFilter;
}) {
  return {
    runId: run.id,
    timeframe: run.timeframe,
    status: run.status,
    universe: run.universe,
    exchange: run.exchange,
    market: run.market,
    symbolsTotal: run.symbolsTotal,
    symbolsScanned: run.symbolsScanned,
    signalsCreated: run.signalsCreated,
    skipped: run.symbolsSkipped,
    failedSymbols: run.failedSymbols,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    isLikelyFullUniverse: isLikelyFullUniverseRun({
      run,
      assetClass,
      minExpectedSymbols: LATEST_SCAN_FULL_UNIVERSE_MIN_SYMBOLS,
    }),
    fullUniverseMinExpectedSymbols: LATEST_SCAN_FULL_UNIVERSE_MIN_SYMBOLS,
  };
}

function buildHistoricalSnapshotObservationRow(
  signal: HistoricalSnapshotObservationRecord,
) {
  const snapshotRow = buildHistoricalSnapshotRow(signal);

  return {
    id: snapshotRow.id,
    scanRunId: snapshotRow.scanRunId,
    symbol: snapshotRow.symbol,
    exchange: snapshotRow.exchange,
    market: snapshotRow.market,
    timeframe: snapshotRow.timeframe,
    group: snapshotRow.group,
    resultGroup: snapshotRow.resultGroup,
    label: snapshotRow.label,
    primarySignal: snapshotRow.primarySignal,
    rankScore: snapshotRow.rankScore,
    anchorTime: signal.anchorTime,
    anchorClose: signal.anchorClose,
    anchorSource: signal.anchorSource,
    window: signal.window,
    observedClose: signal.observedClose,
    observedChangePct: signal.observedChangePct,
    maxDrawdownPct: signal.maxDrawdownPct,
    dataStatus: signal.dataStatus,
    missingReason: signal.missingReason,
  };
}

function buildHistoricalSnapshotObservationCounts(
  rows: ReturnType<typeof buildHistoricalSnapshotObservationRow>[],
) {
  return countHistoricalSnapshotObservationStatuses(rows);
}

async function findRecommendedHistoryObservationRun({
  store,
  runs,
  assetClass,
  window,
  coverage,
}: {
  store: PgScannerResultsStore;
  runs: ScanRunRecord[];
  assetClass: SymbolAssetClassFilter;
  window: HistoricalSnapshotObservationWindow;
  coverage: HistoricalObservationMarketCandleCoverage;
}) {
  let firstObservableRun: HistoryObservationRunAssessment | null = null;
  let firstFullUniverseObservableRun: HistoryObservationRunAssessment | null =
    null;

  for (const run of runs) {
    const assessment = await buildHistoryObservationRunAssessment({
      store,
      run,
      assetClass,
      window,
      coverage,
    });

    if (assessment.state !== "ready") {
      continue;
    }

    firstObservableRun ??= assessment;

    if (!assessment.isLimited) {
      firstFullUniverseObservableRun ??= assessment;
    }
  }

  return firstFullUniverseObservableRun ?? firstObservableRun;
}

async function buildHistoryObservationRunAssessment({
  store,
  run,
  assetClass,
  window,
  coverage,
}: {
  store: PgScannerResultsStore;
  run: ScanRunRecord;
  assetClass: SymbolAssetClassFilter;
  window: HistoricalSnapshotObservationWindow;
  coverage: HistoricalObservationMarketCandleCoverage;
}): Promise<HistoryObservationRunAssessment> {
  const rows = await store.listHistoricalSnapshotObservationsForRun({
    scanRunId: run.id,
    timeframe: run.timeframe,
    assetClass,
    includeNonScanner: false,
    includeMarketContext: false,
    window,
  });
  const counts = countHistoricalSnapshotObservationStatuses(rows);
  const { reason, count } =
    getDominantHistoricalSnapshotObservationMissingReason(rows);
  const latestAnchorTime = getLatestHistoricalSnapshotAnchorTime(rows);
  const expectedCompleteTime = latestAnchorTime
    ? addObservationWindowToIsoTime({
        isoTime: latestAnchorTime,
        timeframe: run.timeframe,
        window,
      })
    : null;
  const state = classifyHistoryObservationReadinessState({
    rowCount: rows.length,
    completeCount: counts.complete,
    partialCount: counts.partial,
    missingCount: counts.missing,
    dominantMissingReason: reason,
  });
  const blocker = classifyHistoryObservationBlocker({
    state,
    dominantMissingReason: reason,
    latestAnchorTime,
    expectedCompleteTime,
    coverage,
  });
  const isLikelyFullUniverse = isLikelyFullUniverseRun({
    run,
    assetClass,
    minExpectedSymbols: LATEST_SCAN_FULL_UNIVERSE_MIN_SYMBOLS,
  });

  return {
    run,
    state,
    blocker,
    isObservable: state === "ready",
    isLimited: !isLikelyFullUniverse,
    rowCount: rows.length,
    completeCount: counts.complete,
    partialCount: counts.partial,
    missingCount: counts.missing,
    dominantMissingReason: reason,
    dominantMissingReasonCount: count,
    latestAnchorTime,
    expectedCompleteTime,
  };
}

function buildHistoryObservationReadinessRun({
  assessment,
  assetClass,
}: {
  assessment: HistoryObservationRunAssessment;
  assetClass: SymbolAssetClassFilter;
}) {
  return {
    run: buildHistoricalSnapshotRunMetadata({
      run: assessment.run,
      assetClass,
    }),
    state: assessment.state,
    blocker: assessment.blocker,
    isObservable: assessment.isObservable,
    isLimited: assessment.isLimited,
    rowCount: assessment.rowCount,
    completeCount: assessment.completeCount,
    partialCount: assessment.partialCount,
    missingCount: assessment.missingCount,
    dominantMissingReason: assessment.dominantMissingReason,
    dominantMissingReasonCount: assessment.dominantMissingReasonCount,
    latestAnchorTime: assessment.latestAnchorTime,
    expectedCompleteTime: assessment.expectedCompleteTime,
  };
}

function buildHistoryObservationCoverage(
  coverage: HistoricalObservationMarketCandleCoverage,
) {
  return {
    ...coverage,
    latestOpenTimeCoveragePct:
      coverage.totalSymbols > 0
        ? Math.round(
            (coverage.latestOpenTimeSymbolCount / coverage.totalSymbols) * 10_000,
          ) / 100
        : null,
  };
}

function countHistoricalSnapshotObservationStatuses(
  rows: Array<{ dataStatus: HistoricalSnapshotObservationRecord["dataStatus"] }>,
) {
  return rows.reduce(
    (counts, row) => ({
      complete: counts.complete + (row.dataStatus === "complete" ? 1 : 0),
      partial: counts.partial + (row.dataStatus === "partial" ? 1 : 0),
      missing: counts.missing + (row.dataStatus === "missing" ? 1 : 0),
    }),
    { complete: 0, partial: 0, missing: 0 },
  );
}

function getDominantHistoricalSnapshotObservationMissingReason(
  rows: Array<{ missingReason: string | null }>,
) {
  const counts = new Map<string, number>();

  for (const row of rows) {
    if (!row.missingReason) {
      continue;
    }

    counts.set(row.missingReason, (counts.get(row.missingReason) ?? 0) + 1);
  }

  return [...counts.entries()].reduce(
    (dominant, [reason, count]) =>
      count > dominant.count ? { reason, count } : dominant,
    { reason: null as string | null, count: 0 },
  );
}

function getLatestHistoricalSnapshotAnchorTime(
  rows: HistoricalSnapshotObservationRecord[],
) {
  const latestMs = rows.reduce((latest, row) => {
    if (!row.anchorTime) {
      return latest;
    }

    const anchorMs = Date.parse(row.anchorTime);

    return Number.isFinite(anchorMs) && anchorMs > latest ? anchorMs : latest;
  }, Number.NEGATIVE_INFINITY);

  return Number.isFinite(latestMs) ? new Date(latestMs).toISOString() : null;
}

function classifyHistoryObservationReadinessState({
  rowCount,
  completeCount,
  partialCount,
  missingCount,
  dominantMissingReason,
}: {
  rowCount: number;
  completeCount: number;
  partialCount: number;
  missingCount: number;
  dominantMissingReason: string | null;
}): HistoryObservationReadinessState {
  if (rowCount <= 0) {
    return "unavailable";
  }

  if (completeCount + partialCount > 0) {
    return "ready";
  }

  const allRowsMissing = missingCount === rowCount;

  return allRowsMissing &&
    isHistoricalObservationFutureCandleMissingReason(dominantMissingReason)
    ? "not_ready"
    : "unavailable";
}

function classifyHistoryObservationBlocker({
  state,
  dominantMissingReason,
  latestAnchorTime,
  expectedCompleteTime,
  coverage,
}: {
  state: HistoryObservationReadinessState;
  dominantMissingReason: string | null;
  latestAnchorTime: string | null;
  expectedCompleteTime: string | null;
  coverage: HistoricalObservationMarketCandleCoverage;
}): HistoryObservationReadinessBlocker {
  if (state === "ready") {
    return "observable";
  }

  if (state === "unavailable") {
    return "unavailable";
  }

  if (!isHistoricalObservationFutureCandleMissingReason(dominantMissingReason)) {
    return "unavailable";
  }

  const nowMs = Date.now();
  const latestAnchorMs = latestAnchorTime ? Date.parse(latestAnchorTime) : null;
  const expectedCompleteMs = expectedCompleteTime
    ? Date.parse(expectedCompleteTime)
    : null;
  const latestCoverageMs = coverage.latestOpenTime
    ? Date.parse(coverage.latestOpenTime)
    : null;

  if (
    expectedCompleteMs !== null &&
    Number.isFinite(expectedCompleteMs) &&
    nowMs < expectedCompleteMs
  ) {
    return "time_maturity";
  }

  if (latestCoverageMs === null || !Number.isFinite(latestCoverageMs)) {
    return "market_data_coverage";
  }

  if (
    expectedCompleteMs !== null &&
    Number.isFinite(expectedCompleteMs) &&
    latestCoverageMs < expectedCompleteMs
  ) {
    return "market_data_coverage";
  }

  if (
    latestAnchorMs !== null &&
    Number.isFinite(latestAnchorMs) &&
    latestCoverageMs <= latestAnchorMs
  ) {
    return "market_data_coverage";
  }

  return "mixed";
}

function isHistoricalObservationFutureCandleMissingReason(
  reason: string | null,
) {
  return (
    reason === "no_future_candles" ||
    reason === "insufficient_future_candles" ||
    reason === "run_after_latest_candle"
  );
}

function addObservationWindowToIsoTime({
  isoTime,
  timeframe,
  window,
}: {
  isoTime: string;
  timeframe: string;
  window: HistoricalSnapshotObservationWindow;
}) {
  const baseMs = Date.parse(isoTime);
  const durationMs = getHistoryObservationTimeframeMs(timeframe);

  if (!Number.isFinite(baseMs) || durationMs === null) {
    return null;
  }

  return new Date(baseMs + durationMs * window).toISOString();
}

function getHistoryObservationTimeframeMs(timeframe: string) {
  switch (timeframe) {
    case "1h":
      return 60 * 60 * 1000;
    case "4h":
      return 4 * 60 * 60 * 1000;
    case "1d":
      return 24 * 60 * 60 * 1000;
    case "1w":
      return 7 * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}

function buildHistoricalSnapshotRow(signal: LatestScanSignalRecord) {
  const group = classifyScanResultGroup(signal);
  const review = getScanResultReview({ ...signal, resultGroup: group });
  const riskTypes = toStringArray(signal.detectedRiskTypes);

  return {
    id: signal.id,
    scanRunId: signal.scanRunId,
    symbol: signal.symbol,
    exchange: signal.exchange,
    market: signal.market,
    timeframe: signal.timeframe,
    scanTime: signal.scanTime,
    candleOpenTime: signal.candleOpenTime,
    priceAtSignal: signal.priceAtSignal,
    assetClass: signal.assetClass,
    group,
    resultGroup: group,
    label: signal.signalLabel,
    primarySignal: review.statusNote,
    reviewTier: review.reviewTier,
    riskNotes: review.statusReasons.join(" "),
    riskTypes,
    rankScore: signal.rankScore,
    componentScores: {
      finalSignalScore: signal.finalSignalScore,
      opportunityScore: signal.opportunityScore,
      confirmationScore: signal.confirmationScore,
      riskScore: signal.riskScore,
      trendScore: signal.trendScore,
      momentumScore: signal.momentumScore,
      volumeScore: signal.volumeScore,
      structureScore: signal.structureScore,
    },
    actionBias: signal.actionBias,
    primaryStructure: signal.primaryStructure,
    secondaryStructures: signal.secondaryStructures,
    factors: signal.factors,
    rawMetrics: signal.rawMetrics,
    scannerVersion: signal.scannerVersion,
    scoringVersion: signal.scoringVersion,
    candleCount: signal.candleCount,
    firstOpenTime: signal.firstOpenTime,
    isScannerEligible: signal.isScannerEligible,
    isMarketContext: signal.isMarketContext,
  };
}

function sanitizeConnectionError(error: unknown, fallbackCode: string): ServiceCheck {
  const code = getSafeErrorCode(error) ?? fallbackCode;

  return {
    ok: false,
    code,
    message: getSafeErrorMessage(code),
  };
}

function getSafeErrorCode(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string" &&
    /^[A-Z0-9_]+$/.test(error.code)
  ) {
    return error.code;
  }

  return null;
}

function getSafeErrorMessage(code: string) {
  switch (code) {
    case "ECONNREFUSED":
      return "Connection refused.";
    case "ETIMEDOUT":
    case "CONNECTION_TIMEOUT":
      return "Connection timed out.";
    case "ENOTFOUND":
      return "Host not found.";
    case "POSTGRES_UNAVAILABLE":
      return "PostgreSQL health check failed.";
    case "REDIS_UNAVAILABLE":
      return "Redis health check failed.";
    default:
      return "Dependency health check failed.";
  }
}

function parsePort(value: string) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  return parsed;
}

function parseBoundedInteger({
  value,
  fallback,
  min,
  max,
  name,
}: {
  value: string | null;
  fallback: number;
  min: number;
  max: number;
  name: string;
}) {
  if (value === null || value === "") {
    return { valid: true as const, value: fallback };
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return {
      valid: false as const,
      error: `${name.toUpperCase()}_OUT_OF_RANGE`,
    };
  }

  return { valid: true as const, value: parsed };
}

function parseAssetClassParam(value: string | null) {
  const assetClass = value?.trim().toLowerCase() ?? "crypto";

  if (!isSymbolAssetClassFilter(assetClass)) {
    return { valid: false as const, value: "crypto" as SymbolAssetClassFilter };
  }

  return { valid: true as const, value: assetClass };
}

function parseSignalEvaluationGroupParam(value: string | null): {
  valid: true;
  value: SignalEvaluationGroup | null;
} | {
  valid: false;
  value: null;
} {
  if (value === null || value.trim() === "") {
    return { valid: true, value: null };
  }

  const group = value.trim().toLowerCase();

  if (
    SIGNAL_EVALUATION_GROUPS.includes(group as SignalEvaluationGroup)
  ) {
    return { valid: true, value: group as SignalEvaluationGroup };
  }

  return { valid: false, value: null };
}

function parseOptionalTokenParam(
  value: string | null,
  error: string,
): {
  valid: true;
  value: string | null;
  error?: never;
} | {
  valid: false;
  value: null;
  error: string;
} {
  if (value === null || value.trim() === "") {
    return { valid: true, value: null };
  }

  const token = value.trim().toLowerCase();

  if (!/^[a-z0-9_-]{1,80}$/.test(token)) {
    return { valid: false, value: null, error };
  }

  return { valid: true, value: token };
}

function parseSignalEvaluationHorizonsParam(value: string | null): {
  valid: true;
  value: number[];
} | {
  valid: false;
  value: number[];
} {
  if (value === null || value.trim() === "") {
    return { valid: true, value: [...SIGNAL_EVALUATION_DEFAULT_HORIZONS] };
  }

  const rawParts = value.split(",").map((part) => part.trim());

  if (rawParts.length === 0 || rawParts.some((part) => part === "")) {
    return { valid: false, value: [] };
  }

  const horizons = rawParts.map((part) => Number(part));

  if (
    horizons.some(
      (horizon) =>
        !Number.isInteger(horizon) ||
        horizon < 1 ||
        horizon > SIGNAL_EVALUATION_MAX_HORIZON,
    )
  ) {
    return { valid: false, value: [] };
  }

  return {
    valid: true,
    value: [...new Set(horizons)].sort((left, right) => left - right),
  };
}

function isSignalEvaluationTimeframe(
  value: string,
): value is SignalEvaluationTimeframe {
  return SIGNAL_EVALUATION_TIMEFRAMES.includes(
    value as SignalEvaluationTimeframe,
  );
}

function parseHistorySnapshotTimeframeParam(value: string | null): {
  valid: true;
  value: HistorySnapshotTimeframe;
} | {
  valid: false;
  value: null;
} {
  const timeframe = value?.trim().toLowerCase() || "4h";

  if (isHistorySnapshotTimeframe(timeframe)) {
    return { valid: true, value: timeframe };
  }

  return { valid: false, value: null };
}

function parseOptionalHistorySnapshotTimeframeParam(value: string | null): {
  valid: true;
  value: HistorySnapshotTimeframe | null;
} | {
  valid: false;
  value: null;
} {
  if (value === null || value.trim() === "") {
    return { valid: true, value: null };
  }

  return parseHistorySnapshotTimeframeParam(value);
}

function isHistorySnapshotTimeframe(
  value: string,
): value is HistorySnapshotTimeframe {
  return HISTORY_SNAPSHOT_TIMEFRAMES.includes(
    value as HistorySnapshotTimeframe,
  );
}

function parseHistoryRunIdParam(value: string | null): {
  valid: true;
  value: string;
} | {
  valid: false;
  value: null;
} {
  const runId = value?.trim() ?? "";

  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      runId,
    )
  ) {
    return { valid: true, value: runId };
  }

  return { valid: false, value: null };
}

function parseHistoryObservationWindowParam(value: string | null): {
  valid: true;
  value: HistoricalSnapshotObservationWindow;
} | {
  valid: false;
  value: null;
} {
  const rawValue = value?.trim() || "3";
  const parsed = Number(rawValue);

  if (!Number.isInteger(parsed)) {
    return { valid: false, value: null };
  }

  const window = normalizeHistoricalSnapshotObservationWindow(parsed);

  return window === null
    ? { valid: false, value: null }
    : { valid: true, value: window };
}

function parseBooleanParam(value: string | null) {
  if (value === null || value === "") {
    return false;
  }

  return value === "1" || value.toLowerCase() === "true" || value.toLowerCase() === "yes";
}

function firstNonEmpty(values: Array<string | null | undefined>) {
  return values.find((value) => typeof value === "string" && value.trim() !== "") ?? null;
}

function toStringArray(value: unknown[] | null | undefined) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function loadDotEnv() {
  const envPath = path.join(process.cwd(), ".env");

  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();

    if (!key || process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = unquoteEnvValue(rawValue);
  }
}

function unquoteEnvValue(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function getCorsHeaders(request: http.IncomingMessage): Record<string, string> {
  const origin = getHeaderValue(request.headers.origin);

  if (!origin || !allowedOrigins.has(origin)) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function getHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function setCorsHeaders(
  response: http.ServerResponse,
  headers: Record<string, string>,
) {
  for (const [header, value] of Object.entries(headers)) {
    response.setHeader(header, value);
  }
}

function sendJson(
  response: http.ServerResponse,
  statusCode: number,
  payload: unknown,
) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function isTradeApiEntrypoint() {
  return process.argv[1] === path.resolve(process.cwd(), "src/server/trade-api.ts");
}
