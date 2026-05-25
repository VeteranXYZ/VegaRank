import Link from "next/link";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { PhaseBadge } from "./PhaseBadge";
import { ReasonList } from "./ReasonList";
import { RiskBadge } from "./RiskBadge";
import { ScoreBadge } from "./ScoreBadge";
import { SignalBadge } from "./SignalBadge";
import type { ScanResult } from "@/lib/scanner/types";

type SelectedSymbolPanelProps = {
  result: ScanResult | null;
};

export function SelectedSymbolPanel({ result }: SelectedSymbolPanelProps) {
  const { dictionary: t } = useLanguage();

  if (!result) {
    return (
      <aside className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4 xl:sticky xl:top-24 xl:self-start">
        <h2 className="text-lg font-semibold">{t.scanner.selectedSymbol}</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          {t.scanner.selectedEmpty}
        </p>
      </aside>
    );
  }

  return (
    <aside className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4 xl:sticky xl:top-24 xl:self-start">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{result.symbol}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <PhaseBadge phase={result.phase} />
            <SignalBadge signal={result.signal} />
            {result.multiTimeframe && (
              <span className="inline-flex rounded-md border border-[var(--border)] bg-[#0b0f14] px-2 py-1 text-xs font-semibold text-[var(--foreground)]">
                {t.alignment[result.multiTimeframe.alignment]}
              </span>
            )}
          </div>
        </div>
        <Link
          href={`/symbol/${result.exchange}/${result.symbol}`}
          className="rounded-md border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--foreground)]"
        >
          {t.common.detail}
        </Link>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2">
        <ScoreBadge
          label={t.scanner.columns.opportunity}
          value={result.opportunityScore}
          compact
        />
        <ScoreBadge
          label={t.scanner.columns.confirmation}
          value={result.confirmationScore}
          compact
        />
        <ScoreBadge
          label={t.common.risk}
          value={result.riskScore}
          tone="risk"
          compact
        />
      </div>

      <p className="mb-4 rounded-md border border-[var(--border)] bg-[#0b0f14] p-3 text-sm leading-6 text-[var(--muted)]">
        {t.signalSummary[result.signal.state]}
      </p>

      {result.multiTimeframe && (
        <div className="mb-4 rounded-md border border-[var(--border)] bg-[#0b0f14] p-3 text-sm leading-6 text-[var(--muted)]">
          <div className="font-semibold text-[var(--foreground)]">
            {t.alignment[result.multiTimeframe.alignment]}
          </div>
          <p className="mt-1">
            {t.alignmentSummary[result.multiTimeframe.alignment]}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <Metric
              label={t.scanner.mtfRank}
              value={result.multiTimeframe.rankScore.toFixed(1)}
            />
            <Metric
              label={t.scanner.constructive}
              value={String(result.multiTimeframe.constructiveCount)}
            />
            <Metric label={t.common.risk} value={String(result.multiTimeframe.riskCount)} />
          </div>
          <div className="mt-3 space-y-2">
            {result.multiTimeframe.timeframeResults.map((timeframeResult) => (
              <div
                key={timeframeResult.timeframe}
                className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-2"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[var(--foreground)]">
                    {t.timeframe[timeframeResult.timeframe]}
                  </span>
                  <span className="text-xs tabular-nums">
                    {timeframeResult.rankScore.toFixed(1)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <SignalBadge signal={timeframeResult.signal} />
                  <PhaseBadge phase={timeframeResult.phase} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
        <Metric label={t.common.price} value={formatPrice(result.price)} />
        <Metric label={t.common.rank} value={result.rankScore.toFixed(1)} />
        <Metric label={t.scanner.columns.rsi} value={formatNullable(result.rsi14, 1)} />
        <Metric
          label={t.common.volume}
          value={formatNullable(result.volumeRatio, 2)}
        />
      </div>

      <div className="space-y-4">
        <ReasonList title={t.scanner.reasons} items={result.reasons} />
        {result.warnings.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
              {t.scanner.warnings}
            </h3>
            <div className="space-y-2">
              {result.warnings.map((warning) => (
                <RiskBadge key={warning} label={warning} />
              ))}
            </div>
          </div>
        )}
        <ReasonList title={t.scanner.nextConfirmation} items={result.nextConfirmation} />
        <ReasonList title={t.scanner.invalidation} items={result.invalidation} />
      </div>
    </aside>
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
