import type {
  ActionBias,
  DetectedRiskType,
  MarketPhase,
  PrimaryStructure,
  ScannerExplanationKey,
  ScannerObservationKey,
  ScannerReviewKey,
  ScannerSignalLabel,
} from "@/lib/shared/rankingTypes";
import {
  SCANNER_CODE_SCHEMA_VERSION,
  SCANNER_DICTIONARY_VERSION,
  SCANNER_PROTOCOL_VERSION,
  type ScannerCode,
  type ScannerCodeMetadata,
} from "./codeTypes";
import { isScannerCodeDomain } from "./domains";

export type ScannerResultGroupCodeKey =
  | "high_priority"
  | "eligible"
  | "watch"
  | "overheated"
  | "risk"
  | "neutral"
  | "low_quality"
  | "insufficient_history";

export const scannerCodeVersions = {
  scannerVersion: SCANNER_PROTOCOL_VERSION,
  codeSchemaVersion: SCANNER_CODE_SCHEMA_VERSION,
  dictionaryVersion: SCANNER_DICTIONARY_VERSION,
} as const;

export const scannerCodeRegistry = {
  GR_001: defineCode("GR_001", "neutral_group", "neutral", "group"),
  GR_101: defineCode("GR_101", "watch", "info", "group"),
  GR_201: defineCode("GR_201", "constructive_watch", "info", "group"),
  GR_301: defineCode("GR_301", "risk", "risk", "group"),
  GR_302: defineCode("GR_302", "overheated", "warning", "group"),
  GR_401: defineCode("GR_401", "insufficient_history", "block", "group"),
  GR_402: defineCode("GR_402", "low_quality_excluded", "block", "group"),
  GR_501: defineCode("GR_501", "eligible", "positive", "group"),
  GR_601: defineCode("GR_601", "high_priority", "positive", "group"),

  AC_001: defineCode("AC_001", "ignore", "neutral", "action"),
  AC_101: defineCode("AC_101", "watch_only", "info", "action"),
  AC_102: defineCode("AC_102", "wait", "info", "action"),
  AC_103: defineCode("AC_103", "monitor_only", "neutral", "action"),
  AC_201: defineCode("AC_201", "needs_confirmation", "info", "action"),
  AC_301: defineCode("AC_301", "do_not_chase", "warning", "action"),
  AC_302: defineCode("AC_302", "reduce_priority", "risk", "action"),
  AC_401: defineCode("AC_401", "exclude", "block", "action"),
  AC_501: defineCode("AC_501", "add_to_research_watch", "positive", "action"),
  AC_601: defineCode("AC_601", "high_priority_review", "positive", "action"),

  MO_001: defineCode("MO_001", "neutral_momentum", "neutral", "signal"),
  MO_101: defineCode("MO_101", "weak_momentum", "warning", "signal"),
  MO_201: defineCode("MO_201", "improving_momentum", "info", "signal"),
  MO_202: defineCode("MO_202", "watch_momentum", "info", "signal"),
  MO_340: defineCode("MO_340", "overheated_momentum", "warning", "signal"),
  MO_301: defineCode("MO_301", "rsi_weak", "warning", "reason"),
  MO_302: defineCode("MO_302", "macd_weakening", "warning", "reason"),
  MO_303: defineCode("MO_303", "macd_weak", "risk", "reason"),
  MO_304: defineCode("MO_304", "macd_weakens_further", "risk", "reason"),
  MO_501: defineCode("MO_501", "rsi_healthy_repair", "positive", "reason"),
  MO_502: defineCode("MO_502", "macd_improving", "positive", "reason"),
  MO_601: defineCode("MO_601", "macd_strong", "positive", "signal"),
  MO_603: defineCode("MO_603", "rsi_recover_above_50", "positive", "reason"),

  TR_001: defineCode("TR_001", "trend_metadata", "neutral", "reason"),
  TR_101: defineCode("TR_101", "trend_repair", "info", "setup"),
  TR_201: defineCode("TR_201", "price_below_ma20", "warning", "reason"),
  TR_202: defineCode("TR_202", "daily_trend", "info", "setup"),
  TR_301: defineCode("TR_301", "price_below_ma50", "warning", "reason"),
  TR_302: defineCode("TR_302", "price_below_ma200", "risk", "reason"),
  TR_303: defineCode("TR_303", "ma20_below_ma50", "warning", "reason"),
  TR_304: defineCode("TR_304", "lose_ma20_repair", "risk", "reason"),
  TR_305: defineCode("TR_305", "fail_to_reclaim_ma50", "risk", "reason"),
  TR_501: defineCode("TR_501", "price_above_ma20", "positive", "reason"),
  TR_502: defineCode("TR_502", "price_above_ma50", "positive", "reason"),
  TR_503: defineCode("TR_503", "price_above_ma200", "positive", "reason"),
  TR_504: defineCode("TR_504", "long_term_repair", "positive", "setup"),
  TR_601: defineCode("TR_601", "strong_trend", "positive", "setup"),
  TR_602: defineCode("TR_602", "ma50_above_ma200", "positive", "reason"),
  TR_603: defineCode("TR_603", "reclaim_ma50", "positive", "reason"),
  TR_604: defineCode("TR_604", "ma20_approach_or_cross_ma50", "positive", "reason"),
  TR_605: defineCode("TR_605", "ma20_above_ma50", "positive", "reason"),

  PX_001: defineCode("PX_001", "neutral_structure", "neutral", "setup"),
  PX_101: defineCode("PX_101", "weak_bounce", "warning", "setup"),
  PX_201: defineCode("PX_201", "breakout_attempt", "info", "setup"),
  PX_301: defineCode("PX_301", "long_upper_wick", "warning", "risk"),
  PX_302: defineCode("PX_302", "weak_close", "warning", "risk"),
  PX_303: defineCode("PX_303", "breakdown", "risk", "setup"),
  PX_304: defineCode("PX_304", "lose_breakout_level", "risk", "reason"),
  PX_305: defineCode("PX_305", "failed_breakout", "risk", "setup"),
  PX_501: defineCode("PX_501", "breakout_confirmed", "positive", "setup"),
  PX_502: defineCode("PX_502", "pullback_retest", "positive", "setup"),
  PX_503: defineCode("PX_503", "range_reclaim", "positive", "setup"),
  PX_601: defineCode("PX_601", "strong_close", "positive", "reason"),
  PX_602: defineCode("PX_602", "hold_breakout_level", "positive", "reason"),
  PX_603: defineCode("PX_603", "close_above_prior_high", "positive", "reason"),
  PX_604: defineCode("PX_604", "squeeze_breakout", "positive", "setup"),

  VO_001: defineCode("VO_001", "normal_volatility", "neutral", "reason"),
  VO_101: defineCode("VO_101", "low_volatility", "neutral", "reason"),
  VO_102: defineCode("VO_102", "normal_volatility", "neutral", "reason"),
  VO_202: defineCode("VO_202", "compression", "info", "setup"),
  VO_301: defineCode("VO_301", "volatility_expansion_risk", "warning", "risk"),
  VO_302: defineCode("VO_302", "unstable_volatility", "risk", "risk"),
  VO_501: defineCode("VO_501", "squeeze_setup", "positive", "setup"),
  VO_601: defineCode("VO_601", "confirmed_expansion", "positive", "signal"),

  VL_001: defineCode("VL_001", "volume_near_average", "neutral", "reason"),
  VL_101: defineCode("VL_101", "volume_below_preferred_range", "warning", "quality"),
  VL_104: defineCode("VL_104", "weak_volume", "warning", "quality"),
  VL_201: defineCode("VL_201", "quiet_volume_compression", "info", "reason"),
  VL_202: defineCode("VL_202", "inconsistent_trading_activity", "warning", "quality"),
  VL_301: defineCode("VL_301", "elevated_liquidity_risk", "risk", "risk"),
  VL_302: defineCode("VL_302", "volume_spike_above_ma20", "warning", "risk"),
  VL_303: defineCode("VL_303", "bearish_volume_expansion", "risk", "reason"),
  VL_304: defineCode("VL_304", "liquidity_spike_risk", "risk", "risk"),
  VL_401: defineCode("VL_401", "excluded_by_liquidity", "block", "quality"),
  VL_501: defineCode("VL_501", "volume_expansion", "positive", "reason"),
  VL_601: defineCode("VL_601", "volume_supports_upside", "positive", "reason"),
  VL_602: defineCode("VL_602", "pullback_volume_stable", "positive", "reason"),

  RK_101: defineCode("RK_101", "minor_caution", "warning", "risk"),
  RK_201: defineCode("RK_201", "detected_risks", "warning", "risk"),
  RK_202: defineCode("RK_202", "asymmetric_risk", "warning", "risk"),
  RK_301: defineCode("RK_301", "elevated_risk", "warning", "risk"),
  RK_302: defineCode("RK_302", "poor_reward_risk_profile", "risk", "risk"),
  RK_303: defineCode("RK_303", "chase_risk", "risk", "risk"),
  RK_304: defineCode("RK_304", "false_breakout_risk", "risk", "risk"),
  RK_305: defineCode("RK_305", "failed_breakout_risk", "risk", "risk"),
  RK_306: defineCode("RK_306", "risk_rises_confirmation_falls", "risk", "reason"),
  RK_401: defineCode("RK_401", "hard_risk_exclusion", "block", "risk"),

  ST_001: defineCode("ST_001", "neutral_setup", "neutral", "setup"),
  ST_201: defineCode("ST_201", "base_building", "info", "setup"),
  ST_202: defineCode("ST_202", "short_term_retest", "info", "setup"),
  ST_301: defineCode("ST_301", "overextended", "warning", "setup"),
  ST_302: defineCode("ST_302", "distribution", "risk", "setup"),
  ST_501: defineCode("ST_501", "healthy_pullback", "positive", "setup"),
  ST_502: defineCode("ST_502", "trend_continuation", "positive", "setup"),
  ST_503: defineCode("ST_503", "trend_repair_setup", "positive", "setup"),

  QH_001: defineCode("QH_001", "normal_quality", "neutral", "quality"),
  QH_101: defineCode("QH_101", "low_quality", "warning", "quality"),
  QH_102: defineCode("QH_102", "rsi_insufficient", "info", "reason"),
  QH_103: defineCode("QH_103", "bb_percent_insufficient", "info", "reason"),
  QH_201: defineCode("QH_201", "insufficient_history", "block", "quality"),
  QH_202: defineCode("QH_202", "new_listing", "warning", "quality"),
  QH_301: defineCode("QH_301", "unreliable_historical_sample", "risk", "quality"),
  QH_401: defineCode("QH_401", "excluded_by_insufficient_history", "block", "quality"),
  QH_402: defineCode("QH_402", "excluded_by_poor_data_quality", "block", "quality"),
  QH_501: defineCode("QH_501", "major_quality", "positive", "quality"),
  QH_601: defineCode("QH_601", "core_quality", "positive", "quality"),

  NX_001: defineCode("NX_001", "no_clear_edge", "neutral", "action"),
  NX_101: defineCode("NX_101", "mixed_research_context", "neutral", "reason"),
  NX_201: defineCode("NX_201", "caution", "warning", "action"),
  NX_302: defineCode("NX_302", "execution_noise", "warning", "reason"),
  NX_801: defineCode("NX_801", "unknown_code", "neutral", "system"),
} as const satisfies Record<string, ScannerCodeMetadata>;

