import { SCANNER_VERSION, type PersistScanSignalsInput, type ScanSignalRecord, type ScanSnapshotRecord } from "../scanSignalModel";
import type { SignalForwardEvaluation } from "../scanEvaluation";
import { parseJsonArray } from "../scanSignalModel";
import {
  createSnapshotAndSignals,
  type EvaluationQuery,
  type PendingEvaluationQuery,
  type PerformanceGroup,
  type PerformanceQuery,
  type PruneResearchDataInput,
  type PruneResearchDataResult,
  type ScannerStorageAdapter,
  type ScanSignalQuery,
} from "../storageAdapter";
import { ScannerResearchDb } from "./db";

type SignalRow = {
  id: string;
  snapshot_id: string;
  symbol: string;
  timeframe: string;
  scan_time: string;
  price_at_signal: number;
  final_signal_score: number;
  opportunity_score: number;
  confirmation_score: number;
  risk_score: number;
  trend_score: number;
  momentum_score: number;
  volume_score: number;
  structure_score: number;
  signal_label: ScanSignalRecord["signalLabel"];
  action_bias: ScanSignalRecord["actionBias"];
  primary_structure: ScanSignalRecord["primaryStructure"];
  secondary_structures_json: string;
  detected_risk_types_json: string;
  bullish_observations_json: string;
  bearish_observations_json: string;
  risk_observations_json: string;
  neutral_observations_json: string;
  next_confirmation_observations_json: string;
  invalidation_observations_json: string;
  raw_metrics_json: string;
  legacy_signal: string;
  legacy_rank_score: number;
  legacy_warnings_json: string;
  scoring_version: string;
  scanner_version: string | null;
  created_at: string;
};

type EvaluationRow = {
  id: string;
  signal_id: string;
  symbol: string;
  timeframe: string;
  signal_time: string;
  evaluation_time: string | null;
  horizon: SignalForwardEvaluation["horizon"];
  price_at_signal: number;
  price_at_evaluation: number | null;
  return_pct: number | null;
  max_return_pct: number | null;
  max_drawdown_pct: number | null;
  still_above_ma20: number | null;
  still_above_ma50: number | null;
  still_above_ma200: number | null;
  rsi_at_evaluation: number | null;
  risk_score_at_evaluation: number | null;
  confirmation_score_at_evaluation: number | null;
  signal_label_at_evaluation: SignalForwardEvaluation["signalLabelAtEvaluation"];
  action_bias_at_evaluation: SignalForwardEvaluation["actionBiasAtEvaluation"];
  outcome_label: SignalForwardEvaluation["outcomeLabel"];
  notes_json: string;
  metrics_json: string;
};

export class ScanSignalSqliteStore implements ScannerStorageAdapter {
  readonly mode = "sqlite" as const;
  private readonly researchDb: ScannerResearchDb;

  constructor(dbPath?: string) {
    this.researchDb = new ScannerResearchDb(dbPath);
  }

  async createScanSnapshot(input: PersistScanSignalsInput) {
    const { snapshot } = createSnapshotAndSignals(input);
    this.insertSnapshot(snapshot);
    return snapshot;
  }

  async saveScanSnapshotRecord(snapshot: ScanSnapshotRecord) {
    return this.insertSnapshot(snapshot);
  }

  async saveScanSignalRecord(signal: ScanSignalRecord) {
    return this.insertSignal(signal);
  }

  async saveScanSignals(snapshotId: string, signals: ScanSignalRecord[]) {
    this.researchDb.transaction(() => {
      for (const signal of signals) {
        this.insertSignal({ ...signal, snapshotId });
      }
    });
  }

  async persistScanResults(input: PersistScanSignalsInput) {
    const { snapshot, signals } = createSnapshotAndSignals(input);

    this.researchDb.transaction(() => {
      this.insertSnapshot(snapshot);
      for (const signal of signals) {
        this.insertSignal(signal);
      }
    });

    return { snapshot, signals };
  }

  async listScanSignals(query: ScanSignalQuery) {
    const { where, params } = buildSignalWhere(query);
    const rows = this.researchDb.db
      .prepare(
        `
        SELECT * FROM scan_signals
        ${where}
        ORDER BY scan_time DESC
        LIMIT ?
      `,
      )
      .all(...(params as never[]), query.limit ?? 500) as SignalRow[];

    return rows.map(toSignalRecord);
  }

