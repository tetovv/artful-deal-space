
-- Add marking workflow columns to deals table
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS marking_state text NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN IF NOT EXISTS erid text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS marking_state_updated_at timestamptz DEFAULT NULL;

-- Enable realtime for deals (already enabled, but ensure it)
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.deals;
