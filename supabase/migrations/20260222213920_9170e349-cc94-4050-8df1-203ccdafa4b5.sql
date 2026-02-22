
-- Shareable montage links
CREATE TABLE public.montage_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  montage_id uuid NOT NULL REFERENCES public.montage_projects(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.montage_shares ENABLE ROW LEVEL SECURITY;

-- Owner can manage their shares
CREATE POLICY "Owner can manage shares"
  ON public.montage_shares FOR ALL
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Any authenticated user can view shares (to open shared links)
CREATE POLICY "Authenticated users can view shares"
  ON public.montage_shares FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Viewer access log for analytics
CREATE TABLE public.montage_viewer_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id uuid NOT NULL REFERENCES public.montage_shares(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL,
  allowed_count integer NOT NULL DEFAULT 0,
  locked_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.montage_viewer_access_log ENABLE ROW LEVEL SECURITY;

-- Viewers can insert their own log
CREATE POLICY "Viewers can insert own access log"
  ON public.montage_viewer_access_log FOR INSERT
  WITH CHECK (auth.uid() = viewer_id);

-- Share owner can view access logs
CREATE POLICY "Owner can view access logs"
  ON public.montage_viewer_access_log FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.montage_shares ms
    WHERE ms.id = montage_viewer_access_log.share_id
      AND ms.created_by = auth.uid()
  ));

-- Viewers can view own logs
CREATE POLICY "Viewers can view own logs"
  ON public.montage_viewer_access_log FOR SELECT
  USING (auth.uid() = viewer_id);

-- Index for slug lookups
CREATE INDEX idx_montage_shares_slug ON public.montage_shares(slug);
