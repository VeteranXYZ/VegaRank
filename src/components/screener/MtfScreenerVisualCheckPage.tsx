"use client";

import { useMemo, useState } from "react";
import {
  getNextDataSortState,
  sortDataRows,
  type DataSortDirection,
  type DataSortState,
} from "@/components/table/dataTableSorting";
import { PageShell } from "@/components/ui/workspace";
import {
  areMtfScreenerFiltersDefault,
  getActiveMtfFilterLabels,
  getMtfScreenerTableSortValue,
  MtfScreenerCommandBar,
  MtfScreenerDetailRail,
  MtfResearchBucketsPanel,
  MtfScreenerControls,
  MtfScreenerTable,
  type MtfScreenerTableSortKey,
} from "./MultiTimeframeScreenerPageClient";
import {
  buildMtfScreenerRowsFromResponse,
  defaultMtfScreenerFilters,
  filterMtfScreenerRows,
  filterMtfScreenerRowsBySearch,
  type MtfScreenerFilters,
  type MtfScreenerGroupFilter,
  type MtfScreenerPresetId,
  type MtfScreenerTimeframe,
} from "./multiTimeframeScreenerUi";
import { buildMtfScreenerPreviewResponse } from "./multiTimeframeScreenerPreviewData";

export const mtfScreenerVisualCheckCopy = {
  eyebrow: "Visual check",
  title: "Multi-Timeframe Screener",
  description:
    "Frontend-only populated preview of joined MTF rows. API and data behavior are unchanged.",
};

export function MtfScreenerVisualCheckPage() {
  const previewData = useMemo(() => buildMtfScreenerPreviewResponse(), []);
  const [filters, setFilters] = useState<MtfScreenerFilters>(
    defaultMtfScreenerFilters,
  );
  const [presetId, setPresetId] = useState<MtfScreenerPresetId | "custom">(
    "custom",
  );
  const [symbolSearch, setSymbolSearch] = useState("");
  const [tableSortState, setTableSortState] =
    useState<DataSortState<MtfScreenerTableSortKey> | null>(null);
  const rows = useMemo(
    () => buildMtfScreenerRowsFromResponse(previewData),
    [previewData],
  );
  const filteredRows = useMemo(
    () => filterMtfScreenerRows(rows, filters, presetId),
    [filters, presetId, rows],
  );
  const searchedRows = useMemo(
    () => filterMtfScreenerRowsBySearch(filteredRows, symbolSearch),
    [filteredRows, symbolSearch],
  );
  const visibleRows = useMemo(
    () => sortDataRows(searchedRows, tableSortState, getMtfScreenerTableSortValue),
    [searchedRows, tableSortState],
  );
  const isFullTableActive =
    presetId === "custom" &&
    symbolSearch.trim() === "" &&
    areMtfScreenerFiltersDefault(filters) &&
    tableSortState === null;
  const activeFilterLabels = useMemo(
    () => getActiveMtfFilterLabels(filters, symbolSearch),
    [filters, symbolSearch],
  );
  const updateGroupFilter = (
    timeframe: MtfScreenerTimeframe,
    value: MtfScreenerGroupFilter,
  ) => {
    setPresetId("custom");
    setFilters((current) => ({
      ...current,
      groups: { ...current.groups, [timeframe]: value },
    }));
  };
  const updateMinRank = (timeframe: MtfScreenerTimeframe, value: string) => {
    const parsed = Number(value);

    setPresetId("custom");
    setFilters((current) => ({
      ...current,
      minRank: {
        ...current.minRank,
        [timeframe]: Number.isFinite(parsed) ? Math.max(0, parsed) : 0,
      },
    }));
  };
  const updateExcludeRisk = (key: "exclude1dRisk" | "exclude1wRisk") => {
    setPresetId("custom");
    setFilters((current) => ({ ...current, [key]: !current[key] }));
  };
  const updateTableSort = (
    key: MtfScreenerTableSortKey,
    defaultDirection: DataSortDirection,
  ) => {
    setTableSortState((current) =>
      getNextDataSortState({ current, key, defaultDirection }),
    );
  };
  const applyPreset = (nextPresetId: MtfScreenerPresetId) => {
    setPresetId(nextPresetId);
    setFilters(defaultMtfScreenerFilters);
  };
  const clearFilters = () => {
    setPresetId("custom");
    setFilters(defaultMtfScreenerFilters);
    setSymbolSearch("");
    setTableSortState(null);
  };

  return (
    <PageShell className="screener-terminal max-w-none [--screener-sticky-offset:0rem] xl:h-full xl:min-h-0 xl:overflow-hidden">
      <MtfScreenerCommandBar
        title={mtfScreenerVisualCheckCopy.title}
        datasetLabel="Mock joined rows"
        statusLabel={mtfScreenerVisualCheckCopy.eyebrow}
        statusTone="info"
        totalRows={rows.length}
        visibleRows={visibleRows.length}
        presetId={presetId}
        isFullTableActive={isFullTableActive}
        activeFilterCount={activeFilterLabels.length}
        sortState={tableSortState}
        sourceData={previewData}
      />

      <MtfResearchBucketsPanel
        rows={rows}
        presetId={presetId}
        isFullTableActive={isFullTableActive}
        onBucketSelect={applyPreset}
        onClear={clearFilters}
      />

      <div className="grid min-h-0 flex-1 gap-2 xl:grid-cols-[200px_minmax(0,1fr)_236px] xl:overflow-hidden 2xl:grid-cols-[204px_minmax(0,1fr)_252px]">
        <MtfScreenerControls
          filters={filters}
          symbolSearch={symbolSearch}
          onSymbolSearchChange={setSymbolSearch}
          onGroupChange={updateGroupFilter}
          onMinRankChange={updateMinRank}
          onExcludeRiskChange={updateExcludeRisk}
          onClear={clearFilters}
          className="order-2 xl:order-1"
        />

        <main className="order-1 min-h-0 min-w-0 xl:order-2 xl:flex xl:flex-col xl:overflow-hidden">
          <MtfScreenerTable
            rows={visibleRows}
            sortState={tableSortState}
            onSortChange={updateTableSort}
            sourceData={previewData}
            totalRows={rows.length}
            filteredRows={visibleRows.length}
          />
        </main>

        <MtfScreenerDetailRail
          rows={visibleRows}
          totalRows={rows.length}
          filteredRows={visibleRows.length}
          presetId={presetId}
          isFullTableActive={isFullTableActive}
          activeFilterCount={activeFilterLabels.length}
          sortState={tableSortState}
          marketContextIsError
          className="order-3 xl:order-3"
        />
      </div>
    </PageShell>
  );
}
