import type { Pool } from "pg";
import {
  isSymbolAssetClass,
  type SymbolAssetClass,
  type SymbolAssetClassFilter,
} from "@/lib/market-data/symbolClassification";
import {
  LATEST_SCAN_FULL_UNIVERSE_MIN_SYMBOLS,
  PgScannerResultsStore,
  type LatestScanSignalRecord,
  type ScanRunRecord,
} from "./scannerResultsPg";
import {
  loadSymbolBehaviorPg,
  type LoadSymbolBehaviorPgInput,
  type SymbolBehaviorLoadResult,
} from "./symbolBehaviorPg";
import { createPostgresPool } from "./pool";

export type SymbolResearchSymbolRecord = {
  id: number;
  exchange: string;
  market: string;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
  quoteVolume: number | null;
  priceChangePercent: number | null;
  isEnabled: boolean;
  assetClass: SymbolAssetClass;
  isScannerEligible: boolean;
  isBacktestEligible: boolean;
  isMarketContext: boolean;
  metadata: Record<string, unknown>;
  updatedAt: string;
};

export type SymbolResearchSignalRecord = LatestScanSignalRecord & {
  scanRunStartedAt: string | null;
  scanRunFinishedAt: string | null;
  scanRunSymbolsTotal: number | null;
  scanRunSymbolsScanned: number | null;
  scanRunSignalsCreated: number | null;
  scanRunParams: Record<string, unknown>;
};

export type SymbolResearchCandleRecord = {
  id: number;
  symbolId: number;
  exchange: string;
  market: string;
  symbol: string;
  timeframe: string;
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume: number | null;
};

export type SymbolResearchCandleCoverageRecord = {
  exchange: string;
  market: string;
  symbol: string;
  timeframe: string;
  candleCount: number;
  firstOpenTime: string | null;
  lastOpenTime: string | null;
};

export type SymbolResearchLatestSignalResult = {
  symbol: SymbolResearchSymbolRecord | null;
  scanRun: ScanRunRecord | null;
  signal: SymbolResearchSignalRecord | null;
};

type SymbolResearchIdentity = {
  exchange: string;
  market: string;
  symbol: string;
};

type SymbolResearchSignalFilters = SymbolResearchIdentity & {
  timeframe: string;
  assetClass?: SymbolAssetClassFilter;
  includeNonScanner?: boolean;
  includeMarketContext?: boolean;
};

type SymbolRow = {
  id: string;
  exchange: string;
  market: string;
  symbol: string;
  base_asset: string;
  quote_asset: string;
  status: string;
  quote_volume: number | string | null;
  price_change_percent: number | string | null;
  is_enabled: boolean;
  asset_class: string | null;
  is_scanner_eligible: boolean | null;
  is_backtest_eligible: boolean | null;
  is_market_context: boolean | null;
  metadata: Record<string, unknown>;
  updated_at: Date | string;
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
  secondary_structures: unknown[] | null;
  detected_risk_types: unknown[] | null;
  factors: Record<string, unknown> | null;
  next_confirmation: unknown;
  invalidation: unknown;
  raw_metrics: Record<string, unknown> | null;
  scoring_version: string | null;
  scanner_version: string | null;
  created_at: Date | string;
  scan_run_started_at?: Date | string | null;
  scan_run_finished_at?: Date | string | null;
  scan_run_symbols_total?: number | string | null;
  scan_run_symbols_scanned?: number | string | null;
  scan_run_signals_created?: number | string | null;
  scan_run_params?: Record<string, unknown> | null;
  asset_class: string | null;
  is_scanner_eligible: boolean | null;
  is_backtest_eligible: boolean | null;
  is_market_context: boolean | null;
  candle_count: string | null;
  first_open_time: Date | string | null;
};

type CandleRow = {
  id: string;
  symbol_id: string;
  exchange: string;
  market: string;
  symbol: string;
  timeframe: string;
  open_time_ms: string;
  close_time_ms: string;
  open: number | string;
  high: number | string;
  low: number | string;
  close: number | string;
  volume: number | string;
  quote_volume: number | string | null;
};

type CandleCoverageRow = {
  candle_count: string;
  first_open_time: Date | string | null;
  last_open_time: Date | string | null;
};

export class PgSymbolResearchStore {
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

