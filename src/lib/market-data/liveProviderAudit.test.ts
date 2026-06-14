import { describe, expect, it, vi } from "vitest";
import { runLiveAuditCli } from "../../../scripts/audit-live-crypto-ohlcv-providers";
import { providerCapabilityProfilesById } from "./providerCapabilities";
import {
  auditLiveCryptoOhlcvProviders,
  type FetchLike,
  type LiveAuditProviderId,
  type LiveProviderProbe,
} from "./liveProviderAudit";
import { createAuthRequiredProbe } from "./providers/authRequiredProbeProvider";
import {
  createCoinbaseAdvancedDirectProbe,
  mapCoinbaseAdvancedCandleToCandle,
} from "./providers/coinbaseAdvancedDirectProvider";
import { createCoinGeckoProbe } from "./providers/coingeckoProbeProvider";
import { createCryptoCompareProbe } from "./providers/cryptocompareProbeProvider";
import { createCryptoDataDownloadProbe } from "./providers/cryptoDataDownloadProbeProvider";

describe("live crypto OHLCV provider audit", () => {
  it("keeps the normalized provider result schema stable", async () => {
    const report = await auditLiveCryptoOhlcvProviders({
      providers: ["cryptodatadownload"],
      symbols: ["AERO-USDC"],
      timeframes: ["4h"],
      lookbackDays: 365,
      timeoutMs: 15_000,
      nowMs: Date.UTC(2026, 0, 1),
      probes: makeProbeRegistry({
        cryptodatadownload: createCryptoDataDownloadProbe(),
      }),
    });

    expect(report.results[0]).toMatchObject({
      providerId: "cryptodatadownload",
      requestUrlKind: "cryptodatadownload_manual_csv_mapping",
      failureCategory: "manual_mapping_required",
      marketDataProvenance: "uncertain",
    });
  });

  it("maps Coinbase Advanced direct candles into VegaRank Candle shape", () => {
    expect(
      mapCoinbaseAdvancedCandleToCandle(
        {
          start: "1700000000",
          low: "90",
          high: "120",
          open: "100",
          close: "110",
          volume: "123.45",
        },
        "4h",
      ),
    ).toEqual({
      openTime: 1_700_000_000_000,
      open: 100,
      high: 120,
      low: 90,
      close: 110,
      volume: 123.45,
      closeTime: 1_700_014_399_999,
    });
  });

  it("reports Coinbase Advanced 1w as unsupported rather than deriving it", async () => {
    const fetcher = vi.fn() as unknown as FetchLike;
    const report = await auditLiveCryptoOhlcvProviders({
      providers: ["coinbase_advanced_direct"],
      symbols: ["AERO-USDC"],
      timeframes: ["1w"],
      lookbackDays: 365,
      timeoutMs: 15_000,
      nowMs: Date.UTC(2026, 0, 1),
      fetcher,
      probes: makeProbeRegistry({
        coinbase_advanced_direct: createCoinbaseAdvancedDirectProbe(),
      }),
    });

    expect(fetcher).not.toHaveBeenCalled();
    expect(report.results[0]).toMatchObject({
      providerId: "coinbase_advanced_direct",
      timeframe: "1w",
      nativeIntervalSupported: false,
      errorCode: "unsupported",
      fetchedCandles: 0,
      failureCategory: "timeframe_unsupported",
    });
  });

  it("reports missing Coinbase Advanced credentials without making a request", async () => {
    const fetcher = vi.fn() as unknown as FetchLike;
    const report = await auditLiveCryptoOhlcvProviders({
      providers: ["coinbase_advanced_direct"],
      symbols: ["AERO-USDC"],
      timeframes: ["4h"],
      lookbackDays: 365,
      timeoutMs: 15_000,
      nowMs: Date.UTC(2026, 0, 1),
      fetcher,
      probes: makeProbeRegistry({
        coinbase_advanced_direct: createCoinbaseAdvancedDirectProbe(),
      }),
    });

    expect(fetcher).not.toHaveBeenCalled();
    expect(report.results[0]).toMatchObject({
      providerId: "coinbase_advanced_direct",
      authRequired: true,
      errorCode: "auth_required",
      failureCategory: "auth_problem",
      providerGranularity: "FOUR_HOUR",
      fetchedCandles: 0,
    });
    expect(report.summary.requiresAuthCandidates).toContain("coinbase_advanced_direct");
  });

  it("reports rejected Coinbase Advanced credentials with sanitized provider response", async () => {
    const secret = "secret-token";
    const report = await auditLiveCryptoOhlcvProviders({
      providers: ["coinbase_advanced_direct"],
      symbols: ["AERO-USDC"],
      timeframes: ["4h"],
      lookbackDays: 365,
      timeoutMs: 15_000,
      nowMs: Date.UTC(2026, 0, 1),
      fetcher: jsonFetcher({ error: `token ${secret} rejected` }, 401),
      probes: makeProbeRegistry({
        coinbase_advanced_direct: createCoinbaseAdvancedDirectProbe({
          bearerToken: secret,
        }),
      }),
    });

    expect(report.results[0]).toMatchObject({
      authRequired: true,
      errorCode: "auth_rejected",
      httpStatus: 401,
      failureCategory: "auth_problem",
      sanitizedProviderResponse: expect.stringContaining("[REDACTED]"),
    });
    expect(JSON.stringify(report)).not.toContain(secret);
  });

  it("reports successful authenticated Coinbase Advanced 4h candles with enough depth", async () => {
    const report = await auditLiveCryptoOhlcvProviders({
      providers: ["coinbase_advanced_direct"],
      symbols: ["AERO-USDC"],
      timeframes: ["4h"],
      lookbackDays: 365,
      timeoutMs: 15_000,
      nowMs: Date.UTC(2026, 0, 1),
      fetcher: jsonFetcher({ candles: coinbaseAdvancedCandles(220, "4h") }),
      probes: makeProbeRegistry({
        coinbase_advanced_direct: createCoinbaseAdvancedDirectProbe({
          bearerToken: "valid-token",
        }),
      }),
    });

    expect(report.results[0]).toMatchObject({
      providerId: "coinbase_advanced_direct",
      timeframe: "4h",
      authRequired: false,
      fetchedCandles: 220,
      enoughForVegaRank200: true,
      errorCode: undefined,
      providerGranularity: "FOUR_HOUR",
      requestUrlKind: "coinbase_advanced_product_candles",
    });
  });

  it("reports successful Coinbase Advanced responses with fewer than 200 candles", async () => {
    const report = await auditLiveCryptoOhlcvProviders({
      providers: ["coinbase_advanced_direct"],
      symbols: ["AERO-USDC"],
      timeframes: ["4h"],
      lookbackDays: 365,
      timeoutMs: 15_000,
      nowMs: Date.UTC(2026, 0, 1),
      fetcher: jsonFetcher({ candles: coinbaseAdvancedCandles(20, "4h") }),
      probes: makeProbeRegistry({
        coinbase_advanced_direct: createCoinbaseAdvancedDirectProbe({
          bearerToken: "valid-token",
        }),
      }),
    });

    expect(report.results[0]).toMatchObject({
      fetchedCandles: 20,
      enoughForVegaRank200: false,
      errorCode: "insufficient_history",
      failureCategory: "fewer_than_200",
    });
  });

  it("does not accept an aggregated provider as exchange-specific primary", async () => {
    const report = await auditLiveCryptoOhlcvProviders({
      providers: ["coingecko"],
      symbols: ["BTCUSDT"],
      timeframes: ["4h"],
      lookbackDays: 30,
      timeoutMs: 15_000,
      nowMs: Date.UTC(2026, 0, 1),
      fetcher: jsonFetcher([[1_700_000_000_000, 100, 120, 90, 110]]),
      probes: makeProbeRegistry({
        coingecko: createCoinGeckoProbe(),
      }),
    });

    expect(report.results[0]).toMatchObject({
      providerId: "coingecko",
      exchangeSpecific: false,
      aggregatedOnly: true,
    });
    expect(report.summary.exchangeSpecificCandidates).not.toContain("coingecko");
    expect(report.summary.aggregatedOnlyCandidates).toContain("coingecko");
    expect(report.summary.metadataOnlyCandidates).toContain("coingecko");
    expect(report.results[0]?.marketDataProvenance).toBe("aggregated");
  });

  it("uses the CoinGecko api/v3 path while keeping it aggregated-only", async () => {
    const seenUrls: string[] = [];
    const fetcher: FetchLike = async (input) => {
      seenUrls.push(String(input));
      return new Response(JSON.stringify([[1_700_000_000_000, 100, 120, 90, 110]]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const report = await auditLiveCryptoOhlcvProviders({
      providers: ["coingecko"],
      symbols: ["BTCUSDT"],
      timeframes: ["1d"],
      lookbackDays: 365,
      timeoutMs: 15_000,
      nowMs: Date.UTC(2026, 0, 1),
      fetcher,
      probes: makeProbeRegistry({
        coingecko: createCoinGeckoProbe(),
      }),
    });

    expect(seenUrls[0]).toContain("/api/v3/coins/bitcoin/ohlc");
    expect(report.results[0]).toMatchObject({
      exchangeSpecific: false,
      aggregatedOnly: true,
      requestUrlKind: "coingecko_coin_ohlc",
      marketDataProvenance: "aggregated",
    });
  });

  it("classifies CryptoCompare exchange-specific, aggregated, and uncertain provenance", async () => {
    const report = await auditLiveCryptoOhlcvProviders({
      providers: ["cryptocompare"],
      symbols: ["AERO-USDC", "BTCUSDT", "ETHUSD"],
      timeframes: ["1h"],
      lookbackDays: 365,
      timeoutMs: 15_000,
      nowMs: Date.UTC(2026, 0, 1),
      fetcher: jsonFetcher({ Response: "Success", Data: { Data: cryptoCompareCandles(220, "1h") } }),
      probes: makeProbeRegistry({
        cryptocompare: createCryptoCompareProbe(),
      }),
    });

    expect(report.results[0]).toMatchObject({
      providerSymbolUsed: "Coinbase:AERO/USDC",
      exchangeSpecific: true,
      aggregatedOnly: false,
      marketDataProvenance: "exchange_specific",
    });
    expect(report.results[1]).toMatchObject({
      providerSymbolUsed: "Binance:BTC/USDT",
      exchangeSpecific: true,
      aggregatedOnly: false,
      marketDataProvenance: "uncertain",
    });
    expect(report.results[2]).toMatchObject({
      providerSymbolUsed: "CCCAGG:ETH/USD",
      exchangeSpecific: false,
      aggregatedOnly: true,
      marketDataProvenance: "aggregated",
    });
  });

  it("reports auth-required providers without throwing", async () => {
    const report = await auditLiveCryptoOhlcvProviders({
      providers: ["coinapi"],
      symbols: ["BTCUSDT"],
      timeframes: ["1h"],
      lookbackDays: 365,
      timeoutMs: 15_000,
      nowMs: Date.UTC(2026, 0, 1),
      probes: makeProbeRegistry({
        coinapi: createAuthRequiredProbe("coinapi"),
      }),
    });

    expect(report.results[0]).toMatchObject({
      providerId: "coinapi",
      authRequired: true,
      errorCode: "paid_or_key_required",
    });
    expect(report.summary.authOrPaidBlockedProviders).toContain("coinapi");
    expect(report.summary.paidOrKeyRequiredCandidates).toContain("coinapi");
    expect(report.summary.providerChecklists.find((item) => item.providerId === "coinapi")).toMatchObject({
      candidateRole: "blocked until paid/key review",
      keyRequired: true,
    });
  });

  it("chooses Coinbase authenticated direct as the next phase when 4h and 1d are deep enough", async () => {
    const fetcher: FetchLike = async (input) => {
      const url = new URL(String(input));
      const timeframe = url.searchParams.get("granularity") === "ONE_DAY" ? "1d" : "4h";
      return new Response(
        JSON.stringify({ candles: coinbaseAdvancedCandles(220, timeframe) }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const report = await auditLiveCryptoOhlcvProviders({
      providers: ["coinbase_advanced_direct"],
      symbols: ["AERO-USDC"],
      timeframes: ["4h", "1d"],
      lookbackDays: 365,
      timeoutMs: 15_000,
      nowMs: Date.UTC(2026, 0, 1),
      fetcher,
      probes: makeProbeRegistry({
        coinbase_advanced_direct: createCoinbaseAdvancedDirectProbe({
          bearerToken: "valid-token",
        }),
      }),
    });

    expect(report.summary.productionReadyPrimaryCandidates).toContain("coinbase_advanced_direct");
    expect(report.summary.recommendedNextPhase).toBe(
      "Phase 32N - Coinbase Advanced Direct Backfill Adapter",
    );
  });

  it("chooses third-party evaluation when Coinbase auth works but depth is insufficient", async () => {
    const report = await auditLiveCryptoOhlcvProviders({
      providers: ["coinbase_advanced_direct"],
      symbols: ["AERO-USDC"],
      timeframes: ["4h"],
      lookbackDays: 365,
      timeoutMs: 15_000,
      nowMs: Date.UTC(2026, 0, 1),
      fetcher: jsonFetcher({ candles: coinbaseAdvancedCandles(20, "4h") }),
      probes: makeProbeRegistry({
        coinbase_advanced_direct: createCoinbaseAdvancedDirectProbe({
          bearerToken: "valid-token",
        }),
      }),
    });

    expect(report.summary.productionReadyPrimaryCandidates).toEqual([]);
    expect(report.summary.recommendedNextPhase).toContain("Third-party primary evaluation");
  });

  it("chooses no production-ready provider when nothing live is usable", async () => {
    const report = await auditLiveCryptoOhlcvProviders({
      providers: ["coinapi"],
      symbols: ["BTCUSDT"],
      timeframes: ["1h"],
      lookbackDays: 365,
      timeoutMs: 15_000,
      nowMs: Date.UTC(2026, 0, 1),
      probes: makeProbeRegistry({
        coinapi: createAuthRequiredProbe("coinapi"),
      }),
    });

    expect(report.summary.productionReadyPrimaryCandidates).toEqual([]);
    expect(report.summary.recommendedNextPhase).toContain("No production-ready provider");
  });

  it("reports missing symbol mapping separately from provider outage", async () => {
    const fetcher = vi.fn() as unknown as FetchLike;
    const report = await auditLiveCryptoOhlcvProviders({
      providers: ["coingecko"],
      symbols: ["UNKNOWN-USDC"],
      timeframes: ["1d"],
      lookbackDays: 365,
      timeoutMs: 15_000,
      nowMs: Date.UTC(2026, 0, 1),
      fetcher,
      probes: makeProbeRegistry({
        coingecko: createCoinGeckoProbe(),
      }),
    });

    expect(fetcher).not.toHaveBeenCalled();
    expect(report.results[0]).toMatchObject({
      errorCode: "symbol_mapping_missing",
      requestCount: 0,
    });
    expect(report.summary.providerDecisionNotes).toContain(
      "Some no-result cases are symbol mapping gaps, not proven provider outages.",
    );
  });

  it("can join live audit output with the static provider capability model", async () => {
    const report = await auditLiveCryptoOhlcvProviders({
      providers: ["cryptodatadownload"],
      symbols: ["BTCUSDT"],
      timeframes: ["1h"],
      lookbackDays: 365,
      timeoutMs: 15_000,
      nowMs: Date.UTC(2026, 0, 1),
      probes: makeProbeRegistry({
        cryptodatadownload: createCryptoDataDownloadProbe(),
      }),
    });

    for (const result of report.results) {
      expect(providerCapabilityProfilesById[result.providerId]).toBeDefined();
      expect(result.providerType).toBe(providerCapabilityProfilesById[result.providerId].providerType);
    }
  });

  it("emits parseable CLI JSON output", async () => {
    const messages: unknown[] = [];

    await runLiveAuditCli(
      [
        "--providers=cryptodatadownload",
        "--symbols=BTCUSDT",
        "--timeframes=1h",
        "--json",
      ],
      { log: (message) => messages.push(message) },
    );

    const parsed = JSON.parse(String(messages[0]));
    expect(parsed.results[0]).toMatchObject({
      providerId: "cryptodatadownload",
      errorCode: "needs_manual_url_mapping",
    });
  });

  it("emits CLI markdown with a provider matrix style summary", async () => {
    const messages: unknown[] = [];

    await runLiveAuditCli(
      [
        "--providers=cryptodatadownload",
        "--symbols=BTCUSDT",
        "--timeframes=1h",
        "--markdown",
      ],
      { log: (message) => messages.push(message) },
    );

    const markdown = String(messages[0]);
    expect(markdown).toContain("# Live Crypto OHLCV Provider Audit");
    expect(markdown).toContain("## Provider Matrix");
    expect(markdown).toContain("| providerId | symbol | providerSymbol | timeframe |");
  });
});

function makeProbeRegistry(
  overrides: Partial<Record<LiveAuditProviderId, LiveProviderProbe>>,
): Record<LiveAuditProviderId, LiveProviderProbe> {
  const fallback = createCryptoDataDownloadProbe();

  return {
    coinbase_advanced_direct: fallback,
    coinbase_exchange_public: fallback,
    cryptocompare: fallback,
    cryptodatadownload: fallback,
    coingecko: fallback,
    coinapi: fallback,
    kaiko: fallback,
    polygon_crypto: fallback,
    tiingo_crypto: fallback,
    ...overrides,
  };
}

function jsonFetcher(body: unknown, status = 200): FetchLike {
  return async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
}

function coinbaseAdvancedCandles(count: number, timeframe: "1h" | "4h" | "1d") {
  const durationSeconds = timeframe === "1h" ? 3_600 : timeframe === "4h" ? 14_400 : 86_400;
  const start = 1_700_000_000;

  return Array.from({ length: count }, (_, index) => ({
    start: String(start + index * durationSeconds),
    low: "90",
    high: "120",
    open: "100",
    close: "110",
    volume: "123.45",
  }));
}

function cryptoCompareCandles(count: number, timeframe: "1h" | "4h" | "1d") {
  const durationSeconds = timeframe === "1h" ? 3_600 : timeframe === "4h" ? 14_400 : 86_400;
  const start = 1_700_000_000;

  return Array.from({ length: count }, (_, index) => ({
    time: start + index * durationSeconds,
    low: 90,
    high: 120,
    open: 100,
    close: 110,
    volumefrom: 123.45,
  }));
}
