import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PortfolioKindDb = "ai" | "me";

export type DbPosition = {
  id: string;
  ticker: string;
  name: string | null;
  shares: number;
  avg_price: number;
  note: string | null;
};

export type DbPortfolio = {
  id: string;
  kind: PortfolioKindDb;
  cash: number;
  starting_cash: number;
  positions: DbPosition[];
};

export type DbTrade = {
  id: string;
  ticker: string;
  name: string | null;
  side: "buy" | "sell";
  shares: number;
  price: number;
  amount: number;
  realized_pl: number | null;
  source: string;
  note: string | null;
  created_at: string;
  portfolio_id: string;
};

const STARTING_CASH = 100000;

type Sb = { from: (t: string) => any };

async function ensurePortfolios(supabase: Sb, userId: string) {
  const { data, error } = await supabase
    .from("portfolios")
    .select("id, kind, cash, starting_cash")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const existing = (data ?? []) as { id: string; kind: PortfolioKindDb }[];
  const missing = (["ai", "me"] as PortfolioKindDb[]).filter(
    (k) => !existing.some((p) => p.kind === k),
  );
  if (missing.length) {
    const { error: insErr } = await supabase.from("portfolios").insert(
      missing.map((kind) => ({
        user_id: userId,
        kind,
        cash: STARTING_CASH,
        starting_cash: STARTING_CASH,
      })),
    );
    if (insErr) throw new Error(insErr.message);
    const { data: again, error: e2 } = await supabase
      .from("portfolios")
      .select("id, kind, cash, starting_cash")
      .eq("user_id", userId);
    if (e2) throw new Error(e2.message);
    return again ?? [];
  }
  return data ?? [];
}

async function loadAll(supabase: Sb, userId: string): Promise<DbPortfolio[]> {
  const rows = await ensurePortfolios(supabase, userId);
  const ids = rows.map((r: any) => r.id);
  const { data: pos, error } = await supabase
    .from("positions")
    .select("id, portfolio_id, ticker, name, shares, avg_price, note")
    .in("portfolio_id", ids);
  if (error) throw new Error(error.message);
  return rows.map((r: any) => ({
    id: r.id,
    kind: r.kind,
    cash: Number(r.cash),
    starting_cash: Number(r.starting_cash),
    positions: (pos ?? [])
      .filter((p: any) => p.portfolio_id === r.id)
      .map((p: any) => ({
        id: p.id,
        ticker: p.ticker,
        name: p.name,
        shares: Number(p.shares),
        avg_price: Number(p.avg_price),
        note: p.note,
      })),
  }));
}

export const getPaperState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const portfolios = await loadAll(context.supabase as any, context.userId);
    const { data: trades, error } = await (context.supabase as any)
      .from("trade_history")
      .select("*")
      .in(
        "portfolio_id",
        portfolios.map((p) => p.id),
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { portfolios, trades: (trades ?? []) as DbTrade[] };
  });

const orderSchema = z.object({
  kind: z.enum(["ai", "me"]),
  ticker: z.string().trim().toUpperCase().min(1).max(20),
  name: z.string().trim().max(120).optional(),
  side: z.enum(["buy", "sell"]),
  shares: z.number().positive().max(1_000_000),
  price: z.number().positive().max(10_000_000),
  source: z.string().trim().max(20).default("manual"),
  note: z.string().trim().max(200).optional(),
});

