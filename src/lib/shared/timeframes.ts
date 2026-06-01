export type Exchange = "binance";

export const TIMEFRAMES = ["4h", "1h", "1d", "1w", "1M"] as const;

export type Timeframe = (typeof TIMEFRAMES)[number];

export const timeframeLabels: Record<Timeframe, string> = {
  "4h": "4H",
  "1h": "1H",
  "1d": "1D",
  "1w": "1W",
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
  quoteVolume?: number;
  closeTime: number;
};
