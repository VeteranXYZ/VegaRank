import { describe, expect, it } from "vitest";
import {
  createCoverageReport,
  evaluateFreshness,
  evaluateFreshnessTimestamp,
  evaluateMarketDataCoverage,
  evaluateObservationReadiness,
  evaluateKeySymbols,
  evaluateLatestRunSelection,
  evaluateMtfCoverage,
  getCoverageExitCode,
  runProductionCoverageCheck,
} from "../../scripts/check-production-coverage";

const now = new Date("2026-06-01T12:00:00.000Z");

describe("production coverage check", () => {
  it("passes a healthy production-like response", async () => {
    const report = createCoverageReport();

    await runProductionCoverageCheck({
      baseUrl: "https://api.vegarank.com",
      report,
      now,
      fetchImpl: makeFetch({
        mtf: makeMtfResponse({
          missingCounts: {
            "1h": 0,
            "4h": 0,
            "1d": 0,
            "1w": 0,
          },
        }),
        latestRuns: makeLatestRunResponses(),
      }),
    });

    expect(report.failures).toEqual([]);
    expect(report.warnings).toEqual([]);
    expect(getCoverageExitCode(report)).toBe(0);
    expect(report.sections.get("MTF Coverage")?.[0]).toBe("count: 413");
    expect(report.sections.get("Key Symbols")?.[0]).toBe(
      "Symbol | 1h | 4h | 1d | 1w | status",
    );
    expect(report.sections.get("Market Candle Coverage")?.[0]).toBe(
      "timeframe | total symbols | healthy | stale | below minimum | latest open time | result",
    );
    expect(report.sections.get("Observation Readiness")?.[0]).toBe(
      "timeframe | run id | diagnostic | complete | partial | missing | coverage lag | result",
    );
  });

  it("fails when MTF count or core timeframe coverage is too low", () => {
    const report = createCoverageReport();

    evaluateMtfCoverage({
      body: makeMtfResponse({
        count: 299,
        signalCounts: {
          "1h": 299,
          "4h": 299,
          "1d": 299,
          "1w": 120,
        },
      }),
      report,
    });

    expect(report.failures.map((message) => message.details.join(" "))).toEqual(
      expect.arrayContaining([
        expect.stringContaining("count is 299"),
        expect.stringContaining("1h signal count is 299"),
        expect.stringContaining("4h signal count is 299"),
        expect.stringContaining("1d signal count is 299"),
      ]),
    );
    expect(getCoverageExitCode(report)).toBe(1);
  });

  it("warns, but does not fail, for low weekly MTF coverage", () => {
    const report = createCoverageReport();

    evaluateMtfCoverage({
      body: makeMtfResponse({
        signalCounts: {
          "1h": 401,
          "4h": 401,
          "1d": 380,
          "1w": 99,
        },
      }),
      report,
    });

    expect(report.failures).toEqual([]);
    expect(report.warnings.map((message) => message.details.join(" "))).toEqual(
      expect.arrayContaining([
        expect.stringContaining("1w signal count is 99"),
      ]),
    );
    expect(getCoverageExitCode(report)).toBe(0);
  });

  it("fails stale 1h data and applies 4h, 1d, and 1w thresholds", () => {
    expect(
      evaluateFreshnessTimestamp({
        timeframe: "1h",
        timestamp: "2026-06-01T05:30:00.000Z",
        now,
      }).status,
    ).toBe("fail");
    expect(
      evaluateFreshnessTimestamp({
        timeframe: "4h",
        timestamp: "2026-05-31T20:00:00.000Z",
        now,
      }).status,
    ).toBe("warn");
    expect(
      evaluateFreshnessTimestamp({
        timeframe: "1d",
        timestamp: "2026-05-30T00:00:00.000Z",
        now,
      }).status,
    ).toBe("warn");
    expect(
      evaluateFreshnessTimestamp({
        timeframe: "1w",
        timestamp: "2026-05-10T00:00:00.000Z",
        now,
      }).status,
    ).toBe("fail");
    expect(
      evaluateFreshnessTimestamp({
        timeframe: "1h",
        timestamp: "not-a-date",
        now,
      }).status,
    ).toBe("fail");
  });

  it("records freshness failures from malformed or missing timestamps", () => {
    const report = createCoverageReport();

    evaluateFreshness({
      body: {
        runs: {
          "1h": {
            finishedAt: "bad",
          },
        },
      },
      rows: [],
      now,
      report,
    });

    expect(report.failures.map((message) => message.title)).toContain("Freshness");
    expect(getCoverageExitCode(report)).toBe(1);
  });

  it("fails when a key symbol is missing entirely", () => {
    const report = createCoverageReport();

    evaluateKeySymbols({
      rows: makeMtfRows().filter((row) => row.symbol !== "SEIUSDT"),
      report,
    });

    expect(report.failures.map((message) => message.details.join(" "))).toContain(
      "SEIUSDT is missing from MTF latest rows.",
    );
    expect(getCoverageExitCode(report)).toBe(1);
  });

  it("warns for non-core weekly gaps but fails BTC/ETH weekly gaps", () => {
    const nonCoreReport = createCoverageReport();
    const nonCoreRows = makeMtfRows({
      missing: {
        SEIUSDT: ["1w"],
      },
    });

    evaluateKeySymbols({ rows: nonCoreRows, report: nonCoreReport });

    expect(nonCoreReport.failures).toEqual([]);
    expect(nonCoreReport.warnings.map((message) => message.details.join(" "))).toContain(
      "SEIUSDT is missing 1w. Weekly signals are optional for non-core key symbols.",
    );
    expect(getCoverageExitCode(nonCoreReport)).toBe(0);

    const coreReport = createCoverageReport();
    const coreRows = makeMtfRows({
      missing: {
        BTCUSDT: ["1w"],
        ETHUSDT: ["1w"],
      },
    });

    evaluateKeySymbols({ rows: coreRows, report: coreReport });

    expect(coreReport.failures.map((message) => message.details.join(" "))).toEqual(
      expect.arrayContaining([
        "BTCUSDT is missing required 1w.",
        "ETHUSDT is missing required 1w.",
      ]),
    );
    expect(getCoverageExitCode(coreReport)).toBe(1);
  });

  it("handles latest-run fallback and metadata policies", () => {
    const coreFallbackReport = createCoverageReport();
    const weeklyFallbackReport = createCoverageReport();
    const missingMetadataReport = createCoverageReport();

    evaluateLatestRunSelection({
      timeframe: "4h",
      body: makeLatestRunResponse("4h", {
        latestRunSelection: {
          isLikelyFullUniverse: false,
          fallbackUsed: true,
        },
      }),
      report: coreFallbackReport,
    });
    evaluateLatestRunSelection({
      timeframe: "1w",
      body: makeLatestRunResponse("1w", {
        symbolsScanned: 120,
        signalsCreated: 118,
        latestRunSelection: {
          isLikelyFullUniverse: false,
          fallbackUsed: true,
        },
      }),
      report: weeklyFallbackReport,
    });
    evaluateLatestRunSelection({
      timeframe: "1h",
      body: makeLatestRunResponse("1h", {
        latestRunSelection: null,
      }),
      report: missingMetadataReport,
    });

    expect(coreFallbackReport.failures.map((message) => message.details.join(" "))).toContain(
      "4h selected run is clearly not full universe.",
    );
    expect(weeklyFallbackReport.failures).toEqual([]);
    expect(weeklyFallbackReport.warnings.map((message) => message.title)).toContain(
      "Latest Run Selection",
    );
    expect(missingMetadataReport.failures).toEqual([]);
    expect(missingMetadataReport.warnings.map((message) => message.details.join(" "))).toContain(
      "1h latestRunSelection metadata is missing; counts are healthy.",
    );
  });

  it("reports stale market candle coverage for core timeframes", () => {
    const report = createCoverageReport();

    const row = evaluateMarketDataCoverage({
      timeframe: "4h",
      body: makeMarketCoverageResponse("4h", {
        summary: {
          totalSymbols: 413,
          healthy: 360,
          stale: 53,
          belowMinimum: 0,
        },
      }),
      report,
    });

    expect(row.result).toBe("fail");
    expect(row.latestOpenTime).toBe("2026-06-01T08:00:00.000Z");
    expect(report.failures.map((message) => message.details.join(" "))).toContain(
      "4h has 53 stale market candle rows; latest sync likely did not catch up.",
    );
  });

  it("reports observation readiness stale data separately from future-candle waiting", () => {
    const staleReport = createCoverageReport();
    const waitingReport = createCoverageReport();

    const staleRow = evaluateObservationReadiness({
      timeframe: "4h",
      runId: "full-4h",
      body: makeReadinessResponse("4h", {
        diagnosticBlocker: "stale_market_data",
        missingCount: 313,
        coverageLagCandles: 3,
      }),
      report: staleReport,
    });
    const waitingRow = evaluateObservationReadiness({
      timeframe: "1h",
      runId: "full-1h",
      body: makeReadinessResponse("1h", {
        diagnosticBlocker: "waiting_for_future_candles",
        missingCount: 413,
        coverageLagCandles: 1,
      }),
      report: waitingReport,
    });

    expect(staleRow.result).toBe("fail");
    expect(staleRow.diagnostic).toBe("stale_market_data");
    expect(waitingRow.result).toBe("pass");
    expect(waitingReport.infos.map((message) => message.details.join(" "))).toContain(
      "1h latest run full-1h is waiting for completed future candles.",
    );
  });

  it("handles malformed API responses as hard failures without crashing", async () => {
    const report = createCoverageReport();

    await runProductionCoverageCheck({
      baseUrl: "https://api.vegarank.com",
      report,
      now,
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        text: async () => "not json",
      }),
    });

    expect(report.failures.length).toBeGreaterThan(0);
    expect(report.failures[0]?.details.join(" ")).toContain("Invalid JSON response");
    expect(getCoverageExitCode(report)).toBe(1);
  });

  it("returns exit code zero for warnings only and one for hard failures", () => {
    const warningReport = createCoverageReport();
    const failureReport = createCoverageReport();

    warningReport.warn("MTF Coverage", ["weekly low"]);
    failureReport.fail("MTF Coverage", ["count low"]);

    expect(getCoverageExitCode(warningReport)).toBe(0);
    expect(getCoverageExitCode(failureReport)).toBe(1);
  });
});

