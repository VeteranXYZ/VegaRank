import type { Pool } from "pg";
import type { SymbolAssetClassFilter } from "@/lib/market-data/symbolClassification";
import {
  classifyScanResultGroup,
  type ScanResultGroup,
} from "@/lib/scanner/scanResultGroups";
import { createPostgresPool } from "./pool";
import { currentScanSignalCodeContractCondition } from "./scannerResultsPg";

export const SYMBOL_BEHAVIOR_HORIZONS = [1, 3, 5] as const;
export const SYMBOL_BEHAVIOR_DEFAULT_LIMIT = 80;
export const SYMBOL_BEHAVIOR_RECENT_OUTCOME_LIMIT = 20;

export type SymbolBehaviorHorizonCandles =
  (typeof SYMBOL_BEHAVIOR_HORIZONS)[number];
export type SymbolBehaviorHorizonKey = "1" | "3" | "5";

export type SymbolBehaviorHorizonStats = {
  sampleSize: number;
  avgReturnPct: number | null;
  medianReturnPct: number | null;
  winRatePct: number | null;
  bestReturnPct: number | null;
  worstReturnPct: number | null;
};

export type SymbolBehaviorHorizonMap = Record<
  SymbolBehaviorHorizonKey,
  SymbolBehaviorHorizonStats | null
>;

export type SymbolBehaviorResultGroupStats = {
  resultGroup: string;
  sampleSize: number;
  horizons: SymbolBehaviorHorizonMap;
};

export type SymbolBehaviorSignalLabelStats = {
  signalLabel: string;
  sampleSize: number;
  horizons: SymbolBehaviorHorizonMap;
};

export type SymbolBehaviorRecentOutcome = {
  scanTime: string;
  resultGroup: string | null;
  signalLabel: string | null;
  rankScore: number | null;
  priceAtSignal: number | null;
  forwardReturnPct: Record<SymbolBehaviorHorizonKey, number | null>;
};

export type SymbolBehaviorCurrentContext = {
  resultGroup: string | null;
  signalLabel: string | null;
  primaryStructure: string | null;
  timeframe: string;
};

export type SymbolBehavior = {
  sampleSize: number;
  horizons: SymbolBehaviorHorizonMap;
  byResultGroup: SymbolBehaviorResultGroupStats[];
  bySignalLabel: SymbolBehaviorSignalLabelStats[];
  recentOutcomes: SymbolBehaviorRecentOutcome[];
  currentContext: SymbolBehaviorCurrentContext;
  warnings: string[];
};

export type SymbolBehaviorDiagnosticsReason =
  | "ok"
  | "no_prior_signals"
  | "missing_forward_candles"
  | "insufficient_sample"
  | "calculation_failed"
  | "no_latest_signal"
  | "unknown";

export type SymbolBehaviorDiagnostics = {
  available: boolean;
  reason: SymbolBehaviorDiagnosticsReason;
  message: string;
};

export type SymbolBehaviorLoadResult = {
  behavior: SymbolBehavior | null;
  behaviorDiagnostics: SymbolBehaviorDiagnostics;
};

export type SymbolBehaviorCurrentSignalInput = {
  id?: string | null;
  groupCode?: string | null;
  signalLabel?: string | null;
  actionBias?: string | null;
  primaryStructure?: string | null;
  rankScore?: number | null;
  riskScore?: number | null;
  detectedRiskTypes?: unknown[] | null;
};

export type LoadSymbolBehaviorPgInput = {
  exchange: string;
  market: string;
  symbol: string;
  timeframe: string;
  currentSignal?: SymbolBehaviorCurrentSignalInput | null;
  limit?: number;
  assetClass?: SymbolAssetClassFilter;
  includeNonScanner?: boolean;
  includeMarketContext?: boolean;
};

type SymbolBehaviorSignalRow = {
  id: string;
  scan_run_id: string;
  scan_time: Date | string;
  candle_open_time: Date | string | null;
  price_at_signal: number | string | null;
  rank_score: number | string | null;
  risk_score: number | string | null;
  group_code: string | null;
  signal_label: string | null;
  action_bias: string | null;
  primary_structure: string | null;
  detected_risk_types: unknown[] | null;
  anchor_open_time: Date | string | null;
  anchor_close: number | string | null;
  forward_candles: unknown;
};

type ForwardCandle = {
  close: number;
};

