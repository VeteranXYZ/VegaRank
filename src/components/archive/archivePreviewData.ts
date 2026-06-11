import type { ArchiveVisualCheckData } from "./ArchivePageClient";

type VisualRun = ArchiveVisualCheckData["snapshots"][number];
type VisualSnapshotRow =
  ArchiveVisualCheckData["snapshotsByRunId"][string]["rows"][number];
type VisualObservationResponse =
  NonNullable<
    ArchiveVisualCheckData["observationsByRunIdAndWindow"][string]
  >[1];
type VisualObservationRow = NonNullable<VisualObservationResponse>["rows"][number];
type VisualReadinessRun = NonNullable<
  ArchiveVisualCheckData["readinessByRunId"][string]
>["selectedRun"];

const selectedRunId = "a9995f87-1111-4111-8111-a9995f870001";
const validationRunId = "b8842c91-2222-4222-8222-b8842c910002";
const olderRunId = "8c2e1170-3333-4333-8333-8c2e11700003";
const limitedRunId = "5fd71a2b-4444-4444-8444-5fd71a2b0004";

export function buildArchiveVisualCheckData(): ArchiveVisualCheckData {
  const selectedRun = makeRun({
    runId: selectedRunId,
    finishedAt: "2026-06-03T20:00:00.000Z",
    signalsCreated: 410,
  });
  const validationRun = makeRun({
    runId: validationRunId,
    finishedAt: "2026-06-03T04:00:00.000Z",
    signalsCreated: 410,
  });
  const olderRun = makeRun({
    runId: olderRunId,
    finishedAt: "2026-06-02T12:00:00.000Z",
    signalsCreated: 397,
  });
  const limitedRun = makeRun({
    runId: limitedRunId,
    finishedAt: "2026-06-02T08:00:00.000Z",
    signalsCreated: 96,
    symbolsScanned: 128,
    isLikelyFullUniverse: false,
  });
  const windows = [1, 3, 5, 10] as const;
  const observationsByWindow = Object.fromEntries(
    windows.map((window) => [
      window,
      makeObservationResponse({
        run: validationRun,
        window,
        rows: makeObservationRows(window),
      }),
    ]),
  ) as NonNullable<
    ArchiveVisualCheckData["observationsByRunIdAndWindow"][string]
  >;

  return {
    initialTimeframe: "4h",
    initialObservationWindow: 3,
    snapshots: [selectedRun, validationRun, olderRun, limitedRun],
    snapshotsByRunId: {
      [selectedRun.runId]: {
        ok: true,
        run: selectedRun,
        rows: makeOriginalScanRows(selectedRun.runId),
        metadata: {
          rowCount: 410,
          limited: false,
          timeframe: "4h",
          assetClass: "crypto",
          disclaimer: "Visual-check data.",
        },
      },
      [validationRun.runId]: {
        ok: true,
        run: validationRun,
        rows: makeOriginalScanRows(validationRun.runId),
        metadata: {
          rowCount: 410,
          limited: false,
          timeframe: "4h",
          assetClass: "crypto",
          disclaimer: "Visual-check data.",
        },
      },
    },
    readinessByRunId: {
      [selectedRun.runId]: {
        ok: true,
        selectedRun: makeReadinessRun({
          run: selectedRun,
          state: "not_ready",
          blocker: "time_maturity",
          diagnosticBlocker: "waiting_for_future_candles",
          completeCount: 0,
          partialCount: 0,
          missingCount: 410,
          dominantMissingReason: "no_future_candles",
          dominantMissingReasonCount: 410,
          expectedCompleteTime: "2026-06-04T08:00:00.000Z",
        }),
        recommendedRun: makeReadinessRun({
          run: validationRun,
          state: "ready",
          completeCount: 246,
          partialCount: 92,
          missingCount: 72,
          dominantMissingReason: "insufficient_future_candles",
          dominantMissingReasonCount: 72,
        }),
        observationRun: makeReadinessRun({
          run: validationRun,
          state: "ready",
          completeCount: 246,
          partialCount: 92,
          missingCount: 72,
          dominantMissingReason: "insufficient_future_candles",
          dominantMissingReasonCount: 72,
        }),
        coverage: {
          timeframe: "4h",
          assetClass: "crypto",
          totalSymbols: 410,
          symbolsWithCandles: 410,
          latestOpenTime: "2026-06-03T20:00:00.000Z",
          latestOpenTimeSymbolCount: 410,
          latestOpenTimeCoveragePct: 100,
          buckets: [
            {
              latestOpenTime: "2026-06-03T20:00:00.000Z",
              symbolCount: 410,
            },
          ],
        },
        metadata: {
          timeframe: "4h",
          assetClass: "crypto",
          window: 3,
          selectedWindow: 3,
          windowUnit: "completed_candles",
          blocker: "time_maturity",
          diagnosticBlocker: "waiting_for_future_candles",
          candidateCount: 4,
          candidateLimit: 12,
          fullUniverseMinExpectedSymbols: 300,
          disclaimer: "Visual-check data.",
        },
      },
    },
    observationsByRunIdAndWindow: {
      [validationRun.runId]: observationsByWindow,
    },
  };
}

