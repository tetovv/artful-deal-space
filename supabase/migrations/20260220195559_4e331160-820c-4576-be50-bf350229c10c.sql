
-- Table: ingest_jobs — background indexing job queue
CREATE TABLE public.ingest_jobs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  status      text NOT NULL DEFAULT 'queued'
              CHECK (status IN ('queued','running','done','error','canceled')),
  progress    integer NOT NULL DEFAULT 0
              CHECK (progress >= 0 AND progress <= 100),
  stage       text,            -- e.g. 'chunking', 'inserting', 'finalizing'
  message     text,            -- human-readable status message
  error       text,            -- error details if status='error'
  created_at  timestamptz NOT NULL DEFAULT now(),
  started_at  timestamptz,
  finished_at timestamptz,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Fast lookup by project
CREATE INDEX idx_ingest_jobs_project ON public.ingest_jobs(project_id);

-- Auto-update updated_at
CREATE TRIGGER update_ingest_jobs_updated_at
  BEFORE UPDATE ON public.ingest_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.ingest_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can select ingest_jobs"
  ON public.ingest_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Owner can insert ingest_jobs"
  ON public.ingest_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can update ingest_jobs"
  ON public.ingest_jobs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Owner can delete ingest_jobs"
  ON public.ingest_jobs FOR DELETE
  USING (auth.uid() = user_id);
