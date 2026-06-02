import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  buildHistoricalObservationReadinessUrl,
  buildHistoricalSnapshotObservationsUrl,
  buildHistoricalSnapshotUrl,
  buildHistoricalSnapshotsUrl,
  classifyForwardObservationMaturity,
  ForwardObservationSection,
  formatHistoryDateTime,
  formatHistoryPrimarySignal,
  getObservationProbeRuns,
  HistoryPageClient,
  selectForwardObservationResult,
  SnapshotTable,
} from "./HistoryPageClient";

describe("HistoryPageClient API URLs", () => {
  it("uses the public trade API historical snapshot endpoints", () => {
    const runId = "fcc05284-c7a0-4990-9bcb-5dd165d83c37";

    expect(
      buildHistoricalSnapshotsUrl({
        timeframe: "4h",
        assetClass: "crypto",
        limit: 25,
        tradeApiBaseUrl: "https://api.auere.com/",
      }),
    ).toBe(
      "https://api.auere.com/api/history/snapshots?timeframe=4h&assetClass=crypto&limit=25",
    );
    expect(
      buildHistoricalSnapshotUrl({
        runId,
        assetClass: "crypto",
        tradeApiBaseUrl: "https://api.auere.com/",
      }),
    ).toBe(
      `https://api.auere.com/api/history/snapshot?runId=${runId}&assetClass=crypto`,
    );
    expect(
      buildHistoricalObservationReadinessUrl({
        timeframe: "4h",
        runId,
        assetClass: "crypto",
        window: 3,
        tradeApiBaseUrl: "https://api.auere.com/",
      }),
    ).toBe(
      `https://api.auere.com/api/history/observation-readiness?timeframe=4h&assetClass=crypto&window=3&runId=${runId}`,
    );
    expect(
      buildHistoricalSnapshotObservationsUrl({
        runId,
        assetClass: "crypto",
        window: 3,
        tradeApiBaseUrl: "https://api.auere.com/",
      }),
    ).toBe(
      `https://api.auere.com/api/history/snapshot-observations?runId=${runId}&assetClass=crypto&window=3`,
    );
  });
});

