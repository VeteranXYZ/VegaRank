import {
  extractRows,
  fetchJson,
  getTradeApiBaseUrl,
  type FetchLike,
} from "./smoke-production";

const keySymbols = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "LINKUSDT",
  "SEIUSDT",
] as const;
const requiredWeeklySymbols = new Set(["BTCUSDT", "ETHUSDT"]);
const timeframes = ["1h", "4h", "1d", "1w"] as const;
const coreTimeframes = ["1h", "4h", "1d"] as const;

type Timeframe = (typeof timeframes)[number];
type JsonRecord = Record<string, unknown>;
type CheckMessage = {
  title: string;
  details: string[];
};
type CoverageStatus = "pass" | "warn" | "fail";
type KeySymbolRow = {
  symbol: string;
  cells: Record<Timeframe, string>;
  status: CoverageStatus;
};
type LatestRunRow = {
  timeframe: Timeframe;
  runId: string;
  status: string;
  symbolsScanned: string;
  signalsCreated: string;
  likelyFullUniverse: string;
  fallback: string;
  result: CoverageStatus;
};
type MarketCoverageRow = {
  timeframe: Timeframe;
  totalSymbols: string;
  healthy: string;
  stale: string;
  belowMinimum: string;
  latestOpenTime: string;
  result: CoverageStatus;
};
type ObservationReadinessRow = {
  timeframe: Timeframe;
  runId: string;
  diagnostic: string;
  complete: string;
  partial: string;
  missing: string;
  coverageLag: string;
  result: CoverageStatus;
};

export function createCoverageReport() {
  return {
    failures: [] as CheckMessage[],
    warnings: [] as CheckMessage[],
    infos: [] as CheckMessage[],
    sections: new Map<string, string[]>(),
    fail(title: string, details: string[] = []) {
      this.failures.push({ title, details });
    },
    warn(title: string, details: string[] = []) {
      this.warnings.push({ title, details });
    },
    info(title: string, details: string[] = []) {
      this.infos.push({ title, details });
    },
    section(title: string, lines: string[]) {
      this.sections.set(title, lines);
    },
  };
}

type CoverageReport = ReturnType<typeof createCoverageReport>;

async function main() {
  const report = createCoverageReport();
  const baseUrl = getTradeApiBaseUrl(process.env.TRADE_API_BASE_URL);
  const generatedAt = new Date();

  await runProductionCoverageCheck({
    baseUrl,
    report,
    now: generatedAt,
  });
  printCoverageReport({
    baseUrl,
    generatedAt,
    report,
  });

  process.exitCode = getCoverageExitCode(report);
}

export async function runProductionCoverageCheck({
  baseUrl,
  report = createCoverageReport(),
  now = new Date(),
  fetchImpl = fetch,
}: {
  baseUrl: string;
  report?: CoverageReport;
  now?: Date;
  fetchImpl?: FetchLike;
}) {
  const mtfBody = await getJsonObject({
    baseUrl,
    path: "/api/scan/mtf-latest?assetClass=crypto",
    report,
    fetchImpl,
    critical: true,
  });

  if (mtfBody) {
    const rows = extractRows(mtfBody);

    evaluateMtfCoverage({ body: mtfBody, rows, report });
    evaluateFreshness({ body: mtfBody, rows, now, report });
    evaluateKeySymbols({ rows, report });
  }

  const latestRunRows: LatestRunRow[] = [];
  const marketCoverageRows: MarketCoverageRow[] = [];
  const observationReadinessRows: ObservationReadinessRow[] = [];

  for (const timeframe of timeframes) {
    const body = await getJsonObject({
      baseUrl,
      path: `/api/scan/latest?timeframe=${timeframe}&assetClass=crypto&limit=100`,
      report,
      fetchImpl,
      critical: true,
    });

    const latestRunRow = evaluateLatestRunSelection({
      timeframe,
      body,
      report,
    });
    latestRunRows.push(latestRunRow);

    const marketCoverageBody = await getJsonObject({
      baseUrl,
      path: `/api/market-data/coverage?timeframe=${timeframe}&assetClass=crypto&limit=500`,
      report,
      fetchImpl,
      critical: false,
    });

    marketCoverageRows.push(
      evaluateMarketDataCoverage({
        timeframe,
        body: marketCoverageBody,
        report,
      }),
    );

    if (latestRunRow.runId !== "not available") {
      const readinessBody = await getJsonObject({
        baseUrl,
        path: `/api/history/observation-readiness?timeframe=${timeframe}&assetClass=crypto&window=3&runId=${latestRunRow.runId}`,
        report,
        fetchImpl,
        critical: false,
      });

      observationReadinessRows.push(
        evaluateObservationReadiness({
          timeframe,
          runId: latestRunRow.runId,
          body: readinessBody,
          report,
        }),
      );
    } else {
      observationReadinessRows.push({
        timeframe,
        runId: latestRunRow.runId,
        diagnostic: "not available",
        complete: "not available",
        partial: "not available",
        missing: "not available",
        coverageLag: "not available",
        result: "fail",
      });
    }
  }

  report.section("Latest Run Selection", [
    "timeframe | run id | status | symbols scanned | signals created | likely full universe | fallback | result",
    ...latestRunRows.map((row) =>
      [
        row.timeframe,
        row.runId,
        row.status,
        row.symbolsScanned,
        row.signalsCreated,
        row.likelyFullUniverse,
        row.fallback,
        row.result.toUpperCase(),
      ].join(" | "),
    ),
  ]);

  report.section("Market Candle Coverage", [
    "timeframe | total symbols | healthy | stale | below minimum | latest open time | result",
    ...marketCoverageRows.map((row) =>
      [
        row.timeframe,
        row.totalSymbols,
        row.healthy,
        row.stale,
        row.belowMinimum,
        row.latestOpenTime,
        row.result.toUpperCase(),
      ].join(" | "),
    ),
  ]);

  report.section("Observation Readiness", [
    "timeframe | run id | diagnostic | complete | partial | missing | coverage lag | result",
    ...observationReadinessRows.map((row) =>
      [
        row.timeframe,
        row.runId,
        row.diagnostic,
        row.complete,
        row.partial,
        row.missing,
        row.coverageLag,
        row.result.toUpperCase(),
      ].join(" | "),
    ),
  ]);

  return report;
}

