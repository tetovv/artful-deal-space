
-- Add ingest progress tracking columns to projects
ALTER TABLE public.projects 
  ADD COLUMN IF NOT EXISTS ingest_progress integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ingest_error text;
