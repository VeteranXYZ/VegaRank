"use client";

import { useState } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { formatScannerExplanation } from "@/lib/i18n/formatScannerExplanation";
import type { ScannerExplanation } from "@/lib/shared/rankingTypes";
import type { Timeframe } from "@/lib/shared/timeframes";

type MatchMode = "broad" | "standard" | "similar";

type HistoricalBehaviorResponse = {
  symbol: string;
  timeframe: Timeframe;
  limit: number;
  matchMode: MatchMode;
  sampleCount: number;
  sampleQuality: "none" | "low" | "medium" | "good";
  summaryKey: keyof ReturnType<typeof useLanguage>["dictionary"]["backtest"]["summary"];
  horizons: Array<{
    candles: 1 | 3 | 5 | 10;
    label: string;
    sampleCount: number;
    averageReturnPct: number;
    medianReturnPct: number;
    winRatePct: number;
    averageMfePct: number;
    averageMaePct: number;
    bestReturnPct: number;
    worstReturnPct: number;
  }>;
  falseBreakoutRatePct: number | null;
  warnings: ScannerExplanation[];
  notes: ScannerExplanation[];
  recentSamples: Array<{
    signalTime: string;
    signalClose: number;
    return5K: number;
    mfe5K: number;
    mae5K: number;
  }>;
};

type HistoricalBehaviorPanelProps = {
  symbol: string;
  timeframe: Timeframe;
};

export function HistoricalBehaviorPanel({
  symbol,
  timeframe,
}: HistoricalBehaviorPanelProps) {
  const { dictionary: t } = useLanguage();
  const [matchMode, setMatchMode] = useState<MatchMode>("standard");
  const [data, setData] = useState<{
    key: string;
    value: HistoricalBehaviorResponse;
  } | null>(null);
  const [error, setError] = useState<{ key: string; value: string } | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const requestKey = `${symbol}:${timeframe}:${matchMode}`;
  const currentData = data?.key === requestKey ? data.value : null;
  const currentError = error?.key === requestKey ? error.value : null;
  const isLoading = loadingKey === requestKey;

  async function runReview() {
    setLoadingKey(requestKey);
    setError(null);

    try {
      const params = new URLSearchParams({
        symbol,
        timeframe,
        matchMode,
      });
      const response = await fetch(`/api/backtest/symbol?${params.toString()}`);
      const body = (await response.json()) as HistoricalBehaviorResponse & {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(body.message ?? body.error ?? t.backtest.error);
      }

      setData({ key: requestKey, value: body });
    } catch {
      setError({
        key: requestKey,
        value: t.backtest.error,
      });
    } finally {
      setLoadingKey(null);
    }
  }

  return (
    <section className="border-t border-[var(--border)] pt-2">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          {t.backtest.title}
        </h3>
        <details className="text-[10px] text-[var(--muted)]">
          <summary className="cursor-pointer list-none text-[var(--info)]">
            {t.scanner.helpLabel}
          </summary>
          <p className="mt-1 max-w-xs leading-4">{t.backtest.notes}</p>
        </details>
      </div>

      <div className="mb-2 grid grid-cols-[1fr_auto] gap-1">
        <div className="grid grid-cols-[1fr_auto] items-center gap-1">
          <label className="block">
            <span className="sr-only">{t.backtest.matchMode}</span>
            <select
              value={matchMode}
              onChange={(event) => setMatchMode(event.target.value as MatchMode)}
              className="h-7 w-full border border-[var(--border)] bg-[var(--control)] px-2 text-xs text-[var(--foreground)]"
            >
              <option value="broad">{t.backtest.broad}</option>
              <option value="standard">{t.backtest.standard}</option>
              <option value="similar">{t.backtest.similar}</option>
            </select>
          </label>
          <details className="relative text-[10px] text-[var(--muted)]">
            <summary
              className="flex h-7 w-7 cursor-pointer list-none items-center justify-center border border-[var(--border)] text-[var(--info)]"
              aria-label={t.backtest.matchModeHelpTitle}
            >
              ?
            </summary>
            <div className="absolute right-0 z-20 mt-1 w-64 border border-[var(--border)] bg-[var(--control)] p-2 leading-4 shadow-xl">
              <p>{t.backtest.matchModeHelp.broad}</p>
              <p className="mt-1">{t.backtest.matchModeHelp.standard}</p>
              <p className="mt-1">{t.backtest.matchModeHelp.similar}</p>
            </div>
          </details>
        </div>
        <button
          type="button"
          onClick={() => void runReview()}
          disabled={isLoading}
          className="h-7 border border-[var(--border)] px-2 text-[11px] font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {t.backtest.reviewSetup}
        </button>
      </div>

      {isLoading && (
        <p className="text-[11px] leading-5 text-[var(--muted)]">
          {t.backtest.loading}
        </p>
      )}

      {currentError && (
        <p className="border-l border-[var(--danger)] bg-[var(--danger-bg)] px-2 py-1 text-[11px] leading-5 text-[var(--danger)]">
          {currentError}
        </p>
      )}

      {currentData && <HistoricalBehaviorResult data={currentData} />}
    </section>
  );
}

