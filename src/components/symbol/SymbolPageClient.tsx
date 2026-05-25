"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CandleChart } from "@/components/chart/CandleChart";
import { IndicatorLegend } from "@/components/chart/IndicatorLegend";
import { PhaseBadge } from "@/components/scanner/PhaseBadge";
import { ReasonList } from "@/components/scanner/ReasonList";
import { RiskBadge } from "@/components/scanner/RiskBadge";
import { ScoreBadge } from "@/components/scanner/ScoreBadge";
import { SignalBadge } from "@/components/scanner/SignalBadge";
import type { Candle, Exchange, Timeframe } from "@/lib/exchanges/types";
import { calculateIndicatorSnapshot } from "@/lib/indicators";
import { scanCandles } from "@/lib/scanner/scanCandles";

const EMPTY_CANDLES: Candle[] = [];

type SymbolPageClientProps = {
  exchange: Exchange;
  symbol: string;
};

type CandlesApiResponse = {
  exchange: Exchange;
  symbol: string;
  timeframe: Timeframe;
  candles: Candle[];
  itemCount: number;
  cached: boolean;
  updatedAt: string;
};

export function SymbolPageClient({ exchange, symbol }: SymbolPageClientProps) {
  const [timeframe, setTimeframe] = useState<Extract<Timeframe, "4h" | "1d">>(
    "4h",
  );
  const candlesQuery = useQuery({
    queryKey: ["candles", exchange, symbol, timeframe],
    queryFn: () => fetchCandles(symbol, timeframe),
  });
  const candles = candlesQuery.data?.candles ?? EMPTY_CANDLES;
  const snapshot = useMemo(() => calculateIndicatorSnapshot(candles), [candles]);
  const scanResult = useMemo(
    () => (candles.length > 0 ? scanCandles(symbol, timeframe, candles) : null),
    [candles, symbol, timeframe],
  );

  return (
    <section className="mx-auto max-w-[1500px] px-4 py-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-[var(--muted)]">
            {exchange}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold">{symbol}</h1>
            {scanResult && <PhaseBadge phase={scanResult.phase} />}
            {scanResult && <SignalBadge signal={scanResult.signal} />}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm text-[var(--muted)]">
            <span className="mb-2 block">Timeframe</span>
            <select
              value={timeframe}
              onChange={(event) =>
                setTimeframe(event.target.value as Extract<Timeframe, "4h" | "1d">)
              }
              className="rounded-md border border-[var(--border)] bg-[#0b0f14] px-3 py-2 text-[var(--foreground)]"
            >
              <option value="4h">4h</option>
              <option value="1d">1d</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => void candlesQuery.refetch()}
            disabled={candlesQuery.isFetching}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {candlesQuery.isFetching ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </div>

      {candlesQuery.isError ? (
        <StatePanel
          title="Unable To Load Symbol"
          message={
            candlesQuery.error instanceof Error
              ? candlesQuery.error.message
              : "Candle request failed."
          }
        />
      ) : candlesQuery.isLoading ? (
        <StatePanel
          title="Loading Symbol"
          message="Fetching public Binance candles and calculating indicators."
        />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="min-w-0 rounded-md border border-[var(--border)] bg-[var(--panel)] p-4">
            <CandleChart candles={candles} />
            <IndicatorLegend />
          </section>

          <aside className="space-y-5">
            {scanResult && (
              <>
                <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4">
                  <h2 className="mb-4 text-lg font-semibold">Current Structure</h2>
                  <div className="mb-4 grid grid-cols-3 gap-2">
                    <ScoreBadge
                      label="Opp"
                      value={scanResult.opportunityScore}
                      compact
                    />
                    <ScoreBadge
                      label="Conf"
                      value={scanResult.confirmationScore}
                      compact
                    />
                    <ScoreBadge
                      label="Risk"
                      value={scanResult.riskScore}
                      tone="risk"
                      compact
                    />
                  </div>
                  <IndicatorSummary snapshot={snapshot} scanResult={scanResult} />
                  <p className="mt-4 rounded-md border border-[var(--border)] bg-[#0b0f14] p-3 text-sm leading-6 text-[var(--muted)]">
                    {scanResult.signal.summary}
                  </p>
                </div>

                <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4">
                  <ReasonList title="Reasons" items={scanResult.reasons} />
                </div>

                {scanResult.warnings.length > 0 && (
                  <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4">
                    <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
                      Warnings
                    </h3>
                    <div className="space-y-2">
                      {scanResult.warnings.map((warning) => (
                        <RiskBadge key={warning} label={warning} />
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4">
                  <ReasonList
                    title="Next Confirmation"
                    items={scanResult.nextConfirmation}
                  />
                </div>

                <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4">
                  <ReasonList title="Invalidation" items={scanResult.invalidation} />
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}

function IndicatorSummary({
  snapshot,
  scanResult,
}: {
  snapshot: ReturnType<typeof calculateIndicatorSnapshot>;
  scanResult: ReturnType<typeof scanCandles>;
}) {
  const rows = [
    ["Price", formatPrice(snapshot.close)],
    ["RSI14", formatNullable(snapshot.rsi14, 1)],
    ["BB Width %", formatNullable(snapshot.bollinger.widthPercentile, 0)],
    ["Volume Ratio", formatNullable(snapshot.volume.ratio, 2)],
    ["MA20", formatNullable(snapshot.ma20, 4)],
    ["MA50", formatNullable(snapshot.ma50, 4)],
    ["MA200", formatNullable(snapshot.ma200, 4)],
    ["Rank Score", scanResult.rankScore.toFixed(1)],
  ];

  return (
    <dl className="grid grid-cols-2 gap-2 text-sm">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="rounded-md border border-[var(--border)] bg-[#0b0f14] p-3"
        >
          <dt className="text-xs text-[var(--muted)]">{label}</dt>
          <dd className="mt-1 font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function StatePanel({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex min-h-96 flex-col items-center justify-center rounded-md border border-[var(--border)] bg-[var(--panel)] px-6 py-10 text-center">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
        {message}
      </p>
    </div>
  );
}

async function fetchCandles(symbol: string, timeframe: Timeframe) {
  const params = new URLSearchParams({
    symbol,
    timeframe,
    limit: "300",
  });
  const response = await fetch(`/api/candles?${params.toString()}`);

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: string; message?: string }
      | null;
    throw new Error(body?.message ?? body?.error ?? "Candle request failed.");
  }

  return (await response.json()) as CandlesApiResponse;
}

function formatNullable(value: number | null, decimals: number) {
  return value === null ? "n/a" : value.toFixed(decimals);
}

function formatPrice(value: number) {
  if (value >= 100) {
    return value.toFixed(2);
  }

  if (value >= 1) {
    return value.toFixed(4);
  }

  return value.toFixed(6);
}
