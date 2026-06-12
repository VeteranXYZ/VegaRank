export const MIN_COMPLETE_WINDOWS_FOR_INTERPRETATION = 20;
export const MIN_TOTAL_ROWS_FOR_BUCKET = 10;

const FOLLOW_THROUGH_WEAK_DELTA_PCT = 0.75;
const FOLLOW_THROUGH_CLEAR_DELTA_PCT = 2;
const DRAWDOWN_WEAK_DELTA_PCT = 1;
const DRAWDOWN_CLEAR_DELTA_PCT = 2;
const COMPLETENESS_WEAK_DELTA_PCT = 5;
const COMPLETENESS_CLEAR_DELTA_PCT = 10;
const STABILITY_WEAK_DELTA_PCT = 1;
const STABILITY_CLEAR_DELTA_PCT = 2;

export type RankingQualityDataStatus = "complete" | "partial" | "missing";

export type RankingQualityInputRow = {
  symbol?: string | null;
  timeframe?: string | null;
  group?: string | null;
  rankScore?: number | null;
  riskAdjustedScore?: number | null;
  confidenceScore?: number | null;
  riskCodes?: string[] | null;
  riskTypes?: string[] | null;
  hasRiskContext?: boolean | null;
  observedChangePct?: number | null;
  maxDrawdownPct?: number | null;
  dataStatus: RankingQualityDataStatus;
};

export type RankingQualityInterpretationLabel =
  | "Clear Separation"
  | "Weak Separation"
  | "No Clear Separation"
  | "Contradictory Context"
  | "Limited Sample"
  | "Data Not Mature";

export type RankingQualitySampleWarning =
  | "Limited Sample"
  | "Data Not Mature"
  | null;

export type RankingQualityMetricSummary = {
  label: string;
  code: string;
  rowCount: number;
  completeCount: number;
  partialCount: number;
  missingCount: number;
  completeRatePct: number;
  missingOrPartialRatePct: number;
  medianFollowThroughPct: number | null;
  averageFollowThroughPct: number | null;
  positiveFollowThroughPct: number | null;
  followThroughIqrPct: number | null;
  medianDrawdownPct: number | null;
  worstDrawdownPct: number | null;
  averageRankScore: number | null;
  averageRiskAdjustedScore: number | null;
  averageConfidenceScore: number | null;
  interpretationLabel: RankingQualityInterpretationLabel;
  sampleWarning: RankingQualitySampleWarning;
};

export type RankingQualitySeparationDiagnostic = {
  label: string;
  code: string;
  comparison:
    | "top_score_bucket_vs_bottom_score_bucket"
    | "high_priority_vs_watch_neutral"
    | "risk_context_vs_no_risk_context"
    | "high_confidence_vs_low_confidence";
  leftCode: string | null;
  rightCode: string | null;
  leftRowCount: number;
  rightRowCount: number;
  leftCompleteCount: number;
  rightCompleteCount: number;
  metricDeltas: {
    medianFollowThroughPct: number | null;
    medianDrawdownPct: number | null;
    completeRatePct: number | null;
    followThroughIqrPct: number | null;
  };
  interpretationLabel: RankingQualityInterpretationLabel;
  sampleWarning: RankingQualitySampleWarning;
  notes: string[];
};

export type RankingQualityContradictionDiagnostic = {
  label: string;
  code: string;
  relatedDiagnosticCode: string;
  interpretationLabel: "Contradictory Context" | "No Clear Separation";
  needsCalibrationReview: boolean;
  followUpNote:
    | "calibration candidate"
    | "needs more data"
    | "needs timeframe split"
    | "needs risk penalty review";
};

export type RankingQualityNotice = {
  label: string;
  code: string;
  rowCount: number;
  completeCount: number;
  partialCount: number;
  missingCount: number;
  interpretationLabel: RankingQualityInterpretationLabel;
  sampleWarning: RankingQualitySampleWarning;
};

