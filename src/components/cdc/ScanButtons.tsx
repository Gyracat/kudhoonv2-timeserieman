import { useState } from "react";
import type { Signal } from "@/lib/types";
import { TrendingUp, TrendingDown, Loader2 } from "lucide-react";

/**
 * ScanButtons — ปุ่ม Scan Top Buy / Top Sell
 * เรียง signal ที่โหลดมาแล้วตาม score → แสดง top picks
 *
 * วิธีใช้ใน dashboard:
 *   <ScanButtons signals={signals} onResult={(list) => setFiltered(list)} />
 */
export function ScanButtons({
  signals,
  onResult,
}: {
  signals: Signal[];
  onResult: (filtered: Signal[] | null, label: string) => void;
}) {
  const [active, setActive] = useState<"buy" | "sell" | null>(null);

  const scanBuy = () => {
    if (active === "buy") {
      // กดซ้ำ → ยกเลิก
      setActive(null);
      onResult(null, "");
      return;
    }
    setActive("buy");
    const buys = signals
      .filter((s) => s.action === "BUY")
      .sort((a, b) => b.score - a.score); // เรียง score สูง→ต่ำ
    onResult(buys, `🟢 Top Buy (${buys.length})`);
  };

  const scanSell = () => {
    if (active === "sell") {
      setActive(null);
      onResult(null, "");
      return;
    }
    setActive("sell");
    const sells = signals
      .filter((s) => s.action === "SELL")
      .sort((a, b) => b.score - a.score);
    onResult(sells, `🔴 Top Sell (${sells.length})`);
  };

  const buyCount = signals.filter((s) => s.action === "BUY").length;
  const sellCount = signals.filter((s) => s.action === "SELL").length;

  return (
    <div className="flex gap-2">
      <button
        onClick={scanBuy}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
          active === "buy"
            ? "bg-buy text-background border-buy"
            : "bg-card text-buy border-buy/40 hover:border-buy"
        }`}
      >
        <TrendingUp className="size-4" />
        Scan Buy ({buyCount})
      </button>

      <button
        onClick={scanSell}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
          active === "sell"
            ? "bg-sell text-background border-sell"
            : "bg-card text-sell border-sell/40 hover:border-sell"
        }`}
      >
        <TrendingDown className="size-4" />
        Scan Sell ({sellCount})
      </button>
    </div>
  );
}
