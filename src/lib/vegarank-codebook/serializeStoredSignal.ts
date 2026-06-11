import {
  isScannerCode,
  scannerCodeVersions,
  type ActiveScannerCode,
} from "./codeRegistry";
import type { ScannerCodeContractMetrics } from "@/lib/shared/rankingTypes";
import {
  QUANT_SCORING_CALIBRATION_VERSION,
  QUANT_SCORING_MODEL_VERSION,
} from "@/lib/ranking-engine/quantScoring";

export type ScannerStoredCodeMetrics = ScannerCodeContractMetrics;

export type StoredSignalCodeFields = {
  groupCode: ActiveScannerCode;
  actionCode: ActiveScannerCode;
  riskCode: ActiveScannerCode | null;
  riskCodes: ActiveScannerCode[];
  setupCode: ActiveScannerCode;
  phaseCode: ActiveScannerCode;
  reasonCodes: ActiveScannerCode[];
  signalCodes: ActiveScannerCode[];
  qualityCodes: ActiveScannerCode[];
  scannerVersion: string;
  codeSchemaVersion: string;
  dictionaryVersion: string;
};

export type StoredSignalCodeSource = {
  signalLabel?: string | null;
  actionBias?: string | null;
  primaryStructure?: string | null;
  detectedRiskTypes?: unknown[] | null;
  factors?: Record<string, unknown> | null;
  rawMetrics?: Record<string, unknown> | null;
  scannerVersion?: string | null;
};

export type PublicStoredScannerSignalInput = StoredSignalCodeSource & {
  id: string;
  scanRunId: string;
  exchange: string;
  market: string;
  symbol: string;
  timeframe: string;
  assetClass?: string | null;
  scanTime?: string | null;
  candleOpenTime?: string | null;
  priceAtSignal?: number | null;
  rankScore?: number | null;
  finalSignalScore?: number | null;
  opportunityScore?: number | null;
  confirmationScore?: number | null;
  riskScore?: number | null;
  trendScore?: number | null;
  momentumScore?: number | null;
  volumeScore?: number | null;
  structureScore?: number | null;
  candleCount?: number | null;
  qualityTier?: string | null;
  isLowQuality?: boolean | null;
  qualityFlags?: string[] | null;
};

export type PublicStoredScannerSignal = {
  id: string;
  scanRunId: string;
  exchange: string;
  market: string;
  symbol: string;
  timeframe: string;
  assetClass?: string | null;
  scanTime?: string | null;
  candleOpenTime?: string | null;
  groupCode: ActiveScannerCode;
  actionCode: ActiveScannerCode;
  riskCode: ActiveScannerCode | null;
  riskCodes: ActiveScannerCode[];
  setupCode: ActiveScannerCode;
  phaseCode: ActiveScannerCode;
  reasonCodes: ActiveScannerCode[];
  signalCodes: ActiveScannerCode[];
  qualityCodes: ActiveScannerCode[];
  metrics: ScannerStoredCodeMetrics;
  scannerVersion: string;
  codeSchemaVersion: string;
  dictionaryVersion: string;
};