describe("HistoryPageClient display formatting", () => {
  it("renders Historical Research and research-only copy", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { enabled: false } },
    });
    const html = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client },
        createElement(HistoryPageClient),
      ),
    );

    expect(html).toContain("Historical Research");
    expect(html).toContain("Research-only. Not financial advice.");
    expect(html).toContain("Historical observations are not predictions.");
  });

  it("formats dates deterministically without browser locale text", () => {
    const formatted = formatHistoryDateTime("2026-06-02T08:05:00.000Z");

    expect(formatted).toBe("2026-06-02 08:05");
    expect(formatted).not.toContain("2026年");
    expect(formatHistoryDateTime(null)).toBe("Not available");
  });

  it("maps action-like History labels to safer research wording", () => {
    expect(formatHistoryPrimarySignal("Do not chase")).toBe(
      "Overheated caution",
    );
    expect(formatHistoryPrimarySignal("Avoid")).toBe("Risk review");
    expect(formatHistoryPrimarySignal("Manual review")).toBe("Manual review");
  });

  it("renders safer History table labels and preserves full row count copy", () => {
    const html = renderToStaticMarkup(
      createElement(SnapshotTable, {
        isLoading: false,
        rows: [
          makeHistoryRow({
            id: "overheated-row",
            symbol: "HOTUSDT",
            primarySignal: "Do not chase",
          }),
          makeHistoryRow({
            id: "risk-row",
            symbol: "RISKUSDT",
            primarySignal: "Avoid",
          }),
        ],
      }),
    );

    expect(html).toContain("Snapshot Rows");
    expect(html).toContain("Full stored single-timeframe result set");
    expect(html).toContain("2 rows");
    expect(html).toContain("Overheated caution");
    expect(html).toContain("Risk review");
    expect(html).not.toContain("Do not chase");
    expect(html).not.toContain("Avoid");
    expect(html).not.toContain("Show More");
    expect(html).not.toContain("Pagination");
  });

  it("renders Forward Observation with neutral copy and full row visibility", () => {
    const response = makeObservationResponse();
    const html = renderToStaticMarkup(
      createElement(ForwardObservationSection, {
        window: 3,
        onWindowChange: () => undefined,
        response,
        maturity: classifyForwardObservationMaturity(response),
        observationRun: response.run,
        selectionMode: "selected",
        isLoading: false,
        isFetching: false,
        error: null,
      }),
    );

    expect(html).toContain("Forward Observation");
    expect(html).toContain("Research-only. Historical observations are not predictions.");
    expect(html).toContain("Using selected run");
    expect(html).toContain("1 candle");
    expect(html).toContain("3 candles");
    expect(html).toContain("5 candles");
    expect(html).toContain("10 candles");
    expect(html).toContain("Selected Window");
    expect(html).toContain("Complete");
    expect(html).toContain("Partial");
    expect(html).toContain("Missing");
    expect(html).toContain("Observed Change");
    expect(html).toContain("Max Drawdown");
    expect(html).toContain("Data Status");
    expect(html).toContain("SEIUSDT");
    expect(html).toContain("RISKUSDT");
    expect(html).toContain("NEWUSDT");
    expect(html).toContain("Insufficient future candles");
    expect(html).not.toContain("Observed Return");
    expect(html).not.toContain("Win rate");
    expect(html).not.toContain("Accuracy");
    expect(html).not.toContain("Worked");
    expect(html).not.toContain("Buy");
    expect(html).not.toContain("Sell");
    expect(html).not.toContain("Prediction");
    expect(html).not.toContain("Show More");
    expect(html).not.toContain("Pagination");
    expect(html).not.toContain("top-100");
  });

  it("renders all-future-candle-missing observations as a compact not-ready state", () => {
    const response = makeObservationResponse({
      metadata: {
        rowCount: 3,
        completeCount: 0,
        partialCount: 0,
        missingCount: 3,
      },
      rows: [
        makeObservationRow({
          id: "missing-1",
          symbol: "AAAUSDT",
          observedClose: null,
          observedChangePct: null,
          maxDrawdownPct: null,
          dataStatus: "missing",
          missingReason: "no_future_candles",
        }),
        makeObservationRow({
          id: "missing-2",
          symbol: "BBBUSDT",
          observedClose: null,
          observedChangePct: null,
          maxDrawdownPct: null,
          dataStatus: "missing",
          missingReason: "no_future_candles",
        }),
        makeObservationRow({
          id: "missing-3",
          symbol: "CCCUSDT",
          observedClose: null,
          observedChangePct: null,
          maxDrawdownPct: null,
          dataStatus: "missing",
          missingReason: "no_future_candles",
        }),
      ],
    });
    const html = renderToStaticMarkup(
      createElement(ForwardObservationSection, {
        window: 3,
        onWindowChange: () => undefined,
        response,
        readiness: makeReadinessResponse({
          selectedRun: makeReadinessRun({
            run: response.run,
            state: "not_ready",
            blocker: "market_data_coverage",
            rowCount: 3,
            completeCount: 0,
            partialCount: 0,
            missingCount: 3,
            dominantMissingReason: "no_future_candles",
            dominantMissingReasonCount: 3,
            expectedCompleteTime: "2026-06-02T12:00:00.000Z",
          }),
          observationRun: null,
          recommendedRun: null,
          blocker: "market_data_coverage",
          coverage: {
            latestOpenTime: "2026-06-01T20:00:00.000Z",
            latestOpenTimeSymbolCount: 100,
            totalSymbols: 413,
          },
        }),
        maturity: classifyForwardObservationMaturity(response),
        observationRun: response.run,
        selectionMode: "not_ready",
        isLoading: false,
        isFetching: false,
        error: null,
      }),
    );

    expect(html).toContain("Forward observation is not ready yet");
    expect(html).toContain("Market candle coverage is not far enough");
    expect(html).toContain("No completed future candles yet");
    expect(html).toContain("Latest Candle");
    expect(html).toContain("2026-06-01 20:00");
    expect(html).toContain("100 / 413");
    expect(html).toContain("For 4h + 3 candles, expect roughly 12 hours");
    expect(html).toContain("Complete");
    expect(html).toContain("Partial");
    expect(html).toContain("Missing");
    expect(html).not.toContain("Observed Change");
    expect(html).not.toContain("Max Drawdown");
    expect(html).not.toContain("AAAUSDT");
    expect(html).not.toContain("BBBUSDT");
    expect(html).not.toContain("CCCUSDT");
  });

  it("classifies maturity and falls back to the most recent observable run", () => {
    const latestRun = makeObservationRun({
      runId: "11111111-1111-4111-8111-111111111111",
      finishedAt: "2026-06-02T12:00:00.000Z",
    });
    const olderRun = makeObservationRun({
      runId: "22222222-2222-4222-8222-222222222222",
      finishedAt: "2026-06-02T00:00:00.000Z",
    });
    const latestResponse = makeObservationResponse({
      run: latestRun,
      metadata: {
        rowCount: 2,
        completeCount: 0,
        partialCount: 0,
        missingCount: 2,
      },
      rows: [
        makeObservationRow({
          id: "latest-missing-1",
          symbol: "AAAUSDT",
          observedClose: null,
          observedChangePct: null,
          maxDrawdownPct: null,
          dataStatus: "missing",
          missingReason: "no_future_candles",
        }),
        makeObservationRow({
          id: "latest-missing-2",
          symbol: "BBBUSDT",
          observedClose: null,
          observedChangePct: null,
          maxDrawdownPct: null,
          dataStatus: "missing",
          missingReason: "no_future_candles",
        }),
      ],
    });
    const olderResponse = makeObservationResponse({
      run: olderRun,
      metadata: {
        rowCount: 2,
        completeCount: 1,
        partialCount: 0,
        missingCount: 1,
      },
    });

    expect(classifyForwardObservationMaturity(latestResponse).state).toBe(
      "not_ready",
    );
    expect(classifyForwardObservationMaturity(olderResponse).state).toBe(
      "ready",
    );

    const selection = selectForwardObservationResult({
      selectedRunId: latestRun.runId,
      candidates: [
        makeObservationCandidate(latestRun, latestResponse),
        makeObservationCandidate(olderRun, olderResponse),
      ],
    });

    expect(selection.mode).toBe("observable");
    expect(selection.run?.runId).toBe(olderRun.runId);
    expect(selection.response?.metadata.completeCount).toBe(1);
  });

  it("labels recommended observable runs without changing the selected stored run", () => {
    const selectedRun = makeObservationRun({
      runId: "11111111-1111-4111-8111-111111111111",
      finishedAt: "2026-06-02T15:05:15.000Z",
    });
    const recommendedRun = makeObservationRun({
      runId: "22222222-2222-4222-8222-222222222222",
      finishedAt: "2026-06-02T02:52:00.000Z",
    });
    const response = makeObservationResponse({ run: recommendedRun });
    const html = renderToStaticMarkup(
      createElement(ForwardObservationSection, {
        window: 3,
        onWindowChange: () => undefined,
        response,
        readiness: makeReadinessResponse({
          selectedRun: makeReadinessRun({
            run: selectedRun,
            state: "not_ready",
            blocker: "market_data_coverage",
            rowCount: 409,
            completeCount: 0,
            partialCount: 0,
            missingCount: 409,
            dominantMissingReason: "no_future_candles",
            dominantMissingReasonCount: 409,
          }),
          recommendedRun: makeReadinessRun({
            run: recommendedRun,
            state: "ready",
            blocker: "observable",
            rowCount: 409,
            completeCount: 0,
            partialCount: 96,
            missingCount: 313,
            dominantMissingReason: "no_future_candles",
            dominantMissingReasonCount: 313,
          }),
          observationRun: makeReadinessRun({
            run: recommendedRun,
            state: "ready",
            blocker: "observable",
            rowCount: 409,
            completeCount: 0,
            partialCount: 96,
            missingCount: 313,
            dominantMissingReason: "no_future_candles",
            dominantMissingReasonCount: 313,
          }),
          blocker: "market_data_coverage",
        }),
        maturity: classifyForwardObservationMaturity(response),
        observationRun: recommendedRun,
        selectionMode: "observable",
        isLoading: false,
        isFetching: false,
        error: null,
      }),
    );

    expect(html).toContain("Using most recent observable run");
    expect(html).toContain("Selected stored run 11111111");
    expect(html).toContain("Observation run 22222222");
    expect(html).toContain("Finished 2026-06-02 02:52");
  });

  it("keeps observation probing bounded and adjusts the probe range by window", () => {
    const snapshots = Array.from({ length: 20 }, (_, index) =>
      makeObservationRun({
        runId: `${String(index).padStart(8, "0")}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`,
      }),
    );

    expect(
      getObservationProbeRuns({
        snapshots,
        selectedRunId: snapshots[0]?.runId ?? null,
        window: 1,
      }),
    ).toHaveLength(3);
    expect(
      getObservationProbeRuns({
        snapshots,
        selectedRunId: snapshots[0]?.runId ?? null,
        window: 10,
      }),
    ).toHaveLength(12);
    expect(
      getObservationProbeRuns({
        snapshots,
        selectedRunId: snapshots[5]?.runId ?? null,
        window: 3,
      }).map((run) => run.runId),
    ).toEqual(snapshots.slice(5, 10).map((run) => run.runId));
  });
});

