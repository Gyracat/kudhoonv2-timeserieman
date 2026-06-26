# CDC Wave 3 + Chronos-Bolt API

Railway backend สำหรับ Kudhoon V2 — Chronos-Bolt ML จริงๆ

## Deploy

1. Push โฟลเดอร์นี้ขึ้น GitHub repo ใหม่
2. railway.app → New Project → Deploy from GitHub
3. เลือก repo → Railway auto-detect Python
4. รอ build (ครั้งแรก ~5-8 นาที เพราะต้องโหลด torch + chronos)
5. ได้ URL เช่น https://cdc-chronos.railway.app

## Test

    curl https://your-app.railway.app/health
    curl https://your-app.railway.app/signal/AAPL
    curl "https://your-app.railway.app/signals?tickers=AAPL,NVDA&filter=buy"

## เชื่อมกับ Lovable

ไปที่ Settings ใน Lovable app → ใส่ Railway URL ในช่อง "Railway API URL"
ระบบจะเปลี่ยนจาก statistical → Chronos-Bolt จริงอัตโนมัติ

## Endpoints

- GET /health — เช็คสถานะ
- GET /signal/{ticker} — 1 ticker พร้อม Chronos
- GET /signals?tickers=A,B,C&filter=all — หลายตัว
- GET /search?q=apple — ค้นหา ticker
