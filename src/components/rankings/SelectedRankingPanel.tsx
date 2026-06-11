import Link from "next/link";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { useAppLanguage } from "@/lib/i18n/AppLanguageProvider";
import { explainCode, explainCodes } from "@/lib/vegarank-codebook/explainCode";
import type { ScannerCodeContractResult } from "@/lib/vegarank-codebook/serializeScanResult";
import type { Timeframe } from "@/lib/shared/timeframes";
import { HistoricalBehaviorPanel } from "./HistoricalBehaviorPanel";
import type { ReactNode } from "react";

type SelectedRankingPanelProps = {
  result: ScannerCodeContractResult | null;
};

export function SelectedRankingPanel({ result }: SelectedRankingPanelProps) {
  const { dictionary: t } = useLanguage();
  const { language } = useAppLanguage();

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

  const group = explainCode(result.groupCode, language);
  const action = explainCode(result.actionCode, language);
  const setup = explainCode(result.setupCode, language);
  const phase = explainCode(result.phaseCode, language);
  const signalLabels = explainCodes(result.signalCodes, language).map(
    (entry) => entry.label,
  );
  const riskLabels = explainCodes(result.riskCodes, language).map(
    (entry) => entry.label,
  );
  const reasonLines = explainCodes(result.reasonCodes, language).map(
    (entry) => `${entry.label}: ${entry.short}`,
  );
  const qualityLabels = explainCodes(result.qualityCodes, language).map(
    (entry) => entry.label,
  );

  return (
    <aside className="xl:h-full xl:overflow-y-auto">
      <section className="border border-[var(--border)] bg-[var(--panel)] p-2.5">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold leading-tight">{result.symbol}</h2>
            <div className="mt-1 flex flex-wrap gap-1">
              <CodeChip code={result.groupCode} label={group.label} />
              <CodeChip code={result.actionCode} label={action.label} />
              <CodeChip code={result.setupCode} label={setup.label} />
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
          <Metric label="Rank" value={formatSigned(result.metrics.rankScore, 1)} />
          <Metric label="O" value={formatSigned(result.metrics.opportunityScore, 0)} />
          <Metric label="C" value={formatSigned(result.metrics.confirmationScore, 0)} />
          <Metric label="R" value={formatSigned(result.metrics.riskScore, 0)} />
        </div>

        <p className="mb-2 border-l-2 border-[var(--border)] bg-[var(--panel-2)] px-2 py-1 text-[11px] leading-5 text-[var(--muted)]">
          {group.short} {action.short}
        </p>

        <InspectorSection title="Code Contract">
          <div className="space-y-1">
            <KeyValue label="Group" value={`${result.groupCode} · ${group.label}`} />
            <KeyValue label="Action" value={`${result.actionCode} · ${action.label}`} />
            <KeyValue label="Setup" value={`${result.setupCode} · ${setup.label}`} />
            <KeyValue label="Phase" value={`${result.phaseCode} · ${phase.label}`} />
            <TagList label="Signals" items={signalLabels} />
            <TagList label="Risks" items={riskLabels} />
            <TagList label="Quality" items={qualityLabels} />
          </div>
        </InspectorSection>

        <InspectorSection title="Score Breakdown">
          <div className="grid grid-cols-2 gap-1">
            <Metric label="Final" value={formatSigned(result.metrics.finalSignalScore, 1)} />
            <Metric label="Setup" value={formatSigned(result.metrics.opportunityScore, 0)} />
            <Metric label="Confirm" value={formatSigned(result.metrics.confirmationScore, 0)} />
            <Metric label="Risk" value={formatSigned(result.metrics.riskScore, 0)} />
            <Metric label="Trend" value={formatSigned(result.metrics.trendScore, 0)} />
            <Metric label="Momentum" value={formatSigned(result.metrics.momentumScore, 0)} />
            <Metric label="Volume" value={formatSigned(result.metrics.volumeScore, 0)} />
            <Metric label="Structure" value={formatSigned(result.metrics.structureScore, 0)} />
          </div>
        </InspectorSection>

        <InspectorSection title="Market Metrics">
          <div className="space-y-1">
            <KeyValue label={t.common.price} value={formatPrice(result.metrics.price)} />
            <KeyValue label={t.scanner.columns.rsi} value={formatNullable(result.metrics.rsi14, 1)} />
            <KeyValue label={t.common.volume} value={formatNullable(result.metrics.volumeRatio, 2)} />
            <KeyValue label="History Bars" value={formatInteger(result.metrics.historyBars)} />
          </div>
        </InspectorSection>

        <InspectorSection title="Reason Codes">
          <TextList values={reasonLines} />
        </InspectorSection>

        <InspectorSection title="Versions">
          <div className="space-y-1">
            <KeyValue label="Engine" value={result.scannerVersion} />
            <KeyValue label="Code Schema" value={result.codeSchemaVersion} />
            <KeyValue label="Dictionary" value={result.dictionaryVersion} />
          </div>
        </InspectorSection>

        <div className="mt-2">
          <HistoricalBehaviorPanel
            symbol={result.symbol}
            timeframe={normalizeTimeframe(result.timeframe)}
          />
        </div>
      </section>
    </aside>
  );
}

function CodeChip({ code, label }: { code: string; label: string }) {
  return (
    <span className="inline-flex h-5 items-center border border-[var(--border)] bg-[var(--control)] px-1.5 text-[11px] font-semibold text-[var(--foreground)]">
      {label}
      <span className="ml-1 font-mono text-[9px] text-[var(--muted)]">{code}</span>
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[var(--border)] bg-[var(--panel-2)] px-1.5 py-1">
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

function TagList({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="border-b border-[var(--border)] pb-1 last:border-b-0 last:pb-0">
      <div className="mb-1 text-[10px] uppercase tracking-wide text-[var(--muted)]">
        {label}
      </div>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {items.map((item) => (
            <span
              key={item}
              className="border border-[var(--border)] bg-[var(--control)] px-1.5 py-0.5 text-[10px] text-[var(--foreground)]"
            >
              {item}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-xs text-[var(--muted)]">n/a</span>
      )}
    </div>
  );
}

function TextList({ values }: { values: string[] }) {
  if (values.length === 0) {
    return <span className="text-xs text-[var(--muted)]">n/a</span>;
  }

  return (
    <ul className="space-y-1 text-xs leading-5 text-[var(--foreground)]">
      {values.map((item) => (
        <li key={item} className="border-l-2 border-[var(--border)] pl-2">
          {item}
        </li>
      ))}
    </ul>
  );
}

function formatNullable(value: number | null, decimals: number) {
  return value === null ? "n/a" : value.toFixed(decimals);
}

function formatSigned(value: number | null, decimals: number) {
  if (value === null) {
    return "n/a";
  }

  const formatted = value.toFixed(decimals);
  return value > 0 ? `+${formatted}` : formatted;
}

function formatInteger(value: number | null) {
  return value === null ? "n/a" : new Intl.NumberFormat().format(value);
}

function formatPrice(value: number | null) {
  if (value === null) {
    return "n/a";
  }

  if (value >= 100) {
    return value.toFixed(2);
  }

  if (value >= 1) {
    return value.toFixed(4);
  }

  return value.toFixed(6);
}

function normalizeTimeframe(value: string): Timeframe {
  return value === "1h" ||
    value === "4h" ||
    value === "1d" ||
    value === "1w" ||
    value === "1M"
    ? value
    : "4h";
}
