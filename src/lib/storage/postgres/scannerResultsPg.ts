import type { Pool } from "pg";
import type { ScanResult } from "@/lib/scanner/types";
import { SCORING_VERSION } from "@/lib/scanner/scoring";
import { createPostgresPool } from "./pool";

export const PG_SCANNER_VERSION = "pg-scanner-v1";

export type ScanRunRecord = {
  id: string;
  exchange: string;
  market: string;
  mode: string;
  timeframe: string;
  universe: string;
  status: string;
  symbolsTotal: number;
  symbolsScanned: number;
  signalsCreated: number;
  symbolsSkipped: number;
  failedSymbols: number;
  params: Record<string, unknown>;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
};

export type ScanSignalRecord = {
  id: string;
  scanRunId: string;
  symbolId: number;
  exchange: string;
  market: string;
  symbol: string;
  timeframe: string;
  scanTime: string;
  candleOpenTime: string | null;
  priceAtSignal: number | null;
  rankScore: number | null;
  finalSignalScore: number | null;
  opportunityScore: number | null;
  confirmationScore: number | null;
  riskScore: number | null;
  trendScore: number | null;
  momentumScore: number | null;
  volumeScore: number | null;
  structureScore: number | null;
  signalLabel: string | null;
  actionBias: string | null;
  primaryStructure: string | null;
  secondaryStructures: unknown[];
  detectedRiskTypes: unknown[];
  factors: Record<string, unknown>;
  nextConfirmation: unknown;
  invalidation: unknown;
  rawMetrics: Record<string, unknown>;
  scoringVersion: string | null;
  scannerVersion: string | null;
  createdAt: string;
};

export type CreateScanRunInput = {
  id: string;
  timeframe: string;
  universe: string;
  status: string;
  symbolsTotal: number;
  params: Record<string, unknown>;
};

export type FinishScanRunInput = {
  id: string;
  status: string;
  symbolsScanned: number;
  signalsCreated: number;
  symbolsSkipped: number;
  failedSymbols: number;
  errorMessage?: string | null;
  paramsPatch?: Record<string, unknown>;
};

export type InsertScanSignalInput = {
  id: string;
  scanRunId: string;
  symbolId: number;
  symbol: string;
  timeframe: string;
  candleOpenTimeMs: number | null;
  result: ScanResult;
};

type ScanRunRow = {
  id: string;
  exchange: string;
  market: string;
  mode: string;
  timeframe: string;
  universe: string;
  status: string;
  symbols_total: number;
  symbols_scanned: number;
  signals_created: number;
  symbols_skipped: number;
  failed_symbols: number;
  params: Record<string, unknown>;
  error_message: string | null;
  started_at: Date | string;
  finished_at: Date | string | null;
};

type ScanSignalRow = {
  id: string;
  scan_run_id: string;
  symbol_id: string;
  exchange: string;
  market: string;
  symbol: string;
  timeframe: string;
  scan_time: Date | string;
  candle_open_time: Date | string | null;
  price_at_signal: number | string | null;
  rank_score: number | string | null;
  final_signal_score: number | string | null;
  opportunity_score: number | string | null;
  confirmation_score: number | string | null;
  risk_score: number | string | null;
  trend_score: number | string | null;
  momentum_score: number | string | null;
  volume_score: number | string | null;
  structure_score: number | string | null;
  signal_label: string | null;
  action_bias: string | null;
  primary_structure: string | null;
  secondary_structures: unknown[];
  detected_risk_types: unknown[];
  factors: Record<string, unknown>;
  next_confirmation: unknown;
  invalidation: unknown;
  raw_metrics: Record<string, unknown>;
  scoring_version: string | null;
  scanner_version: string | null;
  created_at: Date | string;
};

export class PgScannerResultsStore {
  private readonly pool: Pool;
  private readonly ownsPool: boolean;

  constructor(pool?: Pool) {
    this.pool = pool ?? createPostgresPool();
    this.ownsPool = pool === undefined;
  }

  async close() {
    if (this.ownsPool) {
      await this.pool.end();
    }
  }

  async createScanRun(input: CreateScanRunInput) {
    const result = await this.pool.query<ScanRunRow>(
      `
        INSERT INTO scan_runs (
          id, exchange, market, mode, timeframe, universe, status,
          symbols_total, params, started_at
        )
        VALUES ($1, 'binance', 'spot', 'single', $2, $3, $4, $5, $6::jsonb, now())
        RETURNING *
      `,
      [
        input.id,
        input.timeframe,
        input.universe,
        input.status,
        input.symbolsTotal,
        JSON.stringify(input.params),
      ],
    );

    return toScanRunRecord(result.rows[0]);
  }

  async finishScanRun(input: FinishScanRunInput) {
    const result = await this.pool.query<ScanRunRow>(
      `
        UPDATE scan_runs
        SET
          status = $2,
          symbols_scanned = $3,
          signals_created = $4,
          symbols_skipped = $5,
          failed_symbols = $6,
          error_message = $7,
          params = params || $8::jsonb,
          finished_at = now()
        WHERE id = $1
        RETURNING *
      `,
      [
        input.id,
        input.status,
        input.symbolsScanned,
        input.signalsCreated,
        input.symbolsSkipped,
        input.failedSymbols,
        input.errorMessage ?? null,
        JSON.stringify(input.paramsPatch ?? {}),
      ],
    );

    return result.rows[0] ? toScanRunRecord(result.rows[0]) : null;
  }

