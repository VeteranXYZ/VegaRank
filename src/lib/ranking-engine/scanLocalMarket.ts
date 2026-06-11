import type { Timeframe } from "@/lib/exchanges/types";
import type { MarketDataStoreLike } from "@/lib/storage/marketDataModel";
import {
  calculateMultiTimeframeRankScore,
  mtfPresetTimeframes,
  summarizeMultiTimeframe,
  type MtfPreset,
} from "./multiTimeframe";
import { scanCandles } from "./scanCandles";
import type { ScanResult } from "./types";

const SCAN_CANDLE_LIMIT = 300;
const MIN_SCAN_CANDLES = 200;

export async function scanLocalMarket({
  store,
  symbol,
  timeframe,
}: {
  store: MarketDataStoreLike;
  symbol: string;
  timeframe: Timeframe;
}): Promise<ScanResult> {
  const candles = await store.getCandles({
    symbol,
    timeframe,
    limit: SCAN_CANDLE_LIMIT,
  });

  if (candles.length < MIN_SCAN_CANDLES) {
    throw new Error(
      `Insufficient local candles for ${symbol} ${timeframe}: ${candles.length}/${MIN_SCAN_CANDLES}`,
    );
  }

  return scanCandles(symbol, timeframe, candles);
}

export async function scanLocalMarketMultiTimeframe({
  store,
  symbol,
  preset,
}: {
  store: MarketDataStoreLike;
  symbol: string;
  preset: MtfPreset;
}): Promise<ScanResult> {
  const timeframes = mtfPresetTimeframes[preset];
  const results = await Promise.all(
    timeframes.map((timeframe) => scanLocalMarket({ store, symbol, timeframe })),
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
