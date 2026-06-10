import type { Signal } from "@/lib/types";
import { cn } from "@/lib/utils";

export function BacktestPanel({ signal }: { signal: Signal }) {
  const bt = signal.backtest;
  if (!bt) return null;
  const { params, perYear, totalReturn, winRate, mdd, trades } = bt;
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold">Backtest 3 ปี (Auto-tuned)</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Walk-forward: tune ปีก่อนหน้า → ทดสอบปีล่าสุด · recheck แต่ละปี
          </p>
        </div>
        <div className="text-xs text-muted-foreground tabular-nums">
          EMA {params.fast}/{params.slow}/{params.wave}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat label="Total Return" value={`${totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(1)}%`} positive={totalReturn >= 0} />
        <Stat label="Win Rate" value={`${winRate}%`} positive={winRate >= 50} />
        <Stat label="Max Drawdown" value={`${mdd.toFixed(1)}%`} positive={mdd > -15} />
        <Stat label="Trades" value={`${trades}`} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-muted-foreground border-b border-border">
            <tr>
              <th className="text-left py-2 px-2 font-medium">Year</th>
              <th className="text-right py-2 px-2 font-medium">Trades</th>
              <th className="text-right py-2 px-2 font-medium">Win Rate</th>
              <th className="text-right py-2 px-2 font-medium">Net Profit</th>
              <th className="text-right py-2 px-2 font-medium">MDD</th>
            </tr>
          </thead>
          <tbody>
            {perYear.map((y) => (
              <tr key={y.year} className="border-b border-border/50">
                <td className="py-2 px-2 font-medium tabular-nums">{y.year}</td>
                <td className="text-right py-2 px-2 tabular-nums">{y.trades}</td>
                <td className={cn("text-right py-2 px-2 tabular-nums", y.winRate >= 50 ? "text-buy" : "text-sell")}>
                  {y.winRate}%
                </td>
                <td className={cn("text-right py-2 px-2 tabular-nums", y.netProfit >= 0 ? "text-buy" : "text-sell")}>
                  {y.netProfit >= 0 ? "+" : ""}
                  {y.netProfit.toFixed(2)}%
                </td>
                <td className="text-right py-2 px-2 tabular-nums text-muted-foreground">
                  {y.mdd.toFixed(2)}%
                </td>
              </tr>
            ))}
            {!perYear.length && (
              <tr>
                <td colSpan={5} className="text-center py-4 text-muted-foreground">
                  ข้อมูลไม่พอ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Stat({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div
        className={cn(
          "text-base font-semibold tabular-nums mt-0.5",
          positive === true && "text-buy",
          positive === false && "text-sell",
        )}
      >
        {value}
      </div>
    </div>
  );
}
