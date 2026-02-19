ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS duration INTEGER;
NOTIFY pgrst, 'reload schema';