function makeFetch({
  mtf,
  latestRuns,
  marketCoverage = makeMarketCoverageResponses(),
  readiness = makeReadinessResponses(),
}: {
  mtf: unknown;
  latestRuns: Record<string, unknown>;
  marketCoverage?: Record<string, unknown>;
  readiness?: Record<string, unknown>;
}) {
  return async (url: string, init?: { method: "GET" }) => {
    expect(init?.method).toBe("GET");

    const request = new URL(url);
    const search = request.searchParams;
    const body =
      request.pathname === "/api/rankings/mtf-latest"
        ? mtf
        : request.pathname === "/api/rankings/latest"
          ? latestRuns[search.get("timeframe") ?? ""]
          : request.pathname === "/api/market-data/coverage"
            ? marketCoverage[search.get("timeframe") ?? ""]
            : request.pathname === "/api/archive/observation-readiness"
              ? readiness[search.get("timeframe") ?? ""]
          : null;

    return {
      ok: body !== null,
      status: body === null ? 404 : 200,
      text: async () => JSON.stringify(body ?? { ok: false }),
    };
  };
}

function makeMtfResponse(
  overrides: {
    count?: number;
    signalCounts?: Record<string, number>;
    missingCounts?: Record<string, number>;
    rows?: ReturnType<typeof makeMtfRows>;
    runs?: Record<string, unknown>;
  } = {},
) {
  return {
    ok: true,
    count: overrides.count ?? 413,
    signalCounts: overrides.signalCounts ?? {
      "1h": 413,
      "4h": 409,
      "1d": 393,
      "1w": 192,
    },
    missingCounts: overrides.missingCounts ?? {
      "1h": 0,
      "4h": 4,
      "1d": 20,
      "1w": 221,
    },
    rows: overrides.rows ?? makeMtfRows(),
    runs: overrides.runs ?? {
      "1h": makeMtfRun("1h", "2026-06-01T11:15:00.000Z"),
      "4h": makeMtfRun("4h", "2026-06-01T08:15:00.000Z"),
      "1d": makeMtfRun("1d", "2026-06-01T00:15:00.000Z"),
      "1w": makeMtfRun("1w", "2026-05-30T00:15:00.000Z"),
    },
  };
}

