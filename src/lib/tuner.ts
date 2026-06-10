import { calcEMA, detectWaveStages } from "./cdc";

export type Params = { fast: number; slow: number; wave: number };

export type YearStat = {
  year: number;
  trades: number;
  winRate: number;
  netProfit: number;
  mdd: number;
};

export type BacktestResult = {
  params: Params;
  perYear: YearStat[];
  totalReturn: number;
  winRate: number;
  mdd: number;
  trades: number;
  score: number;
  candidates: number;
};

// Build closed-trade gains (in %) from a sub-series.
function simulate(prices: number[], waves: string[]): number[] {
  const gains: number[] = [];
  let openPrice: number | null = null;
  for (let i = 1; i < waves.length; i++) {
    const w = waves[i];
    const prev = waves[i - 1];
    if ((w === "W1" || w === "W3") && prev !== w && openPrice == null) {
      openPrice = prices[i];
    } else if (w === "SELL" && prev !== "SELL" && openPrice != null) {
      gains.push(((prices[i] - openPrice) / openPrice) * 100);
      openPrice = null;
    }
  }
  return gains;
}

function statsOf(gains: number[]): { winRate: number; netProfit: number; mdd: number } {
  if (!gains.length) return { winRate: 0, netProfit: 0, mdd: 0 };
  const wins = gains.filter((g) => g > 0).length;
  let eq = 1;
  let peak = 1;
  let mdd = 0;
  for (const g of gains) {
    eq *= 1 + g / 100;
    if (eq > peak) peak = eq;
    const dd = ((eq - peak) / peak) * 100;
    if (dd < mdd) mdd = dd;
  }
  return {
    winRate: Math.round((wins / gains.length) * 100),
    netProfit: +((eq - 1) * 100).toFixed(2),
    mdd: +mdd.toFixed(2),
  };
}

function score(s: { winRate: number; netProfit: number; mdd: number; trades: number }): number {
  if (!s.trades) return -Infinity;
  // reward net profit & win rate, penalize drawdown
  return (s.netProfit * (s.winRate / 100)) / (1 + Math.abs(s.mdd) / 20);
}

function runOnce(
  prices: number[],
  fast: number,
  slow: number,
  wave: number,
): { waves: string[]; gains: number[] } {
  const eF = calcEMA(prices, fast);
  const eS = calcEMA(prices, slow);
  const eW = calcEMA(prices, wave);
  const waves = detectWaveStages(prices, eF, eS, eW);
  const gains = simulate(prices, waves);
  return { waves, gains };
}

const FAST_GRID = [8, 10, 12, 15];
const SLOW_GRID = [21, 26, 34];
const WAVE_GRID = [50, 55, 89];

/**
 * Walk-forward auto-tune over 3 yearly chunks.
 * - Tune on year 1+2 (in-sample): pick best params by composite score
 * - Validate on year 3 (out-of-sample)
 * - Recompute per-year stats with the chosen params over the whole series
 */
export function tuneParams(dates: string[], prices: number[]): BacktestResult {
  const n = prices.length;
  if (n < 120) {
    // Not enough data — fall back to default
    const def: Params = { fast: 12, slow: 26, wave: 55 };
    const all = runOnce(prices, def.fast, def.slow, def.wave);
    const s = statsOf(all.gains);
    return {
      params: def,
      perYear: [],
      totalReturn: s.netProfit,
      winRate: s.winRate,
      mdd: s.mdd,
      trades: all.gains.length,
      score: score({ ...s, trades: all.gains.length }),
      candidates: 0,
    };
  }
  // Build year buckets by date
  const yearOf = dates.map((d) => +d.slice(0, 4));
  const years = Array.from(new Set(yearOf)).sort();
  const lastYears = years.slice(-3);
  const inSampleYears = lastYears.slice(0, Math.max(1, lastYears.length - 1));
  const inSampleEnd = yearOf.findIndex((y) => y > inSampleYears[inSampleYears.length - 1]);
  const cutoff = inSampleEnd === -1 ? Math.floor(n * 0.66) : inSampleEnd;

  const inPrices = prices.slice(0, cutoff);

  let best: { params: Params; sc: number; trades: number } = {
    params: { fast: 12, slow: 26, wave: 55 },
    sc: -Infinity,
    trades: 0,
  };
  let candidates = 0;
  for (const fast of FAST_GRID) {
    for (const slow of SLOW_GRID) {
      if (slow <= fast) continue;
      for (const wave of WAVE_GRID) {
        if (wave <= slow) continue;
        candidates++;
        const { gains } = runOnce(inPrices, fast, slow, wave);
        const s = statsOf(gains);
        const sc = score({ ...s, trades: gains.length });
        if (sc > best.sc) best = { params: { fast, slow, wave }, sc, trades: gains.length };
      }
    }
  }

  // Apply best params on FULL series and split per year for reporting
  const full = runOnce(prices, best.params.fast, best.params.slow, best.params.wave);
  const perYear: YearStat[] = lastYears.map((yr) => {
    const idxs: number[] = [];
    for (let i = 0; i < dates.length; i++) if (yearOf[i] === yr) idxs.push(i);
    if (!idxs.length) return { year: yr, trades: 0, winRate: 0, netProfit: 0, mdd: 0 };
    const start = idxs[0];
    const end = idxs[idxs.length - 1];
    const yp = prices.slice(start, end + 1);
    const yw = full.waves.slice(start, end + 1);
    const gains = simulate(yp, yw);
    const s = statsOf(gains);
    return { year: yr, trades: gains.length, ...s };
  });

  const total = statsOf(full.gains);
  return {
    params: best.params,
    perYear,
    totalReturn: total.netProfit,
    winRate: total.winRate,
    mdd: total.mdd,
    trades: full.gains.length,
    score: score({ ...total, trades: full.gains.length }),
    candidates,
  };
}
