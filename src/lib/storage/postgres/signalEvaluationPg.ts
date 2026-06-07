import type { Pool } from "pg";
import type { SymbolAssetClassFilter } from "@/lib/market-data/symbolClassification";
import {
  classifyScanResultGroup,
  type ScanResultGroup,
} from "@/lib/scanner/scanResultGroups";
import { createPostgresPool } from "./pool";
import { currentScanSignalCodeContractCondition } from "./scannerResultsPg";

export const SIGNAL_EVALUATION_DEFAULT_HORIZONS = [1, 3, 5, 10] as const;
export const SIGNAL_EVALUATION_DEFAULT_LIMIT = 5000;
export const SIGNAL_EVALUATION_MAX_LIMIT = 10000;
export const SIGNAL_EVALUATION_MAX_HORIZON = 50;
export const SIGNAL_EVALUATION_DEFAULT_MIN_SAMPLES = 10;
export const SIGNAL_EVALUATION_GROUPS = [
  "eligible",
  "watch",
  "overheated",
  "risk",
  "neutral",
] as const;

export type SignalEvaluationGroup = (typeof SIGNAL_EVALUATION_GROUPS)[number];
export type SignalEvaluationExpectedDirection =
  | "up"
  | "down"
  | "none"
  | "cautious";
export type SignalEvaluationSampleQuality =
  | "none"
  | "very_limited"
  | "limited"
  | "moderate"
  | "strong";

export type LoadSignalEvaluationPgInput = {
  assetClass?: SymbolAssetClassFilter;
  exchange: string;
  market: string;
  timeframe: string;
  symbol?: string | null;
  group?: SignalEvaluationGroup | null;
  signalLabel?: string | null;
  primaryStructure?: string | null;
  setupType?: string | null;
  horizons?: number[];
  minSamples?: number;
  limit?: number;
  includeBreakdowns?: boolean;
};

export type SignalEvaluationHorizonStats = {
  sampleSize: number;
  avgReturnPct: number | null;
  medianReturnPct: number | null;
  positiveRatePct: number | null;
  directionMatchRatePct: number | null;
  bestReturnPct: number | null;
  worstReturnPct: number | null;
};

export type SignalEvaluationBreakdownItem = {
  key: string;
  sampleSize: number;
  avgReturnPct: number | null;
  medianReturnPct: number | null;
  directionMatchRatePct: number | null;
};

export type SignalEvaluationResult = {
  ok: true;
  filters: {
    assetClass: SymbolAssetClassFilter;
    exchange: string;
    market: string;
    timeframe: string;
    symbol: string | null;
    group: SignalEvaluationGroup | null;
    signalLabel: string | null;
    primaryStructure: string | null;
    setupType: string | null;
    horizons: number[];
  };
  sample: {
    sourceSignals: number;
    completedSignals: number;
    skippedSignals: number;
    sampleQuality: SignalEvaluationSampleQuality;
    warnings: string[];
  };
  expectedDirection: SignalEvaluationExpectedDirection;
  horizons: Record<string, SignalEvaluationHorizonStats>;
  interpretation: {
    summary: string;
    confidence: "none" | "low" | "moderate" | "strong";
    researchOnly: true;
  };
  breakdowns: {
    byGroup: SignalEvaluationBreakdownItem[];
    bySignalLabel: SignalEvaluationBreakdownItem[];
    byPrimaryStructure: SignalEvaluationBreakdownItem[];
  };
};

type SignalEvaluationRow = {
  id: string;
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
  forward_candles: unknown;
};

type ForwardCandle = {
  close: number;
};

type AnalyzedEvaluationSignal = {
  id: string;
  resultGroup: ScanResultGroup;
  signalLabel: string | null;
  primaryStructure: string | null;
  expectedDirection: SignalEvaluationExpectedDirection;
  forwardReturnPct: Record<number, number | null>;
};

export class PgSignalEvaluationStore {
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

  async getSignalEvaluationPg(input: LoadSignalEvaluationPgInput) {
    return loadSignalEvaluationPg(this.pool, input);
  }
}

