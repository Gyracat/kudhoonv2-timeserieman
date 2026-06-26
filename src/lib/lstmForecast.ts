/**
 * lstmForecast.ts — TensorFlow.js LSTM time series model
 * รัน ML จริงใน browser — ไม่ต้องมี Python/Railway
 *
 * วิธีใช้:
 *   import { lstmForecast } from "@/lib/lstmForecast"
 *   const result = await lstmForecast(prices)
 *
 * NOTE: train ครั้งแรก ~10-30 วิ/หุ้น แล้ว cache ไว้
 */

// โหลด TensorFlow.js จาก CDN แบบ lazy (ไม่ถ่วง bundle หลัก)
let tfPromise: Promise<any> | null = null;

function loadTF(): Promise<any> {
  if (tfPromise) return tfPromise;
  tfPromise = new Promise((resolve, reject) => {
    // ถ้าโหลดแล้ว
    if ((window as any).tf) {
      resolve((window as any).tf);
      return;
    }
    const script = document.createElement("script");
    script.src =
      "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js";
    script.onload = () => resolve((window as any).tf);
    script.onerror = () => reject(new Error("Failed to load TensorFlow.js"));
    document.head.appendChild(script);
  });
  return tfPromise;
}

export type LSTMResult = {
  direction: "BUY" | "SELL" | "WAIT";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  p10: number;
  p50: number;
  p90: number;
  upside_pct: number;
  downside_pct: number;
  volatility_pct: number;
  predicted_prices: number[]; // 10 วันข้างหน้า
  model: "lstm";
};

// ── Cache: ไม่ train ซ้ำสำหรับ ticker เดียวกันใน session ──
const cache = new Map<string, LSTMResult>();

function cacheKey(prices: number[]): string {
  // ใช้ราคาล่าสุด 3 ตัว + length เป็น key
  const last3 = prices.slice(-3).map((p) => p.toFixed(2)).join(",");
  return `${prices.length}:${last3}`;
}

// ── Normalize / denormalize ────────────────────────────────
function normalize(data: number[]): { norm: number[]; min: number; max: number } {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  return { norm: data.map((x) => (x - min) / range), min, max };
}

function denormalize(x: number, min: number, max: number): number {
  return x * (max - min) + min;
}

// ── สร้าง sliding window dataset ───────────────────────────
function makeWindows(data: number[], windowSize: number) {
  const X: number[][] = [];
  const y: number[] = [];
  for (let i = 0; i < data.length - windowSize; i++) {
    X.push(data.slice(i, i + windowSize));
    y.push(data[i + windowSize]);
  }
  return { X, y };
}

/**
 * Train LSTM + ทำนาย 10 วันข้างหน้า
 */
