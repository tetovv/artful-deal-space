
-- Montage projects table
CREATE TABLE public.montage_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_query_id uuid REFERENCES public.ask_queries(id),
  target_duration integer NOT NULL DEFAULT 30,
  scope text NOT NULL DEFAULT 'this_answer',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.montage_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own montages" ON public.montage_projects
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own montages" ON public.montage_projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own montages" ON public.montage_projects
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own montages" ON public.montage_projects
  FOR DELETE USING (auth.uid() = user_id);

-- Montage segments table
CREATE TABLE public.montage_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  montage_id uuid NOT NULL REFERENCES public.montage_projects(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_id uuid,
  start_sec numeric NOT NULL DEFAULT 0,
  end_sec numeric NOT NULL DEFAULT 0,
  deep_link text,
  rationale text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.montage_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own segments" ON public.montage_segments
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM montage_projects mp WHERE mp.id = montage_segments.montage_id AND mp.user_id = auth.uid()
  ));
CREATE POLICY "Users can insert own segments" ON public.montage_segments
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM montage_projects mp WHERE mp.id = montage_segments.montage_id AND mp.user_id = auth.uid()
  ));
CREATE POLICY "Users can delete own segments" ON public.montage_segments
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM montage_projects mp WHERE mp.id = montage_segments.montage_id AND mp.user_id = auth.uid()
  ));

-- Trigger for updated_at
CREATE TRIGGER update_montage_projects_updated_at
  BEFORE UPDATE ON public.montage_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