function makeRun({
  runId,
  finishedAt,
  signalsCreated,
  symbolsScanned = 410,
  isLikelyFullUniverse = true,
}: {
  runId: string;
  finishedAt: string;
  signalsCreated: number;
  symbolsScanned?: number;
  isLikelyFullUniverse?: boolean;
}): VisualRun {
  return {
    runId,
    timeframe: "4h",
    status: "success",
    universe: "binance_usdt_perps",
    exchange: "binance",
    market: "spot",
    symbolsTotal: 410,
    symbolsScanned,
    signalsCreated,
    skipped: Math.max(0, 410 - symbolsScanned),
    failedSymbols: 0,
    startedAt: new Date(new Date(finishedAt).getTime() - 8 * 60_000).toISOString(),
    finishedAt,
    isLikelyFullUniverse,
    fullUniverseMinExpectedSymbols: 300,
    params: { visualCheck: true },
    scannerVersion: "visual-check",
    scoringVersion: "visual-check",
  };
}

function makeOriginalScanRows(runId: string): VisualSnapshotRow[] {
  return [
    makeOriginalRow({ runId, index: 1, symbol: "BTCUSDT", group: "eligible", label: "trend_continuation", rankScore: 92, primarySignal: "Continuation setup" }),
    makeOriginalRow({ runId, index: 2, symbol: "SEIUSDT", group: "eligible", label: "breakout_confirmed", rankScore: 89, primarySignal: "Breakout confirmed" }),
    makeOriginalRow({ runId, index: 3, symbol: "ETHUSDT", group: "watch", label: "pullback_watch", rankScore: 81, primarySignal: "Watch confirmation" }),
    makeOriginalRow({ runId, index: 4, symbol: "AAVEUSDT", group: "watch", label: "range_repair", rankScore: 74, primarySignal: "Range repair" }),
    makeOriginalRow({ runId, index: 5, symbol: "DOGEUSDT", group: "risk", label: "breakdown_risk", rankScore: 38, primarySignal: "Risk review" }),
    makeOriginalRow({ runId, index: 6, symbol: "XRPUSDT", group: "risk", label: "distribution_risk", rankScore: 35, primarySignal: "Risk review" }),
    makeOriginalRow({ runId, index: 7, symbol: "AVAXUSDT", group: "neutral", label: "range_neutral", rankScore: 58, primarySignal: "Neutral range" }),
    makeOriginalRow({ runId, index: 8, symbol: "SUIUSDT", group: "neutral", label: "no_edge", rankScore: 51, primarySignal: "No clear edge" }),
    makeOriginalRow({ runId, index: 9, symbol: "LINKUSDT", group: "eligible", label: "volume_expansion", rankScore: 84, primarySignal: "Volume expansion" }),
  ];
}

