
-- Add SLA timer columns to deal_escrow
ALTER TABLE public.deal_escrow
  ADD COLUMN IF NOT EXISTS creator_response_due_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS creator_publication_due_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS refund_reason text DEFAULT NULL;