export type RankingQualityEvaluation = {
  summary: RankingQualityMetricSummary;
  scoreBuckets: RankingQualityMetricSummary[];
  groupSummaries: RankingQualityMetricSummary[];
  riskContextSummaries: RankingQualityMetricSummary[];
  confidenceBuckets: RankingQualityMetricSummary[];
  timeframeSummaries: RankingQualityMetricSummary[];
  separationDiagnostics: RankingQualitySeparationDiagnostic[];
  contradictionDiagnostics: RankingQualityContradictionDiagnostic[];
  warnings: RankingQualityNotice[];
  followUpNotes: RankingQualityNotice[];
};

type GroupedRows = {
  code: string;
  label: string;
  rows: RankingQualityInputRow[];
};

export function evaluateRankingQuality(
  rows: RankingQualityInputRow[],
): RankingQualityEvaluation {
  const safeRows = rows.filter((row) => isKnownStatus(row.dataStatus));
  const summary = buildMetricSummary("summary", "All Rows", safeRows);
  const scoreBuckets = buildScoreBuckets(safeRows);
  const groupSummaries = buildGroupSummaries(safeRows);
  const riskContextSummaries = buildRiskContextSummaries(safeRows);
  const confidenceBuckets = buildConfidenceBuckets(safeRows);
  const timeframeSummaries = buildTimeframeSummaries(safeRows);
  const separationDiagnostics = buildSeparationDiagnostics({
    scoreBuckets,
    groupSummaries,
    riskContextSummaries,
    confidenceBuckets,
  });
  const contradictionDiagnostics = buildContradictionDiagnostics(
    separationDiagnostics,
  );
  const warnings = [
    summary,
    ...scoreBuckets,
    ...groupSummaries,
    ...riskContextSummaries,
    ...confidenceBuckets,
    ...timeframeSummaries,
  ]
    .filter((item) => item.sampleWarning !== null)
    .map(toNotice);
  const followUpNotes = contradictionDiagnostics.map((diagnostic) => ({
    label: diagnostic.followUpNote,
    code: diagnostic.code,
    rowCount: 0,
    completeCount: 0,
    partialCount: 0,
    missingCount: 0,
    interpretationLabel: diagnostic.interpretationLabel,
    sampleWarning: null,
  }));

  return {
    summary,
    scoreBuckets,
    groupSummaries,
    riskContextSummaries,
    confidenceBuckets,
    timeframeSummaries,
    separationDiagnostics,
    contradictionDiagnostics,
    warnings,
    followUpNotes,
  };
}

function buildScoreBuckets(rows: RankingQualityInputRow[]) {
  const groups: GroupedRows[] = [
    { code: "score_lt_0", label: "Rank Score < 0", rows: [] },
    { code: "score_0_20", label: "Rank Score 0-20", rows: [] },
    { code: "score_20_40", label: "Rank Score 20-40", rows: [] },
    { code: "score_40_60", label: "Rank Score 40-60", rows: [] },
    { code: "score_60_80", label: "Rank Score 60-80", rows: [] },
    { code: "score_80_100", label: "Rank Score 80-100", rows: [] },
    { code: "score_gte_100", label: "Rank Score >= 100", rows: [] },
    { code: "score_unknown", label: "Rank Score Unknown", rows: [] },
  ];
  const byCode = new Map(groups.map((group) => [group.code, group]));

  for (const row of rows) {
    byCode.get(scoreBucketCode(row.rankScore))?.rows.push(row);
  }

  return groups
    .filter((group) => group.rows.length > 0)
    .map((group) => buildMetricSummary(group.code, group.label, group.rows));
}

function buildGroupSummaries(rows: RankingQualityInputRow[]) {
  return groupedSummaries(rows, (row) => normalizeGroup(row.group), [
    { code: "high_priority", label: "High Priority" },
    { code: "watch", label: "Watch" },
    { code: "neutral", label: "Neutral" },
    { code: "risk", label: "Risk" },
    { code: "overheated", label: "Overheated" },
    { code: "insufficient_history", label: "Insufficient History" },
    { code: "other", label: "Other" },
    { code: "unknown", label: "Unknown" },
  ]);
}

