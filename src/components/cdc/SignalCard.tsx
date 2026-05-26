import { Link } from "@tanstack/react-router";
import { Heart, X, TrendingUp, ChevronDown } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import type { Signal } from "@/lib/types";
import { cn } from "@/lib/utils";
import { WavePhaseBar } from "./WavePhaseBar";

function ActionChip({ action }: { action: Signal["action"] }) {
  const map = {
    BUY: { cls: "bg-buy/15 text-buy border-buy/40", arrow: "↗" },
    SELL: { cls: "bg-sell/15 text-sell border-sell/40", arrow: "↘" },
    WATCH: { cls: "bg-muted text-muted-foreground border-border", arrow: "•" },
    WAIT: { cls: "bg-muted text-muted-foreground border-border", arrow: "⋯" },
  } as const;
  const m = map[action];
  return (
    <span className={cn("px-2 py-0.5 rounded text-[11px] font-semibold border", m.cls)}>
      {m.arrow} {action}
    </span>
  );
}

export function SignalCard({
  signal,
  isFav,
  onToggleFav,
  onDismiss,
}: {
  signal: Signal;
  isFav: boolean;
  onToggleFav: (t: string) => void;
  onDismiss?: (t: string) => void;
}) {
  const borderCls =
    signal.action === "BUY"
      ? "border-l-buy bg-buy/[0.04]"
      : signal.action === "SELL"
        ? "border-l-sell bg-sell/[0.04]"
        : "border-l-border";

  const trendUp = signal.ema12 > signal.ema26;
  const chartData = signal.prices.slice(-60).map((p, i) => ({ i, p }));
  const dateLabel = new Date(signal.date).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
  const lastTrades = signal.trades.slice(-3);

  return (
    <div
      className={cn(
        "rounded-lg border border-border border-l-4 bg-card p-4 flex flex-col gap-3 transition-colors hover:bg-accent/30",
        borderCls,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-secondary grid place-items-center text-xs font-bold">
            {signal.ticker.slice(0, 2)}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm">{signal.ticker}</span>
              <span className="text-[10px] px-1 py-0.5 rounded bg-buy/20 text-buy">NEW</span>
            </div>
            <div className="text-lg font-semibold tabular-nums">
              ${signal.price.toFixed(2)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ActionChip action={signal.action} />
          <button
            onClick={() => onToggleFav(signal.ticker)}
            className="text-muted-foreground hover:text-wave transition-colors cursor-pointer"
            aria-label="favorite"
          >
            <Heart className={cn("size-4", isFav && "fill-wave text-wave")} />
          </button>
          {onDismiss && (
            <button
              onClick={() => onDismiss(signal.ticker)}
              className="text-muted-foreground hover:text-foreground cursor-pointer"
              aria-label="dismiss"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        {trendUp && (
          <span className="px-2 py-0.5 rounded bg-secondary text-foreground inline-flex items-center gap-1">
            <TrendingUp className="size-3" /> Up
          </span>
        )}
        {signal.wave?.startsWith("W") && (
          <span className="px-2 py-0.5 rounded bg-secondary text-wave">≋ {signal.wave}</span>
        )}
        <span className="px-2 py-0.5 rounded bg-secondary text-muted-foreground">
          📅 {dateLabel}
        </span>
      </div>

      <div className="text-xs text-muted-foreground flex items-center gap-1">
        <ChevronDown className="size-3" /> EMA Chart
      </div>
      <div className="h-16">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <YAxis hide domain={["dataMin", "dataMax"]} />
            <Line
              type="monotone"
              dataKey="p"
              stroke={signal.action === "SELL" ? "var(--sell)" : "var(--buy)"}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <WavePhaseBar phase={signal.wavePhase} />

      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Total Signal Gain</span>
        <span className={cn("font-semibold tabular-nums", signal.signalGain >= 0 ? "text-buy" : "text-sell")}>
          {signal.signalGain >= 0 ? "+" : ""}
          {signal.signalGain.toFixed(2)}%
        </span>
      </div>

      {lastTrades.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground flex items-center gap-1">
            <ChevronDown className="size-3" /> Last {lastTrades.length} Trades
          </summary>
          <div className="mt-2 space-y-1">
            {lastTrades.map((t, i) => (
              <div key={i} className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">{t.buyDate}</span>
                <span className={cn("tabular-nums", t.signalGain >= 0 ? "text-buy" : "text-sell")}>
                  {t.signalGain >= 0 ? "+" : ""}
                  {t.signalGain.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      <Link
        to="/signal/$ticker"
        params={{ ticker: signal.ticker }}
        className="mt-1 text-center text-xs py-2 rounded border border-border hover:bg-accent transition-colors text-foreground"
      >
        View Details ↗
      </Link>
    </div>
  );
}
