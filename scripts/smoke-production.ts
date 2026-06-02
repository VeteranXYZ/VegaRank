const defaultTradeApiBaseUrl = "https://api.auere.com";
const mtfTimeframes = ["1h", "4h", "1d", "1w"] as const;
const marketContextTimeframes = ["1w", "1d", "4h"] as const;

type JsonRecord = Record<string, unknown>;
type SmokeMessage = {
  title: string;
  details: string[];
};
export type FetchLike = (
  input: string,
  init?: { method: "GET" },
) => Promise<{
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}>;

type FetchJsonResult =
  | {
      ok: true;
      status: number;
      url: string;
      body: unknown;
    }
  | {
      ok: false;
      status: number | null;
      url: string;
      message: string;
      body?: unknown;
    };

type SmokeContext = {
  mtfLatest?: {
    body: JsonRecord;
    rows: JsonRecord[];
  };
  symbolResearch: Record<string, JsonRecord>;
};

type SignalComparison =
  | {
      status: "match";
      details: string[];
    }
  | {
      status: "mismatch";
      details: string[];
    }
  | {
      status: "missing";
      details: string[];
    };

export function createSmokeReport() {
  return {
    passes: [] as SmokeMessage[],
    warnings: [] as SmokeMessage[],
    failures: [] as SmokeMessage[],
    infos: [] as SmokeMessage[],
    pass(title: string, details: string[] = []) {
      this.passes.push({ title, details });
    },
    warn(title: string, details: string[] = []) {
      this.warnings.push({ title, details });
    },
    fail(title: string, details: string[] = []) {
      this.failures.push({ title, details });
    },
    info(title: string, details: string[] = []) {
      this.infos.push({ title, details });
    },
  };
}

type SmokeReport = ReturnType<typeof createSmokeReport>;

async function main() {
  const report = createSmokeReport();
  const baseUrl = getTradeApiBaseUrl(process.env.TRADE_API_BASE_URL);

  await runProductionSmokeTest({ baseUrl, report });
  printSmokeReport({ baseUrl, report });

  process.exitCode = report.failures.length > 0 ? 1 : 0;
}

export async function runProductionSmokeTest({
  baseUrl,
  report = createSmokeReport(),
  fetchImpl = fetch,
}: {
  baseUrl: string;
  report?: SmokeReport;
  fetchImpl?: FetchLike;
}) {
  const context: SmokeContext = {
    symbolResearch: {},
  };

  await checkMtfLatest({ baseUrl, report, context, fetchImpl });
  await checkMarketContext({ baseUrl, report, fetchImpl });
  await checkSymbolResearch({
    baseUrl,
    report,
    context,
    fetchImpl,
    symbol: "BTCUSDT",
    timeframe: "1h",
  });
  await checkSymbolResearch({
    baseUrl,
    report,
    context,
    fetchImpl,
    symbol: "SEIUSDT",
    timeframe: "4h",
  });
  await checkSignalEvaluation({
    baseUrl,
    report,
    fetchImpl,
    group: "risk",
    signalLabel: "breakdown_risk",
    timeframe: "4h",
  });
  await checkSignalEvaluation({
    baseUrl,
    report,
    fetchImpl,
    group: "eligible",
    signalLabel: "confirmed",
    timeframe: "4h",
    optional: true,
  });
  checkConsistency({ report, context, symbol: "BTCUSDT", timeframe: "1h" });
  checkConsistency({ report, context, symbol: "SEIUSDT", timeframe: "4h" });

  return report;
}

export function getTradeApiBaseUrl(
  value: string | null | undefined = process.env.TRADE_API_BASE_URL,
) {
  return (value?.trim() || defaultTradeApiBaseUrl).replace(/\/+$/, "");
}

export async function fetchJson({
  baseUrl,
  path,
  fetchImpl = fetch,
}: {
  baseUrl: string;
  path: string;
  fetchImpl?: FetchLike;
}): Promise<FetchJsonResult> {
  const url = new URL(path, `${getTradeApiBaseUrl(baseUrl)}/`).toString();

  try {
    const response = await fetchImpl(url, { method: "GET" });
    const rawBody = await response.text();
    const body = parseJsonBody(rawBody);

    if (body.error) {
      return {
        ok: false,
        status: response.status,
        url,
        message: `Invalid JSON response: ${body.error}`,
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        url,
        message: `HTTP ${response.status}`,
        body: body.value,
      };
    }

    return {
      ok: true,
      status: response.status,
      url,
      body: body.value,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      url,
      message: error instanceof Error ? error.message : "Request failed",
    };
  }
}

