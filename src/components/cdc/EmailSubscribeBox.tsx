import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Mail, BellRing } from "lucide-react";
import { toast } from "sonner";
import { subscribeAlerts } from "@/lib/subscribe.functions";
import { getWatchlist } from "@/lib/storage";

export function EmailSubscribeBox() {
  const subscribe = useServerFn(subscribeAlerts);
  const [email, setEmail] = useState("");
  const [tickers, setTickers] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.includes("@")) {
      toast.error("กรุณาใส่อีเมลให้ถูกต้อง");
      return;
    }
    setLoading(true);
    try {
      const list = tickers
        .split(",")
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean);
      const res = await subscribe({ data: { email, tickers: list } });
      toast.success(
        res.updated ? "อัปเดตการแจ้งเตือนแล้ว" : "สมัครรับแจ้งเตือนสำเร็จ!",
        {
          description: list.length
            ? `จะส่งเมลเมื่อ ${list.length} ตัวมี BUY/SELL`
            : `จะส่งเมลทุกตัวใน watchlist (${getWatchlist().length} ตัว) เมื่อมี BUY/SELL`,
        },
      );
      setEmail("");
      setTickers("");
    } catch (e: any) {
      toast.error("สมัครไม่สำเร็จ", { description: e?.message ?? "" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-lg border border-border bg-card p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="size-9 rounded-md bg-wave/15 text-wave grid place-items-center">
          <BellRing className="size-4" />
        </div>
        <div>
          <Label className="text-sm font-semibold">แจ้งเตือนผ่านอีเมลแบบ Real-time</Label>
          <p className="text-xs text-muted-foreground mt-1">
            ระบบจะตรวจ signal ทุก 15 นาที และส่งเมลทันทีเมื่อมีตัวไหนเปลี่ยนเป็น BUY หรือ SELL
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <Label htmlFor="alert-email" className="text-xs">
            อีเมล
          </Label>
          <div className="relative mt-1">
            <Mail className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              id="alert-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="bg-background border-border pl-9"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="alert-tickers" className="text-xs">
            หุ้นที่ติดตาม (เว้นว่าง = ทุกตัวใน watchlist)
          </Label>
          <Input
            id="alert-tickers"
            value={tickers}
            onChange={(e) => setTickers(e.target.value)}
            placeholder="AAPL, MSFT, NVDA"
            className="bg-background border-border mt-1"
          />
        </div>
        <Button
          onClick={submit}
          disabled={loading}
          className="w-full bg-buy text-background hover:bg-buy/90"
        >
          {loading ? "กำลังสมัคร..." : "สมัครรับแจ้งเตือน"}
        </Button>
      </div>
    </section>
  );
}
