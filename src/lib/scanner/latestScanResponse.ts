import { getSymbolQuality, type SymbolQuality } from "@/lib/market-data/symbolClassification";
import type {
  LatestScanSignalRecord,
  ScanRunRecord,
} from "@/lib/storage/postgres/scannerResultsPg";
import {
  SCAN_RESULT_GROUPS,
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

const BALANCED_ALLOCATION_STRATEGY = "balanced_group_quota_v1" as const;

const GROUP_ALLOCATION_WEIGHTS = {
  eligible: 30,
  watch: 30,
  overheated: 15,
  risk: 15,
  neutral: 8,
  insufficient_history: 2,
} satisfies Record<ScanResultGroup, number>;

export type LatestScanResponse = {
  ok: true;
  run: ScanRunRecord;
  summary: ReturnType<typeof summarizeScanResultGroups> & {
    returnedItems: number;
    lowQualityExcluded: number;
    visibleByGroup: Record<ScanResultGroup, number>;
    totalByGroup: Record<ScanResultGroup, number>;
    limitedGroups: ScanResultGroup[];
    allocationStrategy: typeof BALANCED_ALLOCATION_STRATEGY;
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
  const allocation = allocateLatestScanItems(sorted, limit);
  const items = allocation.items;
  const baseSummary = summarizeScanResultGroups(qualityFiltered);

  return {
    ok: true,
    run,
    summary: {
      ...baseSummary,
      returnedItems: items.length,
      lowQualityExcluded: enriched.length - qualityFiltered.length,
      visibleByGroup: allocation.visibleByGroup,
      totalByGroup: allocation.totalByGroup,
      limitedGroups: allocation.limitedGroups,
      allocationStrategy: BALANCED_ALLOCATION_STRATEGY,
    },
    groups: buildScanResultGroups(items),
    items,
  };
}

function allocateLatestScanItems(sorted: LatestScanItem[], limit: number) {
  const normalizedLimit = Math.max(0, Math.floor(limit));
  const totalByGroup = countItemsByGroup(sorted);

  if (normalizedLimit === 0 || sorted.length === 0) {
    return {
      items: [],
      visibleByGroup: emptyGroupCounts(),
      totalByGroup,
      limitedGroups: SCAN_RESULT_GROUPS.filter((group) => totalByGroup[group] > 0),
    };
  }

  const itemsByGroup = new Map(
    SCAN_RESULT_GROUPS.map((group) => [
      group,
      sorted.filter((item) => item.resultGroup === group),
    ]),
  );
  const selected: LatestScanItem[] = [];
  const selectedIds = new Set<string>();

  for (const group of SCAN_RESULT_GROUPS) {
    const groupItems = itemsByGroup.get(group) ?? [];

    if (groupItems.length === 0 || selected.length >= normalizedLimit) {
      continue;
    }

    const weightedQuota = Math.floor(
      normalizedLimit * (GROUP_ALLOCATION_WEIGHTS[group] / 100),
    );
    const quota = Math.max(1, weightedQuota);
    addItems(selected, selectedIds, groupItems.slice(0, quota), normalizedLimit);
  }

  if (selected.length < normalizedLimit) {
    const remainingByRank = sorted
      .filter((item) => !selectedIds.has(item.id))
      .sort(compareScanResultRankThenGroup);

    addItems(selected, selectedIds, remainingByRank, normalizedLimit);
  }

  const items = selected.sort(compareScanResultGroupItems);
  const visibleByGroup = countItemsByGroup(items);

  return {
    items,
    visibleByGroup,
    totalByGroup,
    limitedGroups: SCAN_RESULT_GROUPS.filter(
      (group) => visibleByGroup[group] < totalByGroup[group],
    ),
  };
}

function addItems(
  selected: LatestScanItem[],
  selectedIds: Set<string>,
  candidates: LatestScanItem[],
  limit: number,
) {
  for (const item of candidates) {
    if (selected.length >= limit) {
      return;
    }

    if (!selectedIds.has(item.id)) {
      selected.push(item);
      selectedIds.add(item.id);
    }
  }
}

function compareScanResultRankThenGroup(
  left: LatestScanItem,
  right: LatestScanItem,
) {
  const rankDelta =
    (right.rankScore ?? Number.NEGATIVE_INFINITY) -
    (left.rankScore ?? Number.NEGATIVE_INFINITY);

  if (rankDelta !== 0) {
    return rankDelta;
  }

  return compareScanResultGroupItems(left, right);
}

function countItemsByGroup(items: LatestScanItem[]) {
  const counts = emptyGroupCounts();

  for (const item of items) {
    counts[item.resultGroup] += 1;
  }

  return counts;
}

function emptyGroupCounts() {
  return Object.fromEntries(
    SCAN_RESULT_GROUPS.map((group) => [group, 0]),
  ) as Record<ScanResultGroup, number>;
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