export async function loadSignalEvaluationPg(
  pool: Pool,
  input: LoadSignalEvaluationPgInput,
): Promise<SignalEvaluationResult> {
  const normalized = normalizeInput(input);
  const rows = await loadSignalEvaluationRowsPg(pool, normalized);
  const outcomes = rows.map((row) =>
    analyzeEvaluationRow(row, normalized.horizons),
  );
  const completedSignals = outcomes.filter(hasAnyCompletedHorizon).length;
  const skippedSignals = Math.max(0, rows.length - completedSignals);
  const expectedDirection = getExpectedDirection({
    group: normalized.group,
    signalLabel: normalized.signalLabel,
  });
  const horizons = buildHorizonStats({
    outcomes,
    horizons: normalized.horizons,
    expectedDirection,
  });
  const sampleQuality = getSampleQuality({
    completedSignals,
    minSamples: normalized.minSamples,
  });
  const warnings = getWarnings({
    timeframe: normalized.timeframe,
    symbol: normalized.symbol,
    group: normalized.group,
    sampleQuality,
    sourceSignals: rows.length,
    completedSignals,
    skippedSignals,
    horizons,
    minSamples: normalized.minSamples,
  });
  const mainHorizon = selectMainHorizon({
    horizons: normalized.horizons,
    stats: horizons,
    minSamples: normalized.minSamples,
  });
  const breakdowns = normalized.includeBreakdowns
    ? buildBreakdowns({ outcomes, mainHorizon })
    : emptyBreakdowns();

  return {
    ok: true,
    filters: {
      assetClass: normalized.assetClass,
      exchange: normalized.exchange,
      market: normalized.market,
      timeframe: normalized.timeframe,
      symbol: normalized.symbol,
      group: normalized.group,
      signalLabel: normalized.signalLabel,
      primaryStructure: normalized.primaryStructure,
      setupType: normalized.setupType,
      horizons: normalized.horizons,
    },
    sample: {
      sourceSignals: rows.length,
      completedSignals,
      skippedSignals,
      sampleQuality,
      warnings,
    },
    expectedDirection,
    horizons,
    interpretation: buildInterpretation({
      expectedDirection,
      sampleQuality,
      mainHorizon,
      mainStats: mainHorizon === null ? null : horizons[String(mainHorizon)] ?? null,
    }),
    breakdowns,
  };
}

function normalizeInput(input: LoadSignalEvaluationPgInput) {
  const assetClass = input.assetClass ?? "crypto";
  const exchange = input.exchange.trim().toLowerCase();
  const market = input.market.trim().toLowerCase();
  const symbol = input.symbol?.trim().toUpperCase() || null;
  const signalLabel = normalizeCodeOrLegacyFilter(input.signalLabel);
  const setupType = normalizeCodeOrLegacyFilter(input.setupType);
  const primaryStructure =
    normalizeCodeOrLegacyFilter(input.primaryStructure) || setupType || null;
  const horizons = normalizeHorizons(input.horizons);
  const minSamples = Math.max(
    1,
    Math.trunc(input.minSamples ?? SIGNAL_EVALUATION_DEFAULT_MIN_SAMPLES),
  );
  const limit = Math.max(
    1,
    Math.min(
      SIGNAL_EVALUATION_MAX_LIMIT,
      Math.trunc(input.limit ?? SIGNAL_EVALUATION_DEFAULT_LIMIT),
    ),
  );

  return {
    assetClass,
    exchange,
    market,
    timeframe: input.timeframe,
    symbol,
    group: input.group ?? null,
    signalLabel,
    primaryStructure,
    setupType,
    horizons,
    minSamples,
    limit,
    includeBreakdowns: input.includeBreakdowns ?? true,
  };
}

function normalizeCodeOrLegacyFilter(value: string | null | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  return /^[a-z]{2}_\d{3}$/i.test(trimmed)
    ? trimmed.toUpperCase()
    : trimmed.toLowerCase();
}

