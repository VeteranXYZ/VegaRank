import { getCandles } from "@/lib/exchanges/binance";
import type { Timeframe } from "@/lib/exchanges/types";
import {
  calculateMultiTimeframeRankScore,
  mtfPresetTimeframes,
  summarizeMultiTimeframe,
  type MtfPreset,
} from "./multiTimeframe";
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
  const rankScore = calculateMultiTimeframeRankScore(results, summary);
  const primary = pickPrimaryResult(results, timeframes);

  return {
    ...primary,
    rankScore,
    multiTimeframe: {
      ...summary,
      rankScore,
      timeframes,
    },
  };
}

function pickPrimaryResult(results: ScanResult[], timeframes: Timeframe[]) {
  const preferredTimeframes: Timeframe[] = ["4h", "1d", "1h", "7d", "1m"];

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
