import { getCandles } from "@/lib/exchanges/binance";
import type { Timeframe } from "@/lib/exchanges/types";
import { scanCandles } from "./scanCandles";
import type { ScanResult } from "./types";

export async function scanMarket(
  symbol: string,
  timeframe: Timeframe,
): Promise<ScanResult> {
  const candles = await getCandles(symbol, timeframe, 300);
  return scanCandles(symbol, timeframe, candles);
}