function buildRiskContextSummaries(rows: RankingQualityInputRow[]) {
  return groupedSummaries(
    rows,
    (row) => (hasRiskContext(row) ? "risk_context" : "no_risk_context"),
    [
      { code: "risk_context", label: "Risk Context" },
      { code: "no_risk_context", label: "No Risk Context" },
    ],
  );
}

function buildConfidenceBuckets(rows: RankingQualityInputRow[]) {
  return groupedSummaries(rows, (row) => confidenceBucketCode(row.confidenceScore), [
    { code: "confidence_low", label: "Low Confidence" },
    { code: "confidence_mid", label: "Mid Confidence" },
    { code: "confidence_high", label: "High Confidence" },
    { code: "confidence_unknown", label: "Confidence Unknown" },
  ]);
}

function buildTimeframeSummaries(rows: RankingQualityInputRow[]) {
  const codes = Array.from(
    new Set(rows.map((row) => normalizeCode(row.timeframe, "unknown_timeframe"))),
  ).sort();

  return codes.map((code) =>
    buildMetricSummary(
      code,
      code === "unknown_timeframe" ? "Unknown Timeframe" : code.toUpperCase(),
      rows.filter((row) => normalizeCode(row.timeframe, "unknown_timeframe") === code),
    ),
  );
}

function buildSeparationDiagnostics({
  scoreBuckets,
  groupSummaries,
  riskContextSummaries,
  confidenceBuckets,
}: {
  scoreBuckets: RankingQualityMetricSummary[];
  groupSummaries: RankingQualityMetricSummary[];
  riskContextSummaries: RankingQualityMetricSummary[];
  confidenceBuckets: RankingQualityMetricSummary[];
}) {
  const scoreBucketsWithRank = scoreBuckets.filter(
    (bucket) => bucket.code !== "score_unknown",
  );
  const bottomScore = scoreBucketsWithRank[0] ?? null;
  const topScore = scoreBucketsWithRank.at(-1) ?? null;
  const highPriority = groupSummaries.find(
    (summary) => summary.code === "high_priority",
  );
  const watchNeutral = mergeSummaries("watch_neutral", "Watch / Neutral", [
    groupSummaries.find((summary) => summary.code === "watch"),
    groupSummaries.find((summary) => summary.code === "neutral"),
  ]);
  const riskContext = riskContextSummaries.find(
    (summary) => summary.code === "risk_context",
  );
  const noRiskContext = riskContextSummaries.find(
    (summary) => summary.code === "no_risk_context",
  );
  const highConfidence = confidenceBuckets.find(
    (summary) => summary.code === "confidence_high",
  );
  const lowConfidence = confidenceBuckets.find(
    (summary) => summary.code === "confidence_low",
  );

  return [
    compareFollowThrough({
      code: "top_score_vs_bottom_score",
      label: "Top Score Bucket vs Bottom Score Bucket",
      comparison: "top_score_bucket_vs_bottom_score_bucket",
      left: topScore,
      right: bottomScore,
    }),
    compareFollowThrough({
      code: "high_priority_vs_watch_neutral",
      label: "High Priority vs Watch / Neutral",
      comparison: "high_priority_vs_watch_neutral",
      left: highPriority,
      right: watchNeutral,
    }),
    compareRiskContext({
      code: "risk_context_vs_no_risk_context",
      label: "Risk Context vs No Risk Context",
      left: riskContext,
      right: noRiskContext,
    }),
    compareConfidence({
      code: "high_confidence_vs_low_confidence",
      label: "High Confidence vs Low Confidence",
      left: highConfidence,
      right: lowConfidence,
    }),
  ];
}

function compareFollowThrough({
  code,
  label,
  comparison,
  left,
  right,
}: {
  code: RankingQualitySeparationDiagnostic["code"];
  label: RankingQualitySeparationDiagnostic["label"];
  comparison: RankingQualitySeparationDiagnostic["comparison"];
  left?: RankingQualityMetricSummary | null;
  right?: RankingQualityMetricSummary | null;
}): RankingQualitySeparationDiagnostic {
  const base = buildDiagnosticBase({ code, label, comparison, left, right });
  const readiness = diagnosticReadiness(left, right);

  if (readiness) {
    return { ...base, interpretationLabel: readiness, sampleWarning: readiness };
  }

  const followThroughDelta = delta(
    left?.medianFollowThroughPct,
    right?.medianFollowThroughPct,
  );
  const drawdownDelta = delta(left?.medianDrawdownPct, right?.medianDrawdownPct);

  return {
    ...base,
    interpretationLabel: classifyFollowThroughSeparation({
      followThroughDelta,
      drawdownDelta,
    }),
    sampleWarning: null,
  };
}