function makeHistoryRow(overrides: {
  id: string;
  symbol: string;
  primarySignal: string;
}) {
  return {
    id: overrides.id,
    scanRunId: "fcc05284-c7a0-4990-9bcb-5dd165d83c37",
    symbol: overrides.symbol,
    exchange: "binance",
    market: "spot",
    timeframe: "4h" as const,
    group: "risk",
    label: "breakdown_risk",
    primarySignal: overrides.primarySignal,
    riskNotes: null,
    riskTypes: [],
    rankScore: 12,
    componentScores: {
      opportunityScore: 10,
      confirmationScore: 20,
      riskScore: 80,
      trendScore: 15,
      momentumScore: 25,
    },
    scannerVersion: "test",
    scoringVersion: "test",
  };
}

function makeObservationResponse(
  overrides: Partial<{
    run: ReturnType<typeof makeObservationRun>;
    metadata: Partial<{
      window: 1 | 3 | 5 | 10;
      selectedWindow: 1 | 3 | 5 | 10;
      rowCount: number;
      completeCount: number;
      partialCount: number;
      missingCount: number;
      timeframe: "1h" | "4h" | "1d" | "1w";
    }>;
    rows: ReturnType<typeof makeObservationRow>[];
  }> = {},
) {
  const rows = overrides.rows ?? [
    makeObservationRow({
      id: "complete-row",
      symbol: "SEIUSDT",
      dataStatus: "complete",
      missingReason: null,
    }),
    makeObservationRow({
      id: "partial-row",
      symbol: "RISKUSDT",
      dataStatus: "partial",
      missingReason: "insufficient_future_candles",
    }),
    makeObservationRow({
      id: "missing-row",
      symbol: "NEWUSDT",
      observedClose: null,
      observedChangePct: null,
      maxDrawdownPct: null,
      dataStatus: "missing",
      missingReason: "no_future_candles",
    }),
  ];
  const completeCount =
    overrides.metadata?.completeCount ??
    rows.filter((row) => row.dataStatus === "complete").length;
  const partialCount =
    overrides.metadata?.partialCount ??
    rows.filter((row) => row.dataStatus === "partial").length;
  const missingCount =
    overrides.metadata?.missingCount ??
    rows.filter((row) => row.dataStatus === "missing").length;

  return {
    ok: true,
    run: overrides.run ?? makeObservationRun(),
    metadata: {
      window: overrides.metadata?.window ?? 3,
      selectedWindow: overrides.metadata?.selectedWindow ?? 3,
      windowUnit: "completed_candles" as const,
      rowCount: overrides.metadata?.rowCount ?? rows.length,
      completeCount,
      partialCount,
      missingCount,
      limited: false,
      timeframe: overrides.metadata?.timeframe ?? "4h",
      assetClass: "crypto",
      disclaimer:
        "Research-only. Not financial advice. Historical observations are not predictions.",
    },
    rows,
  };
}