type HorizonOutcome = {
  returnPct: number;
};

type AnalyzedBehaviorOutcome = {
  resultGroup: ScanResultGroup;
  signalLabel: string | null;
  scanTime: string;
  rankScore: number | null;
  priceAtSignal: number | null;
  horizons: Record<SymbolBehaviorHorizonCandles, HorizonOutcome | null>;
};

export class PgSymbolBehaviorStore {
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

  async getSymbolBehaviorPg(input: LoadSymbolBehaviorPgInput) {
    return loadSymbolBehaviorPg(this.pool, input);
  }
}

export async function loadSymbolBehaviorPg(
  pool: Pool,
  input: LoadSymbolBehaviorPgInput,
): Promise<SymbolBehaviorLoadResult> {
  const rows = await loadSymbolBehaviorRowsPg(pool, input);
  const outcomes = rows
    .map(analyzeBehaviorRow)
    .sort(compareBehaviorOutcomeByScanTimeDesc);
  const currentContext = buildCurrentContext(input);

  if (outcomes.length === 0) {
    return {
      behavior: null,
      behaviorDiagnostics: {
        available: false,
        reason: "no_prior_signals",
        message:
          "Historical behavior is not available yet because no prior ranking results were found for this symbol/timeframe.",
      },
    };
  }

  const horizons = buildHorizonStats(outcomes);
  const usableSampleSize = getUsableSampleSize(horizons);

  if (usableSampleSize === 0) {
    return {
      behavior: null,
      behaviorDiagnostics: {
        available: false,
        reason: "missing_forward_candles",
        message:
          "Historical behavior is not available yet because prior signals do not have enough forward candles.",
      },
    };
  }

  return {
    behavior: {
      sampleSize: outcomes.length,
      horizons,
      byResultGroup: buildResultGroupStats(outcomes),
      bySignalLabel: buildSignalLabelStats(outcomes),
      recentOutcomes: outcomes
        .slice(0, SYMBOL_BEHAVIOR_RECENT_OUTCOME_LIMIT)
        .map(toRecentOutcome),
      currentContext,
      warnings: getBehaviorWarnings(usableSampleSize),
    },
    behaviorDiagnostics: {
      available: true,
      reason: "ok",
      message:
        "Historical behavior is available from prior ranking results with forward candles.",
    },
  };
}

async function loadSymbolBehaviorRowsPg(
  pool: Pool,
  {
    exchange,
    market,
    symbol,
    timeframe,
    currentSignal,
    limit = SYMBOL_BEHAVIOR_DEFAULT_LIMIT,
    assetClass = "crypto",
    includeNonScanner = false,
    includeMarketContext = false,
  }: LoadSymbolBehaviorPgInput,
) {
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
    "sr.status = 'success'",
    currentScanSignalCodeContractCondition("ss"),
  ];

  if (currentSignal?.id) {
    params.push(currentSignal.id);
    filters.push(`ss.id <> $${params.length}`);
  }

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

  params.push(Math.max(1, Math.min(limit, SYMBOL_BEHAVIOR_DEFAULT_LIMIT)));

  const result = await pool.query<SymbolBehaviorSignalRow>(
    `
      SELECT
        ss.id,
        ss.scan_run_id,
        ss.scan_time,
        ss.candle_open_time,
        ss.price_at_signal,
        ss.rank_score,
        ss.risk_score,
        ss.factors->>'groupCode' AS group_code,
        ss.signal_label,
        ss.action_bias,
        ss.primary_structure,
        ss.detected_risk_types,
        anchor.open_time AS anchor_open_time,
        anchor.close AS anchor_close,
        COALESCE(forward.forward_candles, '[]'::jsonb) AS forward_candles
      FROM scan_signals ss
      JOIN scan_runs sr
        ON sr.id = ss.scan_run_id
      JOIN symbols s
        ON s.id = ss.symbol_id
      LEFT JOIN LATERAL (
        SELECT
          c.open_time,
          c.close
        FROM market_candles c
        WHERE c.symbol_id = ss.symbol_id
          AND c.timeframe = ss.timeframe
          AND c.open_time <= COALESCE(ss.candle_open_time, ss.scan_time)
        ORDER BY c.open_time DESC
        LIMIT 1
      ) anchor
        ON true
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          jsonb_build_object('close', forward_candle.close)
          ORDER BY forward_candle.open_time ASC
        ) AS forward_candles
        FROM (
          SELECT
            c.open_time,
            c.close
          FROM market_candles c
          WHERE c.symbol_id = ss.symbol_id
            AND c.timeframe = ss.timeframe
            AND anchor.open_time IS NOT NULL
            AND c.open_time > anchor.open_time
          ORDER BY c.open_time ASC
          LIMIT 5
        ) forward_candle
      ) forward
        ON true
      WHERE ${filters.join("\n        AND ")}
      ORDER BY ss.scan_time DESC, ss.created_at DESC
      LIMIT $${params.length}
    `,
    params,
  );

  return result.rows;
}

