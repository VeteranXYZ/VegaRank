import {
  buildEmptyAuditResult,
  type LiveAuditProviderId,
  type LiveProviderProbe,
} from "../liveProviderAudit";

export function createAuthRequiredProbe(providerId: LiveAuditProviderId): LiveProviderProbe {
  return {
    providerId,
    audit: async ({ symbol, timeframe }) =>
      buildEmptyAuditResult({
        providerId,
        symbolRequested: symbol,
        providerSymbolUsed: symbol,
        exchangeSpecific: "unknown",
        aggregatedOnly: "unknown",
        quoteAssetPreserved: "unknown",
        timeframe,
        nativeIntervalSupported: "unknown",
        fetchedCandles: 0,
        enoughForVegaRank200: false,
        requestCount: 0,
        authRequired: true,
        errorCode: "paid_or_key_required",
        errorMessage:
          "This provider is intentionally not probed without an API key or paid-plan decision.",
        dataUseWarning:
          "Do not add secrets to the audit script; run a controlled follow-up if this provider is selected.",
        failureCategory: "paid_or_key_required",
        requestUrlKind: `${providerId}_not_probed_paid_or_key_required`,
        marketDataProvenance: "uncertain",
      }),
  };
}
