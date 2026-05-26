import { cn } from "@/lib/utils";
import type { Signal } from "@/lib/types";
import { calcStats } from "@/lib/cdc";

function StatCell({
  label,
  value,
  cls,
}: {
  label: string;
  value: string;
  cls?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-center">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("text-lg font-semibold tabular-nums mt-1", cls)}>{value}</div>
    </div>
  );
}

function pctCls(v: number) {
  return v > 0 ? "text-buy" : v < 0 ? "text-sell" : "text-foreground";
}

export function StatsBar({ signal }: { signal: Signal }) {
  const s = calcStats(signal.trades);
  const statusCls =
    signal.action === "BUY" ? "text-buy" : signal.action === "SELL" ? "text-sell" : "text-foreground";
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
      <StatCell label="Status" value={signal.action} cls={statusCls} />
      <StatCell
        label="Sig Gain"
        value={`${s.signalGain >= 0 ? "+" : ""}${s.signalGain}%`}
        cls={pctCls(s.signalGain)}
      />
      <StatCell
        label="Net Profit"
        value={`${s.netProfit >= 0 ? "+" : ""}${s.netProfit}%`}
        cls={pctCls(s.netProfit)}
      />
      <StatCell label="MDD" value={`${s.mdd}%`} cls={pctCls(s.mdd)} />
      <StatCell label="Trades" value={`${s.trades}`} />
      <StatCell label="Win Rate" value={`${s.winRate}%`} />
    </div>
  );
}
