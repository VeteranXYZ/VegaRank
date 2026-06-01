import type { Pool } from "pg";
import type { SymbolAssetClassFilter } from "@/lib/market-data/symbolClassification";
import {
  classifyScanResultGroup,
  type ScanResultGroup,
} from "@/lib/scanner/scanResultGroups";
import { createPostgresPool } from "./pool";

export const SYMBOL_BEHAVIOR_HORIZONS = [1, 3, 5] as const;
export const SYMBOL_BEHAVIOR_DEFAULT_LIMIT = 150;

export type SymbolBehaviorHorizonCandles =
  (typeof SYMBOL_BEHAVIOR_HORIZONS)[number];

export type SymbolBehaviorHorizonStats = {
  candles: SymbolBehaviorHorizonCandles;
  sampleSize: number;
  averageReturnPct: number | null;
  medianReturnPct: number | null;
  winRatePct: number | null;
  averageMaxUpsidePct: number | null;
  averageMaxDrawdownPct: number | null;
  bestReturnPct: number | null;
  worstReturnPct: number | null;
};

export type SymbolBehaviorGroupedStats = {
  group: string;
  sampleSize: number;
  horizons: SymbolBehaviorHorizonStats[];
};

export type SymbolBehaviorSignalLabelStats = {
  signalLabel: string;
  sampleSize: number;
  horizons: SymbolBehaviorHorizonStats[];
};

export type SymbolBehaviorRecentOutcome = {
  scanTime: string;
  candleOpenTime: string | null;
  signalLabel: string;
  resultGroup: string | null;
  actionBias: string | null;
  primaryStructure: string | null;
  priceAtSignal: number | null;
  rankScore: number | null;
  forwardReturnsPct: {
    next1: number | null;
    next3: number | null;
    next5: number | null;
  };
  maxUpsidePct: {
    next1: number | null;
    next3: number | null;
    next5: number | null;
  };
  maxDrawdownPct: {
    next1: number | null;
    next3: number | null;
    next5: number | null;
  };
  hasEnoughForwardCandles: boolean;
};

export type SymbolBehaviorCurrentContext = {
  currentSignalLabel: string | null;
  currentResultGroup: string | null;
  matchingGroupSampleSize: number;
  matchingSignalSampleSize: number;
  note: string;
};

export type SymbolBehaviorResult = {
  timeframe: string;
  symbol: string;
  sampleSize: number;
  eligibleSampleSize: number;
  horizons: SymbolBehaviorHorizonStats[];
  byGroup: SymbolBehaviorGroupedStats[];
  bySignalLabel: SymbolBehaviorSignalLabelStats[];
  recentOutcomes: SymbolBehaviorRecentOutcome[];
  currentContext?: SymbolBehaviorCurrentContext;
  warnings: string[];
};

export type SymbolBehaviorCurrentSignalInput = {
  id?: string | null;
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
  high: number;
  low: number;
};

type HorizonOutcome = {
  returnPct: number;
  maxUpsidePct: number;
  maxDrawdownPct: number;
};

