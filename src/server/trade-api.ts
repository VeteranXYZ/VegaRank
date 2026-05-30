import http from "node:http";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import Redis from "ioredis";
import { PgMarketDataStore } from "@/lib/storage/postgres/marketDataPg";
import { PgScannerResultsStore } from "@/lib/storage/postgres/scannerResultsPg";

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
loadDotEnv();

const host = process.env.API_HOST ?? "127.0.0.1";
const port = parsePort(process.env.PORT ?? "3000");

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? host}`);

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

    if (url.pathname === "/api/symbols") {
      await handleSymbols(response, url);
      return;
    }

    if (url.pathname === "/api/candles") {
      await handleCandles(response, url);
      return;
    }

    if (url.pathname === "/api/market-sync/jobs") {
      await handleMarketSyncJobs(response, url);
      return;
    }

    if (url.pathname === "/api/scan/latest") {
      await handleLatestScan(response, url);
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
});

server.on("error", (error) => {
  const code = getSafeErrorCode(error) ?? "SERVER_LISTEN_FAILED";
  console.error(`${serviceName} failed to start: ${code}`);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.info(`${serviceName} listening on http://${host}:${port}`);
});

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

async function handleLatestScan(response: http.ServerResponse, url: URL) {
  const timeframe = url.searchParams.get("timeframe")?.trim() ?? "4h";
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

  if (!limit.valid) {
    sendJson(response, 400, { ok: false, service: serviceName, error: limit.error });
    return;
  }

  const store = new PgScannerResultsStore();

  try {
    const run = await store.getLatestScanRun({ timeframe });
    const signals = run
      ? await store.listLatestScanSignals({ scanRunId: run.id, limit: limit.value })
      : [];

    sendJson(response, 200, {
      ok: true,
      run,
      signals,
      count: signals.length,
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