export type ActiveScannerCode = keyof typeof scannerCodeRegistry & ScannerCode;

export const activeScannerCodes = Object.keys(
  scannerCodeRegistry,
) as ActiveScannerCode[];

export function isScannerCode(value: unknown): value is ActiveScannerCode {
  if (typeof value !== "string") {
    return false;
  }

  return value in scannerCodeRegistry;
}

export function looksLikeScannerCode(value: unknown): value is ScannerCode {
  if (typeof value !== "string") {
    return false;
  }

  const [domain, numberPart, extra] = value.split("_");
  return (
    extra === undefined &&
    isScannerCodeDomain(domain) &&
    /^\d{3}$/.test(numberPart)
  );
}

export const groupCodeByResultGroup = {
  high_priority: "GR_601",
  eligible: "GR_501",
  watch: "GR_101",
  overheated: "GR_302",
  risk: "GR_301",
  neutral: "GR_001",
  low_quality: "GR_402",
  insufficient_history: "GR_401",
} as const satisfies Record<ScannerResultGroupCodeKey, ActiveScannerCode>;

export const resultGroupByGroupCode = invertCodeMap(groupCodeByResultGroup);

export const actionCodeByBias = {
  eligible: "AC_501",
  watch_only: "AC_101",
  do_not_chase: "AC_301",
  avoid: "AC_302",
  ignore: "AC_001",
} as const satisfies Record<ActionBias, ActiveScannerCode>;

