// Paper-trading "test" portfolios: AI-picked vs user-picked.
export type Holding = {
  ticker: string;
  name: string;
  entryPrice: number;
  entryDate: string; // ISO date
  note?: string;
};

export type PortfolioKind = "ai" | "me";

const KEYS: Record<PortfolioKind, string> = {
  ai: "cdc.portfolio.ai",
  me: "cdc.portfolio.me",
};

function isBrowser() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function getPortfolio(kind: PortfolioKind): Holding[] {
  if (!isBrowser()) return [];
  const raw = localStorage.getItem(KEYS[kind]);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as Holding[]) : [];
  } catch {
    return [];
  }
}

export function setPortfolio(kind: PortfolioKind, holdings: Holding[]) {
  if (!isBrowser()) return;
  localStorage.setItem(KEYS[kind], JSON.stringify(holdings));
}

export function addHolding(kind: PortfolioKind, h: Holding): Holding[] {
  const list = getPortfolio(kind).filter((x) => x.ticker !== h.ticker);
  const next = [h, ...list];
  setPortfolio(kind, next);
  return next;
}

export function removeHolding(kind: PortfolioKind, ticker: string): Holding[] {
  const next = getPortfolio(kind).filter((x) => x.ticker !== ticker);
  setPortfolio(kind, next);
  return next;
}
