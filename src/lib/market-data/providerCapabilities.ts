export type MarketDataProviderId =
  | "binance_native"
  | "coinbase_ccxt"
  | "coinbase_advanced_direct"
  | "coinbase_exchange_public"
  | "coinbase_exchange_direct"
  | "coingecko"
  | "cryptocompare"
  | "cryptodatadownload"
  | "coinlore"
  | "tokendatabase"
  | "twelvedata"
  | "polygon_crypto"
  | "tiingo_crypto"
  | "coinapi"
  | "kaiko"
  | "tardis"
  | "backdb"
  | "coinmarketcap"
  | "defillama"
  | "nasdaq_data_link";

export type ProviderType =
  | "exchange_native_api"
  | "exchange_abstraction"
  | "aggregated_coin_ohlcv"
  | "metadata"
  | "mixed_market_data"
  | "derivatives_or_tick_vendor"
  | "institutional_vendor"
  | "csv_download"
  | "unknown_or_unsuitable";

export type CapabilityStatus =
  | "yes"
  | "no"
  | "partial"
  | "needs_verification"
  | "not_applicable";

export type LicensingRisk = "low" | "medium" | "high" | "needs_verification";

export type ImplementationComplexity = "low" | "medium" | "high";

export type FitForVegaRank =
  | "strong_candidate"
  | "candidate"
  | "supplemental_only"
  | "metadata_only"
  | "audit_only"
  | "unsuitable";

export type DataSourceRole =
  | "production_primary"
  | "production_fallback"
  | "research_audit_candidate"
  | "metadata_enrichment"
  | "manual_import_only"
  | "unsuitable";

export type CandleInterval = "1h" | "4h" | "1d" | "1w";

export type CandleIntervalCapability = {
  interval: CandleInterval;
  native: CapabilityStatus;
  derivedAllowed: boolean;
  notes: string;
};

export type ProviderCapabilityProfile = {
  id: MarketDataProviderId;
  provider: string;
  providerType: ProviderType;
  freeTier: CapabilityStatus;
  exchangeSpecific: CapabilityStatus;
  aggregatedOnly: CapabilityStatus;
  intervals: Record<CandleInterval, CandleIntervalCapability>;
  intervalsSupported: string;
  historicalDepth: string;
  coinbaseUsdcLikely: CapabilityStatus;
  binanceLikely: CapabilityStatus;
  usdcPairSupport: CapabilityStatus;
  equitiesPossible: CapabilityStatus;
  apiKeyRequired: CapabilityStatus;
  rateLimits: string;
  paginationModel: string;
  licensingRisk: LicensingRisk;
  reliability: CapabilityStatus;
  gapBehavior: string;
  productMetadataQuality: CapabilityStatus;
  implementationComplexity: ImplementationComplexity;
  fitForVegaRank: FitForVegaRank;
  recommendedRoles: DataSourceRole[];
  notes: string;
};

export type ProviderEvaluationUseCase =
  | "crypto_exchange_specific_ohlcv"
  | "crypto_broad_aggregated_ohlcv"
  | "crypto_metadata"
  | "crypto_coinbase_usdc_supplemental"
  | "future_equities_ohlcv";

export type ProviderEvaluationCandidate = {
  providerId: MarketDataProviderId;
  provider: string;
  score: number;
  recommendedRole: DataSourceRole;
  reasons: string[];
  warnings: string[];
};

export type ProviderEvaluationResult = {
  useCase: ProviderEvaluationUseCase;
  bestCandidates: ProviderEvaluationCandidate[];
  unsuitableProviders: {
    providerId: MarketDataProviderId;
    provider: string;
    reasons: string[];
  }[];
  unknownsToVerify: {
    providerId: MarketDataProviderId;
    provider: string;
    fields: string[];
  }[];
  warnings: string[];
  recommendedNextAudit: string;
};