export async function lstmForecast(
  prices: number[],
  opts: { windowSize?: number; horizon?: number; epochs?: number } = {},
): Promise<LSTMResult> {
  const windowSize = opts.windowSize ?? 20;
  const horizon = opts.horizon ?? 10;
  const epochs = opts.epochs ?? 30;

  // ใช้ cache ถ้ามี
  const key = cacheKey(prices);
  if (cache.has(key)) return cache.get(key)!;

  // ต้องมีข้อมูลพอ
  if (prices.length < windowSize + 30) {
    return fallbackForecast(prices);
  }

  const tf = await loadTF();
  const current = prices[prices.length - 1];

  // ใช้แค่ 1 ปีล่าสุด (เร็วขึ้น + relevant กว่า)
  const recent = prices.slice(-252);
  const { norm, min, max } = normalize(recent);
  const { X, y } = makeWindows(norm, windowSize);

  // สร้าง tensors
  const xs = tf.tensor3d(
    X.map((w) => w.map((v) => [v])),
    [X.length, windowSize, 1],
  );
  const ys = tf.tensor2d(y, [y.length, 1]);

  // ── สร้าง LSTM model ─────────────────────────────────────
  const model = tf.sequential();
  model.add(
    tf.layers.lstm({
      units: 32,
      inputShape: [windowSize, 1],
      returnSequences: false,
    }),
  );
  model.add(tf.layers.dropout({ rate: 0.2 }));
  model.add(tf.layers.dense({ units: 1 }));

  model.compile({
    optimizer: tf.train.adam(0.01),
    loss: "meanSquaredError",
  });

  // ── Train ────────────────────────────────────────────────
  await model.fit(xs, ys, {
    epochs,
    batchSize: 32,
    shuffle: true,
    verbose: 0,
  });

  // ── Predict 10 วันข้างหน้า (autoregressive) ──────────────
  let window = norm.slice(-windowSize);
  const predsNorm: number[] = [];
  const residuals: number[] = [];

  // เก็บ training residuals สำหรับ quantile
  const trainPred = model.predict(xs) as any;
  const trainPredArr = (await trainPred.data()) as Float32Array;
  for (let i = 0; i < y.length; i++) {
    residuals.push(y[i] - trainPredArr[i]);
  }
  trainPred.dispose();

  for (let h = 0; h < horizon; h++) {
    const input = tf.tensor3d([window.map((v) => [v])], [1, windowSize, 1]);
    const pred = model.predict(input) as any;
    const val = (await pred.data())[0];
    predsNorm.push(val);
    window = [...window.slice(1), val];
    input.dispose();
    pred.dispose();
  }

  // ── Quantile จาก residual distribution (historical) ──────
  // ไม่สมมติ Gaussian — ใช้ residual จริงจาก training
  residuals.sort((a, b) => a - b);
  const q = (p: number) => {
    const idx = Math.floor(p * (residuals.length - 1));
    return residuals[idx];
  };
  const r10 = q(0.1);
  const r90 = q(0.9);

  // denormalize predictions
  const predictedPrices = predsNorm.map((v) => denormalize(v, min, max));
  const meanPred = predictedPrices.reduce((s, x) => s + x, 0) / horizon;

  // P50 = median prediction, P10/P90 = + residual quantiles
  const lastPredNorm = predsNorm[predsNorm.length - 1];
  const p50 = denormalize(lastPredNorm, min, max);
  const p10 = denormalize(lastPredNorm + r10, min, max);
  const p90 = denormalize(lastPredNorm + r90, min, max);

  // volatility จาก residual spread
  const volPct = ((r90 - r10) / 2) * (max - min) / current * 100;

  // ── Direction logic (เหมือน Chronos) ─────────────────────
  let direction: "BUY" | "SELL" | "WAIT";
  let confidence: "HIGH" | "MEDIUM" | "LOW";

  if (p10 > current) {
    direction = "BUY";
    confidence = "HIGH"; // worst case ยังขึ้น
  } else if (p90 < current) {
    direction = "SELL";
    confidence = "HIGH"; // best case ยังลง
  } else if (meanPred > current * 1.02) {
    direction = "BUY";
    confidence = "MEDIUM";
  } else if (meanPred < current * 0.98) {
    direction = "SELL";
    confidence = "MEDIUM";
  } else {
    direction = "WAIT";
    confidence = "LOW";
  }

  // cleanup tensors
  xs.dispose();
  ys.dispose();
  model.dispose();

  const result: LSTMResult = {
    direction,
    confidence,
    p10: +p10.toFixed(2),
    p50: +p50.toFixed(2),
    p90: +p90.toFixed(2),
    upside_pct: +(((p90 - current) / current) * 100).toFixed(2),
    downside_pct: +(((current - p10) / current) * 100).toFixed(2),
    volatility_pct: +Math.abs(volPct).toFixed(2),
    predicted_prices: predictedPrices.map((p) => +p.toFixed(2)),
    model: "lstm",
  };

  cache.set(key, result);
  return result;
}

// ── Fallback ถ้าข้อมูลน้อยเกินไป ──────────────────────────
function fallbackForecast(prices: number[]): LSTMResult {
  const current = prices[prices.length - 1];
  const rets: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    rets.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  const mean = rets.reduce((s, x) => s + x, 0) / Math.max(1, rets.length);
  const variance =
    rets.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, rets.length);
  const vol = Math.sqrt(variance);

  const p50 = current * (1 + mean * 10);
  const p10 = current * (1 - vol * 2);
  const p90 = current * (1 + vol * 2);

  let direction: "BUY" | "SELL" | "WAIT" = "WAIT";
  if (mean > 0.002) direction = "BUY";
  else if (mean < -0.002) direction = "SELL";

  return {
    direction,
    confidence: "LOW",
    p10: +p10.toFixed(2),
    p50: +p50.toFixed(2),
    p90: +p90.toFixed(2),
    upside_pct: +(((p90 - current) / current) * 100).toFixed(2),
    downside_pct: +(((current - p10) / current) * 100).toFixed(2),
    volatility_pct: +(vol * 100).toFixed(2),
    predicted_prices: [],
    model: "lstm",
  };
}