  async getSymbolResearchLatestSignalPg({
    exchange,
    market,
    symbol,
    timeframe,
    assetClass = "crypto",
    includeNonScanner = false,
    includeMarketContext = false,
  }: SymbolResearchSignalFilters): Promise<SymbolResearchLatestSignalResult> {
    const symbolRecord = await this.getSymbol({ exchange, market, symbol });

    if (!symbolRecord) {
      return { symbol: null, scanRun: null, signal: null };
    }

    const scannerStore = new PgScannerResultsStore(this.pool);
    const preferFullUniverse = assetClass === "crypto" && !includeNonScanner;
    const scanRun = await scannerStore.getLatestScanRun({
      timeframe,
      assetClass,
      preferFullUniverse,
      minExpectedSymbols: LATEST_SCAN_FULL_UNIVERSE_MIN_SYMBOLS,
    });

    if (!scanRun) {
      return { symbol: symbolRecord, scanRun: null, signal: null };
    }

    const signal = await this.getSignalForScanRun({
      scanRunId: scanRun.id,
      exchange,
      market,
      symbol,
      timeframe,
      assetClass,
      includeNonScanner,
      includeMarketContext,
    });

    return { symbol: symbolRecord, scanRun, signal };
  }

  async getSymbolSignalHistoryPg({
    exchange,
    market,
    symbol,
    timeframe,
    historyLimit = 30,
    assetClass = "crypto",
    includeNonScanner = false,
    includeMarketContext = false,
  }: SymbolResearchSignalFilters & {
    historyLimit?: number;
  }): Promise<SymbolResearchSignalRecord[]> {
    const params: unknown[] = [
      exchange.toLowerCase(),
      market.toLowerCase(),
      symbol.toUpperCase(),
      timeframe,
    ];
    const filters = [
      "s.exchange = $1",
      "s.market = $2",
      "s.symbol = $3",
      "ss.timeframe = $4",
    ];

    addSignalEligibilityFilters({
      filters,
      params,
      assetClass,
      includeNonScanner,
      includeMarketContext,
    });

    params.push(historyLimit);

    const result = await this.pool.query<ScanSignalRow>(
      `
        ${selectSignalWithSymbolCoverageSql()}
        WHERE ${filters.join("\n          AND ")}
        ORDER BY ss.scan_time DESC, ss.created_at DESC, ss.symbol ASC
        LIMIT $${params.length}
      `,
      params,
    );

    return result.rows.map(toSymbolResearchSignalRecord);
  }

  async getSymbolLatestSignalsByTimeframesPg({
    exchange,
    market,
    symbol,
    timeframes,
    assetClass = "crypto",
    includeNonScanner = false,
    includeMarketContext = false,
  }: SymbolResearchIdentity & {
    timeframes: string[];
    assetClass?: SymbolAssetClassFilter;
    includeNonScanner?: boolean;
    includeMarketContext?: boolean;
  }): Promise<SymbolResearchSignalRecord[]> {
    if (timeframes.length === 0) {
      return [];
    }

    const params: unknown[] = [
      exchange.toLowerCase(),
      market.toLowerCase(),
      symbol.toUpperCase(),
      timeframes,
    ];
    const filters = [
      "s.exchange = $1",
      "s.market = $2",
      "s.symbol = $3",
      "ss.timeframe = ANY($4::text[])",
    ];

    addSignalEligibilityFilters({
      filters,
      params,
      assetClass,
      includeNonScanner,
      includeMarketContext,
    });

    const result = await this.pool.query<ScanSignalRow>(
      `
        SELECT *
        FROM (
          SELECT DISTINCT ON (ss.timeframe)
            ss.*,
            sr.started_at AS scan_run_started_at,
            sr.finished_at AS scan_run_finished_at,
            sr.symbols_total AS scan_run_symbols_total,
            sr.symbols_scanned AS scan_run_symbols_scanned,
            sr.signals_created AS scan_run_signals_created,
            sr.params AS scan_run_params,
            s.asset_class,
            s.is_scanner_eligible,
            s.is_backtest_eligible,
            s.is_market_context,
            COALESCE(coverage.candle_count, 0) AS candle_count,
            coverage.first_open_time
          FROM scan_signals ss
          JOIN scan_runs sr
            ON sr.id = ss.scan_run_id
          JOIN symbols s
            ON s.id = ss.symbol_id
          LEFT JOIN LATERAL (
            SELECT
              COUNT(*) AS candle_count,
              MIN(open_time) AS first_open_time
            FROM market_candles c
            WHERE c.symbol_id = s.id
              AND c.timeframe = ss.timeframe
          ) coverage
            ON true
          WHERE ${filters.join("\n            AND ")}
          ORDER BY ss.timeframe ASC, ss.scan_time DESC, ss.created_at DESC
        ) latest_by_timeframe
      `,
      params,
    );
    const timeframeOrder = new Map(
      timeframes.map((timeframe, index) => [timeframe, index]),
    );

    return result.rows
      .map(toSymbolResearchSignalRecord)
      .sort(
        (left, right) =>
          (timeframeOrder.get(left.timeframe) ?? Number.MAX_SAFE_INTEGER) -
          (timeframeOrder.get(right.timeframe) ?? Number.MAX_SAFE_INTEGER),
      );
  }