function makeOriginalRow({
  runId,
  index,
  symbol,
  group,
  label,
  rankScore,
  primarySignal,
}: {
  runId: string;
  index: number;
  symbol: string;
  group: string;
  label: string;
  rankScore: number;
  primarySignal: string;
}): VisualSnapshotRow {
  return {
    id: `${runId}-${symbol}`,
    scanRunId: runId,
    symbol,
    exchange: "binance",
    market: "spot",
    timeframe: "4h",
    scanTime: "2026-06-03T20:00:00.000Z",
    candleOpenTime: "2026-06-03T16:00:00.000Z",
    priceAtSignal: 100 + index * 3.25,
    group,
    label,
    primarySignal,
    reviewTier: group === "eligible" ? "primary" : "review",
    riskNotes: group === "risk" ? "Weak structure; high drawdown risk." : null,
    riskTypes: group === "risk" ? ["structure", "momentum"] : [],
    rankScore,
    componentScores: {
      finalSignalScore: rankScore,
      opportunityScore: rankScore - 6,
      confirmationScore: rankScore - 4,
      riskScore: group === "risk" ? 78 : 28,
      trendScore: rankScore - 8,
      momentumScore: rankScore - 10,
      volumeScore: rankScore - 12,
      structureScore: rankScore - 7,
    },
    actionBias: group === "risk" ? "risk_review" : "research",
    primaryStructure: label,
    scannerVersion: "visual-check",
    scoringVersion: "visual-check",
  };
}

function makeObservationRows(window: 1 | 3 | 5 | 10): VisualObservationRow[] {
  const rows = [
    makeObservationRow({ window, symbol: "BTCUSDT", group: "eligible", label: "trend_continuation", rankScore: 92, anchorClose: 67120, observedChangePct: 3.8, maxDrawdownPct: -1.2, dataStatus: "complete" }),
    makeObservationRow({ window, symbol: "SEIUSDT", group: "eligible", label: "breakout_confirmed", rankScore: 89, anchorClose: 0.421, observedChangePct: 8.4, maxDrawdownPct: -2.1, dataStatus: "complete" }),
    makeObservationRow({ window, symbol: "ETHUSDT", group: "watch", label: "pullback_watch", rankScore: 81, anchorClose: 3580, observedChangePct: -1.7, maxDrawdownPct: -3.6, dataStatus: "complete" }),
    makeObservationRow({ window, symbol: "AAVEUSDT", group: "watch", label: "range_repair", rankScore: 74, anchorClose: 104.2, observedChangePct: 1.2, maxDrawdownPct: -1.5, dataStatus: window <= 3 ? "partial" : "missing", missingReason: window <= 3 ? "insufficient_future_candles" : "no_future_candles" }),
    makeObservationRow({ window, symbol: "DOGEUSDT", group: "risk", label: "breakdown_risk", rankScore: 38, anchorClose: 0.148, observedChangePct: -6.5, maxDrawdownPct: -9.8, dataStatus: "complete" }),
    makeObservationRow({ window, symbol: "XRPUSDT", group: "risk", label: "distribution_risk", rankScore: 35, anchorClose: 0.52, observedChangePct: -2.3, maxDrawdownPct: -5.1, dataStatus: window === 1 ? "complete" : "partial", missingReason: window === 1 ? null : "insufficient_future_candles" }),
    makeObservationRow({ window, symbol: "AVAXUSDT", group: "neutral", label: "range_neutral", rankScore: 58, anchorClose: 36.4, observedChangePct: 0.4, maxDrawdownPct: -2.4, dataStatus: "complete" }),
    makeObservationRow({ window, symbol: "SUIUSDT", group: "neutral", label: "no_edge", rankScore: 51, anchorClose: 1.08, observedChangePct: null, maxDrawdownPct: null, dataStatus: "missing", missingReason: "no_future_candles" }),
    makeObservationRow({ window, symbol: "LINKUSDT", group: "eligible", label: "volume_expansion", rankScore: 84, anchorClose: 17.9, observedChangePct: 5.6, maxDrawdownPct: -2.8, dataStatus: window <= 5 ? "complete" : "partial", missingReason: window <= 5 ? null : "insufficient_future_candles" }),
  ];

  return rows;
}

