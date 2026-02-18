
-- Add new columns to content_items for advanced video editor
ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS chapters jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS subtitles_url text,
  ADD COLUMN IF NOT EXISTS pinned_comment text,
  ADD COLUMN IF NOT EXISTS age_restricted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'ru',
  ADD COLUMN IF NOT EXISTS geo text,
  ADD COLUMN IF NOT EXISTS monetization_type text DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS price_min integer,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Create storage bucket for content media (videos, thumbnails)
INSERT INTO storage.buckets (id, name, public)
VALUES ('content-media', 'content-media', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for content-media bucket
CREATE POLICY "Anyone can view content media"
ON storage.objects FOR SELECT
USING (bucket_id = 'content-media');

CREATE POLICY "Authenticated users can upload content media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'content-media' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own content media"
ON storage.objects FOR UPDATE
USING (bucket_id = 'content-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own content media"
ON storage.objects FOR DELETE
USING (bucket_id = 'content-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Trigger for updated_at
CREATE TRIGGER update_content_items_updated_at
  BEFORE UPDATE ON public.content_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