  async getSymbolCandlesPg({
    exchange,
    market,
    symbol,
    timeframe,
    candleLimit = 120,
  }: SymbolResearchIdentity & {
    timeframe: string;
    candleLimit?: number;
  }): Promise<SymbolResearchCandleRecord[]> {
    const result = await this.pool.query<CandleRow>(
      `
        SELECT
          id,
          symbol_id,
          exchange,
          market,
          symbol,
          timeframe,
          open_time_ms,
          close_time_ms,
          open,
          high,
          low,
          close,
          volume,
          quote_volume
        FROM (
          SELECT *
          FROM market_candles
          WHERE exchange = $1
            AND market = $2
            AND symbol = $3
            AND timeframe = $4
          ORDER BY open_time DESC
          LIMIT $5
        ) recent
        ORDER BY open_time_ms ASC
      `,
      [
        exchange.toLowerCase(),
        market.toLowerCase(),
        symbol.toUpperCase(),
        timeframe,
        candleLimit,
      ],
    );

    return result.rows.map(toSymbolResearchCandleRecord);
  }

  async getSymbolCandleCoveragePg({
    exchange,
    market,
    symbol,
    timeframe,
  }: SymbolResearchIdentity & {
    timeframe: string;
  }): Promise<SymbolResearchCandleCoverageRecord> {
    const result = await this.pool.query<CandleCoverageRow>(
      `
        SELECT
          COUNT(*) AS candle_count,
          MIN(open_time) AS first_open_time,
          MAX(open_time) AS last_open_time
        FROM market_candles
        WHERE exchange = $1
          AND market = $2
          AND symbol = $3
          AND timeframe = $4
      `,
      [
        exchange.toLowerCase(),
        market.toLowerCase(),
        symbol.toUpperCase(),
        timeframe,
      ],
    );

    return toSymbolResearchCandleCoverageRecord({
      row: result.rows[0],
      exchange: exchange.toLowerCase(),
      market: market.toLowerCase(),
      symbol: symbol.toUpperCase(),
      timeframe,
    });
  }

  async getSymbolBehaviorPg(
    input: LoadSymbolBehaviorPgInput,
  ): Promise<SymbolBehaviorLoadResult> {
    return loadSymbolBehaviorPg(this.pool, input);
  }

  private async getSymbol({
    exchange,
    market,
    symbol,
  }: SymbolResearchIdentity): Promise<SymbolResearchSymbolRecord | null> {
    const result = await this.pool.query<SymbolRow>(
      `
        SELECT *
        FROM symbols
        WHERE exchange = $1
          AND market = $2
          AND symbol = $3
        LIMIT 1
      `,
      [exchange.toLowerCase(), market.toLowerCase(), symbol.toUpperCase()],
    );

    return result.rows[0] ? toSymbolResearchSymbolRecord(result.rows[0]) : null;
  }

  private async getSignalForScanRun({
    scanRunId,
    exchange,
    market,
    symbol,
    timeframe,
    assetClass = "crypto",
    includeNonScanner = false,
    includeMarketContext = false,
  }: SymbolResearchSignalFilters & {
    scanRunId: string;
  }): Promise<SymbolResearchSignalRecord | null> {
    const params: unknown[] = [
      scanRunId,
      exchange.toLowerCase(),
      market.toLowerCase(),
      symbol.toUpperCase(),
      timeframe,
    ];
    const filters = [
      "ss.scan_run_id = $1",
      "s.exchange = $2",
      "s.market = $3",
      "s.symbol = $4",
      "ss.timeframe = $5",
    ];

    addSignalEligibilityFilters({
      filters,
      params,
      assetClass,
      includeNonScanner,
      includeMarketContext,
    });

    const result = await this.pool.query<ScanSignalRow>(
      `
        ${selectSignalWithSymbolCoverageSql()}
        WHERE ${filters.join("\n          AND ")}
        ORDER BY ss.symbol ASC
        LIMIT 1
      `,
      params,
    );

    return result.rows[0] ? toSymbolResearchSignalRecord(result.rows[0]) : null;
  }
}