export function evaluateMtfCoverage({
  body,
  rows,
  report,
}: {
  body: unknown;
  rows?: JsonRecord[];
  report: CoverageReport;
}) {
  const payload = isRecord(body) ? body : {};
  const signalCounts = isRecord(payload.signalCounts) ? payload.signalCounts : {};
  const missingCounts = isRecord(payload.missingCounts) ? payload.missingCounts : {};
  const joinedRows = rows ?? extractRows(payload);

  if (payload.ok !== true) {
    report.fail("MTF Coverage", ["mtf-latest ok must be true."]);
  }

  checkMinimum({
    report,
    title: "MTF Coverage",
    label: "count",
    value: payload.count,
    minimum: 300,
    severity: "fail",
  });

  for (const timeframe of coreTimeframes) {
    checkMinimum({
      report,
      title: "MTF Coverage",
      label: `${timeframe} signal count`,
      value: signalCounts[timeframe],
      minimum: 300,
      severity: "fail",
    });
  }

  checkMinimum({
    report,
    title: "MTF Coverage",
    label: "1w signal count",
    value: signalCounts["1w"],
    minimum: 100,
    severity: "warn",
    detail:
      "Weekly coverage is naturally limited by listing age and weekly candle depth.",
  });

  checkMaximum({
    report,
    title: "MTF Coverage",
    label: "1h missing count",
    value: missingCounts["1h"],
    maximum: 5,
    severity: "warn",
  });
  checkMaximum({
    report,
    title: "MTF Coverage",
    label: "4h missing count",
    value: missingCounts["4h"],
    maximum: 30,
    severity: "warn",
  });
  checkMaximum({
    report,
    title: "MTF Coverage",
    label: "1d missing count",
    value: missingCounts["1d"],
    maximum: 60,
    severity: "warn",
  });

  const weeklyMissingCount = toNumber(missingCounts["1w"]) ?? 0;

  if (weeklyMissingCount > 0) {
    report.warn("MTF Coverage", [
      `1w missing count is ${formatValue(
        missingCounts["1w"],
      )}. Weekly coverage can be high-missing for newer symbols.`,
    ]);
  }

  report.section("MTF Coverage", [
    `count: ${formatValue(payload.count)}`,
    timeframes
      .map((timeframe) => `${timeframe}: ${formatValue(signalCounts[timeframe])}`)
      .join(", "),
    `missing: ${timeframes
      .map((timeframe) => `${timeframe} ${formatValue(missingCounts[timeframe])}`)
      .join(", ")}`,
    `rows: ${joinedRows.length}`,
  ]);
}

