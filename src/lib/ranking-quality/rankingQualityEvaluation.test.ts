import { describe, expect, it } from "vitest";
import {
  evaluateRankingQuality,
  MIN_COMPLETE_WINDOWS_FOR_INTERPRETATION,
  MIN_TOTAL_ROWS_FOR_BUCKET,
  type RankingQualityInputRow,
} from "./rankingQualityEvaluation";

describe("rankingQualityEvaluation", () => {
  it("returns structured empty diagnostics for empty input", () => {
    const evaluation = evaluateRankingQuality([]);

    expect(evaluation.summary).toEqual(
      expect.objectContaining({
        code: "summary",
        rowCount: 0,
        completeCount: 0,
        partialCount: 0,
        missingCount: 0,
        interpretationLabel: "Limited Sample",
        sampleWarning: "Limited Sample",
      }),
    );
    expect(evaluation.scoreBuckets).toEqual([]);
    expect(evaluation.separationDiagnostics).toHaveLength(4);
    expect(
      evaluation.separationDiagnostics.every(
        (item) => item.interpretationLabel === "Limited Sample",
      ),
    ).toBe(true);
  });

  it("uses complete windows for primary metrics and only counts partial and missing windows", () => {
    const evaluation = evaluateRankingQuality([
      row({ observedChangePct: 4, maxDrawdownPct: -2, dataStatus: "complete" }),
      row({ observedChangePct: 8, maxDrawdownPct: -4, dataStatus: "complete" }),
      row({ observedChangePct: -100, maxDrawdownPct: -50, dataStatus: "partial" }),
      row({ observedChangePct: -100, maxDrawdownPct: -90, dataStatus: "missing" }),
    ]);

    expect(evaluation.summary.completeCount).toBe(2);
    expect(evaluation.summary.partialCount).toBe(1);
    expect(evaluation.summary.missingCount).toBe(1);
    expect(evaluation.summary.medianFollowThroughPct).toBe(6);
    expect(evaluation.summary.averageFollowThroughPct).toBe(6);
    expect(evaluation.summary.medianDrawdownPct).toBe(-3);
  });

  it("does not crash on null or non-finite metrics", () => {
    const evaluation = evaluateRankingQuality([
      row({
        rankScore: Number.NaN,
        riskAdjustedScore: Number.POSITIVE_INFINITY,
        confidenceScore: null,
        observedChangePct: null,
        maxDrawdownPct: Number.NEGATIVE_INFINITY,
        dataStatus: "complete",
      }),
    ]);

    expect(evaluation.summary.medianFollowThroughPct).toBeNull();
    expect(evaluation.summary.medianDrawdownPct).toBeNull();
    expect(evaluation.summary.averageRankScore).toBeNull();
    expect(evaluation.scoreBuckets[0]).toEqual(
      expect.objectContaining({
        code: "score_unknown",
        rowCount: 1,
      }),
    );
  });

  it("assigns deterministic score buckets", () => {
    const evaluation = evaluateRankingQuality([
      row({ rankScore: -5 }),
      row({ rankScore: 0 }),
      row({ rankScore: 20 }),
      row({ rankScore: 40 }),
      row({ rankScore: 60 }),
      row({ rankScore: 80 }),
      row({ rankScore: 100 }),
      row({ rankScore: null }),
    ]);

    expect(evaluation.scoreBuckets.map((bucket) => bucket.code)).toEqual([
      "score_lt_0",
      "score_0_20",
      "score_20_40",
      "score_40_60",
      "score_60_80",
      "score_80_100",
      "score_gte_100",
      "score_unknown",
    ]);
  });

  it("counts group summaries and labels undersized groups conservatively", () => {
    const rows = [
      ...makeRows(6, { group: "eligible", dataStatus: "complete" }),
      ...makeRows(2, { group: "watch", dataStatus: "partial" }),
      ...makeRows(2, { group: "watch", dataStatus: "missing" }),
    ];
    const evaluation = evaluateRankingQuality(rows);

    expect(evaluation.groupSummaries).toEqual([
      expect.objectContaining({
        code: "high_priority",
        rowCount: 6,
        completeCount: 6,
        interpretationLabel: "Limited Sample",
      }),
      expect.objectContaining({
        code: "watch",
        rowCount: 4,
        partialCount: 2,
        missingCount: 2,
        interpretationLabel: "Limited Sample",
      }),
    ]);
    expect(MIN_TOTAL_ROWS_FOR_BUCKET).toBe(10);
  });

  it("labels mature row counts with too few complete windows as data not mature", () => {
    const evaluation = evaluateRankingQuality([
      ...makeRows(12, { dataStatus: "complete" }),
      ...makeRows(12, { dataStatus: "partial" }),
    ]);

    expect(evaluation.summary).toEqual(
      expect.objectContaining({
        rowCount: 24,
        completeCount: 12,
        interpretationLabel: "Data Not Mature",
        sampleWarning: "Data Not Mature",
      }),
    );
    expect(MIN_COMPLETE_WINDOWS_FOR_INTERPRETATION).toBe(20);
  });

  it("reports clear separation when higher score buckets show stronger complete-window context", () => {
    const evaluation = evaluateRankingQuality([
      ...makeRows(20, {
        group: "eligible",
        rankScore: 88,
        observedChangePct: 5,
        maxDrawdownPct: -2,
      }),
      ...makeRows(20, {
        group: "neutral",
        rankScore: 12,
        observedChangePct: 1,
        maxDrawdownPct: -2,
      }),
    ]);

    expect(
      evaluation.separationDiagnostics.find(
        (item) => item.code === "top_score_vs_bottom_score",
      ),
    ).toEqual(
      expect.objectContaining({
        interpretationLabel: "Clear Separation",
        sampleWarning: null,
        metricDeltas: expect.objectContaining({
          medianFollowThroughPct: 4,
        }),
      }),
    );
  });

  it("surfaces contradictory context without changing scoring inputs", () => {
    const evaluation = evaluateRankingQuality([
      ...makeRows(20, {
        group: "eligible",
        rankScore: 88,
        observedChangePct: 0,
      }),
      ...makeRows(20, {
        group: "watch",
        rankScore: 12,
        observedChangePct: 4,
      }),
    ]);

    expect(
      evaluation.separationDiagnostics.find(
        (item) => item.code === "high_priority_vs_watch_neutral",
      ),
    ).toEqual(
      expect.objectContaining({
        interpretationLabel: "Contradictory Context",
      }),
    );
    expect(evaluation.contradictionDiagnostics).toContainEqual(
      expect.objectContaining({
        relatedDiagnosticCode: "high_priority_vs_watch_neutral",
        needsCalibrationReview: true,
        followUpNote: "needs timeframe split",
      }),
    );
    expect(evaluation.summary.averageRankScore).toBe(50);
  });

  it("summarizes risk context separately from follow-through context", () => {
    const evaluation = evaluateRankingQuality([
      ...makeRows(20, {
        group: "risk",
        hasRiskContext: true,
        observedChangePct: 0,
        maxDrawdownPct: -8,
      }),
      ...makeRows(20, {
        group: "neutral",
        hasRiskContext: false,
        observedChangePct: 1,
        maxDrawdownPct: -2,
      }),
    ]);

    expect(evaluation.riskContextSummaries).toEqual([
      expect.objectContaining({
        code: "risk_context",
        medianDrawdownPct: -8,
      }),
      expect.objectContaining({
        code: "no_risk_context",
        medianDrawdownPct: -2,
      }),
    ]);
    expect(
      evaluation.separationDiagnostics.find(
        (item) => item.code === "risk_context_vs_no_risk_context",
      ),
    ).toEqual(
      expect.objectContaining({
        interpretationLabel: "Clear Separation",
      }),
    );
  });

  it("uses evidence reliability language for confidence bucket diagnostics", () => {
    const highConfidenceRows = Array.from({ length: 20 }, (_, index) =>
      row({
        confidenceScore: 90,
        observedChangePct: index % 2 === 0 ? 2 : 2.5,
      }),
    );
    const lowConfidenceRows = Array.from({ length: 20 }, (_, index) =>
      row({
        confidenceScore: 20,
        observedChangePct: index % 2 === 0 ? -4 : 8,
      }),
    );
    const evaluation = evaluateRankingQuality([
      ...highConfidenceRows,
      ...lowConfidenceRows,
    ]);

    expect(
      evaluation.separationDiagnostics.find(
        (item) => item.code === "high_confidence_vs_low_confidence",
      ),
    ).toEqual(
      expect.objectContaining({
        interpretationLabel: "Weak Separation",
        metricDeltas: expect.objectContaining({
          completeRatePct: 0,
        }),
      }),
    );
  });

  it("flags high confidence groups with less mature windows than low confidence groups", () => {
    const evaluation = evaluateRankingQuality([
      ...makeRows(20, {
        confidenceScore: 90,
        dataStatus: "complete",
      }),
      ...makeRows(20, {
        confidenceScore: 90,
        dataStatus: "partial",
      }),
      ...makeRows(40, {
        confidenceScore: 20,
        dataStatus: "complete",
      }),
    ]);

    expect(
      evaluation.separationDiagnostics.find(
        (item) => item.code === "high_confidence_vs_low_confidence",
      ),
    ).toEqual(
      expect.objectContaining({
        interpretationLabel: "Contradictory Context",
        metricDeltas: expect.objectContaining({
          completeRatePct: -50,
        }),
      }),
    );
  });

  it("does not emit disallowed execution-simulation wording", () => {
    const evaluation = evaluateRankingQuality([
      ...makeRows(20, { group: "eligible", rankScore: 88 }),
      ...makeRows(20, { group: "neutral", rankScore: 12 }),
    ]);
    const serialized = JSON.stringify(evaluation).toLowerCase();
    const disallowedTerms = [
      ["w", "in rate"].join(""),
      ["suc", "cess rate"].join(""),
      ["pro", "fit"].join(""),
      ["pro", "fitable"].join(""),
      ["los", "er"].join(""),
      ["win", "ner"].join(""),
      ["b", "uy"].join(""),
      ["s", "ell"].join(""),
      ["lo", "ng"].join(""),
      ["sh", "ort"].join(""),
      ["en", "try"].join(""),
      ["ex", "it"].join(""),
      ["tr", "ade signal"].join(""),
      ["tr", "ading signal"].join(""),
      ["al", "pha call"].join(""),
    ];

    expect(serialized).not.toMatch(
      new RegExp(`\\b(${disallowedTerms.join("|")})\\b`),
    );
  });
});

function makeRows(
  count: number,
  overrides: Partial<RankingQualityInputRow> = {},
) {
  return Array.from({ length: count }, (_, index) =>
    row({
      symbol: `SYM${index}`,
      ...overrides,
    }),
  );
}

function row(
  overrides: Partial<RankingQualityInputRow> = {},
): RankingQualityInputRow {
  return {
    symbol: "BTCUSDT",
    timeframe: "1d",
    group: "neutral",
    rankScore: 50,
    riskAdjustedScore: 50,
    confidenceScore: 60,
    riskCodes: [],
    riskTypes: [],
    observedChangePct: 2,
    maxDrawdownPct: -2,
    dataStatus: "complete",
    ...overrides,
  };
}
