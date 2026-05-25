"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ScannerFilters, type ScannerSortKey } from "./ScannerFilters";
import { ScannerTable } from "./ScannerTable";
import { SelectedSymbolPanel } from "./SelectedSymbolPanel";
import type { Timeframe } from "@/lib/exchanges/types";
import type { MtfPreset } from "@/lib/scanner/multiTimeframe";
import { scannerSignalOrder } from "@/lib/scanner/signal";
import type {
  MarketPhase,
  ScannerSignalState,
  ScanResult,
} from "@/lib/scanner/types";

type ScanApiResponse = {
  exchange: "binance";
  mode?: "mtf";
  timeframe?: Timeframe;
  preset?: MtfPreset;
  results: ScanResult[];
  itemCount: number;
  errors?: { symbol: string; message: string }[];
  cached: boolean;
  updatedAt: string;
};

export type ScannerMode = "single" | "mtf";

export type ScannerFiltersState = {
  mode: ScannerMode;
  timeframe: Timeframe;
  mtfPreset: MtfPreset;
  signal: ScannerSignalState | "ALL";
  phase: MarketPhase | "ALL";
  minOpportunityScore: number;
  maxRiskScore: number;
  sortBy: ScannerSortKey;
  limit: 50 | 100 | 200;
};

const initialFilters: ScannerFiltersState = {
  mode: "single",
  timeframe: "4h",
  mtfPreset: "swing",
  signal: "ALL",
  phase: "ALL",
  minOpportunityScore: 0,
  maxRiskScore: 100,
  sortBy: "rankScore",
  limit: 50,
};

export function ScannerPageClient() {
  const [filters, setFilters] = useState<ScannerFiltersState>(initialFilters);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const scanQuery = useQuery({
    queryKey: [
      "scan",
      filters.mode,
      filters.timeframe,
      filters.mtfPreset,
      getEffectiveLimit(filters),
    ],
    queryFn: () => fetchScan(filters),
  });
  const rows = useMemo(
    () => filterAndSortResults(scanQuery.data?.results ?? [], filters),
    [scanQuery.data?.results, filters],
  );
  const signalSummary = useMemo(
    () => getSignalSummary(scanQuery.data?.results ?? []),
    [scanQuery.data?.results],
  );
  const selectedResult =
    rows.find((row) => row.symbol === selectedSymbol) ?? rows[0] ?? null;

  function updateFilters(nextFilters: ScannerFiltersState) {
    setFilters(normalizeFilters(nextFilters));
    setSelectedSymbol(null);
  }

  function selectSignal(signal: ScannerSignalState | "ALL") {
    updateFilters({ ...filters, signal });
  }

  return (
    <section className="mx-auto grid max-w-[1500px] gap-5 px-4 py-6 lg:grid-cols-[250px_minmax(0,1fr)_330px]">
      <ScannerFilters filters={filters} onChange={updateFilters} />
      <ScannerTable
        rows={rows}
        signalSummary={signalSummary}
        activeSignal={filters.signal}
        selectedSymbol={selectedResult?.symbol ?? null}
        isLoading={scanQuery.isLoading}
        isFetching={scanQuery.isFetching}
        isError={scanQuery.isError}
        errorMessage={
          scanQuery.error instanceof Error
            ? scanQuery.error.message
            : "Unable to load scanner results."
        }
        cached={scanQuery.data?.cached ?? false}
        updatedAt={scanQuery.data?.updatedAt ?? null}
        sourceItemCount={scanQuery.data?.itemCount ?? 0}
        partialErrors={scanQuery.data?.errors ?? []}
        onRefresh={() => void scanQuery.refetch()}
        onSignalSelect={selectSignal}
        onSelect={setSelectedSymbol}
      />
      <SelectedSymbolPanel result={selectedResult} />
    </section>
  );
}

async function fetchScan(filters: ScannerFiltersState) {
  if (filters.mode === "mtf") {
    return fetchMtfScan(filters.mtfPreset, getEffectiveLimit(filters));
  }

  return fetchSingleTimeframeScan(filters.timeframe, filters.limit);
}

async function fetchSingleTimeframeScan(timeframe: Timeframe, limit: number) {
  const params = new URLSearchParams({
    timeframe,
    limit: String(limit),
  });
  const response = await fetch(`/api/scan?${params.toString()}`);

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as
      | { error?: string; message?: string }
      | null;
    throw new Error(
      errorBody?.message ?? errorBody?.error ?? "Scanner request failed.",
    );
  }

  return (await response.json()) as ScanApiResponse;
}

async function fetchMtfScan(preset: MtfPreset, limit: number) {
  const params = new URLSearchParams({
    preset,
    limit: String(limit),
  });
  const response = await fetch(`/api/scan/mtf?${params.toString()}`);

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as
      | { error?: string; message?: string }
      | null;
    throw new Error(
      errorBody?.message ?? errorBody?.error ?? "MTF scanner request failed.",
    );
  }

  return (await response.json()) as ScanApiResponse;
}

function normalizeFilters(filters: ScannerFiltersState): ScannerFiltersState {
  if (filters.mode === "mtf" && filters.limit === 200) {
    return { ...filters, limit: 100 };
  }

  return filters;
}

function getEffectiveLimit(filters: ScannerFiltersState) {
  return filters.mode === "mtf" && filters.limit === 200 ? 100 : filters.limit;
}

export function getSignalSummary(results: ScanResult[]) {
  const counts = new Map<ScannerSignalState, number>(
    scannerSignalOrder.map((signal) => [signal, 0]),
  );

  for (const result of results) {
    counts.set(result.signal.state, (counts.get(result.signal.state) ?? 0) + 1);
  }

  return [
    { signal: "ALL" as const, count: results.length },
    ...scannerSignalOrder.map((signal) => ({
      signal,
      count: counts.get(signal) ?? 0,
    })),
  ];
}

export function filterAndSortResults(
  results: ScanResult[],
  filters: ScannerFiltersState,
) {
  const filtered = results.filter((result) => {
    return (
      (filters.signal === "ALL" || result.signal.state === filters.signal) &&
      (filters.phase === "ALL" || result.phase === filters.phase) &&
      result.opportunityScore >= filters.minOpportunityScore &&
      result.riskScore <= filters.maxRiskScore
    );
  });

  return filtered.sort((left, right) => {
    switch (filters.sortBy) {
      case "opportunityScore":
        return right.opportunityScore - left.opportunityScore;
      case "confirmationScore":
        return right.confirmationScore - left.confirmationScore;
      case "lowestRiskScore":
        return left.riskScore - right.riskScore;
      case "rankScore":
      default:
        return right.rankScore - left.rankScore;
    }
  });
}