async function loadSignalEvaluationRowsPg(
  pool: Pool,
  input: ReturnType<typeof normalizeInput>,
) {
  const params: unknown[] = [
    input.exchange,
    input.market,
    input.timeframe,
  ];
  const filters = [
    "ss.exchange = $1",
    "ss.market = $2",
    "ss.timeframe = $3",
    "sr.status = 'success'",
    currentScanSignalCodeContractCondition("ss"),
  ];

  if (input.assetClass !== "all") {
    params.push(input.assetClass);
    filters.push(`s.asset_class = $${params.length}`);
  }

  if (input.symbol) {
    params.push(input.symbol);
    filters.push(`ss.symbol = $${params.length}`);
  }

  if (input.signalLabel) {
    params.push(input.signalLabel);
    filters.push(`ss.signal_label = $${params.length}`);
  }

  if (input.primaryStructure) {
    params.push(input.primaryStructure);
    filters.push(`ss.primary_structure = $${params.length}`);
  }

  if (input.group) {
    filters.push(getGroupSqlFilter(input.group));
  }

  params.push(input.limit);
  const limitParam = params.length;
  params.push(Math.max(...input.horizons));
  const maxHorizonParam = params.length;

  const result = await pool.query<SignalEvaluationRow>(
    `
      WITH candidate_signals AS (
        SELECT ss.*
        FROM scan_signals ss
        JOIN scan_runs sr
          ON sr.id = ss.scan_run_id
        JOIN symbols s
          ON s.id = ss.symbol_id
        WHERE ${filters.join("\n          AND ")}
        ORDER BY ss.scan_time DESC, ss.created_at DESC
        LIMIT $${limitParam}
      )
      SELECT
        cs.id,
        cs.scan_time,
        cs.candle_open_time,
        cs.price_at_signal,
        cs.rank_score,
        cs.risk_score,
        cs.factors->>'groupCode' AS group_code,
        cs.signal_label,
        cs.action_bias,
        cs.primary_structure,
        cs.detected_risk_types,
        anchor.open_time AS anchor_open_time,
        COALESCE(forward.forward_candles, '[]'::jsonb) AS forward_candles
      FROM candidate_signals cs
      LEFT JOIN LATERAL (
        SELECT c.open_time
        FROM market_candles c
        WHERE c.symbol_id = cs.symbol_id
          AND c.exchange = cs.exchange
          AND c.market = cs.market
          AND c.timeframe = cs.timeframe
          AND c.open_time <= COALESCE(cs.candle_open_time, cs.scan_time)
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
          SELECT c.open_time, c.close
          FROM market_candles c
          WHERE c.symbol_id = cs.symbol_id
            AND c.exchange = cs.exchange
            AND c.market = cs.market
            AND c.timeframe = cs.timeframe
            AND anchor.open_time IS NOT NULL
            AND c.open_time > anchor.open_time
          ORDER BY c.open_time ASC
          LIMIT $${maxHorizonParam}
        ) forward_candle
      ) forward
        ON true
      ORDER BY cs.scan_time DESC
    `,
    params,
  );

  if (!input.group) {
    return result.rows;
  }

  return result.rows.filter(
    (row) => getSignalResultGroup(row) === input.group,
  );
}

function analyzeEvaluationRow(
  row: SignalEvaluationRow,
  horizons: number[],
): AnalyzedEvaluationSignal {
  const resultGroup = getSignalResultGroup(row);
  const signalLabel = row.signal_label;
  const basePrice = toNullableNumber(row.price_at_signal);
  const forwardCandles = parseForwardCandles(row.forward_candles);
  const forwardReturnPct = Object.fromEntries(
    horizons.map((horizon) => [
      horizon,
      getForwardReturnPct({ basePrice, forwardCandles, horizon }),
    ]),
  ) as Record<number, number | null>;

  return {
    id: row.id,
    resultGroup,
    signalLabel,
    primaryStructure: row.primary_structure,
    expectedDirection: getExpectedDirection({ group: resultGroup, signalLabel }),
    forwardReturnPct,
  };
}

function getSignalResultGroup(row: SignalEvaluationRow) {
  return classifyScanResultGroup({
    groupCode: row.group_code,
    signalLabel: row.signal_label,
    actionBias: row.action_bias,
    primaryStructure: row.primary_structure,
    rankScore: toNullableNumber(row.rank_score),
    riskScore: toNullableNumber(row.risk_score),
    detectedRiskTypes: normalizeStringArray(row.detected_risk_types),
  });
}

function buildHorizonStats({
  outcomes,
  horizons,
  expectedDirection,
}: {
  outcomes: AnalyzedEvaluationSignal[];
  horizons: number[];
  expectedDirection: SignalEvaluationExpectedDirection;
}) {
  return Object.fromEntries(
    horizons.map((horizon) => [
      String(horizon),
      buildSingleHorizonStats({ outcomes, horizon, expectedDirection }),
    ]),
  ) as Record<string, SignalEvaluationHorizonStats>;
}