export function evaluateFreshness({
  body,
  rows,
  now,
  report,
}: {
  body: unknown;
  rows: JsonRecord[];
  now: Date;
  report: CoverageReport;
}) {
  const payload = isRecord(body) ? body : {};
  const lines: string[] = [
    "timeframe | latest timestamp | age | status",
  ];

  for (const timeframe of timeframes) {
    const timestamp = getFreshnessTimestamp({ body: payload, rows, timeframe });
    const result = evaluateFreshnessTimestamp({
      timeframe,
      timestamp,
      now,
    });

    if (result.status === "fail") {
      report.fail("Freshness", [result.message]);
    } else if (result.status === "warn") {
      report.warn("Freshness", [result.message]);
    }

    lines.push(
      [
        timeframe,
        timestamp ?? "not available",
        result.ageLabel,
        result.status.toUpperCase(),
      ].join(" | "),
    );
  }

  report.section("Freshness", lines);
}

export function evaluateFreshnessTimestamp({
  timeframe,
  timestamp,
  now,
}: {
  timeframe: Timeframe;
  timestamp: string | null;
  now: Date;
}) {
  const thresholds = freshnessThresholds[timeframe];
  const parsed = timestamp ? Date.parse(timestamp) : Number.NaN;

  if (!timestamp || Number.isNaN(parsed)) {
    return {
      status: "fail" as const,
      ageHours: null,
      ageLabel: "not available",
      message: `${timeframe} latest timestamp is missing or malformed.`,
    };
  }

  const ageHours = Math.max(0, (now.getTime() - parsed) / 3_600_000);
  const ageLabel = formatAge(ageHours);

  if (ageHours > thresholds.failHours) {
    return {
      status: "fail" as const,
      ageHours,
      ageLabel,
      message: `${timeframe} latest run is stale (${ageLabel}; fail threshold ${formatAge(
        thresholds.failHours,
      )}).`,
    };
  }

  if (ageHours > thresholds.warnHours) {
    return {
      status: "warn" as const,
      ageHours,
      ageLabel,
      message: `${timeframe} latest run is aging (${ageLabel}; warning threshold ${formatAge(
        thresholds.warnHours,
      )}).`,
    };
  }

  return {
    status: "pass" as const,
    ageHours,
    ageLabel,
    message: `${timeframe} latest run is fresh (${ageLabel}).`,
  };
}

export function evaluateKeySymbols({
  rows,
  report,
}: {
  rows: JsonRecord[];
  report: CoverageReport;
}) {
  const tableRows: KeySymbolRow[] = [];

  for (const symbol of keySymbols) {
    const row = rows.find(
      (item) => getString(item.symbol).toUpperCase() === symbol,
    );
    const cells = createTimeframeCells();
    let status: CoverageStatus = "pass";

    if (!row) {
      report.fail("Key Symbols", [`${symbol} is missing from MTF latest rows.`]);
      tableRows.push({
        symbol,
        cells: markAll("missing"),
        status: "fail",
      });
      continue;
    }

    for (const timeframe of timeframes) {
      const signal = getRowTimeframeSignal(row, timeframe);
      const available = signal !== null;
      cells[timeframe] = available ? "ok" : "missing";

      if (available) {
        continue;
      }

      if (timeframe === "1w" && !requiredWeeklySymbols.has(symbol)) {
        report.warn("Key Symbols", [
          `${symbol} is missing 1w. Weekly signals are optional for non-core key symbols.`,
        ]);
        status = status === "fail" ? "fail" : "warn";
      } else {
        report.fail("Key Symbols", [`${symbol} is missing required ${timeframe}.`]);
        status = "fail";
      }
    }

    tableRows.push({ symbol, cells, status });
  }

  report.section("Key Symbols", [
    "Symbol | 1h | 4h | 1d | 1w | status",
    ...tableRows.map((row) =>
      [
        row.symbol,
        row.cells["1h"],
        row.cells["4h"],
        row.cells["1d"],
        row.cells["1w"],
        row.status.toUpperCase(),
      ].join(" | "),
    ),
  ]);
}

