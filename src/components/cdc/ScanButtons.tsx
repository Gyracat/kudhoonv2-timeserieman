import { useState } from "react";
import type { Signal } from "@/lib/types";
import { globalScan, rankSignals, type ScanProgress, type ScanScope } from "@/lib/globalScan";
import { TrendingUp, TrendingDown, Loader2, Globe } from "lucide-react";

/**
 * ScanButtons — Scan หุ้นจริงจาก Yahoo Screener (ไม่ hardcode)
 */
export function ScanButtons({
  onResult,
}: {
  onResult: (filtered: Signal[] | null, label: string) => void;
}) {
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [active, setActive] = useState<"buy" | "sell" | null>(null);
  const [scope, setScope] = useState<ScanScope>("active");
  const [cached, setCached] = useState<{ scope: ScanScope; data: Signal[] } | null>(null);

  const runScan = async (): Promise<Signal[]> => {
    // cache ตาม scope — ถ้าเปลี่ยน scope ต้อง scan ใหม่
    if (cached && cached.scope === scope) return cached.data;
    setScanning(true);
    try {
      const results = await globalScan(scope, 50, (p) => setProgress(p));
      setCached({ scope, data: results });
      return results;
    } finally {
      setScanning(false);
      setProgress(null);
    }
  };

  const doScan = async (side: "buy" | "sell") => {
    if (active === side) {
      setActive(null);
      onResult(null, "");
      return;
    }
    const all = await runScan();
    const ranked = rankSignals(all);
    const list = side === "buy" ? ranked.buy : ranked.sell;
    setActive(side);
    const emoji = side === "buy" ? "🟢" : "🔴";
    onResult(list, `${emoji} Top ${side === "buy" ? "Buy" : "Sell"} (${list.length}) จาก ${all.length} หุ้น`);
  };

  const scopeLabels: Record<ScanScope, string> = {
    active: "🔥 Active ตอนนี้",
    gainers: "📈 ขึ้นแรงวันนี้",
    losers: "📉 ลงแรงวันนี้",
    tech: "💻 Tech Growth",
    global: "🌍 ทั่วโลก",
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* เลือก scope */}
        <select
          value={scope}
          onChange={(e) => {
            setScope(e.target.value as ScanScope);
            setActive(null);
            onResult(null, "");
          }}
          disabled={scanning}
          className="text-xs rounded-md border border-border bg-card px-2 py-1.5 text-foreground disabled:opacity-50"
        >
          {Object.entries(scopeLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <button
          onClick={() => doScan("buy")}
          disabled={scanning}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium transition-colors disabled:opacity-50 ${
            active === "buy"
              ? "bg-buy text-background border-buy"
              : "bg-card text-buy border-buy/40 hover:border-buy"
          }`}
        >
          {scanning && active !== "sell" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <TrendingUp className="size-4" />
          )}
          Scan Buy
        </button>

        <button
          onClick={() => doScan("sell")}
          disabled={scanning}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium transition-colors disabled:opacity-50 ${
            active === "sell"
              ? "bg-sell text-background border-sell"
              : "bg-card text-sell border-sell/40 hover:border-sell"
          }`}
        >
          {scanning && active !== "buy" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <TrendingDown className="size-4" />
          )}
          Scan Sell
        </button>
      </div>

      {scanning && progress && (
        <div className="text-xs text-muted-foreground">
          <div className="flex items-center gap-2 mb-1">
            <Globe className="size-3 animate-spin" />
            <span>
              {progress.phase === "universe"
                ? progress.current
                : `วิเคราะห์ ${progress.done}/${progress.total} หุ้น...`}
            </span>
          </div>
          {progress.phase === "analyze" && (
            <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-buy transition-all"
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
