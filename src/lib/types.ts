export type Action = "BUY" | "SELL" | "WATCH" | "WAIT";
export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export type Trade = {
  lot: string; // "1/3"
  buyDate: string;
  buyPrice: number;
  sellDate: string | null;
  sellPrice: number | null;
  status: "Open" | "Closed";
  signalGain: number;
  bh: number;
};

export type Signal = {
  ticker: string;
  name?: string;
  date: string;
  price: number;
  ema12: number;
  ema26: number;
  ema55: number;
  zone: number;
  zone_label: string;
  wave: string;
  action: Action;
  score: number;
  confidence: Confidence;
  lot_size_pct: number;
  cdc_agree: boolean;
  chronos_direction: string;
  chronos_confidence: Confidence;
  p10: number;
  p50: number;
  p90: number;
  upside_pct: number;
  downside_pct: number;
  vol_spike: boolean;
  volatility_pct: number;
  cross_in_days: number | null;
  dates: string[];
  prices: number[];
  ema12s: number[];
  ema26s: number[];
  ema55s: number[];
  waves: string[];
  volumes: number[];
  trades: Trade[];
  signalGain: number;
  wavePhase: number;
};
