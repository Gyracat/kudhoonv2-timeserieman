/**
 * globalScan.ts — Scan หุ้นทั่วโลกจริงจาก Yahoo Screener
 * ไม่ hardcode — ดึง universe แบบ dynamic
 */
import type { Signal } from "./types";
import { fetchYahooBars } from "./yahoo.functions";
import { fetchScreenerUniverse } from "./yahoo.screener";
import { buildSignalFromBar } from "./buildSignal";

export type ScanProgress = {
  phase: "universe" | "analyze";
  done: number;
  total: number;
  current: string;
};

export type ScanScope =
  | "active"      // most active + gainers + losers (default)
  | "gainers"     // วันนี้ขึ้นแรง
  | "losers"      // วันนี้ลงแรง
  | "tech"        // tech growth
  | "global";     // ทั่วโลกหลาย region

const SCOPE_CONFIG: Record<ScanScope, { type?: string; regions?: string[] }> = {
  active:  {},  // default merge
  gainers: { type: "day_gainers" },
  losers:  { type: "day_losers" },
  tech:    { type: "growth_technology_stocks" },
  global:  { regions: ["us", "gb", "de", "jp", "hk", "th", "sg", "in"] },
};

/**
 * Scan หุ้นจริงจาก Yahoo screener → วิเคราะห์ CDC
 */
export async function globalScan(
  scope: ScanScope = "active",
  count = 50,
  onProgress?: (p: ScanProgress) => void,
): Promise<Signal[]> {
  // ── Phase 1: ดึง universe จริงจาก Yahoo screener ──────────
  onProgress?.({ phase: "universe", done: 0, total: 1, current: "ดึงรายชื่อหุ้นจาก Yahoo..." });

  const cfg = SCOPE_CONFIG[scope];
  const hits = await fetchScreenerUniverse({
    data: { type: cfg.type, regions: cfg.regions, count },
  });

  const tickers = hits.map((h) => h.symbol);
  if (tickers.length === 0) return [];

  // ── Phase 2: วิเคราะห์ CDC ทีละ batch ────────────────────
  const signals: Signal[] = [];
  const BATCH = 8;

  for (let i = 0; i < tickers.length; i += BATCH) {
    const batch = tickers.slice(i, i + BATCH);
    onProgress?.({
      phase: "analyze",
      done: i,
      total: tickers.length,
      current: batch.join(", "),
    });

    try {
      const bars = await fetchYahooBars({ data: { tickers: batch, range: "2y" } });
      for (const bar of bars) {
        try {
          signals.push(buildSignalFromBar(bar));
        } catch {
          // ข้ามหุ้นที่คำนวณไม่ได้ (ข้อมูลน้อย)
        }
      }
    } catch {
      // ข้าม batch ที่ fail
    }
  }

  onProgress?.({ phase: "analyze", done: tickers.length, total: tickers.length, current: "" });
  return signals;
}

/**
 * หา Top Buy / Top Sell จาก scan result
 */
export function rankSignals(signals: Signal[], topN = 20) {
  const buy = signals
    .filter((s) => s.action === "BUY")
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  const sell = signals
    .filter((s) => s.action === "SELL")
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  return { buy, sell };
}
