import { createFileRoute } from "@tanstack/react-router";

// FIX: Proxy endpoint เพื่อเลี่ยง CORS เวลา Lovable เรียก Yahoo Finance search
// Browser เรียก Yahoo ตรงๆ ไม่ได้ ต้องผ่าน server นี้
export const Route = createFileRoute("/api/public/search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const q = url.searchParams.get("q")?.trim() ?? "";

        if (!q || q.length < 1) {
          return Response.json({ results: [] });
        }

        try {
          const yahooUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
            q,
          )}&quotesCount=8&newsCount=0&enableFuzzyQuery=true`;

          const res = await fetch(yahooUrl, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
              Accept: "application/json",
            },
          });

          if (!res.ok) {
            return Response.json({ results: [] });
          }

          const data: any = await res.json();
          const quotes = data?.quotes ?? [];

          const results = quotes
            .filter((qt: any) =>
              ["EQUITY", "ETF", "CRYPTOCURRENCY", "INDEX"].includes(qt.quoteType),
            )
            .map((qt: any) => ({
              ticker: qt.symbol ?? "",
              name: qt.longname ?? qt.shortname ?? "",
              type: qt.quoteType ?? "",
              exchange: qt.exchDisp ?? "",
            }));

          return Response.json(
            { results },
            {
              headers: {
                // cache 1 ชม. ลด load ไป Yahoo
                "Cache-Control": "public, max-age=3600",
              },
            },
          );
        } catch {
          return Response.json({ results: [] });
        }
      },
    },
  },
});
