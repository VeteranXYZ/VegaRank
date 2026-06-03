"use client";

import {
  CandlestickSeries,
  ColorType,
  createChart,
  LineSeries,
  type CandlestickData,
  type IChartApi,
  type LineData,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useMemo, useRef } from "react";
import type { Candle } from "@/lib/shared/timeframes";
import { calculateBollingerSeries, calculateSmaSeries } from "@/lib/indicators";

type CandleChartProps = {
  candles: Candle[];
};

export function CandleChart({ candles }: CandleChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartData = useMemo(() => buildChartData(candles), [candles]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container || chartData.candles.length === 0) {
      return;
    }

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#475569",
      },
      grid: {
        vertLines: { color: "#e5eaf0" },
        horzLines: { color: "#e5eaf0" },
      },
      rightPriceScale: {
        borderColor: "#cbd5e1",
      },
      timeScale: {
        borderColor: "#cbd5e1",
        timeVisible: true,
      },
      crosshair: {
        vertLine: { color: "#64748b" },
        horzLine: { color: "#64748b" },
      },
    });

    addSeries(chart, chartData);
    chart.timeScale().fitContent();

    return () => {
      chart.remove();
    };
  }, [chartData]);

  if (candles.length === 0) {
    return (
      <div className="flex h-[520px] w-full items-center justify-center rounded-md border border-[var(--border)] bg-[var(--panel)] text-sm text-[var(--muted)]">
        No candle data available
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-[520px] w-full rounded-md border border-[var(--border)] bg-[var(--panel)]"
    />
  );
}

function addSeries(chart: IChartApi, data: ChartData) {
  const candles = chart.addSeries(CandlestickSeries, {
    upColor: "#047857",
    downColor: "#dc2626",
    borderUpColor: "#047857",
    borderDownColor: "#dc2626",
    wickUpColor: "#047857",
    wickDownColor: "#dc2626",
  });
  candles.setData(data.candles);

  addLine(chart, data.ma20, "#2563eb", "MA20", 2);
  addLine(chart, data.ma50, "#7c3aed", "MA50", 2);
  addLine(chart, data.ma200, "#b45309", "MA200", 2);
  addLine(chart, data.bbUpper, "#64748b", "BB Upper", 1);
  addLine(chart, data.bbMiddle, "#94a3b8", "BB Middle", 1);
  addLine(chart, data.bbLower, "#64748b", "BB Lower", 1);
}

function addLine(
  chart: IChartApi,
  data: LineData<UTCTimestamp>[],
  color: string,
  title: string,
  lineWidth: 1 | 2,
) {
  if (data.length === 0) {
    return;
  }

  const series = chart.addSeries(LineSeries, {
    color,
    lineWidth,
    title,
    priceLineVisible: false,
    lastValueVisible: false,
  });
  series.setData(data);
}

type ChartData = {
  candles: CandlestickData<UTCTimestamp>[];
  ma20: LineData<UTCTimestamp>[];
  ma50: LineData<UTCTimestamp>[];
  ma200: LineData<UTCTimestamp>[];
  bbUpper: LineData<UTCTimestamp>[];
  bbMiddle: LineData<UTCTimestamp>[];
  bbLower: LineData<UTCTimestamp>[];
};

function buildChartData(candles: Candle[]): ChartData {
  const closes = candles.map((candle) => candle.close);
  const times = candles.map((candle) => toChartTime(candle.openTime));
  const bollinger = calculateBollingerSeries(closes, 20, 2);

  return {
    candles: candles.map((candle) => ({
      time: toChartTime(candle.openTime),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    })),
    ma20: buildSmaLine(times, closes, 20),
    ma50: buildSmaLine(times, closes, 50),
    ma200: buildSmaLine(times, closes, 200),
    bbUpper: buildBollingerLine(times, bollinger, "upper"),
    bbMiddle: buildBollingerLine(times, bollinger, "middle"),
    bbLower: buildBollingerLine(times, bollinger, "lower"),
  };
}

function buildSmaLine(
  times: UTCTimestamp[],
  values: number[],
  period: number,
): LineData<UTCTimestamp>[] {
  const series = calculateSmaSeries(values, period);
  const offset = period - 1;

  return series.map((value, index) => ({
    time: times[index + offset],
    value,
  }));
}

function buildBollingerLine(
  times: UTCTimestamp[],
  bands: ReturnType<typeof calculateBollingerSeries>,
  key: "upper" | "middle" | "lower",
): LineData<UTCTimestamp>[] {
  const offset = 19;

  return bands.map((band, index) => ({
    time: times[index + offset],
    value: band[key],
  }));
}

function toChartTime(openTime: number) {
  return Math.floor(openTime / 1000) as UTCTimestamp;
}
