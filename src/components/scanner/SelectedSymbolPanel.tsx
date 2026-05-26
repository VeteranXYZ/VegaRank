import Link from "next/link";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { PhaseBadge } from "./PhaseBadge";
import { ReasonList } from "./ReasonList";
import { RiskBadge } from "./RiskBadge";
import { SignalBadge } from "./SignalBadge";
import { StrategyReadPanel } from "./StrategyReadPanel";
import { HistoricalBehaviorPanel } from "./HistoricalBehaviorPanel";
import type { ScanResult } from "@/lib/shared/scannerTypes";
import { formatScannerExplanation } from "@/lib/i18n/formatScannerExplanation";
import type { ReactNode } from "react";

type SelectedSymbolPanelProps = {
  result: ScanResult | null;
};

export function SelectedSymbolPanel({ result }: SelectedSymbolPanelProps) {
  const { dictionary: t } = useLanguage();

  if (!result) {
    return (
      <aside className="border border-[var(--border)] bg-[var(--panel)] p-2.5 xl:h-full xl:overflow-y-auto">
        <h2 className="text-sm font-semibold leading-none">{t.scanner.selectedSymbol}</h2>
        <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
          {t.scanner.selectedEmpty}
        </p>
      </aside>
    );
  }

  return (
    <aside className="xl:h-full xl:overflow-y-auto">
      <section className="border border-[var(--border)] bg-[var(--panel)] p-2.5">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold leading-tight">{result.symbol}</h2>
            <div className="mt-1 flex flex-wrap gap-1">
              <PhaseBadge phase={result.phase} />
              <SignalBadge signal={result.signal} />
              {result.multiTimeframe && (
                <span className="inline-flex h-5 items-center border border-[var(--border)] bg-[#0b0f14] px-1.5 text-[11px] font-semibold text-[var(--foreground)]">
                  {t.alignment[result.multiTimeframe.alignment]}
                </span>
              )}
            </div>
          </div>
          <Link
            href={`/symbol/${result.exchange}/${result.symbol}`}
            className="h-6 border border-[var(--border)] px-2 py-0.5 text-[11px] font-semibold text-[var(--foreground)]"
          >
            {t.common.detail}
          </Link>
        </div>

        <div className="mb-2 grid grid-cols-4 gap-1">
          <Metric label={t.common.rank} value={result.rankScore.toFixed(1)} />
          <Metric label="O" value={result.opportunityScore.toFixed(0)} />
          <Metric label="C" value={result.confirmationScore.toFixed(0)} />
          <Metric label="R" value={result.riskScore.toFixed(0)} />
        </div>

        <p className="mb-2 border-l-2 border-[var(--border)] bg-[#0b0f14]/45 px-2 py-1 text-[11px] leading-5 text-[var(--muted)]">
          {t.signalSummary[result.signal.state]}
        </p>

        {result.multiTimeframe && (
          <div className="mb-2 border-t border-[var(--border)] pt-2 text-xs leading-5 text-[var(--muted)]">
            <div className="font-semibold text-[var(--foreground)]">
              {t.alignment[result.multiTimeframe.alignment]}
            </div>
            <p className="mt-1">
              {t.alignmentSummary[result.multiTimeframe.alignment]}
            </p>
            <div className="mt-1.5 grid grid-cols-3 gap-1">
              <Metric
                label={t.scanner.mtfRank}
                value={result.multiTimeframe.rankScore.toFixed(1)}
              />
              <Metric
                label={t.scanner.constructive}
                value={String(result.multiTimeframe.constructiveCount)}
              />
              <Metric
                label={t.common.risk}
                value={String(result.multiTimeframe.riskCount)}
              />
            </div>
            <div className="mt-1.5 space-y-1">
              {result.multiTimeframe.timeframeResults.map((timeframeResult) => (
                <div
                  key={timeframeResult.timeframe}
                  className="border border-[var(--border)] bg-[#0b0f14]/55 px-2 py-1"
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[var(--foreground)]">
                      {t.timeframe[timeframeResult.timeframe]}
                    </span>
                    <span className="text-xs tabular-nums">
                      {timeframeResult.rankScore.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <SignalBadge signal={timeframeResult.signal} />
                    <PhaseBadge phase={timeframeResult.phase} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <InspectorSection title={t.scanner.marketMetrics}>
          <div className="space-y-1">
            <KeyValue label={t.common.price} value={formatPrice(result.price)} />
            <KeyValue
              label={t.scanner.columns.rsi}
              value={formatNullable(result.rsi14, 1)}
            />
            <KeyValue
              label={t.common.volume}
              value={formatNullable(result.volumeRatio, 2)}
            />
            <KeyValue label={t.scanner.macd} value={formatMacdStatus(result, t)} />
          </div>
        </InspectorSection>

        <InspectorSection title={t.scanner.volumeDetails}>
          <div className="space-y-1">
            <KeyValue
              label={t.scanner.volumeLatest}
              value={formatCompactNumber(result.volume.latest)}
            />
            <KeyValue
              label={t.scanner.volumeMa20}
              value={formatNullable(result.volume.ma20, 0)}
            />
            <KeyValue
              label={t.scanner.volumeRatio20}
              value={formatNullable(result.volume.ratio20, 2)}
            />
            <KeyValue
              label={t.scanner.volumeState}
              value={formatVolumeState(result, t)}
            />
          </div>
        </InspectorSection>

        <div className="space-y-2 border-t border-[var(--border)] pt-2">
          <ReasonList title={t.scanner.reasons} items={result.reasons} />
          {result.warnings.length > 0 && (
            <div>
              <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                {t.scanner.warnings}
              </h3>
              <div className="space-y-1">
                {result.warnings.map((warning) => (
                  <RiskBadge
                    key={`${warning.key}-${JSON.stringify(warning.params ?? {})}`}
                    label={formatScannerExplanation(warning, t)}
                  />
                ))}
              </div>
            </div>
          )}
          <ReasonList
            title={t.scanner.nextConfirmation}
            items={result.nextConfirmation}
          />
          <ReasonList title={t.scanner.invalidation} items={result.invalidation} />
        </div>

        <div className="mt-2">
          <HistoricalBehaviorPanel
            symbol={result.symbol}
            timeframe={result.timeframe}
          />
        </div>

        <details className="mt-2 border-t border-[var(--border)] pt-2">
          <summary className="cursor-pointer list-none text-[10px] font-semibold uppercase tracking-wide text-[var(--info)]">
            {t.strategy.title}
          </summary>
          <div className="mt-2">
            <StrategyReadPanel result={result} />
          </div>
        </details>
      </section>
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[var(--border)] bg-[#0b0f14]/65 px-1.5 py-1">
      <div className="truncate text-[10px] uppercase tracking-wide text-[var(--muted)]">
        {label}
      </div>
      <div className="mt-0.5 truncate text-xs font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-6 items-center justify-between gap-3 border-b border-[var(--border)] pb-1 last:border-b-0 last:pb-0">
      <span className="truncate text-[10px] uppercase tracking-wide text-[var(--muted)]">
        {label}
      </span>
      <span className="truncate text-right text-xs font-semibold tabular-nums text-[var(--foreground)]">
        {value}
      </span>
    </div>
  );
}

function InspectorSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-2 border-t border-[var(--border)] pt-2">
      <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
        {title}
      </h3>
      {children}
    </section>
  );
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

function formatCompactNumber(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "n/a";
  }

  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatMacdStatus(
  result: ScanResult,
  dictionary: ReturnType<typeof useLanguage>["dictionary"],
) {
  if (!result.macd) {
    return dictionary.scanner.macdUnavailable;
  }

  if (result.macd.bearishCross || !result.macd.histogramRising) {
    return dictionary.scanner.macdWeakening;
  }

  if (result.macd.bullishCross) {
    return dictionary.scanner.macdBullishCross;
  }

  if (result.macd.aboveZero) {
    return dictionary.scanner.macdAboveZero;
  }

  return dictionary.scanner.macdImproving;
}

function formatVolumeState(
  result: ScanResult,
  dictionary: ReturnType<typeof useLanguage>["dictionary"],
) {
  if (result.volume.distributionWarning) {
    return dictionary.scanner.volumeDistributionWarning;
  }

  if (result.volume.abnormalSpike) {
    return dictionary.scanner.volumeAbnormalSpike;
  }

  if (result.volume.breakoutConfirmed) {
    return dictionary.scanner.volumeBreakoutConfirmed;
  }

  if (result.volume.pullbackHealthy) {
    return dictionary.scanner.volumePullbackHealthy;
  }

  if (result.volume.expanding) {
    return dictionary.scanner.volumeExpanding;
  }

  if (result.volume.dryUp) {
    return dictionary.scanner.volumeDryUp;
  }

  return dictionary.scanner.volumeNeutral;
}