function compareRiskContext({
  code,
  label,
  left,
  right,
}: {
  code: RankingQualitySeparationDiagnostic["code"];
  label: RankingQualitySeparationDiagnostic["label"];
  left?: RankingQualityMetricSummary | null;
  right?: RankingQualityMetricSummary | null;
}): RankingQualitySeparationDiagnostic {
  const base = buildDiagnosticBase({
    code,
    label,
    comparison: "risk_context_vs_no_risk_context",
    left,
    right,
  });
  const readiness = diagnosticReadiness(left, right);

  if (readiness) {
    return { ...base, interpretationLabel: readiness, sampleWarning: readiness };
  }

  const followThroughDelta = delta(
    left?.medianFollowThroughPct,
    right?.medianFollowThroughPct,
  );
  const drawdownDelta = delta(left?.medianDrawdownPct, right?.medianDrawdownPct);

  return {
    ...base,
    interpretationLabel: classifyRiskSeparation({
      followThroughDelta,
      drawdownDelta,
    }),
    sampleWarning: null,
  };
}

function compareConfidence({
  code,
  label,
  left,
  right,
}: {
  code: RankingQualitySeparationDiagnostic["code"];
  label: RankingQualitySeparationDiagnostic["label"];
  left?: RankingQualityMetricSummary | null;
  right?: RankingQualityMetricSummary | null;
}): RankingQualitySeparationDiagnostic {
  const base = buildDiagnosticBase({
    code,
    label,
    comparison: "high_confidence_vs_low_confidence",
    left,
    right,
  });
  const readiness = diagnosticReadiness(left, right);

  if (readiness) {
    return { ...base, interpretationLabel: readiness, sampleWarning: readiness };
  }

  const completeRateDelta = delta(left?.completeRatePct, right?.completeRatePct);
  const stabilityDelta = delta(
    left?.followThroughIqrPct,
    right?.followThroughIqrPct,
  );

  return {
    ...base,
    interpretationLabel: classifyConfidenceSeparation({
      completeRateDelta,
      stabilityDelta,
    }),
    sampleWarning: null,
  };
}

function buildDiagnosticBase({
  code,
  label,
  comparison,
  left,
  right,
}: {
  code: RankingQualitySeparationDiagnostic["code"];
  label: RankingQualitySeparationDiagnostic["label"];
  comparison: RankingQualitySeparationDiagnostic["comparison"];
  left?: RankingQualityMetricSummary | null;
  right?: RankingQualityMetricSummary | null;
}): RankingQualitySeparationDiagnostic {
  return {
    code,
    label,
    comparison,
    leftCode: left?.code ?? null,
    rightCode: right?.code ?? null,
    leftRowCount: left?.rowCount ?? 0,
    rightRowCount: right?.rowCount ?? 0,
    leftCompleteCount: left?.completeCount ?? 0,
    rightCompleteCount: right?.completeCount ?? 0,
    metricDeltas: {
      medianFollowThroughPct: delta(
        left?.medianFollowThroughPct,
        right?.medianFollowThroughPct,
      ),
      medianDrawdownPct: delta(left?.medianDrawdownPct, right?.medianDrawdownPct),
      completeRatePct: delta(left?.completeRatePct, right?.completeRatePct),
      followThroughIqrPct: delta(
        left?.followThroughIqrPct,
        right?.followThroughIqrPct,
      ),
    },
    interpretationLabel: "No Clear Separation",
    sampleWarning: null,
    notes: [],
  };
}

