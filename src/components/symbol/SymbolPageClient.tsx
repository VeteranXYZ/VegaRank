"use client";

import { useQueries } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CandleChart } from "@/components/chart/CandleChart";
import { IndicatorLegend } from "@/components/chart/IndicatorLegend";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { PhaseBadge } from "@/components/scanner/PhaseBadge";
import { ReasonList } from "@/components/scanner/ReasonList";
import { RiskBadge } from "@/components/scanner/RiskBadge";
import { ScoreBadge } from "@/components/scanner/ScoreBadge";
import { SignalBadge } from "@/components/scanner/SignalBadge";
import {
  TIMEFRAMES,
  type Candle,
  type Exchange,
  type Timeframe,
} from "@/lib/exchanges/types";
import { calculateIndicatorSnapshot } from "@/lib/indicators";
import {
  summarizeMultiTimeframe,
  type MultiTimeframeSummary,
} from "@/lib/scanner/multiTimeframe";
import { scanCandles } from "@/lib/scanner/scanCandles";
import type { ScanResult } from "@/lib/scanner/types";

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
  const { dictionary: t } = useLanguage();
  const [timeframe, setTimeframe] = useState<Timeframe>("4h");
  const timeframeQueries = useQueries({
    queries: TIMEFRAMES.map((option) => ({
      queryKey: ["candles", exchange, symbol, option],
      queryFn: () => fetchCandles(symbol, option),
    })),
  });
  const selectedTimeframeIndex = TIMEFRAMES.indexOf(timeframe);
  const candlesQuery = timeframeQueries[selectedTimeframeIndex];
  const isAnyTimeframeFetching = timeframeQueries.some((query) => query.isFetching);
  const candles = candlesQuery.data?.candles ?? EMPTY_CANDLES;
  const snapshot = useMemo(() => calculateIndicatorSnapshot(candles), [candles]);
  const scanResult = useMemo(
    () => (candles.length > 0 ? scanCandles(symbol, timeframe, candles) : null),
    [candles, symbol, timeframe],
  );
  const multiTimeframeResults = TIMEFRAMES.flatMap((option, index) => {
    const optionCandles = timeframeQueries[index]?.data?.candles ?? EMPTY_CANDLES;
    return optionCandles.length > 0
      ? [scanCandles(symbol, option, optionCandles)]
      : [];
  });
  const multiTimeframeSummary =
    multiTimeframeResults.length > 0
      ? summarizeMultiTimeframe(multiTimeframeResults)
      : null;

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
            <span className="mb-2 block">{t.symbol.timeframe}</span>
            <select
              value={timeframe}
              onChange={(event) => setTimeframe(event.target.value as Timeframe)}
              className="rounded-md border border-[var(--border)] bg-[#0b0f14] px-3 py-2 text-[var(--foreground)]"
            >
              {TIMEFRAMES.map((option) => (
                <option key={option} value={option}>
                  {t.timeframe[option]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() =>
              void Promise.all(timeframeQueries.map((query) => query.refetch()))
            }
            disabled={isAnyTimeframeFetching}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isAnyTimeframeFetching ? t.common.refreshing : t.common.refresh}
          </button>
        </div>
      </div>

      {candlesQuery.isError ? (
        <StatePanel
          title={t.symbol.errorTitle}
          message={
            candlesQuery.error instanceof Error
              ? candlesQuery.error.message
              : t.symbol.candleError
          }
        />
      ) : candlesQuery.isLoading ? (
        <StatePanel
          title={t.symbol.loadingTitle}
          message={t.symbol.loadingMessage}
        />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="min-w-0 rounded-md border border-[var(--border)] bg-[var(--panel)] p-4">
            <CandleChart candles={candles} />
            <IndicatorLegend />
          </section>

          <aside className="space-y-5">
            <MultiTimeframePanel
              activeTimeframe={timeframe}
              results={multiTimeframeResults}
              summary={multiTimeframeSummary}
              onSelect={setTimeframe}
            />

            {scanResult && (
              <>
                <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4">
                  <h2 className="mb-4 text-lg font-semibold">
                    {t.symbol.currentStructure}
                  </h2>
                  <div className="mb-4 grid grid-cols-3 gap-2">
                    <ScoreBadge
                      label={t.scanner.columns.opportunity}
                      value={scanResult.opportunityScore}
                      compact
                    />
                    <ScoreBadge
                      label={t.scanner.columns.confirmation}
                      value={scanResult.confirmationScore}
                      compact
                    />
                    <ScoreBadge
                      label={t.common.risk}
                      value={scanResult.riskScore}
                      tone="risk"
                      compact
                    />
                  </div>
                  <IndicatorSummary snapshot={snapshot} scanResult={scanResult} />
                  <p className="mt-4 rounded-md border border-[var(--border)] bg-[#0b0f14] p-3 text-sm leading-6 text-[var(--muted)]">
                    {t.signalSummary[scanResult.signal.state]}
                  </p>
                </div>

                <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4">
                  <ReasonList title={t.scanner.reasons} items={scanResult.reasons} />
                </div>

                {scanResult.warnings.length > 0 && (
                  <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4">
                    <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
                      {t.scanner.warnings}
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
                    title={t.scanner.nextConfirmation}
                    items={scanResult.nextConfirmation}
                  />
                </div>

                <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4">
                  <ReasonList
                    title={t.scanner.invalidation}
                    items={scanResult.invalidation}
                  />
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}

function MultiTimeframePanel({
  activeTimeframe,
  results,
  summary,
  onSelect,
}: {
  activeTimeframe: Timeframe;
  results: ScanResult[];
  summary: MultiTimeframeSummary | null;
  onSelect: (timeframe: Timeframe) => void;
}) {
  const { dictionary: t } = useLanguage();
  const resultByTimeframe = new Map(results.map((result) => [result.timeframe, result]));

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">{t.symbol.timeframeAlignment}</h2>
        {summary ? (
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            <span className="font-semibold text-[var(--foreground)]">
              {t.alignment[summary.alignment]}
            </span>{" "}
            · {t.alignmentSummary[summary.alignment]}
          </p>
        ) : (
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            {t.symbol.loadingAlignment}
          </p>
        )}
      </div>

      <div className="space-y-2">
        {TIMEFRAMES.map((option) => {
          const result = resultByTimeframe.get(option);
          const isActive = option === activeTimeframe;

          return (
            <button
              key={option}
              type="button"
              onClick={() => onSelect(option)}
              className={`w-full rounded-md border p-3 text-left transition ${
                isActive
                  ? "border-[var(--foreground)] bg-[#101923]"
                  : "border-[var(--border)] bg-[#0b0f14] hover:border-[var(--foreground)]"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">
                  {t.timeframe[option]}
                </span>
                <span className="text-xs text-[var(--muted)]">
                  {result
                    ? `${t.common.rank} ${result.rankScore.toFixed(1)}`
                    : t.common.loading}
                </span>
              </div>
              {result ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <SignalBadge signal={result.signal} />
                  <PhaseBadge phase={result.phase} />
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      {summary ? (
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <Metric
            label={t.scanner.constructive}
            value={String(summary.constructiveCount)}
          />
          <Metric label={t.common.risk} value={String(summary.riskCount)} />
        </div>
      ) : null}
    </div>
  );
}

function IndicatorSummary({
  snapshot,
  scanResult,
}: {
  snapshot: ReturnType<typeof calculateIndicatorSnapshot>;
  scanResult: ReturnType<typeof scanCandles>;
}) {
  const { dictionary: t } = useLanguage();
  const rows = [
    [t.common.price, formatPrice(snapshot.close)],
    ["RSI14", formatNullable(snapshot.rsi14, 1)],
    [t.symbol.bbWidth, formatNullable(snapshot.bollinger.widthPercentile, 0)],
    [t.symbol.volumeRatio, formatNullable(snapshot.volume.ratio, 2)],
    ["MA20", formatNullable(snapshot.ma20, 4)],
    ["MA50", formatNullable(snapshot.ma50, 4)],
    ["MA200", formatNullable(snapshot.ma200, 4)],
    [t.symbol.rankScore, scanResult.rankScore.toFixed(1)],
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[#0b0f14] p-3">
      <div className="text-xs text-[var(--muted)]">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
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