export function evaluateLatestRunSelection({
  timeframe,
  body,
  report,
}: {
  timeframe: Timeframe;
  body: unknown;
  report: CoverageReport;
}): LatestRunRow {
  const payload = isRecord(body) ? body : {};
  const run = isRecord(payload.run) ? payload.run : null;
  const summary = isRecord(payload.summary) ? payload.summary : {};
  const selection = isRecord(summary.latestRunSelection)
    ? summary.latestRunSelection
    : isRecord(run?.latestRunSelection)
      ? run.latestRunSelection
      : null;
  const threshold = timeframe === "1w" ? 100 : 300;
  const symbolsScanned = toNumber(run?.symbolsScanned);
  const signalsCreated = toNumber(run?.signalsCreated);
  const coverageCount = Math.max(symbolsScanned ?? 0, signalsCreated ?? 0);
  let result: CoverageStatus = "pass";

  if (!isRecord(body)) {
    report.fail("Latest Run Selection", [
      `${timeframe} latest scan response is malformed.`,
    ]);
    result = "fail";
  }

  if (payload.ok !== true) {
    report.fail("Latest Run Selection", [`${timeframe} latest scan ok must be true.`]);
    result = "fail";
  }

  if (!run) {
    report.fail("Latest Run Selection", [`${timeframe} latest scan run is missing.`]);
    result = "fail";
  } else {
    if (run.status !== "success") {
      report.fail("Latest Run Selection", [
        `${timeframe} latest run status is ${formatValue(run.status)}, expected success.`,
      ]);
      result = "fail";
    }

    if (coverageCount < threshold) {
      report.fail("Latest Run Selection", [
        `${timeframe} latest run coverage is ${coverageCount}, expected at least ${threshold}.`,
      ]);
      result = "fail";
    }
  }

  if (!selection) {
    report.warn("Latest Run Selection", [
      `${timeframe} latestRunSelection metadata is missing; counts are ${
        coverageCount >= threshold ? "healthy" : "not healthy"
      }.`,
    ]);
    result = "warn";
  } else if (timeframe === "1w") {
    if (selection.fallbackUsed === true || selection.isLikelyFullUniverse === false) {
      report.warn("Latest Run Selection", [
        "1w selected run may be fallback or not full universe; weekly coverage can be limited.",
      ]);
      result = result === "fail" ? "fail" : "warn";
    }
  } else if (
    selection.fallbackUsed === true ||
    selection.isLikelyFullUniverse === false
  ) {
    report.fail("Latest Run Selection", [
      `${timeframe} selected run is clearly not full universe.`,
    ]);
    result = "fail";
  }

  return {
    timeframe,
    runId: formatValue(run?.id),
    status: formatValue(run?.status),
    symbolsScanned: formatValue(run?.symbolsScanned),
    signalsCreated: formatValue(run?.signalsCreated),
    likelyFullUniverse: formatValue(selection?.isLikelyFullUniverse),
    fallback: formatValue(selection?.fallbackUsed),
    result,
  };
}

export function evaluateMarketDataCoverage({
  timeframe,
  body,
  report,
}: {
  timeframe: Timeframe;
  body: unknown;
  report: CoverageReport;
}): MarketCoverageRow {
  const payload = isRecord(body) ? body : {};
  const summary = isRecord(payload.summary) ? payload.summary : {};
  const rows = Array.isArray(payload.rows)
    ? payload.rows.filter(isRecord)
    : [];
  const totalSymbols = toNumber(summary.totalSymbols);
  const healthy = toNumber(summary.healthy);
  const stale = toNumber(summary.stale);
  const belowMinimum = toNumber(summary.belowMinimum);
  const minimum = timeframe === "1w" ? 100 : 300;
  const staleFailThreshold = timeframe === "1w" ? Number.POSITIVE_INFINITY : 30;
  const latestOpenTime = getLatestCoverageTimestamp(rows);
  let result: CoverageStatus = "pass";

  if (!isRecord(body) || payload.ok !== true) {
    report.warn("Market Candle Coverage", [
      `${timeframe} market coverage endpoint is unavailable or malformed.`,
    ]);
    return {
      timeframe,
      totalSymbols: "not available",
      healthy: "not available",
      stale: "not available",
      belowMinimum: "not available",
      latestOpenTime: "not available",
      result: "warn",
    };
  }

  if (totalSymbols === null || totalSymbols < minimum) {
    report.fail("Market Candle Coverage", [
      `${timeframe} market coverage has ${formatValue(
        totalSymbols,
      )} symbols, expected at least ${minimum}.`,
    ]);
    result = "fail";
  }

  if (stale !== null && stale > staleFailThreshold) {
    report.fail("Market Candle Coverage", [
      `${timeframe} has ${stale} stale market candle rows; latest sync likely did not catch up.`,
    ]);
    result = "fail";
  } else if (stale !== null && stale > 0) {
    report.warn("Market Candle Coverage", [
      `${timeframe} has ${stale} stale market candle rows.`,
    ]);
    result = "warn";
  }

  if (belowMinimum !== null && belowMinimum > 0 && timeframe !== "1w") {
    report.warn("Market Candle Coverage", [
      `${timeframe} has ${belowMinimum} scanner symbols below the candle minimum.`,
    ]);
    result = result === "fail" ? "fail" : "warn";
  }

  return {
    timeframe,
    totalSymbols: formatValue(totalSymbols),
    healthy: formatValue(healthy),
    stale: formatValue(stale),
    belowMinimum: formatValue(belowMinimum),
    latestOpenTime: latestOpenTime ?? "not available",
    result,
  };
}