function makeReadinessResponse(
  overrides: Partial<{
    selectedRun: ReturnType<typeof makeReadinessRun> | null;
    recommendedRun: ReturnType<typeof makeReadinessRun> | null;
    observationRun: ReturnType<typeof makeReadinessRun> | null;
    blocker:
      | "observable"
      | "time_maturity"
      | "market_data_coverage"
      | "mixed"
      | "unavailable"
      | "no_runs";
    coverage: Partial<{
      latestOpenTime: string | null;
      latestOpenTimeSymbolCount: number;
      totalSymbols: number;
      symbolsWithCandles: number;
    }>;
  }> = {},
) {
  const selectedRun = overrides.selectedRun ?? makeReadinessRun();

  return {
    ok: true,
    selectedRun,
    recommendedRun: overrides.recommendedRun ?? null,
    observationRun: overrides.observationRun ?? selectedRun,
    coverage: {
      timeframe: "4h" as const,
      assetClass: "crypto",
      totalSymbols: overrides.coverage?.totalSymbols ?? 413,
      symbolsWithCandles: overrides.coverage?.symbolsWithCandles ?? 413,
      latestOpenTime:
        overrides.coverage?.latestOpenTime ?? "2026-06-02T12:00:00.000Z",
      latestOpenTimeSymbolCount:
        overrides.coverage?.latestOpenTimeSymbolCount ?? 413,
      latestOpenTimeCoveragePct: 100,
      buckets: [
        {
          latestOpenTime:
            overrides.coverage?.latestOpenTime ?? "2026-06-02T12:00:00.000Z",
          symbolCount: overrides.coverage?.latestOpenTimeSymbolCount ?? 413,
        },
      ],
    },
    metadata: {
      timeframe: "4h" as const,
      assetClass: "crypto",
      window: 3 as const,
      selectedWindow: 3 as const,
      windowUnit: "completed_candles" as const,
      blocker: overrides.blocker ?? "observable",
      candidateCount: 2,
      candidateLimit: 25,
      fullUniverseMinExpectedSymbols: 300,
      disclaimer:
        "Research-only. Not financial advice. Historical observations are not predictions.",
    },
  };
}

