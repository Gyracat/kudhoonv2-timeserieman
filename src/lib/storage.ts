import { DEFAULT_TICKERS } from "./mockData";

const BASE_URL_KEY = "cdc.baseUrl";
const WATCHLIST_KEY = "cdc.watchlist";
const FAVORITES_KEY = "cdc.favorites";

function isBrowser() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function getBaseUrl(): string {
  if (!isBrowser()) return "";
  return localStorage.getItem(BASE_URL_KEY) ?? "";
}
export function setBaseUrl(url: string) {
  if (!isBrowser()) return;
  localStorage.setItem(BASE_URL_KEY, url);
}

export function getWatchlist(): string[] {
  if (!isBrowser()) return DEFAULT_TICKERS;
  const raw = localStorage.getItem(WATCHLIST_KEY);
  if (!raw) return DEFAULT_TICKERS;
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) && arr.length ? arr : DEFAULT_TICKERS;
  } catch {
    return DEFAULT_TICKERS;
  }
}
export function setWatchlist(tickers: string[]) {
  if (!isBrowser()) return;
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(tickers));
}

export function getFavorites(): string[] {
  if (!isBrowser()) return [];
  const raw = localStorage.getItem(FAVORITES_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
export function setFavorites(tickers: string[]) {
  if (!isBrowser()) return;
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(tickers));
}

// FIX: ticker metadata cache (เก็บชื่อบริษัทที่เคยค้นเจอ)
// เพื่อให้แสดงชื่อเต็มได้แม้ offline
const TICKER_META_KEY = "cdc.tickerMeta";

export type TickerMeta = { ticker: string; name: string; exchange: string };

export function getTickerMeta(): Record<string, TickerMeta> {
  if (!isBrowser()) return {};
  const raw = localStorage.getItem(TICKER_META_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveTickerMeta(meta: TickerMeta) {
  if (!isBrowser()) return;
  const all = getTickerMeta();
  all[meta.ticker] = meta;
  localStorage.setItem(TICKER_META_KEY, JSON.stringify(all));
}
