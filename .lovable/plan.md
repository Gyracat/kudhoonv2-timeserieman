## เป้าหมาย
1. **Backtest 3 ปี + auto-tune** ต่อหุ้น เลือก EMA combo ที่ดีที่สุด (walk-forward: tune ปี 1-2 → test ปี 3, recheck)
2. **Email alert real-time**: ผู้ใช้กรอกอีเมล → ระบบเช็คทุก 15 นาที → ส่งเมลเมื่อมีตัวไหน BUY/SELL ใหม่

---

## ส่วนที่ 1 — Backtest & Auto-Tune (Frontend, no backend needed)

### ขยายข้อมูล Yahoo
- เปลี่ยน `fetchYahooBars` ใช้ `range=3y` (จากเดิม 1y)

### `src/lib/tuner.ts` (ใหม่)
- `gridSearch(prices, dates)` — ลอง EMA combos: fast ∈ {8,10,12,15}, slow ∈ {21,26,34}, wave ∈ {50,55,89}
- สำหรับแต่ละ combo: รัน `detectWaveStages` + `buildTrades`, คำนวณ `netProfit`, `winRate`, `mdd`
- **Walk-forward**: split เป็น 3 ปี — tune บนปี 1+2 (in-sample) → validate ปี 3 (out-of-sample)
- คะแนนรวม = `netProfit × winRate / (1 + |mdd|)` — เลือก combo ที่ดีที่สุด
- คืน `{ best: {fast, slow, wave}, perYear: [{year, netProfit, winRate, trades}] }`

### `buildSignal.ts`
- รับ optional `params` — ถ้าไม่ส่ง รัน `gridSearch` แล้วใช้ best params
- แนบ `backtest: { params, perYear, totalReturn, winRate, mdd }` ใน Signal

### UI
- เพิ่ม `BacktestPanel` ในหน้า `signal/$ticker` — โชว์ตาราง 3 ปี + best params + กราฟ equity curve
- ใน `SignalCard` โชว์ badge "Win 65% · 3y +42%" สั้น ๆ

---

## ส่วนที่ 2 — Email Alerts (ต้องเปิด Lovable Cloud)

### Cloud + Email infra setup
1. เปิด Lovable Cloud (`supabase--enable`)
2. ตั้งค่า email domain (`email_domain--check_email_domain_status` → setup ถ้ายังไม่มี)
3. `email_domain--setup_email_infra` + `scaffold_transactional_email`

### Database (migration)
```sql
-- ผู้ติดตามอีเมล
create table public.alert_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  tickers text[] not null default '{}',  -- ถ้า [] = ทุกตัวใน watchlist
  active boolean default true,
  created_at timestamptz default now()
);

-- log signal ล่าสุดต่อหุ้น (กันส่งซ้ำ)
create table public.signal_state (
  ticker text primary key,
  last_action text not null,        -- BUY / SELL / WATCH / WAIT
  last_wave text,
  last_price numeric,
  updated_at timestamptz default now()
);

-- log การส่งเมล
create table public.alert_log (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  ticker text not null,
  action text not null,
  price numeric,
  sent_at timestamptz default now()
);
```
+ RLS policies + grants ตามมาตรฐาน

### Email template
- `src/lib/email-templates/signal-alert.tsx` — แสดง ticker, action (BUY/SELL), price, EMA trend, link ไปหน้า signal

### Cron route `/api/public/cron/check-signals`
- ทุก 15 นาที: pg_cron → POST endpoint นี้
- Loop ทุก ticker ใน watchlist + tickers ที่ subscriber custom
- เทียบ action ใหม่ vs `signal_state.last_action` → ถ้าเปลี่ยนเป็น BUY/SELL → enqueue email ให้ subscribers ที่เกี่ยวข้อง
- อัปเดต `signal_state`

### UI
- เพิ่ม `EmailSubscribeBox` ใน Header หรือ Settings — กรอกอีเมล + เลือก tickers (default = ทั้งหมด) → POST server fn `subscribeAlerts`
- หน้า unsubscribe ตาม email template footer

---

## เทคนิคสำคัญ
- Walk-forward ป้องกัน overfit — tune กับข้อมูลเก่า ทดสอบกับข้อมูลใหม่
- Cron ใช้ `/api/public/*` route + signature/secret header เพื่อป้องกัน abuse
- กันส่งซ้ำด้วย `signal_state` + check ใน `alert_log` ก่อนยิง

---

## ลำดับงาน
1. Yahoo 3y + tuner + backtest panel
2. เปิด Cloud + email infra
3. Tables + server fn (subscribe / cron)
4. Email template + cron schedule
5. UI subscribe box

โอเคไหมครับ? หรือมีจุดไหนอยากตัด/เพิ่ม เช่นรอบ cron, จำนวน EMA combos, หรือฟิลด์ใน email?