export const actionBiasByCode = invertCodeMap(actionCodeByBias);

export const signalCodeByLabel = {
  confirmed: "PX_501",
  watch: "MO_202",
  trend: "TR_601",
  overheated: "RK_301",
  distribution_risk: "RK_302",
  weak_bounce: "RK_303",
  breakdown_risk: "RK_304",
  weak: "MO_101",
  neutral: "MO_001",
} as const satisfies Record<ScannerSignalLabel, ActiveScannerCode>;

export const signalLabelByCode = invertCodeMap(signalCodeByLabel);

export const setupCodeByPrimaryStructure = {
  strong_trend: "TR_601",
  healthy_pullback: "ST_501",
  trend_repair: "ST_503",
  breakout_attempt: "PX_201",
  overextended: "ST_301",
  distribution_risk: "ST_302",
  weak_bounce: "PX_101",
  trend_breakdown: "PX_303",
  neutral: "ST_001",
} as const satisfies Record<PrimaryStructure, ActiveScannerCode>;

export const primaryStructureBySetupCode = invertCodeMap(
  setupCodeByPrimaryStructure,
);

export const setupCodeByDisplayAlias = {
  breakout_confirmed: "PX_501",
  trend_continuation: "ST_502",
  squeeze_breakout: "PX_604",
  extended_breakout: "PX_501",
  base_building: "ST_201",
  breakdown: "PX_303",
  distribution: "ST_302",
  pullback_retest: "PX_502",
  range_reclaim: "PX_503",
  failed_breakout: "PX_305",
  short_term_retest: "ST_202",
  daily_trend: "TR_202",
  long_term_repair: "TR_504",
  unknown: "NX_801",
} as const satisfies Record<string, ActiveScannerCode>;

