
CREATE TABLE public.transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'topup',
  amount integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'RUB',
  status text NOT NULL DEFAULT 'completed',
  description text,
  reference_type text,
  reference_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_transactions_user_date ON public.transactions(user_id, created_at DESC);
CREATE INDEX idx_transactions_type ON public.transactions(user_id, type);