export function getStoredSignalCodeFields(
  source: StoredSignalCodeSource,
): StoredSignalCodeFields {
  const embeddedContract = getEmbeddedCodeContract(source.rawMetrics);
  const factors = source.factors ?? {};

  const signalCodes = normalizeCodeList(
    embeddedContract?.signalCodes ?? factors.signalCodes ?? [source.signalLabel],
  );
  const riskCodes = normalizeCodeList(
    embeddedContract?.riskCodes ??
      factors.riskCodes ??
      toRiskCodeList(source.detectedRiskTypes),
  );

  return {
    groupCode:
      firstCode(embeddedContract?.groupCode, factors.groupCode) ?? "GR_001",
    actionCode:
      firstCode(embeddedContract?.actionCode, factors.actionCode, source.actionBias) ??
      "NX_801",
    riskCode:
      firstCode(embeddedContract?.riskCode, factors.riskCode) ??
      riskCodes[0] ??
      null,
    riskCodes,
    setupCode:
      firstCode(
        embeddedContract?.setupCode,
        factors.setupCode,
        source.primaryStructure,
      ) ?? "NX_801",
    phaseCode: firstCode(embeddedContract?.phaseCode, factors.phaseCode) ?? "NX_801",
    reasonCodes: normalizeCodeList(
      embeddedContract?.reasonCodes ?? factors.reasonCodes,
    ),
    signalCodes,
    qualityCodes: normalizeCodeList(
      embeddedContract?.qualityCodes ?? factors.qualityCodes,
    ),
    scannerVersion:
      stringValue(embeddedContract?.scannerVersion) ??
      source.scannerVersion ??
      scannerCodeVersions.scannerVersion,
    codeSchemaVersion:
      stringValue(embeddedContract?.codeSchemaVersion) ??
      stringValue(factors.codeSchemaVersion) ??
      scannerCodeVersions.codeSchemaVersion,
    dictionaryVersion:
      stringValue(embeddedContract?.dictionaryVersion) ??
      stringValue(factors.dictionaryVersion) ??
      scannerCodeVersions.dictionaryVersion,
  };
}

export function serializeStoredSignalToCodeContract(
  source: PublicStoredScannerSignalInput,
): PublicStoredScannerSignal {
  const codeFields = getStoredSignalCodeFields(source);
  const rawMetrics = source.rawMetrics ?? {};
  const embeddedMetrics = getEmbeddedMetrics(rawMetrics);
  const qualityCodes = uniqueCodes([
    ...codeFields.qualityCodes,
    ...getSymbolQualityCodes(source),
  ]);

  return {
    id: source.id,
    scanRunId: source.scanRunId,
    exchange: source.exchange,
    market: source.market,
    symbol: source.symbol,
    timeframe: source.timeframe,
    assetClass: source.assetClass,
    scanTime: source.scanTime,
    candleOpenTime: source.candleOpenTime,
    ...codeFields,
    qualityCodes,
    metrics: buildStoredMetrics({
      embeddedMetrics,
      rawMetrics,
      source,
    }),
  };
}

