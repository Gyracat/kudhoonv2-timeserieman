import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, RotateCw, Search, Settings, TrendingUp } from "lucide-react";
import { fetchSignal } from "@/lib/api";
import { EmaChart } from "@/components/cdc/EmaChart";
import { StatsBar } from "@/components/cdc/StatsBar";
import { ChronosPanel } from "@/components/cdc/ChronosPanel";
import { TradeHistoryTable } from "@/components/cdc/TradeHistoryTable";
import { BacktestPanel } from "@/components/cdc/BacktestPanel";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/signal/$ticker")({
  component: SignalDetail,
});

function SignalDetail() {
  const { ticker } = useParams({ from: "/signal/$ticker" });
  const qc = useQueryClient();
  const { data: signal, isLoading } = useQuery({
    queryKey: ["signal", ticker],
    queryFn: () => fetchSignal(ticker),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground text-sm">
        <div>
          <div className="inline-block size-6 border-2 border-buy border-t-transparent rounded-full animate-spin mb-3" />
          <div>กำลังโหลด signal...</div>
        </div>
      </div>
    );
  }
  if (!signal) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground text-sm">
        Signal not found.
      </div>
    );
  }

  const trendUp = signal.ema12 > signal.ema26;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link
            to="/"
            className="p-2 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
            aria-label="Back"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="w-8 h-8 rounded bg-secondary grid place-items-center text-xs font-bold">
            {signal.ticker.slice(0, 2)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{signal.ticker}</span>
              <span className="text-xs text-muted-foreground">{signal.name}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-base tabular-nums">${signal.price.toFixed(2)}</span>
              <span className="px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                US Stocks
              </span>
              {trendUp && (
                <span className="px-1.5 py-0.5 rounded bg-secondary text-buy inline-flex items-center gap-1">
                  <TrendingUp className="size-3" /> Uptrend
                </span>
              )}
            </div>
          </div>
          <div className="flex-1" />
          <span
            className={cn(
              "text-xs font-semibold px-2 py-1 rounded border",
              signal.action === "BUY"
                ? "bg-buy/15 text-buy border-buy/40"
                : signal.action === "SELL"
                  ? "bg-sell/15 text-sell border-sell/40"
                  : "bg-muted text-muted-foreground border-border",
            )}
          >
            ↗ {signal.action}
          </span>
          <button className="p-2 rounded hover:bg-accent text-muted-foreground hover:text-foreground">
            <Search className="size-4" />
          </button>
          <Link
            to="/settings"
            className="p-2 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
          >
            <Settings className="size-4" />
          </Link>
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ["signal", ticker] })}
            className="p-2 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
            aria-label="Refresh"
          >
            <RotateCw className="size-4" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <EmaChart signal={signal} />
        <StatsBar signal={signal} />
        <BacktestPanel signal={signal} />
        <ChronosPanel signal={signal} />
        <TradeHistoryTable trades={signal.trades} />
      </main>
    </div>
  );
}
