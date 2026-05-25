import Link from "next/link";
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
  if (!result) {
    return (
      <aside className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4">
        <h2 className="text-lg font-semibold">Selected Symbol</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Select a scanner row to review its structure, risks, confirmation
          conditions, and invalidation context.
        </p>
      </aside>
    );
  }

  return (
    <aside className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{result.symbol}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <PhaseBadge phase={result.phase} />
            <SignalBadge signal={result.signal} />
          </div>
        </div>
        <Link
          href={`/symbol/${result.exchange}/${result.symbol}`}
          className="rounded-md border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--foreground)]"
        >
          Detail
        </Link>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2">
        <ScoreBadge label="Opp" value={result.opportunityScore} compact />
        <ScoreBadge label="Conf" value={result.confirmationScore} compact />
        <ScoreBadge label="Risk" value={result.riskScore} tone="risk" compact />
      </div>

      <p className="mb-4 rounded-md border border-[var(--border)] bg-[#0b0f14] p-3 text-sm leading-6 text-[var(--muted)]">
        {result.signal.summary}
      </p>

      <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
        <Metric label="Price" value={formatPrice(result.price)} />
        <Metric label="Rank" value={result.rankScore.toFixed(1)} />
        <Metric label="RSI" value={formatNullable(result.rsi14, 1)} />
        <Metric label="Volume" value={formatNullable(result.volumeRatio, 2)} />
      </div>

      <div className="space-y-4">
        <ReasonList title="Reasons" items={result.reasons} />
        {result.warnings.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
              Warnings
            </h3>
            <div className="space-y-2">
              {result.warnings.map((warning) => (
                <RiskBadge key={warning} label={warning} />
              ))}
            </div>
          </div>
        )}
        <ReasonList title="Next Confirmation" items={result.nextConfirmation} />
        <ReasonList title="Invalidation" items={result.invalidation} />
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
