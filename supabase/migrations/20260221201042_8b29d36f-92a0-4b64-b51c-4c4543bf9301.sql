
-- Add rejection_reason and rejected_at columns to deals
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS rejected_at timestamp with time zone;
