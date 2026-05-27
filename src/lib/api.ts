import type { Signal } from "./types";
import { getBaseUrl, getWatchlist } from "./storage";
import { fetchYahooBar, fetchYahooBars } from "./yahoo.functions";
import { buildSignalFromBar } from "./buildSignal";

export async function fetchSignals(): Promise<Signal[]> {
  const base = getBaseUrl();
  const tickers = getWatchlist();
  if (base) {
    const res = await fetch(`${base}/signals?tickers=${tickers.join(",")}&filter=all`);
    if (!res.ok) throw new Error(`API ${res.status}`);
    return (await res.json()) as Signal[];
  }
  const bars = await fetchYahooBars({ data: { tickers } });
  return bars.map(buildSignalFromBar);
}

export async function fetchSignal(ticker: string): Promise<Signal | null> {
  const base = getBaseUrl();
  if (base) {
    const res = await fetch(`${base}/signal/${ticker}`);
    if (!res.ok) throw new Error(`API ${res.status}`);
    return (await res.json()) as Signal;
  }
  const bar = await fetchYahooBar({ data: { ticker } });
  return bar ? buildSignalFromBar(bar) : null;
}
