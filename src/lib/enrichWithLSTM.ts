/**
 * enrichWithLSTM.ts — เติม LSTM forecast เข้า signal
 * เรียกหลัง buildSignalFromBar เสร็จ (เพราะ LSTM เป็น async)
 *
 * วิธีใช้ใน component:
 *   const signal = buildSignalFromBar(bar)
 *   const enriched = await enrichWithLSTM(signal)
 */
import type { Signal } from "./types";
import { lstmForecast } from "./lstmForecast";

export async function enrichWithLSTM(signal: Signal): Promise<Signal> {
  try {
    const lstm = await lstmForecast(signal.prices);

    // คำนวณ score ใหม่รวม LSTM direction
    const confPts: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 0 };
    const isSell = signal.zone >= 5;

    let score: number;
    let cdcAgree: boolean;
    let action = signal.action;

    if (isSell) {
      score = signal.zone === 6 ? 3 : 2;
      score += signal.vol_spike ? 2 : 0;
      score +=
        lstm.direction === "SELL"
          ? confPts[lstm.confidence]
          : lstm.direction === "BUY"
            ? -2
            : 0;
      cdcAgree = lstm.direction !== "BUY";
      if (!cdcAgree) action = "WAIT";
    } else {
      score = (signal.zone === 1 ? 3 : 0) + (signal.wave === "W3" ? 3 : 0);
      score += signal.lot_size_pct >= 90 ? 1 : 0;
      score +=
        lstm.direction === "BUY"
          ? confPts[lstm.confidence]
          : lstm.direction === "SELL"
            ? -2
            : 0;
      cdcAgree = lstm.direction !== "SELL";
      if (!cdcAgree) action = "WAIT";
    }

    const confidence =
      score >= 7 ? "HIGH" : score >= 4 ? "MEDIUM" : "LOW";

    return {
      ...signal,
      action,
      score: Math.min(99, Math.max(0, score * 10)),
      confidence,
      cdc_agree: cdcAgree,
      chronos_direction: lstm.direction,
      chronos_confidence: lstm.confidence,
      p10: lstm.p10,
      p50: lstm.p50,
      p90: lstm.p90,
      upside_pct: lstm.upside_pct,
      downside_pct: lstm.downside_pct,
      volatility_pct: lstm.volatility_pct,
      // FIX: flag บอกว่าเป็น LSTM ML จริง
      is_real_chronos: true,
      forecast_model: "lstm",
    } as Signal;
  } catch (e) {
    console.error("LSTM forecast failed:", e);
    // ถ้า LSTM พัง ใช้ signal เดิม (statistical)
    return signal;
  }
}
