import type { Signal } from "./types";
import { getBaseUrl, getWatchlist } from "./storage";
import { getMockSignal, getMockSignals } from "./mockData";
import { fetchYahooBar, fetchYahooBars } from "./yahoo.functions";
import { buildSignalFromBar } from "./buildSignal";

export async function fetchSignals(): Promise<Signal[]> {
  const base = getBaseUrl();
  const tickers = getWatchlist();
  if (base) {
    try {
      const res = await fetch(`${base}/signals?tickers=${tickers.join(",")}&filter=all`);
      if (!res.ok) throw new Error("bad status");
      return (await res.json()) as Signal[];
    } catch {
      // fall through to Yahoo
    }
  }
  try {
    const bars = await fetchYahooBars({ data: { tickers } });
    if (bars.length) return bars.map(buildSignalFromBar);
  } catch {
    // fall through
  }
  return getMockSignals(tickers);
}

export async function fetchSignal(ticker: string): Promise<Signal | null> {
  const base = getBaseUrl();
  if (base) {
    try {
      const res = await fetch(`${base}/signal/${ticker}`);
      if (!res.ok) throw new Error("bad status");
      return (await res.json()) as Signal;
    } catch {
      // fall through
    }
  }
  try {
    const bar = await fetchYahooBar({ data: { ticker } });
    if (bar) return buildSignalFromBar(bar);
  } catch {
    // fall through
  }
  return getMockSignal(ticker);
}
