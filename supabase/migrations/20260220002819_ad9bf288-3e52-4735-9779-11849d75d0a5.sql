
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- ══════════════════════════════════════
-- 1. projects
-- ══════════════════════════════════════
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  goal text DEFAULT '',
  audience text DEFAULT '',
  roadmap jsonb DEFAULT '[]'::jsonb,
  assistant_menu_policy jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can select projects" ON public.projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Owner can insert projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner can update projects" ON public.projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Owner can delete projects" ON public.projects FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ══════════════════════════════════════
-- 2. project_sources
-- ══════════════════════════════════════
CREATE TABLE public.project_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL DEFAULT 'text/plain',
  file_size integer DEFAULT 0,
  storage_path text NOT NULL,
  status text NOT NULL DEFAULT 'uploaded',
  chunk_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can select sources" ON public.project_sources FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Owner can insert sources" ON public.project_sources FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner can update sources" ON public.project_sources FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Owner can delete sources" ON public.project_sources FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_project_sources_project ON public.project_sources(project_id);

-- ══════════════════════════════════════
-- 3. project_chunks (pgvector)
-- ══════════════════════════════════════
CREATE TABLE public.project_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES public.project_sources(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  embedding extensions.vector(768),
  token_count integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can select chunks" ON public.project_chunks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Owner can insert chunks" ON public.project_chunks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner can update chunks" ON public.project_chunks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Owner can delete chunks" ON public.project_chunks FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_project_chunks_project ON public.project_chunks(project_id);
CREATE INDEX idx_project_chunks_embedding ON public.project_chunks USING ivfflat (embedding extensions.vector_cosine_ops) WITH (lists = 100);

-- ══════════════════════════════════════
-- 4. artifacts (public part)
-- ══════════════════════════════════════
CREATE TABLE public.artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  public_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  sort_order integer DEFAULT 0,
  roadmap_step_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can select artifacts" ON public.artifacts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Owner can insert artifacts" ON public.artifacts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner can update artifacts" ON public.artifacts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Owner can delete artifacts" ON public.artifacts FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_artifacts_project ON public.artifacts(project_id);

CREATE TRIGGER update_artifacts_updated_at BEFORE UPDATE ON public.artifacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ══════════════════════════════════════
-- 5. artifact_private (NO client SELECT)
-- ══════════════════════════════════════
CREATE TABLE public.artifact_private (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id uuid NOT NULL REFERENCES public.artifacts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  private_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.artifact_private ENABLE ROW LEVEL SECURITY;

-- NO SELECT policy for clients — only service_role can read
CREATE POLICY "Owner can insert artifact_private" ON public.artifact_private FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner can update artifact_private" ON public.artifact_private FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Owner can delete artifact_private" ON public.artifact_private FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_artifact_private_updated_at BEFORE UPDATE ON public.artifact_private
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ══════════════════════════════════════
-- 6. attempts
-- ══════════════════════════════════════
CREATE TABLE public.attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id uuid NOT NULL REFERENCES public.artifacts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  score numeric,
  feedback jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'in_progress',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can select attempts" ON public.attempts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Owner can insert attempts" ON public.attempts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner can update attempts" ON public.attempts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Owner can delete attempts" ON public.attempts FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_attempts_artifact ON public.attempts(artifact_id);

-- ══════════════════════════════════════
-- Storage bucket
-- ══════════════════════════════════════
INSERT INTO storage.buckets (id, name, public) VALUES ('ai_sources', 'ai_sources', false);

CREATE POLICY "Owner can upload ai_sources" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'ai_sources' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owner can view ai_sources" ON storage.objects FOR SELECT
  USING (bucket_id = 'ai_sources' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owner can update ai_sources" ON storage.objects FOR UPDATE
  USING (bucket_id = 'ai_sources' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owner can delete ai_sources" ON storage.objects FOR DELETE
  USING (bucket_id = 'ai_sources' AND auth.uid()::text = (storage.foldername(name))[1]);
