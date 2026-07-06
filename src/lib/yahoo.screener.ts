import { createServerFn } from "@tanstack/react-start";

/**
 * yahoo.screener.ts — ดึงหุ้นจริงจาก Yahoo Screener API
 * ไม่ hardcode — query แบบ dynamic ตาม criteria
 *
 * Yahoo screener endpoint:
 *   https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved
 *   หรือ POST /v1/finance/screener สำหรับ custom query
 */

export type ScreenerHit = {
  symbol: string;
  name: string;
  price: number;
  change_pct: number;
  volume: number;
  market_cap: number;
};

// Predefined screeners ที่ Yahoo มีให้ (ดึงจริงทุกครั้ง ไม่ใช่ hardcode รายชื่อ)
export type ScreenerType =
  | "most_actives" // หุ้น volume สูงสุด
  | "day_gainers" // ขึ้นมากสุดวันนี้
  | "day_losers" // ลงมากสุดวันนี้
  | "growth_technology_stocks" // tech เติบโต
  | "undervalued_large_caps" // large cap ราคาถูก
  | "aggressive_small_caps" // small cap
  | "small_cap_gainers";

/**
 * ดึงหุ้นจาก Yahoo predefined screener
 * count: จำนวนหุ้นที่ต้องการ (max 250)
 */
async function fetchScreener(
  scrId: ScreenerType,
  count = 50,
  region = "us",
): Promise<ScreenerHit[]> {
  // Yahoo predefined screener endpoint
  const url = `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?formatted=false&scrIds=${scrId}&count=${count}&region=${region}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      Accept: "application/json",
    },
  });

  if (!res.ok) return [];
  const json: any = await res.json();
  const quotes: any[] = json?.finance?.result?.[0]?.quotes ?? [];

  return quotes
    .filter((q) => q.symbol)
    .map((q) => ({
      symbol: q.symbol,
      name: q.shortName ?? q.longName ?? q.symbol,
      price: q.regularMarketPrice ?? 0,
      change_pct: q.regularMarketChangePercent ?? 0,
      volume: q.regularMarketVolume ?? 0,
      market_cap: q.marketCap ?? 0,
    }));
}

/**
 * ทุก region ที่ Yahoo Finance screener รองรับ (2026)
 * ครอบคลุมอเมริกา / ยุโรป / เอเชีย / โอเชียเนีย / ตะวันออกกลาง / แอฟริกา
 */
const ALL_REGIONS = [
  "us", "ca", "mx", "br", "ar", "cl", "pe", "ve",
  "gb", "de", "fr", "it", "es", "nl", "be", "ch", "at", "se", "no", "dk", "fi", "ie", "pt", "gr", "pl", "cz", "hu", "ro", "tr", "ru",
  "jp", "cn", "hk", "tw", "kr", "sg", "th", "my", "id", "ph", "vn", "in", "pk", "lk",
  "au", "nz",
  "il", "sa", "qa", "ae", "kw", "eg", "za",
];

/**
 * Custom screener ด้วย POST + pagination
 * quoteType: EQUITY / ETF / MUTUALFUND
 */
async function fetchCustomScreener(
  regions: string[],
  count = 250,
  quoteType: "EQUITY" | "ETF" | "MUTUALFUND" = "EQUITY",
  minMarketCap = 100_000_000,
  minVolume = 50_000,
): Promise<ScreenerHit[]> {
  const url = `https://query1.finance.yahoo.com/v1/finance/screener?formatted=false&lang=en-US&region=US`;
  const PAGE = 250;
  const hits: ScreenerHit[] = [];
  const seen = new Set<string>();

  for (let offset = 0; offset < count; offset += PAGE) {
    const size = Math.min(PAGE, count - offset);
    const operands: any[] = [
      {
        operator: "or",
        operands: regions.map((r) => ({ operator: "EQ", operands: ["region", r] })),
      },
    ];
    if (quoteType === "EQUITY") {
      operands.push({ operator: "GT", operands: ["intradaymarketcap", minMarketCap] });
    }
    operands.push({ operator: "GT", operands: ["dayvolume", minVolume] });

    const body = {
      size,
      offset,
      sortField: "dayvolume",
      sortType: "DESC",
      quoteType,
      query: { operator: "AND", operands },
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    }).catch(() => null);

    if (!res || !res.ok) break;
    const json: any = await res.json().catch(() => null);
    const quotes: any[] = json?.finance?.result?.[0]?.quotes ?? [];
    if (quotes.length === 0) break;

    for (const q of quotes) {
      if (!q.symbol || seen.has(q.symbol)) continue;
      seen.add(q.symbol);
      hits.push({
        symbol: q.symbol,
        name: q.shortName ?? q.longName ?? q.symbol,
        price: q.regularMarketPrice ?? 0,
        change_pct: q.regularMarketChangePercent ?? 0,
        volume: q.regularMarketVolume ?? 0,
        market_cap: q.marketCap ?? 0,
      });
    }
    if (quotes.length < size) break;
  }

  return hits;
}

async function fetchCrypto(count = 100): Promise<ScreenerHit[]> {
  return fetchScreener("all_cryptocurrencies_us" as ScreenerType, count).catch(() => []);
}

/**
 * Server function — ดึง universe หุ้นจริงจาก Yahoo (ทั่วโลก + ทุก asset type)
 */
export const fetchScreenerUniverse = createServerFn({ method: "GET" })
  .inputValidator(
    (d: {
      type?: string;
      count?: number;
      regions?: string[];
      quoteType?: "EQUITY" | "ETF" | "MUTUALFUND";
    }) => d,
  )
  .handler(async ({ data }): Promise<ScreenerHit[]> => {
    const count = data.count ?? 50;

    if (data.quoteType === "ETF" || data.quoteType === "MUTUALFUND") {
      return fetchCustomScreener(
        data.regions && data.regions.length ? data.regions : ALL_REGIONS,
        count,
        data.quoteType,
      ).catch(() => []);
    }
    if (data.type === "crypto") {
      return fetchCrypto(count);
    }

    if (data.regions && data.regions.length > 0) {
      const hits = await fetchCustomScreener(data.regions, count, "EQUITY").catch(() => []);
      if (hits.length > 0) return hits;
    }

    if (data.type) {
      return fetchScreener(data.type as ScreenerType, count).catch(() => []);
    }

    // default (active): รวม most_actives + gainers + losers + global equities
    const [actives, gainers, losers, globalHits] = await Promise.all([
      fetchScreener("most_actives", count).catch(() => []),
      fetchScreener("day_gainers", count).catch(() => []),
      fetchScreener("day_losers", count).catch(() => []),
      fetchCustomScreener(ALL_REGIONS, count, "EQUITY").catch(() => []),
    ]);

    const seen = new Set<string>();
    const merged: ScreenerHit[] = [];
    for (const hit of [...actives, ...gainers, ...losers, ...globalHits]) {
      if (!seen.has(hit.symbol)) {
        seen.add(hit.symbol);
        merged.push(hit);
      }
    }
    return merged;
  });