function analyzeBehaviorRow(row: SymbolBehaviorSignalRow): AnalyzedBehaviorOutcome {
  const resultGroup = classifyScanResultGroup({
    groupCode: row.group_code,
    signalLabel: row.signal_label,
    actionBias: row.action_bias,
    primaryStructure: row.primary_structure,
    rankScore: toNullableNumber(row.rank_score),
    riskScore: toNullableNumber(row.risk_score),
    detectedRiskTypes: normalizeStringArray(row.detected_risk_types),
  });
  const basePrice = getBasePrice(row);
  const forwardCandles = parseForwardCandles(row.forward_candles);
  const horizons = Object.fromEntries(
    SYMBOL_BEHAVIOR_HORIZONS.map((horizon) => [
      horizon,
      getHorizonOutcome({ basePrice, forwardCandles, horizon }),
    ]),
  ) as Record<SymbolBehaviorHorizonCandles, HorizonOutcome | null>;

  return {
    resultGroup,
    signalLabel: row.signal_label,
    scanTime: toIsoString(row.scan_time),
    rankScore: toNullableNumber(row.rank_score),
    priceAtSignal: toNullableNumber(row.price_at_signal),
    horizons,
  };
}

function compareBehaviorOutcomeByScanTimeDesc(
  left: AnalyzedBehaviorOutcome,
  right: AnalyzedBehaviorOutcome,
) {
  return Date.parse(right.scanTime) - Date.parse(left.scanTime);
}

function buildResultGroupStats(
  outcomes: AnalyzedBehaviorOutcome[],
): SymbolBehaviorResultGroupStats[] {
  const byResultGroup = new Map<ScanResultGroup, AnalyzedBehaviorOutcome[]>();

  for (const outcome of outcomes) {
    byResultGroup.set(outcome.resultGroup, [
      ...(byResultGroup.get(outcome.resultGroup) ?? []),
      outcome,
    ]);
  }

  return [...byResultGroup.entries()].map(([resultGroup, groupOutcomes]) => ({
    resultGroup,
    sampleSize: groupOutcomes.length,
    horizons: buildHorizonStats(groupOutcomes),
  }));
}

function buildSignalLabelStats(
  outcomes: AnalyzedBehaviorOutcome[],
): SymbolBehaviorSignalLabelStats[] {
  const bySignalLabel = new Map<string, AnalyzedBehaviorOutcome[]>();

  for (const outcome of outcomes) {
    const signalLabel = outcome.signalLabel ?? "unknown";
    bySignalLabel.set(signalLabel, [
      ...(bySignalLabel.get(signalLabel) ?? []),
      outcome,
    ]);
  }

  return [...bySignalLabel.entries()].map(([signalLabel, signalOutcomes]) => ({
    signalLabel,
    sampleSize: signalOutcomes.length,
    horizons: buildHorizonStats(signalOutcomes),
  }));
}

function buildHorizonStats(
  outcomes: AnalyzedBehaviorOutcome[],
): SymbolBehaviorHorizonMap {
  return Object.fromEntries(
    SYMBOL_BEHAVIOR_HORIZONS.map((horizon) => [
      toHorizonKey(horizon),
      buildSingleHorizonStats(outcomes, horizon),
    ]),
  ) as SymbolBehaviorHorizonMap;
}

function buildSingleHorizonStats(
  outcomes: AnalyzedBehaviorOutcome[],
  horizon: SymbolBehaviorHorizonCandles,
) {
  const returns = outcomes
    .map((outcome) => outcome.horizons[horizon]?.returnPct ?? null)
    .filter((value): value is number => value !== null);

  if (returns.length === 0) {
    return null;
  }

  return {
    sampleSize: returns.length,
    avgReturnPct: average(returns),
    medianReturnPct: median(returns),
    winRatePct: getWinRate(returns),
    bestReturnPct: roundPercent(Math.max(...returns)),
    worstReturnPct: roundPercent(Math.min(...returns)),
  };
}

