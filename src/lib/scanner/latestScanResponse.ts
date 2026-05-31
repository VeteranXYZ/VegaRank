import { getSymbolQuality, type SymbolQuality } from "@/lib/market-data/symbolClassification";
import type {
  LatestScanSignalRecord,
  ScanRunRecord,
} from "@/lib/storage/postgres/scannerResultsPg";
import {
  buildScanResultGroups,
  classifyScanResultGroup,
  compareScanResultGroupItems,
  summarizeScanResultGroups,
  type ScanResultGroup,
} from "./scanResultGroups";

export type LatestScanItem = LatestScanSignalRecord &
  SymbolQuality & {
    resultGroup: ScanResultGroup;
  };

export type LatestScanResponse = {
  ok: true;
  run: ScanRunRecord;
  summary: ReturnType<typeof summarizeScanResultGroups> & {
    returnedItems: number;
    lowQualityExcluded: number;
  };
  groups: ReturnType<typeof buildScanResultGroups<LatestScanItem>>;
  items: LatestScanItem[];
};

export function buildLatestScanResponse({
  run,
  signals,
  limit,
  includeLowQuality,
}: {
  run: ScanRunRecord;
  signals: LatestScanSignalRecord[];
  limit: number;
  includeLowQuality: boolean;
}): LatestScanResponse {
  const enriched = signals.map(enrichLatestScanItem);
  const qualityFiltered = includeLowQuality
    ? enriched
    : enriched.filter((signal) => !signal.isLowQuality);
  const sorted = [...qualityFiltered].sort(compareScanResultGroupItems);
  const items = sorted.slice(0, limit);
  const baseSummary = summarizeScanResultGroups(qualityFiltered);

  return {
    ok: true,
    run,
    summary: {
      ...baseSummary,
      returnedItems: items.length,
      lowQualityExcluded: enriched.length - qualityFiltered.length,
    },
    groups: buildScanResultGroups(items),
    items,
  };
}

function enrichLatestScanItem(signal: LatestScanSignalRecord): LatestScanItem {
  const quality = getSymbolQuality(signal.symbol, {
    assetClass: signal.assetClass,
    candleCount: signal.candleCount,
    firstOpenTime: signal.firstOpenTime,
  });

  return {
    ...signal,
    ...quality,
    resultGroup: classifyScanResultGroup(signal),
  };
}