export function extractRows(body: unknown): JsonRecord[] {
  if (!isRecord(body)) {
    return [];
  }

  for (const key of ["rows", "items", "data"]) {
    const value = body[key];

    if (Array.isArray(value)) {
      return value.filter(isRecord);
    }
  }

  return [];
}

export function getMtfSignal(
  rows: JsonRecord[],
  symbol: string,
  timeframe: string,
) {
  const row = rows.find(
    (item) => getString(item.symbol).toUpperCase() === symbol.toUpperCase(),
  );
  const timeframes = isRecord(row?.timeframes) ? row.timeframes : null;
  const signal = timeframes?.[timeframe];

  return isRecord(signal) ? signal : null;
}

export function compareSignalsForConsistency({
  symbol,
  timeframe,
  mtfSignal,
  researchSignal,
}: {
  symbol: string;
  timeframe: string;
  mtfSignal: unknown;
  researchSignal: unknown;
}): SignalComparison {
  if (!isRecord(mtfSignal) || !isRecord(researchSignal)) {
    return {
      status: "missing",
      details: [
        `${symbol} ${timeframe} is not available in both MTF latest and Symbol Research.`,
      ],
    };
  }

  const comparisons = [
    {
      label: "group",
      left: getSignalGroup(mtfSignal),
      right: getSignalGroup(researchSignal),
    },
    {
      label: "signalLabel",
      left: getNullableString(mtfSignal.signalLabel),
      right: getNullableString(researchSignal.signalLabel),
    },
    {
      label: "rankScore",
      left: getComparableNumber(mtfSignal.rankScore),
      right: getComparableNumber(researchSignal.rankScore),
    },
    {
      label: "finalSignalScore",
      left: getComparableNumber(mtfSignal.finalSignalScore),
      right: getComparableNumber(researchSignal.finalSignalScore),
    },
    {
      label: "scanTime",
      left: getNullableString(mtfSignal.scanTime),
      right: getNullableString(researchSignal.scanTime),
    },
  ];
  const differences = comparisons
    .filter(({ left, right }) => left !== null && right !== null && left !== right)
    .map(({ label, left, right }) => `${label}: mtf=${left}, research=${right}`);

  if (differences.length > 0) {
    return {
      status: "mismatch",
      details: differences,
    };
  }

  return {
    status: "match",
    details: [`${symbol} ${timeframe} matches selected comparable fields.`],
  };
}

async function checkMtfLatest({
  baseUrl,
  report,
  context,
  fetchImpl,
}: {
  baseUrl: string;
  report: SmokeReport;
  context: SmokeContext;
  fetchImpl: FetchLike;
}) {
  const path = "/api/scan/mtf-latest?assetClass=crypto";
  const startedFailures = report.failures.length;
  const body = await loadJsonRecord({ baseUrl, path, report, fetchImpl });

  if (!body) {
    return;
  }

  expectTrue(report, path, body.ok === true, "ok must be true.");
  expectTrue(
    report,
    path,
    isPositiveNumber(body.count),
    `count must be positive; received ${formatValue(body.count)}.`,
  );
  expectTrue(report, path, isRecord(body.signalCounts), "signalCounts must exist.");
  expectTrue(report, path, isRecord(body.missingCounts), "missingCounts must exist.");

  const signalCounts = isRecord(body.signalCounts) ? body.signalCounts : {};
  const missingCounts = isRecord(body.missingCounts) ? body.missingCounts : {};

  for (const timeframe of ["1h", "4h", "1d"]) {
    expectTrue(
      report,
      path,
      isPositiveNumber(signalCounts[timeframe]),
      `${timeframe} signal count must be positive; received ${formatValue(
        signalCounts[timeframe],
      )}.`,
    );
  }

  if (!isPositiveNumber(signalCounts["1w"])) {
    report.info(path, [
      `1w signal count is ${formatValue(
        signalCounts["1w"],
      )}; this can be valid for sparse weekly coverage.`,
    ]);
  }

  const rows = extractRows(body);
  expectTrue(report, path, rows.length > 0, "rows/items/data array must exist.");

  for (const symbol of ["BTCUSDT", "ETHUSDT"]) {
    if (!rows.some((row) => getString(row.symbol).toUpperCase() === symbol)) {
      report.warn(path, [`${symbol} was not found in joined MTF rows.`]);
    }
  }

  context.mtfLatest = { body, rows };

  if (report.failures.length === startedFailures) {
    report.pass(path, [
      `count: ${formatValue(body.count)}`,
      mtfTimeframes
        .map((timeframe) => `${timeframe}: ${formatValue(signalCounts[timeframe])}`)
        .join(", "),
      `missing: ${mtfTimeframes
        .map((timeframe) => `${timeframe} ${formatValue(missingCounts[timeframe])}`)
        .join(", ")}`,
    ]);
  }
}

