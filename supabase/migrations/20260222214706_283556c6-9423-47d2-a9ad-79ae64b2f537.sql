
-- Playlist progress tracking
CREATE TABLE public.playlist_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id uuid NOT NULL REFERENCES public.goal_playlists(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  current_item_id uuid REFERENCES public.goal_playlist_items(id) ON DELETE SET NULL,
  completed_items uuid[] NOT NULL DEFAULT '{}',
  time_remaining integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(playlist_id, user_id)
);

ALTER TABLE public.playlist_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own progress"
  ON public.playlist_progress FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
