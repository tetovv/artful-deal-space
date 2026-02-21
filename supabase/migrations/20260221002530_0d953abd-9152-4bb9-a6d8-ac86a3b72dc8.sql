
-- Table to track individual video view events
CREATE TABLE public.video_views (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  viewer_user_id uuid NOT NULL,
  watched_percent numeric NOT NULL DEFAULT 0,
  date_bucket date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_view_per_user_per_video_per_day UNIQUE (viewer_user_id, video_id, date_bucket)
);

ALTER TABLE public.video_views ENABLE ROW LEVEL SECURITY;

-- Users can insert/upsert their own views
CREATE POLICY "Users can insert own views"
  ON public.video_views FOR INSERT
  WITH CHECK (auth.uid() = viewer_user_id);

-- Users can update own views (for upsert)
CREATE POLICY "Users can update own views"
  ON public.video_views FOR UPDATE
  USING (auth.uid() = viewer_user_id);

-- Anyone can read view counts (needed for aggregation)
CREATE POLICY "Anyone can read views"
  ON public.video_views FOR SELECT
  USING (true);

-- Function to get 30%-watched view count for a video
CREATE OR REPLACE FUNCTION public.get_video_view_count_30pct(p_video_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT count(*) FROM public.video_views
  WHERE video_id = p_video_id AND watched_percent >= 30;
$$;

-- Function to get 30%-watched view counts for multiple videos at once
CREATE OR REPLACE FUNCTION public.get_video_views_batch(p_video_ids uuid[])
RETURNS TABLE(video_id uuid, view_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT vv.video_id, count(*) as view_count
  FROM public.video_views vv
  WHERE vv.video_id = ANY(p_video_ids) AND vv.watched_percent >= 30
  GROUP BY vv.video_id;
$$;

-- Index for fast aggregation
CREATE INDEX idx_video_views_video_percent ON public.video_views(video_id, watched_percent);
CREATE INDEX idx_video_views_viewer ON public.video_views(viewer_user_id);