function buildContradictionDiagnostics(
  diagnostics: RankingQualitySeparationDiagnostic[],
) {
  return diagnostics.flatMap((diagnostic) => {
    if (
      diagnostic.interpretationLabel !== "Contradictory Context" &&
      diagnostic.interpretationLabel !== "No Clear Separation"
    ) {
      return [];
    }

    if (diagnostic.sampleWarning !== null) {
      return [];
    }

    return [
      {
        label:
          diagnostic.interpretationLabel === "Contradictory Context"
            ? "Contradictory Context"
            : "No Clear Separation",
        code: `${diagnostic.code}_review`,
        relatedDiagnosticCode: diagnostic.code,
        interpretationLabel: diagnostic.interpretationLabel,
        needsCalibrationReview:
          diagnostic.interpretationLabel === "Contradictory Context",
        followUpNote: followUpForDiagnostic(diagnostic),
      } satisfies RankingQualityContradictionDiagnostic,
    ];
  });
}

function followUpForDiagnostic(
  diagnostic: RankingQualitySeparationDiagnostic,
): RankingQualityContradictionDiagnostic["followUpNote"] {
  if (diagnostic.comparison === "risk_context_vs_no_risk_context") {
    return "needs risk penalty review";
  }

  if (diagnostic.comparison === "high_confidence_vs_low_confidence") {
    return "needs more data";
  }

  if (diagnostic.comparison === "top_score_bucket_vs_bottom_score_bucket") {
    return "calibration candidate";
  }

  return "needs timeframe split";
}

function buildMetricSummary(
  code: string,
  label: string,
  rows: RankingQualityInputRow[],
): RankingQualityMetricSummary {
  const completeRows = rows.filter((row) => row.dataStatus === "complete");
  const partialCount = rows.filter((row) => row.dataStatus === "partial").length;
  const missingCount = rows.filter((row) => row.dataStatus === "missing").length;
  const followThroughValues = completeRows.flatMap((row) =>
    finiteValues(row.observedChangePct),
  );
  const drawdownValues = completeRows.flatMap((row) =>
    finiteValues(row.maxDrawdownPct),
  );
  const rowCount = rows.length;
  const completeCount = completeRows.length;
  const sampleWarning = getSampleWarning({
    rowCount,
    completeCount,
    partialCount,
    missingCount,
  });

  return {
    code,
    label,
    rowCount,
    completeCount,
    partialCount,
    missingCount,
    completeRatePct: rowCount > 0 ? round((completeCount / rowCount) * 100) : 0,
    missingOrPartialRatePct:
      rowCount > 0 ? round(((partialCount + missingCount) / rowCount) * 100) : 0,
    medianFollowThroughPct: median(followThroughValues),
    averageFollowThroughPct: average(followThroughValues),
    positiveFollowThroughPct:
      followThroughValues.length > 0
        ? round(
            (followThroughValues.filter((value) => value > 0).length /
              followThroughValues.length) *
              100,
          )
        : null,
    followThroughIqrPct: interquartileRange(followThroughValues),
    medianDrawdownPct: median(drawdownValues),
    worstDrawdownPct:
      drawdownValues.length > 0 ? round(Math.min(...drawdownValues)) : null,
    averageRankScore: average(rows.flatMap((row) => finiteValues(row.rankScore))),
    averageRiskAdjustedScore: average(
      rows.flatMap((row) => finiteValues(row.riskAdjustedScore)),
    ),
    averageConfidenceScore: average(
      rows.flatMap((row) => finiteValues(row.confidenceScore)),
    ),
    interpretationLabel: sampleWarning ?? "No Clear Separation",
    sampleWarning,
  };
}

function groupedSummaries(
  rows: RankingQualityInputRow[],
  getCode: (row: RankingQualityInputRow) => string,
  definitions: Array<{ code: string; label: string }>,
) {
  return definitions.flatMap((definition) => {
    const groupRows = rows.filter((row) => getCode(row) === definition.code);
    return groupRows.length > 0
      ? [buildMetricSummary(definition.code, definition.label, groupRows)]
      : [];
  });
}

