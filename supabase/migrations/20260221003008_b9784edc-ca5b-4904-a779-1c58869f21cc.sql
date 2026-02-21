
CREATE TABLE public.post_impressions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  viewer_user_id uuid NOT NULL,
  visible_ms integer NOT NULL DEFAULT 0,
  date_bucket date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_impression_per_user_per_post_per_day UNIQUE (viewer_user_id, post_id, date_bucket)
);

ALTER TABLE public.post_impressions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own impressions"
  ON public.post_impressions FOR INSERT
  WITH CHECK (auth.uid() = viewer_user_id);

CREATE POLICY "Users can update own impressions"
  ON public.post_impressions FOR UPDATE
  USING (auth.uid() = viewer_user_id);

CREATE POLICY "Anyone can read impressions"
  ON public.post_impressions FOR SELECT
  USING (true);

CREATE OR REPLACE FUNCTION public.get_post_impressions_batch(p_post_ids uuid[])
RETURNS TABLE(post_id uuid, impression_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT pi.post_id, count(*) as impression_count
  FROM public.post_impressions pi
  WHERE pi.post_id = ANY(p_post_ids)
  GROUP BY pi.post_id;
$$;

CREATE INDEX idx_post_impressions_post ON public.post_impressions(post_id);
CREATE INDEX idx_post_impressions_viewer ON public.post_impressions(viewer_user_id);
