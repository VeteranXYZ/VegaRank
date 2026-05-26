export type Exchange = "binance";

export const TIMEFRAMES = ["1h", "4h", "1d", "7d", "1M"] as const;

export type Timeframe = (typeof TIMEFRAMES)[number];

export const timeframeLabels: Record<Timeframe, string> = {
  "1h": "1H",
  "4h": "4H",
  "1d": "1D",
  "7d": "7D",
  "1M": "1M",
};

export type Market = {
  exchange: Exchange;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
  quoteVolume?: number;
  priceChangePercent?: number;
};

export type Candle = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
};
