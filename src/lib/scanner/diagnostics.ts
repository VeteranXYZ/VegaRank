import type { ScanResult } from "./types";

export type ScanErrorSample = {
  symbol: string;
  message: string;
};

export type ScanFailureSummary = {
  insufficientHistory: number;
  fetchFailed: number;
  indicatorFailed: number;
  filteredLowVolume: number;
  excludedStableOrLeveraged: number;
};

export function summarizeScanFailures({
  scannedResults,
  errors,
  filteredLowVolume,
  excludedStableOrLeveraged,
}: {
  scannedResults: ScanResult[];
  errors: ScanErrorSample[];
  filteredLowVolume: number;
  excludedStableOrLeveraged: number;
}): ScanFailureSummary {
  return {
    insufficientHistory: scannedResults.filter(
      (result) => !result.dataQuality.sufficientHistory,
    ).length,
    fetchFailed: errors.filter((error) => isFetchFailure(error.message)).length,
    indicatorFailed: errors.filter((error) => !isFetchFailure(error.message)).length,
    filteredLowVolume,
    excludedStableOrLeveraged,
  };
}

function isFetchFailure(message: string) {
  return /binance|fetch|network|request failed|timeout|timed out|rate limit/i.test(
    message,
  );
}
