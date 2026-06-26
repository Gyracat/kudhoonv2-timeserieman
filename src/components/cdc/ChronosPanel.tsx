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

  // FIX: ตรวจ model ที่ใช้ — lstm / chronos / statistical
  const model = (signal as any).forecast_model ?? "statistical";
  const isReal = model === "lstm" || model === "chronos";

  const modelLabel =
    model === "lstm"
      ? "🧠 TensorFlow.js LSTM"
      : model === "chronos"
        ? "🤖 Chronos-Bolt"
        : "📊 Statistical Forecast";

  const badgeLabel =
    model === "lstm"
      ? "LSTM ML ✓"
      : model === "chronos"
        ? "Chronos ML ✓"
        : "Statistical";

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          {modelLabel}
        </h3>
        <span
          className={cn(
            "text-[11px] px-2 py-1 rounded border",
            isReal
              ? "bg-buy/15 text-buy border-buy/40"
              : "bg-muted text-muted-foreground border-border",
          )}
        >
          {badgeLabel}
        </span>
      </div>

      {/* FIX: บอก user ตรงๆ ว่าตอนนี้ใช้ mode ไหน */}
      {!isReal && (
        <div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <AlertTriangle className="size-4 mt-0.5 shrink-0" />
          <span>
            ตัวเลขนี้คำนวณจาก volatility ธรรมดา ไม่ใช่ ML — model กำลังโหลด
            หรือข้อมูลไม่พอ train
          </span>
        </div>
      )}

      {model === "lstm" && (
        <div className="flex items-start gap-2 rounded-md border border-ema12/30 bg-ema12/5 px-3 py-2 text-xs text-muted-foreground">
          <span>
            🧠 LSTM neural network — train บน 1 ปีล่าสุด, quantile จาก residual
            จริง (ไม่สมมติ Gaussian). Educational use, ไม่ใช่คำแนะนำการลงทุน
          </span>
        </div>
      )}

      {!signal.cdc_agree && (
        <div className="flex items-center gap-2 rounded-md border border-wave/40 bg-wave/10 text-wave px-3 py-2 text-xs">
          <AlertTriangle className="size-4" />
          CDC และ {isReal ? "Chronos" : "forecast"} ขัดกัน — แนะนำ WAIT
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
          <Row
            label="Vol Spike:"
            value={signal.vol_spike ? "Yes ✓" : "No"}
            cls={signal.vol_spike ? "text-wave" : ""}
          />
          <Row label="Lot Size:" value={`${signal.lot_size_pct}%`} />
          <Row
            label="CDC Agree:"
            value={signal.cdc_agree ? "✓ Yes" : "✗ No"}
            cls={signal.cdc_agree ? "text-buy" : "text-sell"}
          />
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

      {/* FIX: แสดง out-of-sample backtest ถ้ามี */}
      {signal.backtest?.oosWinRate != null && signal.backtest.oosWinRate > 0 && (
        <div className="pt-2 border-t border-border text-xs text-muted-foreground">
          Out-of-sample validation: Win {signal.backtest.oosWinRate}% · Return{" "}
          {signal.backtest.oosReturn! >= 0 ? "+" : ""}
          {signal.backtest.oosReturn}% (data ที่ไม่เคยเห็น)
        </div>
      )}
    </div>
  );
}