export const riskCodeByType = {
  overheat_risk: "RK_303",
  distribution_risk: "RK_302",
  weak_bounce_risk: "RK_301",
  trend_breakdown_risk: "RK_302",
  liquidity_spike_risk: "VL_304",
  failed_breakout_risk: "RK_305",
} as const satisfies Record<DetectedRiskType, ActiveScannerCode>;

export const riskTypeByCode = invertCodeMap(riskCodeByType);

export const setupCodeByAliasOrStructure = {
  ...setupCodeByPrimaryStructure,
  ...setupCodeByDisplayAlias,
} as const satisfies Record<string, ActiveScannerCode>;

export const reviewCodeByKey = {
  "review.status.manualReview": "AC_501",
  "review.status.avoid": "AC_302",
  "review.status.doNotChase": "AC_301",
  "review.status.noClearEdge": "NX_001",
  "review.status.notEnoughCandles": "QH_201",
  "review.status.caution": "NX_201",
  "review.status.lowPriority": "AC_101",
  "review.status.needsConfirmation": "AC_201",
  "review.reason.cleanCandidate": "GR_501",
  "review.reason.riskGroupPriority": "GR_301",
  "review.reason.overheatedPriority": "GR_302",
  "review.reason.neutralGroup": "GR_001",
  "review.reason.insufficientHistory": "QH_201",
  "review.reason.detectedRisks": "RK_201",
  "review.reason.rankBelowZero": "NX_302",
  "review.reason.neutralSetup": "ST_001",
  "review.reason.needsConfirmation": "AC_201",
} as const satisfies Record<ScannerReviewKey, ActiveScannerCode>;

