import type { Pool } from "pg";
import {
  isSymbolAssetClass,
  type SymbolAssetClass,
  type SymbolAssetClassFilter,
} from "@/lib/market-data/symbolClassification";
import type { ScanResult } from "@/lib/scanner/types";
import { SCORING_VERSION } from "@/lib/scanner/scoring";
import { createPostgresPool } from "./pool";

export const PG_SCANNER_VERSION = "pg-scanner-v1";
export const LATEST_SCAN_FULL_UNIVERSE_MIN_SYMBOLS = 300;
export const HISTORICAL_SNAPSHOT_OBSERVATION_WINDOWS = [1, 3, 5, 10] as const;

export type HistoricalSnapshotObservationWindow =
  (typeof HISTORICAL_SNAPSHOT_OBSERVATION_WINDOWS)[number];
export type HistoricalSnapshotObservationAnchorSource =
  | "stored_signal"
  | "nearest_prior_candle"
  | "unavailable";
export type HistoricalSnapshotObservationDataStatus =
  | "complete"
  | "partial"
  | "missing";
export type HistoricalSnapshotObservationMissingReason =
  | "missing_anchor"
  | "no_future_candles"
  | "insufficient_future_candles"
  | "run_after_latest_candle";

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

export type LatestScanSignalRecord = ScanSignalRecord & {
  assetClass: SymbolAssetClass;
  isScannerEligible: boolean;
  isBacktestEligible: boolean;
  isMarketContext: boolean;
  candleCount: number;
  firstOpenTime: string | null;
};

export type HistoricalSnapshotObservationRecord = LatestScanSignalRecord & {
  anchorTime: string | null;
  anchorClose: number | null;
  anchorSource: HistoricalSnapshotObservationAnchorSource;
  window: HistoricalSnapshotObservationWindow;
  observedClose: number | null;
  observedChangePct: number | null;
  maxDrawdownPct: number | null;
  dataStatus: HistoricalSnapshotObservationDataStatus;
  missingReason: HistoricalSnapshotObservationMissingReason | null;
  forwardCandlesAvailable: number;
  latestMarketOpenTime: string | null;
};

export type HistoricalSnapshotObservationsResult = {
  run: ScanRunRecord | null;
  rows: HistoricalSnapshotObservationRecord[];
};

export type HistoricalObservationMarketCandleCoverageBucket = {
  latestOpenTime: string | null;
  symbolCount: number;
};

export type HistoricalObservationMarketCandleCoverage = {
  timeframe: string;
  assetClass: SymbolAssetClassFilter;
  totalSymbols: number;
  symbolsWithCandles: number;
  latestOpenTime: string | null;
  latestOpenTimeSymbolCount: number;
  buckets: HistoricalObservationMarketCandleCoverageBucket[];
};

export function isLikelyFullUniverseRun({
  run,
  assetClass,
  minExpectedSymbols = LATEST_SCAN_FULL_UNIVERSE_MIN_SYMBOLS,
}: {
  run: ScanRunRecord;
  assetClass: SymbolAssetClassFilter;
  minExpectedSymbols?: number;
}) {
  if (assetClass !== "crypto") {
    return true;
  }

  const paramsAssetClass =
    typeof run.params.assetClass === "string"
      ? run.params.assetClass.toLowerCase()
      : null;
  const paramsAllSymbols =
    typeof run.params.allSymbols === "boolean"
      ? run.params.allSymbols
      : typeof run.params.allSymbols === "string"
        ? run.params.allSymbols.toLowerCase() === "true"
        : null;
  const hasFullUniverseIntent =
    paramsAllSymbols === true ||
    (paramsAllSymbols === null && run.universe === "all-symbols");
  const coveredSymbols = Math.max(
    run.symbolsTotal,
    run.symbolsScanned,
    run.symbolsScanned + run.symbolsSkipped,
  );
  const hasFullSymbolCount = coveredSymbols >= minExpectedSymbols;

  return (
    hasFullSymbolCount &&
    hasFullUniverseIntent &&
    (paramsAssetClass === null || paramsAssetClass === assetClass) &&
    (paramsAllSymbols === null || paramsAllSymbols)
  );
}

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

type LatestScanSignalRow = ScanSignalRow & {
  asset_class: string | null;
  is_scanner_eligible: boolean | null;
  is_backtest_eligible: boolean | null;
  is_market_context: boolean | null;
  candle_count: string | null;
  first_open_time: Date | string | null;
};

