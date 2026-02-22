
-- Goal playlists
CREATE TABLE public.goal_playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  goal_type text NOT NULL,
  time_budget integer NOT NULL,
  mix_prefs jsonb NOT NULL DEFAULT '{}',
  scope text NOT NULL DEFAULT 'platform',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.goal_playlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own goal playlists"
  ON public.goal_playlists FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Goal playlist items
CREATE TABLE public.goal_playlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id uuid NOT NULL REFERENCES public.goal_playlists(id) ON DELETE CASCADE,
  content_type text NOT NULL,
  content_id uuid,
  segment_ref jsonb,
  est_time integer NOT NULL DEFAULT 0,
  reason text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.goal_playlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own playlist items"
  ON public.goal_playlist_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.goal_playlists gp
    WHERE gp.id = goal_playlist_items.playlist_id AND gp.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own playlist items"
  ON public.goal_playlist_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.goal_playlists gp
    WHERE gp.id = goal_playlist_items.playlist_id AND gp.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own playlist items"
  ON public.goal_playlist_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.goal_playlists gp
    WHERE gp.id = goal_playlist_items.playlist_id AND gp.user_id = auth.uid()
  ));

CREATE INDEX idx_goal_playlist_items_playlist ON public.goal_playlist_items(playlist_id);
