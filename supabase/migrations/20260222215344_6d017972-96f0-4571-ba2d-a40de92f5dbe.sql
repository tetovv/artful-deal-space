
-- ============================================================
-- Smart Meaning Search (Video) — data model
-- ============================================================

-- 1. Transcript segments (per-video speech segments)
CREATE TABLE public.transcript_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  start_sec numeric NOT NULL DEFAULT 0,
  end_sec numeric NOT NULL DEFAULT 0,
  text text NOT NULL DEFAULT '',
  speaker_id text,
  confidence numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transcript_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view transcript segments of public content"
  ON public.transcript_segments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.content_items ci
    WHERE ci.id = transcript_segments.video_id
      AND ci.status = 'published'
  ));

CREATE INDEX idx_transcript_segments_video ON public.transcript_segments(video_id);

-- 2. Scene segments (visual scene boundaries)
CREATE TABLE public.scene_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  start_sec numeric NOT NULL DEFAULT 0,
  end_sec numeric NOT NULL DEFAULT 0,
  keyframe_ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scene_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view scene segments of published content"
  ON public.scene_segments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.content_items ci
    WHERE ci.id = scene_segments.video_id
      AND ci.status = 'published'
  ));

CREATE INDEX idx_scene_segments_video ON public.scene_segments(video_id);

-- 3. Moment index (semantic index of meaningful video moments)
CREATE TABLE public.moment_index (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  start_sec numeric NOT NULL DEFAULT 0,
  end_sec numeric NOT NULL DEFAULT 0,
  transcript_snippet text NOT NULL DEFAULT '',
  entity_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  action_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  emotion_tags jsonb DEFAULT '[]'::jsonb,
  visual_caption text,
  embedding_ref_text text,
  embedding_ref_vision text,
  safety_flags jsonb DEFAULT '{}'::jsonb,
  popularity_signals jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.moment_index ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view moments of published content"
  ON public.moment_index FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.content_items ci
    WHERE ci.id = moment_index.video_id
      AND ci.status = 'published'
  ));

CREATE INDEX idx_moment_index_video ON public.moment_index(video_id);
CREATE INDEX idx_moment_index_entity_tags ON public.moment_index USING GIN(entity_tags);
CREATE INDEX idx_moment_index_action_tags ON public.moment_index USING GIN(action_tags);

-- 4. Video meaning search queries
CREATE TABLE public.video_search_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  query_text text NOT NULL,
  mode text NOT NULL DEFAULT 'videoMeaning',
  parsed_intent jsonb DEFAULT '{}'::jsonb,
  clarifications jsonb DEFAULT '[]'::jsonb,
  preferences jsonb DEFAULT '{}'::jsonb,
  include_private_sources boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.video_search_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own video search queries"
  ON public.video_search_queries FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. Search results (moment matches per query)
CREATE TABLE public.video_search_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id uuid NOT NULL REFERENCES public.video_search_queries(id) ON DELETE CASCADE,
  moment_id uuid NOT NULL REFERENCES public.moment_index(id) ON DELETE CASCADE,
  score numeric NOT NULL DEFAULT 0,
  rationale jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.video_search_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own search results"
  ON public.video_search_results FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.video_search_queries q
    WHERE q.id = video_search_results.query_id AND q.user_id = auth.uid()
  ));

CREATE POLICY "System can insert search results"
  ON public.video_search_results FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.video_search_queries q
    WHERE q.id = video_search_results.query_id AND q.user_id = auth.uid()
  ));

-- 6. Access snapshots (entitlement state at query time)
CREATE TABLE public.video_access_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id uuid NOT NULL REFERENCES public.video_search_queries(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  entitlement_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.video_access_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own access snapshots"
  ON public.video_access_snapshots FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 7. Saved searches
CREATE TABLE public.saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  query_id uuid NOT NULL REFERENCES public.video_search_queries(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own saved searches"
  ON public.saved_searches FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 8. Saved moment bookmarks
CREATE TABLE public.saved_moment_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  video_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  start_sec numeric NOT NULL DEFAULT 0,
  end_sec numeric NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_moment_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own moment bookmarks"
  ON public.saved_moment_bookmarks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
