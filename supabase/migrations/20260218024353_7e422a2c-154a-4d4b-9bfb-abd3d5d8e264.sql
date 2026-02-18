
-- Playlists
CREATE TABLE public.playlists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  is_public BOOLEAN NOT NULL DEFAULT true,
  thumbnail TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view public playlists" ON public.playlists
  FOR SELECT USING (is_public = true OR auth.uid() = user_id);

CREATE POLICY "Users can create playlists" ON public.playlists
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own playlists" ON public.playlists
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own playlists" ON public.playlists
  FOR DELETE USING (auth.uid() = user_id);

-- Playlist items
CREATE TABLE public.playlist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(playlist_id, content_id)
);

ALTER TABLE public.playlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Playlist items visible with playlist" ON public.playlist_items
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.playlists WHERE playlists.id = playlist_items.playlist_id
    AND (playlists.is_public = true OR playlists.user_id = auth.uid())
  ));

CREATE POLICY "Playlist owner can insert items" ON public.playlist_items
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.playlists WHERE playlists.id = playlist_items.playlist_id
    AND playlists.user_id = auth.uid()
  ));

CREATE POLICY "Playlist owner can delete items" ON public.playlist_items
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.playlists WHERE playlists.id = playlist_items.playlist_id
    AND playlists.user_id = auth.uid()
  ));

CREATE POLICY "Playlist owner can update items" ON public.playlist_items
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.playlists WHERE playlists.id = playlist_items.playlist_id
    AND playlists.user_id = auth.uid()
  ));

-- View history
CREATE TABLE public.view_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content_id UUID NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  watched_seconds INTEGER DEFAULT 0,
  total_seconds INTEGER DEFAULT 0,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.view_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own history" ON public.view_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own history" ON public.view_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own history" ON public.view_history
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own history" ON public.view_history
  FOR DELETE USING (auth.uid() = user_id);

-- Download history
CREATE TABLE public.download_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content_id UUID NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  downloaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.download_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own downloads" ON public.download_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own downloads" ON public.download_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own downloads" ON public.download_history
  FOR DELETE USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_playlists_updated_at
  BEFORE UPDATE ON public.playlists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for performance
CREATE INDEX idx_view_history_user ON public.view_history(user_id, viewed_at DESC);
CREATE INDEX idx_download_history_user ON public.download_history(user_id, downloaded_at DESC);
CREATE INDEX idx_playlist_items_playlist ON public.playlist_items(playlist_id, sort_order);