function makeObservationRow({
  window,
  symbol,
  group,
  label,
  rankScore,
  anchorClose,
  observedChangePct,
  maxDrawdownPct,
  dataStatus,
  missingReason = null,
}: {
  window: 1 | 3 | 5 | 10;
  symbol: string;
  group: string;
  label: string;
  rankScore: number;
  anchorClose: number;
  observedChangePct: number | null;
  maxDrawdownPct: number | null;
  dataStatus: "complete" | "partial" | "missing";
  missingReason?: string | null;
}): VisualObservationRow {
  const observedClose =
    typeof observedChangePct === "number"
      ? anchorClose * (1 + observedChangePct / 100)
      : null;

  return {
    id: `${validationRunId}-${window}-${symbol}`,
    scanRunId: validationRunId,
    symbol,
    exchange: "binance",
    market: "spot",
    timeframe: "4h",
    group,
    label,
    primarySignal: label,
    rankScore,
    anchorTime: "2026-06-03T04:00:00.000Z",
    anchorClose,
    anchorSource: "stored_signal",
    latestMarketOpenTime: "2026-06-03T20:00:00.000Z",
    window,
    observedClose,
    observedChangePct,
    maxDrawdownPct,
    dataStatus,
    missingReason,
  };
}

function makeObservationResponse({
  run,
  window,
  rows,
}: {
  run: VisualRun;
  window: 1 | 3 | 5 | 10;
  rows: VisualObservationRow[];
}): NonNullable<VisualObservationResponse> {
  const counts = getObservationCounts(rows);

  return {
    ok: true,
    run,
    rows,
    summary: {
      totalRows: 410,
      returnedRows: rows.length,
      completeCount: counts.complete,
      partialCount: counts.partial,
      missingCount: counts.missing,
      window,
      timeframe: "4h",
      runId: run.runId,
    },
    metadata: {
      window,
      selectedWindow: window,
      windowUnit: "completed_candles",
      rowCount: rows.length,
      completeCount: counts.complete,
      partialCount: counts.partial,
      missingCount: counts.missing,
      limited: true,
      timeframe: "4h",
      assetClass: "crypto",
      disclaimer: "Visual-check data.",
    },
  };
}

function getObservationCounts(rows: VisualObservationRow[]) {
  return rows.reduce(
    (counts, row) => ({
      complete: counts.complete + (row.dataStatus === "complete" ? 1 : 0),
      partial: counts.partial + (row.dataStatus === "partial" ? 1 : 0),
      missing: counts.missing + (row.dataStatus === "missing" ? 1 : 0),
    }),
    { complete: 0, partial: 0, missing: 0 },
  );
}

function makeReadinessRun({
  run,
  state,
  blocker = state === "ready" ? "observable" : "time_maturity",
  diagnosticBlocker = state === "ready" ? "observable" : "waiting_for_future_candles",
  completeCount,
  partialCount,
  missingCount,
  dominantMissingReason,
  dominantMissingReasonCount,
  expectedCompleteTime = null,
}: {
  run: VisualRun;
  state: "ready" | "not_ready" | "unavailable";
  blocker?: "observable" | "time_maturity" | "market_data_coverage" | "mixed" | "unavailable" | "no_runs";
  diagnosticBlocker?: "observable" | "waiting_for_future_candles" | "stale_market_data" | "unavailable" | "no_runs";
  completeCount: number;
  partialCount: number;
  missingCount: number;
  dominantMissingReason: string | null;
  dominantMissingReasonCount: number;
  expectedCompleteTime?: string | null;
}): NonNullable<VisualReadinessRun> {
  return {
    run,
    state,
    blocker,
    diagnosticBlocker,
    isObservable: state === "ready",
    isLimited: run.isLikelyFullUniverse === false,
    rowCount: 410,
    completeCount,
    partialCount,
    missingCount,
    dominantMissingReason,
    dominantMissingReasonCount,
    latestAnchorTime: "2026-06-03T04:00:00.000Z",
    expectedCompleteTime,
    latestCoverageTime: "2026-06-03T20:00:00.000Z",
    coverageLagMs: 0,
    coverageLagCandles: 0,
  };
}
