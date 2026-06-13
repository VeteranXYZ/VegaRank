import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { dictionaries } from "@/lib/i18n/dictionaries";
import {
  buildArchiveRefreshScope,
  buildHistoricalObservationReadinessUrl,
  buildHistoricalSnapshotObservationsUrl,
  buildHistoricalSnapshotUrl,
  buildHistoricalSnapshotsUrl,
  buildArchiveRankingQualityEvaluation,
  classifyForwardObservationMaturity,
  deriveForwardObservationUiState,
  ArchiveDetails,
  ForwardObservationSection,
  formatArchiveDateTime,
  formatArchivePrimarySignal,
  getArchiveRowMetadata,
  getNextRefreshingTimeframeAfterCompletion,
  getForwardObservationRowsRunId,
  getObservationProbeRuns,
  ArchivePageClient,
  isArchiveRefreshActiveForTimeframe,
  ObservationRowsTable,
  RankingQualityDiagnosticsPanel,
  RecentSuccessfulRunsPanel,
  recentRunsPanelClassName,
  recentRunsScrollContainerClassName,
  selectForwardObservationResult,
  SnapshotTable,
} from "./ArchivePageClient";
import { buildObservationSummary } from "./archiveObservationSummary";

describe("ArchivePageClient API URLs", () => {
  it("uses the public trade API historical snapshot endpoints", () => {
    const runId = "fcc05284-c7a0-4990-9bcb-5dd165d83c37";

    expect(
      buildHistoricalSnapshotsUrl({
        timeframe: "4h",
        assetClass: "crypto",
        limit: 25,
        tradeApiBaseUrl: "https://api.vegarank.com/",
      }),
    ).toBe(
      "https://api.vegarank.com/api/archive/snapshots?timeframe=4h&assetClass=crypto&limit=25",
    );
    expect(
      buildHistoricalSnapshotUrl({
        runId,
        assetClass: "crypto",
        tradeApiBaseUrl: "https://api.vegarank.com/",
      }),
    ).toBe(
      `https://api.vegarank.com/api/archive/snapshot?runId=${runId}&assetClass=crypto`,
    );
    expect(
      buildHistoricalObservationReadinessUrl({
        timeframe: "4h",
        runId,
        assetClass: "crypto",
        window: 3,
        tradeApiBaseUrl: "https://api.vegarank.com/",
      }),
    ).toBe(
      `https://api.vegarank.com/api/archive/observation-readiness?timeframe=4h&assetClass=crypto&window=3&runId=${runId}`,
    );
    expect(
      buildHistoricalSnapshotObservationsUrl({
        runId,
        assetClass: "crypto",
        window: 3,
        tradeApiBaseUrl: "https://api.vegarank.com/",
      }),
    ).toBe(
      `https://api.vegarank.com/api/archive/snapshot-observations?runId=${runId}&assetClass=crypto&window=3`,
    );
  });
});

