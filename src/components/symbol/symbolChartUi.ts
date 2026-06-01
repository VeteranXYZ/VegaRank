export type RawSymbolChartCandle = {
  openTime?: number | string | null;
  closeTime?: number | string | null;
  open?: number | string | null;
  high?: number | string | null;
  low?: number | string | null;
  close?: number | string | null;
  volume?: number | string | null;
  quoteVolume?: number | string | null;
};

export type SymbolResearchCandles = {
  count: number;
  timeframe: string;
  firstOpenTime: string | null;
  lastOpenTime: string | null;
  rows: RawSymbolChartCandle[];
};

export type NormalizedSymbolChartCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type SymbolChartLinePoint = {
  time: number;
  value: number;
};

const emptySymbolResearchCandles: SymbolResearchCandles = {
  count: 0,
  timeframe: "",
  firstOpenTime: null,
  lastOpenTime: null,
  rows: [],
};

export function normalizeSymbolResearchCandles(
  input: unknown,
): SymbolResearchCandles {
  if (Array.isArray(input)) {
    return {
      ...emptySymbolResearchCandles,
      count: input.length,
      rows: input.filter(isCandleLike),
    };
  }

  if (!isRecord(input)) {
    return { ...emptySymbolResearchCandles };
  }

  const rows = Array.isArray(input.rows) ? input.rows.filter(isCandleLike) : [];
  const count = toFiniteNumber(input.count);

  return {
    count: count === null ? rows.length : count,
    timeframe: typeof input.timeframe === "string" ? input.timeframe : "",
    firstOpenTime:
      typeof input.firstOpenTime === "string" && input.firstOpenTime
        ? input.firstOpenTime
        : null,
    lastOpenTime:
      typeof input.lastOpenTime === "string" && input.lastOpenTime
        ? input.lastOpenTime
        : null,
    rows,
  };
}

export function normalizeCandlesForChart(
  candles: RawSymbolChartCandle[] | null | undefined,
) {
  const byTime = new Map<number, NormalizedSymbolChartCandle>();

  for (const candle of candles ?? []) {
    const time = normalizeTimestampToSeconds(candle.openTime);
    const open = toFiniteNumber(candle.open);
    const high = toFiniteNumber(candle.high);
    const low = toFiniteNumber(candle.low);
    const close = toFiniteNumber(candle.close);

    if (
      time === null ||
      open === null ||
      high === null ||
      low === null ||
      close === null ||
      high < Math.max(open, close) ||
      low > Math.min(open, close)
    ) {
      continue;
    }

    byTime.set(time, { time, open, high, low, close });
  }

  return Array.from(byTime.values()).sort((left, right) => left.time - right.time);
}

export function computeSimpleMovingAverage(
  candles: NormalizedSymbolChartCandle[],
  period: number,
): SymbolChartLinePoint[] {
  if (!Number.isInteger(period) || period <= 0 || candles.length < period) {
    return [];
  }

  const points: SymbolChartLinePoint[] = [];
  let rollingSum = 0;

  for (let index = 0; index < candles.length; index += 1) {
    rollingSum += candles[index].close;

    if (index >= period) {
      rollingSum -= candles[index - period].close;
    }

    if (index >= period - 1) {
      points.push({
        time: candles[index].time,
        value: rollingSum / period,
      });
    }
  }

  return points;
}

export function findLatestSignalCandleTime({
  candles,
  candleOpenTime,
}: {
  candles: NormalizedSymbolChartCandle[];
  candleOpenTime: string | number | null | undefined;
}) {
  const signalTime = normalizeTimestampToSeconds(candleOpenTime);

  if (signalTime === null) {
    return null;
  }

  return candles.some((candle) => candle.time === signalTime) ? signalTime : null;
}

export function formatChartPrice(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  if (value >= 1000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  if (value >= 1) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  }

  return value.toLocaleString(undefined, {
    minimumSignificantDigits: 2,
    maximumSignificantDigits: 6,
  });
}

function normalizeTimestampToSeconds(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const rawTime =
    typeof value === "number"
      ? value
      : Number.isFinite(Number(value))
        ? Number(value)
        : new Date(value).getTime();

  if (!Number.isFinite(rawTime) || rawTime <= 0) {
    return null;
  }

  const milliseconds = rawTime < 10_000_000_000 ? rawTime * 1000 : rawTime;

  return Math.floor(milliseconds / 1000);
}

function toFiniteNumber(value: unknown) {
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCandleLike(value: unknown): value is RawSymbolChartCandle {
  return isRecord(value);
}
