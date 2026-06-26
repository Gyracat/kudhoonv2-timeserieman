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
  // FIX: บอกว่าออกจาก trade เพราะอะไร
  exitReason?: "sell" | "stop" | null;
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
  // FIX: flag บอกว่าเป็น Chronos จริง (จาก Railway) หรือ statistical
  is_real_chronos?: boolean;
  // FIX: ระบุ model ที่ใช้ forecast: lstm | chronos | statistical
  forecast_model?: "lstm" | "chronos" | "statistical";
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
  backtest?: {
    params: { fast: number; slow: number; wave: number };
    perYear: { year: number; trades: number; winRate: number; netProfit: number; mdd: number }[];
    totalReturn: number;
    winRate: number;
    mdd: number;
    trades: number;
    // FIX: out-of-sample validation result
    oosWinRate?: number;
    oosReturn?: number;
  };
};
