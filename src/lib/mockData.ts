import type { Signal, Trade, Action, Confidence } from "./types";
import { calcEMA, detectWaveStages, calcWavePhase, getCDCZone, ZONE_LABELS } from "./cdc";

const TICKERS: { ticker: string; name: string; basePrice: number; trend: number; vol: number }[] = [
  { ticker: "AAPL", name: "Apple Inc.", basePrice: 220, trend: 0.0015, vol: 0.018 },
  { ticker: "MSFT", name: "Microsoft Corp.", basePrice: 420, trend: 0.0012, vol: 0.016 },
  { ticker: "NVDA", name: "NVIDIA Corp.", basePrice: 130, trend: 0.0028, vol: 0.032 },
];

export const DEFAULT_WATCHLIST = [
  "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "AMD",
  "NFLX", "AVGO", "ORCL", "CRM", "ADBE", "INTC", "QCOM", "PYPL",
  "DIS", "BA", "JPM", "V", "MA", "WMT", "COST", "NKE",
  "SPY", "QQQ", "DIA", "IWM", "BTC-USD", "ETH-USD",
];

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function generateSeries(seed: number, days: number, base: number, trend: number, vol: number) {
  const rand = seededRandom(seed);
  const prices: number[] = [];
  let p = base;
  for (let i = 0; i < days; i++) {
    const shock = (rand() - 0.5) * 2 * vol;
    const wave = Math.sin(i / 15) * vol * 0.4;
    p = p * (1 + trend + shock + wave);
    prices.push(+p.toFixed(2));
  }
  return prices;
}

function generateDates(days: number, endDate = new Date(2026, 4, 22)): string[] {
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(endDate);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function buildTrades(dates: string[], prices: number[], waves: string[]): Trade[] {
  const trades: Trade[] = [];
  let openBuy: { idx: number; price: number } | null = null;
  let lotNum = 0;

  for (let i = 1; i < waves.length; i++) {
    const w = waves[i];
    const prev = waves[i - 1];
    if ((w === "W1" || w === "W3") && prev !== w && !openBuy) {
      openBuy = { idx: i, price: prices[i] };
      lotNum++;
    } else if (w === "SELL" && prev !== "SELL" && openBuy) {
      const gain = ((prices[i] - openBuy.price) / openBuy.price) * 100;
      const bh = ((prices[i] - prices[0]) / prices[0]) * 100;
      trades.push({
        lot: `${((lotNum - 1) % 3) + 1}/3`,
        buyDate: dates[openBuy.idx],
        buyPrice: +openBuy.price.toFixed(2),
        sellDate: dates[i],
        sellPrice: +prices[i].toFixed(2),
        status: "Closed",
        signalGain: +gain.toFixed(2),
        bh: +bh.toFixed(2),
      });
      openBuy = null;
    }
  }

  if (openBuy) {
    const last = prices.length - 1;
    const gain = ((prices[last] - openBuy.price) / openBuy.price) * 100;
    const bh = ((prices[last] - prices[0]) / prices[0]) * 100;
    trades.push({
      lot: `${((lotNum - 1) % 3) + 1}/3`,
      buyDate: dates[openBuy.idx],
      buyPrice: +openBuy.price.toFixed(2),
      sellDate: null,
      sellPrice: null,
      status: "Open",
      signalGain: +gain.toFixed(2),
      bh: +bh.toFixed(2),
    });
  }

  return trades;
}

export function generateMockSignal(spec: (typeof TICKERS)[number], seed: number, days = 180): Signal {
  const dates = generateDates(days);
  const prices = generateSeries(seed, days, spec.basePrice, spec.trend, spec.vol);
  const ema12s = calcEMA(prices, 12);
  const ema26s = calcEMA(prices, 26);
  const ema55s = calcEMA(prices, 55);
  const waves = detectWaveStages(prices, ema12s, ema26s, ema55s);

  const last = prices.length - 1;
  const price = prices[last];
  const ema12 = ema12s[last];
  const ema26 = ema26s[last];
  const ema55 = ema55s[last];
  const zone = getCDCZone(price, ema12, ema26);
  const wave = waves[last];

  let action: Action = "WAIT";
  if (wave === "W1" || wave === "W3") action = "BUY";
  else if (wave === "SELL") action = "SELL";
  else if (wave === "W2") action = "WATCH";
  else if (wave === "HOLD" && ema12 > ema26) action = "WATCH";

  const trades = buildTrades(dates, prices, waves);
  const signalGain = trades.reduce((s, t) => s + t.signalGain, 0);
  const wavePhase = calcWavePhase(prices, waves);

  // chronos mock
  const volatility = spec.vol * 100;
  const upside = +(((spec.basePrice * (1 + spec.vol * 1.5)) / price - 1) * 100).toFixed(2);
  const downside = +(((spec.basePrice * (1 - spec.vol * 1.5)) / price - 1) * 100).toFixed(2);
  const chronosDir = action === "BUY" ? "BUY" : action === "SELL" ? "SELL" : "HOLD";
  const conf: Confidence = volatility < 2 ? "HIGH" : volatility < 3 ? "MEDIUM" : "LOW";

  return {
    ticker: spec.ticker,
    name: spec.name,
    date: dates[last],
    price,
    ema12,
    ema26,
    ema55,
    zone,
    zone_label: ZONE_LABELS[zone] ?? "Neutral",
    wave,
    action,
    score: Math.round(50 + Math.random() * 50),
    confidence: conf,
    lot_size_pct: action === "BUY" ? 90 : action === "WATCH" ? 50 : 30,
    cdc_agree: chronosDir === action || (chronosDir === "BUY" && action === "WATCH"),
    chronos_direction: chronosDir,
    chronos_confidence: conf,
    p10: +(price * (1 - spec.vol * 1.8)).toFixed(2),
    p50: +(price * (1 + spec.trend * 30)).toFixed(2),
    p90: +(price * (1 + spec.vol * 1.8)).toFixed(2),
    upside_pct: upside,
    downside_pct: downside,
    vol_spike: spec.vol > 0.025,
    volatility_pct: +volatility.toFixed(2),
    cross_in_days: null,
    dates,
    prices,
    ema12s,
    ema26s,
    ema55s,
    waves,
    volumes: prices.map(() => Math.round(1e6 + Math.random() * 5e6)),
    trades,
    signalGain: +signalGain.toFixed(2),
    wavePhase,
  };
}

export function getMockSignals(tickers?: string[]): Signal[] {
  const filtered = tickers && tickers.length
    ? TICKERS.filter((t) => tickers.includes(t.ticker))
    : TICKERS;
  return filtered.map((spec, i) => generateMockSignal(spec, (i + 1) * 7919));
}

export function getMockSignal(ticker: string): Signal | null {
  const idx = TICKERS.findIndex((t) => t.ticker === ticker);
  if (idx < 0) return null;
  return generateMockSignal(TICKERS[idx], (idx + 1) * 7919);
}

export const DEFAULT_TICKERS = DEFAULT_WATCHLIST;