async function checkMarketContext({
  baseUrl,
  report,
  fetchImpl,
}: {
  baseUrl: string;
  report: SmokeReport;
  fetchImpl: FetchLike;
}) {
  const path = "/api/market/context?assetClass=crypto";
  const startedFailures = report.failures.length;
  const body = await loadJsonRecord({ baseUrl, path, report, fetchImpl });

  if (!body) {
    return;
  }

  expectTrue(report, path, body.ok === true, "ok must be true.");
  expectTrue(report, path, body.assetClass === "crypto", "assetClass must be crypto.");
  expectTrue(report, path, isRecord(body.context), "context must exist.");
  expectTrue(report, path, isRecord(body.summary), "summary must exist.");
  expectTrue(report, path, isRecord(body.proxies), "proxies must exist.");
  expectTrue(
    report,
    path,
    isRecord(body.rules) && body.rules.researchOnly === true,
    "rules.researchOnly must be true.",
  );

  const proxies = isRecord(body.proxies) ? body.proxies : {};

  for (const symbol of ["BTCUSDT", "ETHUSDT"]) {
    const symbolProxy = proxies[symbol];

    expectTrue(report, path, isRecord(symbolProxy), `proxies.${symbol} must exist.`);

    if (!isRecord(symbolProxy)) {
      continue;
    }

    for (const timeframe of marketContextTimeframes) {
      expectMarketProxyEntry({
        report,
        path,
        symbol,
        timeframe,
        entry: symbolProxy[timeframe],
      });
    }
  }

  const context = isRecord(body.context) ? body.context : {};

  if (report.failures.length === startedFailures) {
    report.pass(path, [
      `combined: ${formatValue(context.combinedContext)}`,
      `confidence: ${formatValue(context.confidence)}`,
      `BTC: ${formatProxySummary(proxies.BTCUSDT)}`,
      `ETH: ${formatProxySummary(proxies.ETHUSDT)}`,
    ]);
  }
}

async function checkSymbolResearch({
  baseUrl,
  report,
  context,
  fetchImpl,
  symbol,
  timeframe,
}: {
  baseUrl: string;
  report: SmokeReport;
  context: SmokeContext;
  fetchImpl: FetchLike;
  symbol: string;
  timeframe: string;
}) {
  const path = `/api/symbol/research?exchange=binance&symbol=${symbol}&timeframe=${timeframe}`;
  const startedFailures = report.failures.length;
  const body = await loadJsonRecord({ baseUrl, path, report, fetchImpl });

  if (!body) {
    return;
  }

  expectTrue(report, path, body.ok === true, "ok must be true.");
  expectTrue(report, path, body.timeframe === timeframe, `timeframe must be ${timeframe}.`);
  expectTrue(report, path, isRecord(body.symbol), "symbol metadata must exist.");
  expectTrue(
    report,
    path,
    isRecord(body.behaviorDiagnostics),
    "behaviorDiagnostics must exist.",
  );

  const latestSignal = getLatestSignal(body);
  expectTrue(report, path, latestSignal !== null, "latest signal must exist.");

  if (latestSignal) {
    expectTrue(
      report,
      path,
      getSignalGroup(latestSignal) !== null,
      "latest signal must include resultGroup/group.",
    );
    expectTrue(
      report,
      path,
      getNullableString(latestSignal.signalLabel) !== null,
      "latest signal must include signalLabel.",
    );

    if (
      getComparableNumber(latestSignal.rankScore) === null &&
      getComparableNumber(latestSignal.finalSignalScore) === null
    ) {
      report.warn(path, [
        "latest signal has neither rankScore nor finalSignalScore; check selected signal payload.",
      ]);
    }
  }

  if (symbol === "SEIUSDT") {
    expectTrue(
      report,
      path,
      Array.isArray(body.timeframes),
      "timeframes/MTF snapshot context must exist.",
    );
  }

  context.symbolResearch[`${symbol}:${timeframe}`] = body;

  if (report.failures.length === startedFailures) {
    report.pass(path, [
      `group: ${formatValue(latestSignal ? getSignalGroup(latestSignal) : null)}`,
      `signal: ${formatValue(latestSignal?.signalLabel)}`,
      `behavior: ${formatBehaviorDiagnostics(body.behaviorDiagnostics)}`,
    ]);
  }
}

