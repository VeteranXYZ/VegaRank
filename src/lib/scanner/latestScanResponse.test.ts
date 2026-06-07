import { describe, expect, it } from "vitest";
import type {
  LatestScanSignalRecord,
  ScanRunRecord,
} from "@/lib/storage/postgres/scannerResultsPg";
import {
  actionCodeByBias,
  groupCodeByResultGroup,
  riskCodeByType,
  scannerCodeVersions,
  setupCodeByAliasOrStructure,
  signalCodeByLabel,
} from "@/lib/scanner-codebook/codeRegistry";
import { buildLatestScanResponse } from "./latestScanResponse";

describe("latest scan response", () => {
  it("filters low-quality symbols by default and preserves one scan run", () => {
    const response = buildLatestScanResponse({
      run: makeRun("run-1"),
      signals: [
        makeSignal({ id: "1", scanRunId: "run-1", symbol: "BTCUSDT", rankScore: 70 }),
        makeSignal({ id: "2", scanRunId: "run-1", symbol: "UUSDT", rankScore: 120 }),
      ],
      limit: 100,
      includeLowQuality: false,
    });

    expect(response.summary.totalSignals).toBe(1);
    expect(response.summary.lowQualityExcluded).toBe(1);
    expect(response.items.map((item) => item.symbol)).toEqual(["BTCUSDT"]);
    expect(new Set(response.items.map((item) => item.scanRunId))).toEqual(
      new Set(["run-1"]),
    );
  });

  it("groups results by trading semantics before rank score", () => {
    const response = buildLatestScanResponse({
      run: makeRun("run-2"),
      signals: [
        makeSignal({
          id: "1",
          scanRunId: "run-2",
          symbol: "SEIUSDT",
          signalLabel: "breakdown_risk",
          actionBias: "avoid",
          primaryStructure: "trend_breakdown",
          rankScore: 120,
        }),
        makeSignal({
          id: "2",
          scanRunId: "run-2",
          symbol: "ETHUSDT",
          signalLabel: "confirmed",
          actionBias: "eligible",
          primaryStructure: "strong_trend",
          rankScore: 80,
        }),
      ],
      limit: 100,
      includeLowQuality: true,
    });

    expect(response.items.map((item) => item.symbol)).toEqual(["ETHUSDT", "SEIUSDT"]);
    expect(response.groups.eligible).toHaveLength(1);
    expect(response.groups.risk).toHaveLength(1);
    expect(response.summary.breakdownRisk).toBe(1);
    expect(response.summary.confirmed).toBe(1);
    expect(response.summary.totalByGroup).toMatchObject({
      eligible: 1,
      risk: 1,
    });
    expect(response.summary.visibleByGroup).toMatchObject({
      eligible: 1,
      risk: 1,
    });
    expect(response.summary.allocationStrategy).toBe("balanced_group_quota_v1");
    expect(response.items[0]).toMatchObject({
      symbol: "ETHUSDT",
      groupCode: "GR_501",
      actionCode: "AC_501",
      setupCode: "TR_601",
      signalCodes: ["PX_501"],
    });
  });

  it("keeps neutral confirmed setups out of eligible results", () => {
    const response = buildLatestScanResponse({
      run: makeRun("run-3"),
      signals: [
        makeSignal({
          id: "1",
          scanRunId: "run-3",
          symbol: "HBARUSDT",
          signalLabel: "confirmed",
          actionBias: "eligible",
          primaryStructure: "neutral",
          rankScore: 80,
        }),
      ],
      limit: 100,
      includeLowQuality: true,
    });

    expect(response.groups.eligible).toHaveLength(0);
    expect(response.groups.watch.map((item) => item.symbol)).toEqual(["HBARUSDT"]);
    expect(response.groups.watch[0]).toMatchObject({
      groupCode: "GR_101",
      actionCode: "AC_501",
      setupCode: "ST_001",
    });
    expect(response.summary.watch).toBe(1);
  });

  it("returns code fields and versions as the scanner API contract", () => {
    const response = buildLatestScanResponse({
      run: makeRun("run-contract"),
      signals: [
        makeSignal({
          id: "1",
          scanRunId: "run-contract",
          symbol: "ETHUSDT",
          factors: {
            bullish: [
              {
                key: "factor.priceAboveMa20",
                severity: "positive",
                scope: "trend",
              },
            ],
            bearish: [],
            risk: [
              {
                key: "risk.overheat",
                severity: "risk",
                scope: "risk",
              },
            ],
            neutral: [],
          },
          nextConfirmation: [
            {
              key: "confirmation.reclaimMa50",
              severity: "neutral",
              scope: "confirmation",
            },
          ],
          invalidation: [
            {
              key: "invalidation.loseMa20Repair",
              severity: "warning",
              scope: "invalidation",
            },
          ],
        }),
      ],
      limit: 100,
      includeLowQuality: true,
    });

    const item = response.items[0];

    expect(item).toMatchObject({
      symbol: "ETHUSDT",
      groupCode: "GR_501",
      actionCode: "AC_501",
      setupCode: "TR_601",
      signalCodes: ["PX_501"],
      qualityCodes: ["QH_601"],
      scannerVersion: scannerCodeVersions.scannerVersion,
      codeSchemaVersion: scannerCodeVersions.codeSchemaVersion,
      dictionaryVersion: scannerCodeVersions.dictionaryVersion,
      metrics: {
        rankScore: 50,
        price: 1,
      },
    });
    expect(item).not.toHaveProperty("signalLabel");
    expect(item).not.toHaveProperty("actionBias");
    expect(item).not.toHaveProperty("primaryStructure");
    expect(item).not.toHaveProperty("statusNote");
    expect(item).not.toHaveProperty("statusReasons");
    expect(item).not.toHaveProperty("statusNoteKey");
    expect(item).not.toHaveProperty("statusReasonKeys");
    expect(item).not.toHaveProperty("factors");
    expect(item).not.toHaveProperty("bullishFactors");
    expect(item).not.toHaveProperty("nextConfirmationText");
    expect(collectStrings(item).join("\n")).not.toMatch(/\p{Script=Han}/u);
  });

  it("allocates limited latest-scan rows across populated major groups", () => {
    const response = buildLatestScanResponse({
      run: makeRun("run-4"),
      signals: [
        ...makeSignals({
          scanRunId: "run-4",
          prefix: "ELIG",
          count: 40,
          rankStart: 200,
          signalLabel: "confirmed",
          actionBias: "eligible",
          primaryStructure: "strong_trend",
        }),
        ...makeSignals({
          scanRunId: "run-4",
          prefix: "WATCH",
          count: 40,
          rankStart: 160,
          signalLabel: "watch",
          actionBias: "watch_only",
          primaryStructure: "neutral",
        }),
        ...makeSignals({
          scanRunId: "run-4",
          prefix: "HOT",
          count: 20,
          rankStart: 120,
          signalLabel: "overheated",
          actionBias: "do_not_chase",
          primaryStructure: "overextended",
        }),
        ...makeSignals({
          scanRunId: "run-4",
          prefix: "RISK",
          count: 20,
          rankStart: 100,
          signalLabel: "breakdown_risk",
          actionBias: "avoid",
          primaryStructure: "trend_breakdown",
        }),
        ...makeSignals({
          scanRunId: "run-4",
          prefix: "NEUTRAL",
          count: 20,
          rankStart: 80,
          signalLabel: "neutral",
          actionBias: "ignore",
          primaryStructure: "neutral",
        }),
      ],
      limit: 50,
      includeLowQuality: true,
    });

    expect(response.items).toHaveLength(50);
    expect(response.groups.eligible.length).toBeGreaterThan(0);
    expect(response.groups.watch.length).toBeGreaterThan(0);
    expect(response.groups.overheated.length).toBeGreaterThan(0);
    expect(response.groups.risk.length).toBeGreaterThan(0);
    expect(response.groups.neutral.length).toBeGreaterThan(0);
    expect(response.summary.totalByGroup).toMatchObject({
      eligible: 40,
      watch: 40,
      overheated: 20,
      risk: 20,
      neutral: 20,
    });
    expect(response.summary.limitedGroups).toEqual(
      expect.arrayContaining(["eligible", "watch", "overheated", "risk", "neutral"]),
    );
  });
});

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectStrings);
  }

  if (value && typeof value === "object") {
    return Object.values(value).flatMap(collectStrings);
  }

  return [];
}

