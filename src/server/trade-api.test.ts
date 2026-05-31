import type http from "node:http";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleTradeApiRequest } from "./trade-api";

const getLatestScanRunMock = vi.hoisted(() => vi.fn());
const listLatestScanSignalsForRunMock = vi.hoisted(() => vi.fn());
const closeMock = vi.hoisted(() => vi.fn());
const pgScannerResultsStoreMock = vi.hoisted(() =>
  vi.fn(function PgScannerResultsStore() {
    return {
      getLatestScanRun: getLatestScanRunMock,
      listLatestScanSignalsForRun: listLatestScanSignalsForRunMock,
      close: closeMock,
    };
  }),
);

vi.mock("@/lib/storage/postgres/scannerResultsPg", () => ({
  PgScannerResultsStore: pgScannerResultsStoreMock,
}));

describe("trade-api CORS", () => {
  beforeEach(() => {
    getLatestScanRunMock.mockReset();
    getLatestScanRunMock.mockResolvedValue(null);
    listLatestScanSignalsForRunMock.mockReset();
    listLatestScanSignalsForRunMock.mockResolvedValue([]);
    closeMock.mockReset();
    closeMock.mockResolvedValue(undefined);
    pgScannerResultsStoreMock.mockClear();
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
