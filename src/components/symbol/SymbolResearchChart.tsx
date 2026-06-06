"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  LineSeries,
  createChart,
  createSeriesMarkers,
  type CandlestickData,
  type LineData,
  type LogicalRange,
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
  exchange?: string;
  symbol: string;
  timeframe: string;
  candles: RawSymbolChartCandle[];
  candleCount: number;
  className?: string;
  density?: "normal" | "compact";
  latestSignal?: {
    candleOpenTime?: string | null;
    resultGroup?: string | null;
    statusNote?: string | null;
  };
};

const maxLazyCandleLimit = 1000;
const lazyCandleStep = 240;
const lazyLoadLeftEdgeThreshold = 24;

export function SymbolResearchChart({
  exchange = "binance",
  symbol,
  timeframe,
  candles,
  candleCount,
  className = "mt-4",
  density = "normal",
  latestSignal,
}: SymbolResearchChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [lazyCandleState, setLazyCandleState] = useState<{
    key: string;
    count: number;
    error: string | null;
  } | null>(null);
  const [loadingCandleKey, setLoadingCandleKey] = useState<string | null>(null);
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

  const chartDataKey = `${exchange.toLowerCase()}:${symbol.toUpperCase()}:${timeframe}:${chartData.candles.length}`;
  const displayedCandleCount =
    lazyCandleState?.key === chartDataKey
      ? lazyCandleState.count
      : chartData.candles.length;
  const lazyLoadError =
    lazyCandleState?.key === chartDataKey ? lazyCandleState.error : null;
  const isLoadingMoreCandles = loadingCandleKey === chartDataKey;

  useEffect(() => {
    const container = containerRef.current;

    if (!container || chartData.candles.length === 0) {
      return;
    }

    const chart = createChart(container, {
      autoSize: true,
      height: 320,
      layout: {
        background: { type: ColorType.Solid, color: "#10161d" },
        textColor: "#a9b5c3",
        attributionLogo: true,
      },
      grid: {
        vertLines: { color: "rgba(148, 163, 184, 0.16)" },
        horzLines: { color: "rgba(148, 163, 184, 0.16)" },
      },
      rightPriceScale: {
        borderColor: "rgba(148, 163, 184, 0.3)",
      },
      timeScale: {
        borderColor: "rgba(148, 163, 184, 0.3)",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: "#7f8b99" },
        horzLine: { color: "#7f8b99" },
      },
      localization: {
        priceFormatter: formatChartPrice,
      },
    });
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#5ac46f",
      downColor: "#ff625d",
      borderUpColor: "#5ac46f",
      borderDownColor: "#ff625d",
      wickUpColor: "#5ac46f",
      wickDownColor: "#ff625d",
    });
    const ma20Series = chart.addSeries(LineSeries, {
      color: "#e1b249",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const ma50Series = chart.addSeries(LineSeries, {
      color: "#67a8ff",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    candlestickSeries.setData(toCandlestickData(chartData.candles));
    ma20Series.setData(toLineData(chartData.ma20));
    ma50Series.setData(toLineData(chartData.ma50));

    let activeCandles = chartData.candles;
    let activeLoadedLimit = Math.max(candleCount, candles.length, activeCandles.length);
    let loadingMore = false;
    let isDisposed = false;
    const canLazyLoadRemoteCandles = exchange.toLowerCase() === "binance";

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
    const loadMoreCandles = async () => {
      if (
        loadingMore ||
        !canLazyLoadRemoteCandles ||
        activeLoadedLimit >= maxLazyCandleLimit
      ) {
        return;
      }

      loadingMore = true;
      if (!isDisposed) {
        setLoadingCandleKey(chartDataKey);
        setLazyCandleState({
          key: chartDataKey,
          count: activeCandles.length,
          error: null,
        });
      }

      try {
        const nextLimit = Math.min(
          maxLazyCandleLimit,
          Math.max(activeLoadedLimit + lazyCandleStep, activeCandles.length + lazyCandleStep),
        );
        const nextCandles = await fetchLazyCandles({
          symbol,
          timeframe,
          limit: nextLimit,
        });
        const normalizedCandles = normalizeCandlesForChart(nextCandles);

        activeLoadedLimit = nextLimit;

        if (normalizedCandles.length > activeCandles.length) {
          activeCandles = normalizedCandles;
          candlestickSeries.setData(toCandlestickData(activeCandles));
          ma20Series.setData(
            toLineData(computeSimpleMovingAverage(activeCandles, 20)),
          );
          ma50Series.setData(
            toLineData(computeSimpleMovingAverage(activeCandles, 50)),
          );

          if (!isDisposed) {
            setLazyCandleState({
              key: chartDataKey,
              count: activeCandles.length,
              error: null,
            });
          }
        }
      } catch {
        if (!isDisposed) {
          setLazyCandleState({
            key: chartDataKey,
            count: activeCandles.length,
            error: "More candles unavailable",
          });
        }
      } finally {
        loadingMore = false;
        if (!isDisposed) {
          setLoadingCandleKey((current) =>
            current === chartDataKey ? null : current,
          );
        }
      }
    };
    const handleVisibleRangeChange = (range: LogicalRange | null) => {
      if (!range || range.from > lazyLoadLeftEdgeThreshold) {
        return;
      }

      void loadMoreCandles();
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);

    return () => {
      isDisposed = true;
      chart
        .timeScale()
        .unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
      markerApi?.detach();
      chart.remove();
    };
  }, [candleCount, candles.length, chartData, chartDataKey, exchange, symbol, timeframe]);

  const hasCandles = chartData.candles.length > 0;
  const emptyMessage =
    candles.length > 0
      ? "No valid candles available for the research chart."
      : candleCount > 0
        ? "Candle metadata exists, but no candle rows were returned."
        : "No candle rows available for this symbol/timeframe yet.";
  const isCompact = density === "compact";

  return (
    <section
      className={`min-w-0 border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-panel)] ${isCompact ? "flex min-h-0 flex-col px-2 py-2" : "px-3 py-3"} ${className}`}
    >
      <div className={`${isCompact ? "mb-2" : "mb-3"} flex flex-wrap items-start justify-between gap-2`}>
        <div>
          <h2 className="text-sm font-semibold">{isCompact ? "Chart" : "Research Chart"}</h2>
          {!isCompact ? (
            <p className="mt-1 text-xs text-[var(--muted)]">
              Candles, MA20/MA50, and latest signal marker.
            </p>
          ) : null}
        </div>
        <div className={`grid w-full grid-cols-2 gap-x-3 gap-y-1 text-xs text-[var(--muted)] sm:w-auto ${isCompact ? "sm:grid-cols-4 lg:text-right" : "sm:grid-cols-3 lg:text-right"}`}>
          {!isCompact ? (
            <>
              <LegendValue label="Symbol" value={symbol} />
              <LegendValue label="Timeframe" value={timeframe} />
            </>
          ) : null}
          <LegendValue label="Last close" value={formatChartPrice(chartData.latestClose)} />
          <LegendValue
            label="Latest signal"
            value={latestSignal?.statusNote || latestSignal?.resultGroup || "Not available"}
          />
          <LegendValue
            label="Candles"
            value={
              isLoadingMoreCandles
                ? `${displayedCandleCount}+`
                : String(Math.max(displayedCandleCount, chartData.candles.length))
            }
          />
          <div className="flex items-center gap-3 text-left lg:justify-end">
            <span className="inline-flex items-center gap-1">
              <span className="h-0.5 w-5 bg-[var(--warning)]" />
              MA20
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-0.5 w-5 bg-[var(--info)]" />
              MA50
            </span>
          </div>
        </div>
      </div>

      {hasCandles ? (
        <>
          <div
            ref={containerRef}
            className={`min-w-0 overflow-hidden border border-[var(--border-medium)] bg-[var(--panel-data)] ${isCompact ? "h-[340px] min-h-[320px] lg:h-auto lg:min-h-[360px] lg:flex-1" : "h-[300px] sm:h-[360px]"}`}
          />
          {lazyLoadError ? (
            <p className="mt-1 text-[10px] font-semibold uppercase text-[var(--warning)]">
              {lazyLoadError}
            </p>
          ) : null}
        </>
      ) : (
        <div className={`flex items-center justify-center border border-[var(--border-medium)] bg-[var(--panel-data)] px-4 text-center text-sm text-[var(--muted)] ${isCompact ? "h-[340px] min-h-[320px] lg:h-auto lg:min-h-[360px] lg:flex-1" : "h-[260px]"}`}>
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

async function fetchLazyCandles({
  symbol,
  timeframe,
  limit,
}: {
  symbol: string;
  timeframe: string;
  limit: number;
}) {
  const params = new URLSearchParams({
    source: "remote",
    symbol,
    timeframe,
    limit: String(limit),
  });
  const response = await fetch(`/api/candles?${params.toString()}`);
  const body = (await response.json().catch(() => null)) as
    | { candles?: unknown }
    | null;

  if (!response.ok || !Array.isArray(body?.candles)) {
    throw new Error("Candles unavailable");
  }

  return body.candles.filter(isRawChartCandle);
}

function isRawChartCandle(value: unknown): value is RawSymbolChartCandle {
  return value !== null && typeof value === "object";
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
