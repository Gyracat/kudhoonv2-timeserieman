import type { Signal } from "./types";
import { getBaseUrl, getWatchlist } from "./storage";
import { getMockSignal, getMockSignals } from "./mockData";

export async function fetchSignals(): Promise<Signal[]> {
  const base = getBaseUrl();
  const tickers = getWatchlist();
  if (!base) {
    return getMockSignals(tickers);
  }
  try {
    const res = await fetch(`${base}/signals?tickers=${tickers.join(",")}&filter=all`);
    if (!res.ok) throw new Error("bad status");
    return (await res.json()) as Signal[];
  } catch {
    return getMockSignals(tickers);
  }
}

export async function fetchSignal(ticker: string): Promise<Signal | null> {
  const base = getBaseUrl();
  if (!base) return getMockSignal(ticker);
  try {
    const res = await fetch(`${base}/signal/${ticker}`);
    if (!res.ok) throw new Error("bad status");
    return (await res.json()) as Signal;
  } catch {
    return getMockSignal(ticker);
  }
}
