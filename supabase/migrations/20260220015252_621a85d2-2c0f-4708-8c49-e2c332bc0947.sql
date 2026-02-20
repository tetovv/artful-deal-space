
-- Add dislikes column to content_items
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS dislikes integer DEFAULT 0;

-- Create per-user reactions table
CREATE TABLE public.content_reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  content_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  reaction text NOT NULL CHECK (reaction IN ('like', 'dislike')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, content_id)
);

-- Enable RLS
ALTER TABLE public.content_reactions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view reactions" ON public.content_reactions FOR SELECT USING (true);
CREATE POLICY "Users can insert own reactions" ON public.content_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reactions" ON public.content_reactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reactions" ON public.content_reactions FOR DELETE USING (auth.uid() = user_id);

-- Trigger to sync counts to content_items
CREATE OR REPLACE FUNCTION public.sync_reaction_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_id uuid;
BEGIN
  target_id := COALESCE(NEW.content_id, OLD.content_id);
  UPDATE content_items SET
    likes = (SELECT count(*) FROM content_reactions WHERE content_id = target_id AND reaction = 'like'),
    dislikes = (SELECT count(*) FROM content_reactions WHERE content_id = target_id AND reaction = 'dislike')
  WHERE id = target_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER sync_reaction_counts_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.content_reactions
FOR EACH ROW EXECUTE FUNCTION public.sync_reaction_counts();

-- Enable realtime for content_items to push count updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.content_items;
