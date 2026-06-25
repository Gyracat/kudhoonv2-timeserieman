import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Scatter,
  ComposedChart,
} from "recharts";
import type { Signal } from "@/lib/types";
import { calcSignalDots } from "@/lib/cdc";
import { X } from "lucide-react";

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-[var(--tooltip-bg)] px-3 py-2 text-xs shadow-lg">
      <div className="text-muted-foreground mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="inline-block size-2 rounded-full" style={{ background: p.color }} />
          <span className="text-foreground">{p.name}:</span>
          <span className="tabular-nums text-foreground">
            ${typeof p.value === "number" ? p.value.toFixed(2) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

const dotColors = {
  buy: "var(--buy)",
  nearBuy: "var(--nearbuy)",
  sell: "var(--sell)",
  wave3: "var(--wave)",
} as const;

// FIX: แยก chart body ออกมาเพื่อใช้ซ้ำทั้งแบบปกติและ full screen
// fullView = true → แสดงทุกวัน (ไม่ zoom แค่ 107)
function ChartBody({ signal, fullView = false }: { signal: Signal; fullView?: boolean }) {
  const zoom = fullView ? signal.prices.length : Math.min(107, signal.prices.length);
  const start = signal.prices.length - zoom;
  const dots = calcSignalDots(signal.prices, signal.waves);

  const data = signal.dates.slice(start).map((d, i) => {
    const realIdx = start + i;
    const dot = dots[realIdx];
    return {
      date: new Date(d).toLocaleDateString("en-US", { month: "short", day: "2-digit" }),
      price: signal.prices[realIdx],
      ema12: signal.ema12s[realIdx],
      ema26: signal.ema26s[realIdx],
      ema55: signal.ema55s[realIdx],
      buyDot: dot.type === "buy" ? signal.prices[realIdx] : null,
      nearBuyDot: dot.type === "nearBuy" ? signal.prices[realIdx] : null,
      sellDot: dot.type === "sell" ? signal.prices[realIdx] : null,
      wave3Dot: dot.type === "wave3" ? signal.prices[realIdx] : null,
    };
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
        <XAxis
          dataKey="date"
          stroke="var(--muted-foreground)"
          tick={{ fontSize: 11 }}
          interval={Math.max(0, Math.floor(data.length / 12) - 1)}
        />
        <YAxis
          stroke="var(--muted-foreground)"
          tick={{ fontSize: 11 }}
          tickFormatter={(v) => `$${Math.round(v)}`}
          domain={["auto", "auto"]}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
        <Line
          type="monotone"
          dataKey="ema55"
          name="Wave Pattern"
          stroke="var(--wave)"
          strokeWidth={1.5}
          strokeDasharray="6 4"
          dot={false}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="price"
          name="Price"
          stroke="var(--price)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="ema12"
          name="EMA 12"
          stroke="var(--ema12)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          dot={false}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="ema26"
          name="EMA 26"
          stroke="var(--ema26)"
          strokeWidth={1.5}
          strokeDasharray="6 4"
          dot={false}
          isAnimationActive={false}
        />
        <Scatter dataKey="buyDot" name="Buy" fill={dotColors.buy} shape="circle" />
        <Scatter dataKey="nearBuyDot" name="Near Buy" fill={dotColors.nearBuy} shape="circle" />
        <Scatter dataKey="sellDot" name="Sell" fill={dotColors.sell} shape="circle" />
        <Scatter dataKey="wave3Dot" name="Wave 3" fill={dotColors.wave3} shape="circle" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function EmaChart({ signal }: { signal: Signal }) {
  // FIX: state สำหรับเปิด/ปิด full screen modal
  const [fullScreen, setFullScreen] = useState(false);
  const zoom = Math.min(107, signal.prices.length);

  return (
    <>
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">EMA Chart (Wave Zoom: {zoom} days)</h3>
          {/* FIX: เพิ่ม onClick เปิด full screen */}
          <button
            onClick={() => setFullScreen(true)}
            className="text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          >
            Full Chart ↗
          </button>
        </div>
        <div className="h-80">
          <ChartBody signal={signal} />
        </div>
      </div>

      {/* FIX: Full screen modal */}
      {fullScreen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setFullScreen(false)}
        >
          <div
            className="relative flex h-[90vh] w-full max-w-7xl flex-col rounded-lg border border-border bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  {signal.ticker} — Full Chart
                </h2>
                <p className="text-sm text-muted-foreground">
                  {signal.name} · ${signal.price.toFixed(2)} ·{" "}
                  {signal.prices.length} days
                </p>
              </div>
              <button
                onClick={() => setFullScreen(false)}
                className="rounded-md border border-border p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1">
              <ChartBody signal={signal} fullView />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