type HistoricalSnapshotObservationRow = LatestScanSignalRow & {
  anchor_time: Date | string | null;
  anchor_close: number | string | null;
  anchor_source: string | null;
  latest_market_open_time: Date | string | null;
  forward_candles: unknown;
};

type HistoricalSnapshotForwardCandle = {
  close: number;
  low: number;
};

type HistoricalObservationMarketCandleCoverageRow = {
  latest_open_time: Date | string | null;
  symbol_count: string;
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
            bullish: result.bullishObservations,
            bearish: result.bearishObservations,
            risk: result.riskObservations,
            neutral: result.neutralObservations,
            phase: result.phase,
            signal: result.signal,
          }),
          JSON.stringify(result.nextConfirmationObservations),
          JSON.stringify(result.invalidationObservations),
          JSON.stringify(result.rawMetrics),
          SCORING_VERSION,
          PG_SCANNER_VERSION,
        ],
      );
    }
  }

  async getLatestScanRun({
    timeframe,
    preferFullUniverse = false,
    assetClass = "all",
    minExpectedSymbols = LATEST_SCAN_FULL_UNIVERSE_MIN_SYMBOLS,
  }: {
    timeframe: string;
    preferFullUniverse?: boolean;
    assetClass?: SymbolAssetClassFilter;
    minExpectedSymbols?: number;
  }) {
    if (preferFullUniverse && assetClass === "crypto") {
      const fullUniverseResult = await this.pool.query<ScanRunRow>(
        `
          SELECT *
          FROM scan_runs
          WHERE timeframe = $1
            AND status = 'success'
            AND (
              symbols_total >= $2
              OR symbols_scanned >= $2
              OR symbols_scanned + symbols_skipped >= $2
            )
            AND (
              NOT (params ? 'assetClass')
              OR lower(params->>'assetClass') = $3
            )
            AND (
              universe = 'all-symbols'
              OR lower(params->>'allSymbols') = 'true'
            )
          ORDER BY finished_at DESC NULLS LAST, started_at DESC
          LIMIT 1
        `,
        [timeframe, minExpectedSymbols, assetClass],
      );

      if (fullUniverseResult.rows[0]) {
        return toScanRunRecord(fullUniverseResult.rows[0]);
      }
    }

    const result = await this.pool.query<ScanRunRow>(
      `
        SELECT *
        FROM scan_runs
        WHERE timeframe = $1
          AND status = 'success'
        ORDER BY finished_at DESC NULLS LAST, started_at DESC
        LIMIT 1
      `,
      [timeframe],
    );

    return result.rows[0] ? toScanRunRecord(result.rows[0]) : null;
  }

  async listLatestScanSignalsForRun({
    scanRunId,
    timeframe,
    assetClass = "all",
    includeNonScanner = false,
    includeMarketContext = false,
  }: {
    scanRunId: string;
    timeframe: string;
    assetClass?: SymbolAssetClassFilter;
    includeNonScanner?: boolean;
    includeMarketContext?: boolean;
  }): Promise<LatestScanSignalRecord[]> {
    const params: unknown[] = [scanRunId, timeframe];
    const filters = ["ss.scan_run_id = $1", "ss.timeframe = $2"];

    if (assetClass !== "all") {
      params.push(assetClass);
      filters.push(`s.asset_class = $${params.length}`);
    }

    if (!includeNonScanner) {
      filters.push("s.is_scanner_eligible = true");
    }

    if (!includeMarketContext) {
      filters.push("s.is_market_context = false");
    }

    const result = await this.pool.query<LatestScanSignalRow>(
      `
        WITH filtered_signals AS (
          SELECT
            ss.*,
            s.asset_class,
            s.is_scanner_eligible,
            s.is_backtest_eligible,
            s.is_market_context
          FROM scan_signals ss
          JOIN symbols s
            ON s.id = ss.symbol_id
          WHERE ${filters.join("\n            AND ")}
        ),
        filtered_symbols AS (
          SELECT DISTINCT symbol_id
          FROM filtered_signals
        ),
        coverage AS (
          SELECT
            mc.symbol_id,
            COUNT(*) AS candle_count,
            MIN(mc.open_time) AS first_open_time
          FROM market_candles mc
          JOIN filtered_symbols fs
            ON fs.symbol_id = mc.symbol_id
          WHERE mc.timeframe = $2
          GROUP BY mc.symbol_id
        )
        SELECT
          filtered_signals.*,
          COALESCE(coverage.candle_count, 0) AS candle_count,
          coverage.first_open_time
        FROM filtered_signals
        LEFT JOIN coverage
          ON coverage.symbol_id = filtered_signals.symbol_id
        ORDER BY filtered_signals.symbol ASC
      `,
      params,
    );

    return result.rows.map(toLatestScanSignalRecord);
  }

  async listHistoricalScanRuns({
    timeframe,
    assetClass = "crypto",
    limit = 25,
  }: {
    timeframe: string;
    assetClass?: SymbolAssetClassFilter;
    limit?: number;
  }) {
    const params: unknown[] = [timeframe, limit];
    const filters = ["sr.timeframe = $1", "sr.status = 'success'"];

    if (assetClass !== "all") {
      params.push(assetClass);
      filters.push(`
        (
          lower(sr.params->>'assetClass') = $${params.length}
          OR (
            NOT (sr.params ? 'assetClass')
            AND EXISTS (
              SELECT 1
              FROM scan_signals ss
              JOIN symbols s
                ON s.id = ss.symbol_id
              WHERE ss.scan_run_id = sr.id
                AND ss.timeframe = sr.timeframe
                AND s.asset_class = $${params.length}
            )
          )
        )
      `);
    }

    const result = await this.pool.query<ScanRunRow>(
      `
        SELECT sr.*
        FROM scan_runs sr
        WHERE ${filters.join("\n          AND ")}
        ORDER BY sr.finished_at DESC NULLS LAST, sr.started_at DESC
        LIMIT $2
      `,
      params,
    );

    return result.rows.map(toScanRunRecord);
  }

  async getHistoricalScanRun({
    scanRunId,
    timeframe,
    assetClass = "crypto",
  }: {
    scanRunId: string;
    timeframe?: string;
    assetClass?: SymbolAssetClassFilter;
  }) {
    const params: unknown[] = [scanRunId];
    const filters = ["sr.id = $1", "sr.status = 'success'"];

    if (timeframe) {
      params.push(timeframe);
      filters.push(`sr.timeframe = $${params.length}`);
    }

    if (assetClass !== "all") {
      params.push(assetClass);
      filters.push(`
        (
          lower(sr.params->>'assetClass') = $${params.length}
          OR (
            NOT (sr.params ? 'assetClass')
            AND EXISTS (
              SELECT 1
              FROM scan_signals ss
              JOIN symbols s
                ON s.id = ss.symbol_id
              WHERE ss.scan_run_id = sr.id
                AND ss.timeframe = sr.timeframe
                AND s.asset_class = $${params.length}
            )
          )
        )
      `);
    }

    const result = await this.pool.query<ScanRunRow>(
      `
        SELECT sr.*
        FROM scan_runs sr
        WHERE ${filters.join("\n          AND ")}
        LIMIT 1
      `,
      params,
    );

    return result.rows[0] ? toScanRunRecord(result.rows[0]) : null;
  }

  async getHistoricalSnapshotObservations({
    scanRunId,
    timeframe,
    assetClass = "crypto",
    window,
  }: {
    scanRunId: string;
    timeframe?: string;
    assetClass?: SymbolAssetClassFilter;
    window: number;
  }): Promise<HistoricalSnapshotObservationsResult> {
    const observationWindow = normalizeHistoricalSnapshotObservationWindow(window);

    if (observationWindow === null) {
      throw new Error("INVALID_OBSERVATION_WINDOW");
    }

    const run = await this.getHistoricalScanRun({
      scanRunId,
      timeframe,
      assetClass,
    });

    if (!run) {
      return { run: null, rows: [] };
    }

    const rows = await this.listHistoricalSnapshotObservationsForRun({
      scanRunId: run.id,
      timeframe: run.timeframe,
      assetClass,
      window: observationWindow,
    });

    return { run, rows };
  }

  async getHistoricalObservationMarketCandleCoverage({
    timeframe,
    assetClass = "crypto",
    includeNonScanner = false,
    includeMarketContext = false,
  }: {
    timeframe: string;
    assetClass?: SymbolAssetClassFilter;
    includeNonScanner?: boolean;
    includeMarketContext?: boolean;
  }): Promise<HistoricalObservationMarketCandleCoverage> {
    const params: unknown[] = [timeframe];
    const filters = [
      "s.exchange = 'binance'",
      "s.market = 'spot'",
      "s.is_enabled = true",
    ];

    if (assetClass !== "all") {
      params.push(assetClass);
      filters.push(`s.asset_class = $${params.length}`);
    }

    if (!includeNonScanner) {
      filters.push("s.is_scanner_eligible = true");
    }

    if (!includeMarketContext) {
      filters.push("s.is_market_context = false");
    }

    const result =
      await this.pool.query<HistoricalObservationMarketCandleCoverageRow>(
        `
          SELECT
            latest.latest_open_time,
            COUNT(*) AS symbol_count
          FROM symbols s
          LEFT JOIN LATERAL (
            SELECT c.open_time AS latest_open_time
            FROM market_candles c
            WHERE c.symbol_id = s.id
              AND c.exchange = s.exchange
              AND c.market = s.market
              AND c.timeframe = $1
            ORDER BY c.open_time DESC
            LIMIT 1
          ) latest
            ON true
          WHERE ${filters.join("\n            AND ")}
          GROUP BY latest.latest_open_time
          ORDER BY latest.latest_open_time DESC NULLS LAST
        `,
        params,
      );

    return toHistoricalObservationMarketCandleCoverage({
      timeframe,
      assetClass,
      rows: result.rows,
    });
  }

  async listHistoricalSnapshotObservationsForRun({
    scanRunId,
    timeframe,
    assetClass = "crypto",
    includeNonScanner = false,
    includeMarketContext = false,
    window,
  }: {
    scanRunId: string;
    timeframe: string;
    assetClass?: SymbolAssetClassFilter;
    includeNonScanner?: boolean;
    includeMarketContext?: boolean;
    window: number;
  }): Promise<HistoricalSnapshotObservationRecord[]> {
    const observationWindow = normalizeHistoricalSnapshotObservationWindow(window);

    if (observationWindow === null) {
      throw new Error("INVALID_OBSERVATION_WINDOW");
    }

    const params: unknown[] = [scanRunId, timeframe, observationWindow];
    const filters = ["ss.scan_run_id = $1", "ss.timeframe = $2"];

    if (assetClass !== "all") {
      params.push(assetClass);
      filters.push(`s.asset_class = $${params.length}`);
    }

    if (!includeNonScanner) {
      filters.push("s.is_scanner_eligible = true");
    }

    if (!includeMarketContext) {
      filters.push("s.is_market_context = false");
    }

    const result = await this.pool.query<HistoricalSnapshotObservationRow>(
      `
        SELECT
          ss.*,
          s.asset_class,
          s.is_scanner_eligible,
          s.is_backtest_eligible,
          s.is_market_context,
          COALESCE(coverage.candle_count, 0) AS candle_count,
          coverage.first_open_time,
          observation_anchor.anchor_time,
          observation_anchor.anchor_close,
          observation_anchor.anchor_source,
          latest_market.latest_market_open_time,
          COALESCE(forward.forward_candles, '[]'::jsonb) AS forward_candles
        FROM scan_signals ss
        JOIN symbols s
          ON s.id = ss.symbol_id
        LEFT JOIN (
          SELECT
            symbol_id,
            COUNT(*) AS candle_count,
            MIN(open_time) AS first_open_time
          FROM market_candles
          WHERE timeframe = $2
            AND symbol_id IN (
              SELECT symbol_id
              FROM scan_signals
              WHERE scan_run_id = $1
            )
          GROUP BY symbol_id
        ) coverage
          ON coverage.symbol_id = ss.symbol_id
        LEFT JOIN LATERAL (
          SELECT c.open_time, c.close
          FROM market_candles c
          WHERE c.symbol_id = ss.symbol_id
            AND c.exchange = ss.exchange
            AND c.market = ss.market
            AND c.timeframe = ss.timeframe
            AND c.open_time <= COALESCE(ss.candle_open_time, ss.scan_time)
          ORDER BY c.open_time DESC
          LIMIT 1
        ) nearest_prior
          ON true
        LEFT JOIN LATERAL (
          SELECT
            CASE
              WHEN ss.candle_open_time IS NOT NULL
                AND ss.price_at_signal IS NOT NULL
                AND ss.price_at_signal > 0
                THEN ss.candle_open_time
              WHEN nearest_prior.open_time IS NOT NULL
                AND nearest_prior.close > 0
                THEN nearest_prior.open_time
              ELSE NULL
            END AS anchor_time,
            CASE
              WHEN ss.candle_open_time IS NOT NULL
                AND ss.price_at_signal IS NOT NULL
                AND ss.price_at_signal > 0
                THEN ss.price_at_signal
              WHEN nearest_prior.open_time IS NOT NULL
                AND nearest_prior.close > 0
                THEN nearest_prior.close
              ELSE NULL
            END AS anchor_close,
            CASE
              WHEN ss.candle_open_time IS NOT NULL
                AND ss.price_at_signal IS NOT NULL
                AND ss.price_at_signal > 0
                THEN 'stored_signal'
              WHEN nearest_prior.open_time IS NOT NULL
                AND nearest_prior.close > 0
                THEN 'nearest_prior_candle'
              ELSE 'unavailable'
            END AS anchor_source
        ) observation_anchor
          ON true
        LEFT JOIN LATERAL (
          SELECT c.open_time AS latest_market_open_time
          FROM market_candles c
          WHERE c.symbol_id = ss.symbol_id
            AND c.exchange = ss.exchange
            AND c.market = ss.market
            AND c.timeframe = ss.timeframe
          ORDER BY c.open_time DESC
          LIMIT 1
        ) latest_market
          ON true
        LEFT JOIN LATERAL (
          SELECT jsonb_agg(
            jsonb_build_object(
              'close', forward_candle.close,
              'low', forward_candle.low
            )
            ORDER BY forward_candle.open_time ASC
          ) AS forward_candles
          FROM (
            SELECT c.open_time, c.close, c.low
            FROM market_candles c
            WHERE c.symbol_id = ss.symbol_id
              AND c.exchange = ss.exchange
              AND c.market = ss.market
              AND c.timeframe = ss.timeframe
              AND observation_anchor.anchor_time IS NOT NULL
              AND c.open_time > observation_anchor.anchor_time
            ORDER BY c.open_time ASC
            LIMIT $3
          ) forward_candle
        ) forward
          ON true
        WHERE ${filters.join("\n          AND ")}
        ORDER BY ss.symbol ASC
      `,
      params,
    );

    return result.rows.map((row) =>
      toHistoricalSnapshotObservationRecord(row, observationWindow),
    );
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

function toLatestScanSignalRecord(row: LatestScanSignalRow): LatestScanSignalRecord {
  const signal = toScanSignalRecord(row);

  return {
    ...signal,
    assetClass: isSymbolAssetClass(row.asset_class) ? row.asset_class : "crypto",
    isScannerEligible: row.is_scanner_eligible ?? true,
    isBacktestEligible: row.is_backtest_eligible ?? true,
    isMarketContext: row.is_market_context ?? false,
    candleCount: Number(row.candle_count ?? 0),
    firstOpenTime: row.first_open_time
      ? new Date(row.first_open_time).toISOString()
      : null,
  };
}

function toHistoricalSnapshotObservationRecord(
  row: HistoricalSnapshotObservationRow,
  window: HistoricalSnapshotObservationWindow,
): HistoricalSnapshotObservationRecord {
  const signal = toLatestScanSignalRecord(row);
  const anchorTime = row.anchor_time ? new Date(row.anchor_time).toISOString() : null;
  const anchorClose = toNullableNumber(row.anchor_close);
  const anchorSource = toHistoricalSnapshotObservationAnchorSource(
    row.anchor_source,
  );
  const latestMarketOpenTime = row.latest_market_open_time
    ? new Date(row.latest_market_open_time).toISOString()
    : null;
  const forwardCandles = parseHistoricalSnapshotForwardCandles(
    row.forward_candles,
  );
  const observation = calculateHistoricalSnapshotObservation({
    anchorTime,
    anchorClose,
    anchorSource,
    latestMarketOpenTime,
    forwardCandles,
    window,
  });

  return {
    ...signal,
    anchorTime,
    anchorClose,
    anchorSource,
    window,
    ...observation,
    forwardCandlesAvailable: forwardCandles.length,
    latestMarketOpenTime,
  };
}

function calculateHistoricalSnapshotObservation({
  anchorTime,
  anchorClose,
  anchorSource,
  latestMarketOpenTime,
  forwardCandles,
  window,
}: {
  anchorTime: string | null;
  anchorClose: number | null;
  anchorSource: HistoricalSnapshotObservationAnchorSource;
  latestMarketOpenTime: string | null;
  forwardCandles: HistoricalSnapshotForwardCandle[];
  window: HistoricalSnapshotObservationWindow;
}) {
  if (anchorSource === "unavailable" || anchorClose === null || anchorClose <= 0) {
    return {
      observedClose: null,
      observedChangePct: null,
      maxDrawdownPct: null,
      dataStatus: "missing" as const,
      missingReason: "missing_anchor" as const,
    };
  }

  if (forwardCandles.length === 0) {
    const anchorMs = anchorTime ? Date.parse(anchorTime) : Number.NaN;
    const latestMarketMs = latestMarketOpenTime
      ? Date.parse(latestMarketOpenTime)
      : Number.NaN;

    return {
      observedClose: null,
      observedChangePct: null,
      maxDrawdownPct: null,
      dataStatus: "missing" as const,
      missingReason:
        Number.isFinite(anchorMs) &&
        Number.isFinite(latestMarketMs) &&
        latestMarketMs <= anchorMs
          ? ("run_after_latest_candle" as const)
          : ("no_future_candles" as const),
    };
  }

  const observedCandle =
    forwardCandles[Math.min(window, forwardCandles.length) - 1] ?? null;
  const observedClose = observedCandle?.close ?? null;
  const observedChangePct =
    observedClose === null
      ? null
      : roundObservationPercent(((observedClose - anchorClose) / anchorClose) * 100);
  const lowestAvailableLow = Math.min(
    ...forwardCandles.map((candle) => candle.low),
  );
  const maxDrawdownPct = Number.isFinite(lowestAvailableLow)
    ? roundObservationPercent(((lowestAvailableLow - anchorClose) / anchorClose) * 100)
    : null;

  if (forwardCandles.length < window) {
    return {
      observedClose,
      observedChangePct,
      maxDrawdownPct,
      dataStatus: "partial" as const,
      missingReason: "insufficient_future_candles" as const,
    };
  }

  return {
    observedClose,
    observedChangePct,
    maxDrawdownPct,
    dataStatus: "complete" as const,
    missingReason: null,
  };
}

function parseHistoricalSnapshotForwardCandles(
  value: unknown,
): HistoricalSnapshotForwardCandle[] {
  const raw = typeof value === "string" ? safeParseJson(value) : value;

  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const close = toNullableNumber(
        "close" in item
          ? (item.close as number | string | null)
          : null,
      );
      const low = toNullableNumber(
        "low" in item
          ? (item.low as number | string | null)
          : null,
      );

      if (close === null || close <= 0) {
        return null;
      }

      return {
        close,
        low: low === null || low <= 0 ? close : low,
      };
    })
    .filter((item): item is HistoricalSnapshotForwardCandle => item !== null);
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function toHistoricalSnapshotObservationAnchorSource(
  value: string | null,
): HistoricalSnapshotObservationAnchorSource {
  if (value === "stored_signal" || value === "nearest_prior_candle") {
    return value;
  }

  return "unavailable";
}