function makeRun(id: string): ScanRunRecord {
  return {
    id,
    exchange: "binance",
    market: "spot",
    mode: "single",
    timeframe: "4h",
    universe: "all-symbols",
    status: "success",
    symbolsTotal: 2,
    symbolsScanned: 2,
    signalsCreated: 2,
    symbolsSkipped: 0,
    failedSymbols: 0,
    params: {},
    errorMessage: null,
    startedAt: "2026-05-31T00:00:00.000Z",
    finishedAt: "2026-05-31T00:01:00.000Z",
  };
}

function makeSignal(
  overrides: Partial<LatestScanSignalRecord> & {
    id: string;
    scanRunId: string;
    symbol: string;
  },
): LatestScanSignalRecord {
  const signalCode = toSignalCode(overrides.signalLabel ?? "confirmed");
  const actionCode = toActionCode(overrides.actionBias ?? "eligible");
  const setupCode = toSetupCode(overrides.primaryStructure ?? "strong_trend");
  const riskCodes = toRiskCodes(overrides.detectedRiskTypes ?? []);
  const groupCode = toGroupCode({
    signalLabel: overrides.signalLabel ?? "confirmed",
    actionBias: overrides.actionBias ?? "eligible",
    primaryStructure: overrides.primaryStructure ?? "strong_trend",
    rankScore: overrides.rankScore ?? 50,
    riskCodes,
  });
  const codeContract = {
    groupCode,
    actionCode,
    riskCode: riskCodes[0] ?? null,
    riskCodes,
    setupCode,
    phaseCode: "ST_201",
    reasonCodes: [],
    signalCodes: [signalCode],
    qualityCodes: [],
    scannerVersion: scannerCodeVersions.scannerVersion,
    codeSchemaVersion: scannerCodeVersions.codeSchemaVersion,
    dictionaryVersion: scannerCodeVersions.dictionaryVersion,
  };
  const factors =
    overrides.factors && typeof overrides.factors === "object"
      ? (overrides.factors as Record<string, unknown>)
      : {};
  const rawMetrics =
    overrides.rawMetrics && typeof overrides.rawMetrics === "object"
      ? (overrides.rawMetrics as Record<string, unknown>)
      : {};

  return {
    id: overrides.id,
    scanRunId: overrides.scanRunId,
    symbolId: 1,
    exchange: "binance",
    market: "spot",
    symbol: overrides.symbol,
    timeframe: "4h",
    scanTime: "2026-05-31T00:00:00.000Z",
    candleOpenTime: "2026-05-30T20:00:00.000Z",
    priceAtSignal: 1,
    rankScore: overrides.rankScore ?? 50,
    finalSignalScore: overrides.finalSignalScore ?? overrides.rankScore ?? 50,
    opportunityScore: 50,
    confirmationScore: 50,
    riskScore: overrides.riskScore ?? 0,
    trendScore: 50,
    momentumScore: 50,
    volumeScore: 50,
    structureScore: 50,
    signalLabel: signalCode,
    actionBias: actionCode,
    primaryStructure: setupCode,
    groupCode,
    actionCode,
    riskCode: riskCodes[0] ?? null,
    riskCodes,
    setupCode,
    phaseCode: codeContract.phaseCode,
    reasonCodes: [],
    signalCodes: [signalCode],
    qualityCodes: [],
    codeSchemaVersion: scannerCodeVersions.codeSchemaVersion,
    dictionaryVersion: scannerCodeVersions.dictionaryVersion,
    secondaryStructures: [],
    detectedRiskTypes: riskCodes,
    factors: {
      ...factors,
      ...codeContract,
    },
    nextConfirmation: overrides.nextConfirmation ?? null,
    invalidation: overrides.invalidation ?? null,
    rawMetrics: {
      ...rawMetrics,
      codeContract,
    },
    scoringVersion: "test",
    scannerVersion: scannerCodeVersions.scannerVersion,
    createdAt: "2026-05-31T00:00:00.000Z",
    assetClass: overrides.assetClass ?? "crypto",
    isScannerEligible: overrides.isScannerEligible ?? true,
    isBacktestEligible: overrides.isBacktestEligible ?? true,
    isMarketContext: overrides.isMarketContext ?? false,
    candleCount: overrides.candleCount ?? 1000,
    firstOpenTime: overrides.firstOpenTime ?? "2024-01-01T00:00:00.000Z",
  };
}