async function executeOrder(
  supabase: Sb,
  userId: string,
  o: z.infer<typeof orderSchema>,
) {
  const portfolios = await loadAll(supabase, userId);
  const pf = portfolios.find((p) => p.kind === o.kind);
  if (!pf) throw new Error("ไม่พบพอร์ต");
  const pos = pf.positions.find((p) => p.ticker === o.ticker);
  const amount = o.shares * o.price;

  if (o.side === "buy") {
    if (amount > pf.cash + 1e-6) throw new Error("เงินสดไม่พอ");
    const newShares = (pos?.shares ?? 0) + o.shares;
    const newAvg = pos
      ? (pos.avg_price * pos.shares + amount) / newShares
      : o.price;
    if (pos) {
      const { error } = await supabase
        .from("positions")
        .update({ shares: newShares, avg_price: newAvg, updated_at: new Date().toISOString() })
        .eq("id", pos.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("positions").insert({
        portfolio_id: pf.id,
        ticker: o.ticker,
        name: o.name ?? o.ticker,
        shares: o.shares,
        avg_price: o.price,
        note: o.note ?? null,
      });
      if (error) throw new Error(error.message);
    }
    const { error: cErr } = await supabase
      .from("portfolios")
      .update({ cash: pf.cash - amount, updated_at: new Date().toISOString() })
      .eq("id", pf.id);
    if (cErr) throw new Error(cErr.message);
    const { error: tErr } = await supabase.from("trade_history").insert({
      portfolio_id: pf.id,
      ticker: o.ticker,
      name: o.name ?? o.ticker,
      side: "buy",
      shares: o.shares,
      price: o.price,
      amount,
      source: o.source,
      note: o.note ?? null,
    });
    if (tErr) throw new Error(tErr.message);
    return { ok: true };
  }

  // sell
  if (!pos || pos.shares < o.shares - 1e-9) throw new Error("จำนวนหุ้นไม่พอขาย");
  const realized = (o.price - pos.avg_price) * o.shares;
  const left = pos.shares - o.shares;
  if (left <= 1e-9) {
    const { error } = await supabase.from("positions").delete().eq("id", pos.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("positions")
      .update({ shares: left, updated_at: new Date().toISOString() })
      .eq("id", pos.id);
    if (error) throw new Error(error.message);
  }
  const { error: cErr } = await supabase
    .from("portfolios")
    .update({ cash: pf.cash + amount, updated_at: new Date().toISOString() })
    .eq("id", pf.id);
  if (cErr) throw new Error(cErr.message);
  const { error: tErr } = await supabase.from("trade_history").insert({
    portfolio_id: pf.id,
    ticker: o.ticker,
    name: o.name ?? pos.name ?? o.ticker,
    side: "sell",
    shares: o.shares,
    price: o.price,
    amount,
    realized_pl: realized,
    source: o.source,
    note: o.note ?? null,
  });
  if (tErr) throw new Error(tErr.message);
  return { ok: true };
}

export const placeOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orderSchema.parse(d))
  .handler(async ({ data, context }) => {
    await executeOrder(context.supabase as any, context.userId, data);
    return getStateFor(context);
  });

async function getStateFor(context: { supabase: unknown; userId: string }) {
  const portfolios = await loadAll(context.supabase as any, context.userId);
  const { data: trades } = await (context.supabase as any)
    .from("trade_history")
    .select("*")
    .in(
      "portfolio_id",
      portfolios.map((p) => p.id),
    )
    .order("created_at", { ascending: false })
    .limit(200);
  return { portfolios, trades: (trades ?? []) as DbTrade[] };
}

const planSchema = z.object({
  picks: z
    .array(
      z.object({
        ticker: z.string().trim().toUpperCase().min(1).max(20),
        name: z.string().trim().max(120).optional(),
        price: z.number().positive(),
        note: z.string().trim().max(200).optional(),
      }),
    )
    .max(10),
  // current market prices for positions we may need to sell
  marks: z.record(z.string(), z.number().positive()).default({}),
});

/** AI rebalance: sell everything not in picks, then buy picks with equal weight. */
export const applyAiPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => planSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const userId = context.userId;
    const state = await loadAll(supabase, userId);
    const pf = state.find((p) => p.kind === "ai");
    if (!pf) throw new Error("ไม่พบพอร์ต AI");

    const keep = new Set(data.picks.map((p) => p.ticker));
    for (const pos of pf.positions) {
      if (keep.has(pos.ticker)) continue;
      const price = data.marks[pos.ticker] ?? pos.avg_price;
      await executeOrder(supabase, userId, {
        kind: "ai",
        ticker: pos.ticker,
        name: pos.name ?? pos.ticker,
        side: "sell",
        shares: pos.shares,
        price,
        source: "ai",
        note: "AI ปรับพอร์ต: ตัดออก",
      });
    }

    const after = await loadAll(supabase, userId);
    const pf2 = after.find((p) => p.kind === "ai")!;
    const toBuy = data.picks.filter(
      (p) => !pf2.positions.some((x) => x.ticker === p.ticker),
    );
    if (toBuy.length) {
      const budget = (pf2.cash * 0.95) / toBuy.length;
      for (const p of toBuy) {
        const shares = Math.floor((budget / p.price) * 10000) / 10000;
        if (shares <= 0) continue;
        await executeOrder(supabase, userId, {
          kind: "ai",
          ticker: p.ticker,
          name: p.name ?? p.ticker,
          side: "buy",
          shares,
          price: p.price,
          source: "ai",
          note: p.note ?? "AI ปรับพอร์ต: เข้าซื้อ",
        });
      }
    }
    return getStateFor(context);
  });

export const resetPortfolio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ kind: z.enum(["ai", "me"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const state = await loadAll(supabase, context.userId);
    const pf = state.find((p) => p.kind === data.kind);
    if (!pf) throw new Error("ไม่พบพอร์ต");
    await supabase.from("positions").delete().eq("portfolio_id", pf.id);
    await supabase.from("trade_history").delete().eq("portfolio_id", pf.id);
    await supabase
      .from("portfolios")
      .update({ cash: pf.starting_cash, updated_at: new Date().toISOString() })
      .eq("id", pf.id);
    return getStateFor(context);
  });
