import type { Signal, Action, Confidence, Trade } from "./types";
import { calcEMA, detectWaveStages, calcWavePhase, getCDCZone, ZONE_LABELS } from "./cdc";
import type { YahooBar } from "./yahoo.functions";

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

export function buildSignalFromBar(bar: YahooBar): Signal {
  const { ticker, name, dates, prices, volumes } = bar;
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

  // volatility = stdev of last 20 daily returns * 100
  const window = prices.slice(Math.max(0, last - 20));
  const rets: number[] = [];
  for (let i = 1; i < window.length; i++) rets.push((window[i] - window[i - 1]) / window[i - 1]);
  const mean = rets.reduce((s, x) => s + x, 0) / Math.max(1, rets.length);
  const variance =
    rets.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, rets.length);
  const vol = Math.sqrt(variance);
  const volatility = vol * 100;
  const conf: Confidence = volatility < 1.5 ? "HIGH" : volatility < 3 ? "MEDIUM" : "LOW";
  const chronosDir = action === "BUY" ? "BUY" : action === "SELL" ? "SELL" : "HOLD";

  const upside = +(((price * (1 + vol * 1.8)) / price - 1) * 100).toFixed(2);
  const downside = +(((price * (1 - vol * 1.8)) / price - 1) * 100).toFixed(2);

  return {
    ticker,
    name,
    date: dates[last],
    price,
    ema12,
    ema26,
    ema55,
    zone,
    zone_label: ZONE_LABELS[zone] ?? "Neutral",
    wave,
    action,
    score: Math.min(99, Math.round(50 + (price > ema55 ? 25 : -10) + (ema12 > ema26 ? 15 : -10))),
    confidence: conf,
    lot_size_pct: action === "BUY" ? 90 : action === "WATCH" ? 50 : 30,
    cdc_agree: chronosDir === action || (chronosDir === "BUY" && action === "WATCH"),
    chronos_direction: chronosDir,
    chronos_confidence: conf,
    p10: +(price * (1 - vol * 1.8)).toFixed(2),
    p50: +(price * (1 + mean * 20)).toFixed(2),
    p90: +(price * (1 + vol * 1.8)).toFixed(2),
    upside_pct: upside,
    downside_pct: downside,
    vol_spike: vol > 0.025,
    volatility_pct: +volatility.toFixed(2),
    cross_in_days: null,
    dates,
    prices,
    ema12s,
    ema26s,
    ema55s,
    waves,
    volumes,
    trades,
    signalGain: +signalGain.toFixed(2),
    wavePhase,
  };
}
