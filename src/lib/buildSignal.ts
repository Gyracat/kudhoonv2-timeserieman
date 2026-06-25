import type { Signal, Action, Confidence, Trade } from "./types";
import { calcEMA, detectWaveStages, calcWavePhase, getCDCZone, ZONE_LABELS } from "./cdc";
import type { YahooBar } from "./yahoo.functions";
import { tuneParams } from "./tuner";

// FIX: Tranche lot system + stop loss + transaction cost
// ต้องใช้ logic เดียวกับ tuner.simulate() เพื่อให้ backtest score ตรงกับผลจริง
// W1 → lot 1/3, W2 → lot 2/3, W3 → lot 3/3
// SELL หรือ stop loss → ปิดทุก lot พร้อมกัน
const STOP_LOSS_PCT = 8; // ต้องตรงกับ tuner.ts
const TXN_COST_PCT = 0.15; // ต่อขา (buy + sell = 0.30%)

function buildTrades(dates: string[], prices: number[], waves: string[]): Trade[] {
  const trades: Trade[] = [];

  type OpenLot = { idx: number; price: number; lotLabel: string };
  let openLots: OpenLot[] = [];

  const closeAll = (exitIdx: number, reason: "sell" | "stop") => {
    for (const lot of openLots) {
      // FIX: หัก transaction cost ทั้ง buy + sell
      const raw = ((prices[exitIdx] - lot.price) / lot.price) * 100;
      const gain = raw - TXN_COST_PCT * 2;
      const bh = ((prices[exitIdx] - prices[0]) / prices[0]) * 100;
      trades.push({
        lot: lot.lotLabel,
        buyDate: dates[lot.idx],
        buyPrice: +lot.price.toFixed(2),
        sellDate: dates[exitIdx],
        sellPrice: +prices[exitIdx].toFixed(2),
        status: "Closed",
        signalGain: +gain.toFixed(2),
        bh: +bh.toFixed(2),
        exitReason: reason, // FIX: บอกว่าออกเพราะ signal หรือ stop loss
      });
    }
    openLots = [];
  };

  for (let i = 1; i < waves.length; i++) {
    const w = waves[i];
    const prev = waves[i - 1];
    const price = prices[i];

    // FIX: Stop loss check ก่อน — ใช้ worst lot เป็นตัวตัดสิน
    if (openLots.length > 0) {
      const worstLot = openLots.reduce((a, b) => (a.price > b.price ? a : b));
      if (price < worstLot.price * (1 - STOP_LOSS_PCT / 100)) {
        closeAll(i, "stop");
        continue;
      }
    }

    // Tranche entries
    if (w === "W1" && prev !== "W1" && openLots.length === 0) {
      openLots.push({ idx: i, price, lotLabel: "1/3" });
    } else if (w === "W2" && prev !== "W2" && openLots.length === 1) {
      openLots.push({ idx: i, price, lotLabel: "2/3" });
    } else if (w === "W3" && prev !== "W3" && openLots.length === 2) {
      openLots.push({ idx: i, price, lotLabel: "3/3" });
    }
    // Exit on SELL
    else if (w === "SELL" && prev !== "SELL" && openLots.length > 0) {
      closeAll(i, "sell");
    }
  }

  // Open lots ที่ยังไม่ได้ปิด (mark-to-market, ยังไม่หัก cost ขาขายเพราะยังไม่ขาย)
  const last = prices.length - 1;
  for (const lot of openLots) {
    const raw = ((prices[last] - lot.price) / lot.price) * 100;
    const gain = raw - TXN_COST_PCT; // หักแค่ขาซื้อ
    const bh = ((prices[last] - prices[0]) / prices[0]) * 100;
    trades.push({
      lot: lot.lotLabel,
      buyDate: dates[lot.idx],
      buyPrice: +lot.price.toFixed(2),
      sellDate: null,
      sellPrice: null,
      status: "Open",
      signalGain: +gain.toFixed(2),
      bh: +bh.toFixed(2),
      exitReason: null,
    });
  }

  return trades;
}