async function checkSignalEvaluation({
  baseUrl,
  report,
  fetchImpl,
  timeframe,
  group,
  signalLabel,
  optional = false,
}: {
  baseUrl: string;
  report: SmokeReport;
  fetchImpl: FetchLike;
  timeframe: string;
  group: string;
  signalLabel: string;
  optional?: boolean;
}) {
  const path = `/api/signal/evaluation?timeframe=${timeframe}&group=${group}&signalLabel=${signalLabel}&assetClass=crypto`;
  const startedFailures = report.failures.length;
  const body = await loadJsonRecord({ baseUrl, path, report, fetchImpl });

  if (!body) {
    return;
  }

  expectTrue(report, path, body.ok === true, "ok must be true.");
  expectTrue(
    report,
    path,
    getNullableString(body.expectedDirection) !== null,
    "expectedDirection must exist.",
  );
  expectTrue(report, path, isRecord(body.sample), "sample must exist.");
  expectTrue(report, path, isRecord(body.horizons), "horizons must exist.");
  expectTrue(report, path, isRecord(body.interpretation), "interpretation must exist.");
  expectTrue(
    report,
    path,
    isRecord(body.interpretation) && body.interpretation.researchOnly === true,
    "interpretation.researchOnly must be true.",
  );

  const selectedHorizon = getBestHorizon(body.horizons);
  expectTrue(
    report,
    path,
    selectedHorizon !== null,
    "at least one horizon must have sampleSize > 0.",
  );

  if (report.failures.length === startedFailures) {
    const sample = isRecord(body.sample) ? body.sample : {};

    report.pass(path, [
      `expectedDirection: ${formatValue(body.expectedDirection)}`,
      `sampleQuality: ${formatValue(sample.sampleQuality)}`,
      `selected horizon: ${selectedHorizon ?? "not available"}`,
      optional ? "optional validation endpoint" : "core validation endpoint",
    ]);
  }
}

function checkConsistency({
  report,
  context,
  symbol,
  timeframe,
}: {
  report: SmokeReport;
  context: SmokeContext;
  symbol: string;
  timeframe: string;
}) {
  const researchBody = context.symbolResearch[`${symbol}:${timeframe}`];
  const mtfSignal = context.mtfLatest
    ? getMtfSignal(context.mtfLatest.rows, symbol, timeframe)
    : null;
  const researchSignal = researchBody ? getLatestSignal(researchBody) : null;
  const comparison = compareSignalsForConsistency({
    symbol,
    timeframe,
    mtfSignal,
    researchSignal,
  });

  if (comparison.status === "match") {
    report.pass(`consistency ${symbol} ${timeframe}`, comparison.details);
    return;
  }

  if (comparison.status === "missing") {
    report.info(`consistency ${symbol} ${timeframe}`, comparison.details);
    return;
  }

  report.warn(`consistency ${symbol} ${timeframe}`, [
    `${symbol} ${timeframe} differs between mtf-latest and symbol research. Check selected-run context.`,
    ...comparison.details,
  ]);
}

async function loadJsonRecord({
  baseUrl,
  path,
  report,
  fetchImpl,
}: {
  baseUrl: string;
  path: string;
  report: SmokeReport;
  fetchImpl: FetchLike;
}) {
  const response = await fetchJson({ baseUrl, path, fetchImpl });

  if (!response.ok) {
    report.fail(path, [
      response.status === null ? response.message : `${response.message} ${response.url}`,
      response.body ? `body: ${JSON.stringify(response.body)}` : "",
    ].filter(Boolean));
    return null;
  }

  if (!isRecord(response.body)) {
    report.fail(path, ["Response body must be a JSON object."]);
    return null;
  }

  return response.body;
}