  async getPendingEvaluations(query: PendingEvaluationQuery) {
    const { where, params } = buildSignalWhere(query, "s");
    const rows = this.researchDb.db
      .prepare(
        `
        SELECT s.*
        FROM scan_signals s
        LEFT JOIN signal_forward_evaluations e
          ON e.signal_id = s.id
          AND e.horizon = ?
          AND e.outcome_label != 'insufficient_data'
        ${where}
          ${where ? "AND" : "WHERE"} e.id IS NULL
        ORDER BY s.scan_time DESC
        LIMIT ?
      `,
      )
      .all(query.horizon, ...(params as never[]), query.limit ?? 500) as SignalRow[];

    return rows.map(toSignalRecord);
  }

  async saveForwardEvaluations(evaluations: SignalForwardEvaluation[]) {
    this.researchDb.transaction(() => {
      for (const evaluation of evaluations) {
        this.researchDb.db
          .prepare(
            `
            INSERT INTO signal_forward_evaluations (
              id, signal_id, symbol, timeframe, signal_time, evaluation_time, horizon,
              price_at_signal, price_at_evaluation, return_pct, max_return_pct,
              max_drawdown_pct, still_above_ma20, still_above_ma50,
              still_above_ma200, rsi_at_evaluation, risk_score_at_evaluation,
              confirmation_score_at_evaluation, signal_label_at_evaluation,
              action_bias_at_evaluation, outcome_label, notes_json, metrics_json,
              scoring_version, scanner_version, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(signal_id, horizon) DO UPDATE SET
              evaluation_time = excluded.evaluation_time,
              price_at_evaluation = excluded.price_at_evaluation,
              return_pct = excluded.return_pct,
              max_return_pct = excluded.max_return_pct,
              max_drawdown_pct = excluded.max_drawdown_pct,
              still_above_ma20 = excluded.still_above_ma20,
              still_above_ma50 = excluded.still_above_ma50,
              still_above_ma200 = excluded.still_above_ma200,
              rsi_at_evaluation = excluded.rsi_at_evaluation,
              risk_score_at_evaluation = excluded.risk_score_at_evaluation,
              confirmation_score_at_evaluation = excluded.confirmation_score_at_evaluation,
              signal_label_at_evaluation = excluded.signal_label_at_evaluation,
              action_bias_at_evaluation = excluded.action_bias_at_evaluation,
              outcome_label = excluded.outcome_label,
              notes_json = excluded.notes_json,
              metrics_json = excluded.metrics_json
            `,
          )
          .run(
            evaluation.id,
            evaluation.signalId,
            evaluation.symbol,
            evaluation.timeframe,
            evaluation.signalTime,
            evaluation.evaluationTime,
            evaluation.horizon,
            evaluation.priceAtSignal,
            evaluation.priceAtEvaluation,
            evaluation.returnPct,
            evaluation.maxReturnPct,
            evaluation.maxDrawdownPct,
            toSqlBool(evaluation.stillAboveMA20),
            toSqlBool(evaluation.stillAboveMA50),
            toSqlBool(evaluation.stillAboveMA200),
            evaluation.rsiAtEvaluation,
            evaluation.riskScoreAtEvaluation,
            evaluation.confirmationScoreAtEvaluation,
            evaluation.signalLabelAtEvaluation,
            evaluation.actionBiasAtEvaluation,
            evaluation.outcomeLabel,
            evaluation.notesJson,
            evaluation.metricsJson,
            getScoringVersionForSignal(this.researchDb, evaluation.signalId),
            SCANNER_VERSION,
            new Date().toISOString(),
          );
      }
    });
  }

  async listForwardEvaluations(query: EvaluationQuery) {
    const whereParts: string[] = [];
    const params: unknown[] = [];

    if (query.horizon) {
      whereParts.push("horizon = ?");
      params.push(query.horizon);
    }

    if (query.timeframe) {
      whereParts.push("timeframe = ?");
      params.push(query.timeframe);
    }

    if (query.scoringVersion) {
      whereParts.push("scoring_version = ?");
      params.push(query.scoringVersion);
    }

    const rows = this.researchDb.db
      .prepare(
        `
        SELECT * FROM signal_forward_evaluations
        ${whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : ""}
        ORDER BY signal_time DESC
        LIMIT ?
      `,
      )
      .all(...(params as never[]), query.limit ?? 500) as EvaluationRow[];

    return rows.map(toEvaluationRecord);
  }

