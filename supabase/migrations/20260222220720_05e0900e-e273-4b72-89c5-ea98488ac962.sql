ALTER TABLE public.video_search_queries
ADD COLUMN IF NOT EXISTS clarification_questions jsonb DEFAULT NULL;