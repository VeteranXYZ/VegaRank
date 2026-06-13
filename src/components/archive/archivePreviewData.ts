import type { ArchiveVisualCheckData } from "./ArchivePageClient";
import {
  actionCodeByBias,
  groupCodeByResultGroup,
  riskCodeByType,
  setupCodeByAliasOrStructure,
  signalCodeByLabel,
} from "@/lib/vegarank-codebook/codeRegistry";

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
    makeOriginalRow({ runId, index: 1, symbol: "BTCUSDT", groupCode: groupCodeByResultGroup.high_priority, actionCode: "AC_601", signalCode: signalCodeByLabel.confirmed, setupCode: setupCodeByAliasOrStructure.strong_trend, rankScore: 92, confidenceScore: 88 }),
    makeOriginalRow({ runId, index: 2, symbol: "SEIUSDT", groupCode: groupCodeByResultGroup.eligible, actionCode: actionCodeByBias.eligible, signalCode: signalCodeByLabel.confirmed, setupCode: setupCodeByAliasOrStructure.breakout_confirmed, rankScore: 89, confidenceScore: 84 }),
    makeOriginalRow({ runId, index: 3, symbol: "ETHUSDT", groupCode: "GR_201", actionCode: actionCodeByBias.watch_only, signalCode: signalCodeByLabel.watch, setupCode: setupCodeByAliasOrStructure.healthy_pullback, rankScore: 81, confidenceScore: 72 }),
    makeOriginalRow({ runId, index: 4, symbol: "AAVEUSDT", groupCode: groupCodeByResultGroup.watch, actionCode: actionCodeByBias.watch_only, signalCode: signalCodeByLabel.watch, setupCode: setupCodeByAliasOrStructure.trend_repair, rankScore: 74, confidenceScore: 68 }),
    makeOriginalRow({ runId, index: 5, symbol: "DOGEUSDT", groupCode: groupCodeByResultGroup.risk, actionCode: actionCodeByBias.avoid, signalCode: signalCodeByLabel.breakdown_risk, setupCode: setupCodeByAliasOrStructure.trend_breakdown, riskCodes: [riskCodeByType.trend_breakdown_risk], rankScore: 38, confidenceScore: 54 }),
    makeOriginalRow({ runId, index: 6, symbol: "XRPUSDT", groupCode: groupCodeByResultGroup.overheated, actionCode: actionCodeByBias.do_not_chase, signalCode: signalCodeByLabel.overheated, setupCode: setupCodeByAliasOrStructure.overextended, riskCodes: [riskCodeByType.overheat_risk], rankScore: 35, confidenceScore: 50 }),
    makeOriginalRow({ runId, index: 7, symbol: "AVAXUSDT", groupCode: groupCodeByResultGroup.neutral, actionCode: actionCodeByBias.ignore, signalCode: signalCodeByLabel.neutral, setupCode: setupCodeByAliasOrStructure.neutral, rankScore: 58, confidenceScore: 60 }),
    makeOriginalRow({ runId, index: 8, symbol: "SUIUSDT", groupCode: groupCodeByResultGroup.insufficient_history, actionCode: actionCodeByBias.ignore, signalCode: signalCodeByLabel.neutral, setupCode: setupCodeByAliasOrStructure.neutral, qualityCodes: ["QH_201"], rankScore: 51, confidenceScore: 42 }),
    makeOriginalRow({ runId, index: 9, symbol: "LINKUSDT", groupCode: groupCodeByResultGroup.eligible, actionCode: actionCodeByBias.eligible, signalCode: signalCodeByLabel.trend, setupCode: setupCodeByAliasOrStructure.trend_repair, rankScore: 84, confidenceScore: 78 }),
  ];
}