function mergeSummaries(
  code: string,
  label: string,
  summaries: Array<RankingQualityMetricSummary | undefined>,
): RankingQualityMetricSummary | null {
  const present = summaries.filter(
    (summary): summary is RankingQualityMetricSummary => Boolean(summary),
  );

  if (present.length === 0) {
    return null;
  }

  const rowCount = present.reduce((total, summary) => total + summary.rowCount, 0);
  const completeCount = present.reduce(
    (total, summary) => total + summary.completeCount,
    0,
  );
  const partialCount = present.reduce(
    (total, summary) => total + summary.partialCount,
    0,
  );
  const missingCount = present.reduce(
    (total, summary) => total + summary.missingCount,
    0,
  );
  const sampleWarning = getSampleWarning({
    rowCount,
    completeCount,
    partialCount,
    missingCount,
  });

  return {
    code,
    label,
    rowCount,
    completeCount,
    partialCount,
    missingCount,
    completeRatePct: rowCount > 0 ? round((completeCount / rowCount) * 100) : 0,
    missingOrPartialRatePct:
      rowCount > 0 ? round(((partialCount + missingCount) / rowCount) * 100) : 0,
    medianFollowThroughPct: weightedAverageMetric(
      present,
      "medianFollowThroughPct",
    ),
    averageFollowThroughPct: weightedAverageMetric(
      present,
      "averageFollowThroughPct",
    ),
    positiveFollowThroughPct: weightedAverageMetric(
      present,
      "positiveFollowThroughPct",
    ),
    followThroughIqrPct: weightedAverageMetric(present, "followThroughIqrPct"),
    medianDrawdownPct: weightedAverageMetric(present, "medianDrawdownPct"),
    worstDrawdownPct: minMetric(present, "worstDrawdownPct"),
    averageRankScore: weightedAverageMetric(present, "averageRankScore"),
    averageRiskAdjustedScore: weightedAverageMetric(
      present,
      "averageRiskAdjustedScore",
    ),
    averageConfidenceScore: weightedAverageMetric(
      present,
      "averageConfidenceScore",
    ),
    interpretationLabel: sampleWarning ?? "No Clear Separation",
    sampleWarning,
  };
}

function getSampleWarning({
  rowCount,
  completeCount,
  partialCount,
  missingCount,
}: {
  rowCount: number;
  completeCount: number;
  partialCount: number;
  missingCount: number;
}): RankingQualitySampleWarning {
  if (rowCount < MIN_TOTAL_ROWS_FOR_BUCKET) {
    return "Limited Sample";
  }

  if (completeCount < MIN_COMPLETE_WINDOWS_FOR_INTERPRETATION) {
    return partialCount + missingCount >= completeCount
      ? "Data Not Mature"
      : "Limited Sample";
  }

  return null;
}

function diagnosticReadiness(
  left?: RankingQualityMetricSummary | null,
  right?: RankingQualityMetricSummary | null,
): RankingQualitySampleWarning {
  if (!left || !right) {
    return "Limited Sample";
  }

  if (
    left.sampleWarning === "Data Not Mature" ||
    right.sampleWarning === "Data Not Mature"
  ) {
    return "Data Not Mature";
  }

  if (left.sampleWarning || right.sampleWarning) {
    return "Limited Sample";
  }

  return null;
}

function classifyFollowThroughSeparation({
  followThroughDelta,
  drawdownDelta,
}: {
  followThroughDelta: number | null;
  drawdownDelta: number | null;
}): RankingQualityInterpretationLabel {
  if (followThroughDelta === null) {
    return "No Clear Separation";
  }

  if (followThroughDelta >= FOLLOW_THROUGH_CLEAR_DELTA_PCT) {
    return drawdownDelta !== null && drawdownDelta <= -DRAWDOWN_CLEAR_DELTA_PCT
      ? "Weak Separation"
      : "Clear Separation";
  }

  if (followThroughDelta >= FOLLOW_THROUGH_WEAK_DELTA_PCT) {
    return "Weak Separation";
  }

  if (followThroughDelta <= -FOLLOW_THROUGH_WEAK_DELTA_PCT) {
    return "Contradictory Context";
  }

  return "No Clear Separation";
}

