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
 * Custom screener ด้วย POST — query หุ้นตาม filter จริง
 * เช่น market cap > 1B, volume > 1M, ทั่วโลก
 */
async function fetchCustomScreener(
  region: string[],
  count = 100,
): Promise<ScreenerHit[]> {
  const url = `https://query1.finance.yahoo.com/v1/finance/screener?formatted=false&lang=en-US&region=US`;

  const body = {
    size: count,
    offset: 0,
    sortField: "dayvolume",
    sortType: "DESC",
    quoteType: "EQUITY",
    query: {
      operator: "AND",
      operands: [
        {
          operator: "or",
          operands: region.map((r) => ({
            operator: "EQ",
            operands: ["region", r],
          })),
        },
        {
          operator: "GT",
          operands: ["intradaymarketcap", 1000000000], // > 1B market cap
        },
        {
          operator: "GT",
          operands: ["dayvolume", 500000], // > 500k volume
        },
      ],
    },
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
 * Server function — ดึง universe หุ้นจริงจาก Yahoo
 * รวมหลาย screener เข้าด้วยกัน → ได้หุ้นที่เคลื่อนไหวจริงตอนนี้
 */
export const fetchScreenerUniverse = createServerFn({ method: "GET" })
  .inputValidator((d: { type?: string; count?: number; regions?: string[] }) => d)
  .handler(async ({ data }): Promise<ScreenerHit[]> => {
    const count = data.count ?? 50;

    // ถ้าระบุ regions → custom screener (ทั่วโลกจริง)
    if (data.regions && data.regions.length > 0) {
      const hits = await fetchCustomScreener(data.regions, count).catch(() => []);
      if (hits.length > 0) return hits;
    }

    // ถ้าระบุ type → predefined screener
    if (data.type) {
      return fetchScreener(data.type as ScreenerType, count).catch(() => []);
    }

    // default: รวม most_actives + gainers + losers → หุ้นที่ active จริง
    const [actives, gainers, losers] = await Promise.all([
      fetchScreener("most_actives", count).catch(() => []),
      fetchScreener("day_gainers", count).catch(() => []),
      fetchScreener("day_losers", count).catch(() => []),
    ]);

    // dedupe
    const seen = new Set<string>();
    const merged: ScreenerHit[] = [];
    for (const hit of [...actives, ...gainers, ...losers]) {
      if (!seen.has(hit.symbol)) {
        seen.add(hit.symbol);
        merged.push(hit);
      }
    }
    return merged;
  });
