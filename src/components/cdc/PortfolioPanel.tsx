import { Link } from "@tanstack/react-router";
import { Trash2, Plus, RefreshCw, Loader2 } from "lucide-react";
import { useState } from "react";
import { Sparkline } from "./Sparkline";
import type { Holding, PortfolioKind } from "@/lib/portfolio";

export type Quote = {
  ticker: string;
  name: string;
  price: number;
  changePct: number;
  spark: number[];
};

export function PortfolioPanel({
  title,
  subtitle,
  kind,
  holdings,
  quotes,
  loading,
  lastRefresh,
  onRefresh,
  onRemove,
  onAdd,
  extraAction,
}: {
  title: string;
  subtitle: string;
  kind: PortfolioKind;
  holdings: Holding[];
  quotes: Record<string, Quote>;
  loading: boolean;
  lastRefresh: Date | null;
  onRefresh: () => void;
  onRemove: (ticker: string) => void;
  onAdd?: (ticker: string) => Promise<void> | void;
  extraAction?: React.ReactNode;
}) {
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);

  const totals = holdings.reduce(
    (acc, h) => {
      const q = quotes[h.ticker];
      if (!q) return acc;
      acc.n += 1;
      acc.pl += ((q.price - h.entryPrice) / h.entryPrice) * 100;
      return acc;
    },
    { n: 0, pl: 0 },
  );
  const avgPl = totals.n ? totals.pl / totals.n : 0;

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-4 border-b border-border flex items-start gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold flex items-center gap-2">
            {title}
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                avgPl >= 0 ? "bg-buy/15 text-buy" : "bg-sell/15 text-sell"
              }`}
            >
              {avgPl >= 0 ? "+" : ""}
              {avgPl.toFixed(2)}%
            </span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {subtitle}
            {lastRefresh && ` · อัปเดต ${lastRefresh.toLocaleTimeString("th-TH")}`}
          </p>
        </div>
        <div className="flex-1" />
        {extraAction}
        <button
          onClick={onRefresh}
          className="p-2 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
          aria-label="Refresh"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        </button>
      </div>

      {onAdd && (
        <form
          className="p-3 border-b border-border flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const t = input.trim().toUpperCase();
            if (!t) return;
            setAdding(true);
            try {
              await onAdd(t);
              setInput("");
            } finally {
              setAdding(false);
            }
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="เพิ่มหุ้น เช่น AAPL, PTT.BK, BTC-USD"
            className="flex-1 h-9 px-3 rounded-md bg-background border border-border text-sm outline-none focus:border-pink"
          />
          <button
            type="submit"
            disabled={adding}
            className="h-9 px-3 rounded-md bg-pink text-background text-sm font-medium inline-flex items-center gap-1 disabled:opacity-50"
          >
            {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            เพิ่ม
          </button>
        </form>
      )}

      {holdings.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground text-center">ยังไม่มีรายการในพอร์ตนี้</p>
      ) : (
        <ul className="divide-y divide-border">
          {holdings.map((h) => {
            const q = quotes[h.ticker];
            const pl = q ? ((q.price - h.entryPrice) / h.entryPrice) * 100 : 0;
            const up = (q?.changePct ?? 0) >= 0;
            return (
              <li key={`${kind}-${h.ticker}`} className="p-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <Link
                    to="/signal/$ticker"
                    params={{ ticker: h.ticker }}
                    className="font-semibold text-sm hover:text-pink"
                  >
                    {h.ticker}
                  </Link>
                  <span className="ml-2 text-xs text-muted-foreground truncate">
                    {q?.name ?? h.name}
                  </span>
                  <div className="text-sm mt-0.5 flex items-baseline gap-2">
                    <span>{q ? q.price.toLocaleString() : "—"}</span>
                    <span className={up ? "text-buy text-xs" : "text-sell text-xs"}>
                      {q ? `${q.changePct >= 0 ? "+" : ""}${q.changePct.toFixed(2)}%` : ""}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    เข้าที่ {h.entryPrice.toLocaleString()} · {h.entryDate}
                    {" · "}
                    <span className={pl >= 0 ? "text-buy" : "text-sell"}>
                      {pl >= 0 ? "+" : ""}
                      {pl.toFixed(2)}%
                    </span>
                    {h.note ? ` · ${h.note}` : ""}
                  </div>
                </div>
                <Sparkline values={q?.spark ?? []} up={up} />
                <button
                  onClick={() => onRemove(h.ticker)}
                  className="p-2 rounded hover:bg-accent text-muted-foreground hover:text-sell"
                  aria-label={`ลบ ${h.ticker}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
