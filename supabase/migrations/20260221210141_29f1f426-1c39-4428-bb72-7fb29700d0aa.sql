
-- 1. Add escrow payout fields to deal_escrow
ALTER TABLE public.deal_escrow 
  ADD COLUMN IF NOT EXISTS escrow_state text NOT NULL DEFAULT 'WAITING_INVOICE',
  ADD COLUMN IF NOT EXISTS publication_url text,
  ADD COLUMN IF NOT EXISTS proof_screenshot_path text,
  ADD COLUMN IF NOT EXISTS active_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS active_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_out_at timestamptz,
  ADD COLUMN IF NOT EXISTS platform_fee integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payout_amount integer DEFAULT 0;

-- 2. Add placement/publication fields to deals
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS publication_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS publication_url text,
  ADD COLUMN IF NOT EXISTS placement_duration_days integer,
  ADD COLUMN IF NOT EXISTS marking_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS marking_responsibility text DEFAULT 'platform';

-- 3. Escrow state validation trigger
CREATE OR REPLACE FUNCTION public.validate_escrow_state()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.escrow_state NOT IN (
    'WAITING_INVOICE', 'INVOICE_SENT', 'FUNDS_RESERVED', 'ACTIVE_PERIOD',
    'PAYOUT_READY', 'PAID_OUT', 'REFUNDED', 'DISPUTE_LOCKED'
  ) THEN
    RAISE EXCEPTION 'Invalid escrow_state: %', NEW.escrow_state;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_escrow_state ON public.deal_escrow;
CREATE TRIGGER trg_validate_escrow_state
  BEFORE INSERT OR UPDATE ON public.deal_escrow
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_escrow_state();
