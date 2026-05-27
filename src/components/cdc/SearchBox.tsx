import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchYahoo, type YahooSearchHit } from "@/lib/yahoo.functions";

export function SearchBox() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<YahooSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setHits([]);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const r = await searchYahoo({ data: { q: term } });
        setHits(r);
        setOpen(true);
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(handle);
  }, [q]);

  const go = (symbol: string) => {
    setOpen(false);
    setQ("");
    navigate({ to: "/signal/$ticker", params: { ticker: symbol } });
  };

  return (
    <div ref={boxRef} className="relative flex-1 max-w-md">
      <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => hits.length && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && hits[0]) go(hits[0].symbol);
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="ค้นหาหุ้น เช่น AAPL, ทอง, BTC..."
        className="pl-8 h-9 bg-card border-border"
      />
      {loading && (
        <Loader2 className="size-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />
      )}
      {open && hits.length > 0 && (
        <div className="absolute z-40 mt-1 w-full max-h-80 overflow-auto rounded-md border border-border bg-popover shadow-lg">
          {hits.map((h) => (
            <button
              key={h.symbol}
              onClick={() => go(h.symbol)}
              className="w-full text-left px-3 py-2 hover:bg-accent flex items-center gap-2 border-b border-border/50 last:border-0"
            >
              <span className="font-semibold text-sm text-foreground">{h.symbol}</span>
              <span className="text-xs text-muted-foreground truncate flex-1">{h.name}</span>
              <span className="text-[10px] text-muted-foreground/70 uppercase">
                {h.exch || h.type}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
