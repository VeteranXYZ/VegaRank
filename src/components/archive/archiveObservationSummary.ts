export type ObservationSummaryDataStatus = "complete" | "partial" | "missing";

export type ObservationSummaryRow = {
  symbol: string;
  group?: string | null;
  groupKey?: string | null;
  groupLabel?: string | null;
  observedChangePct?: number | null;
  maxDrawdownPct?: number | null;
  dataStatus: ObservationSummaryDataStatus;
};

export type ObservationSummaryCounts = {
  totalRows: number;
  completeCount: number;
  partialCount: number;
  missingCount: number;
};

export type ObservationCoverageLabel = "Strong" | "Mixed" | "Limited";

export type ObservationSummaryStats = {
  medianObservedChangePct: number | null;
  averageObservedChangePct: number | null;
  medianMaxDrawdownPct: number | null;
  positiveRatePct: number | null;
  worstMaxDrawdownPct: number | null;
};

export type ObservationGroupSummary = ObservationSummaryStats & {
  groupKey: ObservationGroupKey;
  groupLabel: string;
  rows: number;
  complete: number;
  partial: number;
  missing: number;
};

export type ObservationNotableExample = {
  symbol: string;
  groupLabel: string;
  observedChangePct: number;
  maxDrawdownPct: number | null;
};

export type ObservationSummary = ObservationSummaryStats & {
  totalRows: number;
  completeCount: number;
  partialCount: number;
  missingCount: number;
  completePct: number;
  coverageLabel: ObservationCoverageLabel;
  hasPartialOnlyCoverage: boolean;
  groups: ObservationGroupSummary[];
  notable: {
    largestPositiveObservedChanges: ObservationNotableExample[];
    largestNegativeObservedChanges: ObservationNotableExample[];
    largestObservedDrawdowns: ObservationNotableExample[];
  };
};

type ObservationGroupKey =
  | "high_priority"
  | "eligible"
  | "constructive_watch"
  | "watch"
  | "overheated"
  | "risk"
  | "neutral"
  | "insufficient_history"
  | "metadata_unavailable"
  | "unknown";

const observationGroupOrder: ObservationGroupKey[] = [
  "high_priority",
  "eligible",
  "constructive_watch",
  "watch",
  "overheated",
  "risk",
  "neutral",
  "insufficient_history",
  "metadata_unavailable",
  "unknown",
];

const observationGroupLabels = {
  high_priority: "High Priority",
  eligible: "Eligible",
  constructive_watch: "Constructive Watch",
  watch: "Watch",
  overheated: "Overheated",
  risk: "Risk",
  neutral: "Neutral",
  insufficient_history: "Insufficient History",
  metadata_unavailable: "Metadata Unavailable",
  unknown: "Unknown",
} satisfies Record<ObservationGroupKey, string>;

export function buildObservationSummary({
  rows,
  counts,
}: {
  rows: ObservationSummaryRow[];
  counts?: ObservationSummaryCounts | null;
}): ObservationSummary {
  const derivedCounts = countRows(rows);
  const totalRows = toNonNegativeCount(counts?.totalRows ?? rows.length);
  const completeCount = toNonNegativeCount(
    counts?.completeCount ?? derivedCounts.complete,
  );
  const partialCount = toNonNegativeCount(
    counts?.partialCount ?? derivedCounts.partial,
  );
  const missingCount = toNonNegativeCount(
    counts?.missingCount ?? derivedCounts.missing,
  );
  const completeRows = getCompleteRows(rows);
  const stats = buildSummaryStats(completeRows);

  return {
    totalRows,
    completeCount,
    partialCount,
    missingCount,
    completePct: totalRows > 0 ? (completeCount / totalRows) * 100 : 0,
    coverageLabel: classifyObservationCoverage({
      completeCount,
      totalRows,
    }),
    hasPartialOnlyCoverage: completeCount === 0 && partialCount > 0,
    ...stats,
    groups: buildGroupSummaries(rows),
    notable: buildNotableExamples(completeRows),
  };
}

export function classifyObservationCoverage({
  completeCount,
  totalRows,
}: {
  completeCount: number;
  totalRows: number;
}): ObservationCoverageLabel {
  const completePct = totalRows > 0 ? (completeCount / totalRows) * 100 : 0;

  if (completePct >= 80) {
    return "Strong";
  }

  if (completePct >= 40) {
    return "Mixed";
  }

  return "Limited";
}

function buildGroupSummaries(rows: ObservationSummaryRow[]) {
  const byGroup = new Map<
    ObservationGroupKey,
    { groupLabel: string; rows: ObservationSummaryRow[] }
  >();

  for (const row of rows) {
    const group = getObservationGroup(row);
    const current = byGroup.get(group.groupKey);
    byGroup.set(group.groupKey, {
      groupLabel: current?.groupLabel ?? group.groupLabel,
      rows: [...(current?.rows ?? []), row],
    });
  }

  return Array.from(byGroup.entries())
    .map(([groupKey, group]) => {
      const groupRows = group.rows;
      const counts = countRows(groupRows);

      return {
        groupKey,
        groupLabel: group.groupLabel,
        rows: groupRows.length,
        complete: counts.complete,
        partial: counts.partial,
        missing: counts.missing,
        ...buildSummaryStats(getCompleteRows(groupRows)),
      };
    })
    .sort(
      (left, right) =>
        observationGroupOrder.indexOf(left.groupKey) -
        observationGroupOrder.indexOf(right.groupKey),
    );
}

