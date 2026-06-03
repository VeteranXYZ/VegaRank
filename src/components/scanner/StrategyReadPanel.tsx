import { useLanguage } from "@/components/providers/LanguageProvider";
import type { ScanResult } from "@/lib/shared/scannerTypes";

type StrategyReadPanelProps = {
  result: ScanResult;
};

export function StrategyReadPanel({ result }: StrategyReadPanelProps) {
  const { dictionary: t } = useLanguage();
  const missingIndicators = result.dataQuality.missingIndicators;

  return (
    <section className="rounded-md border border-[var(--border)] bg-[var(--panel-2)] p-3">
      <h2 className="mb-2 text-sm font-semibold">{t.strategy.title}</h2>

      <div className="space-y-2">
        <ReadBlock
          label={t.strategy.phaseRead}
          value={t.phase[result.phase]}
          text={t.strategy.phaseRule[result.phase]}
        />
        <ReadBlock
          label={t.strategy.signalRead}
          value={t.signal[result.signal.state]}
          text={getSignalReadText(result, t)}
        />
      </div>

      <div className="mt-3 border-t border-[var(--border)] pt-3">
        <div className="text-xs font-semibold">{t.strategy.scoringModel}</div>
        <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
          {t.strategy.scoreWeights}
        </p>
        <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
          {t.strategy.volumeContext}
        </p>
        <div className="mt-2 space-y-2">
          <ScoreRow
            label={t.scanner.columns.opportunity}
            value={result.opportunityScore}
            help={t.strategy.opportunityHelp}
          />
          <ScoreRow
            label={t.scanner.columns.confirmation}
            value={result.confirmationScore}
            help={t.strategy.confirmationHelp}
          />
          <ScoreRow
            label={t.common.risk}
            value={result.riskScore}
            help={t.strategy.riskHelp}
            risk
          />
        </div>
      </div>

      <div className="mt-3 border-t border-[var(--border)] pt-3">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-semibold">{t.strategy.dataQuality}</span>
          <span className="tabular-nums text-[var(--muted)]">
            {result.dataQuality.candleCount} {t.strategy.candles}
          </span>
        </div>
        <p className="mt-1.5 text-xs text-[var(--muted)]">
          {result.dataQuality.sufficientHistory
            ? t.strategy.sufficientHistory
            : t.strategy.limitedHistory}
        </p>
        {missingIndicators.length > 0 && (
          <p className="mt-1.5 text-xs text-[var(--warning)]">
            {t.strategy.missingIndicators}: {missingIndicators.join(", ")}
          </p>
        )}
      </div>
    </section>
  );
}

function getSignalReadText(
  result: ScanResult,
  t: ReturnType<typeof useLanguage>["dictionary"],
) {
  if (
    result.signal.state === "WATCHLIST" &&
    result.phase === "BREAKOUT_ATTEMPT" &&
    result.confirmationScore >= 70 &&
    result.riskScore <= 25
  ) {
    return t.strategy.signalRuleBreakoutWatchlist;
  }

  return t.strategy.signalRule[result.signal.state];
}

function ReadBlock({
  label,
  value,
  text,
}: {
  label: string;
  value: string;
  text: string;
}) {
  return (
    <div className="rounded border border-[var(--border)] bg-[var(--panel-2)] px-2 py-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
          {label}
        </span>
        <span className="rounded bg-[var(--row-selected)] px-1.5 py-0.5 text-[11px] font-semibold">
          {value}
        </span>
      </div>
      <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">{text}</p>
    </div>
  );
}

function ScoreRow({
  label,
  value,
  help,
  risk = false,
}: {
  label: string;
  value: number;
  help: string;
  risk?: boolean;
}) {
  const width = `${Math.max(0, Math.min(100, value))}%`;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span>{label}</span>
        <span className="tabular-nums text-[var(--muted)]">{value.toFixed(0)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--panel-strong)]">
        <div
          className={`h-full rounded-full ${
            risk ? "bg-[var(--warning)]" : "bg-[var(--accent)]"
          }`}
          style={{ width }}
        />
      </div>
      <p className="mt-1 text-[11px] leading-4 text-[var(--muted)]">{help}</p>
    </div>
  );
}
