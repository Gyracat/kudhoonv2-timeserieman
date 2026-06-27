import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { fetchSignals } from "@/lib/api";
import { Header } from "@/components/cdc/Header";
import { FilterTabs, type FilterKey } from "@/components/cdc/FilterTabs";
import { SignalCard } from "@/components/cdc/SignalCard";
import { ScanButtons } from "@/components/cdc/ScanButtons";
import { getFavorites, setFavorites } from "@/lib/storage";
import type { Signal } from "@/lib/types";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const [active, setActive] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [favs, setFavs] = useState<string[]>([]);

  // FIX: state สำหรับ scan result (top buy/sell)
  const [scanResult, setScanResult] = useState<Signal[] | null>(null);
  const [scanLabel, setScanLabel] = useState("");

  useEffect(() => {
    setFavs(getFavorites());
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ["signals"],
    queryFn: fetchSignals,
  });

  const signals = data ?? [];

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = {
      all: signals.length,
      buy: 0,
      sell: 0,
      up: 0,
      w1: 0,
      w2: 0,
      w3: 0,
      fav: 0,
    };
    signals.forEach((s) => {
      if (s.action === "BUY") c.buy++;
      if (s.action === "SELL") c.sell++;
      if (s.ema12 > s.ema26) c.up++;
      if (s.wave === "W1") c.w1++;
      if (s.wave === "W2") c.w2++;
      if (s.wave === "W3") c.w3++;
      if (favs.includes(s.ticker)) c.fav++;
    });
    return c;
  }, [signals, favs]);

  const filtered = useMemo(() => {
    // FIX: ถ้ามี scan result → ใช้อันนั้นแทน (เรียง score แล้ว)
    if (scanResult) {
      return scanResult.filter(
        (s) =>
          !search ||
          s.ticker.toLowerCase().includes(search.toLowerCase()) ||
          (s.name ?? "").toLowerCase().includes(search.toLowerCase()),
      );
    }

    return signals.filter((s) => {
      const matchSearch =
        !search ||
        s.ticker.toLowerCase().includes(search.toLowerCase()) ||
        (s.name ?? "").toLowerCase().includes(search.toLowerCase());
      if (!matchSearch) return false;
      if (active === "all") return true;
      if (active === "buy") return s.action === "BUY";
      if (active === "sell") return s.action === "SELL";
      if (active === "up") return s.ema12 > s.ema26;
      if (active === "w1") return s.wave === "W1";
      if (active === "w2") return s.wave === "W2";
      if (active === "w3") return s.wave === "W3";
      if (active === "fav") return favs.includes(s.ticker);
      return true;
    });
  }, [signals, search, active, favs, scanResult]);

  const toggleFav = (ticker: string) => {
    const next = favs.includes(ticker) ? favs.filter((t) => t !== ticker) : [...favs, ticker];
    setFavs(next);
    setFavorites(next);
  };

  // FIX: เมื่อ scan → ล้าง filter tab active
  const handleScan = (result: Signal[] | null, label: string) => {
    setScanResult(result);
    setScanLabel(label);
    if (result) setActive("all");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header search={search} onSearch={setSearch} />
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        {/* แถว filter + scan buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterTabs active={active} counts={counts} onChange={(k) => { setActive(k); setScanResult(null); }} />
          <ScanButtons onResult={handleScan} />
        </div>

        {/* FIX: แสดง label เมื่อ scan active */}
        {scanResult && (
          <div className="flex items-center justify-between rounded-md border border-border bg-card px-4 py-2">
            <span className="text-sm font-medium">
              {scanLabel} — เรียงตาม score สูงสุด
            </span>
            <button
              onClick={() => handleScan(null, "")}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ✕ ล้าง
            </button>
          </div>
        )}

        {isLoading && (
          <div className="text-center py-20 text-muted-foreground text-sm">
            <div className="inline-block size-6 border-2 border-buy border-t-transparent rounded-full animate-spin mb-3" />
            <div>กำลังโหลด signal...</div>
          </div>
        )}

        {error && (
          <div className="text-center py-20 text-sell text-sm">
            ไม่สามารถโหลดข้อมูลได้ — ลองรีเฟรชหรือตรวจสอบ watchlist ใน Settings
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-20 text-muted-foreground text-sm">
            {scanResult
              ? `ไม่มีหุ้นที่เป็น ${scanLabel.includes("Buy") ? "Buy" : "Sell"} ตอนนี้`
              : "ไม่มี signal ที่ตรงกับ filter นี้"}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s: Signal, i: number) => (
            <div key={s.ticker} className="relative">
              {/* FIX: แสดงอันดับเมื่อ scan */}
              {scanResult && (
                <span className="absolute -top-2 -left-2 z-10 flex size-6 items-center justify-center rounded-full bg-buy text-background text-xs font-bold">
                  {i + 1}
                </span>
              )}
              <SignalCard
                signal={s}
                isFav={favs.includes(s.ticker)}
                onToggleFav={toggleFav}
              />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
