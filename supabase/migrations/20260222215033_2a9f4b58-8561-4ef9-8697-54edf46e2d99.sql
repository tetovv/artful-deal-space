
-- Playlist templates: store goal settings only
CREATE TABLE public.playlist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  goal_type text NOT NULL,
  time_budget integer NOT NULL,
  mix_prefs jsonb NOT NULL DEFAULT '{}'::jsonb,
  scope text NOT NULL DEFAULT 'platform',
  share_slug text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.playlist_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own templates"
  ON public.playlist_templates FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view shared templates"
  ON public.playlist_templates FOR SELECT
  USING (share_slug IS NOT NULL);

-- Template run history
CREATE TABLE public.template_run_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.playlist_templates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  generated_playlist_id uuid REFERENCES public.goal_playlists(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  run_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.template_run_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own run history"
  ON public.template_run_history FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
