"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  LineSeries,
  createChart,
  createSeriesMarkers,
  type CandlestickData,
  type LineData,
  type Time,
} from "lightweight-charts";
import {
  computeSimpleMovingAverage,
  findLatestSignalCandleTime,
  formatChartPrice,
  normalizeCandlesForChart,
  type RawSymbolChartCandle,
} from "./symbolChartUi";

type SymbolResearchChartProps = {
  symbol: string;
  timeframe: string;
  candles: RawSymbolChartCandle[];
  candleCount: number;
  latestSignal?: {
    candleOpenTime?: string | null;
    resultGroup?: string | null;
    statusNote?: string | null;
  };
};

export function SymbolResearchChart({
  symbol,
  timeframe,
  candles,
  candleCount,
  latestSignal,
}: SymbolResearchChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartData = useMemo(() => {
    const normalizedCandles = normalizeCandlesForChart(candles);
    const latestClose = normalizedCandles[normalizedCandles.length - 1]?.close ?? null;

    return {
      candles: normalizedCandles,
      ma20: computeSimpleMovingAverage(normalizedCandles, 20),
      ma50: computeSimpleMovingAverage(normalizedCandles, 50),
      latestClose,
      latestSignalCandleTime: findLatestSignalCandleTime({
        candles: normalizedCandles,
        candleOpenTime: latestSignal?.candleOpenTime,
      }),
    };
  }, [candles, latestSignal?.candleOpenTime]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container || chartData.candles.length === 0) {
      return;
    }

    const chart = createChart(container, {
      autoSize: true,
      height: 320,
      layout: {
        background: { type: ColorType.Solid, color: "#080d12" },
        textColor: "#9ba7b4",
        attributionLogo: true,
      },
      grid: {
        vertLines: { color: "#16212c" },
        horzLines: { color: "#16212c" },
      },
      rightPriceScale: {
        borderColor: "#243142",
      },
      timeScale: {
        borderColor: "#243142",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: "#526173" },
        horzLine: { color: "#526173" },
      },
      localization: {
        priceFormatter: formatChartPrice,
      },
    });
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#8db8a1",
      downColor: "#c79191",
      borderUpColor: "#8db8a1",
      borderDownColor: "#c79191",
      wickUpColor: "#8db8a1",
      wickDownColor: "#c79191",
    });
    const ma20Series = chart.addSeries(LineSeries, {
      color: "#d6b45d",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const ma50Series = chart.addSeries(LineSeries, {
      color: "#7aa8d8",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    candlestickSeries.setData(toCandlestickData(chartData.candles));
    ma20Series.setData(toLineData(chartData.ma20));
    ma50Series.setData(toLineData(chartData.ma50));

    const markerApi =
      chartData.latestSignalCandleTime === null
        ? null
        : createSeriesMarkers(candlestickSeries, [
            {
              id: "latest-signal-candle",
              time: chartData.latestSignalCandleTime as Time,
              position: "aboveBar",
              shape: "circle",
              color: "#d6b45d",
              text: "Latest signal candle",
              size: 1,
            },
          ]);

    chart.timeScale().fitContent();

    return () => {
      markerApi?.detach();
      chart.remove();
    };
  }, [chartData]);

  const hasCandles = chartData.candles.length > 0;
  const emptyMessage =
    candles.length > 0
      ? "No valid candles available for the research chart."
      : candleCount > 0
        ? "Candle metadata exists, but no candle rows were returned."
        : "No candle rows available for this symbol/timeframe yet.";

  return (
    <section className="mt-4 border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Research Chart</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Recent candles with simple moving averages for manual review.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[var(--muted)] sm:grid-cols-3 lg:text-right">
          <LegendValue label="Symbol" value={symbol} />
          <LegendValue label="Timeframe" value={timeframe} />
          <LegendValue label="Last close" value={formatChartPrice(chartData.latestClose)} />
          <LegendValue
            label="Latest signal"
            value={latestSignal?.statusNote || latestSignal?.resultGroup || "Not available"}
          />
          <LegendValue label="Candles" value={String(candleCount)} />
          <div className="flex items-center gap-3 text-left lg:justify-end">
            <span className="inline-flex items-center gap-1">
              <span className="h-0.5 w-5 bg-[#d6b45d]" />
              MA20
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-0.5 w-5 bg-[#7aa8d8]" />
              MA50
            </span>
          </div>
        </div>
      </div>

      {hasCandles ? (
        <div
          ref={containerRef}
          className="h-[320px] min-w-0 overflow-hidden border border-[var(--border)] bg-[#080d12]"
        />
      ) : (
        <div className="flex h-[220px] items-center justify-center border border-[var(--border)] bg-[#080d12] px-4 text-center text-sm text-[var(--muted)]">
          {emptyMessage}
        </div>
      )}
    </section>
  );
}

function LegendValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[10px] uppercase text-[var(--muted-2)]">{label}</span>
      <span className="ml-1 font-semibold text-[var(--foreground)]">{value}</span>
    </div>
  );
}

function toCandlestickData(
  candles: ReturnType<typeof normalizeCandlesForChart>,
): CandlestickData<Time>[] {
  return candles.map((candle) => ({
    time: candle.time as Time,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  }));
}

function toLineData(points: ReturnType<typeof computeSimpleMovingAverage>): LineData<Time>[] {
  return points.map((point) => ({
    time: point.time as Time,
    value: point.value,
  }));
}