type AnalyzedBehaviorOutcome = {
  resultGroup: ScanResultGroup;
  signalLabel: string;
  recentOutcome: SymbolBehaviorRecentOutcome;
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
): Promise<SymbolBehaviorResult> {
  const rows = await loadSymbolBehaviorRowsPg(pool, input);
  const outcomes = rows
    .map(analyzeBehaviorRow)
    .sort(compareBehaviorOutcomeByScanTimeDesc);
  const eligibleSampleSize = outcomes.filter(
    (outcome) => outcome.recentOutcome.hasEnoughForwardCandles,
  ).length;
  const byGroup = buildGroupedStats(outcomes);
  const bySignalLabel = buildSignalLabelStats(outcomes);
  const currentContext = buildCurrentContext({
    currentSignal: input.currentSignal,
    byGroup,
    bySignalLabel,
  });

  return {
    timeframe: input.timeframe,
    symbol: input.symbol.toUpperCase(),
    sampleSize: outcomes.length,
    eligibleSampleSize,
    horizons: buildHorizonStats(outcomes),
    byGroup,
    bySignalLabel,
    recentOutcomes: outcomes.map((outcome) => outcome.recentOutcome),
    ...(currentContext ? { currentContext } : {}),
    warnings: getBehaviorWarnings({
      sampleSize: outcomes.length,
      eligibleSampleSize,
    }),
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
          jsonb_build_object(
            'close', forward_candle.close,
            'high', forward_candle.high,
            'low', forward_candle.low
          )
          ORDER BY forward_candle.open_time ASC
        ) AS forward_candles
        FROM (
          SELECT
            c.open_time,
            c.close,
            c.high,
            c.low
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
      ORDER BY
        CASE
          WHEN sr.params->>'allSymbols' = 'true'
            OR sr.params->>'scannerMode' = 'single'
            OR sr.universe = 'all-symbols'
          THEN 0
          ELSE 1
        END,
        ss.scan_time DESC,
        ss.created_at DESC
      LIMIT $${params.length}
    `,
    params,
  );

  return result.rows;
}

function analyzeBehaviorRow(row: SymbolBehaviorSignalRow): AnalyzedBehaviorOutcome {
  const resultGroup = classifyScanResultGroup({
    signalLabel: row.signal_label,
    actionBias: row.action_bias,
    primaryStructure: row.primary_structure,
    rankScore: toNullableNumber(row.rank_score),
    riskScore: toNullableNumber(row.risk_score),
    detectedRiskTypes: normalizeStringArray(row.detected_risk_types),
  });
  const signalLabel = row.signal_label ?? "unknown";
  const basePrice = getBasePrice(row);
  const forwardCandles = parseForwardCandles(row.forward_candles);
  const horizons = Object.fromEntries(
    SYMBOL_BEHAVIOR_HORIZONS.map((horizon) => [
      horizon,
      getHorizonOutcome({ basePrice, forwardCandles, horizon }),
    ]),
  ) as Record<SymbolBehaviorHorizonCandles, HorizonOutcome | null>;
  const hasEnoughForwardCandles = SYMBOL_BEHAVIOR_HORIZONS.every(
    (horizon) => horizons[horizon] !== null,
  );

  return {
    resultGroup,
    signalLabel,
    horizons,
    recentOutcome: {
      scanTime: toIsoString(row.scan_time),
      candleOpenTime: row.candle_open_time
        ? toIsoString(row.candle_open_time)
        : row.anchor_open_time
          ? toIsoString(row.anchor_open_time)
          : null,
      signalLabel,
      resultGroup,
      actionBias: row.action_bias,
      primaryStructure: row.primary_structure,
      priceAtSignal: toNullableNumber(row.price_at_signal),
      rankScore: toNullableNumber(row.rank_score),
      forwardReturnsPct: {
        next1: horizons[1]?.returnPct ?? null,
        next3: horizons[3]?.returnPct ?? null,
        next5: horizons[5]?.returnPct ?? null,
      },
      maxUpsidePct: {
        next1: horizons[1]?.maxUpsidePct ?? null,
        next3: horizons[3]?.maxUpsidePct ?? null,
        next5: horizons[5]?.maxUpsidePct ?? null,
      },
      maxDrawdownPct: {
        next1: horizons[1]?.maxDrawdownPct ?? null,
        next3: horizons[3]?.maxDrawdownPct ?? null,
        next5: horizons[5]?.maxDrawdownPct ?? null,
      },
      hasEnoughForwardCandles,
    },
  };
}

function compareBehaviorOutcomeByScanTimeDesc(
  left: AnalyzedBehaviorOutcome,
  right: AnalyzedBehaviorOutcome,
) {
  return (
    Date.parse(right.recentOutcome.scanTime) -
    Date.parse(left.recentOutcome.scanTime)
  );
}

function buildGroupedStats(
  outcomes: AnalyzedBehaviorOutcome[],
): SymbolBehaviorGroupedStats[] {
  const byGroup = new Map<ScanResultGroup, AnalyzedBehaviorOutcome[]>();

  for (const outcome of outcomes) {
    byGroup.set(outcome.resultGroup, [
      ...(byGroup.get(outcome.resultGroup) ?? []),
      outcome,
    ]);
  }

  return [...byGroup.entries()].map(([group, groupOutcomes]) => ({
    group,
    sampleSize: groupOutcomes.length,
    horizons: buildHorizonStats(groupOutcomes),
  }));
}

function buildSignalLabelStats(
  outcomes: AnalyzedBehaviorOutcome[],
): SymbolBehaviorSignalLabelStats[] {
  const bySignalLabel = new Map<string, AnalyzedBehaviorOutcome[]>();

  for (const outcome of outcomes) {
    bySignalLabel.set(outcome.signalLabel, [
      ...(bySignalLabel.get(outcome.signalLabel) ?? []),
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
): SymbolBehaviorHorizonStats[] {
  return SYMBOL_BEHAVIOR_HORIZONS.map((horizon) => {
    const samples = outcomes
      .map((outcome) => outcome.horizons[horizon])
      .filter((outcome): outcome is HorizonOutcome => outcome !== null);
    const returns = samples.map((sample) => sample.returnPct);
    const upsides = samples.map((sample) => sample.maxUpsidePct);
    const drawdowns = samples.map((sample) => sample.maxDrawdownPct);

    return {
      candles: horizon,
      sampleSize: samples.length,
      averageReturnPct: average(returns),
      medianReturnPct: median(returns),
      winRatePct: getWinRate(returns),
      averageMaxUpsidePct: average(upsides),
      averageMaxDrawdownPct: average(drawdowns),
      bestReturnPct: returns.length > 0 ? roundPercent(Math.max(...returns)) : null,
      worstReturnPct: returns.length > 0 ? roundPercent(Math.min(...returns)) : null,
    };
  });
}

function buildCurrentContext({
  currentSignal,
  byGroup,
  bySignalLabel,
}: {
  currentSignal?: SymbolBehaviorCurrentSignalInput | null;
  byGroup: SymbolBehaviorGroupedStats[];
  bySignalLabel: SymbolBehaviorSignalLabelStats[];
}): SymbolBehaviorCurrentContext | undefined {
  if (!currentSignal) {
    return undefined;
  }

  const currentResultGroup = classifyScanResultGroup({
    signalLabel: currentSignal.signalLabel,
    actionBias: currentSignal.actionBias,
    primaryStructure: currentSignal.primaryStructure,
    rankScore: currentSignal.rankScore,
    riskScore: currentSignal.riskScore,
    detectedRiskTypes: normalizeStringArray(currentSignal.detectedRiskTypes),
  });
  const currentSignalLabel = currentSignal.signalLabel ?? null;

  return {
    currentSignalLabel,
    currentResultGroup,
    matchingGroupSampleSize:
      byGroup.find((row) => row.group === currentResultGroup)?.sampleSize ?? 0,
    matchingSignalSampleSize:
      bySignalLabel.find((row) => row.signalLabel === currentSignalLabel)
        ?.sampleSize ?? 0,
    note:
      "Research only: historical outcomes describe the available sample and are not a trade instruction.",
  };
}

function getBehaviorWarnings({
  sampleSize,
  eligibleSampleSize,
}: {
  sampleSize: number;
  eligibleSampleSize: number;
}) {
  const warnings: string[] = [];

  if (sampleSize === 0) {
    warnings.push("Not enough historical behavior data yet.");
  }

  if (eligibleSampleSize === 0) {
    warnings.push("Not enough forward candles for reliable outcome statistics.");
  }

  if (eligibleSampleSize < 5) {
    warnings.push("Very limited historical sample size.");
  } else if (eligibleSampleSize < 10) {
    warnings.push("Limited historical sample size.");
  }

  return warnings;
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

  const horizonCandles = forwardCandles.slice(0, horizon);
  const futureClose = horizonCandles[horizonCandles.length - 1]?.close ?? null;

  if (futureClose === null) {
    return null;
  }

  const maxHigh = Math.max(...horizonCandles.map((candle) => candle.high));
  const minLow = Math.min(...horizonCandles.map((candle) => candle.low));

  return {
    returnPct: getReturnPct({ basePrice, futurePrice: futureClose }),
    maxUpsidePct: getReturnPct({ basePrice, futurePrice: maxHigh }),
    maxDrawdownPct: getReturnPct({ basePrice, futurePrice: minLow }),
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
  if (values.length === 0) {
    return null;
  }

  return roundPercent(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function median(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return roundPercent(sorted[middle]);
  }

  return roundPercent((sorted[middle - 1] + sorted[middle]) / 2);
}

function getWinRate(values: number[]) {
  if (values.length === 0) {
    return null;
  }

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
      const high = toNullableNumber(record.high);
      const low = toNullableNumber(record.low);

      return close === null || high === null || low === null
        ? null
        : { close, high, low };
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

function roundPercent(value: number) {
  return Math.round((value + Number.EPSILON) * 10_000) / 10_000;
}
