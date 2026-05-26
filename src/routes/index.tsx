import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { fetchSignals } from "@/lib/api";
import { Header } from "@/components/cdc/Header";
import { FilterTabs, type FilterKey } from "@/components/cdc/FilterTabs";
import { SignalCard } from "@/components/cdc/SignalCard";
import { getFavorites, setFavorites } from "@/lib/storage";
import type { Signal } from "@/lib/types";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const [active, setActive] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [favs, setFavs] = useState<string[]>([]);

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
    return signals.filter((s) => {
      if (search && !s.ticker.toLowerCase().includes(search.toLowerCase())) return false;
      switch (active) {
        case "buy":
          return s.action === "BUY";
        case "sell":
          return s.action === "SELL";
        case "up":
          return s.ema12 > s.ema26;
        case "w1":
          return s.wave === "W1";
        case "w2":
          return s.wave === "W2";
        case "w3":
          return s.wave === "W3";
        case "fav":
          return favs.includes(s.ticker);
        default:
          return true;
      }
    });
  }, [signals, search, active, favs]);

  const toggleFav = (ticker: string) => {
    const next = favs.includes(ticker) ? favs.filter((t) => t !== ticker) : [...favs, ticker];
    setFavs(next);
    setFavorites(next);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header search={search} onSearch={setSearch} />
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <FilterTabs active={active} counts={counts} onChange={setActive} />

        {isLoading && (
          <div className="text-center py-20 text-muted-foreground text-sm">
            <div className="inline-block size-6 border-2 border-buy border-t-transparent rounded-full animate-spin mb-3" />
            <div>กำลังโหลด signal...</div>
          </div>
        )}

        {error && (
          <div className="text-center py-20 text-sell text-sm">
            ไม่สามารถเชื่อมต่อ Railway API — ตรวจสอบ URL ใน Settings
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-20 text-muted-foreground text-sm">
            ไม่มี signal ที่ตรงกับ filter นี้
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s: Signal) => (
            <SignalCard
              key={s.ticker}
              signal={s}
              isFav={favs.includes(s.ticker)}
              onToggleFav={toggleFav}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
