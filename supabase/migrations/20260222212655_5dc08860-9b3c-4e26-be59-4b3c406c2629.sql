
-- Saved answers table
CREATE TABLE public.saved_answers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  query_id uuid REFERENCES public.ask_queries(id) ON DELETE SET NULL,
  question_text text NOT NULL,
  answer_text text NOT NULL,
  last_validated_at timestamp with time zone NOT NULL DEFAULT now(),
  validation_status text NOT NULL DEFAULT 'VALID',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own saved answers" ON public.saved_answers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own saved answers" ON public.saved_answers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own saved answers" ON public.saved_answers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own saved answers" ON public.saved_answers FOR DELETE USING (auth.uid() = user_id);

-- Saved answer evidence references
CREATE TABLE public.saved_answer_evidence (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  saved_answer_id uuid NOT NULL REFERENCES public.saved_answers(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_id uuid,
  title text NOT NULL DEFAULT '',
  creator_name text NOT NULL DEFAULT '',
  deep_link text,
  snippet text NOT NULL DEFAULT '',
  confidence text NOT NULL DEFAULT 'medium',
  captured_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_answer_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own saved evidence" ON public.saved_answer_evidence FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.saved_answers sa WHERE sa.id = saved_answer_evidence.saved_answer_id AND sa.user_id = auth.uid()));
CREATE POLICY "Users can insert own saved evidence" ON public.saved_answer_evidence FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.saved_answers sa WHERE sa.id = saved_answer_evidence.saved_answer_id AND sa.user_id = auth.uid()));
CREATE POLICY "Users can delete own saved evidence" ON public.saved_answer_evidence FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.saved_answers sa WHERE sa.id = saved_answer_evidence.saved_answer_id AND sa.user_id = auth.uid()));

CREATE INDEX idx_saved_answers_user ON public.saved_answers(user_id);
CREATE INDEX idx_saved_evidence_answer ON public.saved_answer_evidence(saved_answer_id);
