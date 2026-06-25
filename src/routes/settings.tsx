import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Header } from "@/components/cdc/Header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { EmailSubscribeBox } from "@/components/cdc/EmailSubscribeBox";
import { X, Search, Loader2 } from "lucide-react";
import {
  getBaseUrl,
  setBaseUrl,
  getWatchlist,
  setWatchlist,
  saveTickerMeta,
} from "@/lib/storage";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

type SearchResult = {
  ticker: string;
  name: string;
  type: string;
  exchange: string;
};

function SettingsPage() {
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const [tickers, setTickers] = useState<string[]>([]);
  const [query, setQuery] = useState("");

  // FIX: autocomplete state
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUrl(getBaseUrl());
    setTickers(getWatchlist());
  }, []);

  // FIX: ค้นหาแบบ debounce ขณะพิมพ์
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/public/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(data.results ?? []);
        setShowDropdown(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // FIX: ปิด dropdown เมื่อคลิกข้างนอก
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const save = () => {
    setBaseUrl(url.trim());
    setWatchlist(tickers);
    qc.invalidateQueries();
    toast.success("บันทึกแล้ว — watchlist จะอยู่ในเครื่องนี้ถาวร");
  };

  // FIX: เลือกจาก dropdown → เพิ่ม + เก็บ metadata + auto-save
  const pickTicker = (r: SearchResult) => {
    const t = r.ticker.toUpperCase();
    if (tickers.includes(t)) {
      toast.info(`${t} มีอยู่แล้ว`);
      setQuery("");
      setShowDropdown(false);
      return;
    }
    const next = [...tickers, t];
    setTickers(next);
    saveTickerMeta({ ticker: t, name: r.name, exchange: r.exchange });
    // FIX: บันทึกทันทีไม่ต้องรอกด Save
    setWatchlist(next);
    qc.invalidateQueries();
    setQuery("");
    setResults([]);
    setShowDropdown(false);
    toast.success(`เพิ่ม ${t} แล้ว`);
  };

  // เพิ่มแบบพิมพ์ตรงๆ (กรณีรู้ ticker อยู่แล้ว)
  const addRaw = () => {
    const t = query.trim().toUpperCase();
    if (!t || tickers.includes(t)) return;
    const next = [...tickers, t];
    setTickers(next);
    setWatchlist(next);
    qc.invalidateQueries();
    setQuery("");
    setShowDropdown(false);
    toast.success(`เพิ่ม ${t} แล้ว`);
  };

  const removeTicker = (t: string) => {
    const next = tickers.filter((x) => x !== t);
    setTickers(next);
    // FIX: ลบแล้วบันทึกทันที
    setWatchlist(next);
    qc.invalidateQueries();
  };

  const typeColor = (type: string) =>
    type === "ETF"
      ? "text-buy"
      : type === "CRYPTOCURRENCY"
        ? "text-wave"
        : "text-ema12";

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect to your Railway API and manage your watchlist.
          </p>
        </div>

        <EmailSubscribeBox />

        <section className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div>
            <Label htmlFor="base-url" className="text-sm">
              Railway API URL
            </Label>
            <p className="text-xs text-muted-foreground mt-1 mb-2">
              Leave empty to use Yahoo Finance directly.
            </p>
            <Input
              id="base-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-app.railway.app"
              className="bg-background border-border"
            />
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div>
            <Label className="text-sm">Watchlist</Label>
            <p className="text-xs text-muted-foreground mt-1 mb-3">
              ค้นหาชื่อหุ้น → เลือก → บันทึกถาวรในเครื่องนี้ (เปิดมือถือ/คอมก็ยังอยู่)
            </p>

            <div className="flex flex-wrap gap-2">
              {tickers.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-background text-xs"
                >
                  {t}
                  <button
                    onClick={() => removeTicker(t)}
                    className="text-muted-foreground hover:text-sell"
                    aria-label={`Remove ${t}`}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>

            {/* FIX: search box พร้อม autocomplete dropdown */}
            <div ref={boxRef} className="relative mt-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => results.length && setShowDropdown(true)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (results.length > 0) pickTicker(results[0]);
                        else addRaw();
                      }
                    }}
                    placeholder="ค้นหาหุ้น เช่น IONQ, apple, quantum, PTT.BK"
                    className="bg-background border-border pl-9"
                  />
                  {searching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                <Button onClick={addRaw} variant="secondary">
                  Add
                </Button>
              </div>

              {/* Dropdown */}
              {showDropdown && results.length > 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-card shadow-lg overflow-hidden">
                  {results.map((r) => (
                    <button
                      key={r.ticker}
                      onClick={() => pickTicker(r)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted transition-colors"
                    >
                      <span className="font-mono font-semibold text-sm min-w-[80px]">
                        {r.ticker}
                      </span>
                      <span className="flex-1 text-xs text-muted-foreground truncate">
                        {r.name}
                      </span>
                      <span className={`text-[10px] font-medium ${typeColor(r.type)}`}>
                        {r.type}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {r.exchange}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {showDropdown && !searching && results.length === 0 && query.trim() && (
                <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground shadow-lg">
                  ไม่พบ "{query}" — กด Add เพื่อเพิ่มเป็น ticker โดยตรง
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Theme</Label>
              <p className="text-xs text-muted-foreground mt-1">Dark only for now.</p>
            </div>
            <span className="text-xs text-muted-foreground">Dark</span>
          </div>
        </section>

        <div className="flex justify-end">
          <Button onClick={save} className="bg-buy text-background hover:bg-buy/90">
            Save settings
          </Button>
        </div>
      </main>
    </div>
  );
}
