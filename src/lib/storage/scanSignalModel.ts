import { SCORING_VERSION } from "@/lib/scanner/scoring";
import type { ScanResult } from "@/lib/scanner/types";
import type { Timeframe } from "@/lib/shared/timeframes";
import { safeJsonParse, safeJsonStringify } from "./json";

export const SCANNER_VERSION = "scanner-research-v1";
export const SCAN_SIGNAL_RETENTION_DAYS = 30;
export const FORWARD_EVALUATION_RETENTION_DAYS = 90;

export type ScanSnapshotRecord = {
  id: string;
  createdAt: string;
  timeframe: Timeframe | "mtf";
  totalSymbols: number;
  source: "remote" | "local";
  scannerVersion: string;
  scoringVersion: string;
  marketContextJson: string;
  metadataJson: string;
};

export type ScanSignalRecord = {
  id: string;
  snapshotId: string;
  symbol: string;
  timeframe: Timeframe;
  scanTime: string;
  priceAtSignal: number;
  scoringVersion: string;
  finalSignalScore: number;
  opportunityScore: number;
  confirmationScore: number;
  riskScore: number;
  trendScore: number;
  momentumScore: number;
  volumeScore: number;
  structureScore: number;
  signalLabel: ScanResult["signalLabel"];
  actionBias: ScanResult["actionBias"];
  primaryStructure: ScanResult["primaryStructure"];
  secondaryStructuresJson: string;
  detectedRiskTypesJson: string;
  bullishObservationsJson: string;
  bearishObservationsJson: string;
  riskObservationsJson: string;
  neutralObservationsJson: string;
  nextConfirmationObservationsJson: string;
  invalidationObservationsJson: string;
  rawMetricsJson: string;
  legacySignal: string;
  legacyRankScore: number;
  legacyWarningsJson: string;
  scannerVersion?: string;
  createdAt?: string;
};

export type PersistScanSignalsInput = {
  createdAt: string;
  timeframe: Timeframe | "mtf";
  source: "remote" | "local";
  results: ScanResult[];
  marketContext?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export function toScanSnapshotRecord({
  createdAt,
  timeframe,
  source,
  results,
  marketContext = {},
  metadata = {},
}: PersistScanSignalsInput): ScanSnapshotRecord {
  return {
    id: createSnapshotId({ createdAt, timeframe, source }),
    createdAt,
    timeframe,
    totalSymbols: results.length,
    source,
    scannerVersion: SCANNER_VERSION,
    scoringVersion: SCORING_VERSION,
    marketContextJson: safeJsonStringify(marketContext),
    metadataJson: safeJsonStringify({
      retention: {
        scanSnapshotsDays: SCAN_SIGNAL_RETENTION_DAYS,
        scanSignalsDays: SCAN_SIGNAL_RETENTION_DAYS,
        forwardEvaluationsDays: FORWARD_EVALUATION_RETENTION_DAYS,
      },
      ...metadata,
    }),
  };
}

export function toScanSignalRecords({
  snapshot,
  results,
}: {
  snapshot: ScanSnapshotRecord;
  results: ScanResult[];
}): ScanSignalRecord[] {
  return results.map((result) => ({
    id: `${snapshot.id}:${result.symbol}:${result.timeframe}`,
    snapshotId: snapshot.id,
    symbol: result.symbol,
    timeframe: result.timeframe,
    scanTime: snapshot.createdAt,
    priceAtSignal: result.price,
    scoringVersion: snapshot.scoringVersion,
    scannerVersion: snapshot.scannerVersion,
    createdAt: snapshot.createdAt,
    finalSignalScore: result.finalSignalScore,
    opportunityScore: result.opportunityScore,
    confirmationScore: result.confirmationScore,
    riskScore: result.riskScore,
    trendScore: result.trendScore,
    momentumScore: result.momentumScore,
    volumeScore: result.volumeScore,
    structureScore: result.structureScore,
    signalLabel: result.signalLabel,
    actionBias: result.actionBias,
    primaryStructure: result.primaryStructure,
    secondaryStructuresJson: safeJsonStringify(result.secondaryStructures),
    detectedRiskTypesJson: safeJsonStringify(result.detectedRiskTypes),
    bullishObservationsJson: safeJsonStringify(result.bullishObservations),
    bearishObservationsJson: safeJsonStringify(result.bearishObservations),
    riskObservationsJson: safeJsonStringify(result.riskObservations),
    neutralObservationsJson: safeJsonStringify(result.neutralObservations),
    nextConfirmationObservationsJson: safeJsonStringify(
      result.nextConfirmationObservations,
    ),
    invalidationObservationsJson: safeJsonStringify(result.invalidationObservations),
    rawMetricsJson: safeJsonStringify(result.rawMetrics),
    legacySignal: result.signal.state,
    legacyRankScore: result.rankScore,
    legacyWarningsJson: safeJsonStringify(result.warnings),
  }));
}

export function parseJsonArray(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = safeJsonParse<unknown>(value, []);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function createSnapshotId({
  createdAt,
  timeframe,
  source,
}: {
  createdAt: string;
  timeframe: Timeframe | "mtf";
  source: "remote" | "local";
}) {
  return `${createdAt}-${source}-${timeframe}`.replace(/[:.]/g, "-");
}
