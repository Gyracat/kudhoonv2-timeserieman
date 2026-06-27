import type { Signal } from "./types";
import { getBaseUrl, getWatchlist } from "./storage";
import { fetchYahooBar, fetchYahooBars } from "./yahoo.functions";
import { buildSignalFromBar } from "./buildSignal";
import { enrichWithLSTM } from "./enrichWithLSTM";

export async function fetchSignals(): Promise<Signal[]> {
  const base = getBaseUrl();
  const tickers = getWatchlist();

  // ถ้ามี Railway URL → ใช้ Chronos จริงจาก backend
  if (base) {
    const res = await fetch(`${base}/signals?tickers=${tickers.join(",")}&filter=all`);
    if (!res.ok) throw new Error(`API ${res.status}`);
    return (await res.json()) as Signal[];
  }

  // ไม่มี Railway → build ใน browser
  // FIX: Dashboard ไม่ train LSTM (ช้าเกินไปถ้าทำทุกหุ้น)
  // LSTM จะ train เฉพาะตอนเปิด detail ของหุ้นนั้น (fetchSignal)
  const bars = await fetchYahooBars({ data: { tickers } });
  return bars.map(buildSignalFromBar);
}

export async function fetchSignal(ticker: string): Promise<Signal | null> {
  const base = getBaseUrl();

  // ถ้ามี Railway URL → Chronos จริง
  if (base) {
    const res = await fetch(`${base}/signal/${ticker}`);
    if (!res.ok) throw new Error(`API ${res.status}`);
    return (await res.json()) as Signal;
  }

  // ไม่มี Railway → build + LSTM
  const bar = await fetchYahooBar({ data: { ticker } });
  if (!bar) return null;
  const signal = buildSignalFromBar(bar);

  // FIX: เติม LSTM forecast (ML จริงใน browser)
  return enrichWithLSTM(signal);
}