function makeMtfRows({
  missing = {},
}: {
  missing?: Partial<Record<string, string[]>>;
} = {}) {
  return [
    "BTCUSDT",
    "ETHUSDT",
    "SOLUSDT",
    "BNBUSDT",
    "XRPUSDT",
    "LINKUSDT",
    "SEIUSDT",
  ].map((symbol) => ({
    symbol,
    timeframes: {
      "1h": missing[symbol]?.includes("1h") ? null : makeSignal(symbol, "1h"),
      "4h": missing[symbol]?.includes("4h") ? null : makeSignal(symbol, "4h"),
      "1d": missing[symbol]?.includes("1d") ? null : makeSignal(symbol, "1d"),
      "1w": missing[symbol]?.includes("1w") ? null : makeSignal(symbol, "1w"),
    },
  }));
}

function makeMtfRun(timeframe: string, finishedAt: string) {
  return {
    id: `full-${timeframe}`,
    timeframe,
    status: "success",
    symbolsScanned: timeframe === "1w" ? 192 : 413,
    signalsCreated: timeframe === "1w" ? 192 : 413,
    finishedAt,
    latestRunSelection: {
      isLikelyFullUniverse: true,
      fallbackUsed: false,
    },
  };
}

function makeLatestRunResponses() {
  return {
    "1h": makeLatestRunResponse("1h"),
    "4h": makeLatestRunResponse("4h"),
    "1d": makeLatestRunResponse("1d"),
    "1w": makeLatestRunResponse("1w", {
      symbolsScanned: 192,
      signalsCreated: 192,
    }),
  };
}

