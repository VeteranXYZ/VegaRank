import {
  auditLiveCryptoOhlcvProviders,
  type FetchLike,
  type LiveAuditProviderId,
  type LiveAuditTimeframe,
  type LiveProviderAuditReport,
  type LiveProviderProbe,
} from "@/lib/market-data/liveProviderAudit";
import { createAuthRequiredProbe } from "@/lib/market-data/providers/authRequiredProbeProvider";
import { createCoinbaseAdvancedDirectProbe } from "@/lib/market-data/providers/coinbaseAdvancedDirectProvider";
import { createCoinbaseExchangePublicProbe } from "@/lib/market-data/providers/coinbaseExchangePublicProbeProvider";
import { createCoinGeckoProbe } from "@/lib/market-data/providers/coingeckoProbeProvider";
import { createCryptoCompareProbe } from "@/lib/market-data/providers/cryptocompareProbeProvider";
import { createCryptoDataDownloadProbe } from "@/lib/market-data/providers/cryptoDataDownloadProbeProvider";

const defaultProviders: LiveAuditProviderId[] = [
  "coinbase_advanced_direct",
  "coinbase_exchange_public",
  "cryptocompare",
  "cryptodatadownload",
  "coingecko",
];
const defaultSymbols = [
  "BTCUSDT",
  "ETHUSDT",
  "AERO-USDC",
  "CLANKER-USDC",
  "BNKR-USDC",
  "AUDD-USDC",
  "CTR-USDC",
  "CHECK-USDC",
  "DRIFT-USDC",
  "DOGINME-USDC",
  "CBETH-USDC",
  "00-USDC",
];
const defaultTimeframes: LiveAuditTimeframe[] = ["1h", "4h", "1d", "1w"];
const validProviders: LiveAuditProviderId[] = [
  "coinbase_advanced_direct",
  "coinbase_exchange_public",
  "cryptocompare",
  "cryptodatadownload",
  "coingecko",
  "coinapi",
  "kaiko",
  "polygon_crypto",
  "tiingo_crypto",
];
const validTimeframes: LiveAuditTimeframe[] = ["1h", "4h", "1d", "1w"];

export type LiveAuditCliConsole = {
  log: (message?: unknown, ...optionalParams: unknown[]) => void;
};

if (process.argv[1]?.endsWith("audit-live-crypto-ohlcv-providers.ts")) {
  await runLiveAuditCli(process.argv.slice(2), console);
}

export async function runLiveAuditCli(
  args: string[],
  output: LiveAuditCliConsole = console,
  fetcher?: FetchLike,
): Promise<LiveProviderAuditReport> {
  const parsed = parseArgs(args);
  const report = await auditLiveCryptoOhlcvProviders({
    providers: parsed.providers,
    symbols: parsed.symbols,
    timeframes: parsed.timeframes,
    lookbackDays: parsed.lookbackDays,
    timeoutMs: parsed.timeoutMs,
    verbose: parsed.verbose,
    fetcher,
    probes: createLiveAuditProbes(),
  });

  if (parsed.format === "json") {
    output.log(JSON.stringify(report, null, 2));
  } else if (parsed.format === "markdown") {
    output.log(formatLiveAuditMarkdown(report));
  } else {
    output.log(formatLiveAuditMarkdown(report));
  }

  return report;
}

function createLiveAuditProbes(): Record<LiveAuditProviderId, LiveProviderProbe> {
  return {
    coinbase_advanced_direct: createCoinbaseAdvancedDirectProbe({
      bearerToken: process.env.COINBASE_ADVANCED_BEARER_TOKEN,
    }),
    coinbase_exchange_public: createCoinbaseExchangePublicProbe(),
    cryptocompare: createCryptoCompareProbe({
      apiKey: process.env.CRYPTOCOMPARE_API_KEY,
    }),
    cryptodatadownload: createCryptoDataDownloadProbe(),
    coingecko: createCoinGeckoProbe({
      apiKey: process.env.COINGECKO_API_KEY,
    }),
    coinapi: createAuthRequiredProbe("coinapi"),
    kaiko: createAuthRequiredProbe("kaiko"),
    polygon_crypto: createAuthRequiredProbe("polygon_crypto"),
    tiingo_crypto: createAuthRequiredProbe("tiingo_crypto"),
  };
}

