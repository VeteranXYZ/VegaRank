import type { Timeframe } from "@/lib/exchanges/types";
import { MarketDataStore } from "@/lib/storage/marketData";
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

export function scanLocalMarket({
  store,
  symbol,
  timeframe,
}: {
  store: MarketDataStore;
  symbol: string;
  timeframe: Timeframe;
}): ScanResult {
  const candles = store.getCandles({
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

export function scanLocalMarketMultiTimeframe({
  store,
  symbol,
  preset,
}: {
  store: MarketDataStore;
  symbol: string;
  preset: MtfPreset;
}): ScanResult {
  const timeframes = mtfPresetTimeframes[preset];
  const results = timeframes.map((timeframe) =>
    scanLocalMarket({ store, symbol, timeframe }),
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
