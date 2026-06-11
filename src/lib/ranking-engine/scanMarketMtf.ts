import { getCandles } from "@/lib/exchanges/binance";
import type { Timeframe } from "@/lib/exchanges/types";
import {
  mtfPresetTimeframes,
  summarizeMultiTimeframe,
  type MtfPreset,
} from "./multiTimeframe";
import {
  applyQuantContextScores,
  calculateMtfAgreementScore,
} from "./quantScoring";
import { scanCandles } from "./scanCandles";
import type { ScanResult } from "./types";

export async function scanMarketMultiTimeframe(
  symbol: string,
  preset: MtfPreset,
): Promise<ScanResult> {
  const timeframes = mtfPresetTimeframes[preset];
  const results = await Promise.all(
    timeframes.map(async (timeframe) => {
      const candles = await getCandles(symbol, timeframe, 300);
      return scanCandles(symbol, timeframe, candles);
    }),
  );
  const summary = summarizeMultiTimeframe(results);
  const primary = pickPrimaryResult(results, timeframes);
  const mtfAgreementScore = calculateMtfAgreementScore(results);
  const primaryWithMtf = applyQuantContextScores(primary, { mtfAgreementScore });
  const rankScore = primaryWithMtf.rankScore;

  return {
    ...primaryWithMtf,
    rankScore,
    multiTimeframe: {
      ...summary,
      rankScore,
      timeframes,
      timeframeResults: results.map((result) => ({
        timeframe: result.timeframe,
        phase: result.phase,
        signal: result.signal,
        rankScore: result.rankScore,
        opportunityScore: result.opportunityScore,
        confirmationScore: result.confirmationScore,
        riskScore: result.riskScore,
      })),
    },
  };
}

function pickPrimaryResult(results: ScanResult[], timeframes: Timeframe[]) {
  const preferredTimeframes: Timeframe[] = ["4h", "1d", "1w", "1M"];

  for (const timeframe of preferredTimeframes) {
    if (timeframes.includes(timeframe)) {
      const result = results.find((item) => item.timeframe === timeframe);
      if (result) {
        return result;
      }
    }
  }

  return results[0];
}
