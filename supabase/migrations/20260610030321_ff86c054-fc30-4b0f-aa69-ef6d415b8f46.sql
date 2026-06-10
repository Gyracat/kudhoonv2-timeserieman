
-- alert_subscribers: email + list of tickers to watch (empty array = all default watchlist)
CREATE TABLE public.alert_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  tickers text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.alert_subscribers TO anon;
GRANT SELECT, INSERT, UPDATE ON public.alert_subscribers TO authenticated;
GRANT ALL ON public.alert_subscribers TO service_role;
ALTER TABLE public.alert_subscribers ENABLE ROW LEVEL SECURITY;
-- public subscribe: anyone can insert their email
CREATE POLICY "Anyone can subscribe"
  ON public.alert_subscribers FOR INSERT
  WITH CHECK (true);
-- no public select/update (manage via service_role only)

-- signal_state: last action per ticker, used to detect changes
CREATE TABLE public.signal_state (
  ticker text PRIMARY KEY,
  last_action text NOT NULL,
  last_wave text,
  last_price numeric,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.signal_state TO service_role;
ALTER TABLE public.signal_state ENABLE ROW LEVEL SECURITY;
-- service_role only

-- alert_log: history of alerts sent
CREATE TABLE public.alert_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ticker text NOT NULL,
  action text NOT NULL,
  price numeric,
  sent_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.alert_log TO service_role;
ALTER TABLE public.alert_log ENABLE ROW LEVEL SECURITY;
-- service_role only
