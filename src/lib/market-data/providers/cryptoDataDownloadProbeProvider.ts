import {
  buildEmptyAuditResult,
  type LiveProviderProbe,
} from "../liveProviderAudit";

export function createCryptoDataDownloadProbe(): LiveProviderProbe {
  return {
    providerId: "cryptodatadownload",
    audit: async ({ symbol, timeframe }) =>
      buildEmptyAuditResult({
        providerId: "cryptodatadownload",
        symbolRequested: symbol,
        providerSymbolUsed: symbol,
        exchangeSpecific: "unknown",
        aggregatedOnly: false,
        quoteAssetPreserved: "unknown",
        timeframe,
        nativeIntervalSupported: "unknown",
        fetchedCandles: 0,
        enoughForVegaRank200: false,
        requestCount: 0,
        authRequired: false,
        errorCode: "needs_manual_url_mapping",
        errorMessage:
          buildCryptoDataDownloadMessage(symbol, timeframe),
        dataUseWarning:
          "No brittle HTML scraping is performed. Historical CSV feasibility depends on explicit exchange/symbol/timeframe URL mappings and licensing review.",
        requestUrlKind: "cryptodatadownload_manual_csv_mapping",
        failureCategory: "manual_mapping_required",
        providerGranularity: getConceptualCryptoDataDownloadTimeframe(timeframe),
        marketDataProvenance: "uncertain",
      }),
  };
}

function buildCryptoDataDownloadMessage(symbol: string, timeframe: string) {
  return [
    `CryptoDataDownload may support historical CSV for ${symbol} on specific exchanges, but this audit has no verified URL mapping table.`,
    `${timeframe} file availability is conceptual only until a manual exchange/symbol URL is registered.`,
    "Licensing, redistribution, and display limitations remain unknown.",
  ].join(" ");
}

function getConceptualCryptoDataDownloadTimeframe(timeframe: string) {
  if (timeframe === "1h") {
    return "conceptual hourly CSV if exchange/symbol file exists";
  }
  if (timeframe === "1d") {
    return "conceptual daily CSV if exchange/symbol file exists";
  }
  if (timeframe === "4h") {
    return "manual verification required; likely derived from hourly CSV if licensed";
  }
  return "manual verification required; likely derived from daily CSV if licensed";
}
