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
import { buildLatestScanResponse } from "@/lib/scanner/latestScanResponse";
import {
  classifyScanResultGroup,
  getScanResultReview,
  type ScanResultGroup,
} from "@/lib/scanner/scanResultGroups";
import { PgMarketDataStore } from "@/lib/storage/postgres/marketDataPg";
import {
  LATEST_SCAN_FULL_UNIVERSE_MIN_SYMBOLS,
  PgScannerResultsStore,
  isLikelyFullUniverseRun,
  type LatestScanSignalRecord,
  type ScanRunRecord,
} from "@/lib/storage/postgres/scannerResultsPg";
import {
  PgSymbolResearchStore,
  type SymbolResearchCandleCoverageRecord,
  type SymbolResearchCandleRecord,
  type SymbolResearchSignalRecord,
} from "@/lib/storage/postgres/symbolResearchPg";

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
const allowedOrigins = new Set([
  "https://s.bitcoinmind.com",
  "http://localhost:3000",
]);

type MtfLatestTimeframe = (typeof MTF_LATEST_TIMEFRAMES)[number];
type MtfLatestSignalItem = ReturnType<typeof buildMtfLatestSignalItem>;
type MtfLatestTimeframeMap<T> = Record<MtfLatestTimeframe, T>;
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

function parseBooleanParam(value: string | null) {
  if (value === null || value === "") {
    return false;
  }

  return value === "1" || value.toLowerCase() === "true" || value.toLowerCase() === "yes";
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