export function evaluateObservationReadiness({
  timeframe,
  runId,
  body,
  report,
}: {
  timeframe: Timeframe;
  runId: string;
  body: unknown;
  report: CoverageReport;
}): ObservationReadinessRow {
  const payload = isRecord(body) ? body : {};
  const selectedRun = isRecord(payload.selectedRun) ? payload.selectedRun : null;
  const metadata = isRecord(payload.metadata) ? payload.metadata : {};
  const diagnostic =
    getNullableString(selectedRun?.diagnosticBlocker) ??
    getNullableString(metadata.diagnosticBlocker) ??
    "not available";
  const complete = toNumber(selectedRun?.completeCount);
  const partial = toNumber(selectedRun?.partialCount);
  const missing = toNumber(selectedRun?.missingCount);
  const rowCount = toNumber(selectedRun?.rowCount);
  const coverageLagCandles = toNumber(selectedRun?.coverageLagCandles);
  let result: CoverageStatus = "pass";

  if (!isRecord(body) || payload.ok !== true || !selectedRun) {
    report.warn("Observation Readiness", [
      `${timeframe} observation readiness endpoint is unavailable or malformed.`,
    ]);
    result = "warn";
  }

  if (diagnostic === "stale_market_data") {
    report.fail("Observation Readiness", [
      `${timeframe} latest run ${runId} is blocked by stale market data.`,
    ]);
    result = "fail";
  } else if (diagnostic === "waiting_for_future_candles") {
    report.info("Observation Readiness", [
      `${timeframe} latest run ${runId} is waiting for completed future candles.`,
    ]);
  } else if (missing !== null && rowCount !== null && missing > rowCount / 2) {
    report.warn("Observation Readiness", [
      `${timeframe} latest run ${runId} has ${missing}/${rowCount} missing observations.`,
    ]);
    result = "warn";
  }

  return {
    timeframe,
    runId,
    diagnostic,
    complete: formatValue(complete),
    partial: formatValue(partial),
    missing: formatValue(missing),
    coverageLag:
      coverageLagCandles === null
        ? "not available"
        : `${coverageLagCandles} candles`,
    result,
  };
}

export function getCoverageExitCode(report: CoverageReport) {
  return report.failures.length > 0 ? 1 : 0;
}

async function getJsonObject({
  baseUrl,
  path,
  report,
  fetchImpl,
  critical,
}: {
  baseUrl: string;
  path: string;
  report: CoverageReport;
  fetchImpl: FetchLike;
  critical: boolean;
}) {
  const response = await fetchJson({ baseUrl, path, fetchImpl });

  if (!response.ok) {
    const details = [
      response.status === null ? response.message : `${response.message} ${response.url}`,
      response.body ? `body: ${JSON.stringify(response.body)}` : "",
    ].filter(Boolean);

    if (critical) {
      report.fail(path, details);
    } else {
      report.warn(path, details);
    }

    return null;
  }

  if (!isRecord(response.body)) {
    report.fail(path, ["Response body must be a JSON object."]);
    return null;
  }

  return response.body;
}

function getFreshnessTimestamp({
  body,
  rows,
  timeframe,
}: {
  body: JsonRecord;
  rows: JsonRecord[];
  timeframe: Timeframe;
}) {
  const runs = isRecord(body.runs) ? body.runs : {};
  const run = isRecord(runs[timeframe]) ? runs[timeframe] : null;
  const runTimestamp =
    getNullableString(run?.finishedAt) ?? getNullableString(run?.startedAt);

  if (runTimestamp) {
    return runTimestamp;
  }

  const signalTimes = rows
    .map((row) => getRowTimeframeSignal(row, timeframe))
    .map((signal) => getNullableString(signal?.scanTime))
    .filter((value): value is string => Boolean(value))
    .sort();

  return signalTimes.at(-1) ?? null;
}

