import type { MarketPhase, ScannerSignalState } from "@/lib/scanner/types";
import { scannerSignalLabels, scannerSignalOrder } from "@/lib/scanner/signal";
import type { ScannerFiltersState } from "./ScannerPageClient";
import { TIMEFRAMES, timeframeLabels } from "@/lib/exchanges/types";
import {
  mtfPresetLabels,
  type MtfPreset,
} from "@/lib/scanner/multiTimeframe";

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
  function update<K extends keyof ScannerFiltersState>(
    key: K,
    value: ScannerFiltersState[K],
  ) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <aside className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4">
      <h2 className="mb-4 text-lg font-semibold">Filters</h2>
      <div className="space-y-4 text-sm text-[var(--muted)]">
        <label className="block">
          <span className="mb-2 block">Mode</span>
          <select
            value={filters.mode}
            onChange={(event) =>
              update("mode", event.target.value as ScannerFiltersState["mode"])
            }
            className="w-full rounded-md border border-[var(--border)] bg-[#0b0f14] px-3 py-2 text-[var(--foreground)]"
          >
            <option value="single">Single timeframe</option>
            <option value="mtf">MTF confluence</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block">Timeframe</span>
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
                {timeframeLabels[timeframe]}
              </option>
            ))}
          </select>
        </label>

        {filters.mode === "mtf" && (
          <label className="block">
            <span className="mb-2 block">MTF Preset</span>
            <select
              value={filters.mtfPreset}
              onChange={(event) =>
                update("mtfPreset", event.target.value as MtfPreset)
              }
              className="w-full rounded-md border border-[var(--border)] bg-[#0b0f14] px-3 py-2 text-[var(--foreground)]"
            >
              {(Object.keys(mtfPresetLabels) as MtfPreset[]).map((preset) => (
                <option key={preset} value={preset}>
                  {mtfPresetLabels[preset]}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block">
          <span className="mb-2 block">Signal</span>
          <select
            value={filters.signal}
            onChange={(event) =>
              update("signal", event.target.value as ScannerFiltersState["signal"])
            }
            className="w-full rounded-md border border-[var(--border)] bg-[#0b0f14] px-3 py-2 text-[var(--foreground)]"
          >
            {signalOptions.map((signal) => (
              <option key={signal} value={signal}>
                {signal === "ALL" ? "All signals" : scannerSignalLabels[signal]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block">Phase</span>
          <select
            value={filters.phase}
            onChange={(event) =>
              update("phase", event.target.value as ScannerFiltersState["phase"])
            }
            className="w-full rounded-md border border-[var(--border)] bg-[#0b0f14] px-3 py-2 text-[var(--foreground)]"
          >
            {phaseOptions.map((phase) => (
              <option key={phase} value={phase}>
                {phase === "ALL" ? "All phases" : formatPhase(phase)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block">
            Min Opportunity: {filters.minOpportunityScore}
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
          <span className="mb-2 block">Max Risk: {filters.maxRiskScore}</span>
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
          <span className="mb-2 block">Sort By</span>
          <select
            value={filters.sortBy}
            onChange={(event) =>
              update("sortBy", event.target.value as ScannerSortKey)
            }
            className="w-full rounded-md border border-[var(--border)] bg-[#0b0f14] px-3 py-2 text-[var(--foreground)]"
          >
            <option value="rankScore">Rank Score</option>
            <option value="opportunityScore">Opportunity</option>
            <option value="confirmationScore">Confirmation</option>
            <option value="lowestRiskScore">Lowest Risk</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block">Limit</span>
          <select
            value={filters.limit}
            onChange={(event) =>
              update("limit", Number(event.target.value) as ScannerFiltersState["limit"])
            }
            className="w-full rounded-md border border-[var(--border)] bg-[#0b0f14] px-3 py-2 text-[var(--foreground)]"
          >
            <option value={50}>50</option>
            <option value={100}>100</option>
            {filters.mode === "single" && <option value={200}>200</option>}
          </select>
        </label>
      </div>
    </aside>
  );
}

function formatPhase(phase: MarketPhase) {
  return phase
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