function makeMarketCoverageResponses() {
  return {
    "1h": makeMarketCoverageResponse("1h"),
    "4h": makeMarketCoverageResponse("4h"),
    "1d": makeMarketCoverageResponse("1d"),
    "1w": makeMarketCoverageResponse("1w", {
      summary: {
        totalSymbols: 413,
        healthy: 192,
        stale: 0,
        belowMinimum: 221,
      },
    }),
  };
}

function makeMarketCoverageResponse(
  timeframe: string,
  overrides: {
    summary?: Partial<{
      totalSymbols: number;
      healthy: number;
      stale: number;
      belowMinimum: number;
    }>;
  } = {},
) {
  const summary = {
    totalSymbols: overrides.summary?.totalSymbols ?? 413,
    healthy: overrides.summary?.healthy ?? 413,
    stale: overrides.summary?.stale ?? 0,
    belowMinimum: overrides.summary?.belowMinimum ?? 0,
  };

  return {
    ok: true,
    timeframe,
    assetClass: "crypto",
    summary,
    rows: [
      {
        symbol: "BTCUSDT",
        timeframe,
        latestOpenTime: "2026-06-01T08:00:00.000Z",
        latestCloseTime: "2026-06-01T11:59:59.999Z",
        isStale: false,
      },
    ],
  };
}

function makeReadinessResponses() {
  return {
    "1h": makeReadinessResponse("1h"),
    "4h": makeReadinessResponse("4h"),
    "1d": makeReadinessResponse("1d"),
    "1w": makeReadinessResponse("1w", {
      completeCount: 100,
      partialCount: 10,
      missingCount: 82,
    }),
  };
}

function makeReadinessResponse(
  timeframe: string,
  overrides: Partial<{
    diagnosticBlocker: string;
    completeCount: number;
    partialCount: number;
    missingCount: number;
    coverageLagCandles: number;
  }> = {},
) {
  const completeCount = overrides.completeCount ?? 300;
  const partialCount = overrides.partialCount ?? 20;
  const missingCount = overrides.missingCount ?? 0;

  return {
    ok: true,
    selectedRun: {
      run: {
        runId: `full-${timeframe}`,
        timeframe,
      },
      state: "ready",
      blocker: "observable",
      diagnosticBlocker: overrides.diagnosticBlocker ?? "observable",
      rowCount: completeCount + partialCount + missingCount,
      completeCount,
      partialCount,
      missingCount,
      coverageLagCandles: overrides.coverageLagCandles ?? 0,
    },
    metadata: {
      timeframe,
      diagnosticBlocker: overrides.diagnosticBlocker ?? "observable",
    },
  };
}

function makeLatestRunResponse(
  timeframe: string,
  overrides: {
    symbolsScanned?: number;
    signalsCreated?: number;
    latestRunSelection?: Record<string, unknown> | null;
  } = {},
) {
  const latestRunSelection =
    overrides.latestRunSelection === undefined
      ? {
          isLikelyFullUniverse: true,
          fallbackUsed: false,
        }
      : overrides.latestRunSelection;

  return {
    ok: true,
    run: {
      id: `full-${timeframe}`,
      status: "success",
      symbolsScanned: overrides.symbolsScanned ?? 413,
      signalsCreated: overrides.signalsCreated ?? 409,
    },
    summary: latestRunSelection
      ? {
          latestRunSelection,
        }
      : {},
  };
}

function makeSignal(symbol: string, timeframe: string) {
  return {
    symbol,
    timeframe,
    resultGroup: "risk",
    signalLabel: "breakdown_risk",
    scanTime: "2026-06-01T11:00:00.000Z",
  };
}