function toHistoricalObservationMarketCandleCoverage({
  timeframe,
  assetClass,
  rows,
}: {
  timeframe: string;
  assetClass: SymbolAssetClassFilter;
  rows: HistoricalObservationMarketCandleCoverageRow[];
}): HistoricalObservationMarketCandleCoverage {
  const buckets = rows.map((row) => ({
    latestOpenTime: row.latest_open_time
      ? new Date(row.latest_open_time).toISOString()
      : null,
    symbolCount: Number(row.symbol_count ?? 0),
  }));
  const totalSymbols = buckets.reduce(
    (total, bucket) => total + bucket.symbolCount,
    0,
  );
  const symbolsWithCandles = buckets.reduce(
    (total, bucket) =>
      total + (bucket.latestOpenTime === null ? 0 : bucket.symbolCount),
    0,
  );
  const latestBucket =
    buckets.find((bucket) => bucket.latestOpenTime !== null) ?? null;

  return {
    timeframe,
    assetClass,
    totalSymbols,
    symbolsWithCandles,
    latestOpenTime: latestBucket?.latestOpenTime ?? null,
    latestOpenTimeSymbolCount: latestBucket?.symbolCount ?? 0,
    buckets,
  };
}

export function normalizeHistoricalSnapshotObservationWindow(
  value: number,
): HistoricalSnapshotObservationWindow | null {
  const parsed = Math.trunc(value);

  return HISTORICAL_SNAPSHOT_OBSERVATION_WINDOWS.includes(
    parsed as HistoricalSnapshotObservationWindow,
  )
    ? (parsed as HistoricalSnapshotObservationWindow)
    : null;
}

function roundObservationPercent(value: number) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

function toNullableNumber(value: number | string | null) {
  return value === null ? null : Number(value);
}
