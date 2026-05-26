import {
  mtfPresetTimeframes,
  scannerSignalOrder,
  type MtfPreset,
} from "@/lib/shared/scannerConfig";
import type { ReactNode } from "react";
import type { MarketPhase, ScannerSignalState } from "@/lib/shared/scannerTypes";
import type { ScannerFiltersState } from "./ScannerPageClient";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { TIMEFRAMES } from "@/lib/shared/timeframes";

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
  const presets: Array<{ label: string; filters: ScannerFiltersState }> = [
    { label: t.scanner.resetView, filters: defaultScannerFilters },
    {
      label: t.scanner.quickWatchlist,
      filters: {
        ...defaultScannerFilters,
        mode: "single",
        timeframe: "4h",
        signal: "WATCHLIST",
        minOpportunityScore: 60,
        maxRiskScore: 40,
        sortBy: "opportunityScore",
      },
    },
    {
      label: t.scanner.quickMtfSwing,
      filters: {
        ...defaultScannerFilters,
        mode: "mtf",
        mtfPreset: "swing",
        maxRiskScore: 60,
      },
    },
    {
      label: t.scanner.quickDailyTrend,
      filters: {
        ...defaultScannerFilters,
        mode: "single",
        timeframe: "1d",
        signal: "TREND_CONTINUATION",
        maxRiskScore: 45,
      },
    },
    {
      label: t.scanner.quickCleanRisk,
      filters: {
        ...filters,
        signal: "ALL",
        phase: "ALL",
        maxRiskScore: 35,
        sortBy: "lowestRiskScore",
      },
    },
  ];

  function update<K extends keyof ScannerFiltersState>(
    key: K,
    value: ScannerFiltersState[K],
  ) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <aside className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-3 xl:h-full xl:overflow-y-auto">
      <h2 className="mb-2 text-sm font-semibold">{t.scanner.filters}</h2>
      <div className="space-y-3 text-xs text-[var(--muted)]">
        <FilterSection title={t.scanner.sectionScan}>
          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-wide">
              {t.scanner.mode}
            </span>
            <select
              value={filters.mode}
              onChange={(event) =>
                update("mode", event.target.value as ScannerFiltersState["mode"])
              }
              className={controlClass}
            >
              <option value="single">{t.scanner.singleMode}</option>
              <option value="mtf">{t.scanner.mtfMode}</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-wide">
              {t.scanner.source}
            </span>
            <select
              value={filters.source}
              onChange={(event) =>
                update("source", event.target.value as ScannerFiltersState["source"])
              }
              className={controlClass}
            >
              <option value="remote">{t.scanner.remoteBinanceSource}</option>
              <option value="local">{t.scanner.localSyncedSource}</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-wide">
              {t.scanner.timeframe}
            </span>
            <select
              value={filters.timeframe}
              disabled={filters.mode === "mtf"}
              onChange={(event) =>
                update(
                  "timeframe",
                  event.target.value as ScannerFiltersState["timeframe"],
                )
              }
              className={`${controlClass} disabled:cursor-not-allowed disabled:opacity-50`}
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
              <span className="mb-1 block text-[11px] uppercase tracking-wide">
                {t.scanner.mtfPreset}
              </span>
              <select
                value={filters.mtfPreset}
                onChange={(event) =>
                  update("mtfPreset", event.target.value as MtfPreset)
                }
                className={controlClass}
              >
                {(Object.keys(mtfPresetTimeframes) as MtfPreset[]).map((preset) => (
                  <option key={preset} value={preset}>
                    {t.mtfPreset[preset]}
                  </option>
                ))}
              </select>
            </label>
          )}
        </FilterSection>

        <FilterSection title={t.scanner.sectionUniverse}>
          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-wide">
              {t.scanner.maxSymbols}
            </span>
            <select
              value={filters.maxSymbols}
              onChange={(event) => {
                const nextValue =
                  event.target.value === "ALL"
                    ? "ALL"
                    : (Number(
                        event.target.value,
                      ) as ScannerFiltersState["maxSymbols"]);

                update("maxSymbols", nextValue);
              }}
              className={controlClass}
            >
              <option value="ALL">{t.scanner.allEligible}</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={400}>400</option>
              <option value={600}>600</option>
            </select>
            <span className="mt-1 block text-[11px] leading-4 text-[var(--muted)]">
              {t.scanner.maxSymbolsHelp}
            </span>
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-wide">
              {t.scanner.minQuoteVolume}
            </span>
            <input
              type="number"
              min="0"
              step="1000000"
              value={filters.minQuoteVolume}
              onChange={(event) =>
                update("minQuoteVolume", Number(event.target.value))
              }
              className={controlClass}
            />
          </label>
        </FilterSection>

        <FilterSection title={t.scanner.sectionFilters}>
          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-wide">
              {t.common.signal}
            </span>
          <select
            value={filters.signal}
            onChange={(event) =>
              update("signal", event.target.value as ScannerFiltersState["signal"])
            }
              className={controlClass}
          >
            {signalOptions.map((signal) => (
              <option key={signal} value={signal}>
                {signal === "ALL" ? t.scanner.allSignals : t.signal[signal]}
              </option>
            ))}
          </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-wide">
              {t.common.phase}
            </span>
          <select
            value={filters.phase}
            onChange={(event) =>
              update("phase", event.target.value as ScannerFiltersState["phase"])
            }
              className={controlClass}
          >
            {phaseOptions.map((phase) => (
              <option key={phase} value={phase}>
                {phase === "ALL" ? t.scanner.allPhases : t.phase[phase]}
              </option>
            ))}
          </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-wide">
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
            <span className="mb-1 block text-[11px] uppercase tracking-wide">
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
        </FilterSection>

        <FilterSection title={t.scanner.sectionView}>
          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-wide">
              {t.scanner.sortBy}
            </span>
          <select
            value={filters.sortBy}
            onChange={(event) =>
              update("sortBy", event.target.value as ScannerSortKey)
            }
              className={controlClass}
          >
            <option value="rankScore">{t.sort.rankScore}</option>
            <option value="opportunityScore">{t.sort.opportunityScore}</option>
            <option value="confirmationScore">{t.sort.confirmationScore}</option>
            <option value="lowestRiskScore">{t.sort.lowestRiskScore}</option>
          </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-wide">
              {t.scanner.displayLimit}
            </span>
          <select
            value={filters.limit}
            onChange={(event) => {
              const nextLimit =
                event.target.value === "ALL"
                  ? "ALL"
                  : (Number(event.target.value) as ScannerFiltersState["limit"]);

              update("limit", nextLimit);
            }}
              className={controlClass}
          >
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value="ALL">{t.scanner.showAll}</option>
          </select>
          </label>
        </FilterSection>

        <FilterSection title={t.scanner.sectionPresets}>
          <div className="grid grid-cols-2 gap-1.5">
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => onChange(preset.filters)}
                className="min-h-7 rounded border border-[var(--border)] bg-[#0b0f14] px-2 py-1 text-left text-[11px] font-semibold text-[var(--foreground)] transition hover:border-[var(--foreground)]"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </FilterSection>
      </div>
    </aside>
  );
}

const controlClass =
  "h-8 w-full rounded border border-[var(--border)] bg-[#0b0f14] px-2 text-xs text-[var(--foreground)]";

const defaultScannerFilters: ScannerFiltersState = {
  mode: "single",
  source: "remote",
  timeframe: "4h",
  mtfPreset: "short",
  signal: "ALL",
  phase: "ALL",
  minOpportunityScore: 0,
  maxRiskScore: 100,
  minQuoteVolume: 0,
  maxSymbols: "ALL",
  sortBy: "rankScore",
  limit: 50,
};

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2 border-t border-[var(--border)] pt-2 first:border-t-0 first:pt-0">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-2)]">
        {title}
      </h3>
      {children}
    </section>
  );
}
