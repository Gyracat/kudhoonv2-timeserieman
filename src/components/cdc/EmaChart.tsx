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

export function EmaChart({ signal }: { signal: Signal }) {
  const zoom = Math.min(107, signal.prices.length);
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
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">EMA Chart (Wave Zoom: {zoom} days)</h3>
        <button className="text-xs text-muted-foreground hover:text-foreground cursor-pointer">
          Full Chart ↗
        </button>
      </div>
      <div className="h-80">
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
            <Legend
              iconType="circle"
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            />
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
      </div>
    </div>
  );
}
