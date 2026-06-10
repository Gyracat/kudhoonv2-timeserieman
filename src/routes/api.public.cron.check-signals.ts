import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { calcEMA, detectWaveStages } from "@/lib/cdc";
import { DEFAULT_WATCHLIST } from "@/lib/mockData";

type Bar = {
  ticker: string;
  name: string;
  prices: number[];
};

async function fetchBar(ticker: string): Promise<Bar | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker,
  )}?range=6mo&interval=1d&includePrePost=false`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    const json: any = await res.json();
    const r = json?.chart?.result?.[0];
    if (!r) return null;
    const closes: (number | null)[] = r.indicators?.quote?.[0]?.close ?? [];
    const prices: number[] = [];
    for (const c of closes) if (c != null) prices.push(+c.toFixed(2));
    if (!prices.length) return null;
    return { ticker: r.meta?.symbol ?? ticker, name: r.meta?.longName ?? r.meta?.shortName ?? ticker, prices };
  } catch {
    return null;
  }
}

function computeAction(prices: number[]): { action: "BUY" | "SELL" | "WATCH" | "WAIT"; wave: string; price: number } {
  const ema12 = calcEMA(prices, 12);
  const ema26 = calcEMA(prices, 26);
  const ema55 = calcEMA(prices, 55);
  const waves = detectWaveStages(prices, ema12, ema26, ema55);
  const last = prices.length - 1;
  const wave = waves[last];
  let action: "BUY" | "SELL" | "WATCH" | "WAIT" = "WAIT";
  if (wave === "W1" || wave === "W3") action = "BUY";
  else if (wave === "SELL") action = "SELL";
  else if (wave === "W2") action = "WATCH";
  else if (wave === "HOLD" && ema12[last] > ema26[last]) action = "WATCH";
  return { action, wave, price: prices[last] };
}

async function sendEmail(args: {
  to: string;
  ticker: string;
  name: string;
  action: "BUY" | "SELL";
  price: number;
}): Promise<boolean> {
  const url = process.env.LOVABLE_APP_URL ?? "";
  const apiBase = url || "";
  // Try Lovable Emails transactional send route (requires email infra + domain)
  try {
    const res = await fetch(`${apiBase}/lovable/email/transactional/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // service-to-service: use service role to allow auth bypass when route accepts it
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}`,
      },
      body: JSON.stringify({
        templateName: "signal-alert",
        recipientEmail: args.to,
        idempotencyKey: `${args.ticker}-${args.action}-${new Date().toISOString().slice(0, 13)}`,
        templateData: {
          ticker: args.ticker,
          name: args.name,
          action: args.action,
          price: args.price,
        },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/public/cron/check-signals")({
  server: {
    handlers: {
      POST: async () => {
        // 1) Gather subscribers and the universe of tickers to scan
        const { data: subs } = await supabaseAdmin
          .from("alert_subscribers")
          .select("email, tickers, active")
          .eq("active", true);

        const subscribers = subs ?? [];
        const customTickers = new Set<string>();
        let hasGlobal = false;
        for (const s of subscribers) {
          const t = (s.tickers as string[]) ?? [];
          if (!t.length) hasGlobal = true;
          else t.forEach((x) => customTickers.add(x.toUpperCase()));
        }
        const universe = Array.from(
          new Set([...(hasGlobal ? DEFAULT_WATCHLIST : []), ...customTickers]),
        );

        const changes: {
          ticker: string;
          name: string;
          action: "BUY" | "SELL";
          price: number;
        }[] = [];

        // 2) Scan tickers in parallel batches
        const batches: string[][] = [];
        for (let i = 0; i < universe.length; i += 8) batches.push(universe.slice(i, i + 8));

        for (const batch of batches) {
          await Promise.all(
            batch.map(async (ticker) => {
              const bar = await fetchBar(ticker);
              if (!bar || bar.prices.length < 60) return;
              const { action, wave, price } = computeAction(bar.prices);

              const { data: prev } = await supabaseAdmin
                .from("signal_state")
                .select("last_action")
                .eq("ticker", ticker)
                .maybeSingle();

              const prevAction = prev?.last_action ?? null;
              const changed = prevAction !== action && (action === "BUY" || action === "SELL");

              await supabaseAdmin
                .from("signal_state")
                .upsert({
                  ticker,
                  last_action: action,
                  last_wave: wave,
                  last_price: price,
                  updated_at: new Date().toISOString(),
                });

              if (changed) {
                changes.push({ ticker, name: bar.name, action: action as "BUY" | "SELL", price });
              }
            }),
          );
        }

        // 3) For each change, notify relevant subscribers
        let sent = 0;
        for (const ch of changes) {
          const recipients = subscribers.filter((s) => {
            const t = (s.tickers as string[]) ?? [];
            return t.length === 0 || t.includes(ch.ticker);
          });
          for (const r of recipients) {
            const ok = await sendEmail({
              to: r.email,
              ticker: ch.ticker,
              name: ch.name,
              action: ch.action,
              price: ch.price,
            });
            await supabaseAdmin.from("alert_log").insert({
              email: r.email,
              ticker: ch.ticker,
              action: ch.action,
              price: ch.price,
            });
            if (ok) sent++;
          }
        }

        return Response.json({
          ok: true,
          scanned: universe.length,
          subscribers: subscribers.length,
          changes: changes.length,
          emails_sent: sent,
        });
      },
    },
  },
});