function toSignalCode(value: string | null | undefined) {
  return (
    signalCodeByLabel[value as keyof typeof signalCodeByLabel] ??
    value ??
    "NX_801"
  );
}

function toActionCode(value: string | null | undefined) {
  return (
    actionCodeByBias[value as keyof typeof actionCodeByBias] ??
    value ??
    "NX_801"
  );
}

function toSetupCode(value: string | null | undefined) {
  return (
    setupCodeByAliasOrStructure[
      value as keyof typeof setupCodeByAliasOrStructure
    ] ??
    value ??
    "NX_801"
  );
}

function toRiskCodes(value: unknown[]) {
  return value
    .map((risk) =>
      typeof risk === "string"
        ? riskCodeByType[risk as keyof typeof riskCodeByType] ?? risk
        : "",
    )
    .filter(Boolean);
}

function toGroupCode({
  signalLabel,
  actionBias,
  primaryStructure,
  rankScore,
  riskCodes,
}: {
  signalLabel: string;
  actionBias: string;
  primaryStructure: string;
  rankScore: number;
  riskCodes: string[];
}) {
  if (
    actionBias === "avoid" ||
    signalLabel === "breakdown_risk" ||
    signalLabel === "distribution_risk" ||
    primaryStructure === "trend_breakdown" ||
    primaryStructure === "distribution_risk" ||
    riskCodes.length > 0
  ) {
    return groupCodeByResultGroup.risk;
  }

  if (
    actionBias === "do_not_chase" ||
    signalLabel === "overheated" ||
    primaryStructure === "overextended"
  ) {
    return groupCodeByResultGroup.overheated;
  }

  if (
    actionBias === "eligible" &&
    (signalLabel === "confirmed" || signalLabel === "trend") &&
    primaryStructure !== "neutral" &&
    rankScore > 0
  ) {
    return groupCodeByResultGroup.eligible;
  }

  if (
    actionBias === "eligible" ||
    actionBias === "watch_only" ||
    signalLabel === "watch" ||
    signalLabel === "weak_bounce"
  ) {
    return groupCodeByResultGroup.watch;
  }

  return groupCodeByResultGroup.neutral;
}

function makeSignals({
  scanRunId,
  prefix,
  count,
  rankStart,
  signalLabel,
  actionBias,
  primaryStructure,
}: {
  scanRunId: string;
  prefix: string;
  count: number;
  rankStart: number;
  signalLabel: LatestScanSignalRecord["signalLabel"];
  actionBias: LatestScanSignalRecord["actionBias"];
  primaryStructure: LatestScanSignalRecord["primaryStructure"];
}) {
  return Array.from({ length: count }, (_, index) =>
    makeSignal({
      id: `${prefix}-${index}`,
      scanRunId,
      symbol: `${prefix}${index}USDT`,
      rankScore: rankStart - index,
      signalLabel,
      actionBias,
      primaryStructure,
    }),
  );
}