function getEmbeddedCodeContract(rawMetrics: Record<string, unknown> | null | undefined) {
  const value = rawMetrics?.codeContract;

  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function getEmbeddedMetrics(rawMetrics: Record<string, unknown> | null | undefined) {
  const value = getEmbeddedCodeContract(rawMetrics)?.metrics;

  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeCodeList(value: unknown) {
  const values = Array.isArray(value) ? value : value === undefined ? [] : [value];

  return [...new Set(values.filter(isScannerCode))];
}

function getSymbolQualityCodes(source: PublicStoredScannerSignalInput) {
  const rawValues = [
    source.qualityTier,
    ...(Array.isArray(source.qualityFlags) ? source.qualityFlags : []),
  ];
  const codes = rawValues
    .map((value) => qualityCodeBySymbolQualityValue[stringValue(value) ?? ""])
    .filter(isScannerCode);

  if (codes.length === 0 && source.isLowQuality === false) {
    codes.push("QH_001");
  }

  return codes;
}

const qualityCodeBySymbolQualityValue: Partial<Record<string, ActiveScannerCode>> = {
  core: "QH_601",
  major: "QH_501",
  normal: "QH_001",
  new_listing: "QH_202",
  low_history: "QH_201",
  meme: "QH_101",
  fan_token: "QH_101",
  wrapped_or_staked: "QH_101",
  stable_like: "QH_101",
  special_or_suspicious: "QH_101",
};

function uniqueCodes(codes: ActiveScannerCode[]) {
  return [...new Set(codes)];
}

function buildStoredMetrics({
  embeddedMetrics,
  rawMetrics,
  source,
}: {
  embeddedMetrics: Record<string, unknown> | null;
  rawMetrics: Record<string, unknown>;
  source: PublicStoredScannerSignalInput;
}): ScannerStoredCodeMetrics {
  const rankScore = numberValue(embeddedMetrics?.rankScore) ?? source.rankScore ?? null;
  const riskAdjustedScore =
    numberValue(embeddedMetrics?.riskAdjustedScore) ??
    numberValue(embeddedMetrics?.finalSignalScore) ??
    source.finalSignalScore ??
    null;
  const setupQualityScore =
    numberValue(embeddedMetrics?.setupQualityScore) ??
    numberValue(embeddedMetrics?.opportunityScore) ??
    source.opportunityScore ??
    null;
  const confidenceScore =
    numberValue(embeddedMetrics?.confidenceScore) ??
    numberValue(embeddedMetrics?.confirmationScore) ??
    source.confirmationScore ??
    null;
  const riskPenalty =
    numberValue(embeddedMetrics?.riskPenalty) ??
    numberValue(embeddedMetrics?.riskScore) ??
    source.riskScore ??
    null;

  return {
    rankScore,
    riskAdjustedScore,
    setupQualityScore,
    confidenceScore,
    absoluteSetupScore:
      numberValue(embeddedMetrics?.absoluteSetupScore) ?? setupQualityScore,
    universePercentile: numberValue(embeddedMetrics?.universePercentile),
    trendScore:
      numberValue(embeddedMetrics?.trendScore) ?? source.trendScore ?? null,
    momentumScore:
      numberValue(embeddedMetrics?.momentumScore) ??
      source.momentumScore ??
      null,
    structureScore:
      numberValue(embeddedMetrics?.structureScore) ??
      source.structureScore ??
      null,
    volatilityScore: numberValue(embeddedMetrics?.volatilityScore),
    volumeScore:
      numberValue(embeddedMetrics?.volumeScore) ?? source.volumeScore ?? null,
    mtfAgreementScore: numberValue(embeddedMetrics?.mtfAgreementScore),
    riskPenalty,
    qualityPenalty: numberValue(embeddedMetrics?.qualityPenalty),
    historyBars:
      numberValue(embeddedMetrics?.historyBars) ??
      (typeof source.candleCount === "number"
        ? source.candleCount
        : numberValue(rawMetrics.historyBars)),
    volumeRank:
      numberValue(embeddedMetrics?.volumeRank) ??
      numberValue(rawMetrics.volumeRank),
    volatilityPercentile:
      numberValue(embeddedMetrics?.volatilityPercentile) ??
      numberValue(embeddedMetrics?.bbWidthPercentile) ??
      numberValue(rawMetrics.bbWidthPercentile),
    atrExtension: numberValue(embeddedMetrics?.atrExtension),
    distanceFromBase: numberValue(embeddedMetrics?.distanceFromBase),
    scoringModelVersion: QUANT_SCORING_MODEL_VERSION,
    scoringCalibrationVersion: QUANT_SCORING_CALIBRATION_VERSION,
    score: numberValue(embeddedMetrics?.score) ?? rankScore,
    finalSignalScore:
      numberValue(embeddedMetrics?.finalSignalScore) ?? riskAdjustedScore,
    opportunityScore:
      numberValue(embeddedMetrics?.opportunityScore) ?? setupQualityScore,
    confirmationScore:
      numberValue(embeddedMetrics?.confirmationScore) ?? confidenceScore,
    riskScore: numberValue(embeddedMetrics?.riskScore) ?? riskPenalty,
    qualityScore:
      numberValue(embeddedMetrics?.qualityScore) ??
      numberValue(rawMetrics.qualityScore),
    price:
      numberValue(embeddedMetrics?.price) ??
      source.priceAtSignal ??
      numberValue(rawMetrics.price),
    rsi14:
      numberValue(embeddedMetrics?.rsi14) ??
      numberValue(rawMetrics.rsi14 ?? rawMetrics.rsi),
    bbPercent:
      numberValue(embeddedMetrics?.bbPercent) ??
      numberValue(rawMetrics.bbPercent),
    bbWidthPercentile:
      numberValue(embeddedMetrics?.bbWidthPercentile) ??
      numberValue(rawMetrics.bbWidthPercentile),
    volumeRatio:
      numberValue(embeddedMetrics?.volumeRatio) ??
      numberValue(rawMetrics.volumeRatio),
  };
}

function firstCode(...values: unknown[]) {
  return values.find(isScannerCode) ?? null;
}

function toRiskCodeList(value: unknown[] | null | undefined) {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