function addSignalEligibilityFilters({
  filters,
  params,
  assetClass,
  includeNonScanner,
  includeMarketContext,
}: {
  filters: string[];
  params: unknown[];
  assetClass: SymbolAssetClassFilter;
  includeNonScanner: boolean;
  includeMarketContext: boolean;
}) {
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
}

function selectSignalWithSymbolCoverageSql() {
  return `
    SELECT
      ss.*,
      sr.started_at AS scan_run_started_at,
      sr.finished_at AS scan_run_finished_at,
      sr.symbols_total AS scan_run_symbols_total,
      sr.symbols_scanned AS scan_run_symbols_scanned,
      sr.signals_created AS scan_run_signals_created,
      sr.params AS scan_run_params,
      s.asset_class,
      s.is_scanner_eligible,
      s.is_backtest_eligible,
      s.is_market_context,
      COALESCE(coverage.candle_count, 0) AS candle_count,
      coverage.first_open_time
    FROM scan_signals ss
    JOIN scan_runs sr
      ON sr.id = ss.scan_run_id
    JOIN symbols s
      ON s.id = ss.symbol_id
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) AS candle_count,
        MIN(open_time) AS first_open_time
      FROM market_candles c
      WHERE c.symbol_id = s.id
        AND c.timeframe = ss.timeframe
    ) coverage
      ON true
  `;
}

function toSymbolResearchSymbolRecord(row: SymbolRow): SymbolResearchSymbolRecord {
  return {
    id: Number(row.id),
    exchange: row.exchange,
    market: row.market,
    symbol: row.symbol,
    baseAsset: row.base_asset,
    quoteAsset: row.quote_asset,
    status: row.status,
    quoteVolume: toNullableNumber(row.quote_volume),
    priceChangePercent: toNullableNumber(row.price_change_percent),
    isEnabled: row.is_enabled,
    assetClass: isSymbolAssetClass(row.asset_class) ? row.asset_class : "crypto",
    isScannerEligible: row.is_scanner_eligible ?? true,
    isBacktestEligible: row.is_backtest_eligible ?? true,
    isMarketContext: row.is_market_context ?? false,
    metadata: row.metadata ?? {},
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function toSymbolResearchSignalRecord(
  row: ScanSignalRow,
): SymbolResearchSignalRecord {
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
    scanRunStartedAt: row.scan_run_started_at
      ? new Date(row.scan_run_started_at).toISOString()
      : null,
    scanRunFinishedAt: row.scan_run_finished_at
      ? new Date(row.scan_run_finished_at).toISOString()
      : null,
    scanRunSymbolsTotal: toNullableNumber(row.scan_run_symbols_total ?? null),
    scanRunSymbolsScanned: toNullableNumber(row.scan_run_symbols_scanned ?? null),
    scanRunSignalsCreated: toNullableNumber(row.scan_run_signals_created ?? null),
    scanRunParams: row.scan_run_params ?? {},
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

function toSymbolResearchCandleRecord(row: CandleRow): SymbolResearchCandleRecord {
  return {
    id: Number(row.id),
    symbolId: Number(row.symbol_id),
    exchange: row.exchange,
    market: row.market,
    symbol: row.symbol,
    timeframe: row.timeframe,
    openTime: Number(row.open_time_ms),
    closeTime: Number(row.close_time_ms),
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
    volume: Number(row.volume),
    quoteVolume: toNullableNumber(row.quote_volume),
  };
}

function toSymbolResearchCandleCoverageRecord({
  row,
  exchange,
  market,
  symbol,
  timeframe,
}: {
  row: CandleCoverageRow | undefined;
  exchange: string;
  market: string;
  symbol: string;
  timeframe: string;
}): SymbolResearchCandleCoverageRecord {
  return {
    exchange,
    market,
    symbol,
    timeframe,
    candleCount: Number(row?.candle_count ?? 0),
    firstOpenTime: row?.first_open_time
      ? new Date(row.first_open_time).toISOString()
      : null,
    lastOpenTime: row?.last_open_time
      ? new Date(row.last_open_time).toISOString()
      : null,
  };
}

function toNullableNumber(value: number | string | null) {
  return value === null ? null : Number(value);
}