function buildNotableExamples(completeRows: ObservationSummaryRow[]) {
  const rowsWithObservedChange = completeRows.flatMap((row) => {
    const observedChangePct = toFiniteNumber(row.observedChangePct);

    if (observedChangePct === null) {
      return [];
    }

    return [
      {
        symbol: row.symbol,
        groupLabel: getObservationGroup(row).groupLabel,
        observedChangePct,
        maxDrawdownPct: toFiniteNumber(row.maxDrawdownPct),
      },
    ];
  });
  const rowsWithDrawdown = rowsWithObservedChange.filter(
    (row) => row.maxDrawdownPct !== null,
  );

  return {
    largestPositiveObservedChanges: rowsWithObservedChange
      .filter((row) => row.observedChangePct > 0)
      .sort((left, right) => right.observedChangePct - left.observedChangePct)
      .slice(0, 3),
    largestNegativeObservedChanges: rowsWithObservedChange
      .filter((row) => row.observedChangePct < 0)
      .sort((left, right) => left.observedChangePct - right.observedChangePct)
      .slice(0, 3),
    largestObservedDrawdowns: rowsWithDrawdown
      .sort(
        (left, right) =>
          (left.maxDrawdownPct ?? 0) - (right.maxDrawdownPct ?? 0),
      )
      .slice(0, 3),
  };
}

function buildSummaryStats(
  completeRows: ObservationSummaryRow[],
): ObservationSummaryStats {
  const observedChanges = completeRows.flatMap((row) => {
    const value = toFiniteNumber(row.observedChangePct);
    return value === null ? [] : [value];
  });
  const maxDrawdowns = completeRows.flatMap((row) => {
    const value = toFiniteNumber(row.maxDrawdownPct);
    return value === null ? [] : [value];
  });

  return {
    medianObservedChangePct: median(observedChanges),
    averageObservedChangePct: average(observedChanges),
    medianMaxDrawdownPct: median(maxDrawdowns),
    positiveRatePct:
      observedChanges.length > 0
        ? (observedChanges.filter((value) => value > 0).length /
            observedChanges.length) *
          100
        : null,
    worstMaxDrawdownPct:
      maxDrawdowns.length > 0 ? Math.min(...maxDrawdowns) : null,
  };
}

function getCompleteRows(rows: ObservationSummaryRow[]) {
  return rows.filter((row) => row.dataStatus === "complete");
}

function countRows(rows: ObservationSummaryRow[]) {
  return rows.reduce(
    (counts, row) => ({
      complete: counts.complete + (row.dataStatus === "complete" ? 1 : 0),
      partial: counts.partial + (row.dataStatus === "partial" ? 1 : 0),
      missing: counts.missing + (row.dataStatus === "missing" ? 1 : 0),
    }),
    { complete: 0, partial: 0, missing: 0 },
  );
}

function normalizeObservationGroup(
  group: string | null | undefined,
): ObservationGroupKey {
  if (!group) {
    return "unknown";
  }

  if (group === "insufficientHistory" || group === "insufficient_history") {
    return "insufficient_history";
  }

  if (observationGroupOrder.includes(group as ObservationGroupKey)) {
    return group as ObservationGroupKey;
  }

  return "unknown";
}

function getObservationGroup(row: ObservationSummaryRow): {
  groupKey: ObservationGroupKey;
  groupLabel: string;
} {
  const normalizedGroupKey = normalizeObservationGroup(row.groupKey);
  const normalizedGroupLabel = normalizeObservationGroupLabel(row.groupLabel);

  if (normalizedGroupLabel !== null) {
    return {
      groupKey:
        normalizedGroupKey !== "unknown"
          ? normalizedGroupKey
          : groupKeyFromLabel(normalizedGroupLabel),
      groupLabel: normalizedGroupLabel,
    };
  }

  const legacyGroupKey = normalizeObservationGroup(row.group);

  return {
    groupKey: legacyGroupKey,
    groupLabel: observationGroupLabels[legacyGroupKey],
  };
}

function normalizeObservationGroupLabel(value: string | null | undefined) {
  const normalized = value?.trim();

  return normalized && normalized.length > 0 ? normalized : null;
}

function groupKeyFromLabel(label: string): ObservationGroupKey {
  const normalized = label.toLowerCase().replace(/[^a-z0-9]+/g, "_");

  if (normalized === "high_priority") {
    return "high_priority";
  }

  if (normalized === "constructive_watch") {
    return "constructive_watch";
  }

  if (normalized === "metadata_unavailable") {
    return "metadata_unavailable";
  }

  return normalizeObservationGroup(normalized);
}

function median(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middleIndex = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middleIndex] ?? null;
  }

  const left = sorted[middleIndex - 1];
  const right = sorted[middleIndex];

  return left === undefined || right === undefined ? null : (left + right) / 2;
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toFiniteNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toNonNegativeCount(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}
