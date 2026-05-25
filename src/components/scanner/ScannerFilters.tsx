import type { MarketPhase, ScannerSignalState } from "@/lib/scanner/types";
import { scannerSignalOrder } from "@/lib/scanner/signal";
import type { ScannerFiltersState } from "./ScannerPageClient";
import { TIMEFRAMES } from "@/lib/exchanges/types";
import { mtfPresetTimeframes, type MtfPreset } from "@/lib/scanner/multiTimeframe";
import { useLanguage } from "@/components/providers/LanguageProvider";

export type ScannerSortKey =
  | "rankScore"
  | "opportunityScore"
  | "confirmationScore"
  | "lowestRiskScore";

type ScannerFiltersProps = {
  filters: ScannerFiltersState;
  onChange: (filters: ScannerFiltersState) => void;
};

const phaseOptions: Array<MarketPhase | "ALL"> = [
  "ALL",
  "BASE_BUILDING",
  "SQUEEZE",
  "BREAKOUT_ATTEMPT",
  "BREAKOUT_CONFIRMED",
  "TRENDING",
  "PULLBACK_HEALTHY",
  "OVEREXTENDED",
  "DISTRIBUTION",
  "BREAKDOWN",
];

const signalOptions: Array<ScannerSignalState | "ALL"> = [
  "ALL",
  ...scannerSignalOrder,
];

export function ScannerFilters({ filters, onChange }: ScannerFiltersProps) {
  const { dictionary: t } = useLanguage();

  function update<K extends keyof ScannerFiltersState>(
    key: K,
    value: ScannerFiltersState[K],
  ) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <aside className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4 xl:sticky xl:top-24 xl:self-start">
      <h2 className="mb-4 text-lg font-semibold">{t.scanner.filters}</h2>
      <div className="space-y-4 text-sm text-[var(--muted)]">
        <label className="block">
          <span className="mb-2 block">{t.scanner.mode}</span>
          <select
            value={filters.mode}
            onChange={(event) =>
              update("mode", event.target.value as ScannerFiltersState["mode"])
            }
            className="w-full rounded-md border border-[var(--border)] bg-[#0b0f14] px-3 py-2 text-[var(--foreground)]"
          >
            <option value="single">{t.scanner.singleMode}</option>
            <option value="mtf">{t.scanner.mtfMode}</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block">{t.scanner.timeframe}</span>
          <select
            value={filters.timeframe}
            disabled={filters.mode === "mtf"}
            onChange={(event) =>
              update("timeframe", event.target.value as ScannerFiltersState["timeframe"])
            }
            className="w-full rounded-md border border-[var(--border)] bg-[#0b0f14] px-3 py-2 text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {TIMEFRAMES.map((timeframe) => (
              <option key={timeframe} value={timeframe}>
                {t.timeframe[timeframe]}
              </option>
            ))}
          </select>
        </label>

        {filters.mode === "mtf" && (
          <label className="block">
            <span className="mb-2 block">{t.scanner.mtfPreset}</span>
            <select
              value={filters.mtfPreset}
              onChange={(event) =>
                update("mtfPreset", event.target.value as MtfPreset)
              }
              className="w-full rounded-md border border-[var(--border)] bg-[#0b0f14] px-3 py-2 text-[var(--foreground)]"
            >
              {(Object.keys(mtfPresetTimeframes) as MtfPreset[]).map((preset) => (
                <option key={preset} value={preset}>
                  {t.mtfPreset[preset]}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block">
          <span className="mb-2 block">{t.common.signal}</span>
          <select
            value={filters.signal}
            onChange={(event) =>
              update("signal", event.target.value as ScannerFiltersState["signal"])
            }
            className="w-full rounded-md border border-[var(--border)] bg-[#0b0f14] px-3 py-2 text-[var(--foreground)]"
          >
            {signalOptions.map((signal) => (
              <option key={signal} value={signal}>
                {signal === "ALL" ? t.scanner.allSignals : t.signal[signal]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block">{t.common.phase}</span>
          <select
            value={filters.phase}
            onChange={(event) =>
              update("phase", event.target.value as ScannerFiltersState["phase"])
            }
            className="w-full rounded-md border border-[var(--border)] bg-[#0b0f14] px-3 py-2 text-[var(--foreground)]"
          >
            {phaseOptions.map((phase) => (
              <option key={phase} value={phase}>
                {phase === "ALL" ? t.scanner.allPhases : t.phase[phase]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block">
            {t.scanner.minOpportunity}: {filters.minOpportunityScore}
          </span>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={filters.minOpportunityScore}
            onChange={(event) =>
              update("minOpportunityScore", Number(event.target.value))
            }
            className="w-full accent-[var(--accent)]"
          />
        </label>

        <label className="block">
          <span className="mb-2 block">
            {t.scanner.maxRisk}: {filters.maxRiskScore}
          </span>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={filters.maxRiskScore}
            onChange={(event) => update("maxRiskScore", Number(event.target.value))}
            className="w-full accent-[var(--warning)]"
          />
        </label>

        <label className="block">
          <span className="mb-2 block">{t.scanner.sortBy}</span>
          <select
            value={filters.sortBy}
            onChange={(event) =>
              update("sortBy", event.target.value as ScannerSortKey)
            }
            className="w-full rounded-md border border-[var(--border)] bg-[#0b0f14] px-3 py-2 text-[var(--foreground)]"
          >
            <option value="rankScore">{t.sort.rankScore}</option>
            <option value="opportunityScore">{t.sort.opportunityScore}</option>
            <option value="confirmationScore">{t.sort.confirmationScore}</option>
            <option value="lowestRiskScore">{t.sort.lowestRiskScore}</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block">{t.scanner.displayLimit}</span>
          <select
            value={filters.limit}
            onChange={(event) => {
              const nextLimit =
                event.target.value === "ALL"
                  ? "ALL"
                  : (Number(event.target.value) as ScannerFiltersState["limit"]);

              update("limit", nextLimit);
            }}
            className="w-full rounded-md border border-[var(--border)] bg-[#0b0f14] px-3 py-2 text-[var(--foreground)]"
          >
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value="ALL">{t.scanner.showAll}</option>
          </select>
        </label>
      </div>
    </aside>
  );
}