function makeOriginalRow({
  runId,
  index,
  symbol,
  groupCode,
  actionCode,
  signalCode,
  setupCode,
  riskCodes = [],
  qualityCodes = [],
  rankScore,
  confidenceScore,
}: {
  runId: string;
  index: number;
  symbol: string;
  groupCode: string;
  actionCode: string;
  signalCode: string;
  setupCode: string;
  riskCodes?: string[];
  qualityCodes?: string[];
  rankScore: number;
  confidenceScore: number;
}): VisualSnapshotRow {
  const setupQualityScore = Math.max(0, rankScore - 6);
  const riskAdjustedScore = Math.max(0, rankScore - riskCodes.length * 8);

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
    groupCode,
    actionCode,
    riskCode: riskCodes[0] ?? null,
    riskCodes,
    signalCodes: [signalCode],
    setupCode,
    qualityCodes,
    metrics: {
      rankScore,
      riskAdjustedScore,
      setupQualityScore,
      confidenceScore,
      absoluteSetupScore: setupQualityScore,
      universePercentile: Math.max(1, Math.min(99, rankScore)),
      score: rankScore,
      finalSignalScore: riskAdjustedScore,
      opportunityScore: setupQualityScore,
      confirmationScore: confidenceScore,
      riskScore: riskCodes.length > 0 ? 78 : 28,
      trendScore: Math.max(0, rankScore - 8),
      momentumScore: Math.max(0, rankScore - 10),
      volumeScore: Math.max(0, rankScore - 12),
      structureScore: Math.max(0, rankScore - 7),
    },
    scannerVersion: "visual-check",
    scoringVersion: "visual-check",
  };
}

function makeObservationRows(window: 1 | 3 | 5 | 10): VisualObservationRow[] {
  const rows = [
    makeObservationRow({ window, symbol: "BTCUSDT", groupCode: groupCodeByResultGroup.high_priority, actionCode: "AC_601", signalCode: signalCodeByLabel.confirmed, setupCode: setupCodeByAliasOrStructure.strong_trend, rankScore: 92, confidenceScore: 88, anchorClose: 67120, observedChangePct: 3.8, maxDrawdownPct: -1.2, dataStatus: "complete" }),
    makeObservationRow({ window, symbol: "SEIUSDT", groupCode: groupCodeByResultGroup.eligible, actionCode: actionCodeByBias.eligible, signalCode: signalCodeByLabel.confirmed, setupCode: setupCodeByAliasOrStructure.breakout_confirmed, rankScore: 89, confidenceScore: 84, anchorClose: 0.421, observedChangePct: 8.4, maxDrawdownPct: -2.1, dataStatus: "complete" }),
    makeObservationRow({ window, symbol: "ETHUSDT", groupCode: "GR_201", actionCode: actionCodeByBias.watch_only, signalCode: signalCodeByLabel.watch, setupCode: setupCodeByAliasOrStructure.healthy_pullback, rankScore: 81, confidenceScore: 72, anchorClose: 3580, observedChangePct: -1.7, maxDrawdownPct: -3.6, dataStatus: "complete" }),
    makeObservationRow({ window, symbol: "AAVEUSDT", groupCode: groupCodeByResultGroup.watch, actionCode: actionCodeByBias.watch_only, signalCode: signalCodeByLabel.watch, setupCode: setupCodeByAliasOrStructure.trend_repair, rankScore: 74, confidenceScore: 68, anchorClose: 104.2, observedChangePct: 1.2, maxDrawdownPct: -1.5, dataStatus: window <= 3 ? "partial" : "missing", missingReason: window <= 3 ? "insufficient_future_candles" : "no_future_candles" }),
    makeObservationRow({ window, symbol: "DOGEUSDT", groupCode: groupCodeByResultGroup.risk, actionCode: actionCodeByBias.avoid, signalCode: signalCodeByLabel.breakdown_risk, setupCode: setupCodeByAliasOrStructure.trend_breakdown, riskCodes: [riskCodeByType.trend_breakdown_risk], rankScore: 38, confidenceScore: 54, anchorClose: 0.148, observedChangePct: -6.5, maxDrawdownPct: -9.8, dataStatus: "complete" }),
    makeObservationRow({ window, symbol: "XRPUSDT", groupCode: groupCodeByResultGroup.overheated, actionCode: actionCodeByBias.do_not_chase, signalCode: signalCodeByLabel.overheated, setupCode: setupCodeByAliasOrStructure.overextended, riskCodes: [riskCodeByType.overheat_risk], rankScore: 35, confidenceScore: 50, anchorClose: 0.52, observedChangePct: -2.3, maxDrawdownPct: -5.1, dataStatus: window === 1 ? "complete" : "partial", missingReason: window === 1 ? null : "insufficient_future_candles" }),
    makeObservationRow({ window, symbol: "AVAXUSDT", groupCode: groupCodeByResultGroup.neutral, actionCode: actionCodeByBias.ignore, signalCode: signalCodeByLabel.neutral, setupCode: setupCodeByAliasOrStructure.neutral, rankScore: 58, confidenceScore: 60, anchorClose: 36.4, observedChangePct: 0.4, maxDrawdownPct: -2.4, dataStatus: "complete" }),
    makeObservationRow({ window, symbol: "SUIUSDT", groupCode: groupCodeByResultGroup.insufficient_history, actionCode: actionCodeByBias.ignore, signalCode: signalCodeByLabel.neutral, setupCode: setupCodeByAliasOrStructure.neutral, qualityCodes: ["QH_201"], rankScore: 51, confidenceScore: 42, anchorClose: 1.08, observedChangePct: null, maxDrawdownPct: null, dataStatus: "missing", missingReason: "no_future_candles" }),
    makeObservationRow({ window, symbol: "LINKUSDT", groupCode: groupCodeByResultGroup.eligible, actionCode: actionCodeByBias.eligible, signalCode: signalCodeByLabel.trend, setupCode: setupCodeByAliasOrStructure.trend_repair, rankScore: 84, confidenceScore: 78, anchorClose: 17.9, observedChangePct: 5.6, maxDrawdownPct: -2.8, dataStatus: window <= 5 ? "complete" : "partial", missingReason: window <= 5 ? null : "insufficient_future_candles" }),
  ];

  return [...rows, ...makeDiagnosticObservationRows(window)];
}