  async getSignalPerformanceByLabel(query: PerformanceQuery) {
    return this.aggregate("s.signal_label", query);
  }

  async getSignalPerformanceByActionBias(query: PerformanceQuery) {
    return this.aggregate("s.action_bias", query);
  }

  async getSignalPerformanceByRiskType(query: PerformanceQuery) {
    return this.aggregate("rt.risk_type", query, "risk");
  }

  async getSignalPerformanceByTimeframe(query: PerformanceQuery) {
    return this.aggregate("e.timeframe", query);
  }

  async getSignalPerformanceByScoreBucket(query: PerformanceQuery) {
    return this.aggregate(
      `CASE
        WHEN s.final_signal_score >= 100 THEN 'score_gte_100'
        WHEN s.final_signal_score >= 50 THEN 'score_50_100'
        WHEN s.final_signal_score >= 0 THEN 'score_0_50'
        ELSE 'score_lt_0'
      END`,
      query,
    );
  }

  async pruneResearchData({
    signalDays = 30,
    snapshotDays = 30,
    evaluationDays = 90,
  }: PruneResearchDataInput = {}): Promise<PruneResearchDataResult> {
    const signalCutoff = cutoffIso(signalDays);
    const snapshotCutoff = cutoffIso(snapshotDays);
    const evaluationCutoff = cutoffIso(evaluationDays);

    return this.researchDb.transaction(() => {
      const evaluationsDeleted = this.researchDb.db
        .prepare("DELETE FROM signal_forward_evaluations WHERE created_at < ?")
        .run(evaluationCutoff).changes;
      const signalsDeleted = this.researchDb.db
        .prepare("DELETE FROM scan_signals WHERE created_at < ?")
        .run(signalCutoff).changes;
      const snapshotsDeleted = this.researchDb.db
        .prepare("DELETE FROM scan_snapshots WHERE created_at < ?")
        .run(snapshotCutoff).changes;

      return {
        snapshotsDeleted: Number(snapshotsDeleted),
        signalsDeleted: Number(signalsDeleted),
        evaluationsDeleted: Number(evaluationsDeleted),
      };
    });
  }

  close() {
    this.researchDb.close();
  }