function parseArgs(args: string[]) {
  const providers = parseListFlag(args, "--providers", defaultProviders).map((provider) => {
    if (!validProviders.includes(provider as LiveAuditProviderId)) {
      throw new Error(`Unsupported provider '${provider}'. Valid providers: ${validProviders.join(", ")}`);
    }
    return provider as LiveAuditProviderId;
  });
  const symbols = parseListFlag(args, "--symbols", defaultSymbols);
  const limitSymbols = parseNumberFlag(args, "--limit-symbols");
  const limitedSymbols = limitSymbols === undefined ? symbols : symbols.slice(0, limitSymbols);
  const timeframes = parseListFlag(args, "--timeframes", defaultTimeframes).map((timeframe) => {
    if (!validTimeframes.includes(timeframe as LiveAuditTimeframe)) {
      throw new Error(`Unsupported timeframe '${timeframe}'. Valid timeframes: ${validTimeframes.join(", ")}`);
    }
    return timeframe as LiveAuditTimeframe;
  });

  return {
    providers,
    symbols: limitedSymbols,
    timeframes,
    lookbackDays: parseNumberFlag(args, "--lookback-days") ?? 365,
    timeoutMs: parseNumberFlag(args, "--timeout-ms") ?? 15_000,
    verbose: args.includes("--verbose"),
    format: args.includes("--json") ? "json" : args.includes("--markdown") ? "markdown" : "markdown",
  };
}

function parseListFlag<T extends string>(
  args: string[],
  name: string,
  defaultValue: readonly T[],
): string[] {
  const raw = args.find((arg) => arg.startsWith(`${name}=`));
  if (!raw) {
    return [...defaultValue];
  }
  return raw
    .slice(name.length + 1)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseNumberFlag(args: string[], name: string) {
  const raw = args.find((arg) => arg.startsWith(`${name}=`));
  if (!raw) {
    return undefined;
  }
  const value = Number(raw.slice(name.length + 1));
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number.`);
  }
  return Math.floor(value);
}

function formatLiveAuditMarkdown(report: LiveProviderAuditReport) {
  const rows = report.results.map((result) => [
    result.providerId,
    result.symbolRequested,
    result.providerSymbolUsed,
    result.timeframe,
    String(result.exchangeSpecific),
    String(result.aggregatedOnly),
    String(result.nativeIntervalSupported),
    result.providerGranularity ?? "",
    String(result.fetchedCandles),
    String(result.enoughForVegaRank200),
    result.httpStatus === undefined ? "" : String(result.httpStatus),
    result.failureCategory ?? "",
    result.errorCode ?? "",
  ]);

  return [
    "# Live Crypto OHLCV Provider Audit",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Read-only: yes. No database writes, scanner runs, cron changes, scoring changes, or UI changes.",
    "",
    "## Provider Matrix",
    "",
    "| providerId | symbol | providerSymbol | timeframe | exchangeSpecific | aggregatedOnly | nativeIntervalSupported | providerGranularity | fetchedCandles | enoughForVegaRank200 | httpStatus | failureCategory | errorCode |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- | ---: | --- | --- |",
    ...rows.map((row) => `| ${row.join(" | ")} |`),
    "",
    "## Summary",
    "",
    `- Providers audited: ${report.summary.providersAudited.join(", ") || "none"}`,
    `- Symbols audited: ${report.summary.symbolsAudited.join(", ") || "none"}`,
    `- Exchange-specific candidates: ${report.summary.exchangeSpecificCandidates.join(", ") || "none"}`,
    `- Aggregated-only candidates: ${report.summary.aggregatedOnlyCandidates.join(", ") || "none"}`,
    `- Production-ready primary candidates: ${report.summary.productionReadyPrimaryCandidates.join(", ") || "none"}`,
    `- Requires-auth candidates: ${report.summary.requiresAuthCandidates.join(", ") || "none"}`,
    `- Paid/key-required candidates: ${report.summary.paidOrKeyRequiredCandidates.join(", ") || "none"}`,
    `- Metadata-only candidates: ${report.summary.metadataOnlyCandidates.join(", ") || "none"}`,
    `- Blocked candidates: ${report.summary.blockedCandidates.join(", ") || "none"}`,
    `- Native 4h candidates: ${report.summary.native4hCandidates.join(", ") || "none"}`,
    `- Native 1w candidates: ${report.summary.native1wCandidates.join(", ") || "none"}`,
    `- Auth or paid blocked providers: ${report.summary.authOrPaidBlockedProviders.join(", ") || "none"}`,
    `- Recommended next phase: ${report.summary.recommendedNextPhase}`,
    "",
    "## Provider Checklist",
    "",
    "| providerId | exchangeSpecificOHLCV | 1h | 4h | 1d | 1w | Coinbase attribution | freeTier | keyRequired | redistributionUnknown | candidateRole |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...report.summary.providerChecklists.map((item) =>
      [
        item.providerId,
        String(item.supportsExchangeSpecificOhlcv),
        String(item.supports1h),
        String(item.supports4h),
        String(item.supports1d),
        String(item.supports1w),
        String(item.supportsCoinbaseVenueOrPairAttribution),
        String(item.freeTierAvailable),
        String(item.keyRequired),
        String(item.redistributionDisplayLimitationUnknown),
        item.candidateRole,
      ].join(" | "),
    ).map((row) => `| ${row} |`),
    "",
    "## Decision Notes",
    "",
    ...report.summary.providerDecisionNotes.map((note) => `- ${note}`),
    "",
    "## Recommended Next Provider Tests",
    "",
    ...report.summary.recommendedNextProviderTests.map((note) => `- ${note}`),
  ].join("\n");
}
