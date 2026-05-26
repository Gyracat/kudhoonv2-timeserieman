import { createServerFn } from "@tanstack/react-start";

export type YahooBar = {
  ticker: string;
  name: string;
  dates: string[];
  prices: number[];
  volumes: number[];
};

async function fetchYahoo(ticker: string, range = "1y", interval = "1d"): Promise<YahooBar | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker,
  )}?range=${range}&interval=${interval}&includePrePost=false&events=div%2Csplit`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      Accept: "application/json",
    },
  });
  if (!res.ok) return null;
  const json: any = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) return null;
  const timestamps: number[] = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0] ?? {};
  const closes: (number | null)[] = quote.close ?? [];
  const volumes: (number | null)[] = quote.volume ?? [];
  const meta = result.meta ?? {};

  const dates: string[] = [];
  const prices: number[] = [];
  const vols: number[] = [];
  let last = 0;
  for (let i = 0; i < timestamps.length; i++) {
    const c = closes[i];
    if (c == null) continue;
    last = c;
    dates.push(new Date(timestamps[i] * 1000).toISOString().slice(0, 10));
    prices.push(+c.toFixed(2));
    vols.push(Math.max(0, Math.round(volumes[i] ?? 0)));
  }
  if (!prices.length) return null;
  return {
    ticker: meta.symbol ?? ticker,
    name: meta.longName ?? meta.shortName ?? ticker,
    dates,
    prices,
    volumes: vols,
  };
}

export const fetchYahooBars = createServerFn({ method: "GET" })
  .inputValidator((d: { tickers: string[]; range?: string; interval?: string }) => d)
  .handler(async ({ data }) => {
    const range = data.range ?? "1y";
    const interval = data.interval ?? "1d";
    const results = await Promise.all(
      data.tickers.map((t) => fetchYahoo(t, range, interval).catch(() => null)),
    );
    return results.filter((r): r is YahooBar => !!r);
  });

export const fetchYahooBar = createServerFn({ method: "GET" })
  .inputValidator((d: { ticker: string; range?: string; interval?: string }) => d)
  .handler(async ({ data }) => {
    return await fetchYahoo(data.ticker, data.range ?? "1y", data.interval ?? "1d");
  });
