import {
  providerCapabilityProfiles,
  type CapabilityStatus,
  type CandleInterval,
  type DataSourceRole,
  type ProviderCapabilityProfile,
  type ProviderEvaluationCandidate,
  type ProviderEvaluationResult,
  type ProviderEvaluationUseCase,
} from "./providerCapabilities";

const requiredIntervals: CandleInterval[] = ["1h", "4h", "1d", "1w"];

export function evaluateMarketDataProviders(
  useCase: ProviderEvaluationUseCase,
  profiles: ProviderCapabilityProfile[] = providerCapabilityProfiles,
): ProviderEvaluationResult {
  const bestCandidates: ProviderEvaluationCandidate[] = [];
  const unsuitableProviders: ProviderEvaluationResult["unsuitableProviders"] = [];
  const unknownsToVerify: ProviderEvaluationResult["unknownsToVerify"] = [];
  const warnings: string[] = [];

  for (const profile of profiles) {
    const unknownFields = collectUnknownFields(profile, useCase);
    if (unknownFields.length > 0) {
      unknownsToVerify.push({
        providerId: profile.id,
        provider: profile.provider,
        fields: unknownFields,
      });
    }

    const unsuitability = getUnsuitabilityReasons(profile, useCase);
    if (unsuitability.length > 0) {
      unsuitableProviders.push({
        providerId: profile.id,
        provider: profile.provider,
        reasons: unsuitability,
      });
      continue;
    }

    const candidate = scoreProvider(profile, useCase);
    if (candidate.score > 0) {
      bestCandidates.push(candidate);
    }
  }

  for (const profile of profiles) {
    if (
      profile.recommendedRoles.includes("production_primary") &&
      profile.licensingRisk === "needs_verification"
    ) {
      warnings.push(
        `${profile.provider} is marked production_primary but has unverified licensing.`,
      );
    }
  }

  bestCandidates.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return left.provider.localeCompare(right.provider);
  });

  return {
    useCase,
    bestCandidates,
    unsuitableProviders,
    unknownsToVerify,
    warnings,
    recommendedNextAudit: getRecommendedNextAudit(useCase, bestCandidates, unknownsToVerify),
  };
}

function scoreProvider(
  profile: ProviderCapabilityProfile,
  useCase: ProviderEvaluationUseCase,
): ProviderEvaluationCandidate {
  let score = 0;
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (profile.licensingRisk === "needs_verification") {
    warnings.push("Licensing or ToS needs verification before production use.");
  }

  if (useCase === "crypto_metadata") {
    if (profile.providerType === "metadata") {
      score += 40;
      reasons.push("Provider is metadata-oriented.");
    }
    if (profile.productMetadataQuality === "yes") {
      score += 30;
      reasons.push("Product metadata quality is marked strong.");
    } else if (profile.productMetadataQuality === "partial") {
      score += 15;
      reasons.push("Product metadata quality is partially useful.");
    }
    return makeCandidate(profile, score, "metadata_enrichment", reasons, warnings);
  }

  if (useCase === "future_equities_ohlcv") {
    if (profile.equitiesPossible === "yes") {
      score += 50;
      reasons.push("Provider can plausibly support future equities data.");
    } else if (profile.equitiesPossible === "partial") {
      score += 20;
      reasons.push("Future equities support is partial.");
    }
    score += scoreIntervals(profile, reasons, warnings);
    return makeCandidate(profile, score, "research_audit_candidate", reasons, warnings);
  }

  if (useCase === "crypto_broad_aggregated_ohlcv") {
    if (profile.aggregatedOnly === "yes" || profile.aggregatedOnly === "partial") {
      score += 30;
      reasons.push("Aggregated crypto OHLCV is acceptable for this use case.");
    }
    if (profile.providerType === "mixed_market_data") {
      score += 20;
      reasons.push("Provider has mixed market data coverage.");
    }
    score += scoreIntervals(profile, reasons, warnings);
    return makeCandidate(profile, score, "research_audit_candidate", reasons, warnings);
  }

  if (profile.exchangeSpecific === "yes") {
    score += 40;
    reasons.push("Supports exchange-specific OHLCV semantics.");
  } else if (profile.exchangeSpecific === "partial") {
    score += 15;
    reasons.push("Exchange-specific support is partial and must be labeled.");
  } else if (profile.exchangeSpecific === "needs_verification") {
    warnings.push("Exchange-specific support needs verification before use.");
  }

  if (useCase === "crypto_coinbase_usdc_supplemental") {
    if (profile.coinbaseUsdcLikely === "yes") {
      score += 35;
      reasons.push("Likely supports Coinbase USDC pair coverage.");
    } else if (profile.coinbaseUsdcLikely === "partial") {
      score += 12;
      reasons.push("Coinbase USDC support is partial.");
    } else if (profile.coinbaseUsdcLikely === "needs_verification") {
      warnings.push("Coinbase USDC pair coverage needs verification.");
    }
    if (profile.usdcPairSupport === "yes") {
      score += 15;
      reasons.push("USDC pair support is explicitly represented.");
    }
  }

  if (useCase === "crypto_exchange_specific_ohlcv" && profile.binanceLikely === "yes") {
    score += 10;
    reasons.push("Likely supports Binance spot coverage.");
  }

  score += scoreIntervals(profile, reasons, warnings);

  if (profile.fitForVegaRank === "strong_candidate") {
    score += 10;
    reasons.push("Profile is marked as a strong VegaRank candidate.");
  } else if (profile.fitForVegaRank === "candidate") {
    score += 5;
    reasons.push("Profile is marked as a VegaRank candidate.");
  }

  return makeCandidate(profile, score, "research_audit_candidate", reasons, warnings);
}