function buildSingleHorizonStats({
  outcomes,
  horizon,
  expectedDirection,
}: {
  outcomes: AnalyzedEvaluationSignal[];
  horizon: number;
  expectedDirection: SignalEvaluationExpectedDirection;
}): SignalEvaluationHorizonStats {
  const returns = outcomes
    .map((outcome) => outcome.forwardReturnPct[horizon] ?? null)
    .filter((value): value is number => value !== null);

  if (returns.length === 0) {
    return emptyHorizonStats();
  }

  return {
    sampleSize: returns.length,
    avgReturnPct: average(returns),
    medianReturnPct: median(returns),
    positiveRatePct: getRate(
      returns.filter((value) => value > 0).length,
      returns.length,
    ),
    directionMatchRatePct: getDirectionMatchRate(returns, expectedDirection),
    bestReturnPct: roundPercent(Math.max(...returns)),
    worstReturnPct: roundPercent(Math.min(...returns)),
  };
}

function buildBreakdowns({
  outcomes,
  mainHorizon,
}: {
  outcomes: AnalyzedEvaluationSignal[];
  mainHorizon: number | null;
}) {
  if (mainHorizon === null) {
    return emptyBreakdowns();
  }

  return {
    byGroup: buildBreakdown({
      outcomes,
      mainHorizon,
      getKey: (outcome) => outcome.resultGroup,
    }),
    bySignalLabel: buildBreakdown({
      outcomes,
      mainHorizon,
      getKey: (outcome) => outcome.signalLabel ?? "unknown",
    }),
    byPrimaryStructure: buildBreakdown({
      outcomes,
      mainHorizon,
      getKey: (outcome) => outcome.primaryStructure ?? "unknown",
    }),
  };
}

function buildBreakdown({
  outcomes,
  mainHorizon,
  getKey,
}: {
  outcomes: AnalyzedEvaluationSignal[];
  mainHorizon: number;
  getKey: (outcome: AnalyzedEvaluationSignal) => string;
}): SignalEvaluationBreakdownItem[] {
  const grouped = new Map<string, AnalyzedEvaluationSignal[]>();

  for (const outcome of outcomes) {
    const key = getKey(outcome);
    grouped.set(key, [...(grouped.get(key) ?? []), outcome]);
  }

  return [...grouped.entries()]
    .map(([key, groupOutcomes]) => {
      const returns = groupOutcomes
        .map((outcome) => outcome.forwardReturnPct[mainHorizon] ?? null)
        .filter((value): value is number => value !== null);

      return {
        key,
        sampleSize: returns.length,
        avgReturnPct: returns.length > 0 ? average(returns) : null,
        medianReturnPct: returns.length > 0 ? median(returns) : null,
        directionMatchRatePct: getOutcomeDirectionMatchRate({
          outcomes: groupOutcomes,
          horizon: mainHorizon,
        }),
      };
    })
    .filter((item) => item.sampleSize > 0)
    .sort((left, right) => {
      if (right.sampleSize !== left.sampleSize) {
        return right.sampleSize - left.sampleSize;
      }

      return left.key.localeCompare(right.key);
    });
}

function getOutcomeDirectionMatchRate({
  outcomes,
  horizon,
}: {
  outcomes: AnalyzedEvaluationSignal[];
  horizon: number;
}) {
  let denominator = 0;
  let matches = 0;

  for (const outcome of outcomes) {
    const returnPct = outcome.forwardReturnPct[horizon] ?? null;

    if (returnPct === null || outcome.expectedDirection === "none") {
      continue;
    }

    denominator += 1;
    if (matchesExpectedDirection(returnPct, outcome.expectedDirection)) {
      matches += 1;
    }
  }

  return denominator === 0 ? null : getRate(matches, denominator);
}

function emptyBreakdowns() {
  return {
    byGroup: [],
    bySignalLabel: [],
    byPrimaryStructure: [],
  };
}

function emptyHorizonStats(): SignalEvaluationHorizonStats {
  return {
    sampleSize: 0,
    avgReturnPct: null,
    medianReturnPct: null,
    positiveRatePct: null,
    directionMatchRatePct: null,
    bestReturnPct: null,
    worstReturnPct: null,
  };
}

function getForwardReturnPct({
  basePrice,
  forwardCandles,
  horizon,
}: {
  basePrice: number | null;
  forwardCandles: ForwardCandle[];
  horizon: number;
}) {
  if (basePrice === null || basePrice <= 0 || forwardCandles.length < horizon) {
    return null;
  }

  const futureClose = forwardCandles[horizon - 1]?.close ?? null;

  if (futureClose === null || futureClose <= 0) {
    return null;
  }

  return roundPercent(((futureClose - basePrice) / basePrice) * 100);
}

