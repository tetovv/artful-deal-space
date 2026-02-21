
-- 1. deal_proposals table for persisted drafts
CREATE TABLE public.deal_proposals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  advertiser_id uuid NOT NULL,
  creator_id uuid NOT NULL,
  placement_type text NOT NULL DEFAULT 'video',
  offer_id uuid,
  budget_value integer,
  budget_min integer,
  budget_max integer,
  publish_start timestamptz,
  publish_end timestamptz,
  brief_text text DEFAULT '',
  cta text DEFAULT '',
  restrictions text DEFAULT '',
  revisions_count integer DEFAULT 0,
  acceptance_criteria text DEFAULT '',
  ord_responsibility text DEFAULT 'platform',
  attachments jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  last_opened_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advertisers can manage own proposals" ON public.deal_proposals
  FOR ALL USING (auth.uid() = advertiser_id)
  WITH CHECK (auth.uid() = advertiser_id);

CREATE POLICY "Creators can view proposals to them" ON public.deal_proposals
  FOR SELECT USING (auth.uid() = creator_id AND status != 'draft');

CREATE INDEX idx_deal_proposals_advertiser ON public.deal_proposals (advertiser_id, status);
CREATE INDEX idx_deal_proposals_creator ON public.deal_proposals (creator_id, status);

-- Trigger for updated_at
CREATE TRIGGER update_deal_proposals_updated_at
  BEFORE UPDATE ON public.deal_proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Add included_deliverables to creator_offers
ALTER TABLE public.creator_offers ADD COLUMN IF NOT EXISTS included_deliverables text[] DEFAULT '{}'::text[];

-- 3. creator_analytics table for audience data
CREATE TABLE public.creator_analytics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id uuid NOT NULL UNIQUE,
  demographics jsonb DEFAULT '{}'::jsonb,
  geo jsonb DEFAULT '[]'::jsonb,
  platform_distribution jsonb DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.creator_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view analytics" ON public.creator_analytics
  FOR SELECT USING (true);

CREATE POLICY "Creators can manage own analytics" ON public.creator_analytics
  FOR ALL USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

-- 4. video_views_daily aggregation table
CREATE TABLE public.video_views_daily (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  views_30pct_count integer NOT NULL DEFAULT 0,
  UNIQUE (creator_id, date)
);

ALTER TABLE public.video_views_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read daily views" ON public.video_views_daily
  FOR SELECT USING (true);

CREATE POLICY "System can insert daily views" ON public.video_views_daily
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "System can update daily views" ON public.video_views_daily
  FOR UPDATE USING (auth.uid() = creator_id);

CREATE INDEX idx_video_views_daily_creator ON public.video_views_daily (creator_id, date DESC);

-- 5. DB function for creator avg 30% views (last N videos)
CREATE OR REPLACE FUNCTION public.get_creator_avg_views_30pct(p_creator_id uuid, p_limit integer DEFAULT 10)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(AVG(cnt), 0)
  FROM (
    SELECT COUNT(*) as cnt
    FROM video_views vv
    JOIN content_items ci ON ci.id = vv.video_id
    WHERE ci.creator_id = p_creator_id
      AND ci.type = 'video'
      AND vv.watched_percent >= 30
    GROUP BY vv.video_id
    ORDER BY MAX(vv.created_at) DESC
    LIMIT p_limit
  ) sub;
$$;

-- 6. Batch function for multiple creators
CREATE OR REPLACE FUNCTION public.get_creators_avg_views_30pct(p_creator_ids uuid[])
RETURNS TABLE(creator_id uuid, avg_views numeric, video_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    ci.creator_id,
    COALESCE(AVG(sub.cnt), 0) as avg_views,
    COUNT(DISTINCT ci2.id) as video_count
  FROM content_items ci2
  CROSS JOIN LATERAL (
    SELECT ci2.creator_id, COUNT(*) as cnt
    FROM video_views vv
    WHERE vv.video_id = ci2.id AND vv.watched_percent >= 30
  ) sub
  JOIN content_items ci ON ci.id = ci2.id
  WHERE ci.creator_id = ANY(p_creator_ids)
    AND ci.type = 'video'
  GROUP BY ci.creator_id;
$$;

-- 7. Function for daily views trend
CREATE OR REPLACE FUNCTION public.get_video_views_trend(p_creator_id uuid, p_days integer DEFAULT 30)
RETURNS TABLE(day date, view_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    vv.date_bucket::date as day,
    COUNT(*) as view_count
  FROM video_views vv
  JOIN content_items ci ON ci.id = vv.video_id
  WHERE ci.creator_id = p_creator_id
    AND vv.watched_percent >= 30
    AND vv.date_bucket >= (CURRENT_DATE - p_days)
  GROUP BY vv.date_bucket
  ORDER BY vv.date_bucket;
$$;