function scoreIntervals(
  profile: ProviderCapabilityProfile,
  reasons: string[],
  warnings: string[],
): number {
  let score = 0;

  for (const interval of requiredIntervals) {
    const capability = profile.intervals[interval];
    if (capability.native === "yes") {
      score += interval === "4h" || interval === "1w" ? 12 : 10;
      reasons.push(`Native ${interval} candles are likely supported.`);
    } else if (capability.native === "partial") {
      score += 4;
      warnings.push(`${interval} candle support is partial.`);
    } else if (capability.native === "needs_verification") {
      warnings.push(`${interval} candle support needs verification.`);
    } else if (capability.native === "no" && capability.derivedAllowed) {
      warnings.push(`${interval} candles would require explicit derived-candle provenance.`);
    }
  }

  return score;
}

function makeCandidate(
  profile: ProviderCapabilityProfile,
  score: number,
  fallbackRole: DataSourceRole,
  reasons: string[],
  warnings: string[],
): ProviderEvaluationCandidate {
  return {
    providerId: profile.id,
    provider: profile.provider,
    score,
    recommendedRole: chooseRole(profile, fallbackRole),
    reasons,
    warnings,
  };
}

function chooseRole(profile: ProviderCapabilityProfile, fallbackRole: DataSourceRole): DataSourceRole {
  if (profile.recommendedRoles.includes("production_primary")) {
    return "production_primary";
  }
  if (profile.recommendedRoles.includes("production_fallback")) {
    return "production_fallback";
  }
  if (profile.recommendedRoles.includes(fallbackRole)) {
    return fallbackRole;
  }
  return profile.recommendedRoles[0] ?? fallbackRole;
}

function getUnsuitabilityReasons(
  profile: ProviderCapabilityProfile,
  useCase: ProviderEvaluationUseCase,
): string[] {
  const reasons: string[] = [];

  if (profile.recommendedRoles.includes("unsuitable") || profile.fitForVegaRank === "unsuitable") {
    reasons.push("Profile is explicitly marked unsuitable.");
  }

  if (
    (useCase === "crypto_exchange_specific_ohlcv" ||
      useCase === "crypto_coinbase_usdc_supplemental") &&
    profile.aggregatedOnly === "yes"
  ) {
    reasons.push("Aggregated-only data must not be used as an exchange-specific primary source.");
  }

  if (
    (useCase === "crypto_exchange_specific_ohlcv" ||
      useCase === "crypto_coinbase_usdc_supplemental") &&
    (profile.providerType === "metadata" || profile.exchangeSpecific === "no")
  ) {
    reasons.push("Metadata-oriented provider is not an OHLCV source for this use case.");
  }

  if (useCase === "crypto_coinbase_usdc_supplemental" && profile.coinbaseUsdcLikely === "no") {
    reasons.push("Provider is not likely to cover Coinbase USDC pairs.");
  }

  if (useCase === "crypto_metadata" && profile.productMetadataQuality === "no") {
    reasons.push("Provider does not offer useful product metadata for this use case.");
  }

  if (useCase === "future_equities_ohlcv" && profile.equitiesPossible !== "yes") {
    reasons.push("Provider does not currently satisfy future equities OHLCV.");
  }

  return reasons;
}

function collectUnknownFields(
  profile: ProviderCapabilityProfile,
  useCase: ProviderEvaluationUseCase,
): string[] {
  const fields: string[] = [];
  const trackedStatuses: [string, CapabilityStatus][] = [
    ["freeTier", profile.freeTier],
    ["exchangeSpecific", profile.exchangeSpecific],
    ["coinbaseUsdcLikely", profile.coinbaseUsdcLikely],
    ["binanceLikely", profile.binanceLikely],
    ["usdcPairSupport", profile.usdcPairSupport],
    ["apiKeyRequired", profile.apiKeyRequired],
  ];

  if (useCase === "future_equities_ohlcv") {
    trackedStatuses.push(["equitiesPossible", profile.equitiesPossible]);
  }

  for (const [field, status] of trackedStatuses) {
    if (status === "needs_verification") {
      fields.push(field);
    }
  }

  if (profile.licensingRisk === "needs_verification") {
    fields.push("licensingRisk");
  }

  for (const interval of requiredIntervals) {
    if (profile.intervals[interval].native === "needs_verification") {
      fields.push(`intervals.${interval}`);
    }
  }

  return fields;
}

function getRecommendedNextAudit(
  useCase: ProviderEvaluationUseCase,
  candidates: ProviderEvaluationCandidate[],
  unknowns: ProviderEvaluationResult["unknownsToVerify"],
): string {
  if (useCase === "crypto_coinbase_usdc_supplemental") {
    return "Coinbase supplemental production is CCXT-only; use production batch diagnostics before considering a new provider audit.";
  }

  if (useCase === "crypto_broad_aggregated_ohlcv") {
    return "No active aggregated OHLCV provider audit route; keep aggregated data out of exchange-specific rankings.";
  }

  if (candidates.length > 0 || unknowns.length > 0) {
    return "Static provider review only; add a new scoped audit before introducing any new production data route.";
  }

  return "Static provider review only; add a new scoped audit before introducing any new production data route.";
}