function intervalCapabilities(
  native: Partial<Record<CandleInterval, CapabilityStatus>>,
  notes: Partial<Record<CandleInterval, string>> = {},
): Record<CandleInterval, CandleIntervalCapability> {
  return {
    "1h": {
      interval: "1h",
      native: native["1h"] ?? "needs_verification",
      derivedAllowed: false,
      notes: notes["1h"] ?? "Needs provider-specific audit.",
    },
    "4h": {
      interval: "4h",
      native: native["4h"] ?? "needs_verification",
      derivedAllowed: true,
      notes: notes["4h"] ?? "Native support preferred; derivation requires complete lower interval coverage.",
    },
    "1d": {
      interval: "1d",
      native: native["1d"] ?? "needs_verification",
      derivedAllowed: false,
      notes: notes["1d"] ?? "Needs provider-specific audit.",
    },
    "1w": {
      interval: "1w",
      native: native["1w"] ?? "needs_verification",
      derivedAllowed: true,
      notes: notes["1w"] ?? "Native support preferred; daily aggregation must be labeled as derived.",
    },
  };
}

export const providerCapabilityProfiles: ProviderCapabilityProfile[] = [
  {
    id: "binance_native",
    provider: "Binance native klines",
    providerType: "exchange_native_api",
    freeTier: "yes",
    exchangeSpecific: "yes",
    aggregatedOnly: "no",
    intervals: intervalCapabilities(
      { "1h": "yes", "4h": "yes", "1d": "yes", "1w": "yes" },
      { "1w": "Native weekly klines exist, but VegaRank should keep week-boundary policy explicit." },
    ),
    intervalsSupported: "Native exchange klines include 1h, 4h, 1d, and 1w.",
    historicalDepth: "Good for listed Binance spot pairs; exact depth varies by listing age.",
    coinbaseUsdcLikely: "no",
    binanceLikely: "yes",
    usdcPairSupport: "partial",
    equitiesPossible: "no",
    apiKeyRequired: "no",
    rateLimits: "Public REST weight limits apply.",
    paginationModel: "Limit and time-window pagination.",
    licensingRisk: "medium",
    reliability: "yes",
    gapBehavior: "Exchange-specific gaps should be treated as source truth and reported.",
    productMetadataQuality: "partial",
    implementationComplexity: "low",
    fitForVegaRank: "strong_candidate",
    recommendedRoles: ["production_primary", "research_audit_candidate"],
    notes: "Current Binance source should remain unchanged while alternatives are evaluated.",
  },
  {
    id: "coinbase_ccxt",
    provider: "Coinbase through CCXT",
    providerType: "exchange_abstraction",
    freeTier: "yes",
    exchangeSpecific: "yes",
    aggregatedOnly: "no",
    intervals: intervalCapabilities(
      { "1h": "yes", "4h": "no", "1d": "yes", "1w": "no" },
      {
        "4h": "Selected supplemental path derives 4h from complete CCXT native 1h buckets.",
        "1w": "Selected supplemental path derives 1w from complete CCXT native 1d UTC weeks.",
      },
    ),
    intervalsSupported: "Selected Coinbase supplemental production path uses CCXT native 1h and 1d; 4h and 1w are derived by VegaRank with diagnostics.",
    historicalDepth: "Product-specific; the configured supplemental universe is validated by the production supplemental batch report.",
    coinbaseUsdcLikely: "yes",
    binanceLikely: "no",
    usdcPairSupport: "yes",
    equitiesPossible: "no",
    apiKeyRequired: "no",
    rateLimits: "Exchange public API limits apply through CCXT.",
    paginationModel: "CCXT since/limit fetchOHLCV model.",
    licensingRisk: "medium",
    reliability: "partial",
    gapBehavior: "VegaRank records source gaps, missing source candles, dropped incomplete 4h buckets, and dropped incomplete UTC weeks.",
    productMetadataQuality: "yes",
    implementationComplexity: "medium",
    fitForVegaRank: "supplemental_only",
    recommendedRoles: ["research_audit_candidate", "production_fallback"],
    notes: "Selected as the only Coinbase supplemental production ingestion source; Binance remains production primary.",
  },
  {
    id: "coinbase_advanced_direct",
    provider: "Coinbase Advanced Trade direct candles",
    providerType: "exchange_native_api",
    freeTier: "yes",
    exchangeSpecific: "yes",
    aggregatedOnly: "no",
    intervals: intervalCapabilities(
      { "1h": "yes", "4h": "needs_verification", "1d": "yes", "1w": "no" },
      {
        "4h": "Coinbase granularity support needs direct endpoint audit for VegaRank symbols.",
        "1w": "Treat weekly as derived unless native weekly granularity is verified.",
      },
    ),
    intervalsSupported: "Documented granularities should be mapped directly before implementation.",
    historicalDepth: "Needs verification for candle count limits and historical windows.",
    coinbaseUsdcLikely: "yes",
    binanceLikely: "no",
    usdcPairSupport: "yes",
    equitiesPossible: "no",
    apiKeyRequired: "partial",
    rateLimits: "Coinbase public and authenticated limits need audit.",
    paginationModel: "Start/end time windows with granularity.",
    licensingRisk: "medium",
    reliability: "needs_verification",
    gapBehavior: "Unknown until product sample audit is run.",
    productMetadataQuality: "yes",
    implementationComplexity: "medium",
    fitForVegaRank: "audit_only",
    recommendedRoles: ["research_audit_candidate"],
    notes: "Deprecated/not selected for Coinbase production primary or supplemental ingestion; retained only for read-only feasibility audits.",
  },
  {
    id: "coinbase_exchange_public",
    provider: "Coinbase Exchange public candles",
    providerType: "exchange_native_api",
    freeTier: "yes",
    exchangeSpecific: "yes",
    aggregatedOnly: "no",
    intervals: intervalCapabilities(
      { "1h": "yes", "4h": "no", "1d": "yes", "1w": "no" },
      {
        "4h": "Coinbase Exchange public candles do not expose native 4h granularity; nearest documented public granularity is 6h.",
        "1w": "Coinbase Exchange public candles do not expose native weekly granularity.",
      },
    ),
    intervalsSupported: "Public product candles support fixed granularities such as 1h, 6h, and 1d.",
    historicalDepth: "Needs live verification per product and request window; public endpoint is typically limited to small candle windows.",
    coinbaseUsdcLikely: "yes",
    binanceLikely: "no",
    usdcPairSupport: "partial",
    equitiesPossible: "no",
    apiKeyRequired: "no",
    rateLimits: "Public Exchange API limits apply.",
    paginationModel: "Start/end time windows with granularity and limited candle count.",
    licensingRisk: "medium",
    reliability: "needs_verification",
    gapBehavior: "Unknown until sampled against Coinbase supplemental symbols.",
    productMetadataQuality: "partial",
    implementationComplexity: "low",
    fitForVegaRank: "audit_only",
    recommendedRoles: ["research_audit_candidate"],
    notes: "Read-only feasibility comparison path only; deprecated/not selected for Coinbase production ingestion.",
  },
  {
    id: "coinbase_exchange_direct",
    provider: "Coinbase Exchange direct candles",
    providerType: "exchange_native_api",
    freeTier: "yes",
    exchangeSpecific: "yes",
    aggregatedOnly: "no",
    intervals: intervalCapabilities(
      { "1h": "yes", "4h": "needs_verification", "1d": "yes", "1w": "no" },
      { "4h": "Granularity support and row limits need endpoint audit." },
    ),
    intervalsSupported: "Exchange candles have finite granularities; exact 4h support needs verification.",
    historicalDepth: "Needs verification for 200-candle minimum across Coinbase-only USDC products.",
    coinbaseUsdcLikely: "yes",
    binanceLikely: "no",
    usdcPairSupport: "yes",
    equitiesPossible: "no",
    apiKeyRequired: "no",
    rateLimits: "Public Exchange API limits apply.",
    paginationModel: "Start/end time windows with granularity.",
    licensingRisk: "medium",
    reliability: "needs_verification",
    gapBehavior: "Unknown until sampled against rollout skip set.",
    productMetadataQuality: "yes",
    implementationComplexity: "medium",
    fitForVegaRank: "audit_only",
    recommendedRoles: ["research_audit_candidate"],
    notes: "Deprecated/not selected for Coinbase production ingestion; retained only as a read-only audit comparison.",
  },
  {
    id: "coingecko",
    provider: "CoinGecko",
    providerType: "aggregated_coin_ohlcv",
    freeTier: "partial",
    exchangeSpecific: "partial",
    aggregatedOnly: "partial",
    intervals: intervalCapabilities({ "1h": "partial", "4h": "no", "1d": "yes", "1w": "needs_verification" }),
    intervalsSupported: "Coin-level market chart and OHLC endpoints; exchange-specific candles need verification.",
    historicalDepth: "Depends on endpoint, plan, and interval.",
    coinbaseUsdcLikely: "needs_verification",
    binanceLikely: "needs_verification",
    usdcPairSupport: "needs_verification",
    equitiesPossible: "no",
    apiKeyRequired: "partial",
    rateLimits: "Free tier and demo limits are constrained.",
    paginationModel: "Coin id and date-range oriented endpoints.",
    licensingRisk: "medium",
    reliability: "partial",
    gapBehavior: "Aggregated series may not map to a venue listing.",
    productMetadataQuality: "yes",
    implementationComplexity: "medium",
    fitForVegaRank: "metadata_only",
    recommendedRoles: ["metadata_enrichment"],
    notes: "Metadata only. CoinGecko OHLC is aggregated coin-level data and is deprecated/not selected for production primary or supplemental ingestion.",
  },
  {
    id: "cryptocompare",
    provider: "CryptoCompare",
    providerType: "mixed_market_data",
    freeTier: "partial",
    exchangeSpecific: "partial",
    aggregatedOnly: "partial",
    intervals: intervalCapabilities({ "1h": "yes", "4h": "needs_verification", "1d": "yes", "1w": "needs_verification" }),
    intervalsSupported: "Historical minute/hour/day endpoints are likely; native 4h and 1w need verification.",
    historicalDepth: "Free and paid depth limits need verification.",
    coinbaseUsdcLikely: "needs_verification",
    binanceLikely: "yes",
    usdcPairSupport: "needs_verification",
    equitiesPossible: "no",
    apiKeyRequired: "partial",
    rateLimits: "Plan-based rate limits.",
    paginationModel: "Limit, aggregate, and timestamp oriented endpoints.",
    licensingRisk: "needs_verification",
    reliability: "partial",
    gapBehavior: "Needs audit for exchange-specific CCCAGG versus venue selection.",
    productMetadataQuality: "partial",
    implementationComplexity: "medium",
    fitForVegaRank: "audit_only",
    recommendedRoles: ["research_audit_candidate"],
    notes: "Deprecated/not selected for production primary or Coinbase supplemental ingestion; venue semantics, plan limits, and licensing remain audit-only concerns.",
  },
  {
    id: "cryptodatadownload",
    provider: "CryptoDataDownload",
    providerType: "csv_download",
    freeTier: "yes",
    exchangeSpecific: "yes",
    aggregatedOnly: "no",
    intervals: intervalCapabilities({ "1h": "yes", "4h": "needs_verification", "1d": "yes", "1w": "needs_verification" }),
    intervalsSupported: "CSV datasets commonly include hourly and daily exchange data; exact current coverage needs audit.",
    historicalDepth: "Often deep historical CSV by exchange, but freshness and pair coverage need verification.",
    coinbaseUsdcLikely: "needs_verification",
    binanceLikely: "yes",
    usdcPairSupport: "needs_verification",
    equitiesPossible: "no",
    apiKeyRequired: "no",
    rateLimits: "File download etiquette applies; not designed as high-frequency backend API.",
    paginationModel: "CSV file download.",
    licensingRisk: "needs_verification",
    reliability: "partial",
    gapBehavior: "CSV gaps and schema changes need importer diagnostics.",
    productMetadataQuality: "no",
    implementationComplexity: "medium",
    fitForVegaRank: "audit_only",
    recommendedRoles: ["manual_import_only", "research_audit_candidate"],
    notes: "Deprecated/not selected for production primary or Coinbase supplemental ingestion; useful only as a manual CSV feasibility benchmark.",
  },
  {
    id: "coinlore",
    provider: "CoinLore",
    providerType: "metadata",
    freeTier: "yes",
    exchangeSpecific: "no",
    aggregatedOnly: "yes",
    intervals: intervalCapabilities({ "1h": "needs_verification", "4h": "no", "1d": "needs_verification", "1w": "needs_verification" }),
    intervalsSupported: "OHLCV suitability needs verification.",
    historicalDepth: "Needs verification.",
    coinbaseUsdcLikely: "no",
    binanceLikely: "no",
    usdcPairSupport: "no",
    equitiesPossible: "no",
    apiKeyRequired: "no",
    rateLimits: "Public API limits need verification.",
    paginationModel: "Metadata-style API pagination.",
    licensingRisk: "needs_verification",
    reliability: "needs_verification",
    gapBehavior: "Not evaluated for candles.",
    productMetadataQuality: "partial",
    implementationComplexity: "low",
    fitForVegaRank: "metadata_only",
    recommendedRoles: ["metadata_enrichment"],
    notes: "Do not treat as an exchange-specific candle source without a separate proof.",
  },
  {
    id: "tokendatabase",
    provider: "TokenDatabase",
    providerType: "metadata",
    freeTier: "needs_verification",
    exchangeSpecific: "no",
    aggregatedOnly: "yes",
    intervals: intervalCapabilities({ "1h": "needs_verification", "4h": "needs_verification", "1d": "needs_verification", "1w": "needs_verification" }),
    intervalsSupported: "Needs verification.",
    historicalDepth: "Needs verification.",
    coinbaseUsdcLikely: "needs_verification",
    binanceLikely: "needs_verification",
    usdcPairSupport: "needs_verification",
    equitiesPossible: "no",
    apiKeyRequired: "needs_verification",
    rateLimits: "Needs verification.",
    paginationModel: "Needs verification.",
    licensingRisk: "needs_verification",
    reliability: "needs_verification",
    gapBehavior: "Unknown.",
    productMetadataQuality: "needs_verification",
    implementationComplexity: "high",
    fitForVegaRank: "audit_only",
    recommendedRoles: ["research_audit_candidate"],
    notes: "Name appears metadata-oriented; treat as uncertain until a source audit is completed.",
  },
  {
    id: "twelvedata",
    provider: "Twelve Data",
    providerType: "mixed_market_data",
    freeTier: "partial",
    exchangeSpecific: "needs_verification",
    aggregatedOnly: "needs_verification",
    intervals: intervalCapabilities({ "1h": "yes", "4h": "yes", "1d": "yes", "1w": "yes" }),
    intervalsSupported: "Broad time series intervals are likely; crypto venue semantics need verification.",
    historicalDepth: "Plan-limited; needs verification for 200 candles across symbols.",
    coinbaseUsdcLikely: "needs_verification",
    binanceLikely: "needs_verification",
    usdcPairSupport: "needs_verification",
    equitiesPossible: "yes",
    apiKeyRequired: "yes",
    rateLimits: "Free and paid API limits are plan-based.",
    paginationModel: "Symbol, exchange, interval, and output-size oriented endpoints.",
    licensingRisk: "needs_verification",
    reliability: "partial",
    gapBehavior: "Needs audit for crypto exchange mapping and missing bars.",
    productMetadataQuality: "partial",
    implementationComplexity: "medium",
    fitForVegaRank: "candidate",
    recommendedRoles: ["research_audit_candidate"],
    notes: "Interesting because it may support future equities, but crypto exchange specificity must be proven.",
  },
  {
    id: "polygon_crypto",
    provider: "Polygon crypto",
    providerType: "mixed_market_data",
    freeTier: "partial",
    exchangeSpecific: "needs_verification",
    aggregatedOnly: "partial",
    intervals: intervalCapabilities({ "1h": "yes", "4h": "yes", "1d": "yes", "1w": "yes" }),
    intervalsSupported: "Aggregate bar APIs can express these intervals; exchange-specific crypto semantics need verification.",
    historicalDepth: "Plan-dependent.",
    coinbaseUsdcLikely: "needs_verification",
    binanceLikely: "needs_verification",
    usdcPairSupport: "needs_verification",
    equitiesPossible: "yes",
    apiKeyRequired: "yes",
    rateLimits: "Plan-based.",
    paginationModel: "Aggregate endpoint with multiplier, timespan, and cursor pagination.",
    licensingRisk: "medium",
    reliability: "partial",
    gapBehavior: "Aggregated crypto bars must not be treated as venue-specific without source labels.",
    productMetadataQuality: "partial",
    implementationComplexity: "medium",
    fitForVegaRank: "candidate",
    recommendedRoles: ["research_audit_candidate"],
    notes: "Potential multi-asset future path; crypto pair coverage and venue semantics are the audit blocker.",
  },
  {
    id: "tiingo_crypto",
    provider: "Tiingo crypto",
    providerType: "mixed_market_data",
    freeTier: "partial",
    exchangeSpecific: "needs_verification",
    aggregatedOnly: "partial",
    intervals: intervalCapabilities({ "1h": "needs_verification", "4h": "needs_verification", "1d": "yes", "1w": "needs_verification" }),
    intervalsSupported: "Crypto/equity time-series support exists, but requested intervals need verification.",
    historicalDepth: "Plan-dependent.",
    coinbaseUsdcLikely: "needs_verification",
    binanceLikely: "needs_verification",
    usdcPairSupport: "needs_verification",
    equitiesPossible: "yes",
    apiKeyRequired: "yes",
    rateLimits: "Plan-based.",
    paginationModel: "Date-range API.",
    licensingRisk: "needs_verification",
    reliability: "partial",
    gapBehavior: "Needs audit for venue and aggregate semantics.",
    productMetadataQuality: "partial",
    implementationComplexity: "medium",
    fitForVegaRank: "candidate",
    recommendedRoles: ["research_audit_candidate"],
    notes: "Worth including in future equities audit, not enough evidence for Coinbase replacement yet.",
  },
  {
    id: "coinapi",
    provider: "CoinAPI",
    providerType: "mixed_market_data",
    freeTier: "partial",
    exchangeSpecific: "yes",
    aggregatedOnly: "no",
    intervals: intervalCapabilities({ "1h": "yes", "4h": "yes", "1d": "yes", "1w": "yes" }),
    intervalsSupported: "OHLCV periods likely cover VegaRank intervals; plan limits need verification.",
    historicalDepth: "Paid-plan dependent; likely stronger than free tiers.",
    coinbaseUsdcLikely: "yes",
    binanceLikely: "yes",
    usdcPairSupport: "yes",
    equitiesPossible: "no",
    apiKeyRequired: "yes",
    rateLimits: "Plan-based.",
    paginationModel: "Exchange/symbol/time-period endpoints.",
    licensingRisk: "medium",
    reliability: "partial",
    gapBehavior: "Provider-normalized gaps still need reporting by source.",
    productMetadataQuality: "yes",
    implementationComplexity: "medium",
    fitForVegaRank: "strong_candidate",
    recommendedRoles: ["research_audit_candidate"],
    notes: "Strong paid/low-cost candidate if terms and symbol coverage fit.",
  },
  {
    id: "kaiko",
    provider: "Kaiko",
    providerType: "institutional_vendor",
    freeTier: "no",
    exchangeSpecific: "yes",
    aggregatedOnly: "no",
    intervals: intervalCapabilities({ "1h": "yes", "4h": "yes", "1d": "yes", "1w": "yes" }),
    intervalsSupported: "Institutional OHLCV coverage likely supports requested intervals.",
    historicalDepth: "Likely deep but commercial.",
    coinbaseUsdcLikely: "yes",
    binanceLikely: "yes",
    usdcPairSupport: "yes",
    equitiesPossible: "no",
    apiKeyRequired: "yes",
    rateLimits: "Contract/API-plan based.",
    paginationModel: "Vendor API pagination.",
    licensingRisk: "low",
    reliability: "yes",
    gapBehavior: "Professional vendor should expose provenance; still audit gaps.",
    productMetadataQuality: "yes",
    implementationComplexity: "high",
    fitForVegaRank: "audit_only",
    recommendedRoles: ["research_audit_candidate"],
    notes: "Likely high quality but may exceed VegaRank's free or low-cost target.",
  },
  {
    id: "tardis",
    provider: "Tardis.dev",
    providerType: "derivatives_or_tick_vendor",
    freeTier: "partial",
    exchangeSpecific: "yes",
    aggregatedOnly: "no",
    intervals: intervalCapabilities({ "1h": "needs_verification", "4h": "needs_verification", "1d": "needs_verification", "1w": "needs_verification" }),
    intervalsSupported: "Raw historical market data may require local aggregation; candle API support needs verification.",
    historicalDepth: "Likely deep for supported exchanges and instruments.",
    coinbaseUsdcLikely: "needs_verification",
    binanceLikely: "yes",
    usdcPairSupport: "needs_verification",
    equitiesPossible: "no",
    apiKeyRequired: "partial",
    rateLimits: "Plan/download based.",
    paginationModel: "Historical file/API access.",
    licensingRisk: "medium",
    reliability: "partial",
    gapBehavior: "Raw data path would move VegaRank toward market-data infrastructure.",
    productMetadataQuality: "partial",
    implementationComplexity: "high",
    fitForVegaRank: "audit_only",
    recommendedRoles: ["research_audit_candidate"],
    notes: "Avoid as primary if it requires building candle infrastructure from trades.",
  },
  {
    id: "backdb",
    provider: "BackDB",
    providerType: "unknown_or_unsuitable",
    freeTier: "needs_verification",
    exchangeSpecific: "needs_verification",
    aggregatedOnly: "needs_verification",
    intervals: intervalCapabilities({ "1h": "needs_verification", "4h": "needs_verification", "1d": "needs_verification", "1w": "needs_verification" }),
    intervalsSupported: "Needs verification.",
    historicalDepth: "Needs verification.",
    coinbaseUsdcLikely: "needs_verification",
    binanceLikely: "needs_verification",
    usdcPairSupport: "needs_verification",
    equitiesPossible: "needs_verification",
    apiKeyRequired: "needs_verification",
    rateLimits: "Needs verification.",
    paginationModel: "Needs verification.",
    licensingRisk: "needs_verification",
    reliability: "needs_verification",
    gapBehavior: "Unknown.",
    productMetadataQuality: "needs_verification",
    implementationComplexity: "high",
    fitForVegaRank: "audit_only",
    recommendedRoles: ["research_audit_candidate"],
    notes: "Keep in matrix only as an explicitly unknown candidate until documentation is verified.",
  },
  {
    id: "coinmarketcap",
    provider: "CoinMarketCap",
    providerType: "metadata",
    freeTier: "partial",
    exchangeSpecific: "partial",
    aggregatedOnly: "yes",
    intervals: intervalCapabilities({ "1h": "needs_verification", "4h": "needs_verification", "1d": "needs_verification", "1w": "needs_verification" }),
    intervalsSupported: "Treat primarily as metadata unless OHLCV licensing and granularity are verified.",
    historicalDepth: "Plan-dependent.",
    coinbaseUsdcLikely: "needs_verification",
    binanceLikely: "needs_verification",
    usdcPairSupport: "needs_verification",
    equitiesPossible: "no",
    apiKeyRequired: "yes",
    rateLimits: "Plan-based.",
    paginationModel: "Metadata and quotes endpoints.",
    licensingRisk: "needs_verification",
    reliability: "partial",
    gapBehavior: "Aggregated data must be labeled.",
    productMetadataQuality: "yes",
    implementationComplexity: "medium",
    fitForVegaRank: "metadata_only",
    recommendedRoles: ["metadata_enrichment", "research_audit_candidate"],
    notes: "Applicable mainly for metadata and cross-listing context.",
  },
  {
    id: "defillama",
    provider: "DefiLlama",
    providerType: "metadata",
    freeTier: "yes",
    exchangeSpecific: "no",
    aggregatedOnly: "yes",
    intervals: intervalCapabilities({ "1h": "not_applicable", "4h": "not_applicable", "1d": "not_applicable", "1w": "not_applicable" }),
    intervalsSupported: "Not a primary OHLCV candle source for VegaRank exchange rankings.",
    historicalDepth: "Protocol-level histories may exist, but not venue OHLCV.",
    coinbaseUsdcLikely: "no",
    binanceLikely: "no",
    usdcPairSupport: "no",
    equitiesPossible: "no",
    apiKeyRequired: "no",
    rateLimits: "Public API etiquette applies.",
    paginationModel: "Protocol and chain metadata endpoints.",
    licensingRisk: "medium",
    reliability: "partial",
    gapBehavior: "Not applicable to exchange candles.",
    productMetadataQuality: "yes",
    implementationComplexity: "low",
    fitForVegaRank: "metadata_only",
    recommendedRoles: ["metadata_enrichment"],
    notes: "Useful only for protocol context; not a candle provider.",
  },
  {
    id: "nasdaq_data_link",
    provider: "Nasdaq Data Link / Quandl datasets",
    providerType: "mixed_market_data",
    freeTier: "partial",
    exchangeSpecific: "needs_verification",
    aggregatedOnly: "needs_verification",
    intervals: intervalCapabilities({ "1h": "needs_verification", "4h": "needs_verification", "1d": "needs_verification", "1w": "needs_verification" }),
    intervalsSupported: "Dataset-specific.",
    historicalDepth: "Dataset-specific.",
    coinbaseUsdcLikely: "needs_verification",
    binanceLikely: "needs_verification",
    usdcPairSupport: "needs_verification",
    equitiesPossible: "yes",
    apiKeyRequired: "yes",
    rateLimits: "Dataset/API-plan based.",
    paginationModel: "Dataset-specific table/time-series access.",
    licensingRisk: "needs_verification",
    reliability: "partial",
    gapBehavior: "Dataset-specific.",
    productMetadataQuality: "partial",
    implementationComplexity: "high",
    fitForVegaRank: "audit_only",
    recommendedRoles: ["research_audit_candidate"],
    notes: "Relevant for future multi-asset research, not an immediate Coinbase candle fix.",
  },
];

export const providerCapabilityProfilesById: Record<
  MarketDataProviderId,
  ProviderCapabilityProfile
> = Object.fromEntries(
  providerCapabilityProfiles.map((profile) => [profile.id, profile]),
) as Record<MarketDataProviderId, ProviderCapabilityProfile>;
