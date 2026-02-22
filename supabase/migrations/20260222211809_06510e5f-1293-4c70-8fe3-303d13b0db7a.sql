
-- Ask queries table
CREATE TABLE public.ask_queries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  question text NOT NULL,
  include_workplace boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ask_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own queries" ON public.ask_queries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own queries" ON public.ask_queries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own queries" ON public.ask_queries FOR UPDATE USING (auth.uid() = user_id);

-- Ask results table
CREATE TABLE public.ask_results (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  query_id uuid NOT NULL REFERENCES public.ask_queries(id) ON DELETE CASCADE,
  answer_text text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  validated_at timestamp with time zone
);

ALTER TABLE public.ask_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own results" ON public.ask_results FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.ask_queries q WHERE q.id = ask_results.query_id AND q.user_id = auth.uid()));
CREATE POLICY "System can insert results" ON public.ask_results FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.ask_queries q WHERE q.id = ask_results.query_id AND q.user_id = auth.uid()));

-- Ask evidence table
CREATE TABLE public.ask_evidence (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  query_id uuid NOT NULL REFERENCES public.ask_queries(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_id uuid,
  title text NOT NULL DEFAULT '',
  creator_name text NOT NULL DEFAULT '',
  deep_link text,
  snippet text NOT NULL DEFAULT '',
  confidence text NOT NULL DEFAULT 'medium',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ask_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own evidence" ON public.ask_evidence FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.ask_queries q WHERE q.id = ask_evidence.query_id AND q.user_id = auth.uid()));
CREATE POLICY "System can insert evidence" ON public.ask_evidence FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.ask_queries q WHERE q.id = ask_evidence.query_id AND q.user_id = auth.uid()));

-- Access snapshots table
CREATE TABLE public.ask_access_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  query_id uuid NOT NULL REFERENCES public.ask_queries(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  entitlement_summary jsonb NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ask_access_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own snapshots" ON public.ask_access_snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own snapshots" ON public.ask_access_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);
