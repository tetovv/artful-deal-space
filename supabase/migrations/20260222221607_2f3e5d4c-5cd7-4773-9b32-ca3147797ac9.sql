
CREATE TABLE IF NOT EXISTS public.saved_montages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  montage_id UUID REFERENCES public.montage_projects(id),
  label TEXT,
  segments_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  lead_in_seconds INTEGER NOT NULL DEFAULT 10,
  target_duration_sec INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.saved_montages ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users can manage own saved montages" ON public.saved_montages FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.moment_bookmarks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  video_id UUID NOT NULL,
  start_sec NUMERIC NOT NULL DEFAULT 0,
  end_sec NUMERIC NOT NULL DEFAULT 0,
  note TEXT,
  video_title TEXT,
  creator_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.moment_bookmarks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users can manage own moment bookmarks" ON public.moment_bookmarks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