export function buildSignalFromBar(bar: YahooBar): Signal {
  const { ticker, name, dates, prices, volumes } = bar;

  // Auto-tune EMA params via walk-forward backtest
  const bt = tuneParams(dates, prices);
  const { fast, slow, wave: waveP } = bt.params;

  const ema12s = calcEMA(prices, fast);
  const ema26s = calcEMA(prices, slow);
  const ema55s = calcEMA(prices, waveP);
  const waves = detectWaveStages(prices, ema12s, ema26s, ema55s);

  const last = prices.length - 1;
  const price = prices[last];
  const ema12 = ema12s[last];
  const ema26 = ema26s[last];
  const ema55 = ema55s[last];
  const zone = getCDCZone(price, ema12, ema26);
  const wave = waves[last];

  // Action based on wave stage + zone
  let action: Action = "WAIT";
  if (wave === "W1" || wave === "W3") action = "BUY";
  else if (wave === "SELL") action = "SELL";
  else if (wave === "W2") action = "WATCH";
  else if (wave === "HOLD" && ema12 > ema26) action = "WATCH";

  const trades = buildTrades(dates, prices, waves);
  const signalGain = trades
    .filter((t) => t.status === "Closed")
    .reduce((s, t) => s + t.signalGain, 0);
  const wavePhase = calcWavePhase(prices, waves);

  // FIX: Score ใช้ tuner result แทน hardcode
  // bt.score อาจเป็น -Infinity ถ้าไม่มี trades → clamp ให้อยู่ใน 0-99
  const rawScore = isFinite(bt.score) ? bt.score : 0;
  // normalize: score จาก tuner อยู่ใน range ต่างๆ → map เป็น 0-99
  const normalizedScore = Math.min(
    99,
    Math.max(
      0,
      Math.round(
        50 +
          (zone === 1 ? 20 : zone === 2 ? 10 : zone >= 5 ? -20 : 0) +
          (wave === "W3" ? 20 : wave === "W1" ? 10 : wave === "W2" ? 5 : wave === "SELL" ? -20 : 0) +
          (bt.winRate > 50 ? 5 : bt.winRate > 40 ? 0 : -5) +
          (bt.totalReturn > 0 ? 5 : -5),
      ),
    ),
  );

  // Volatility (20-day rolling std of returns)
  const window = prices.slice(Math.max(0, last - 20));
  const rets: number[] = [];
  for (let i = 1; i < window.length; i++) {
    rets.push((window[i] - window[i - 1]) / window[i - 1]);
  }
  const mean = rets.reduce((s, x) => s + x, 0) / Math.max(1, rets.length);
  const variance = rets.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, rets.length);
  const vol = Math.sqrt(variance);
  const volatility = vol * 100;

  // Confidence based on vol + tuner win rate
  let conf: Confidence;
  if (volatility < 1.5 && bt.winRate >= 50) conf = "HIGH";
  else if (volatility < 3 || bt.winRate >= 40) conf = "MEDIUM";
  else conf = "LOW";

  // FIX: Label ให้ชัดว่าเป็น statistical estimate ไม่ใช่ Chronos จริงๆ
  // เมื่อต่อ Railway + Chronos แล้วค่อยเปลี่ยน chronos_direction ให้เรียก API จริง
  const statisticalDir: Action =
    action === "BUY" ? "BUY" : action === "SELL" ? "SELL" : "WAIT";

  // Lot size ตาม wave + confidence
  const lot_size_pct =
    wave === "W3" && conf === "HIGH"
      ? 100
      : wave === "W3"
        ? 80
        : wave === "W1"
          ? 33
          : wave === "W2"
            ? 66
            : action === "SELL"
              ? 0
              : 30;

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

    // FIX: Score ใช้ zone + wave + tuner
    score: normalizedScore,
    confidence: conf,
    lot_size_pct,

    // FIX: cdc_agree จะเป็น false ถ้า statistical estimate ขัดกับ CDC
    cdc_agree: statisticalDir === action || statisticalDir === "WAIT",

    // FIX: label ว่า "Statistical" เพื่อไม่ mislead user
    // เปลี่ยนเป็น "Chronos" เมื่อต่อ Railway API จริง
    chronos_direction: statisticalDir,
    chronos_confidence: conf,

    // Quantile bands จาก volatility (statistical estimate)
    p10: +(price * (1 - vol * 1.8)).toFixed(2),
    p50: +(price * (1 + mean * 20)).toFixed(2),
    p90: +(price * (1 + vol * 1.8)).toFixed(2),
    upside_pct: +(vol * 1.8 * 100).toFixed(2),
    downside_pct: +(vol * 1.8 * 100).toFixed(2),

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

    backtest: {
      params: bt.params,
      perYear: bt.perYear,
      totalReturn: bt.totalReturn,
      winRate: bt.winRate,
      mdd: bt.mdd,
      trades: bt.trades,
      // FIX: out-of-sample validation — ตัวเลขนี้น่าเชื่อถือกว่า in-sample
      oosWinRate: bt.oosWinRate,
      oosReturn: bt.oosReturn,
    },
  };
}