export const observationCodeByKey = {
  "factor.priceAboveMa20": "TR_501",
  "factor.priceAboveMa50": "TR_502",
  "factor.priceAboveMa200": "TR_503",
  "factor.ma20AboveMa50": "TR_605",
  "factor.ma50AboveMa200": "TR_602",
  "factor.rsiHealthyRepair": "MO_501",
  "factor.macdImproving": "MO_502",
  "factor.macdStrong": "MO_601",
  "factor.strongClose": "PX_601",
  "factor.volumeSupportsUpside": "VL_601",
  "factor.priceBelowMa20": "TR_201",
  "factor.priceBelowMa50": "TR_301",
  "factor.priceBelowMa200": "TR_302",
  "factor.ma20BelowMa50": "TR_303",
  "factor.rsiWeak": "MO_301",
  "factor.macdWeakening": "MO_302",
  "factor.macdWeak": "MO_303",
  "risk.overheat": "RK_301",
  "risk.distribution": "RK_302",
  "risk.weakBounce": "RK_303",
  "risk.trendBreakdown": "RK_304",
  "risk.liquiditySpike": "VL_304",
  "risk.failedBreakout": "RK_305",
  "risk.longUpperWick": "PX_301",
  "risk.weakClose": "PX_302",
  "risk.volumeSpikeAboveMa20": "VL_302",
  "neutral.macdFlat": "MO_001",
  "neutral.volumeNearAverage": "VL_001",
  "neutral.rsiInsufficient": "QH_102",
  "neutral.bbPercentInsufficient": "QH_103",
  "confirmation.reclaimMa50": "TR_603",
  "confirmation.ma20ApproachOrCrossMa50": "TR_604",
  "confirmation.rsiRecoverAbove50": "MO_603",
  "confirmation.holdBreakoutLevel": "PX_602",
  "confirmation.closeAbovePriorHigh": "PX_603",
  "confirmation.pullbackVolumeStable": "VL_602",
  "invalidation.loseMa20Repair": "TR_304",
  "invalidation.bearishVolumeExpansion": "VL_303",
  "invalidation.failToReclaimMa50": "TR_305",
  "invalidation.macdWeakensFurther": "MO_304",
  "invalidation.loseBreakoutLevel": "PX_304",
  "invalidation.riskRisesConfirmationFalls": "RK_306",
} as const satisfies Record<ScannerObservationKey, ActiveScannerCode>;

