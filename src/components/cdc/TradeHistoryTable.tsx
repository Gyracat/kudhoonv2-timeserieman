import type { Trade } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TradeHistoryTable({ trades }: { trades: Trade[] }) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold">🕐 Full Trade History</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-muted-foreground">
            <tr className="border-b border-border">
              <th className="text-left px-3 py-2">#</th>
              <th className="text-left px-3 py-2">Lot</th>
              <th className="text-left px-3 py-2">Buy Date</th>
              <th className="text-right px-3 py-2">Buy Price</th>
              <th className="text-left px-3 py-2">Sell Date</th>
              <th className="text-right px-3 py-2">Sell Price</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-right px-3 py-2">Signal Gain</th>
              <th className="text-right px-3 py-2">B&amp;H</th>
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-6 text-muted-foreground">
                  No trades yet.
                </td>
              </tr>
            )}
            {trades.map((t, i) => (
              <tr key={i} className="border-b border-border/60 hover:bg-accent/30">
                <td className="px-3 py-2 tabular-nums text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-2 tabular-nums">{t.lot}</td>
                <td className="px-3 py-2 tabular-nums">{t.buyDate}</td>
                <td className="px-3 py-2 tabular-nums text-right">${t.buyPrice.toFixed(2)}</td>
                <td className="px-3 py-2 tabular-nums">{t.sellDate ?? "—"}</td>
                <td className="px-3 py-2 tabular-nums text-right">
                  {t.sellPrice !== null ? `$${t.sellPrice.toFixed(2)}` : "—"}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded text-[10px] border",
                      t.status === "Open"
                        ? "bg-ema12/15 text-ema12 border-ema12/40"
                        : "bg-muted text-muted-foreground border-border",
                    )}
                  >
                    {t.status}
                  </span>
                </td>
                <td
                  className={cn(
                    "px-3 py-2 tabular-nums text-right font-medium",
                    t.signalGain >= 0 ? "text-buy" : "text-sell",
                  )}
                >
                  {t.signalGain >= 0 ? "+" : ""}
                  {t.signalGain.toFixed(2)}%
                </td>
                <td
                  className={cn(
                    "px-3 py-2 tabular-nums text-right",
                    t.bh >= 0 ? "text-buy" : "text-sell",
                  )}
                >
                  {t.bh >= 0 ? "+" : ""}
                  {t.bh.toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
