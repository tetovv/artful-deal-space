CREATE OR REPLACE FUNCTION public.match_chunks_fts(
  p_project_id uuid,
  p_query text,
  p_limit integer DEFAULT 30,
  p_fts_config text DEFAULT 'simple'::text,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE(id uuid, content text, metadata jsonb, score real)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  ts_q tsquery;
  effective_user_id uuid;
BEGIN
  -- Use provided user_id or fallback to auth.uid()
  effective_user_id := COALESCE(p_user_id, auth.uid());
  
  BEGIN
    ts_q := websearch_to_tsquery(p_fts_config::regconfig, p_query);
  EXCEPTION WHEN OTHERS THEN
    ts_q := plainto_tsquery(p_fts_config::regconfig, p_query);
  END;

  IF ts_q::text = '' THEN
    RETURN QUERY
      SELECT pc.id, pc.content, pc.metadata,
             similarity(pc.content, p_query)::real AS score
      FROM project_chunks pc
      WHERE pc.project_id = p_project_id
        AND pc.user_id = effective_user_id
        AND similarity(pc.content, p_query) > 0.05
      ORDER BY score DESC
      LIMIT p_limit;
  ELSE
    RETURN QUERY
      SELECT pc.id, pc.content, pc.metadata,
             ts_rank_cd(pc.tsv, ts_q)::real AS score
      FROM project_chunks pc
      WHERE pc.project_id = p_project_id
        AND pc.user_id = effective_user_id
        AND pc.tsv @@ ts_q
      ORDER BY score DESC
      LIMIT p_limit;
  END IF;
END;
$function$;