function makeReadinessRun(
  overrides: Partial<{
    run: ReturnType<typeof makeObservationRun>;
    state: "ready" | "not_ready" | "unavailable";
    blocker:
      | "observable"
      | "time_maturity"
      | "market_data_coverage"
      | "mixed"
      | "unavailable"
      | "no_runs";
    rowCount: number;
    completeCount: number;
    partialCount: number;
    missingCount: number;
    dominantMissingReason: string | null;
    dominantMissingReasonCount: number;
    latestAnchorTime: string | null;
    expectedCompleteTime: string | null;
  }> = {},
) {
  const state = overrides.state ?? "ready";

  return {
    run: overrides.run ?? makeObservationRun(),
    state,
    blocker: overrides.blocker ?? (state === "ready" ? "observable" : "unavailable"),
    isObservable: state === "ready",
    isLimited: overrides.run?.isLikelyFullUniverse === false,
    rowCount: overrides.rowCount ?? 3,
    completeCount: overrides.completeCount ?? (state === "ready" ? 1 : 0),
    partialCount: overrides.partialCount ?? 0,
    missingCount: overrides.missingCount ?? (state === "ready" ? 2 : 3),
    dominantMissingReason: overrides.dominantMissingReason ?? null,
    dominantMissingReasonCount: overrides.dominantMissingReasonCount ?? 0,
    latestAnchorTime:
      overrides.latestAnchorTime ?? "2026-06-02T00:00:00.000Z",
    expectedCompleteTime: overrides.expectedCompleteTime ?? null,
  };
}

function makeObservationRun(
  overrides: Partial<{
    runId: string;
    timeframe: "1h" | "4h" | "1d" | "1w";
    finishedAt: string;
    isLikelyFullUniverse: boolean;
  }> = {},
) {
  return {
    runId: overrides.runId ?? "fcc05284-c7a0-4990-9bcb-5dd165d83c37",
    timeframe: overrides.timeframe ?? "4h",
    status: "success" as const,
    symbolsScanned: 409,
    signalsCreated: 409,
    finishedAt: overrides.finishedAt ?? "2026-06-02T08:05:00.000Z",
    isLikelyFullUniverse: overrides.isLikelyFullUniverse ?? true,
  };
}

function makeObservationCandidate(
  run: ReturnType<typeof makeObservationRun>,
  response: ReturnType<typeof makeObservationResponse> | null,
) {
  return {
    run,
    response,
    isLoading: false,
    isFetching: false,
    error: null,
  };
}

function makeObservationRow(overrides: {
  id: string;
  symbol: string;
  observedClose?: number | null;
  observedChangePct?: number | null;
  maxDrawdownPct?: number | null;
  dataStatus: "complete" | "partial" | "missing";
  missingReason: string | null;
}) {
  return {
    id: overrides.id,
    scanRunId: "fcc05284-c7a0-4990-9bcb-5dd165d83c37",
    symbol: overrides.symbol,
    exchange: "binance",
    market: "spot",
    timeframe: "4h" as const,
    group: "risk",
    label: "breakdown_risk",
    primarySignal: "Risk review",
    rankScore: 12,
    anchorTime: "2026-06-02T00:00:00.000Z",
    anchorClose: 100,
    anchorSource: "stored_signal" as const,
    window: 3 as const,
    observedClose: overrides.observedClose ?? 102,
    observedChangePct: overrides.observedChangePct ?? 2,
    maxDrawdownPct: overrides.maxDrawdownPct ?? -3,
    dataStatus: overrides.dataStatus,
    missingReason: overrides.missingReason,
  };
}
