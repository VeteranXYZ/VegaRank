import { describe, expect, it } from "vitest";
import {
  compareSignalsForConsistency,
  createSmokeReport,
  extractRows,
  fetchJson,
  getMtfSignal,
  runProductionSmokeTest,
} from "../../scripts/smoke-production";

describe("production smoke helpers", () => {
  it("extracts rows from accepted API array variants", () => {
    expect(extractRows({ rows: [{ symbol: "BTCUSDT" }] })).toEqual([
      { symbol: "BTCUSDT" },
    ]);
    expect(extractRows({ items: [{ symbol: "ETHUSDT" }] })).toEqual([
      { symbol: "ETHUSDT" },
    ]);
    expect(extractRows({ data: [{ symbol: "SEIUSDT" }, null] })).toEqual([
      { symbol: "SEIUSDT" },
    ]);
    expect(extractRows({ rows: null })).toEqual([]);
  });

  it("extracts a timeframe signal from joined MTF rows", () => {
    const rows = [
      {
        symbol: "BTCUSDT",
        timeframes: {
          "1h": {
            resultGroup: "risk",
            signalLabel: "breakdown_risk",
          },
        },
      },
    ];

    expect(getMtfSignal(rows, "btcusdt", "1h")).toEqual({
      resultGroup: "risk",
      signalLabel: "breakdown_risk",
    });
    expect(getMtfSignal(rows, "BTCUSDT", "4h")).toBeNull();
  });

  it("classifies consistency comparisons as match, warning mismatch, or missing", () => {
    expect(
      compareSignalsForConsistency({
        symbol: "BTCUSDT",
        timeframe: "1h",
        mtfSignal: {
          resultGroup: "risk",
          signalLabel: "breakdown_risk",
          rankScore: 82,
          scanTime: "2026-06-01T00:00:00.000Z",
        },
        researchSignal: {
          resultGroup: "risk",
          signalLabel: "breakdown_risk",
          rankScore: 82,
          scanTime: "2026-06-01T00:00:00.000Z",
        },
      }).status,
    ).toBe("match");

    const mismatch = compareSignalsForConsistency({
      symbol: "BTCUSDT",
      timeframe: "1h",
      mtfSignal: {
        resultGroup: "risk",
        signalLabel: "breakdown_risk",
        rankScore: 82,
        scanTime: "2026-06-01T00:00:00.000Z",
      },
      researchSignal: {
        resultGroup: "eligible",
        signalLabel: "confirmed",
        rankScore: 82,
        scanTime: "2026-06-01T01:00:00.000Z",
      },
    });

    expect(mismatch.status).toBe("mismatch");
    expect(mismatch.details).toEqual(
      expect.arrayContaining([
        "group: mtf=risk, research=eligible",
        "signalLabel: mtf=breakdown_risk, research=confirmed",
        "scanTime: mtf=2026-06-01T00:00:00.000Z, research=2026-06-01T01:00:00.000Z",
      ]),
    );

    expect(
      compareSignalsForConsistency({
        symbol: "BTCUSDT",
        timeframe: "1h",
        mtfSignal: null,
        researchSignal: { resultGroup: "risk" },
      }).status,
    ).toBe("missing");
  });

  it("classifies fetch failures without throwing and only uses GET", async () => {
    const calls: Array<{ url: string; method?: string }> = [];
    const fetchImpl = async (url: string, init?: { method: "GET" }) => {
      calls.push({ url, method: init?.method });

      return {
        ok: false,
        status: 503,
        text: async () => JSON.stringify({ ok: false, error: "DOWN" }),
      };
    };

    const response = await fetchJson({
      baseUrl: "https://api.auere.com",
      path: "/api/test",
      fetchImpl,
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(503);
    expect(calls).toEqual([
      { url: "https://api.auere.com/api/test", method: "GET" },
    ]);
  });

  it("runs mocked smoke checks with hard passes and consistency warnings", async () => {
    const report = createSmokeReport();
    const fetchImpl = async (url: string, init?: { method: "GET" }) => {
      expect(init?.method).toBe("GET");

      const request = new URL(url);
      const key = `${request.pathname}?${request.searchParams.toString()}`;
      const body = mockResponses[key];

      return {
        ok: Boolean(body),
        status: body ? 200 : 404,
        text: async () =>
          JSON.stringify(body ?? { ok: false, error: "NOT_FOUND" }),
      };
    };

    await runProductionSmokeTest({
      baseUrl: "https://api.auere.com",
      report,
      fetchImpl,
    });

    expect(report.failures).toEqual([]);
    expect(report.passes.map((message) => message.title)).toEqual(
      expect.arrayContaining([
        "/api/scan/mtf-latest?assetClass=crypto",
        "/api/market/context?assetClass=crypto",
        "/api/symbol/research?exchange=binance&symbol=BTCUSDT&timeframe=1h",
        "/api/signal/evaluation?timeframe=4h&group=risk&signalLabel=breakdown_risk&assetClass=crypto",
      ]),
    );
    expect(report.warnings.map((message) => message.title)).toContain(
      "consistency BTCUSDT 1h",
    );
  });
});

const mtfSignal = {
  exchange: "binance",
  market: "spot",
  assetClass: "crypto",
  resultGroup: "risk",
  signalLabel: "breakdown_risk",
  rankScore: 82,
  finalSignalScore: 76,
  scanTime: "2026-06-01T00:00:00.000Z",
};

const mockResponses: Record<string, unknown> = {
  "/api/scan/mtf-latest?assetClass=crypto": {
    ok: true,
    assetClass: "crypto",
    count: 2,
    signalCounts: {
      "1h": 2,
      "4h": 2,
      "1d": 2,
      "1w": 0,
    },
    missingCounts: {
      "1h": 0,
      "4h": 0,
      "1d": 0,
      "1w": 2,
    },
    rows: [
      {
        symbol: "BTCUSDT",
        timeframes: {
          "1h": mtfSignal,
          "4h": mtfSignal,
          "1d": mtfSignal,
          "1w": null,
        },
      },
      {
        symbol: "SEIUSDT",
        timeframes: {
          "1h": mtfSignal,
          "4h": {
            ...mtfSignal,
            scanTime: "2026-06-01T04:00:00.000Z",
          },
          "1d": mtfSignal,
          "1w": null,
        },
      },
    ],
  },
  "/api/market/context?assetClass=crypto": {
    ok: true,
    assetClass: "crypto",
    context: {
      structuralContext: "long_term_mixed",
      marketContext: "risk_off",
      tacticalContext: "short_term_weakness",
      combinedContext: "unstable_transition",
      confidence: "medium",
    },
    summary: {
      title: "Risk-oriented transition",
      description: "Research context.",
      researchPosture: "mixed",
      keyPoints: [],
      warnings: [],
    },
    proxies: {
      BTCUSDT: makeProxyMap(),
      ETHUSDT: makeProxyMap(),
    },
    rules: {
      researchOnly: true,
    },
  },
  "/api/symbol/research?exchange=binance&symbol=BTCUSDT&timeframe=1h": {
    ok: true,
    timeframe: "1h",
    symbol: {
      exchange: "binance",
      market: "spot",
      symbol: "BTCUSDT",
      assetClass: "crypto",
    },
    latest: {
      signal: {
        ...mtfSignal,
        scanTime: "2026-06-01T01:00:00.000Z",
      },
    },
    behaviorDiagnostics: {
      available: true,
      reason: "ok",
    },
    timeframes: [mtfSignal],
  },
  "/api/symbol/research?exchange=binance&symbol=SEIUSDT&timeframe=4h": {
    ok: true,
    timeframe: "4h",
    symbol: {
      exchange: "binance",
      market: "spot",
      symbol: "SEIUSDT",
      assetClass: "crypto",
    },
    latest: {
      signal: {
        ...mtfSignal,
        scanTime: "2026-06-01T04:00:00.000Z",
      },
    },
    behaviorDiagnostics: {
      available: true,
      reason: "ok",
    },
    timeframes: [mtfSignal],
  },
  "/api/signal/evaluation?timeframe=4h&group=risk&signalLabel=breakdown_risk&assetClass=crypto":
    makeEvaluationResponse("down"),
  "/api/signal/evaluation?timeframe=4h&group=eligible&signalLabel=confirmed&assetClass=crypto":
    makeEvaluationResponse("up"),
};

function makeProxyMap() {
  return {
    "1w": {
      available: false,
      timeframe: "1w",
      reason: "missing_symbol",
    },
    "1d": {
      available: true,
      timeframe: "1d",
      group: "risk",
      signalLabel: "breakdown_risk",
    },
    "4h": {
      available: true,
      timeframe: "4h",
      group: "risk",
      signalLabel: "breakdown_risk",
    },
  };
}

function makeEvaluationResponse(expectedDirection: string) {
  return {
    ok: true,
    expectedDirection,
    sample: {
      sourceSignals: 20,
      completedSignals: 18,
      skippedSignals: 2,
      sampleQuality: "strong",
    },
    horizons: {
      "1": {
        sampleSize: 18,
      },
      "3": {
        sampleSize: 18,
      },
    },
    interpretation: {
      summary: "Research-only evaluation.",
      confidence: "strong",
      researchOnly: true,
    },
  };
}