function makeDiagnosticObservationRows(
  window: 1 | 3 | 5 | 10,
): VisualObservationRow[] {
  const highPrioritySymbols = [
    "SOLUSDT",
    "BNBUSDT",
    "ADAUSDT",
    "DOTUSDT",
    "NEARUSDT",
    "INJUSDT",
    "FETUSDT",
    "RUNEUSDT",
    "OPUSDT",
    "ARBUSDT",
    "TIAUSDT",
    "TAOUSDT",
    "WIFUSDT",
    "PEPEUSDT",
    "LTCUSDT",
    "BCHUSDT",
    "ETCUSDT",
    "ATOMUSDT",
    "FILUSDT",
    "JUPUSDT",
  ];
  const watchSymbols = [
    "KASUSDT",
    "GRTUSDT",
    "STXUSDT",
    "ALGOUSDT",
    "XLMUSDT",
    "VETUSDT",
    "ICPUSDT",
    "IMXUSDT",
    "APTUSDT",
    "HBARUSDT",
    "QNTUSDT",
    "SANDUSDT",
    "MANAUSDT",
    "ENAUSDT",
    "BONKUSDT",
    "FLOKIUSDT",
    "ORDIUSDT",
    "WLDUSDT",
    "PYTHUSDT",
    "RENDERUSDT",
  ];
  const riskSymbols = [
    "CRVUSDT",
    "COMPUSDT",
    "UNIUSDT",
    "MKRUSDT",
    "DYDXUSDT",
    "LDOUSDT",
    "ENSUSDT",
    "PENDLEUSDT",
    "BLURUSDT",
    "STRKUSDT",
    "ZROUSDT",
    "JTOUSDT",
    "AEVOUSDT",
    "MEMEUSDT",
    "NOTUSDT",
    "GMTUSDT",
    "APEUSDT",
    "CHZUSDT",
    "GALAUSDT",
    "LUNCUSDT",
  ];

  return [
    ...highPrioritySymbols.map((symbol, index) =>
      makeObservationRow({
        window,
        symbol,
        groupCode: groupCodeByResultGroup.high_priority,
        actionCode: "AC_601",
        signalCode: signalCodeByLabel.confirmed,
        setupCode: setupCodeByAliasOrStructure.strong_trend,
        rankScore: 91 - (index % 4),
        confidenceScore: 88 - (index % 3),
        anchorClose: 120 + index * 1.7,
        observedChangePct: 2.6 + (index % 5) * 0.25,
        maxDrawdownPct: -1 - (index % 4) * 0.2,
        dataStatus: "complete",
      }),
    ),
    ...watchSymbols.map((symbol, index) =>
      makeObservationRow({
        window,
        symbol,
        groupCode:
          index % 2 === 0
            ? groupCodeByResultGroup.watch
            : groupCodeByResultGroup.neutral,
        actionCode:
          index % 2 === 0 ? actionCodeByBias.watch_only : actionCodeByBias.ignore,
        signalCode:
          index % 2 === 0 ? signalCodeByLabel.watch : signalCodeByLabel.neutral,
        setupCode:
          index % 2 === 0
            ? setupCodeByAliasOrStructure.trend_repair
            : setupCodeByAliasOrStructure.neutral,
        rankScore: 55 + (index % 5),
        confidenceScore: 36 + (index % 4),
        anchorClose: 40 + index * 0.9,
        observedChangePct: 0.1 + (index % 5) * 0.12,
        maxDrawdownPct: -2.1 - (index % 4) * 0.25,
        dataStatus: "complete",
      }),
    ),
    ...riskSymbols.map((symbol, index) =>
      makeObservationRow({
        window,
        symbol,
        groupCode: groupCodeByResultGroup.risk,
        actionCode: actionCodeByBias.avoid,
        signalCode: signalCodeByLabel.breakdown_risk,
        setupCode: setupCodeByAliasOrStructure.trend_breakdown,
        riskCodes: [riskCodeByType.trend_breakdown_risk],
        rankScore: 30 + (index % 5),
        confidenceScore: 34 + (index % 4),
        anchorClose: 18 + index * 0.55,
        observedChangePct: -2.4 - (index % 5) * 0.25,
        maxDrawdownPct: -5.4 - (index % 4) * 0.45,
        dataStatus: "complete",
      }),
    ),
  ];
}