  async insertScanSignals(signals: InsertScanSignalInput[]) {
    for (const signal of signals) {
      const result = signal.result;
      await this.pool.query(
        `
          INSERT INTO scan_signals (
            id, scan_run_id, symbol_id, exchange, market, symbol, timeframe,
            scan_time, candle_open_time, price_at_signal, rank_score,
            final_signal_score, opportunity_score, confirmation_score, risk_score,
            trend_score, momentum_score, volume_score, structure_score,
            signal_label, action_bias, primary_structure, secondary_structures,
            detected_risk_types, factors, next_confirmation, invalidation,
            raw_metrics, scoring_version, scanner_version, created_at
          )
          VALUES (
            $1, $2, $3, 'binance', 'spot', $4, $5, now(),
            CASE WHEN $6::bigint IS NULL THEN NULL ELSE to_timestamp($6::double precision / 1000) END,
            $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
            $19, $20::jsonb, $21::jsonb, $22::jsonb, $23::jsonb, $24::jsonb,
            $25::jsonb, $26, $27, now()
          )
        `,
        [
          signal.id,
          signal.scanRunId,
          signal.symbolId,
          signal.symbol,
          signal.timeframe,
          signal.candleOpenTimeMs,
          result.price,
          result.rankScore,
          result.finalSignalScore,
          result.opportunityScore,
          result.confirmationScore,
          result.riskScore,
          result.trendScore,
          result.momentumScore,
          result.volumeScore,
          result.structureScore,
          result.signalLabel,
          result.actionBias,
          result.primaryStructure,
          JSON.stringify(result.secondaryStructures),
          JSON.stringify(result.detectedRiskTypes),
          JSON.stringify({
            bullish: result.bullishFactors,
            bearish: result.bearishFactors,
            risk: result.riskFactors,
            neutral: result.neutralFactors,
            phase: result.phase,
            signal: result.signal,
          }),
          JSON.stringify(result.nextConfirmationText),
          JSON.stringify(result.invalidationText),
          JSON.stringify(result.rawMetrics),
          SCORING_VERSION,
          PG_SCANNER_VERSION,
        ],
      );
    }
  }

  async getLatestScanRun({ timeframe }: { timeframe: string }) {
    const result = await this.pool.query<ScanRunRow>(
      `
        SELECT *
        FROM scan_runs
        WHERE timeframe = $1
        ORDER BY started_at DESC
        LIMIT 1
      `,
      [timeframe],
    );

    return result.rows[0] ? toScanRunRecord(result.rows[0]) : null;
  }

  async listLatestScanSignals({
    scanRunId,
    limit,
  }: {
    scanRunId: string;
    limit: number;
  }) {
    const result = await this.pool.query<ScanSignalRow>(
      `
        SELECT *
        FROM scan_signals
        WHERE scan_run_id = $1
        ORDER BY rank_score DESC NULLS LAST, symbol ASC
        LIMIT $2
      `,
      [scanRunId, limit],
    );

    return result.rows.map(toScanSignalRecord);
  }

  async listScanRuns({ limit = 10 }: { limit?: number } = {}) {
    const result = await this.pool.query<ScanRunRow>(
      `
        SELECT *
        FROM scan_runs
        ORDER BY started_at DESC
        LIMIT $1
      `,
      [limit],
    );

    return result.rows.map(toScanRunRecord);
  }
}

function toScanRunRecord(row: ScanRunRow): ScanRunRecord {
  return {
    id: row.id,
    exchange: row.exchange,
    market: row.market,
    mode: row.mode,
    timeframe: row.timeframe,
    universe: row.universe,
    status: row.status,
    symbolsTotal: row.symbols_total,
    symbolsScanned: row.symbols_scanned,
    signalsCreated: row.signals_created,
    symbolsSkipped: row.symbols_skipped,
    failedSymbols: row.failed_symbols,
    params: row.params ?? {},
    errorMessage: row.error_message,
    startedAt: new Date(row.started_at).toISOString(),
    finishedAt: row.finished_at ? new Date(row.finished_at).toISOString() : null,
  };
}

function toScanSignalRecord(row: ScanSignalRow): ScanSignalRecord {
  return {
    id: row.id,
    scanRunId: row.scan_run_id,
    symbolId: Number(row.symbol_id),
    exchange: row.exchange,
    market: row.market,
    symbol: row.symbol,
    timeframe: row.timeframe,
    scanTime: new Date(row.scan_time).toISOString(),
    candleOpenTime: row.candle_open_time
      ? new Date(row.candle_open_time).toISOString()
      : null,
    priceAtSignal: toNullableNumber(row.price_at_signal),
    rankScore: toNullableNumber(row.rank_score),
    finalSignalScore: toNullableNumber(row.final_signal_score),
    opportunityScore: toNullableNumber(row.opportunity_score),
    confirmationScore: toNullableNumber(row.confirmation_score),
    riskScore: toNullableNumber(row.risk_score),
    trendScore: toNullableNumber(row.trend_score),
    momentumScore: toNullableNumber(row.momentum_score),
    volumeScore: toNullableNumber(row.volume_score),
    structureScore: toNullableNumber(row.structure_score),
    signalLabel: row.signal_label,
    actionBias: row.action_bias,
    primaryStructure: row.primary_structure,
    secondaryStructures: row.secondary_structures ?? [],
    detectedRiskTypes: row.detected_risk_types ?? [],
    factors: row.factors ?? {},
    nextConfirmation: row.next_confirmation,
    invalidation: row.invalidation,
    rawMetrics: row.raw_metrics ?? {},
    scoringVersion: row.scoring_version,
    scannerVersion: row.scanner_version,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function toNullableNumber(value: number | string | null) {
  return value === null ? null : Number(value);
}
