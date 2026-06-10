import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/cdc/Header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { EmailSubscribeBox } from "@/components/cdc/EmailSubscribeBox";
import { X } from "lucide-react";
import {
  getBaseUrl,
  setBaseUrl,
  getWatchlist,
  setWatchlist,
} from "@/lib/storage";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const [tickers, setTickers] = useState<string[]>([]);
  const [newTicker, setNewTicker] = useState("");

  useEffect(() => {
    setUrl(getBaseUrl());
    setTickers(getWatchlist());
  }, []);

  const save = () => {
    setBaseUrl(url.trim());
    setWatchlist(tickers);
    qc.invalidateQueries();
    toast.success("Settings saved");
  };

  const addTicker = () => {
    const t = newTicker.trim().toUpperCase();
    if (!t || tickers.includes(t)) return;
    setTickers([...tickers, t]);
    setNewTicker("");
  };

  const removeTicker = (t: string) => setTickers(tickers.filter((x) => x !== t));

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect to your Railway API and manage your watchlist.
          </p>
        </div>

        <EmailSubscribeBox />

        <section className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div>
            <Label htmlFor="base-url" className="text-sm">
              Railway API URL
            </Label>
            <p className="text-xs text-muted-foreground mt-1 mb-2">
              Leave empty to use Yahoo Finance directly.
            </p>
            <p className="text-xs text-muted-foreground mt-1 mb-2">
              Leave empty to use built-in mock data.
            </p>
            <Input
              id="base-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-app.railway.app"
              className="bg-background border-border"
            />
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div>
            <Label className="text-sm">Watchlist</Label>
            <p className="text-xs text-muted-foreground mt-1 mb-3">
              Tickers fetched on the dashboard.
            </p>
            <div className="flex flex-wrap gap-2">
              {tickers.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-background text-xs"
                >
                  {t}
                  <button
                    onClick={() => removeTicker(t)}
                    className="text-muted-foreground hover:text-sell"
                    aria-label={`Remove ${t}`}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <Input
                value={newTicker}
                onChange={(e) => setNewTicker(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTicker()}
                placeholder="Add ticker (e.g. NFLX)"
                className="bg-background border-border"
              />
              <Button onClick={addTicker} variant="secondary">
                Add
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Theme</Label>
              <p className="text-xs text-muted-foreground mt-1">Dark only for now.</p>
            </div>
            <span className="text-xs text-muted-foreground">Dark</span>
          </div>
        </section>

        <div className="flex justify-end">
          <Button onClick={save} className="bg-buy text-background hover:bg-buy/90">
            Save settings
          </Button>
        </div>
      </main>
    </div>
  );
}
