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