function classifyRiskSeparation({
  followThroughDelta,
  drawdownDelta,
}: {
  followThroughDelta: number | null;
  drawdownDelta: number | null;
}): RankingQualityInterpretationLabel {
  if (followThroughDelta === null && drawdownDelta === null) {
    return "No Clear Separation";
  }

  const weakerFollowThrough =
    followThroughDelta !== null && followThroughDelta <= -FOLLOW_THROUGH_CLEAR_DELTA_PCT;
  const somewhatWeakerFollowThrough =
    followThroughDelta !== null && followThroughDelta <= -FOLLOW_THROUGH_WEAK_DELTA_PCT;
  const higherDrawdown =
    drawdownDelta !== null && drawdownDelta <= -DRAWDOWN_CLEAR_DELTA_PCT;
  const somewhatHigherDrawdown =
    drawdownDelta !== null && drawdownDelta <= -DRAWDOWN_WEAK_DELTA_PCT;
  const lowerDrawdown =
    drawdownDelta !== null && drawdownDelta >= DRAWDOWN_CLEAR_DELTA_PCT;
  const strongerFollowThrough =
    followThroughDelta !== null && followThroughDelta >= FOLLOW_THROUGH_CLEAR_DELTA_PCT;

  if (higherDrawdown || weakerFollowThrough) {
    return "Clear Separation";
  }

  if (somewhatHigherDrawdown || somewhatWeakerFollowThrough) {
    return "Weak Separation";
  }

  if (lowerDrawdown || strongerFollowThrough) {
    return "Contradictory Context";
  }

  return "No Clear Separation";
}

function classifyConfidenceSeparation({
  completeRateDelta,
  stabilityDelta,
}: {
  completeRateDelta: number | null;
  stabilityDelta: number | null;
}): RankingQualityInterpretationLabel {
  const materiallyMoreComplete =
    completeRateDelta !== null && completeRateDelta >= COMPLETENESS_CLEAR_DELTA_PCT;
  const somewhatMoreComplete =
    completeRateDelta !== null && completeRateDelta >= COMPLETENESS_WEAK_DELTA_PCT;
  const materiallyMoreStable =
    stabilityDelta !== null && stabilityDelta <= -STABILITY_CLEAR_DELTA_PCT;
  const somewhatMoreStable =
    stabilityDelta !== null && stabilityDelta <= -STABILITY_WEAK_DELTA_PCT;
  const materiallyLessComplete =
    completeRateDelta !== null && completeRateDelta <= -COMPLETENESS_CLEAR_DELTA_PCT;
  const materiallyLessStable =
    stabilityDelta !== null && stabilityDelta >= STABILITY_CLEAR_DELTA_PCT;

  if (materiallyLessComplete || materiallyLessStable) {
    return "Contradictory Context";
  }

  if (materiallyMoreComplete && materiallyMoreStable) {
    return "Clear Separation";
  }

  if (somewhatMoreComplete || somewhatMoreStable) {
    return "Weak Separation";
  }

  return "No Clear Separation";
}

function scoreBucketCode(value: number | null | undefined) {
  const score = toFiniteNumber(value);

  if (score === null) return "score_unknown";
  if (score < 0) return "score_lt_0";
  if (score < 20) return "score_0_20";
  if (score < 40) return "score_20_40";
  if (score < 60) return "score_40_60";
  if (score < 80) return "score_60_80";
  if (score < 100) return "score_80_100";
  return "score_gte_100";
}

function confidenceBucketCode(value: number | null | undefined) {
  const score = toFiniteNumber(value);

  if (score === null) return "confidence_unknown";
  if (score < 50) return "confidence_low";
  if (score < 75) return "confidence_mid";
  return "confidence_high";
}

function hasRiskContext(row: RankingQualityInputRow) {
  if (typeof row.hasRiskContext === "boolean") {
    return row.hasRiskContext;
  }

  const group = normalizeGroup(row.group);

  return (
    group === "risk" ||
    group === "overheated" ||
    (row.riskCodes?.length ?? 0) > 0 ||
    (row.riskTypes?.length ?? 0) > 0
  );
}