function expectTrue(
  report: SmokeReport,
  title: string,
  condition: boolean,
  detail: string,
) {
  if (!condition) {
    report.fail(title, [detail]);
  }
}

function expectMarketProxyEntry({
  report,
  path,
  symbol,
  timeframe,
  entry,
}: {
  report: SmokeReport;
  path: string;
  symbol: string;
  timeframe: string;
  entry: unknown;
}) {
  expectTrue(
    report,
    path,
    isRecord(entry),
    `proxies.${symbol}.${timeframe} must be present or explicitly unavailable.`,
  );

  if (!isRecord(entry)) {
    return;
  }

  expectTrue(
    report,
    path,
    entry.timeframe === timeframe,
    `proxies.${symbol}.${timeframe}.timeframe must be ${timeframe}.`,
  );

  if (entry.available === true) {
    expectTrue(
      report,
      path,
      getSignalGroup(entry) !== null,
      `proxies.${symbol}.${timeframe} available entry must include group.`,
    );
    return;
  }

  expectTrue(
    report,
    path,
    entry.available === false && getNullableString(entry.reason) !== null,
    `proxies.${symbol}.${timeframe} unavailable entry must include reason.`,
  );
}

function printSmokeReport({
  baseUrl,
  report,
}: {
  baseUrl: string;
  report: SmokeReport;
}) {
  console.log("Production Smoke Test");
  console.log(`Base URL: ${baseUrl}`);
  console.log("");
  printSection("PASS", report.passes);
  printSection("WARN", report.warnings);
  printSection("INFO", report.infos);
  printSection("FAIL", report.failures);
  console.log("Summary:");
  console.log(`  Passed: ${report.passes.length}`);
  console.log(`  Warnings: ${report.warnings.length}`);
  console.log(`  Failed: ${report.failures.length}`);
  console.log(`  Info: ${report.infos.length}`);
}

function printSection(label: string, messages: SmokeMessage[]) {
  for (const message of messages) {
    console.log(`${label} ${message.title}`);

    for (const detail of message.details) {
      console.log(`  ${detail}`);
    }

    console.log("");
  }
}

function parseJsonBody(rawBody: string):
  | {
      value: unknown;
      error?: never;
    }
  | {
      value?: never;
      error: string;
    } {
  if (!rawBody.trim()) {
    return { value: null };
  }

  try {
    return { value: JSON.parse(rawBody) as unknown };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "JSON parse failed",
    };
  }
}

function formatProxySummary(proxy: unknown) {
  if (!isRecord(proxy)) {
    return "unavailable";
  }

  return marketContextTimeframes
    .map((timeframe) => `${timeframe} ${formatProxyEntry(proxy[timeframe])}`)
    .join(", ");
}

function formatProxyEntry(entry: unknown) {
  if (!isRecord(entry)) {
    return "missing";
  }

  if (entry.available === false) {
    return `unavailable(${formatValue(entry.reason)})`;
  }

  return formatValue(getSignalGroup(entry));
}

function formatBehaviorDiagnostics(value: unknown) {
  if (!isRecord(value)) {
    return "missing";
  }

  return value.available === true ? "available" : formatValue(value.reason);
}

function getBestHorizon(horizons: unknown) {
  if (!isRecord(horizons)) {
    return null;
  }

  const sorted = Object.entries(horizons).sort(([left], [right]) => {
    return Number(left) - Number(right);
  });
  const firstPositive = sorted.find(([, value]) => {
    return isRecord(value) && isPositiveNumber(value.sampleSize);
  });

  return firstPositive?.[0] ?? null;
}

function getLatestSignal(body: JsonRecord) {
  const latest = isRecord(body.latest) ? body.latest : null;
  const signal = latest && isRecord(latest.signal) ? latest.signal : null;

  return signal;
}

function getSignalGroup(signal: JsonRecord) {
  return (
    getNullableString(signal.resultGroup) ??
    getNullableString(signal.group) ??
    getNullableString(signal.reviewTier)
  );
}

function getComparableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Number(value.toFixed(6))
    : null;
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

function isPositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

if (process.argv[1]?.endsWith("smoke-production.ts")) {
  void main();
}