export function HistoricalBehaviorResult({
  data,
}: {
  data: HistoricalBehaviorResponse;
}) {
  const { dictionary: t } = useLanguage();
  const isRiskSummary =
    data.summaryKey === "backtest.summary.highFakeoutRisk" ||
    data.summaryKey === "backtest.summary.highVolatility";
  const showSmallSampleWarning = data.sampleQuality === "low";

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <div className="text-[11px] font-medium leading-5 text-[var(--foreground)]">
          {data.symbol} · {data.timeframe} · {t.backtest.matchModeMeta[data.matchMode]} ·{" "}
          {data.sampleCount} {t.backtest.sampleUnit} ·{" "}
          {t.backtest.quality[data.sampleQuality]}
        </div>
        <details className="text-[10px] text-[var(--muted)]">
          <summary className="cursor-pointer list-none text-[var(--info)]">
            {t.backtest.sampleQualityHelpTitle}
          </summary>
          <p className="mt-1 leading-4">{t.backtest.sampleQualityHelp}</p>
        </details>
      </div>

      <p
        className={[
          "border-l bg-[var(--panel-2)] px-2 py-1 text-[11px] leading-5",
          isRiskSummary
            ? "border-[var(--warning)] text-[var(--warning)]"
            : "border-[var(--border)] text-[var(--muted)]",
        ].join(" ")}
      >
        {t.backtest.summary[data.summaryKey]}
      </p>

      {showSmallSampleWarning && (
        <p className="border-l border-[var(--warning)] bg-[var(--warning-bg)] px-2 py-1 text-[11px] leading-5 text-[var(--warning)]">
          {t.backtest.smallSampleWarning}
        </p>
      )}

      {data.falseBreakoutRatePct !== null && (
        <p className="text-[11px] leading-5 text-[var(--muted)]">
          <span className="font-semibold text-[var(--warning)]">
            {t.backtest.fakeoutRate} {formatPct(data.falseBreakoutRatePct)}
          </span>{" "}
          · {t.backtest.fakeoutExplanation}
        </p>
      )}

      {data.sampleCount === 0 ? (
        <p className="text-[11px] text-[var(--muted)]">{t.backtest.noSamples}</p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              {t.backtest.forwardStats}
            </span>
            <details className="relative text-[10px] text-[var(--muted)]">
              <summary
                className="cursor-pointer list-none text-[var(--info)]"
                aria-label={t.backtest.metricHelpTitle}
              >
                ?
              </summary>
              <div className="absolute right-0 z-20 mt-1 w-72 border border-[var(--border)] bg-[var(--control)] p-2 leading-4 shadow-xl">
                {t.backtest.metricHelp.map((line) => (
                  <p key={line} className="mb-1 last:mb-0">
                    {line}
                  </p>
                ))}
              </div>
            </details>
          </div>
          <table className="w-full table-fixed border-collapse text-[10px] tabular-nums">
            <thead className="text-[var(--muted)]">
              <tr className="border-b border-[var(--border)]">
                <th className="py-1 text-left">{t.backtest.horizon}</th>
                <th className="py-1 text-right">{t.backtest.average}</th>
                <th className="py-1 text-right">{t.backtest.median}</th>
                <th className="py-1 text-right">{t.backtest.win}</th>
                <th className="py-1 text-right">MFE</th>
                <th className="py-1 text-right">MAE</th>
                <th className="py-1 text-right">{t.backtest.best}</th>
                <th className="py-1 text-right">{t.backtest.worst}</th>
              </tr>
            </thead>
            <tbody>
              {data.horizons.map((horizon) => (
                <tr key={horizon.label} className="border-b border-[var(--border)]">
                  <td className="py-1 text-left font-semibold">{horizon.label}</td>
                  <td className="py-1 text-right">{formatPct(horizon.averageReturnPct)}</td>
                  <td className="py-1 text-right">{formatPct(horizon.medianReturnPct)}</td>
                  <td className="py-1 text-right">{formatPct(horizon.winRatePct)}</td>
                  <td className="py-1 text-right">{formatPct(horizon.averageMfePct)}</td>
                  <td className="py-1 text-right">{formatPct(horizon.averageMaePct)}</td>
                  <td className="py-1 text-right">{formatPct(horizon.bestReturnPct)}</td>
                  <td className="py-1 text-right">{formatPct(horizon.worstReturnPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div className="space-y-1 text-[11px] leading-5 text-[var(--muted)]">
        {data.warnings.length > 0 && (
          <div className="text-[var(--warning)]">
            {data.warnings.map((warning) => formatScannerExplanation(warning, t)).join(" · ")}
          </div>
        )}
        {data.recentSamples.length > 0 && (
          <details>
            <summary className="cursor-pointer list-none text-[var(--info)]">
              {t.backtest.recentSamples}
            </summary>
            <table className="mt-1 w-full table-fixed border-collapse text-[10px] tabular-nums">
              <thead className="text-[var(--muted)]">
                <tr className="border-b border-[var(--border)]">
                  <th className="py-1 text-left">{t.backtest.time}</th>
                  <th className="py-1 text-right">{t.backtest.close}</th>
                  <th className="py-1 text-right">{t.backtest.return5K}</th>
                  <th className="py-1 text-right">MFE</th>
                  <th className="py-1 text-right">MAE</th>
                </tr>
              </thead>
              <tbody>
                {data.recentSamples.slice(0, 5).map((sample) => (
                  <tr key={sample.signalTime} className="border-b border-[var(--border)]">
                    <td className="truncate py-1 text-left">
                      {formatShortDate(sample.signalTime)}
                    </td>
                    <td className="py-1 text-right">{formatPrice(sample.signalClose)}</td>
                    <td className="py-1 text-right">{formatPct(sample.return5K)}</td>
                    <td className="py-1 text-right">{formatPct(sample.mfe5K)}</td>
                    <td className="py-1 text-right">{formatPct(sample.mae5K)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
        <details>
          <summary className="cursor-pointer list-none text-[var(--info)]">
            {t.scanner.notes}
          </summary>
          <div className="mt-1">
            {data.notes.map((note) => formatScannerExplanation(note, t)).join(" · ")}
          </div>
        </details>
      </div>
    </div>
  );
}

function formatPct(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatShortDate(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function formatPrice(value: number) {
  if (value >= 100) {
    return value.toFixed(2);
  }

  if (value >= 1) {
    return value.toFixed(4);
  }

  return value.toPrecision(4);
}