describe("ArchivePageClient refresh scope", () => {
  it("scopes 4h refresh requests to 4h data and does not request other timeframes", () => {
    const scope = buildArchiveRefreshScope({
      timeframe: "4h",
      assetClass: "crypto",
      selectedRunId: "2366b0f7-1111-4111-8111-111111111111",
      observationRunId: "a9b5d020-2222-4222-8222-222222222222",
      window: 3,
    });
    const keys = [...scope.blockingQueryKeys, ...scope.backgroundQueryKeys];

    expect(scope.timeframe).toBe("4h");
    expect(scope.blockingQueryKeys).toEqual([
      ["archive-snapshots", "4h", "crypto"],
      [
        "archive-snapshot",
        "2366b0f7-1111-4111-8111-111111111111",
        "crypto",
      ],
      [
        "archive-observation-readiness",
        "4h",
        "2366b0f7-1111-4111-8111-111111111111",
        "crypto",
        3,
      ],
    ]);
    expect(scope.backgroundQueryKeys).toEqual([
      [
        "archive-snapshot-observations",
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
    const scope = buildArchiveRefreshScope({
      timeframe: "1d",
      assetClass: "crypto",
      selectedRunId: "ff5a19ed-1111-4111-8111-111111111111",
      observationRunId: "61d67176-2222-4222-8222-222222222222",
      window: 3,
    });

    expect(scope.blockingQueryKeys[0]).toEqual([
      "archive-snapshots",
      "1d",
      "crypto",
    ]);
    expect(scope.blockingQueryKeys[2]).toEqual([
      "archive-observation-readiness",
      "1d",
      "ff5a19ed-1111-4111-8111-111111111111",
      "crypto",
      3,
    ]);
    expect(scope.blockingQueryKeys).not.toContainEqual([
      "archive-snapshots",
      "4h",
      "crypto",
    ]);
  });

  it("keeps the Refresh button tied to the current timeframe only", () => {
    expect(
      isArchiveRefreshActiveForTimeframe({
        refreshingTimeframe: "4h",
        timeframe: "4h",
      }),
    ).toBe(true);
    expect(
      isArchiveRefreshActiveForTimeframe({
        refreshingTimeframe: "4h",
        timeframe: "1d",
      }),
    ).toBe(false);
    expect(
      isArchiveRefreshActiveForTimeframe({
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

describe("ArchivePageClient display formatting", () => {
  it("renders the validation terminal frame", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { enabled: false } },
    });
    const html = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client },
        createElement(ArchivePageClient),
      ),
    );

    expect(html).toContain("archive-terminal");
    expect(html).toContain("Research Archive");
    expect(html).toContain(">Timeframe<");
    expect(html).toContain(">1H<");
    expect(html).toContain(">4H<");
    expect(html).toContain(">1D<");
    expect(html).toContain(">1W<");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("Selected Run");
    expect(html).toContain("Validation");
    expect(html).toContain("Outcome Summary");
    expect(html).toContain("Validation Readiness");
    expect(html).toContain("Validation pending");
    expect(html).not.toContain("Load Snapshot Rows");
    expect(html).toContain("Snapshot Rows");
    expect(html).toContain("terminal-command-bar");
    expect(html).not.toContain(
      "mb-1 flex flex-wrap items-center gap-2 border border-[var(--border-medium)] bg-[var(--panel-muted)] px-2 py-1",
    );
    expect(html).not.toContain("History Reading Path");
    expect(html).not.toContain("Selected Snapshot");
  });

  it("formats dates deterministically without browser locale text", () => {
    const formatted = formatArchiveDateTime("2026-06-02T08:05:00.000Z");

    expect(formatted).toBe("2026-06-02 08:05");
    expect(formatted).not.toContain("2026年");
    expect(formatArchiveDateTime(null)).toBe("Not available");
  });

  it("maps action-like archive labels to safer research wording", () => {
    expect(formatArchivePrimarySignal("Do not chase")).toBe(
      "Overheated caution",
    );
    expect(formatArchivePrimarySignal("Avoid")).toBe("Risk review");
    expect(formatArchivePrimarySignal("Manual review")).toBe("Manual Review");
    expect(formatArchivePrimarySignal("review.status.manualReview")).toBe(
      "Manual Review",
    );
    expect(formatArchivePrimarySignal("Manual review", dictionaries.zh)).toBe(
      "人工复核",
    );
    expect(formatArchivePrimarySignal("unmapped_future_label", dictionaries.zh)).toBe(
      "未知",
    );
  });

  it("normalizes code-contract metadata before legacy fallback fields", () => {
    const metadata = getArchiveRowMetadata({
      group: "neutral",
      rankScore: 1,
      groupCode: "GR_201",
      actionCode: "AC_101",
      metrics: {
        rankScore: 74,
        riskAdjustedScore: 70,
        setupQualityScore: 68,
        confidenceScore: 72,
      },
    });

    expect(metadata.groupLabel).toBe("Constructive Watch");
    expect(metadata.groupKey).toBe("watch");
    expect(metadata.reviewLabel).toBe("Watch");
    expect(metadata.rankScore).toBe(74);
    expect(metadata.confidenceScore).toBe(72);
  });

  it("renders safer archive table labels and preserves full row count copy", () => {
    const html = renderToStaticMarkup(
      createElement(SnapshotTable, {
        isLoading: false,
        rows: [
          makeArchiveRow({
            id: "overheated-row",
            symbol: "HOTUSDT",
            primarySignal: "Do not chase",
          }),
          makeArchiveRow({
            id: "risk-row",
            symbol: "RISKUSDT",
            primarySignal: "Avoid",
          }),
        ],
      }),
    );

    expect(html).toContain("Snapshot Rows");
    expect(html).toContain("Archived Snapshot rows from the Selected Run.");
    expect(html).toContain(
      "Open Research opens current symbol research with Archive Context, not historical replay.",
    );
    expect(html).toContain("2 rows");
    expect(html).toContain("Validation State");
    expect(html).toContain("Follow-through");
    expect(html).toContain("Drawdown");
    expect(html).toContain("Validation pending");
    expect(html).toContain("from=archive");
    expect(html).toContain("runId=fcc05284-c7a0-4990-9bcb-5dd165d83c37");
    expect(html).toContain("snapshotId=overheated-row");
    expect(html).toContain("timeframe=4h");
    expect(html).toContain("assetClass=crypto");
    expect(html).not.toContain("Do not chase");
    expect(html).not.toContain("Avoid");
    expect(html).not.toContain("Research Label");
    expect(html).not.toContain("Research Priority");
    expect(html).not.toContain("Score Components");
    expect(html).not.toContain("Show More");
    expect(html).not.toContain("Pagination");
  });

  it("renders Snapshot Rows from stored code-contract metadata", () => {
    const html = renderToStaticMarkup(
      createElement(SnapshotTable, {
        isLoading: false,
        rows: [
          makeCodeContractArchiveRow({
            id: "code-contract-eligible",
            symbol: "CODEUSDT",
            groupCode: "GR_501",
            rankScore: 82,
          }),
          makeCodeContractArchiveRow({
            id: "code-contract-watch",
            symbol: "WATCHUSDT",
            groupCode: "GR_201",
            actionCode: "AC_101",
            rankScore: 74,
          }),
        ],
      }),
    );

    expect(html).toContain("Eligible");
    expect(html).toContain("Constructive Watch");
    expect(html).toContain("82.0");
    expect(html).toContain("74.0");
    expect(html).not.toContain("Metadata Unavailable");
  });

  it("shows conservative metadata copy when Snapshot Rows lack stored metadata", () => {
    const html = renderToStaticMarkup(
      createElement(SnapshotTable, {
        isLoading: false,
        rows: [
          {
            id: "missing-metadata",
            scanRunId: "fcc05284-c7a0-4990-9bcb-5dd165d83c37",
            symbol: "MISSUSDT",
            exchange: "binance",
            market: "spot",
            timeframe: "4h" as const,
          },
        ],
      }),
    );

    expect(html).toContain("Metadata Unavailable");
    expect(html).toContain("N/A");
    expect(html).not.toContain(">Neutral<");
  });

  it("sorts Snapshot Rows independently with an accessible sort indicator", () => {
    const html = renderToStaticMarkup(
      createElement(SnapshotTable, {
        isLoading: false,
        rows: [
          makeArchiveRow({
            id: "zed-row",
            symbol: "ZEDUSDT",
            primarySignal: "Manual review",
          }),
          makeArchiveRow({
            id: "alpha-row",
            symbol: "ALPHAUSDT",
            primarySignal: "Manual review",
          }),
          makeArchiveRow({
            id: "mid-row",
            symbol: "MIDUSDT",
            primarySignal: "Manual review",
          }),
        ],
        initialSortState: { key: "symbol", direction: "asc" },
      }),
    );

    expect(html).toContain("3 rows");
    expectMarkupOrder(html, ["ALPHAUSDT", "MIDUSDT", "ZEDUSDT"]);
    expect(html).toContain("\u2191");
    expect(html).toContain('aria-sort="ascending"');
  });

  it("renders Snapshot Rows default filters with all rows visible", () => {
    const html = renderObservationRowsTable();

    expect(html).toContain("Snapshot Rows");
    expect(html).toContain("Validation Source");
    expect(html).toContain("bg-[var(--panel-data)]");
    expect(html).toContain("Showing 4");
    expect(html).toContain("Research Group");
    expect(html).toContain("Hot");
    expect(html).toContain("Validation State");
    expect(html).toContain("Symbol");
    expect(html).toContain("COMPLETEELIGIBLEUSDT");
    expect(html).toContain("COMPLETEWATCHUSDT");
    expect(html).toContain("PARTIALRISKUSDT");
    expect(html).toContain("MISSINGRISKUSDT");
    expect(html).toContain("Partial window");
    expect(html).not.toContain("mt-1 block max-w-[170px]");
    expect(html).toContain("rounded-[3px]");
  });

  it("renders Observation Rows from stored code-contract metadata", () => {
    const html = renderObservationRowsTable({
      rows: [
        makeCodeContractObservationRow({
          id: "code-contract-observation",
          symbol: "OBSUSDT",
          groupCode: "GR_601",
          actionCode: "AC_601",
          rankScore: 91,
          confidenceScore: 87,
          dataStatus: "complete",
          missingReason: null,
        }),
      ],
    });

    expect(html).toContain("High Priority");
    expect(html).toContain("High-Priority Review");
    expect(html).toContain("91.0");
    expect(html).not.toContain("Unknown");
    expect(html).not.toContain("Metadata Unavailable");
  });

  it("sorts Observation Rows locally without changing filter counts or hiding rows", () => {
    const html = renderObservationRowsTable({
      rows: [
        makeObservationRow({
          id: "low-row",
          symbol: "LOWUSDT",
          group: "risk",
          observedChangePct: -4,
          maxDrawdownPct: -8,
          dataStatus: "complete",
          missingReason: null,
        }),
        makeObservationRow({
          id: "high-row",
          symbol: "HIGHUSDT",
          group: "eligible",
          observedChangePct: 8,
          maxDrawdownPct: -2,
          dataStatus: "complete",
          missingReason: null,
        }),
        makeObservationRow({
          id: "mid-row",
          symbol: "MIDUSDT",
          group: "watch",
          observedChangePct: 2,
          maxDrawdownPct: -3,
          dataStatus: "partial",
          missingReason: "insufficient_future_candles",
        }),
        {
          ...makeObservationRow({
            id: "missing-row",
            symbol: "MISSINGUSDT",
            group: "neutral",
            dataStatus: "missing",
            missingReason: "no_future_candles",
          }),
          observedClose: null,
          observedChangePct: null,
          maxDrawdownPct: null,
        },
      ],
      initialSortState: { key: "observed_change", direction: "desc" },
    });

    expect(html).toContain("Showing 4");
    expectMarkupOrder(html, ["HIGHUSDT", "MIDUSDT", "LOWUSDT", "MISSINGUSDT"]);
    expect(html).toContain("\u2193");
    expect(html).toContain('aria-sort="descending"');
  });

  it("filters Observation Rows to Complete status", () => {
    const html = renderObservationRowsTable({
      initialDataStatusFilter: "complete",
    });

    expect(html).toContain("Showing 2/4");
    expect(html).toContain("COMPLETEELIGIBLEUSDT");
    expect(html).toContain("COMPLETEWATCHUSDT");
    expect(html).not.toContain("PARTIALRISKUSDT");
    expect(html).not.toContain("MISSINGRISKUSDT");
  });

  it("filters Observation Rows to Partial status", () => {
    const html = renderObservationRowsTable({
      initialDataStatusFilter: "partial",
    });

    expect(html).toContain("Showing 1/4");
    expect(html).toContain("PARTIALRISKUSDT");
    expect(html).toContain("Insufficient future candles");
    expect(html).not.toContain("COMPLETEELIGIBLEUSDT");
    expect(html).not.toContain("COMPLETEWATCHUSDT");
    expect(html).not.toContain("MISSINGRISKUSDT");
  });

  it("filters Observation Rows to Missing status", () => {
    const html = renderObservationRowsTable({
      initialDataStatusFilter: "missing",
    });

    expect(html).toContain("Showing 1/4");
    expect(html).toContain("MISSINGRISKUSDT");
    expect(html).toContain("No completed future candles yet");
    expect(html).not.toContain("COMPLETEELIGIBLEUSDT");
    expect(html).not.toContain("COMPLETEWATCHUSDT");
    expect(html).not.toContain("PARTIALRISKUSDT");
  });

  it("filters Observation Rows by group", () => {
    const html = renderObservationRowsTable({
      initialGroupFilter: "risk",
    });

    expect(html).toContain("Showing 2/4");
    expect(html).toContain("PARTIALRISKUSDT");
    expect(html).toContain("MISSINGRISKUSDT");
    expect(html).not.toContain("COMPLETEELIGIBLEUSDT");
    expect(html).not.toContain("COMPLETEWATCHUSDT");
  });

  it("combines Observation Rows filters", () => {
    const html = renderObservationRowsTable({
      initialDataStatusFilter: "partial",
      initialGroupFilter: "risk",
    });

    expect(html).toContain("Showing 1/4");
    expect(html).toContain("PARTIALRISKUSDT");
    expect(html).not.toContain("MISSINGRISKUSDT");
    expect(html).not.toContain("COMPLETEELIGIBLEUSDT");
    expect(html).not.toContain("COMPLETEWATCHUSDT");
  });

  it("renders an empty Observation Rows filtered state", () => {
    const html = renderObservationRowsTable({
      initialDataStatusFilter: "complete",
      initialGroupFilter: "risk",
    });

    expect(html).toContain("Showing 0/4");
    expect(html).toContain("No snapshot rows found.");
    expect(html).toContain("No snapshot rows match the current filters.");
    expect(html).not.toContain("COMPLETEELIGIBLEUSDT");
    expect(html).not.toContain("PARTIALRISKUSDT");
    expect(html).not.toContain("MISSINGRISKUSDT");
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
    expect(html).toContain("Stored Runs");
    expect(html).toContain("Stored run selector");
    expect(html).toContain("xl:min-h-0");
    expect(html).toContain("xl:flex-col");
    expect(html).toContain("xl:overflow-y-auto");
    expect(html).toContain("xl:overscroll-contain");
    expect(html).toContain("aria-pressed=\"true\"");
    expect(html).toContain("Run 11111");
    expect(html).toContain("Run 22222");
    expect(html).toContain("Run 33333");
    expect(html).toContain('title="11111111-1111-4111-8111-111111111111"');
    expect(html).toContain(
      'aria-label="Select stored run 11111111-1111-4111-8111-111111111111"',
    );
    expect(html).not.toContain(">11111111-1111-4111-8111-111111111111<");
    expect(html).toContain("409 rows");
    expect(html).toContain("Completed 2026-06-02 08:05");
    expect(html).toContain("Selected");
    expect(html).toContain("Latest");
    expect(html).toContain("Validation Source");
    expect(html).toContain("Recommended");
    expect(html).not.toContain(">Observation<");
    expect(html).toContain("Limited Universe");
    expect(html).toContain("opacity-80");
    expect(recentRunsPanelClassName).toContain("xl:min-h-0");
    expect(recentRunsPanelClassName).toContain("xl:flex-col");
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

    expect(html).toContain("Outcome Summary");
    expect(html).toContain("Validation Readiness");
    expect(html).toContain("Partially Ready");
    expect(html).toContain("Some rows have partial future-window data.");
    expect(html).toContain("Validation ready");
    expect(html).toContain("1 candle");
    expect(html).toContain("3 candles");
    expect(html).toContain("5 candles");
    expect(html).toContain("10 candles");
    expect(html).toContain("Complete Windows");
    expect(html).toContain("Partial Windows");
    expect(html).toContain("Missing Windows");
    expect(html).toContain("Median Follow-through");
    expect(html).toContain("Positive Follow-through");
    expect(html).toContain("Drawdown Context");
    expect(html).not.toContain("Observed Change");
    expect(html).not.toContain("Max Adverse Move");
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

  it("renders ready mature snapshot rows without readiness loading or missing diagnostics", () => {
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
    expect(html).toContain("Ready for Review");
    expect(html).toContain("Selected Run");
    expect(html).toContain("Validation Source");
    expect(html).toContain("selec");
    expect(html).toContain("matur");
    expect(html).toContain("Outcome Summary");
    expect(html).toContain("3.00%");
    expect(html).not.toContain("Loading Validation Source");
    expect(html).not.toContain("Validation Source unavailable");
  });

  it("keeps ready observation context visible while snapshot rows are loading", () => {
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
    expect(html).toContain("Validation loading");
    expect(html).toContain("selec");
    expect(html).toContain("matur");
    expect(html).toContain("Loading Snapshot Rows");
    expect(html).not.toContain("Loading Validation Source");
  });

  it("uses a ready observationRun runId for snapshot snapshot rows", () => {
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
      tradeApiBaseUrl: "https://api.vegarank.com",
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
    const uiState = makeUiState({
      selectedRunId: response.run.runId,
      readiness,
      response,
    });
    const html = renderArchiveDetails({ response, readiness, uiState });

    expect(html).toContain("Validation Details");
    expect(html).toContain("Outcome Rows");
    expect(html).toContain(">5<");
    expect(html).toContain("Positive Follow-through");
    expect(html).toContain("2.00%");
    expect(html).toContain("Average Follow-through");
    expect(html).toContain("-12.00%");
    expect(html).toContain("Eligible");
    expect(html).toContain("Watch");
    expect(html).toContain("Risk");
    expect(html).toContain("Largest Positive Follow-through");
    expect(html).toContain("Lowest Follow-through");
    expect(html).toContain("Largest Drawdown Context");
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
    const uiState = makeUiState({
      selectedRunId: response.run.runId,
      readiness,
      response,
    });
    const html = renderArchiveDetails({ response, readiness, uiState });

    expect(html).toContain("Validation Details");
    expect(html).toContain("Not enough complete rows");
    expect(html).toContain("PARTIALUPUSDT");
    expect(html).toContain("PARTIALDOWNUSDT");
    expect(html).toContain("Insufficient future candles");
    expect(html).toContain("Largest Positive Follow-through");
    expect(html).toContain("Lowest Follow-through");
    expect(html).toContain("Largest Drawdown Context");
    expect(html).not.toContain("12.00%</span></div></li>");
    expect(html).not.toContain("-9.00%</span></div></li>");
  });

  it("renders Ranking Quality Diagnostics from loaded archive rows", () => {
    const response = makeObservationResponse({
      rows: makeRankingQualityRows(),
    });
    const evaluation = buildArchiveRankingQualityEvaluation(response.rows);
    const html = renderRankingQualityDiagnosticsPanel({ response });
    const text = markupText(html);

    expect(evaluation.summary.completeCount).toBe(40);
    expect(evaluation.summary.partialCount).toBe(3);
    expect(evaluation.summary.missingCount).toBe(2);
    expect(text).toContain("Ranking Quality Diagnostics");
    expect(text).toContain(
      "Research-only diagnostics based on complete archive outcome windows.",
    );
    expect(text).toContain("Window Coverage");
    expect(text).toContain("Window Coverage Mature");
    expect(text).toContain("Diagnostic Availability");
    expect(text).toContain("Score Bucket Separation");
    expect(text).toContain("Score buckets are available.");
    expect(text).toContain("Research Groups");
    expect(text).toContain("Research group comparison is available across");
    expect(text).toContain("Risk Context");
    expect(text).toContain("Risk context comparison is present, but complete-window support is limited.");
    expect(text).toContain("Evidence Reliability");
    expect(text).toContain("Not Stored");
    expect(text).toContain(
      "Confidence/evidence fields are not stored in the current archive rows.",
    );
    expect(text).toContain("Diagnostics do not change scoring automatically.");
    expect(text).not.toContain("Risk Context Details");
    expect(text).not.toContain("Evidence Reliability Details");
  });

  it("shows Ranking Quality Diagnostics window coverage counts", () => {
    const response = makeObservationResponse({
      rows: [
        makeObservationRow({
          id: "complete-a",
          symbol: "COMPLETEAUSDT",
          dataStatus: "complete",
          missingReason: null,
        }),
        makeObservationRow({
          id: "complete-b",
          symbol: "COMPLETEBUSDT",
          dataStatus: "complete",
          missingReason: null,
        }),
        makeObservationRow({
          id: "partial-a",
          symbol: "PARTIALAUSDT",
          dataStatus: "partial",
          missingReason: "insufficient_future_candles",
        }),
        makeObservationRow({
          id: "missing-a",
          symbol: "MISSINGAUSDT",
          observedClose: null,
          observedChangePct: null,
          maxDrawdownPct: null,
          dataStatus: "missing",
          missingReason: "no_future_candles",
        }),
      ],
    });
    const text = markupText(renderRankingQualityDiagnosticsPanel({ response }));

    expect(text).toContain("Window Coverage");
    expect(text).toMatch(/Complete Windows\s+2/);
    expect(text).toMatch(/Partial Windows\s+1/);
    expect(text).toMatch(/Missing Windows\s+1/);
    expect(text).toContain("Data Not Mature");
    expect(text).toContain("Diagnostic Availability");
  });

  it("separates window coverage from limited diagnostic availability", () => {
    const limitedResponse = makeObservationResponse({
      rows: Array.from({ length: 12 }, (_, index) =>
        makeObservationRow({
          id: `limited-${index}`,
          symbol: `LIMITED${index}USDT`,
          group: "eligible",
          rankScore: 82,
          dataStatus: "complete",
          missingReason: null,
        }),
      ),
    });
    const notMatureResponse = makeObservationResponse({
      rows: [
        ...Array.from({ length: 12 }, (_, index) =>
          makeObservationRow({
            id: `not-mature-complete-${index}`,
            symbol: `MATUREC${index}USDT`,
            group: "eligible",
            rankScore: 82,
            dataStatus: "complete",
            missingReason: null,
          }),
        ),
        ...Array.from({ length: 12 }, (_, index) =>
          makeObservationRow({
            id: `not-mature-partial-${index}`,
            symbol: `MATUREP${index}USDT`,
            group: "watch",
            rankScore: 64,
            dataStatus: "partial",
            missingReason: "insufficient_future_candles",
          }),
        ),
      ],
    });

    expect(
      markupText(renderRankingQualityDiagnosticsPanel({ response: limitedResponse })),
    ).toContain("Limited Sample");
    expect(
      markupText(renderRankingQualityDiagnosticsPanel({ response: notMatureResponse })),
    ).toContain("Data Not Mature");
  });

  it("does not render a full research group table for unknown-only groups", () => {
    const response = makeObservationResponse({
      rows: Array.from({ length: 12 }, (_, index) =>
        makeObservationRow({
          id: `unknown-group-${index}`,
          symbol: `UNKNOWN${index}USDT`,
          group: null,
          rankScore: index < 6 ? 80 : 20,
          dataStatus: "complete",
          missingReason: null,
        }),
      ),
    });
    const text = markupText(renderRankingQualityDiagnosticsPanel({ response }));

    expect(text).toContain("Research Groups");
    expect(text).toContain("Unavailable");
    expect(text).toContain(
      "Current archive rows do not include enough research-group variation for comparison.",
    );
    expect(text).not.toContain("Research Group Comparison");
  });

  it("uses a conservative risk context state for no-risk-only rows", () => {
    const response = makeObservationResponse({
      rows: Array.from({ length: 24 }, (_, index) =>
        makeObservationRow({
          id: `no-risk-${index}`,
          symbol: `NORISK${index}USDT`,
          group: index < 12 ? "eligible" : "watch",
          rankScore: index < 12 ? 82 : 64,
          dataStatus: "complete",
          missingReason: null,
        }),
      ),
    });
    const text = markupText(renderRankingQualityDiagnosticsPanel({ response }));

    expect(text).toContain("Risk Context");
    expect(text).toContain("Unavailable");
    expect(text).toContain(
      "Risk context diagnostics are limited by available archive fields.",
    );
    expect(text).not.toContain("Risk Context Details");
  });

  it("labels confidence-unknown archive rows as not stored", () => {
    const response = makeObservationResponse({
      rows: makeRankingQualityRows(),
    });
    const text = markupText(renderRankingQualityDiagnosticsPanel({ response }));

    expect(text).toContain("Evidence Reliability");
    expect(text).toContain("Not Stored");
    expect(text).toContain(
      "Confidence/evidence fields are not stored in the current archive rows.",
    );
    expect(text).not.toContain("Evidence Reliability Details");
  });

  it("reads ranking quality diagnostics from stored code-contract metrics", () => {
    const response = makeObservationResponse({
      rows: [
        ...Array.from({ length: 20 }, (_, index) =>
          makeCodeContractObservationRow({
            id: `code-high-${index}`,
            symbol: `CODEHIGH${index}USDT`,
            groupCode: "GR_601",
            actionCode: "AC_601",
            rankScore: 91,
            confidenceScore: 86,
            riskCodes: [],
            observedChangePct: 5,
            maxDrawdownPct: -1,
            dataStatus: "complete",
            missingReason: null,
          }),
        ),
        ...Array.from({ length: 20 }, (_, index) =>
          makeCodeContractObservationRow({
            id: `code-risk-${index}`,
            symbol: `CODERISK${index}USDT`,
            groupCode: "GR_301",
            actionCode: "AC_302",
            rankScore: 18,
            confidenceScore: 42,
            riskCode: "RK_302",
            riskCodes: ["RK_302"],
            observedChangePct: -2,
            maxDrawdownPct: -6,
            dataStatus: "complete",
            missingReason: null,
          }),
        ),
      ],
    });
    const evaluation = buildArchiveRankingQualityEvaluation(response.rows);
    const text = markupText(renderRankingQualityDiagnosticsPanel({ response }));

    expect(evaluation.scoreBuckets.map((bucket) => bucket.code)).toEqual(
      expect.arrayContaining(["score_0_20", "score_80_100"]),
    );
    expect(evaluation.confidenceBuckets.map((bucket) => bucket.code)).toEqual(
      expect.arrayContaining(["confidence_low", "confidence_high"]),
    );
    expect(evaluation.riskContextSummaries.map((summary) => summary.code)).toEqual(
      expect.arrayContaining(["risk_context", "no_risk_context"]),
    );
    expect(text).toContain("Score buckets are available.");
    expect(text).toContain("Risk context comparison is available.");
    expect(text).toContain("Evidence reliability comparison is available.");
    expect(text).not.toContain("Not Stored");
  });

  it("keeps missing windows separate from negative outcomes in ranking quality copy", () => {
    const response = makeObservationResponse({
      rows: [
        makeObservationRow({
          id: "complete-row",
          symbol: "COMPLETEUSDT",
          dataStatus: "complete",
          missingReason: null,
        }),
        makeObservationRow({
          id: "missing-row",
          symbol: "MISSINGUSDT",
          observedClose: null,
          observedChangePct: null,
          maxDrawdownPct: null,
          dataStatus: "missing",
          missingReason: "no_future_candles",
        }),
      ],
    });
    const text = markupText(renderRankingQualityDiagnosticsPanel({ response }));

    expect(text).toContain(
      "Missing windows are tracked separately and are not treated as negative outcomes.",
    );
    expect(text).not.toContain("Missing windows are negative outcomes");
  });

  it("uses evidence reliability language instead of probability language", () => {
    const text = markupText(
      renderRankingQualityDiagnosticsPanel({
        response: makeObservationResponse({ rows: makeRankingQualityRows() }),
      }),
    );

    expect(text).toContain("Evidence Reliability");
    expect(text).toContain("Data Support");
    expect(text).toContain("Not Stored");
    expect(text).not.toMatch(/\bprobability\b/i);
    expect(text).not.toMatch(/\bchance\b/i);
    expect(text).not.toMatch(/\bprediction accuracy\b/i);
  });

  it("does not introduce trading or performance language in ranking quality diagnostics", () => {
    const text = markupText(
      renderRankingQualityDiagnosticsPanel({
        response: makeObservationResponse({ rows: makeRankingQualityRows() }),
      }),
    );
    const forbiddenTerms = [
      "win rate",
      "success rate",
      "profit",
      "return",
      "P/L",
      "alpha",
      "trading performance",
      "strategy performance",
      "prediction accuracy",
      "buy",
      "sell",
      "long",
      "short",
      "entry",
      "exit",
      "best trades",
      "likely to go up",
      "likely to go down",
    ];

    for (const term of forbiddenTerms) {
      expect(text).not.toMatch(new RegExp(`\\b${escapeRegExp(term)}\\b`, "i"));
    }
  });

  it("does not crash on empty ranking quality rows or missing outcome fields", () => {
    const emptyText = markupText(
      renderRankingQualityDiagnosticsPanel({
        response: makeObservationResponse({
          rows: [],
          summary: null,
          metadata: {
            rowCount: 0,
            completeCount: 0,
            partialCount: 0,
            missingCount: 0,
          },
        }),
      }),
    );
    const missingOutcomeText = markupText(
      renderRankingQualityDiagnosticsPanel({
        response: makeObservationResponse({
          rows: [
            makeObservationRow({
              id: "missing-fields",
              symbol: "NULLUSDT",
              observedClose: null,
              observedChangePct: null,
              maxDrawdownPct: null,
              dataStatus: "complete",
              missingReason: null,
            }),
          ],
        }),
      }),
    );

    expect(emptyText).toContain("Diagnostics unavailable from current archive data");
    expect(emptyText).toContain("Data Not Mature");
    expect(missingOutcomeText).toContain("Ranking Quality Diagnostics");
    expect(missingOutcomeText).toContain("Diagnostic Availability");
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
    expect(html).toContain("Data Missing");
    expect(html).toContain("Market data appears stale");
    expect(html).toContain("Coverage Lag");
    expect(html).toContain("3 candles");
    expect(html).not.toContain("Loading Snapshot Rows");
    expect(html).not.toContain("AAAUSDT");
    expect(html).not.toContain("BBBUSDT");
    expect(html).not.toContain("CCCUSDT");

    const detailsHtml = renderToStaticMarkup(
      createElement(ArchiveDetails, {
        readiness,
        response: null,
        uiState,
        readyContextNote: null,
        summary: null,
      }),
    );

    expect(detailsHtml).toContain("Dominant Reason");
    expect(detailsHtml).toContain("Diagnostic");
    expect(detailsHtml).toContain("Market candle coverage");
    expect(detailsHtml).toContain("Latest Coverage");
    expect(detailsHtml).toContain("100 / 413");
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

  it("labels recommended observable runs without changing the Selected Run", () => {
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
    expect(html).toContain("Partially Ready");
    expect(html).toContain("11111");
    expect(html).toContain("22222");
    expect(html).toContain("3 candles");
    expect(html).toContain("Selected Run has stale market data coverage");
    expect(html).toContain("Median Follow-through");
    expect(html).not.toContain("Validation Source unavailable");
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
      "Selected Run is still waiting for enough completed future candles. Validation Source uses the most recent mature full-universe run.",
    );
    expect(html).toContain("11111");
    expect(html).toContain("22222");
    expect(html).toContain("Median Follow-through");
    expect(html).toContain("Validation Source");
    expect(html).not.toContain("Loading Validation Source");
    expect(html).not.toContain("Validation Source unavailable");
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
    expect(html).toContain("Data Missing");
    expect(html).toContain("Source data is missing or incomplete.");
    expect(html).not.toContain("Loading Snapshot Rows");
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
    expect(html).toContain("Validation Pending");
    expect(html).toContain("This run is still waiting for enough completed future candles.");
    expect(html).toContain("12 hours");
    expect(html).not.toContain("Loading Snapshot Rows");
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
    expect(html).toContain("Partially Ready");
    expect(html).toContain("11111");
    expect(html).toContain("Some rows have partial future-window data.");
    expect(html).toContain("Median Follow-through");
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
    expect(html).toContain("Median Follow-through");
    expect(html).not.toContain("Snapshot Rows unavailable");
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
    expect(html).toContain("Snapshot Rows unavailable");
    expect(html).toContain("Validation Source is available, but no Snapshot Rows were provided.");
    expect(html).toContain("Missing Windows");
    expect(html).toContain(">413<");
    const detailsHtml = renderArchiveDetails({ response, readiness, uiState });
    expect(detailsHtml).toContain("Loaded Rows");
    expect(detailsHtml).toContain("Outcome Rows");
    expect(detailsHtml).toContain(">0<");
    expect(html).not.toContain(
      "No snapshot rows are available for the Validation Source.",
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
      observationRowsError: "Unable to load archive snapshot rows (503).",
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
    expect(html).toContain("Snapshot Rows unavailable");
    expect(html).toContain("Unable to load archive snapshot rows (503).");
    expect(html).not.toContain("Loading Snapshot Rows");
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
    expect(readinessLoadingHtml).toContain("Loading Validation Source");
    expect(readinessLoadingHtml).not.toContain("Loading Snapshot Rows");
    expect(rowsLoadingState.status).toBe("loading_observation_rows");
    expect(rowsLoadingHtml).toContain("Loading Snapshot Rows");
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

function renderObservationRowsTable(
  overrides: Partial<Parameters<typeof ObservationRowsTable>[0]> = {},
) {
  return renderToStaticMarkup(
    createElement(ObservationRowsTable, {
      rows: makeObservationRowsForFilters(),
      isFetching: false,
      ...overrides,
    }),
  );
}

function renderRankingQualityDiagnosticsPanel({
  response,
  summary,
}: {
  response: ReturnType<typeof makeObservationResponse> | null;
  summary?: ReturnType<typeof makeUiState>["summary"] | null;
}) {
  const readiness = response
    ? makeReadinessResponse({
        selectedRun: makeReadinessRun({ run: response.run }),
        observationRun: makeReadinessRun({ run: response.run }),
      })
    : null;
  const uiState = makeUiState({
    selectedRunId: response?.run.runId ?? null,
    readiness,
    response,
  });

  return renderToStaticMarkup(
    createElement(RankingQualityDiagnosticsPanel, {
      response,
      summary: summary === undefined ? uiState.summary : summary,
    }),
  );
}

function renderArchiveDetails({
  response,
  readiness,
  uiState,
}: {
  response: ReturnType<typeof makeObservationResponse>;
  readiness: ReturnType<typeof makeReadinessResponse>;
  uiState: ReturnType<typeof makeUiState>;
}) {
  return renderToStaticMarkup(
    createElement(ArchiveDetails, {
      readiness,
      response,
      uiState,
      readyContextNote: null,
      summary: buildObservationSummary({
        rows: response.rows,
        counts: uiState.summary
          ? {
              totalRows: uiState.summary.totalRows,
              completeCount: uiState.summary.completeCount,
              partialCount: uiState.summary.partialCount,
              missingCount: uiState.summary.missingCount,
            }
          : null,
      }),
    }),
  );
}

function expectMarkupOrder(html: string, labels: string[]) {
  const positions = labels.map((label) => html.indexOf(label));

  for (const position of positions) {
    expect(position).toBeGreaterThanOrEqual(0);
  }

  for (let index = 1; index < positions.length; index += 1) {
    expect(positions[index]).toBeGreaterThan(positions[index - 1]);
  }
}

function markupText(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function makeObservationRowsForFilters() {
  return [
    makeObservationRow({
      id: "complete-eligible",
      symbol: "COMPLETEELIGIBLEUSDT",
      group: "eligible",
      dataStatus: "complete",
      missingReason: null,
    }),
    makeObservationRow({
      id: "complete-watch",
      symbol: "COMPLETEWATCHUSDT",
      group: "watch",
      dataStatus: "complete",
      missingReason: null,
    }),
    makeObservationRow({
      id: "partial-risk",
      symbol: "PARTIALRISKUSDT",
      group: "risk",
      dataStatus: "partial",
      missingReason: "insufficient_future_candles",
    }),
    makeObservationRow({
      id: "missing-risk",
      symbol: "MISSINGRISKUSDT",
      group: "risk",
      observedClose: null,
      observedChangePct: null,
      maxDrawdownPct: null,
      dataStatus: "missing",
      missingReason: "no_future_candles",
    }),
  ];
}

function makeRankingQualityRows() {
  return [
    ...Array.from({ length: 20 }, (_, index) =>
      makeObservationRow({
        id: `high-score-${index}`,
        symbol: `HIGH${index}USDT`,
        group: "eligible",
        rankScore: 88,
        observedChangePct: 5,
        maxDrawdownPct: -2,
        dataStatus: "complete",
        missingReason: null,
      }),
    ),
    ...Array.from({ length: 20 }, (_, index) =>
      makeObservationRow({
        id: `low-score-${index}`,
        symbol: `LOW${index}USDT`,
        group: "watch",
        rankScore: 12,
        observedChangePct: 1,
        maxDrawdownPct: -2,
        dataStatus: "complete",
        missingReason: null,
      }),
    ),
    ...Array.from({ length: 3 }, (_, index) =>
      makeObservationRow({
        id: `partial-risk-${index}`,
        symbol: `PARTIALRISK${index}USDT`,
        group: "risk",
        rankScore: 35,
        dataStatus: "partial",
        missingReason: "insufficient_future_candles",
      }),
    ),
    ...Array.from({ length: 2 }, (_, index) =>
      makeObservationRow({
        id: `missing-risk-${index}`,
        symbol: `MISSINGRISK${index}USDT`,
        group: "risk",
        rankScore: 35,
        observedClose: null,
        observedChangePct: null,
        maxDrawdownPct: null,
        dataStatus: "missing",
        missingReason: "no_future_candles",
      }),
    ),
  ];
}

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

function makeArchiveRow(overrides: {
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

function makeCodeContractArchiveRow(
  overrides: Partial<{
    id: string;
    symbol: string;
    groupCode: string | null;
    actionCode: string | null;
    riskCode: string | null;
    riskCodes: string[] | null;
    setupCode: string | null;
    signalCodes: string[] | null;
    qualityCodes: string[] | null;
    rankScore: number | null;
    riskAdjustedScore: number | null;
    setupQualityScore: number | null;
    confidenceScore: number | null;
  }> = {},
) {
  const rankScore = overrides.rankScore ?? 82;
  const setupQualityScore = overrides.setupQualityScore ?? 76;
  const confidenceScore = overrides.confidenceScore ?? 84;

  return {
    id: overrides.id ?? "code-contract-row",
    scanRunId: "fcc05284-c7a0-4990-9bcb-5dd165d83c37",
    symbol: overrides.symbol ?? "CODEUSDT",
    exchange: "binance",
    market: "spot",
    timeframe: "4h" as const,
    groupCode: overrides.groupCode === undefined ? "GR_501" : overrides.groupCode,
    actionCode:
      overrides.actionCode === undefined ? "AC_501" : overrides.actionCode,
    riskCode: overrides.riskCode === undefined ? null : overrides.riskCode,
    riskCodes: overrides.riskCodes === undefined ? [] : overrides.riskCodes,
    setupCode: overrides.setupCode === undefined ? "TR_601" : overrides.setupCode,
    signalCodes:
      overrides.signalCodes === undefined ? ["PX_501"] : overrides.signalCodes,
    qualityCodes:
      overrides.qualityCodes === undefined ? ["QH_001"] : overrides.qualityCodes,
    metrics:
      rankScore === null
        ? null
        : {
            rankScore,
            riskAdjustedScore: overrides.riskAdjustedScore ?? rankScore,
            setupQualityScore,
            confidenceScore,
            absoluteSetupScore: setupQualityScore,
            universePercentile: rankScore,
          },
    scannerVersion: "test",
    scoringVersion: "test",
  };
}

function makeCodeContractObservationRow(
  overrides: Partial<
    Parameters<typeof makeCodeContractArchiveRow>[0] & {
      observedClose: number | null;
      observedChangePct: number | null;
      maxDrawdownPct: number | null;
      dataStatus: "complete" | "partial" | "missing";
      missingReason: string | null;
    }
  > = {},
) {
  return {
    ...makeCodeContractArchiveRow(overrides),
    anchorTime: "2026-06-02T00:00:00.000Z",
    anchorClose: 100,
    anchorSource: "stored_signal" as const,
    latestMarketOpenTime: "2026-06-02T12:00:00.000Z",
    window: 3 as const,
    observedClose: overrides.observedClose ?? 102,
    observedChangePct: overrides.observedChangePct ?? 2,
    maxDrawdownPct: overrides.maxDrawdownPct ?? -3,
    dataStatus: overrides.dataStatus ?? "complete",
    missingReason: overrides.missingReason ?? null,
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
    rows: Array<
      ReturnType<typeof makeObservationRow> | ReturnType<typeof makeCodeContractObservationRow>
    >;
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
      disclaimer: "Research-only. Not trading advice.",
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
      disclaimer: "Research-only. Not trading advice.",
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
  rankScore?: number | null;
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
    rankScore: overrides.rankScore ?? 12,
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
