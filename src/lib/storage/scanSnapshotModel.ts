import { TIMEFRAMES, type Timeframe } from "@/lib/exchanges/types";
import type { MtfPreset } from "@/lib/scanner/multiTimeframe";
import type {
  MarketPhase,
  MultiTimeframeAlignment,
  ScanResult,
  ScannerObservation,
  ScannerSignalState,
} from "@/lib/scanner/types";

export type ScanSnapshotMode = "single" | "mtf";

export type StoredScanSnapshot = {
  id: string;
  createdAt: string;
  exchange: "binance";
  mode: ScanSnapshotMode;
  timeframe?: Timeframe;
  preset?: MtfPreset;
  timeframes?: Timeframe[];
  limit: number;
  itemCount: number;
  errorsCount: number;
  results: StoredScanResult[];
};

export type StoredScanResult = {
  symbol: string;
  timeframe: Timeframe;
  price: number;
  phase: MarketPhase;
  signalState: ScannerSignalState;
  signalLabel: string;
  rankScore: number;
  finalSignalScore?: number;
  opportunityScore: number;
  confirmationScore: number;
  riskScore: number;
  trendScore?: number;
  momentumScore?: number;
  volumeScore?: number;
  structureScore?: number;
  actionBias?: ScanResult["actionBias"];
  primaryStructure?: ScanResult["primaryStructure"];
  secondaryStructures?: string[];
  detectedRiskTypes?: ScanResult["detectedRiskTypes"];
  rawMetrics?: ScanResult["rawMetrics"];
  bullishObservations?: ScannerObservation[];
  bearishObservations?: ScannerObservation[];
  riskObservations?: ScannerObservation[];
  neutralObservations?: ScannerObservation[];
  nextConfirmationObservations?: ScannerObservation[];
  invalidationObservations?: ScannerObservation[];
  multiTimeframe?: {
    alignment: MultiTimeframeAlignment;
    label: string;
    rankScore: number;
    constructiveCount: number;
    riskCount: number;
    timeframes: Timeframe[];
  };
};

export type PersistScanSnapshotInput = Omit<
  StoredScanSnapshot,
  "id" | "results"
> & {
  results: ScanResult[];
};

export function toStoredSnapshot(
  input: PersistScanSnapshotInput,
): StoredScanSnapshot {
  return {
    ...input,
    id: `${input.createdAt}-${input.mode}-${input.timeframe ?? input.preset}`,
    results: input.results.map(toStoredResult),
  };
}

export function toStoredResult(result: ScanResult): StoredScanResult {
  return {
    symbol: result.symbol,
    timeframe: result.timeframe,
    price: result.price,
    phase: result.phase,
    signalState: result.signal.state,
    signalLabel: result.signal.label,
    rankScore: result.rankScore,
    finalSignalScore: result.finalSignalScore,
    opportunityScore: result.opportunityScore,
    confirmationScore: result.confirmationScore,
    riskScore: result.riskScore,
    trendScore: result.trendScore,
    momentumScore: result.momentumScore,
    volumeScore: result.volumeScore,
    structureScore: result.structureScore,
    actionBias: result.actionBias,
    primaryStructure: result.primaryStructure,
    secondaryStructures: result.secondaryStructures,
    detectedRiskTypes: result.detectedRiskTypes,
    rawMetrics: result.rawMetrics,
    bullishObservations: result.bullishObservations,
    bearishObservations: result.bearishObservations,
    riskObservations: result.riskObservations,
    neutralObservations: result.neutralObservations,
    nextConfirmationObservations: result.nextConfirmationObservations,
    invalidationObservations: result.invalidationObservations,
    multiTimeframe: result.multiTimeframe
      ? {
          alignment: result.multiTimeframe.alignment,
          label: result.multiTimeframe.label,
          rankScore: result.multiTimeframe.rankScore,
          constructiveCount: result.multiTimeframe.constructiveCount,
          riskCount: result.multiTimeframe.riskCount,
          timeframes: result.multiTimeframe.timeframes,
        }
      : undefined,
  };
}

export function summarizeScanSnapshots(snapshots: StoredScanSnapshot[]) {
  const summary = {
    snapshotCount: snapshots.length,
    resultCount: 0,
    latestAt: snapshots[0]?.createdAt ?? null,
    byMode: {} as Record<ScanSnapshotMode, number>,
    bySignal: {} as Partial<Record<ScannerSignalState, number>>,
    byPhase: {} as Partial<Record<MarketPhase, number>>,
    byAlignment: {} as Partial<Record<MultiTimeframeAlignment, number>>,
  };

  for (const snapshot of snapshots) {
    summary.byMode[snapshot.mode] = (summary.byMode[snapshot.mode] ?? 0) + 1;
    summary.resultCount += snapshot.results.length;

    for (const result of snapshot.results) {
      summary.bySignal[result.signalState] =
        (summary.bySignal[result.signalState] ?? 0) + 1;
      summary.byPhase[result.phase] = (summary.byPhase[result.phase] ?? 0) + 1;

      const alignment = result.multiTimeframe?.alignment;
      if (alignment) {
        summary.byAlignment[alignment] =
          (summary.byAlignment[alignment] ?? 0) + 1;
      }
    }
  }

  return summary;
}

export function normalizeStoredScanSnapshot(
  snapshot: StoredScanSnapshot,
): StoredScanSnapshot {
  const timeframe = normalizeTimeframe(snapshot.timeframe);
  const timeframes = snapshot.timeframes
    ?.map(normalizeTimeframe)
    .filter((value): value is Timeframe => value !== null);
  const results = snapshot.results
    .map(normalizeStoredScanResult)
    .filter((value): value is StoredScanResult => value !== null);

  return {
    ...snapshot,
    timeframe: timeframe ?? undefined,
    timeframes: timeframes && timeframes.length > 0 ? timeframes : undefined,
    itemCount: results.length,
    results,
  };
}

function normalizeStoredScanResult(
  result: StoredScanResult,
): StoredScanResult | null {
  const timeframe = normalizeTimeframe(result.timeframe);

  if (!timeframe) {
    return null;
  }

  return {
    ...result,
    timeframe,
    multiTimeframe: result.multiTimeframe
      ? {
          ...result.multiTimeframe,
          timeframes: result.multiTimeframe.timeframes
            .map(normalizeTimeframe)
            .filter((value): value is Timeframe => value !== null),
        }
      : undefined,
  };
}

function normalizeTimeframe(value: Timeframe | string | undefined) {
  if (!value) {
    return null;
  }

  if (value === "7d") {
    return "1w";
  }

  return TIMEFRAMES.includes(value as Timeframe) ? (value as Timeframe) : null;
}
