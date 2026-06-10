
-- Tighter subscriber insert: must look like a real email, reasonable length, active=true
DROP POLICY IF EXISTS "Anyone can subscribe" ON public.alert_subscribers;
CREATE POLICY "Anyone can subscribe with valid email"
  ON public.alert_subscribers FOR INSERT
  WITH CHECK (
    email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    AND length(email) <= 255
    AND array_length(tickers, 1) IS NULL OR array_length(tickers, 1) <= 50
  );

-- Explicit service_role-only policies (no public access)
CREATE POLICY "Service role only" ON public.signal_state
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role only" ON public.alert_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);
