
-- Enable pg_trgm for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

-- Add tsvector column to project_chunks
ALTER TABLE public.project_chunks
  ADD COLUMN IF NOT EXISTS tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED;

-- GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_project_chunks_tsv ON public.project_chunks USING GIN(tsv);

-- GIN trigram index for fuzzy/short-query fallback
CREATE INDEX IF NOT EXISTS idx_project_chunks_trgm ON public.project_chunks USING GIN(content gin_trgm_ops);

-- RPC function for FTS retrieval
CREATE OR REPLACE FUNCTION public.match_chunks_fts(
  p_project_id uuid,
  p_query text,
  p_limit int DEFAULT 30,
  p_fts_config text DEFAULT 'simple'
)
RETURNS TABLE(
  id uuid,
  content text,
  metadata jsonb,
  score real
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  ts_q tsquery;
BEGIN
  -- Build tsquery
  BEGIN
    ts_q := websearch_to_tsquery(p_fts_config::regconfig, p_query);
  EXCEPTION WHEN OTHERS THEN
    ts_q := plainto_tsquery(p_fts_config::regconfig, p_query);
  END;

  -- If tsquery is empty (short/unusual query), fallback to trigram
  IF ts_q::text = '' THEN
    RETURN QUERY
      SELECT pc.id, pc.content, pc.metadata,
             similarity(pc.content, p_query)::real AS score
      FROM project_chunks pc
      WHERE pc.project_id = p_project_id
        AND pc.user_id = auth.uid()
        AND similarity(pc.content, p_query) > 0.05
      ORDER BY score DESC
      LIMIT p_limit;
  ELSE
    RETURN QUERY
      SELECT pc.id, pc.content, pc.metadata,
             ts_rank_cd(pc.tsv, ts_q)::real AS score
      FROM project_chunks pc
      WHERE pc.project_id = p_project_id
        AND pc.user_id = auth.uid()
        AND pc.tsv @@ ts_q
      ORDER BY score DESC
      LIMIT p_limit;
  END IF;
END;
$$;
