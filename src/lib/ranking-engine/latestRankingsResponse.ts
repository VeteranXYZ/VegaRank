import { getSymbolQuality, type SymbolQuality } from "@/lib/market-data/symbolClassification";
import type {
  LatestRankingSignalRecord,
  ScanRunRecord,
} from "@/lib/storage/postgres/rankingResultsPg";
import {
  serializeStoredSignalToCodeContract,
  type PublicStoredScannerSignal,
} from "@/lib/vegarank-codebook/serializeStoredSignal";
import {
  RANKING_RESULT_GROUPS,
  buildRankingResultGroups,
  classifyRankingResultGroup,
  compareRankingResultGroupItems,
  getRankingResultReview,
  summarizeRankingResultGroups,
  type RankingResultReview,
  type RankingResultGroup,
} from "./rankingResultGroups";

type EnrichedLatestRankingItem = LatestRankingSignalRecord &
  SymbolQuality & {
    resultGroup: RankingResultGroup;
  } & RankingResultReview;

export type LatestRankingItem = PublicStoredScannerSignal;

const BALANCED_ALLOCATION_STRATEGY = "balanced_group_quota_v1" as const;

const GROUP_ALLOCATION_WEIGHTS = {
  eligible: 30,
  watch: 30,
  overheated: 15,
  risk: 15,
  neutral: 8,
  insufficient_history: 2,
} satisfies Record<RankingResultGroup, number>;

export type LatestRankingsResponse = {
  ok: true;
  run: ScanRunRecord;
  summary: ReturnType<typeof summarizeRankingResultGroups> & {
    returnedItems: number;
    lowQualityExcluded: number;
    visibleByGroup: Record<RankingResultGroup, number>;
    totalByGroup: Record<RankingResultGroup, number>;
    limitedGroups: RankingResultGroup[];
    allocationStrategy: typeof BALANCED_ALLOCATION_STRATEGY;
  };
  groups: ReturnType<typeof buildLatestRankingsPublicGroups>;
  items: LatestRankingItem[];
};

export function buildLatestRankingsResponse({
  run,
  signals,
  limit,
  includeLowQuality,
}: {
  run: ScanRunRecord;
  signals: LatestRankingSignalRecord[];
  limit: number;
  includeLowQuality: boolean;
}): LatestRankingsResponse {
  const enriched = signals.map(enrichLatestRankingItem);
  const qualityFiltered = includeLowQuality
    ? enriched
    : enriched.filter((signal) => !signal.isLowQuality);
  const sorted = [...qualityFiltered].sort(compareRankingResultGroupItems);
  const allocation = allocateLatestRankingItems(sorted, limit);
  const items = allocation.items.map(toPublicLatestRankingItem);
  const baseSummary = summarizeRankingResultGroups(qualityFiltered);

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
    groups: buildLatestRankingsPublicGroups(allocation.items),
    items,
  };
}

function allocateLatestRankingItems(sorted: EnrichedLatestRankingItem[], limit: number) {
  const normalizedLimit = Math.max(0, Math.floor(limit));
  const totalByGroup = countItemsByGroup(sorted);

  if (normalizedLimit === 0 || sorted.length === 0) {
    return {
      items: [],
      visibleByGroup: emptyGroupCounts(),
      totalByGroup,
      limitedGroups: RANKING_RESULT_GROUPS.filter((group) => totalByGroup[group] > 0),
    };
  }

  const itemsByGroup = new Map(
    RANKING_RESULT_GROUPS.map((group) => [
      group,
      sorted.filter((item) => item.resultGroup === group),
    ]),
  );
  const selected: EnrichedLatestRankingItem[] = [];
  const selectedIds = new Set<string>();

  for (const group of RANKING_RESULT_GROUPS) {
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

  const items = selected.sort(compareRankingResultGroupItems);
  const visibleByGroup = countItemsByGroup(items);

  return {
    items,
    visibleByGroup,
    totalByGroup,
    limitedGroups: RANKING_RESULT_GROUPS.filter(
      (group) => visibleByGroup[group] < totalByGroup[group],
    ),
  };
}

function addItems(
  selected: EnrichedLatestRankingItem[],
  selectedIds: Set<string>,
  candidates: EnrichedLatestRankingItem[],
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
  left: EnrichedLatestRankingItem,
  right: EnrichedLatestRankingItem,
) {
  const rankDelta =
    (right.rankScore ?? Number.NEGATIVE_INFINITY) -
    (left.rankScore ?? Number.NEGATIVE_INFINITY);

  if (rankDelta !== 0) {
    return rankDelta;
  }

  return compareRankingResultGroupItems(left, right);
}

function countItemsByGroup(items: EnrichedLatestRankingItem[]) {
  const counts = emptyGroupCounts();

  for (const item of items) {
    counts[item.resultGroup] += 1;
  }

  return counts;
}

function emptyGroupCounts() {
  return Object.fromEntries(
    RANKING_RESULT_GROUPS.map((group) => [group, 0]),
  ) as Record<RankingResultGroup, number>;
}

function enrichLatestRankingItem(signal: LatestRankingSignalRecord): EnrichedLatestRankingItem {
  const quality = getSymbolQuality(signal.symbol, {
    assetClass: signal.assetClass,
    candleCount: signal.candleCount,
    firstOpenTime: signal.firstOpenTime,
  });
  const resultGroup = classifyRankingResultGroup(signal);
  const review = getRankingResultReview({ ...signal, resultGroup });

  return {
    ...signal,
    ...quality,
    resultGroup,
    ...review,
  };
}

function buildLatestRankingsPublicGroups(items: EnrichedLatestRankingItem[]) {
  const groups = buildRankingResultGroups(items);

  return {
    eligible: groups.eligible.map(toPublicLatestRankingItem),
    watch: groups.watch.map(toPublicLatestRankingItem),
    overheated: groups.overheated.map(toPublicLatestRankingItem),
    risk: groups.risk.map(toPublicLatestRankingItem),
    neutral: groups.neutral.map(toPublicLatestRankingItem),
    insufficientHistory: groups.insufficientHistory.map(toPublicLatestRankingItem),
  };
}

function toPublicLatestRankingItem(item: EnrichedLatestRankingItem): LatestRankingItem {
  return serializeStoredSignalToCodeContract(item);
}
