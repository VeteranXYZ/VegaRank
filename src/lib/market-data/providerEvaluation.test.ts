import { describe, expect, it } from "vitest";
import {
  providerCapabilityProfiles,
  providerCapabilityProfilesById,
  type ProviderCapabilityProfile,
} from "./providerCapabilities";
import { evaluateMarketDataProviders } from "./providerEvaluation";

const requiredProviderIds = [
  "binance_native",
  "coinbase_ccxt",
  "coinlore",
  "tokendatabase",
  "twelvedata",
  "polygon_crypto",
  "tiingo_crypto",
  "coinapi",
  "kaiko",
  "tardis",
  "backdb",
] as const;

describe("market data provider evaluation", () => {
  it("defines capability profiles for the required provider set", () => {
    expect(providerCapabilityProfiles.map((profile) => profile.id)).toEqual(
      expect.arrayContaining([...requiredProviderIds]),
    );

    for (const providerId of requiredProviderIds) {
      const profile = providerCapabilityProfilesById[providerId];
      expect(profile).toBeDefined();
      expect(Object.keys(profile.intervals).sort()).toEqual(["1d", "1h", "1w", "4h"]);
    }
  });

  it("warns if a production primary provider has unknown licensing", () => {
    const unsafePrimary: ProviderCapabilityProfile = {
      ...providerCapabilityProfilesById.binance_native,
      id: "binance_native",
      licensingRisk: "needs_verification",
      recommendedRoles: ["production_primary"],
    };

    const result = evaluateMarketDataProviders("crypto_exchange_specific_ohlcv", [
      unsafePrimary,
    ]);

    expect(result.warnings).toContain(
      "Binance native klines is marked production_primary but has unverified licensing.",
    );
    expect(
      providerCapabilityProfiles.filter(
        (profile) =>
          profile.recommendedRoles.includes("production_primary") &&
          profile.licensingRisk === "needs_verification",
      ),
    ).toEqual([]);
  });

  it("does not select aggregated-only providers for exchange-specific OHLCV", () => {
    const result = evaluateMarketDataProviders("crypto_exchange_specific_ohlcv");
    const selectedIds = result.bestCandidates.map((candidate) => candidate.providerId);

    expect(selectedIds).not.toContain("coinlore");
    expect(selectedIds).not.toContain("defillama");
    expect(
      result.unsuitableProviders.some(
        (provider) =>
          provider.providerId === "coinlore" &&
          provider.reasons.includes(
            "Aggregated-only data must not be used as an exchange-specific primary source.",
          ),
      ),
    ).toBe(true);
  });

  it("selects CCXT as the Coinbase supplemental candidate", () => {
    const result = evaluateMarketDataProviders("crypto_coinbase_usdc_supplemental");
    const selectedIds = result.bestCandidates.map((candidate) => candidate.providerId);
    const coinbaseCcxt = result.bestCandidates.find(
      (candidate) => candidate.providerId === "coinbase_ccxt",
    );

    expect(coinbaseCcxt).toMatchObject({
      recommendedRole: "production_fallback",
    });
    expect(selectedIds.filter((providerId) => providerId.startsWith("coinbase_"))).toEqual([
      "coinbase_ccxt",
    ]);
  });

  it("keeps metadata providers out of OHLCV provider selection", () => {
    const exchangeSpecific = evaluateMarketDataProviders("crypto_exchange_specific_ohlcv");
    const metadata = evaluateMarketDataProviders("crypto_metadata");

    expect(exchangeSpecific.bestCandidates.map((candidate) => candidate.providerId)).not.toContain(
      "defillama",
    );
    expect(metadata.bestCandidates.find((candidate) => candidate.providerId === "defillama"))
      .toMatchObject({
        recommendedRole: "metadata_enrichment",
      });
  });

  it("keeps only the selected Coinbase provider in the static matrix", () => {
    expect(providerCapabilityProfilesById.coinbase_ccxt).toMatchObject({
      fitForVegaRank: "supplemental_only",
      recommendedRoles: expect.arrayContaining(["production_fallback"]),
    });

    const selectedIds = providerCapabilityProfiles.map((profile) => profile.id);
    expect(selectedIds.filter((providerId) => providerId.startsWith("coinbase_"))).toEqual([
      "coinbase_ccxt",
    ]);
    expect(
      providerCapabilityProfiles.filter(
        (profile) =>
          profile.providerType === "exchange_native_api" &&
          profile.coinbaseUsdcLikely === "yes" &&
          profile.id !== "binance_native",
      ),
    ).toEqual([]);
  });

  it("does not falsely satisfy future equities with crypto-only providers", () => {
    const result = evaluateMarketDataProviders("future_equities_ohlcv");
    const selectedIds = result.bestCandidates.map((candidate) => candidate.providerId);

    expect(selectedIds).not.toContain("binance_native");
    expect(selectedIds).not.toContain("coinbase_ccxt");
    expect(selectedIds).toEqual(
      expect.arrayContaining(["twelvedata", "polygon_crypto", "tiingo_crypto"]),
    );
  });

  it("returns unknowns to verify for uncertain free-tier and interval support", () => {
    const result = evaluateMarketDataProviders("crypto_coinbase_usdc_supplemental");
    const tokenDatabaseUnknowns = result.unknownsToVerify.find(
      (unknown) => unknown.providerId === "tokendatabase",
    );

    expect(tokenDatabaseUnknowns?.fields).toEqual(
      expect.arrayContaining(["freeTier", "intervals.1h", "intervals.4h"]),
    );
  });
});