function makeObservationRow({
  window,
  symbol,
  groupCode,
  actionCode,
  signalCode,
  setupCode,
  riskCodes = [],
  qualityCodes = [],
  rankScore,
  confidenceScore,
  anchorClose,
  observedChangePct,
  maxDrawdownPct,
  dataStatus,
  missingReason = null,
}: {
  window: 1 | 3 | 5 | 10;
  symbol: string;
  groupCode: string;
  actionCode: string;
  signalCode: string;
  setupCode: string;
  riskCodes?: string[];
  qualityCodes?: string[];
  rankScore: number;
  confidenceScore: number;
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
  const setupQualityScore = Math.max(0, rankScore - 6);
  const riskAdjustedScore = Math.max(0, rankScore - riskCodes.length * 8);

  return {
    id: `${validationRunId}-${window}-${symbol}`,
    scanRunId: validationRunId,
    symbol,
    exchange: "binance",
    market: "spot",
    timeframe: "4h",
    groupCode,
    actionCode,
    riskCode: riskCodes[0] ?? null,
    riskCodes,
    signalCodes: [signalCode],
    setupCode,
    qualityCodes,
    metrics: {
      rankScore,
      riskAdjustedScore,
      setupQualityScore,
      confidenceScore,
      absoluteSetupScore: setupQualityScore,
      universePercentile: Math.max(1, Math.min(99, rankScore)),
      score: rankScore,
      finalSignalScore: riskAdjustedScore,
      opportunityScore: setupQualityScore,
      confirmationScore: confidenceScore,
      riskScore: riskCodes.length > 0 ? 78 : 28,
      trendScore: Math.max(0, rankScore - 8),
      momentumScore: Math.max(0, rankScore - 10),
      volumeScore: Math.max(0, rankScore - 12),
      structureScore: Math.max(0, rankScore - 7),
    },
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