export const explanationCodeByKey = {
  "reason.bbWidthLow": "VO_202",
  "reason.ma20Ma50Converging": "TR_604",
  "reason.priceNearBollingerMiddle": "PX_502",
  "reason.quietVolumeCompression": "VL_201",
  "reason.volumeDryUpCompression": "VL_201",
  "reason.volumeExpansion": "VL_501",
  "reason.breakoutVolumeConfirmed": "VL_601",
  "reason.pullbackVolumeHealthy": "VL_602",
  "reason.priceAboveUpperBollinger": "PX_603",
  "reason.volumeExpanding": "VL_501",
  "reason.ma20AboveMa50": "TR_605",
  "reason.priceAboveMa200": "TR_503",
  "reason.macdHistogramRising": "MO_502",
  "reason.macdBullishCross": "MO_601",
  "reason.macdAboveZero": "MO_601",
  "reason.phaseClassification": "TR_001",
  "reason.limitedHistory": "QH_201",
  "confirmation.closeAboveUpperBollinger": "PX_603",
  "confirmation.volumeAbove1_5": "VL_601",
  "confirmation.breakoutVolume": "VL_601",
  "confirmation.rsiBelow72": "MO_501",
  "confirmation.priceAboveMa50": "TR_502",
  "confirmation.pullbackHoldMa20OrMiddle": "PX_602",
  "confirmation.consolidateNearMa20": "PX_502",
  "confirmation.rsiCoolBelow72": "MO_501",
  "confirmation.recoverMa50": "TR_603",
  "confirmation.declineVolumeStabilize": "VL_602",
  "confirmation.ma20TurnAboveMa50": "TR_604",
  "invalidation.loseBollingerMiddleWithVolume": "PX_304",
  "invalidation.closeBelowMa50": "TR_301",
  "invalidation.pullbackBelowMa50": "TR_301",
  "invalidation.extensionBelowMa20": "TR_304",
  "invalidation.weakUntilRecoverMa50": "TR_305",
  "invalidation.closeBelowMa200": "TR_302",
  "warning.rsiAbove75": "RK_301",
  "warning.possibleFakeBreakout": "RK_305",
  "warning.breakoutWithoutVolume": "VL_104",
  "warning.abnormalVolumeSpike": "VL_304",
  "warning.distributionVolume": "RK_302",
  "warning.highVolumeBreakdown": "RK_304",
  "warning.volumeSpikeWithExtension": "RK_301",
  "warning.extendedFromMa20": "RK_301",
  "warning.belowMa50": "TR_301",
  "warning.belowMa200": "TR_302",
  "warning.rsiBelow45": "MO_301",
  "warning.longUpperWick": "PX_301",
  "warning.weakCompressionBelowTrend": "TR_303",
  "warning.macdBearishCross": "MO_302",
  "warning.macdMomentumWeakening": "MO_302",
  "warning.insufficientHistory": "QH_201",
  "backtest.warning.noSamples": "QH_201",
  "backtest.warning.smallSample": "QH_101",
  "backtest.warning.insufficientHistory": "QH_201",
  "backtest.warning.falseBreakoutHigh": "RK_305",
  "backtest.warning.volatileAfterSignal": "NX_302",
  "backtest.warning.researchOnly": "NX_101",
  "backtest.note.researchOnly": "NX_101",
  "backtest.note.noDatabase": "NX_801",
} as const satisfies Record<ScannerExplanationKey, ActiveScannerCode>;

export const phaseCodeByMarketPhase = {
  BASE_BUILDING: "ST_201",
  SQUEEZE: "VO_501",
  BREAKOUT_ATTEMPT: "PX_201",
  BREAKOUT_CONFIRMED: "PX_501",
  TRENDING: "TR_601",
  PULLBACK_HEALTHY: "ST_501",
  OVEREXTENDED: "ST_301",
  DISTRIBUTION: "ST_302",
  BREAKDOWN: "PX_303",
} as const satisfies Record<MarketPhase, ActiveScannerCode>;

export function getScannerCodeMetadata(code: ScannerCode) {
  return scannerCodeRegistry[code as ActiveScannerCode] ?? null;
}

function defineCode(
  code: ScannerCode,
  internalName: string,
  severity: ScannerCodeMetadata["severity"],
  category: ScannerCodeMetadata["category"],
): ScannerCodeMetadata {
  return {
    code,
    domain: code.split("_")[0] as ScannerCodeMetadata["domain"],
    severity,
    internalName,
    status: "active",
    category,
  };
}

function invertCodeMap<T extends Record<string, ActiveScannerCode>>(map: T) {
  return Object.fromEntries(
    Object.entries(map).map(([key, code]) => [code, key]),
  ) as {
    [K in keyof T as T[K]]: K;
  };
}