  private insertSnapshot(snapshot: ScanSnapshotRecord) {
    const result = this.researchDb.db
      .prepare(
        `
        INSERT OR IGNORE INTO scan_snapshots (
          id, created_at, timeframe, total_symbols, source, scanner_version,
          scoring_version, market_context_json, metadata_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        snapshot.id,
        snapshot.createdAt,
        snapshot.timeframe,
        snapshot.totalSymbols,
        snapshot.source,
        snapshot.scannerVersion,
        snapshot.scoringVersion,
        snapshot.marketContextJson,
        snapshot.metadataJson,
      );
    return Number(result.changes) > 0;
  }

  private insertSignal(signal: ScanSignalRecord) {
    const result = this.researchDb.db
      .prepare(
        `
        INSERT OR IGNORE INTO scan_signals (
          id, snapshot_id, symbol, timeframe, scan_time, price_at_signal,
          final_signal_score, opportunity_score, confirmation_score, risk_score,
          trend_score, momentum_score, volume_score, structure_score,
          signal_label, action_bias, primary_structure, secondary_structures_json,
          detected_risk_types_json, bullish_observations_json,
          bearish_observations_json, risk_observations_json,
          neutral_observations_json, next_confirmation_observations_json,
          invalidation_observations_json, raw_metrics_json, legacy_signal,
          legacy_rank_score,
          legacy_warnings_json, scoring_version, scanner_version, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        signal.id,
        signal.snapshotId,
        signal.symbol,
        signal.timeframe,
        signal.scanTime,
        signal.priceAtSignal,
        signal.finalSignalScore,
        signal.opportunityScore,
        signal.confirmationScore,
        signal.riskScore,
        signal.trendScore,
        signal.momentumScore,
        signal.volumeScore,
        signal.structureScore,
        signal.signalLabel,
        signal.actionBias,
        signal.primaryStructure,
        signal.secondaryStructuresJson,
        signal.detectedRiskTypesJson,
        signal.bullishObservationsJson,
        signal.bearishObservationsJson,
        signal.riskObservationsJson,
        signal.neutralObservationsJson,
        signal.nextConfirmationObservationsJson,
        signal.invalidationObservationsJson,
        signal.rawMetricsJson,
        signal.legacySignal,
        signal.legacyRankScore,
        signal.legacyWarningsJson,
        signal.scoringVersion,
        signal.scannerVersion ?? SCANNER_VERSION,
        signal.createdAt ?? signal.scanTime,
      );

    const riskTypes = parseJsonArray(signal.detectedRiskTypesJson);
    for (const riskType of riskTypes) {
      this.researchDb.db
        .prepare(
          `
          INSERT OR IGNORE INTO scan_signal_risk_types (
            signal_id, risk_type, symbol, timeframe, scan_time, scoring_version
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        )
        .run(
          signal.id,
          riskType,
          signal.symbol,
          signal.timeframe,
          signal.scanTime,
          signal.scoringVersion,
        );
    }

    return Number(result.changes) > 0;
  }

  private aggregate(
    groupExpression: string,
    query: PerformanceQuery,
    joinMode: "default" | "risk" = "default",
  ): PerformanceGroup[] {
    const whereParts: string[] = [];
    const params: unknown[] = [];

    if (query.horizon) {
      whereParts.push("e.horizon = ?");
      params.push(query.horizon);
    }

    if (query.timeframe) {
      whereParts.push("e.timeframe = ?");
      params.push(query.timeframe);
    }

    if (query.scoringVersion) {
      whereParts.push("e.scoring_version = ?");
      params.push(query.scoringVersion);
    }

    const riskJoin =
      joinMode === "risk"
        ? "JOIN scan_signal_risk_types rt ON rt.signal_id = s.id"
        : "";
    const rows = this.researchDb.db
      .prepare(
        `
        SELECT
          ${groupExpression} AS groupName,
          COUNT(*) AS count,
          SUM(CASE WHEN e.outcome_label != 'insufficient_data' THEN 1 ELSE 0 END) AS completedCount,
          SUM(CASE WHEN e.outcome_label = 'insufficient_data' THEN 1 ELSE 0 END) AS pendingCount,
          AVG(CASE WHEN e.outcome_label != 'insufficient_data' THEN e.return_pct END) AS avgReturnPct,
          AVG(CASE WHEN e.outcome_label != 'insufficient_data' THEN e.max_drawdown_pct END) AS avgMaxDrawdownPct,
          AVG(CASE WHEN e.outcome_label = 'favorable' THEN 1.0 WHEN e.outcome_label != 'insufficient_data' THEN 0.0 END) AS favorableRate,
          AVG(CASE WHEN e.outcome_label = 'unfavorable' THEN 1.0 WHEN e.outcome_label != 'insufficient_data' THEN 0.0 END) AS unfavorableRate,
          AVG(CASE WHEN e.outcome_label != 'insufficient_data' THEN e.max_return_pct END) AS avgMaxUpPct,
          AVG(CASE WHEN e.outcome_label != 'insufficient_data' THEN e.max_drawdown_pct END) AS avgMaxDownPct
        FROM signal_forward_evaluations e
        JOIN scan_signals s ON s.id = e.signal_id
        ${riskJoin}
        ${whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : ""}
        GROUP BY groupName
        ORDER BY completedCount DESC, count DESC
      `,
      )
      .all(...(params as never[])) as Array<{
      groupName: string;
      count: number;
      completedCount: number;
      pendingCount: number;
      avgReturnPct: number | null;
      avgMaxDrawdownPct: number | null;
      favorableRate: number | null;
      unfavorableRate: number | null;
      avgMaxUpPct: number | null;
      avgMaxDownPct: number | null;
    }>;

    return rows.map((row) => ({
      group: row.groupName,
      count: row.count,
      completedCount: row.completedCount,
      pendingCount: row.pendingCount,
      avgReturnPct: row.avgReturnPct,
      avgMaxDrawdownPct: row.avgMaxDrawdownPct,
      favorableRate: row.favorableRate,
      unfavorableRate: row.unfavorableRate,
      hitRate: null,
      avgMaxUpPct: row.avgMaxUpPct,
      avgMaxDownPct: row.avgMaxDownPct,
    }));
  }
}

function buildSignalWhere(query: ScanSignalQuery, alias?: string) {
  const prefix = alias ? `${alias}.` : "";
  const whereParts: string[] = [];
  const params: unknown[] = [];

  if (query.timeframe) {
    whereParts.push(`${prefix}timeframe = ?`);
    params.push(query.timeframe);
  }

  if (query.scoringVersion) {
    whereParts.push(`${prefix}scoring_version = ?`);
    params.push(query.scoringVersion);
  }

  return {
    where: whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "",
    params,
  };
}

function toSignalRecord(row: SignalRow): ScanSignalRecord {
  return {
    id: row.id,
    snapshotId: row.snapshot_id,
    symbol: row.symbol,
    timeframe: row.timeframe as ScanSignalRecord["timeframe"],
    scanTime: row.scan_time,
    priceAtSignal: row.price_at_signal,
    scoringVersion: row.scoring_version,
    scannerVersion: row.scanner_version ?? undefined,
    createdAt: row.created_at,
    finalSignalScore: row.final_signal_score,
    opportunityScore: row.opportunity_score,
    confirmationScore: row.confirmation_score,
    riskScore: row.risk_score,
    trendScore: row.trend_score,
    momentumScore: row.momentum_score,
    volumeScore: row.volume_score,
    structureScore: row.structure_score,
    signalLabel: row.signal_label,
    actionBias: row.action_bias,
    primaryStructure: row.primary_structure,
    secondaryStructuresJson: row.secondary_structures_json,
    detectedRiskTypesJson: row.detected_risk_types_json,
    bullishObservationsJson: row.bullish_observations_json,
    bearishObservationsJson: row.bearish_observations_json,
    riskObservationsJson: row.risk_observations_json,
    neutralObservationsJson: row.neutral_observations_json,
    nextConfirmationObservationsJson: row.next_confirmation_observations_json,
    invalidationObservationsJson: row.invalidation_observations_json,
    rawMetricsJson: row.raw_metrics_json,
    legacySignal: row.legacy_signal,
    legacyRankScore: row.legacy_rank_score,
    legacyWarningsJson: row.legacy_warnings_json,
  };
}

function toEvaluationRecord(row: EvaluationRow): SignalForwardEvaluation {
  return {
    id: row.id,
    signalId: row.signal_id,
    symbol: row.symbol,
    timeframe: row.timeframe as SignalForwardEvaluation["timeframe"],
    signalTime: row.signal_time,
    evaluationTime: row.evaluation_time,
    horizon: row.horizon,
    priceAtSignal: row.price_at_signal,
    priceAtEvaluation: row.price_at_evaluation,
    returnPct: row.return_pct,
    maxReturnPct: row.max_return_pct,
    maxDrawdownPct: row.max_drawdown_pct,
    stillAboveMA20: fromSqlBool(row.still_above_ma20),
    stillAboveMA50: fromSqlBool(row.still_above_ma50),
    stillAboveMA200: fromSqlBool(row.still_above_ma200),
    rsiAtEvaluation: row.rsi_at_evaluation,
    riskScoreAtEvaluation: row.risk_score_at_evaluation,
    confirmationScoreAtEvaluation: row.confirmation_score_at_evaluation,
    signalLabelAtEvaluation: row.signal_label_at_evaluation,
    actionBiasAtEvaluation: row.action_bias_at_evaluation,
    outcomeLabel: row.outcome_label,
    notesJson: row.notes_json,
    metricsJson: row.metrics_json,
  };
}

function toSqlBool(value: boolean | null) {
  return value === null ? null : value ? 1 : 0;
}

function fromSqlBool(value: number | null) {
  return value === null ? null : value === 1;
}

function getScoringVersionForSignal(researchDb: ScannerResearchDb, signalId: string) {
  const row = researchDb.db
    .prepare("SELECT scoring_version AS scoringVersion FROM scan_signals WHERE id = ?")
    .get(signalId) as { scoringVersion: string } | undefined;
  return row?.scoringVersion ?? null;
}

function cutoffIso(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}