function getLatestCoverageTimestamp(rows: JsonRecord[]) {
  const timestamps = rows
    .map((row) => getNullableString(row.latestOpenTime))
    .filter((value): value is string => Boolean(value))
    .sort();

  return timestamps.at(-1) ?? null;
}

function getRowTimeframeSignal(row: JsonRecord, timeframe: Timeframe) {
  const timeframesMap = isRecord(row.timeframes) ? row.timeframes : {};
  const signal = timeframesMap[timeframe];

  return isRecord(signal) ? signal : null;
}

function checkMinimum({
  report,
  title,
  label,
  value,
  minimum,
  severity,
  detail,
}: {
  report: CoverageReport;
  title: string;
  label: string;
  value: unknown;
  minimum: number;
  severity: "fail" | "warn";
  detail?: string;
}) {
  const numericValue = toNumber(value);

  if (numericValue !== null && numericValue >= minimum) {
    return;
  }

  const details = [
    `${label} is ${formatValue(value)}, expected at least ${minimum}.`,
    detail ?? "",
  ].filter(Boolean);

  if (severity === "fail") {
    report.fail(title, details);
  } else {
    report.warn(title, details);
  }
}

function checkMaximum({
  report,
  title,
  label,
  value,
  maximum,
  severity,
}: {
  report: CoverageReport;
  title: string;
  label: string;
  value: unknown;
  maximum: number;
  severity: "fail" | "warn";
}) {
  const numericValue = toNumber(value);

  if (numericValue !== null && numericValue <= maximum) {
    return;
  }

  const details = [
    `${label} is ${formatValue(value)}, expected no more than ${maximum}.`,
  ];

  if (severity === "fail") {
    report.fail(title, details);
  } else {
    report.warn(title, details);
  }
}

function printCoverageReport({
  baseUrl,
  generatedAt,
  report,
}: {
  baseUrl: string;
  generatedAt: Date;
  report: CoverageReport;
}) {
  console.log("Production Coverage Check");
  console.log(`API Base: ${baseUrl}`);
  console.log(`Generated At: ${generatedAt.toISOString()}`);
  console.log("");

  for (const [index, title] of [
    "MTF Coverage",
    "Freshness",
    "Key Symbols",
    "Latest Run Selection",
    "Market Candle Coverage",
    "Observation Readiness",
  ].entries()) {
    console.log(`${index + 1}. ${title}`);

    for (const line of report.sections.get(title) ?? ["No data available."]) {
      console.log(`  ${line}`);
    }

    console.log("");
  }

  console.log("7. Summary");
  console.log(`  Failures: ${report.failures.length}`);
  console.log(`  Warnings: ${report.warnings.length}`);
  console.log(`  Info: ${report.infos.length}`);

  printMessages("FAIL", report.failures);
  printMessages("WARN", report.warnings);
  printMessages("INFO", report.infos);
  console.log(getFinalStatus(report));
}

function printMessages(label: string, messages: CheckMessage[]) {
  for (const message of messages) {
    console.log(`  ${label} ${message.title}`);

    for (const detail of message.details) {
      console.log(`    ${detail}`);
    }
  }
}

function getFinalStatus(report: CoverageReport) {
  if (report.failures.length > 0) {
    return "FAIL";
  }

  if (report.warnings.length > 0) {
    return "WARN";
  }

  return "PASS";
}

function createTimeframeCells() {
  return {
    "1h": "missing",
    "4h": "missing",
    "1d": "missing",
    "1w": "missing",
  };
}

function markAll(value: string) {
  return {
    "1h": value,
    "4h": value,
    "1d": value,
    "1w": value,
  };
}

function formatAge(ageHours: number) {
  if (ageHours >= 24) {
    return `${round(ageHours / 24)}d`;
  }

  return `${round(ageHours)}h`;
}

function round(value: number) {
  return Number(value.toFixed(1));
}

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getNullableString(value: unknown) {
  const normalized = getString(value).trim();

  return normalized ? normalized : null;
}

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "not available";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "not available";
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const freshnessThresholds: Record<
  Timeframe,
  { warnHours: number; failHours: number }
> = {
  "1h": { warnHours: 3, failHours: 6 },
  "4h": { warnHours: 12, failHours: 24 },
  "1d": { warnHours: 36, failHours: 72 },
  "1w": { warnHours: 24 * 10, failHours: 24 * 21 },
};

if (process.argv[1]?.endsWith("check-production-coverage.ts")) {
  void main();
}
