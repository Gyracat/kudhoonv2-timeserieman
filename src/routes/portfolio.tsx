import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Loader2, RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/cdc/Header";
import { Sparkline } from "@/components/cdc/Sparkline";
import type { Quote } from "@/components/cdc/PortfolioPanel";
import { fetchYahooBars } from "@/lib/yahoo.functions";
import { fetchSignals } from "@/lib/api";
import { signInWithGoogle, useSession } from "@/lib/auth";
import {
  applyAiPlan,
  getPaperState,
  placeOrder,
  resetPortfolio,
  type DbPortfolio,
  type DbTrade,
} from "@/lib/paper.functions";

export const Route = createFileRoute("/portfolio")({
  head: () => ({
    meta: [
      { title: "พอร์ตทดสอบ AI vs ของฉัน | CDC Wave + Time Serie" },
      {
        name: "description",
        content: "Paper trade ส่วนตัว: ซื้อขายตามจำนวนและราคาที่ต้องการ เทียบกับพอร์ตที่ AI ปรับให้ พร้อมประวัติการซื้อขาย",
      },
      { property: "og:title", content: "พอร์ตทดสอบ AI vs ของฉัน" },
      { property: "og:description", content: "Paper trade ส่วนตัว พร้อมพอร์ต AI และประวัติการซื้อขาย" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PortfolioPage,
});

type State = { portfolios: DbPortfolio[]; trades: DbTrade[] };
const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

function PortfolioPage() {
  const { user, loading: authLoading } = useSession();
  const getState = useServerFn(getPaperState);
  const order = useServerFn(placeOrder);
  const aiPlan = useServerFn(applyAiPlan);
  const reset = useServerFn(resetPortfolio);

  const [state, setState] = useState<State | null>(null);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [loading, setLoading] = useState(false);
  const [building, setBuilding] = useState(false);

  const loadQuotes = useCallback(async (tickers: string[]) => {
    const uniq = Array.from(new Set(tickers));
    if (!uniq.length) return {};
    const bars = await fetchYahooBars({ data: { tickers: uniq, range: "1mo" } });
    const next: Record<string, Quote> = {};
    for (const b of bars) {
      const p = b.prices;
      const price = p[p.length - 1];
      const prev = p.length > 1 ? p[p.length - 2] : price;
      next[b.ticker] = { ticker: b.ticker, name: b.name, price, changePct: ((price - prev) / prev) * 100, spark: p.slice(-30) };
    }
    setQuotes((q) => ({ ...q, ...next }));
    return next;
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getState();
      setState(s);
      await loadQuotes(s.portfolios.flatMap((p) => p.positions.map((x) => x.ticker)));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [getState, loadQuotes]);

  useEffect(() => {
    if (user) void refresh();
    else setState(null);
  }, [user, refresh]);

  if (authLoading) {
    return <Shell><Loader2 className="size-6 animate-spin mx-auto mt-20 text-muted-foreground" /></Shell>;
  }
  if (!user) {
    return (
      <Shell>
        <div className="max-w-md mx-auto mt-16 text-center rounded-xl border border-border bg-card p-8">
          <h1 className="text-lg font-semibold">เข้าสู่ระบบเพื่อใช้พอร์ตทดสอบ</h1>
          <p className="text-sm text-muted-foreground mt-2">
            ล็อกอินด้วย Google แล้วพอร์ต, การซื้อขาย และประวัติจะถูกเก็บเป็นของคุณคนเดียว
          </p>
          <button
            onClick={async () => {
              const { error } = await signInWithGoogle();
              if (error) toast.error(error);
            }}
            className="mt-6 h-10 px-5 rounded-md bg-pink text-background font-medium"
          >
            เข้าสู่ระบบด้วย Google
          </button>
        </div>
      </Shell>
    );
  }

  const ai = state?.portfolios.find((p) => p.kind === "ai");
  const me = state?.portfolios.find((p) => p.kind === "me");

  const doOrder = async (input: Parameters<typeof order>[0]["data"]) => {
    try {
      const s = await order({ data: input });
      setState(s);
      await loadQuotes([input.ticker]);
      toast.success(`${input.side === "buy" ? "ซื้อ" : "ขาย"} ${input.ticker} แล้ว`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const runAi = async () => {
    if (!ai) return;
    setBuilding(true);
    try {
      const signals = await fetchSignals();
      const picks = signals
        .filter((s) => s.action === "BUY" || s.action === "WATCH")
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map((s) => ({ ticker: s.ticker, name: s.name ?? s.ticker, price: s.price, note: `${s.action} · ${s.wave} · score ${s.score}` }));
      const held = ai.positions.map((p) => p.ticker);
      const q = await loadQuotes(held);
      const marks: Record<string, number> = {};
      for (const t of held) { const v = q[t]?.price ?? quotes[t]?.price; if (v) marks[t] = v; }
      const s = await aiPlan({ data: { picks, marks } });
      setState(s);
      await loadQuotes(picks.map((p) => p.ticker));
      toast.success("AI ปรับพอร์ตเรียบร้อย");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBuilding(false);
    }
  };

  const doReset = async (kind: "ai" | "me") => {
    if (!confirm("รีเซ็ตพอร์ตนี้กลับเป็นเงินตั้งต้น 100,000 และลบประวัติ?")) return;
    try { setState(await reset({ data: { kind } })); } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <Shell>
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h1 className="text-lg font-semibold">พอร์ตทดสอบ (Paper Trade)</h1>
          <p className="text-sm text-muted-foreground mt-1">เงินตั้งต้นพอร์ตละ 100,000 · บันทึกไว้ในบัญชีของคุณ</p>
        </div>
        <button onClick={refresh} className="p-2 rounded hover:bg-accent text-muted-foreground" aria-label="รีเฟรช">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        </button>
      </div>

      {!state ? (
        <Loader2 className="size-6 animate-spin mx-auto mt-10 text-muted-foreground" />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            {ai && (
              <Panel
                title="🤖 พอร์ตของ AI"
                subtitle="AI วิเคราะห์สัญญาณ แล้วถือ 5 ตัวคะแนนสูงสุด"
                pf={ai}
                quotes={quotes}
                onReset={() => doReset("ai")}
                onSell={(t, shares, price) => doOrder({ kind: "ai", ticker: t, side: "sell", shares, price, source: "manual" })}
                action={
                  <button onClick={runAi} disabled={building} className="h-8 px-3 rounded-md bg-buy/15 text-buy text-xs font-medium inline-flex items-center gap-1 disabled:opacity-50">
                    {building ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                    ให้ AI ปรับพอร์ต
                  </button>
                }
              />
            )}
            {me && (
              <Panel
                title="🙋 พอร์ตของฉัน"
                subtitle="ซื้อ/ขายตามจำนวนหุ้นและราคาที่คุณกำหนด"
                pf={me}
                quotes={quotes}
                onReset={() => doReset("me")}
                onSell={(t, shares, price) => doOrder({ kind: "me", ticker: t, side: "sell", shares, price, source: "manual" })}
                orderForm={<OrderForm quotes={quotes} loadQuotes={loadQuotes} onSubmit={(o) => doOrder({ ...o, kind: "me", source: "manual" })} />}
              />
            )}
          </div>
          <History trades={state.trades} portfolios={state.portfolios} />
        </>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">{children}</main>
    </div>
  );
}

function Panel({
  title, subtitle, pf, quotes, action, orderForm, onSell, onReset,
}: {
  title: string; subtitle: string; pf: DbPortfolio; quotes: Record<string, Quote>;
  action?: React.ReactNode; orderForm?: React.ReactNode;
  onSell: (ticker: string, shares: number, price: number) => void; onReset: () => void;
}) {
  const marketValue = pf.positions.reduce((s, p) => s + p.shares * (quotes[p.ticker]?.price ?? p.avg_price), 0);
  const equity = pf.cash + marketValue;
  const ret = ((equity - pf.starting_cash) / pf.starting_cash) * 100;
  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-4 border-b border-border flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold flex items-center gap-2">
            {title}
            <span className={`text-xs px-2 py-0.5 rounded-full ${ret >= 0 ? "bg-buy/15 text-buy" : "bg-sell/15 text-sell"}`}>
              {ret >= 0 ? "+" : ""}{ret.toFixed(2)}%
            </span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          <p className="text-xs mt-2">
            มูลค่ารวม <b>{fmt(equity)}</b> · เงินสด {fmt(pf.cash)} · หุ้น {fmt(marketValue)}
          </p>
        </div>
        {action}
        <button onClick={onReset} className="p-2 rounded hover:bg-accent text-muted-foreground" aria-label="รีเซ็ต">
          <RotateCcw className="size-4" />
        </button>
      </div>
      {orderForm}
      {pf.positions.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground text-center">ยังไม่มีหุ้นในพอร์ตนี้</p>
      ) : (
        <ul className="divide-y divide-border">
          {pf.positions.map((p) => {
            const q = quotes[p.ticker];
            const price = q?.price ?? p.avg_price;
            const pl = ((price - p.avg_price) / p.avg_price) * 100;
            const up = (q?.changePct ?? 0) >= 0;
            return (
              <li key={p.id} className="p-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <Link to="/signal/$ticker" params={{ ticker: p.ticker }} className="font-semibold text-sm hover:text-pink">{p.ticker}</Link>
                  <span className="ml-2 text-xs text-muted-foreground truncate">{q?.name ?? p.name}</span>
                  <div className="text-sm mt-0.5 flex items-baseline gap-2">
                    <span>{q ? fmt(q.price) : "—"}</span>
                    <span className={up ? "text-buy text-xs" : "text-sell text-xs"}>
                      {q ? `${q.changePct >= 0 ? "+" : ""}${q.changePct.toFixed(2)}%` : ""}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {fmt(p.shares)} หุ้น · ทุน {fmt(p.avg_price)} ·{" "}
                    <span className={pl >= 0 ? "text-buy" : "text-sell"}>{pl >= 0 ? "+" : ""}{pl.toFixed(2)}% ({fmt((price - p.avg_price) * p.shares)})</span>
                  </div>
                </div>
                <Sparkline values={q?.spark ?? []} up={up} />
                <button
                  onClick={() => {
                    const s = prompt(`ขาย ${p.ticker} กี่หุ้น? (มี ${p.shares})`, String(p.shares));
                    if (!s) return;
                    const pr = prompt("ราคาที่ต้องการขาย", String(price));
                    if (!pr) return;
                    const shares = Number(s), px = Number(pr);
                    if (shares > 0 && px > 0) onSell(p.ticker, shares, px);
                  }}
                  className="h-8 px-2.5 rounded-md bg-sell/15 text-sell text-xs font-medium"
                >
                  ขาย
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function OrderForm({
  quotes, loadQuotes, onSubmit,
}: {
  quotes: Record<string, Quote>;
  loadQuotes: (t: string[]) => Promise<Record<string, Quote>>;
  onSubmit: (o: { ticker: string; name?: string; side: "buy"; shares: number; price: number }) => Promise<void>;
}) {
  const [ticker, setTicker] = useState("");
  const [shares, setShares] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);

  const lookup = async () => {
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    const q = (await loadQuotes([t]))[t] ?? quotes[t];
    if (q && !price) setPrice(String(Number(q.price.toFixed(4))));
    if (!q) toast.error(`ไม่พบ ${t} ใน Yahoo Finance`);
  };

  const t = ticker.trim().toUpperCase();
  const total = Number(shares) * Number(price);
  return (
    <form
      className="p-3 border-b border-border grid grid-cols-2 sm:grid-cols-4 gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const sh = Number(shares), px = Number(price);
        if (!t || !(sh > 0) || !(px > 0)) return toast.error("กรอกชื่อหุ้น จำนวน และราคาให้ครบ");
        setBusy(true);
        try {
          await onSubmit({ ticker: t, name: quotes[t]?.name, side: "buy", shares: sh, price: px });
          setTicker(""); setShares(""); setPrice("");
        } finally { setBusy(false); }
      }}
    >
      <input value={ticker} onChange={(e) => setTicker(e.target.value)} onBlur={lookup} placeholder="หุ้น เช่น AAPL, PTT.BK"
        className="col-span-2 sm:col-span-1 h-9 px-3 rounded-md bg-background border border-border text-sm outline-none focus:border-pink" />
      <input value={shares} onChange={(e) => setShares(e.target.value)} inputMode="decimal" placeholder="จำนวนหุ้น"
        className="h-9 px-3 rounded-md bg-background border border-border text-sm outline-none focus:border-pink" />
      <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="ราคาที่ต้องการ"
        className="h-9 px-3 rounded-md bg-background border border-border text-sm outline-none focus:border-pink" />
      <button type="submit" disabled={busy} className="col-span-2 sm:col-span-1 h-9 px-3 rounded-md bg-pink text-background text-sm font-medium inline-flex items-center justify-center gap-1 disabled:opacity-50">
        {busy && <Loader2 className="size-4 animate-spin" />}
        ซื้อ{total > 0 ? ` · ${fmt(total)}` : ""}
      </button>
      {t && quotes[t] && (
        <p className="col-span-full text-[11px] text-muted-foreground">ราคาตลาดล่าสุด {t}: {fmt(quotes[t].price)}</p>
      )}
    </form>
  );
}

function History({ trades, portfolios }: { trades: DbTrade[]; portfolios: DbPortfolio[] }) {
  const [filter, setFilter] = useState<"all" | "ai" | "me">("all");
  const kindOf = (id: string) => portfolios.find((p) => p.id === id)?.kind;
  const rows = trades.filter((t) => filter === "all" || kindOf(t.portfolio_id) === filter);
  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-4 border-b border-border flex items-center gap-2">
        <h2 className="font-semibold flex-1">📜 ประวัติการซื้อขาย</h2>
        {(["all", "ai", "me"] as const).map((k) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`text-xs px-2.5 py-1 rounded ${filter === k ? "bg-pink text-background" : "text-muted-foreground hover:bg-accent"}`}>
            {k === "all" ? "ทั้งหมด" : k === "ai" ? "AI" : "ของฉัน"}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground text-center">ยังไม่มีประวัติ</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr className="text-left">
                <th className="p-2">เวลา</th><th className="p-2">พอร์ต</th><th className="p-2">หุ้น</th><th className="p-2">ฝั่ง</th>
                <th className="p-2 text-right">จำนวน</th><th className="p-2 text-right">ราคา</th><th className="p-2 text-right">มูลค่า</th>
                <th className="p-2 text-right">กำไร</th><th className="p-2">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((t) => (
                <tr key={t.id}>
                  <td className="p-2 whitespace-nowrap">{new Date(t.created_at).toLocaleString("th-TH")}</td>
                  <td className="p-2">{kindOf(t.portfolio_id) === "ai" ? "🤖" : "🙋"}</td>
                  <td className="p-2 font-semibold">{t.ticker}</td>
                  <td className={`p-2 ${t.side === "buy" ? "text-buy" : "text-sell"}`}>{t.side === "buy" ? "ซื้อ" : "ขาย"}</td>
                  <td className="p-2 text-right">{fmt(Number(t.shares))}</td>
                  <td className="p-2 text-right">{fmt(Number(t.price))}</td>
                  <td className="p-2 text-right">{fmt(Number(t.amount))}</td>
                  <td className={`p-2 text-right ${Number(t.realized_pl ?? 0) >= 0 ? "text-buy" : "text-sell"}`}>
                    {t.realized_pl == null ? "—" : fmt(Number(t.realized_pl))}
                  </td>
                  <td className="p-2 text-muted-foreground">{t.note ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
