import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  buildHistoryRefreshScope,
  buildHistoricalObservationReadinessUrl,
  buildHistoricalSnapshotObservationsUrl,
  buildHistoricalSnapshotUrl,
  buildHistoricalSnapshotsUrl,
  classifyForwardObservationMaturity,
  deriveForwardObservationUiState,
  ForwardObservationSection,
  formatHistoryDateTime,
  formatHistoryPrimarySignal,
  getNextRefreshingTimeframeAfterCompletion,
  getForwardObservationRowsRunId,
  getObservationProbeRuns,
  HistoryPageClient,
  isHistoryRefreshActiveForTimeframe,
  RecentSuccessfulRunsPanel,
  recentRunsPanelClassName,
  recentRunsScrollContainerClassName,
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

describe("HistoryPageClient refresh scope", () => {
  it("scopes 4h refresh requests to 4h data and does not request other timeframes", () => {
    const scope = buildHistoryRefreshScope({
      timeframe: "4h",
      assetClass: "crypto",
      selectedRunId: "2366b0f7-1111-4111-8111-111111111111",
      observationRunId: "a9b5d020-2222-4222-8222-222222222222",
      window: 3,
    });
    const keys = [...scope.blockingQueryKeys, ...scope.backgroundQueryKeys];

    expect(scope.timeframe).toBe("4h");
    expect(scope.blockingQueryKeys).toEqual([
      ["history-snapshots", "4h", "crypto"],
      [
        "history-snapshot",
        "2366b0f7-1111-4111-8111-111111111111",
        "crypto",
      ],
      [
        "history-observation-readiness",
        "4h",
        "2366b0f7-1111-4111-8111-111111111111",
        "crypto",
        3,
      ],
    ]);
    expect(scope.backgroundQueryKeys).toEqual([
      [
        "history-snapshot-observations",
        "a9b5d020-2222-4222-8222-222222222222",
        "crypto",
        3,
      ],
    ]);
    expect(keys.some((key) => key.includes("1h"))).toBe(false);
    expect(keys.some((key) => key.includes("1d"))).toBe(false);
    expect(keys.some((key) => key.includes("1w"))).toBe(false);
  });

  it("switching to 1d builds only 1d-specific run and readiness keys", () => {
    const scope = buildHistoryRefreshScope({
      timeframe: "1d",
      assetClass: "crypto",
      selectedRunId: "ff5a19ed-1111-4111-8111-111111111111",
      observationRunId: "61d67176-2222-4222-8222-222222222222",
      window: 3,
    });

    expect(scope.blockingQueryKeys[0]).toEqual([
      "history-snapshots",
      "1d",
      "crypto",
    ]);
    expect(scope.blockingQueryKeys[2]).toEqual([
      "history-observation-readiness",
      "1d",
      "ff5a19ed-1111-4111-8111-111111111111",
      "crypto",
      3,
    ]);
    expect(scope.blockingQueryKeys).not.toContainEqual([
      "history-snapshots",
      "4h",
      "crypto",
    ]);
  });

  it("keeps the Refresh button tied to the current timeframe only", () => {
    expect(
      isHistoryRefreshActiveForTimeframe({
        refreshingTimeframe: "4h",
        timeframe: "4h",
      }),
    ).toBe(true);
    expect(
      isHistoryRefreshActiveForTimeframe({
        refreshingTimeframe: "4h",
        timeframe: "1d",
      }),
    ).toBe(false);
    expect(
      isHistoryRefreshActiveForTimeframe({
        refreshingTimeframe: null,
        timeframe: "4h",
      }),
    ).toBe(false);
  });

  it("clears only the completed timeframe so stale requests cannot hold the current Refresh state", () => {
    expect(
      getNextRefreshingTimeframeAfterCompletion({
        refreshingTimeframe: "4h",
        completedTimeframe: "4h",
      }),
    ).toBeNull();
    expect(
      getNextRefreshingTimeframeAfterCompletion({
        refreshingTimeframe: "1d",
        completedTimeframe: "4h",
      }),
    ).toBe("1d");
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
    expect(html).toContain("This is the scanner snapshot you selected");
    expect(html).toContain("Snapshot Rows below come from this run");
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
    expect(html).toContain(
      "Snapshot Rows are the scanner output from the selected stored run",
    );
    expect(html).toContain(
      "They are not necessarily the same run used for Forward Observation",
    );
    expect(html).toContain("2 rows");
    expect(html).toContain("Overheated caution");
    expect(html).toContain("Risk review");
    expect(html).not.toContain("Do not chase");
    expect(html).not.toContain("Avoid");
    expect(html).not.toContain("Show More");
    expect(html).not.toContain("Pagination");
  });

  it("renders Recent Successful Runs as a wide-screen contained scroll panel", () => {
    const selectedRun = makeObservationRun({
      runId: "11111111-1111-4111-8111-111111111111",
      finishedAt: "2026-06-02T08:05:00.000Z",
    });
    const olderRun = makeObservationRun({
      runId: "22222222-2222-4222-8222-222222222222",
      finishedAt: "2026-06-02T04:05:00.000Z",
    });
    const limitedRecommendedRun = makeObservationRun({
      runId: "33333333-3333-4333-8333-333333333333",
      finishedAt: "2026-06-02T00:05:00.000Z",
      isLikelyFullUniverse: false,
    });
    const html = renderToStaticMarkup(
      createElement(RecentSuccessfulRunsPanel, {
        timeframe: "4h",
        snapshots: [selectedRun, olderRun, limitedRecommendedRun],
        selectedRunId: selectedRun.runId,
        latestRunId: selectedRun.runId,
        observationRunId: olderRun.runId,
        recommendedRunId: limitedRecommendedRun.runId,
        isError: false,
        errorMessage: null,
        isLoading: false,
        onSelectRun: () => undefined,
      }),
    );

    expect(html).toContain('data-testid="recent-runs-panel"');
    expect(html).toContain('data-testid="recent-runs-scroll-container"');
    expect(html).toContain("xl:sticky");
    expect(html).toContain("xl:max-h-[calc(100vh-2rem)]");
    expect(html).toContain("xl:overflow-y-auto");
    expect(html).toContain("xl:overscroll-contain");
    expect(html).toContain("aria-pressed=\"true\"");
    expect(html).toContain("11111111...1111");
    expect(html).toContain("22222222...2222");
    expect(html).toContain("33333333...3333");
    expect(html).toContain('title="11111111-1111-4111-8111-111111111111"');
    expect(html).toContain(
      'aria-label="Select historical run 11111111-1111-4111-8111-111111111111"',
    );
    expect(html).not.toContain(">11111111-1111-4111-8111-111111111111<");
    expect(html).toContain("Scanned 409");
    expect(html).toContain("Selected");
    expect(html).toContain("Latest");
    expect(html).toContain("Observation");
    expect(html).toContain("Recommended");
    expect(html).toContain("Limited or unknown");
    expect(html).toContain("opacity-75");
    expect(recentRunsPanelClassName).toContain("xl:sticky");
    expect(recentRunsScrollContainerClassName).toContain("xl:overflow-y-auto");
    expect(recentRunsScrollContainerClassName).toContain("xl:overscroll-contain");
  });

  it("renders Forward Observation with neutral copy and full row visibility", () => {
    const response = makeObservationResponse();
    const readiness = makeReadinessResponse({
      selectedRun: makeReadinessRun({ run: response.run }),
      observationRun: makeReadinessRun({ run: response.run }),
    });
    const html = renderToStaticMarkup(
      createElement(ForwardObservationSection, {
        window: 3,
        onWindowChange: () => undefined,
        response,
        readiness,
        uiState: makeUiState({
          selectedRunId: response.run.runId,
          readiness,
          response,
        }),
      }),
    );

    expect(html).toContain("Forward Observation");
    expect(html).toContain("Research-only. Historical observations are not predictions.");
    expect(html).toContain("Mode: Using selected run");
    expect(html).toContain("1 candle");
    expect(html).toContain("3 candles");
    expect(html).toContain("5 candles");
    expect(html).toContain("10 candles");
    expect(html).toContain("Observation Summary");
    expect(html).toContain("Rows observed");
    expect(html).toContain("Complete");
    expect(html).toContain("Partial");
    expect(html).toContain("Missing");
    expect(html).toContain("Median observed change");
    expect(html).toContain("Average observed change");
    expect(html).toContain("Median max drawdown");
    expect(html).toContain("Observation coverage");
    expect(html).toContain("Limited (33.33%)");
    expect(html).toContain("Group distribution");
    expect(html).toContain("Notable historical examples");
    expect(html).toContain(
      "If the selected stored run is not mature yet, this section may use the latest mature full-universe run",
    );
    expect(html).toContain("Complete means enough future candles exist");
    expect(html).toContain("Partial means fewer future candles are available");
    expect(html).toContain("Missing means required future candles are unavailable");
    expect(html).toContain(
      "Observation metrics are calculated from the observation run shown in Forward Observation",
    );
    expect(html).toContain("historical observations for research context");
    expect(html).toContain("not predictions or financial advice");
    expect(html).toContain("It is not a prediction and does not describe future outcomes");
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

  it("renders ready mature observation rows without readiness loading or missing diagnostics", () => {
    const selectedRun = makeObservationRun({
      runId: "selected-not-ready",
      finishedAt: "2026-06-02T15:05:15.000Z",
    });
    const observationRun = makeObservationRun({
      runId: "mature-ready",
      finishedAt: "2026-06-02T02:52:00.000Z",
    });
    const readiness = makeReadinessResponse({
      selectedRun: makeReadinessRun({
        run: selectedRun,
        state: "not_ready",
        blocker: "time_maturity",
        rowCount: 3,
        completeCount: 0,
        partialCount: 0,
        missingCount: 3,
        dominantMissingReason: "no_future_candles",
        dominantMissingReasonCount: 3,
      }),
      observationRun: makeReadinessRun({
        run: observationRun,
        state: "ready",
        blocker: "observable",
        rowCount: 3,
        completeCount: 3,
        partialCount: 0,
        missingCount: 0,
      }),
      blocker: "time_maturity",
    });
    const response = makeObservationResponse({
      run: observationRun,
      rows: [
        makeObservationRow({
          id: "complete-a",
          symbol: "AAAUSDT",
          observedChangePct: 4,
          maxDrawdownPct: -2,
          dataStatus: "complete",
          missingReason: null,
        }),
        makeObservationRow({
          id: "complete-b",
          symbol: "BBBUSDT",
          observedChangePct: 2,
          maxDrawdownPct: -1,
          dataStatus: "complete",
          missingReason: null,
        }),
      ],
    });
    const uiState = makeUiState({
      selectedRunId: selectedRun.runId,
      readiness,
      response,
    });
    const html = renderToStaticMarkup(
      createElement(ForwardObservationSection, {
        window: 3,
        onWindowChange: () => undefined,
        response,
        readiness,
        uiState,
      }),
    );

    expect(uiState.status).toBe("observation_ready");
    expect(html).toContain("Mode: Using mature observation run");
    expect(html).toContain("Selected stored run: selected, status: Waiting for future candles");
    expect(html).toContain("Observation run: mature-r, status: Ready");
    expect(html).toContain(
      "Mature run used for forward observation metrics",
    );
    expect(html).toContain("Observation Summary");
    expect(html).not.toContain("Loading observation readiness");
    expect(html).not.toContain("Forward observation unavailable");
    expect(html).not.toContain("Dominant Reason");
    expect(html).not.toContain("Missing data");
  });

  it("keeps ready observation context visible while observation rows are loading", () => {
    const selectedRun = makeObservationRun({
      runId: "selected-not-ready",
      finishedAt: "2026-06-02T15:05:15.000Z",
    });
    const observationRun = makeObservationRun({
      runId: "mature-ready",
      finishedAt: "2026-06-02T02:52:00.000Z",
    });
    const readiness = makeReadinessResponse({
      selectedRun: makeReadinessRun({
        run: selectedRun,
        state: "not_ready",
        blocker: "time_maturity",
        dominantMissingReason: "no_future_candles",
        dominantMissingReasonCount: 3,
      }),
      observationRun: makeReadinessRun({ run: observationRun }),
      blocker: "time_maturity",
    });
    const uiState = makeUiState({
      selectedRunId: selectedRun.runId,
      readiness,
      response: null,
      observationIsLoading: true,
    });
    const html = renderToStaticMarkup(
      createElement(ForwardObservationSection, {
        window: 3,
        onWindowChange: () => undefined,
        response: null,
        readiness,
        uiState,
      }),
    );

    expect(uiState.status).toBe("loading_observation_rows");
    expect(html).toContain("Mode: Using mature observation run");
    expect(html).toContain("Selected stored run: selected, status: Waiting for future candles");
    expect(html).toContain("Observation run: mature-r, status: Ready");
    expect(html).toContain(
      "Mature run used for forward observation metrics",
    );
    expect(html).toContain("Loading observation rows");
    expect(html).not.toContain("Loading observation readiness");
    expect(html).not.toContain("Dominant Reason");
    expect(html).not.toContain("Missing data");
  });

  it("uses a ready observationRun runId for snapshot observation rows", () => {
    const selectedRun = makeObservationRun({ runId: "selected-not-ready" });
    const observationRun = makeObservationRun({ runId: "mature-ready" });
    const readiness = makeReadinessResponse({
      selectedRun: makeReadinessRun({
        run: selectedRun,
        state: "not_ready",
        blocker: "time_maturity",
      }),
      observationRun: makeReadinessRun({
        run: observationRun,
        state: "ready",
      }),
    });
    const rowsRunId = getForwardObservationRowsRunId({
      selectedRunId: selectedRun.runId,
      readiness,
      readinessError: null,
    });
    const url = buildHistoricalSnapshotObservationsUrl({
      runId: rowsRunId ?? "",
      assetClass: "crypto",
      window: 3,
      tradeApiBaseUrl: "https://api.auere.com",
    });

    expect(rowsRunId).toBe("mature-ready");
    expect(url).toContain("runId=mature-ready");
    expect(url).not.toContain("selected-not-ready");
  });

  it("renders Observation Summary distribution and notable examples from complete rows only", () => {
    const response = makeObservationResponse({
      rows: [
        makeObservationRow({
          id: "eligible-complete",
          symbol: "ELIGIBLEUSDT",
          group: "eligible",
          observedChangePct: 8,
          maxDrawdownPct: -2,
          dataStatus: "complete",
          missingReason: null,
        }),
        makeObservationRow({
          id: "watch-complete",
          symbol: "WATCHUSDT",
          group: "watch",
          observedChangePct: 2,
          maxDrawdownPct: -4,
          dataStatus: "complete",
          missingReason: null,
        }),
        makeObservationRow({
          id: "risk-complete",
          symbol: "RISKUSDT",
          group: "risk",
          observedChangePct: -6,
          maxDrawdownPct: -12,
          dataStatus: "complete",
          missingReason: null,
        }),
        makeObservationRow({
          id: "partial-ignored",
          symbol: "PARTIALUSDT",
          group: "eligible",
          observedChangePct: 80,
          maxDrawdownPct: -80,
          dataStatus: "partial",
          missingReason: "insufficient_future_candles",
        }),
        makeObservationRow({
          id: "missing-ignored",
          symbol: "MISSINGUSDT",
          group: "risk",
          observedChangePct: -80,
          maxDrawdownPct: -80,
          dataStatus: "missing",
          missingReason: "no_future_candles",
        }),
      ],
    });
    const readiness = makeReadinessResponse({
      selectedRun: makeReadinessRun({ run: response.run }),
      observationRun: makeReadinessRun({ run: response.run }),
    });
    const html = renderToStaticMarkup(
      createElement(ForwardObservationSection, {
        window: 3,
        onWindowChange: () => undefined,
        response,
        readiness,
        uiState: makeUiState({
          selectedRunId: response.run.runId,
          readiness,
          response,
        }),
      }),
    );

    expect(html).toContain("Rows observed");
    expect(html).toContain(">5<");
    expect(html).toContain("Mixed (60.00%)");
    expect(html).toContain("2.00%");
    expect(html).toContain("1.33%");
    expect(html).toContain("-4.00%");
    expect(html).toContain("Eligible");
    expect(html).toContain("Watch");
    expect(html).toContain("Risk");
    expect(html).toContain("Largest positive observed changes");
    expect(html).toContain("Largest negative observed changes");
    expect(html).toContain("Largest observed drawdowns");
    expect(html).toContain("ELIGIBLEUSDT");
    expect(html).toContain("WATCHUSDT");
    expect(html).toContain("RISKUSDT");
    expect(html).not.toContain("PARTIALUSDT</span>");
    expect(html).not.toContain("MISSINGUSDT</span>");
    expect(html).not.toContain("win rate");
    expect(html).not.toContain("accuracy");
    expect(html).not.toContain("success rate");
    expect(html).not.toContain("buy");
    expect(html).not.toContain("sell");
    expect(html).not.toContain("entry");
    expect(html).not.toContain("exit");
    expect(html).not.toContain("target");
    expect(html).not.toContain("stop loss");
    expect(html).not.toContain("PnL");
  });

  it("explains partial-only coverage without using partial rows for summary metrics", () => {
    const response = makeObservationResponse({
      rows: [
        makeObservationRow({
          id: "partial-positive",
          symbol: "PARTIALUPUSDT",
          group: "watch",
          observedChangePct: 12,
          maxDrawdownPct: -3,
          dataStatus: "partial",
          missingReason: "insufficient_future_candles",
        }),
        makeObservationRow({
          id: "partial-negative",
          symbol: "PARTIALDOWNUSDT",
          group: "risk",
          observedChangePct: -9,
          maxDrawdownPct: -11,
          dataStatus: "partial",
          missingReason: "insufficient_future_candles",
        }),
        makeObservationRow({
          id: "missing-row",
          symbol: "MISSINGUSDT",
          group: "neutral",
          observedClose: null,
          observedChangePct: null,
          maxDrawdownPct: null,
          dataStatus: "missing",
          missingReason: "no_future_candles",
        }),
      ],
    });
    const readiness = makeReadinessResponse({
      selectedRun: makeReadinessRun({ run: response.run }),
      observationRun: makeReadinessRun({
        run: response.run,
        completeCount: 0,
        partialCount: 2,
        missingCount: 1,
      }),
    });
    const html = renderToStaticMarkup(
      createElement(ForwardObservationSection, {
        window: 3,
        onWindowChange: () => undefined,
        response,
        readiness,
        uiState: makeUiState({
          selectedRunId: response.run.runId,
          readiness,
          response,
        }),
      }),
    );

    expect(html).toContain("Observation Summary");
    expect(html).toContain("Partial observations are available");
    expect(html).toContain("Complete-row distribution metrics stay empty");
    expect(html).toContain("Partial rows are shown in the table for research context only");
    expect(html.match(/Not enough complete rows/g)?.length ?? 0).toBeGreaterThan(3);
    expect(html).toContain("PARTIALUPUSDT");
    expect(html).toContain("PARTIALDOWNUSDT");
    expect(html).toContain("Insufficient future candles");
    expect(html).toContain("Largest positive observed changes");
    expect(html).toContain("Largest negative observed changes");
    expect(html).toContain("Largest observed drawdowns");
    expect(html).not.toContain("12.00%</span></div></li>");
    expect(html).not.toContain("-9.00%</span></div></li>");
  });

  it("renders stale market coverage as a compact unavailable state", () => {
    const selectedRun = makeObservationRun({
      runId: "11111111-1111-4111-8111-111111111111",
    });
    const readiness = makeReadinessResponse({
      selectedRun: makeReadinessRun({
        run: selectedRun,
        state: "not_ready",
        blocker: "market_data_coverage",
        rowCount: 3,
        completeCount: 0,
        partialCount: 0,
        missingCount: 3,
        dominantMissingReason: "no_future_candles",
        dominantMissingReasonCount: 3,
        expectedCompleteTime: "2026-06-02T12:00:00.000Z",
        latestCoverageTime: "2026-06-01T20:00:00.000Z",
        coverageLagCandles: 3,
      }),
      observationRun: null,
      recommendedRun: null,
      blocker: "market_data_coverage",
      coverage: {
        latestOpenTime: "2026-06-01T20:00:00.000Z",
        latestOpenTimeSymbolCount: 100,
        totalSymbols: 413,
      },
    });
    const uiState = makeUiState({
      selectedRunId: selectedRun.runId,
      readiness,
      response: null,
    });
    const html = renderToStaticMarkup(
      createElement(ForwardObservationSection, {
        window: 3,
        onWindowChange: () => undefined,
        response: null,
        readiness,
        uiState,
      }),
    );

    expect(uiState.status).toBe("no_observable_run");
    expect(getForwardObservationRowsRunId({
      selectedRunId: selectedRun.runId,
      readiness,
      readinessError: null,
    })).toBeNull();
    expect(html).toContain("Forward observation unavailable");
    expect(html).toContain("Market data appears stale");
    expect(html).toContain("production data may need latest candle sync");
    expect(html).toContain("Dominant Reason");
    expect(html).toContain("Diagnostic");
    expect(html).toContain("Market candle coverage");
    expect(html).toContain("Latest Candle");
    expect(html).toContain("2026-06-01 20:00");
    expect(html).toContain("100 / 413");
    expect(html).toContain("Coverage Lag");
    expect(html).toContain("3 candles");
    expect(html).toContain("Complete");
    expect(html).toContain("Partial");
    expect(html).toContain("Missing");
    expect(html).not.toContain("Loading observation rows");
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
    const readiness = makeReadinessResponse({
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
    });
    const uiState = makeUiState({
      selectedRunId: selectedRun.runId,
      readiness,
      response,
    });
    const html = renderToStaticMarkup(
      createElement(ForwardObservationSection, {
        window: 3,
        onWindowChange: () => undefined,
        response,
        readiness,
        uiState,
      }),
    );

    expect(uiState.status).toBe("observation_ready");
    expect(getForwardObservationRowsRunId({
      selectedRunId: selectedRun.runId,
      readiness,
      readinessError: null,
    })).toBe(recommendedRun.runId);
    expect(html).toContain("Mode: Using mature observation run");
    expect(html).toContain("Selected stored run: 11111111, status: Market data appears stale");
    expect(html).toContain("Observation run: 22222222, status: Ready");
    expect(html).toContain(
      "Mature run used for forward observation metrics",
    );
    expect(html).toContain("Observation finished 2026-06-02 02:52");
    expect(html).toContain("Selected stored run has stale market data coverage");
    expect(html).toContain("Observed Change");
    expect(html).not.toContain("Forward observation unavailable");
  });

  it("shows a non-error mature fallback note while the latest run waits for future candles", () => {
    const selectedRun = makeObservationRun({
      runId: "11111111-1111-4111-8111-111111111111",
      finishedAt: "2026-06-02T15:05:15.000Z",
    });
    const observationRun = makeObservationRun({
      runId: "22222222-2222-4222-8222-222222222222",
      finishedAt: "2026-06-02T02:52:00.000Z",
    });
    const readiness = makeReadinessResponse({
      selectedRun: makeReadinessRun({
        run: selectedRun,
        state: "not_ready",
        blocker: "time_maturity",
        rowCount: 409,
        completeCount: 0,
        partialCount: 0,
        missingCount: 409,
        dominantMissingReason: "no_future_candles",
        dominantMissingReasonCount: 409,
      }),
      recommendedRun: makeReadinessRun({ run: observationRun }),
      observationRun: makeReadinessRun({ run: observationRun }),
      blocker: "time_maturity",
    });
    const response = makeObservationResponse({ run: observationRun });
    const uiState = makeUiState({
      selectedRunId: selectedRun.runId,
      readiness,
      response,
    });
    const html = renderToStaticMarkup(
      createElement(ForwardObservationSection, {
        window: 3,
        onWindowChange: () => undefined,
        response,
        readiness,
        uiState,
      }),
    );

    expect(uiState.status).toBe("observation_ready");
    expect(getForwardObservationRowsRunId({
      selectedRunId: selectedRun.runId,
      readiness,
      readinessError: null,
    })).toBe(observationRun.runId);
    expect(html).toContain(
      "Selected stored run is still waiting for future candles. Showing the most recent mature full-universe run instead.",
    );
    expect(html).toContain("Selected stored run: 11111111, status: Waiting for future candles");
    expect(html).toContain("Observation run: 22222222, status: Ready");
    expect(html).toContain(
      "Mature run used for forward observation metrics",
    );
    expect(html).toContain("Observed Change");
    expect(html).toContain("Mode: Using mature observation run");
    expect(html).not.toContain("Loading observation readiness");
    expect(html).not.toContain("Dominant Reason");
    expect(html).not.toContain("Forward observation unavailable");
  });

  it("renders readiness unavailable without enabling observation row fetch", () => {
    const selectedRunId = "11111111-1111-4111-8111-111111111111";
    const uiState = makeUiState({
      selectedRunId,
      readiness: null,
      response: null,
      readinessError: "Unable to load observation readiness (404).",
    });
    const html = renderToStaticMarkup(
      createElement(ForwardObservationSection, {
        window: 3,
        onWindowChange: () => undefined,
        response: null,
        readiness: null,
        uiState,
      }),
    );

    expect(uiState.status).toBe("readiness_unavailable");
    expect(getForwardObservationRowsRunId({
      selectedRunId,
      readiness: null,
      readinessError: uiState.readinessError,
    })).toBeNull();
    expect(html).toContain("Observation readiness unavailable");
    expect(html).toContain(
      "Forward Observation readiness could not be determined",
    );
    expect(html).not.toContain("Loading observation rows");
    expect(html).not.toContain("Observed Change");
  });

  it("renders too-recent selected runs without fetching all-missing rows", () => {
    const selectedRun = makeObservationRun({
      runId: "11111111-1111-4111-8111-111111111111",
    });
    const readiness = makeReadinessResponse({
      selectedRun: makeReadinessRun({
        run: selectedRun,
        state: "not_ready",
        blocker: "time_maturity",
        rowCount: 409,
        completeCount: 0,
        partialCount: 0,
        missingCount: 409,
        dominantMissingReason: "no_future_candles",
        dominantMissingReasonCount: 409,
        expectedCompleteTime: "2026-06-02T12:00:00.000Z",
      }),
      recommendedRun: null,
      observationRun: null,
      blocker: "time_maturity",
    });
    const uiState = makeUiState({
      selectedRunId: selectedRun.runId,
      readiness,
      response: null,
    });
    const html = renderToStaticMarkup(
      createElement(ForwardObservationSection, {
        window: 3,
        onWindowChange: () => undefined,
        response: null,
        readiness,
        uiState,
      }),
    );

    expect(uiState.status).toBe("not_ready_for_selected_run");
    expect(getForwardObservationRowsRunId({
      selectedRunId: selectedRun.runId,
      readiness,
      readinessError: null,
    })).toBeNull();
    expect(html).toContain("Forward observation is not ready yet");
    expect(html).toContain("This snapshot is not fully observable yet");
    expect(html).toContain("Waiting for future candles");
    expect(html).toContain("Missing");
    expect(html).toContain("For 4h + 3 candles, expect roughly 12 hours");
    expect(html).not.toContain("Loading observation rows");
    expect(html).not.toContain("Observed Change");
  });

  it("uses the selected run when readiness says the selected run is ready", () => {
    const selectedRun = makeObservationRun({
      runId: "11111111-1111-4111-8111-111111111111",
    });
    const readiness = makeReadinessResponse({
      selectedRun: makeReadinessRun({ run: selectedRun }),
      observationRun: makeReadinessRun({ run: selectedRun }),
    });
    const response = makeObservationResponse({ run: selectedRun });
    const uiState = makeUiState({
      selectedRunId: selectedRun.runId,
      readiness,
      response,
    });
    const html = renderToStaticMarkup(
      createElement(ForwardObservationSection, {
        window: 3,
        onWindowChange: () => undefined,
        response,
        readiness,
        uiState,
      }),
    );

    expect(uiState.status).toBe("observation_ready");
    expect(getForwardObservationRowsRunId({
      selectedRunId: selectedRun.runId,
      readiness,
      readinessError: null,
    })).toBe(selectedRun.runId);
    expect(html).toContain("Mode: Using selected run");
    expect(html).toContain("Observation run: 11111111, status: Ready");
    expect(html).toContain(
      "Mature run used for forward observation metrics",
    );
    expect(html).toContain("Observed Change");
  });

  it("derives a fallback summary when rows exist but the API summary is null", () => {
    const selectedRun = makeObservationRun();
    const readiness = makeReadinessResponse({
      selectedRun: makeReadinessRun({ run: selectedRun }),
      observationRun: makeReadinessRun({ run: selectedRun }),
    });
    const response = makeObservationResponse({
      run: selectedRun,
      summary: null,
      rows: [
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
      ],
    });
    const uiState = makeUiState({
      selectedRunId: selectedRun.runId,
      readiness,
      response,
    });
    const html = renderToStaticMarkup(
      createElement(ForwardObservationSection, {
        window: 3,
        onWindowChange: () => undefined,
        response,
        readiness,
        uiState,
      }),
    );

    expect(uiState.status).toBe("observation_ready");
    expect(uiState.summary).toMatchObject({
      totalRows: 2,
      returnedRows: 2,
      completeCount: 1,
      partialCount: 1,
      missingCount: 0,
    });
    expect(html).toContain("Observed Change");
    expect(html).not.toContain("Observation rows not returned");
  });

  it("renders a diagnostic when a ready observation run returns no rows and null summary", () => {
    const selectedRun = makeObservationRun({
      runId: "11111111-1111-4111-8111-111111111111",
      signalsCreated: 413,
    });
    const readiness = makeReadinessResponse({
      selectedRun: makeReadinessRun({ run: selectedRun }),
      observationRun: makeReadinessRun({ run: selectedRun }),
    });
    const response = makeObservationResponse({
      run: selectedRun,
      summary: null,
      metadata: {
        rowCount: 0,
        completeCount: 0,
        partialCount: 0,
        missingCount: 0,
      },
      rows: [],
    });
    const uiState = makeUiState({
      selectedRunId: selectedRun.runId,
      readiness,
      response,
    });
    const html = renderToStaticMarkup(
      createElement(ForwardObservationSection, {
        window: 3,
        onWindowChange: () => undefined,
        response,
        readiness,
        uiState,
      }),
    );

    expect(uiState.status).toBe("observation_ready_summary_missing");
    expect(uiState.summary).toMatchObject({
      totalRows: 413,
      returnedRows: 0,
      missingCount: 413,
    });
    expect(html).toContain("Observation rows not returned");
    expect(html).toContain("Observation run is available, but no observation rows were returned.");
    expect(html).toContain("Total Rows");
    expect(html).toContain("Returned Rows");
    expect(html).toContain(">413<");
    expect(html).toContain(">0<");
    expect(html).not.toContain(
      "No forward observation rows are available for the selected observation run.",
    );
  });

  it("renders observation row fetch failures without endless loading", () => {
    const selectedRun = makeObservationRun({
      runId: "11111111-1111-4111-8111-111111111111",
    });
    const readiness = makeReadinessResponse({
      selectedRun: makeReadinessRun({ run: selectedRun }),
      observationRun: makeReadinessRun({ run: selectedRun }),
    });
    const uiState = makeUiState({
      selectedRunId: selectedRun.runId,
      readiness,
      response: null,
      observationRowsError: "Unable to load forward observation (503).",
    });
    const html = renderToStaticMarkup(
      createElement(ForwardObservationSection, {
        window: 3,
        onWindowChange: () => undefined,
        response: null,
        readiness,
        uiState,
      }),
    );

    expect(uiState.status).toBe("observation_rows_error");
    expect(html).toContain("Observation rows unavailable");
    expect(html).toContain("Unable to load forward observation (503).");
    expect(html).not.toContain("Loading observation rows");
  });

  it("shows row-loading copy only for a concrete observation run request", () => {
    const selectedRun = makeObservationRun({
      runId: "11111111-1111-4111-8111-111111111111",
    });
    const readinessLoadingState = makeUiState({
      selectedRunId: selectedRun.runId,
      readiness: null,
      response: null,
      readinessIsLoading: true,
      observationIsLoading: false,
    });
    const readinessLoadingHtml = renderToStaticMarkup(
      createElement(ForwardObservationSection, {
        window: 3,
        onWindowChange: () => undefined,
        response: null,
        readiness: null,
        uiState: readinessLoadingState,
      }),
    );
    const readiness = makeReadinessResponse({
      selectedRun: makeReadinessRun({ run: selectedRun }),
      observationRun: makeReadinessRun({ run: selectedRun }),
    });
    const rowsLoadingState = makeUiState({
      selectedRunId: selectedRun.runId,
      readiness,
      response: null,
      observationIsLoading: true,
    });
    const rowsLoadingHtml = renderToStaticMarkup(
      createElement(ForwardObservationSection, {
        window: 3,
        onWindowChange: () => undefined,
        response: null,
        readiness,
        uiState: rowsLoadingState,
      }),
    );

    expect(readinessLoadingState.status).toBe("loading_readiness");
    expect(readinessLoadingHtml).toContain("Loading observation readiness");
    expect(readinessLoadingHtml).not.toContain("Loading observation rows");
    expect(rowsLoadingState.status).toBe("loading_observation_rows");
    expect(rowsLoadingHtml).toContain("Loading observation rows");
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

function makeUiState(
  overrides: Partial<{
    selectedRunId: string | null;
    readiness: ReturnType<typeof makeReadinessResponse> | null;
    response: ReturnType<typeof makeObservationResponse> | null;
    readinessIsLoading: boolean;
    readinessError: string | null;
    observationRunId: string | null;
    observationIsLoading: boolean;
    observationIsFetching: boolean;
    observationRowsError: string | null;
  }> = {},
) {
  const readiness =
    overrides.readiness === undefined
      ? makeReadinessResponse()
      : overrides.readiness;
  const response = overrides.response ?? null;
  const selectedRunId =
    overrides.selectedRunId ??
    readiness?.selectedRun?.run.runId ??
    response?.run.runId ??
    null;
  const readinessError = overrides.readinessError ?? null;
  const observationRunId =
    overrides.observationRunId ??
    getForwardObservationRowsRunId({
      selectedRunId,
      readiness,
      readinessError,
    });

  return deriveForwardObservationUiState({
    selectedRunId,
    readiness,
    readinessIsLoading: overrides.readinessIsLoading ?? false,
    readinessError,
    response,
    observationRunId,
    observationIsLoading: overrides.observationIsLoading ?? false,
    observationIsFetching: overrides.observationIsFetching ?? false,
    observationRowsError: overrides.observationRowsError ?? null,
    fallbackWindow: 3,
  });
}

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
    summary: {
      totalRows: number;
      returnedRows: number;
      completeCount: number;
      partialCount: number;
      missingCount: number;
      window: 1 | 3 | 5 | 10;
      timeframe: "1h" | "4h" | "1d" | "1w";
      runId: string;
    } | null;
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
  const run = overrides.run ?? makeObservationRun();
  const window = overrides.metadata?.window ?? 3;
  const timeframe = overrides.metadata?.timeframe ?? "4h";
  const summary =
    "summary" in overrides
      ? overrides.summary
      : {
          totalRows: rows.length,
          returnedRows: rows.length,
          completeCount,
          partialCount,
          missingCount,
          window,
          timeframe,
          runId: run.runId,
        };

  return {
    ok: true,
    run,
    summary,
    metadata: {
      window,
      selectedWindow: overrides.metadata?.selectedWindow ?? 3,
      windowUnit: "completed_candles" as const,
      rowCount: overrides.metadata?.rowCount ?? rows.length,
      completeCount,
      partialCount,
      missingCount,
      limited: false,
      timeframe,
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
    recommendedRun:
      "recommendedRun" in overrides ? overrides.recommendedRun ?? null : null,
    observationRun:
      "observationRun" in overrides ? overrides.observationRun ?? null : selectedRun,
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
      diagnosticBlocker:
        selectedRun?.diagnosticBlocker ??
        (overrides.blocker === "time_maturity"
          ? "waiting_for_future_candles"
          : overrides.blocker === "market_data_coverage"
            ? "stale_market_data"
            : "observable"),
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
    diagnosticBlocker:
      | "observable"
      | "waiting_for_future_candles"
      | "stale_market_data"
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
    latestCoverageTime: string | null;
    coverageLagMs: number | null;
    coverageLagCandles: number | null;
  }> = {},
) {
  const state = overrides.state ?? "ready";
  const blocker = overrides.blocker ?? (state === "ready" ? "observable" : "unavailable");

  return {
    run: overrides.run ?? makeObservationRun(),
    state,
    blocker,
    diagnosticBlocker:
      overrides.diagnosticBlocker ??
      (blocker === "time_maturity"
        ? "waiting_for_future_candles"
        : blocker === "market_data_coverage"
          ? "stale_market_data"
          : state === "ready"
            ? "observable"
            : "unavailable"),
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
    latestCoverageTime:
      overrides.latestCoverageTime ?? "2026-06-02T12:00:00.000Z",
    coverageLagMs: overrides.coverageLagMs ?? 0,
    coverageLagCandles: overrides.coverageLagCandles ?? 0,
  };
}

function makeObservationRun(
  overrides: Partial<{
    runId: string;
    timeframe: "1h" | "4h" | "1d" | "1w";
    finishedAt: string;
    isLikelyFullUniverse: boolean;
    signalsCreated: number;
  }> = {},
) {
  return {
    runId: overrides.runId ?? "fcc05284-c7a0-4990-9bcb-5dd165d83c37",
    timeframe: overrides.timeframe ?? "4h",
    status: "success" as const,
    symbolsScanned: 409,
    signalsCreated: overrides.signalsCreated ?? 409,
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
  group?: string | null;
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
    group: overrides.group ?? "risk",
    label: "breakdown_risk",
    primarySignal: "Risk review",
    rankScore: 12,
    anchorTime: "2026-06-02T00:00:00.000Z",
    anchorClose: 100,
    anchorSource: "stored_signal" as const,
    latestMarketOpenTime: "2026-06-02T12:00:00.000Z",
    window: 3 as const,
    observedClose: overrides.observedClose ?? 102,
    observedChangePct: overrides.observedChangePct ?? 2,
    maxDrawdownPct: overrides.maxDrawdownPct ?? -3,
    dataStatus: overrides.dataStatus,
    missingReason: overrides.missingReason,
  };
}
