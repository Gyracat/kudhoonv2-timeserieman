import type { Signal } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

function Row({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("tabular-nums font-medium", cls)}>{value}</span>
    </div>
  );
}

export function ChronosPanel({ signal }: { signal: Signal }) {
  const dirCls =
    signal.chronos_direction === "BUY"
      ? "text-buy"
      : signal.chronos_direction === "SELL"
        ? "text-sell"
        : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          🤖 Chronos-Bolt Confirmation
        </h3>
        <span
          className={cn(
            "text-[11px] px-2 py-1 rounded border",
            signal.cdc_agree
              ? "bg-buy/15 text-buy border-buy/40"
              : "bg-muted text-muted-foreground border-border",
          )}
        >
          {signal.cdc_agree ? "Chronos ✓" : "Chronos fallback"}
        </span>
      </div>

      {!signal.cdc_agree && (
        <div className="flex items-center gap-2 rounded-md border border-wave/40 bg-wave/10 text-wave px-3 py-2 text-xs">
          <AlertTriangle className="size-4" />
          CDC และ Chronos ขัดกัน — แนะนำ WAIT
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
        <div className="space-y-2">
          <Row
            label="Direction:"
            value={`${signal.chronos_direction} (${signal.chronos_confidence})`}
            cls={dirCls}
          />
          <Row label="Volatility:" value={`${signal.volatility_pct.toFixed(2)}%`} />
          <Row label="Vol Spike:" value={signal.vol_spike ? "Yes ✓" : "No"} cls={signal.vol_spike ? "text-wave" : ""} />
          <Row label="Lot Size:" value={`${signal.lot_size_pct}%`} />
          <Row label="CDC Agree:" value={signal.cdc_agree ? "✓ Yes" : "✗ No"} cls={signal.cdc_agree ? "text-buy" : "text-sell"} />
        </div>
        <div className="space-y-2">
          <Row label="P10 (worst):" value={`$${signal.p10.toFixed(2)}`} />
          <Row label="P50 (median):" value={`$${signal.p50.toFixed(2)}`} />
          <Row label="P90 (best):" value={`$${signal.p90.toFixed(2)}`} />
          <Row
            label="Upside:"
            value={`${signal.upside_pct >= 0 ? "+" : ""}${signal.upside_pct.toFixed(2)}%`}
            cls={signal.upside_pct >= 0 ? "text-buy" : "text-sell"}
          />
          <Row
            label="Downside:"
            value={`${signal.downside_pct >= 0 ? "+" : ""}${signal.downside_pct.toFixed(2)}%`}
            cls={signal.downside_pct >= 0 ? "text-buy" : "text-sell"}
          />
        </div>
      </div>
    </div>
  );
}
