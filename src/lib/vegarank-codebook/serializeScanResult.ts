import type {
  ScannerCodeContractMetrics,
  ScannerCodeContractShape,
  ScanResult,
} from "@/lib/shared/rankingTypes";
import {
  isScannerCode,
  scannerCodeVersions,
  type ActiveScannerCode,
} from "./codeRegistry";
import {
  QUANT_SCORING_CALIBRATION_VERSION,
  QUANT_SCORING_MODEL_VERSION,
} from "@/lib/ranking-engine/quantScoring";

export type ScannerCodeMetrics = ScannerCodeContractMetrics;

export type ScannerCodeContractResult = Omit<
  ScannerCodeContractShape,
  | "groupCode"
  | "actionCode"
  | "riskCode"
  | "riskCodes"
  | "setupCode"
  | "phaseCode"
  | "reasonCodes"
  | "signalCodes"
  | "qualityCodes"
> & {
  groupCode: ActiveScannerCode;
  actionCode: ActiveScannerCode;
  riskCode: ActiveScannerCode | null;
  riskCodes: ActiveScannerCode[];
  setupCode: ActiveScannerCode;
  phaseCode: ActiveScannerCode;
  reasonCodes: ActiveScannerCode[];
  signalCodes: ActiveScannerCode[];
  qualityCodes: ActiveScannerCode[];
};

export function serializeScanResultToCodeContract(
  result: ScanResult,
): ScannerCodeContractResult {
  const contract = result.codeContract ?? buildFallbackCodeContract(result);

  return {
    exchange: result.exchange,
    symbol: result.symbol,
    timeframe: result.timeframe,
    assetClass: contract.assetClass,
    groupCode: toCode(contract.groupCode, "GR_101"),
    actionCode: toCode(contract.actionCode, "AC_101"),
    riskCode: nullableCode(contract.riskCode),
    riskCodes: normalizeCodes(contract.riskCodes),
    setupCode: toCode(contract.setupCode, "ST_001"),
    phaseCode: toCode(contract.phaseCode, "NX_801"),
    reasonCodes: normalizeCodes(contract.reasonCodes),
    signalCodes: normalizeCodes(contract.signalCodes),
    qualityCodes: normalizeCodes(contract.qualityCodes),
    metrics: normalizeMetrics(contract.metrics, result),
    scannerVersion: contract.scannerVersion || scannerCodeVersions.scannerVersion,
    codeSchemaVersion:
      contract.codeSchemaVersion || scannerCodeVersions.codeSchemaVersion,
    dictionaryVersion:
      contract.dictionaryVersion || scannerCodeVersions.dictionaryVersion,
  };
}

function normalizeMetrics(
  metrics: ScannerCodeContractMetrics | undefined,
  result: ScanResult,
): ScannerCodeContractMetrics {
  return {
    rankScore: numberOrNull(metrics?.rankScore ?? result.rankScore),
    riskAdjustedScore: numberOrNull(
      metrics?.riskAdjustedScore ?? result.riskAdjustedScore ?? result.finalSignalScore,
    ),
    setupQualityScore: numberOrNull(
      metrics?.setupQualityScore ?? result.setupQualityScore ?? result.opportunityScore,
    ),
    confidenceScore: numberOrNull(
      metrics?.confidenceScore ?? result.confidenceScore ?? result.confirmationScore,
    ),
    absoluteSetupScore: numberOrNull(
      metrics?.absoluteSetupScore ??
        result.absoluteSetupScore ??
        result.setupQualityScore ??
        result.opportunityScore,
    ),
    universePercentile: numberOrNull(
      metrics?.universePercentile ?? result.universePercentile ?? null,
    ),
    trendScore: numberOrNull(metrics?.trendScore ?? result.trendScore),
    momentumScore: numberOrNull(metrics?.momentumScore ?? result.momentumScore),
    structureScore: numberOrNull(metrics?.structureScore ?? result.structureScore),
    volatilityScore: numberOrNull(metrics?.volatilityScore ?? result.volatilityScore),
    volumeScore: numberOrNull(metrics?.volumeScore ?? result.volumeScore),
    mtfAgreementScore: numberOrNull(
      metrics?.mtfAgreementScore ?? result.mtfAgreementScore ?? null,
    ),
    riskPenalty: numberOrNull(
      metrics?.riskPenalty ?? result.riskPenalty ?? result.riskScore,
    ),
    qualityPenalty: numberOrNull(metrics?.qualityPenalty ?? result.qualityPenalty),
    historyBars: numberOrNull(
      metrics?.historyBars ?? result.dataQuality?.candleCount ?? null,
    ),
    volumeRank: numberOrNull(metrics?.volumeRank ?? result.volume?.ratio20 ?? null),
    volatilityPercentile: numberOrNull(
      metrics?.volatilityPercentile ?? result.bbWidthPercentile,
    ),
    atrExtension: numberOrNull(metrics?.atrExtension ?? null),
    distanceFromBase: numberOrNull(metrics?.distanceFromBase ?? null),
    scoringModelVersion: QUANT_SCORING_MODEL_VERSION,
    scoringCalibrationVersion: QUANT_SCORING_CALIBRATION_VERSION,
    score: numberOrNull(metrics?.score ?? metrics?.rankScore ?? result.rankScore),
    finalSignalScore: numberOrNull(
      metrics?.finalSignalScore ??
        metrics?.riskAdjustedScore ??
        result.finalSignalScore,
    ),
    opportunityScore: numberOrNull(
      metrics?.opportunityScore ??
        metrics?.setupQualityScore ??
        result.opportunityScore,
    ),
    confirmationScore: numberOrNull(
      metrics?.confirmationScore ??
        metrics?.confidenceScore ??
        result.confirmationScore,
    ),
    riskScore: numberOrNull(
      metrics?.riskScore ?? metrics?.riskPenalty ?? result.riskScore,
    ),
    qualityScore: numberOrNull(metrics?.qualityScore ?? null),
    price: numberOrNull(metrics?.price ?? result.price),
    rsi14: numberOrNull(metrics?.rsi14 ?? result.rsi14),
    bbPercent: numberOrNull(metrics?.bbPercent ?? result.bbPercent),
    bbWidthPercentile: numberOrNull(
      metrics?.bbWidthPercentile ?? result.bbWidthPercentile,
    ),
    volumeRatio: numberOrNull(metrics?.volumeRatio ?? result.volumeRatio),
  };
}

function buildFallbackCodeContract(result: ScanResult): ScannerCodeContractShape {
  return {
    exchange: result.exchange,
    symbol: result.symbol,
    timeframe: result.timeframe,
    groupCode: "GR_101",
    actionCode: "AC_101",
    riskCode: null,
    riskCodes: [],
    setupCode: "ST_001",
    phaseCode: "NX_801",
    reasonCodes: [],
    signalCodes: [],
    qualityCodes: result.dataQuality?.sufficientHistory ? ["QH_001"] : ["QH_201"],
    metrics: normalizeMetrics(undefined, result),
    ...scannerCodeVersions,
  };
}

function normalizeCodes(values: unknown) {
  const rawValues = Array.isArray(values) ? values : [];

  return [...new Set(rawValues.filter(isScannerCode))];
}

function nullableCode(value: unknown) {
  return isScannerCode(value) ? value : null;
}

function toCode(value: unknown, fallback: ActiveScannerCode) {
  return isScannerCode(value) ? value : fallback;
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
