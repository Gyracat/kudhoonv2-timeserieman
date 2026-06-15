DROP POLICY IF EXISTS "Anyone can subscribe with valid email" ON public.alert_subscribers;
CREATE POLICY "Anyone can subscribe with valid email"
ON public.alert_subscribers
FOR INSERT
TO public
WITH CHECK (
  (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
  AND (length(email) <= 255)
  AND (COALESCE(array_length(tickers, 1), 0) <= 50)
);