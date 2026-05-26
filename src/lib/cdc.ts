import type { Trade } from "./types";

export function calcEMA(prices: number[], period: number): number[] {
  if (prices.length === 0) return [];
  const k = 2 / (period + 1);
  const ema = [prices[0]];
  for (let i = 1; i < prices.length; i++) {
    ema.push(prices[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

export function getCDCZone(price: number, ema12: number, ema26: number): number {
  if (price > ema12 && ema12 > ema26) return 1;
  if (price > ema26 && ema26 > ema12) return 2;
  if (ema12 > price && price > ema26) return 3;
  if (ema26 > price && price > ema12) return 4;
  if (ema12 > ema26 && ema26 > price) return 5;
  if (ema26 > ema12 && ema12 > price) return 6;
  return 0;
}

export const ZONE_LABELS = [
  "Neutral",
  "Strong Buy",
  "Buy",
  "Near Buy",
  "Near Sell",
  "Sell",
  "Strong Sell",
];

export function detectWaveStages(
  prices: number[],
  ema12: number[],
  ema26: number[],
  ema55: number[],
): string[] {
  const stages: string[] = [];
  let hadW1 = false;
  let hadW2 = false;
  let prevAbove = false;

  for (let i = 0; i < prices.length; i++) {
    const zone = getCDCZone(prices[i], ema12[i], ema26[i]);
    const above = ema12[i] > ema26[i];
    const spread = ema12[i] - ema26[i];
    const waveSpread = ema26[i] - ema55[i];

    if (zone === 1 && above && !prevAbove) {
      stages.push("W1");
      hadW1 = true;
      hadW2 = false;
    } else if ([3, 4].includes(zone) && above && hadW1) {
      stages.push("W2");
      hadW2 = true;
    } else if (zone === 1 && above && hadW1 && hadW2 && spread > waveSpread * 0.5) {
      stages.push("W3");
      hadW2 = false;
    } else if ([5, 6].includes(zone)) {
      stages.push("SELL");
      hadW1 = false;
      hadW2 = false;
    } else {
      stages.push("HOLD");
    }
    prevAbove = above;
  }
  return stages;
}

export type DotType = "buy" | "nearBuy" | "sell" | "wave3" | null;

export function calcSignalDots(prices: number[], waves: string[]): { type: DotType }[] {
  return prices.map((_, i) => {
    const w = waves[i];
    const prevW = waves[i - 1];
    if (w === "W1" && prevW !== "W1") return { type: "buy" };
    if (w === "W2") return { type: "nearBuy" };
    if (w === "SELL" && prevW !== "SELL") return { type: "sell" };
    if (w === "W3") return { type: "wave3" };
    return { type: null };
  });
}

export function calcStats(trades: Trade[]) {
  const closed = trades.filter((t) => t.status === "Closed");
  const wins = closed.filter((t) => t.signalGain > 0);
  const signalGain = closed.reduce((s, t) => s + t.signalGain, 0);
  let compound = 1;
  closed.forEach((t) => (compound *= 1 + t.signalGain / 100));
  const netProfit = (compound - 1) * 100;
  let peak = 1;
  let mdd = 0;
  let running = 1;
  closed.forEach((t) => {
    running *= 1 + t.signalGain / 100;
    if (running > peak) peak = running;
    const dd = ((running - peak) / peak) * 100;
    if (dd < mdd) mdd = dd;
  });
  const lastOpen = trades.at(-1)?.status === "Open";
  return {
    status: lastOpen ? "BUY" : "HOLD",
    signalGain: +signalGain.toFixed(1),
    netProfit: +netProfit.toFixed(1),
    mdd: +mdd.toFixed(1),
    trades: trades.length,
    winRate: closed.length ? Math.round((wins.length / closed.length) * 100) : 0,
  };
}

export function calcWavePhase(prices: number[], waves: string[]): number {
  const w3Start = waves.lastIndexOf("W3");
  if (w3Start < 0) return 0;
  const w1Start = waves.indexOf("W1");
  if (w1Start < 0) return 0;
  const w1End = waves.indexOf("W2", w1Start);
  if (w1End < 0) return 0;
  const w1Slice = prices.slice(w1Start, w1End);
  if (!w1Slice.length) return 0;
  const w1Low = Math.min(...w1Slice);
  const w1High = Math.max(...w1Slice);
  const w1Range = w1High - w1Low;
  if (w1Range === 0) return 0;
  const currentGain = prices[prices.length - 1] - prices[w3Start];
  return Math.min(100, Math.max(0, Math.round((currentGain / w1Range) * 100)));
}
