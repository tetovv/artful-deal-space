
-- Table for tracking export jobs
CREATE TABLE public.data_exports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  categories text[] NOT NULL DEFAULT '{}',
  format text NOT NULL DEFAULT 'json',
  file_path text,
  file_size integer,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  expires_at timestamptz,
  downloaded_at timestamptz
);

ALTER TABLE public.data_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own exports"
  ON public.data_exports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own exports"
  ON public.data_exports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own exports"
  ON public.data_exports FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own exports"
  ON public.data_exports FOR DELETE
  USING (auth.uid() = user_id);

-- Table for tracking import jobs
CREATE TABLE public.data_imports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  categories text[] NOT NULL DEFAULT '{}',
  format text NOT NULL DEFAULT 'json',
  preview_data jsonb DEFAULT '{}',
  result_data jsonb DEFAULT '{}',
  conflict_strategy text NOT NULL DEFAULT 'merge',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  finished_at timestamptz
);

ALTER TABLE public.data_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own imports"
  ON public.data_imports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own imports"
  ON public.data_imports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own imports"
  ON public.data_imports FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own imports"
  ON public.data_imports FOR DELETE
  USING (auth.uid() = user_id);

-- Storage bucket for export files (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('data-exports', 'data-exports', false);

-- Storage policies: users can only access their own exports
CREATE POLICY "Users can read own export files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'data-exports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload own export files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'data-exports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own export files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'data-exports' AND auth.uid()::text = (storage.foldername(name))[1]);
