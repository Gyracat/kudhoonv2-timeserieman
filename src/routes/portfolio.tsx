import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Header } from "@/components/cdc/Header";
import { PortfolioPanel, type Quote } from "@/components/cdc/PortfolioPanel";
import {
  addHolding,
  getPortfolio,
  removeHolding,
  setPortfolio,
  type Holding,
} from "@/lib/portfolio";
import { fetchYahooBars } from "@/lib/yahoo.functions";
import { fetchSignals } from "@/lib/api";

export const Route = createFileRoute("/portfolio")({
  head: () => ({
    meta: [
      { title: "พอร์ตทดสอบ AI vs ของฉัน | CDC Wave + Time Serie" },
      {
        name: "description",
        content:
          "เปรียบเทียบพอร์ตทดสอบสองระบบ: หุ้นที่ AI คัดจากสัญญาณ CDC Wave กับหุ้นที่คุณเลือกเอง พร้อมกำไร/ขาดทุนแบบเรียลไทม์",
      },
      { property: "og:title", content: "พอร์ตทดสอบ AI vs ของฉัน" },
      {
        property: "og:description",
        content: "ติดตามผลพอร์ตทดสอบของ AI และของคุณเอง ด้วยราคาจริงจาก Yahoo Finance",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PortfolioPage,
});

function PortfolioPage() {
  const [ai, setAi] = useState<Holding[]>([]);
  const [me, setMe] = useState<Holding[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [loading, setLoading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAi(getPortfolio("ai"));
    setMe(getPortfolio("me"));
  }, []);

  const loadQuotes = useCallback(async (tickers: string[]) => {
    const uniq = Array.from(new Set(tickers));
    if (!uniq.length) {
      setLastRefresh(new Date());
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const bars = await fetchYahooBars({ data: { tickers: uniq, range: "1mo" } });
      const next: Record<string, Quote> = {};
      for (const b of bars) {
        const p = b.prices;
        const price = p[p.length - 1];
        const prev = p.length > 1 ? p[p.length - 2] : price;
        next[b.ticker] = {
          ticker: b.ticker,
          name: b.name,
          price,
          changePct: ((price - prev) / prev) * 100,
          spark: p.slice(-30),
        };
      }
      setQuotes((q) => ({ ...q, ...next }));
      setLastRefresh(new Date());
    } catch {
      setError("ดึงราคาไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = [...ai, ...me].map((h) => h.ticker);
    if (t.length) void loadQuotes(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ai.length, me.length]);

  // auto refresh ทุก 60 วินาที
  useEffect(() => {
    const id = setInterval(() => {
      const t = [...getPortfolio("ai"), ...getPortfolio("me")].map((h) => h.ticker);
      if (t.length) void loadQuotes(t);
    }, 60_000);
    return () => clearInterval(id);
  }, [loadQuotes]);

  const addTo = async (kind: "ai" | "me", ticker: string) => {
    setError(null);
    const bars = await fetchYahooBars({ data: { tickers: [ticker], range: "1mo" } });
    const bar = bars[0];
    if (!bar) {
      setError(`ไม่พบสัญลักษณ์ ${ticker} ใน Yahoo Finance`);
      return;
    }
    const price = bar.prices[bar.prices.length - 1];
    const next = addHolding(kind, {
      ticker: bar.ticker,
      name: bar.name,
      entryPrice: price,
      entryDate: new Date().toISOString().slice(0, 10),
    });
    if (kind === "ai") setAi(next);
    else setMe(next);
    await loadQuotes([bar.ticker]);
  };

  const buildAi = async () => {
    setBuilding(true);
    setError(null);
    try {
      const signals = await fetchSignals();
      const picks = signals
        .filter((s) => s.action === "BUY" || s.action === "WATCH")
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
      const holdings: Holding[] = picks.map((s) => ({
        ticker: s.ticker,
        name: s.name ?? s.ticker,
        entryPrice: s.price,
        entryDate: new Date().toISOString().slice(0, 10),
        note: `${s.action} · ${s.wave} · score ${s.score}`,
      }));
      setPortfolio("ai", holdings);
      setAi(holdings);
      await loadQuotes(holdings.map((h) => h.ticker));
    } catch {
      setError("AI จัดพอร์ตไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBuilding(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-lg font-semibold">พอร์ตทดสอบ (Paper Trade)</h1>
          <p className="text-sm text-muted-foreground mt-1">
            เทียบผลสองระบบ: พอร์ตที่ AI คัดจากสัญญาณ กับพอร์ตที่คุณเลือกเอง — บันทึกราคาตอนเพิ่ม
            แล้ววัดกำไร/ขาดทุนจากราคาจริง
          </p>
        </div>

        {error && (
          <p className="text-sm text-sell bg-sell/10 border border-sell/30 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <PortfolioPanel
            title="🤖 พอร์ตของ AI"
            subtitle="คัดจากสัญญาณ CDC Wave + คะแนนสูงสุด 5 ตัว"
            kind="ai"
            holdings={ai}
            quotes={quotes}
            loading={loading}
            lastRefresh={lastRefresh}
            onRefresh={() => loadQuotes(ai.map((h) => h.ticker))}
            onRemove={(t) => setAi(removeHolding("ai", t))}
            extraAction={
              <button
                onClick={buildAi}
                disabled={building}
                className="h-8 px-3 rounded-md bg-buy/15 text-buy text-xs font-medium inline-flex items-center gap-1 disabled:opacity-50"
              >
                {building ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                ให้ AI จัดพอร์ต
              </button>
            }
          />

          <PortfolioPanel
            title="🙋 พอร์ตของฉัน"
            subtitle="เพิ่มหุ้นที่คุณอยากทดสอบเอง"
            kind="me"
            holdings={me}
            quotes={quotes}
            loading={loading}
            lastRefresh={lastRefresh}
            onRefresh={() => loadQuotes(me.map((h) => h.ticker))}
            onRemove={(t) => setMe(removeHolding("me", t))}
            onAdd={(t) => addTo("me", t)}
          />
        </div>
      </main>
    </div>
  );
}