function hasAnyCompletedHorizon(outcome: AnalyzedEvaluationSignal) {
  return Object.values(outcome.forwardReturnPct).some((value) => value !== null);
}

function getExpectedDirection({
  group,
  signalLabel,
}: {
  group?: ScanResultGroup | SignalEvaluationGroup | null;
  signalLabel?: string | null;
}): SignalEvaluationExpectedDirection {
  const normalizedLabel = signalLabel?.trim().toLowerCase() ?? "";

  if (
    normalizedLabel === "breakdown_risk" ||
    normalizedLabel === "distribution_risk" ||
    normalizedLabel === "overheated"
  ) {
    return "down";
  }

  if (group === "risk" || group === "overheated") {
    return "down";
  }

  if (group === "eligible") {
    return "up";
  }

  if (group === "watch") {
    return "cautious";
  }

  if (group === "neutral") {
    return "none";
  }

  if (normalizedLabel === "confirmed") {
    return "up";
  }

  return "none";
}

function getDirectionMatchRate(
  returns: number[],
  expectedDirection: SignalEvaluationExpectedDirection,
) {
  if (expectedDirection === "none") {
    return null;
  }

  const matches = returns.filter((value) =>
    matchesExpectedDirection(value, expectedDirection),
  ).length;

  return getRate(matches, returns.length);
}

function matchesExpectedDirection(
  value: number,
  expectedDirection: SignalEvaluationExpectedDirection,
) {
  if (expectedDirection === "down") {
    return value < 0;
  }

  if (expectedDirection === "up" || expectedDirection === "cautious") {
    return value > 0;
  }

  return false;
}

function selectMainHorizon({
  horizons,
  stats,
  minSamples,
}: {
  horizons: number[];
  stats: Record<string, SignalEvaluationHorizonStats>;
  minSamples: number;
}) {
  const preferred = [5, 3, 1].filter((horizon) => horizons.includes(horizon));

  for (const horizon of preferred) {
    if ((stats[String(horizon)]?.sampleSize ?? 0) >= minSamples) {
      return horizon;
    }
  }

  for (const horizon of preferred) {
    if ((stats[String(horizon)]?.sampleSize ?? 0) > 0) {
      return horizon;
    }
  }

  return horizons.find((horizon) => (stats[String(horizon)]?.sampleSize ?? 0) > 0) ?? null;
}

function getSampleQuality({
  completedSignals,
  minSamples,
}: {
  completedSignals: number;
  minSamples: number;
}): SignalEvaluationSampleQuality {
  if (completedSignals === 0) {
    return "none";
  }

  if (completedSignals < minSamples) {
    return "very_limited";
  }

  if (completedSignals < Math.max(minSamples * 3, 30)) {
    return "limited";
  }

  if (completedSignals < Math.max(minSamples * 10, 100)) {
    return "moderate";
  }

  return "strong";
}

function getWarnings({
  timeframe,
  symbol,
  group,
  sampleQuality,
  sourceSignals,
  completedSignals,
  skippedSignals,
  horizons,
  minSamples,
}: {
  timeframe: string;
  symbol: string | null;
  group: SignalEvaluationGroup | null;
  sampleQuality: SignalEvaluationSampleQuality;
  sourceSignals: number;
  completedSignals: number;
  skippedSignals: number;
  horizons: Record<string, SignalEvaluationHorizonStats>;
  minSamples: number;
}) {
  const warnings = new Set<string>();
  const horizonSamples = Object.values(horizons).map((horizon) => horizon.sampleSize);

  if (sourceSignals === 0 || horizonSamples.some((sample) => sample < minSamples)) {
    warnings.add("insufficient_completed_horizons");
  }

  if (sampleQuality === "very_limited") {
    warnings.add("very_limited_sample");
  } else if (sampleQuality === "limited") {
    warnings.add("limited_sample");
  }

  if (
    skippedSignals > 0 ||
    (completedSignals > 0 &&
      horizonSamples.some((sampleSize) => sampleSize < completedSignals))
  ) {
    warnings.add("missing_future_candles");
  }

  if (group === "neutral") {
    warnings.add("neutral_has_no_directional_edge");
  }

  if (symbol) {
    warnings.add("symbol_filtered_sample");
  }

  if (
    timeframe === "1h" &&
    (sampleQuality === "very_limited" || sampleQuality === "limited")
  ) {
    warnings.add("one_hour_history_still_accumulating");
  }

  return [...warnings];
}

