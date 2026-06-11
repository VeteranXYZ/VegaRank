import {
  scannerCodeRegistry,
  type ActiveScannerCode,
} from "@/lib/scanner-codebook/codeRegistry";
import type { ScannerCodeDictionary } from "@/lib/scanner-codebook/codeTypes";

export const generatedEnglishBaselineScannerCodeEntries = Object.fromEntries(
  Object.values(scannerCodeRegistry).map((metadata) => [
    metadata.code,
    {
      label: toTitleCase(metadata.internalName),
      short: "Scanner condition code.",
    },
  ]),
) as Record<ActiveScannerCode, { label: string; short: string }>;

export const manualEnglishScannerCodeEntries = {
  GR_001: {
    label: "Neutral",
    short: "No clear research priority is present.",
  },
  GR_101: {
    label: "Watch",
    short: "Some evidence is visible, but the row is better suited for monitoring.",
  },
  GR_201: {
    label: "Constructive Watch",
    short: "Constructive evidence is developing, but confirmation remains limited.",
  },
  GR_301: {
    label: "Risk",
    short: "Risk constraints are elevated enough to reduce research priority.",
  },
  GR_302: {
    label: "Overheated",
    short: "Momentum or price extension is elevated enough to increase chase risk.",
  },
  GR_401: {
    label: "Insufficient History",
    short: "Evidence reliability is constrained by limited history.",
  },
  GR_402: {
    label: "Low Quality Excluded",
    short: "Data, quality, or liquidity constraints are too severe for priority research.",
  },
  GR_501: {
    label: "Eligible",
    short: "Constructive evidence and acceptable risk keep the row research eligible.",
  },
  GR_601: {
    label: "High Priority",
    short: "Stronger setup quality and evidence reliability support high-priority review.",
  },

  AC_001: {
    label: "Low Priority",
    short: "The row does not warrant research priority in the current scanner read.",
  },
  AC_101: {
    label: "Watch",
    short: "Keep the row visible for review without treating it as urgent.",
  },
  AC_102: {
    label: "Wait",
    short: "Wait for cleaner confirmation before raising research priority.",
  },
  AC_103: {
    label: "Monitor Only",
    short: "Track the row as background context without raising priority.",
  },
  AC_201: {
    label: "Manual Review",
    short: "Review the scanner evidence manually because context is mixed.",
  },
  AC_301: {
    label: "Avoid Chasing",
    short: "Late reaction may carry poor reward-risk, so priority should be reduced.",
  },
  AC_302: {
    label: "Reduce Priority",
    short: "Risk or confidence constraints reduce the row's research priority.",
  },
  AC_401: {
    label: "Exclude",
    short: "Exclude from priority research due to severe evidence constraints.",
  },
  AC_501: {
    label: "Research Watch",
    short: "Keep the row in the active research queue for manual review.",
  },
  AC_601: {
    label: "High-Priority Review",
    short: "Review this row first because evidence quality and risk context are stronger.",
  },

  MO_001: {
    label: "Neutral Momentum",
    short: "Momentum evidence is balanced or not meaningful enough to change priority.",
  },
  MO_101: {
    label: "Weak Momentum",
    short: "Momentum evidence is weak and reduces confidence in follow-through.",
  },
  MO_201: {
    label: "Improving Momentum",
    short: "Momentum is improving, but the row still needs context from other factors.",
  },
  MO_202: {
    label: "Watch Momentum",
    short: "Momentum supports monitoring, while confirmation remains incomplete.",
  },
  MO_340: {
    label: "Overheated Momentum",
    short: "Momentum is elevated enough to increase chase risk.",
  },
  MO_301: {
    label: "Weak RSI Context",
    short: "RSI context is weak and reduces momentum confidence.",
  },
  MO_302: {
    label: "MACD Weakening",
    short: "MACD context is weakening and follow-through is less reliable.",
  },
  MO_303: {
    label: "Weak MACD Context",
    short: "MACD evidence is weak enough to weigh on the scanner read.",
  },
  MO_304: {
    label: "MACD Deterioration",
    short: "MACD evidence is weakening further and adds caution.",
  },
  MO_501: {
    label: "RSI Repair",
    short: "RSI context is repairing and supports a more constructive review.",
  },
  MO_502: {
    label: "MACD Improving",
    short: "MACD evidence is improving and supports constructive momentum context.",
  },
  MO_601: {
    label: "Strong MACD Context",
    short: "MACD evidence is strong enough to support momentum confirmation.",
  },
  MO_603: {
    label: "RSI Recovery",
    short: "RSI context is recovering and improves momentum reliability.",
  },

  TR_001: {
    label: "Trend Context",
    short: "Trend metadata is available as supporting research context.",
  },
  TR_101: {
    label: "Trend Repair",
    short: "Trend quality is repairing but still needs cleaner confirmation.",
  },
  TR_201: {
    label: "Below Near Trend",
    short: "Price is below a nearby trend reference and trend quality is constrained.",
  },
  TR_202: {
    label: "Daily Trend",
    short: "Higher-timeframe trend context is constructive.",
  },
  TR_301: {
    label: "Below Intermediate Trend",
    short: "Price is below an intermediate trend reference and confirmation is weaker.",
  },
  TR_302: {
    label: "Below Major Trend",
    short: "Price is below a major trend reference and evidence reliability is weaker.",
  },
  TR_303: {
    label: "Trend Alignment Weak",
    short: "Moving-average alignment is weak and reduces trend consistency.",
  },
  TR_304: {
    label: "Repair Lost",
    short: "A prior trend repair attempt is losing structure.",
  },
  TR_305: {
    label: "Reclaim Failed",
    short: "Price has not reclaimed a key trend reference, limiting confidence.",
  },
  TR_501: {
    label: "Above Near Trend",
    short: "Price is above a nearby trend reference, supporting trend quality.",
  },
  TR_502: {
    label: "Above Intermediate Trend",
    short: "Price is above an intermediate trend reference, improving trend context.",
  },
  TR_503: {
    label: "Above Major Trend",
    short: "Price is above a major trend reference, supporting broader structure.",
  },
  TR_504: {
    label: "Primary Trend Repair",
    short: "Broader trend structure is repairing after prior weakness.",
  },
  TR_601: {
    label: "Strong Trend",
    short: "Trend quality is strong and supports higher research priority when risk is acceptable.",
  },
  TR_602: {
    label: "Major Alignment",
    short: "Major trend alignment is constructive and improves evidence reliability.",
  },
  TR_603: {
    label: "Trend Reclaim",
    short: "Price is reclaiming an important trend reference.",
  },
  TR_604: {
    label: "Alignment Repair",
    short: "Trend alignment is improving and may support follow-through.",
  },
  TR_605: {
    label: "Near Alignment",
    short: "Nearby trend alignment is constructive.",
  },

  PX_001: {
    label: "Neutral Structure",
    short: "Price structure is neutral and does not change research priority.",
  },
  PX_101: {
    label: "Weak Bounce",
    short: "Bounce quality is weak and needs cleaner confirmation.",
  },
  PX_201: {
    label: "Breakout Attempt",
    short: "Price is attempting to improve structure, but confirmation is incomplete.",
  },
  PX_301: {
    label: "Upper-Wick Risk",
    short: "The candle structure shows rejection risk and weaker follow-through quality.",
  },
  PX_302: {
    label: "Weak Close",
    short: "The close is weak enough to reduce structure confidence.",
  },
  PX_303: {
    label: "Breakdown Risk",
    short: "Price structure has weakened enough to reduce research priority.",
  },
  PX_304: {
    label: "Breakout Level Lost",
    short: "A prior structure level has been lost, weakening the setup.",
  },
  PX_305: {
    label: "Failed Breakout",
    short: "A breakout attempt has failed or is vulnerable to failure.",
  },
  PX_501: {
    label: "Breakout Confirmed",
    short: "Structure confirmation is stronger, subject to risk and liquidity context.",
  },
  PX_502: {
    label: "Pullback Retest",
    short: "Price is retesting a prior structure area in a constructive way.",
  },
  PX_503: {
    label: "Range Reclaim",
    short: "Price is reclaiming a prior range and improving structure quality.",
  },
  PX_601: {
    label: "Strong Close",
    short: "The close supports stronger price-structure confirmation.",
  },
  PX_602: {
    label: "Breakout Level Held",
    short: "Price is holding a prior breakout area, improving structure reliability.",
  },
  PX_603: {
    label: "Prior High Cleared",
    short: "Price has cleared a prior high, supporting structure confirmation.",
  },
  PX_604: {
    label: "Squeeze Breakout",
    short: "Compression is resolving into a stronger structure setup.",
  },

  VO_001: {
    label: "Normal Volatility",
    short: "Volatility context is normal and does not dominate the scanner read.",
  },
  VO_101: {
    label: "Low Volatility",
    short: "Volatility is quiet and may need additional context before priority rises.",
  },
  VO_102: {
    label: "Normal Volatility",
    short: "Volatility remains within a normal research range.",
  },
  VO_202: {
    label: "Compression",
    short: "Volatility is compressed and may indicate a developing setup with supporting context.",
  },
  VO_301: {
    label: "Expansion Risk",
    short: "Volatility expansion increases risk and should be reviewed cautiously.",
  },
  VO_302: {
    label: "Unstable Volatility",
    short: "Volatility is unstable enough to reduce confidence in the setup.",
  },
  VO_501: {
    label: "Squeeze Setup",
    short: "Constructive compression is present when trend and structure also support it.",
  },
  VO_601: {
    label: "Confirmed Expansion",
    short: "Volatility expansion has stronger confirmation and should be reviewed in context.",
  },

  VL_001: {
    label: "Average Participation",
    short: "Trading activity is near average and does not dominate the scanner read.",
  },
  VL_101: {
    label: "Below Preferred Activity",
    short: "Trading activity is below the preferred research range.",
  },
  VL_104: {
    label: "Weak Participation",
    short: "Volume or liquidity context is weak and reduces confidence.",
  },
  VL_201: {
    label: "Quiet Participation",
    short: "Trading activity is quiet, which may support compression context when other evidence aligns.",
  },
  VL_202: {
    label: "Inconsistent Activity",
    short: "Trading activity is inconsistent and reduces evidence reliability.",
  },
  VL_301: {
    label: "Elevated Liquidity Risk",
    short: "Liquidity reliability is weak enough to reduce research priority.",
  },
  VL_302: {
    label: "Volume Spike Risk",
    short: "A volume spike increases noise risk and should be reviewed cautiously.",
  },
  VL_303: {
    label: "Distribution Volume",
    short: "Volume behavior adds downside structure risk.",
  },
  VL_304: {
    label: "Liquidity Spike Risk",
    short: "Liquidity conditions are abnormal enough to reduce confidence.",
  },
  VL_401: {
    label: "Liquidity Excluded",
    short: "Liquidity constraints are too severe for priority research.",
  },
  VL_501: {
    label: "Volume Expansion",
    short: "Participation is expanding and may support confirmation when structure is constructive.",
  },
  VL_601: {
    label: "Volume Supports Structure",
    short: "Participation supports the constructive scanner read.",
  },
  VL_602: {
    label: "Stable Pullback Volume",
    short: "Pullback participation is stable enough to support structure quality.",
  },

  RK_101: {
    label: "Minor Caution",
    short: "A mild risk constraint is present and should be considered in review.",
  },
  RK_201: {
    label: "Detected Risks",
    short: "One or more risk constraints are present in the scanner read.",
  },
  RK_202: {
    label: "Asymmetric Risk",
    short: "Risk is not balanced enough for higher priority without stronger evidence.",
  },
  RK_301: {
    label: "Elevated Risk",
    short: "Risk constraints are elevated and reduce confidence.",
  },
  RK_302: {
    label: "Poor Reward-Risk",
    short: "Setup quality is outweighed by risk constraints.",
  },
  RK_303: {
    label: "Chase Risk",
    short: "Price or momentum is extended enough to make late reaction unattractive.",
  },
  RK_304: {
    label: "False Breakout Risk",
    short: "Breakout or reclaim evidence is vulnerable to failure.",
  },
  RK_305: {
    label: "Failed Breakout Risk",
    short: "Breakout failure risk is elevated and reduces research priority.",
  },
  RK_306: {
    label: "Confirmation Falling",
    short: "Risk is rising while confirmation is weakening.",
  },
  RK_401: {
    label: "Hard Risk Exclusion",
    short: "Risk constraints are severe enough to exclude the row from priority research.",
  },

  ST_001: {
    label: "Neutral Setup",
    short: "No specific setup structure is active.",
  },
  ST_201: {
    label: "Base Building",
    short: "Price is building a base rather than showing clear directional structure.",
  },
  ST_202: {
    label: "Near-Term Retest",
    short: "Near-term structure is retesting a prior reference area.",
  },
  ST_301: {
    label: "Overextended",
    short: "Price is extended from its base, increasing chase risk.",
  },
  ST_302: {
    label: "Distribution",
    short: "Structure shows distribution risk and weaker follow-through quality.",
  },
  ST_501: {
    label: "Healthy Pullback",
    short: "Pullback structure remains constructive by scanner criteria.",
  },
  ST_502: {
    label: "Trend Continuation",
    short: "Trend continuation structure remains constructive.",
  },
  ST_503: {
    label: "Trend Repair",
    short: "Trend structure is repairing after weakness.",
  },

  QH_001: {
    label: "Normal Quality",
    short: "Data quality is sufficient for normal scanner display.",
  },
  QH_101: {
    label: "Low Quality",
    short: "Evidence quality is below the preferred research standard.",
  },
  QH_102: {
    label: "RSI Unavailable",
    short: "RSI evidence is unavailable, limiting momentum confidence.",
  },
  QH_103: {
    label: "Bollinger Context Unavailable",
    short: "Bollinger context is unavailable, limiting volatility confidence.",
  },
  QH_201: {
    label: "Insufficient History",
    short: "History depth is too limited for a reliable normal scanner read.",
  },
  QH_202: {
    label: "New Listing",
    short: "Listing history is limited and reduces evidence reliability.",
  },
  QH_301: {
    label: "Unreliable Historical Sample",
    short: "Historical evidence is not reliable enough for higher confidence.",
  },
  QH_401: {
    label: "History Excluded",
    short: "History depth is too limited for priority research.",
  },
  QH_402: {
    label: "Data Quality Excluded",
    short: "Data quality constraints are too severe for a reliable scanner read.",
  },
  QH_501: {
    label: "Major Quality",
    short: "The symbol has stronger market quality for scanner research.",
  },
  QH_601: {
    label: "Core Quality",
    short: "The symbol has core-market quality and stronger evidence reliability.",
  },

  NX_001: {
    label: "No Clear Priority",
    short: "The scanner does not show enough evidence for a stronger research bucket.",
  },
  NX_101: {
    label: "Mixed Research Context",
    short: "Signals are mixed and should be treated as supporting context only.",
  },
  NX_201: {
    label: "Caution",
    short: "The scanner read needs more confirmation before priority rises.",
  },
  NX_302: {
    label: "Execution Noise",
    short: "The setup may be vulnerable to noisy execution conditions.",
  },
  NX_801: {
    label: "Unknown Code",
    short: "No explanation is available for this scanner code yet.",
  },
} satisfies ScannerCodeDictionary;

export const enScannerCodeDictionary = {
  ...generatedEnglishBaselineScannerCodeEntries,
  ...manualEnglishScannerCodeEntries,
} satisfies ScannerCodeDictionary;

function toTitleCase(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}