function buildCurrentContext({
  timeframe,
  currentSignal,
}: LoadSymbolBehaviorPgInput): SymbolBehaviorCurrentContext {
  const resultGroup = currentSignal
    ? classifyScanResultGroup({
        groupCode: currentSignal.groupCode,
        signalLabel: currentSignal.signalLabel,
        actionBias: currentSignal.actionBias,
        primaryStructure: currentSignal.primaryStructure,
        rankScore: currentSignal.rankScore,
        riskScore: currentSignal.riskScore,
        detectedRiskTypes: normalizeStringArray(currentSignal.detectedRiskTypes),
      })
    : null;

  return {
    resultGroup,
    signalLabel: currentSignal?.signalLabel ?? null,
    primaryStructure: currentSignal?.primaryStructure ?? null,
    timeframe,
  };
}

function toRecentOutcome(
  outcome: AnalyzedBehaviorOutcome,
): SymbolBehaviorRecentOutcome {
  return {
    scanTime: outcome.scanTime,
    resultGroup: outcome.resultGroup,
    signalLabel: outcome.signalLabel,
    rankScore: outcome.rankScore,
    priceAtSignal: outcome.priceAtSignal,
    forwardReturnPct: {
      "1": outcome.horizons[1]?.returnPct ?? null,
      "3": outcome.horizons[3]?.returnPct ?? null,
      "5": outcome.horizons[5]?.returnPct ?? null,
    },
  };
}

function getBehaviorWarnings(usableSampleSize: number) {
  if (usableSampleSize < 5) {
    return ["Very limited historical sample size."];
  }

  if (usableSampleSize < 10) {
    return ["Limited historical sample size."];
  }

  return [];
}

function getUsableSampleSize(horizons: SymbolBehaviorHorizonMap) {
  return Math.max(
    ...Object.values(horizons).map((horizon) => horizon?.sampleSize ?? 0),
  );
}

function getBasePrice(row: SymbolBehaviorSignalRow) {
  const signalPrice = toNullableNumber(row.price_at_signal);
  const anchorClose = toNullableNumber(row.anchor_close);

  if (signalPrice !== null && signalPrice > 0) {
    return signalPrice;
  }

  if (anchorClose !== null && anchorClose > 0) {
    return anchorClose;
  }

  return null;
}

function getHorizonOutcome({
  basePrice,
  forwardCandles,
  horizon,
}: {
  basePrice: number | null;
  forwardCandles: ForwardCandle[];
  horizon: SymbolBehaviorHorizonCandles;
}): HorizonOutcome | null {
  if (basePrice === null || forwardCandles.length < horizon) {
    return null;
  }

  const futureClose = forwardCandles[horizon - 1]?.close ?? null;

  if (futureClose === null) {
    return null;
  }

  return {
    returnPct: getReturnPct({ basePrice, futurePrice: futureClose }),
  };
}

function getReturnPct({
  basePrice,
  futurePrice,
}: {
  basePrice: number;
  futurePrice: number;
}) {
  return roundPercent(((futurePrice - basePrice) / basePrice) * 100);
}

function average(values: number[]) {
  return roundPercent(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return roundPercent(sorted[middle]);
  }

  return roundPercent((sorted[middle - 1] + sorted[middle]) / 2);
}

function getWinRate(values: number[]) {
  const wins = values.filter((value) => value > 0).length;

  return roundPercent((wins / values.length) * 100);
}

function parseForwardCandles(value: unknown): ForwardCandle[] {
  const parsed = typeof value === "string" ? safeJsonParse(value) : value;

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const close = toNullableNumber(record.close);

      return close === null ? null : { close };
    })
    .filter((item): item is ForwardCandle => item !== null);
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function toIsoString(value: Date | string) {
  return new Date(value).toISOString();
}

function toHorizonKey(horizon: SymbolBehaviorHorizonCandles) {
  return String(horizon) as SymbolBehaviorHorizonKey;
}

function roundPercent(value: number) {
  return Math.round((value + Number.EPSILON) * 10_000) / 10_000;
}