function buildInterpretation({
  expectedDirection,
  sampleQuality,
  mainHorizon,
  mainStats,
}: {
  expectedDirection: SignalEvaluationExpectedDirection;
  sampleQuality: SignalEvaluationSampleQuality;
  mainHorizon: number | null;
  mainStats: SignalEvaluationHorizonStats | null;
}): SignalEvaluationResult["interpretation"] {
  if (sampleQuality === "none" || mainHorizon === null || !mainStats) {
    return {
      summary:
        "No completed historical follow-through sample is available for these filters.",
      confidence: "none",
      researchOnly: true,
    };
  }

  const directionLabel = getDirectionLabel(expectedDirection);
  const matchText =
    mainStats.directionMatchRatePct === null
      ? "no directional match rate"
      : `${mainStats.directionMatchRatePct}% direction match`;

  return {
    summary: `Historical follow-through over ${mainHorizon} candles has ${mainStats.sampleSize} completed samples, ${mainStats.avgReturnPct}% average forward return, and ${matchText} for the ${directionLabel} context.`,
    confidence: getConfidence(sampleQuality),
    researchOnly: true,
  };
}

function getDirectionLabel(direction: SignalEvaluationExpectedDirection) {
  switch (direction) {
    case "up":
      return "up";
    case "down":
      return "down";
    case "cautious":
      return "cautious/up";
    case "none":
      return "non-directional";
  }
}

function getConfidence(sampleQuality: SignalEvaluationSampleQuality) {
  switch (sampleQuality) {
    case "none":
      return "none";
    case "very_limited":
    case "limited":
      return "low";
    case "moderate":
      return "moderate";
    case "strong":
      return "strong";
  }
}

function normalizeHorizons(horizons: number[] | undefined) {
  const values =
    horizons && horizons.length > 0
      ? horizons
      : [...SIGNAL_EVALUATION_DEFAULT_HORIZONS];

  const normalized = [...new Set(values.map((horizon) => Math.trunc(horizon)))]
    .filter(
      (horizon) =>
        Number.isInteger(horizon) &&
        horizon >= 1 &&
        horizon <= SIGNAL_EVALUATION_MAX_HORIZON,
    )
    .sort((left, right) => left - right);

  return normalized.length > 0
    ? normalized
    : [...SIGNAL_EVALUATION_DEFAULT_HORIZONS];
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

      const close = toNullableNumber((item as Record<string, unknown>).close);

      return close === null || close <= 0 ? null : { close };
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

function getRate(matches: number, total: number) {
  return total === 0 ? null : roundPercent((matches / total) * 100);
}

function roundPercent(value: number) {
  return Math.round((value + Number.EPSILON) * 10_000) / 10_000;
}

function getGroupSqlFilter(group: SignalEvaluationGroup) {
  const risk = getRiskSqlCondition();
  const overheated = getOverheatedSqlCondition();
  const eligible = getEligibleSqlCondition({ risk, overheated });
  const watch = getWatchSqlCondition({ risk, overheated, eligible });

  switch (group) {
    case "risk":
      return `(${risk})`;
    case "overheated":
      return `(NOT (${risk}) AND (${overheated}))`;
    case "eligible":
      return `(${eligible})`;
    case "watch":
      return `(${watch})`;
    case "neutral":
      return `(NOT (${risk}) AND NOT (${overheated}) AND NOT (${eligible}) AND NOT (${watch}))`;
  }
}

function getRiskSqlCondition() {
  return `
    (
      ss.factors->>'groupCode' = 'GR_301'
    )
  `;
}

function getOverheatedSqlCondition() {
  return `
    (
      ss.factors->>'groupCode' = 'GR_302'
    )
  `;
}

function getEligibleSqlCondition({
  risk,
  overheated,
}: {
  risk: string;
  overheated: string;
}) {
  return `
    (
      ss.factors->>'groupCode' IN ('GR_501', 'GR_601')
    )
  `;
}

function getWatchSqlCondition({
  risk,
  overheated,
  eligible,
}: {
  risk: string;
  overheated: string;
  eligible: string;
}) {
  return `
    (
      ss.factors->>'groupCode' IN ('GR_101', 'GR_201')
    )
  `;
}