function normalizeGroup(value: string | null | undefined) {
  const code = normalizeCode(value, "unknown");

  if (["eligible", "high_priority", "high-priority", "highpriority"].includes(code)) {
    return "high_priority";
  }

  if (["watch", "watch_only"].includes(code)) {
    return "watch";
  }

  if (["neutral", "ignore"].includes(code)) {
    return "neutral";
  }

  if (["risk", "high_risk", "avoid", "do_not_chase"].includes(code)) {
    return "risk";
  }

  if (code === "overheated") {
    return "overheated";
  }

  if (["insufficient_history", "limited_history"].includes(code)) {
    return "insufficient_history";
  }

  return code === "unknown" ? "unknown" : "other";
}

function normalizeCode(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim().toLowerCase().replace(/\s+/g, "_");
  return normalized && normalized.length > 0 ? normalized : fallback;
}

function isKnownStatus(
  status: RankingQualityDataStatus,
): status is RankingQualityDataStatus {
  return status === "complete" || status === "partial" || status === "missing";
}

function finiteValues(value: number | null | undefined) {
  const numberValue = toFiniteNumber(value);
  return numberValue === null ? [] : [numberValue];
}

function toFiniteNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function delta(
  left: number | null | undefined,
  right: number | null | undefined,
) {
  const leftValue = toFiniteNumber(left);
  const rightValue = toFiniteNumber(right);
  return leftValue === null || rightValue === null
    ? null
    : round(leftValue - rightValue);
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);
  const value =
    sorted.length % 2 === 0
      ? ((sorted[midpoint - 1] ?? 0) + (sorted[midpoint] ?? 0)) / 2
      : (sorted[midpoint] ?? 0);

  return round(value);
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return round(values.reduce((total, value) => total + value, 0) / values.length);
}

function interquartileRange(values: number[]) {
  if (values.length < 4) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const q1 = percentile(sorted, 0.25);
  const q3 = percentile(sorted, 0.75);
  return q1 === null || q3 === null ? null : round(q3 - q1);
}

function percentile(sortedValues: number[], percentileRank: number) {
  if (sortedValues.length === 0) return null;
  const index = (sortedValues.length - 1) * percentileRank;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  const lower = sortedValues[lowerIndex];
  const upper = sortedValues[upperIndex];

  if (lower === undefined || upper === undefined) {
    return null;
  }

  if (lowerIndex === upperIndex) {
    return lower;
  }

  return lower + (upper - lower) * (index - lowerIndex);
}

function weightedAverageMetric(
  summaries: RankingQualityMetricSummary[],
  key: keyof Pick<
    RankingQualityMetricSummary,
    | "medianFollowThroughPct"
    | "averageFollowThroughPct"
    | "positiveFollowThroughPct"
    | "followThroughIqrPct"
    | "medianDrawdownPct"
    | "averageRankScore"
    | "averageRiskAdjustedScore"
    | "averageConfidenceScore"
  >,
) {
  const weighted = summaries.flatMap((summary) => {
    const value = summary[key];
    return value === null ? [] : [{ value, weight: summary.completeCount }];
  });
  const weightTotal = weighted.reduce((total, item) => total + item.weight, 0);

  if (weightTotal === 0) {
    return null;
  }

  return round(
    weighted.reduce((total, item) => total + item.value * item.weight, 0) /
      weightTotal,
  );
}

function minMetric(
  summaries: RankingQualityMetricSummary[],
  key: keyof Pick<RankingQualityMetricSummary, "worstDrawdownPct">,
) {
  const values = summaries.flatMap((summary) => finiteValues(summary[key]));
  return values.length > 0 ? round(Math.min(...values)) : null;
}

function toNotice(summary: RankingQualityMetricSummary): RankingQualityNotice {
  return {
    label: summary.label,
    code: summary.code,
    rowCount: summary.rowCount,
    completeCount: summary.completeCount,
    partialCount: summary.partialCount,
    missingCount: summary.missingCount,
    interpretationLabel: summary.interpretationLabel,
    sampleWarning: summary.sampleWarning,
  };
}

function round(value: number) {
  return Number(value.toFixed(4));
}
