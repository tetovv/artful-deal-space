-- 1. Update deals status CHECK constraint to include all used statuses
ALTER TABLE public.deals DROP CONSTRAINT deals_status_check;
ALTER TABLE public.deals ADD CONSTRAINT deals_status_check CHECK (
  status = ANY (ARRAY[
    'pending', 'briefing', 'in_progress', 'review', 'completed', 'disputed',
    'needs_changes', 'accepted', 'invoice_needed', 'waiting_payment', 'rejected', 'archived', 'waiting_inputs'
  ])
);

-- 2. Fix notifications RLS: allow authenticated users to insert notifications for ANY user
-- (needed so creator can notify advertiser and vice versa)
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated users can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- 3. Add unique constraint on deal_terms_acceptance to handle duplicates gracefully
-- (already exists as deal_terms_acceptance_terms_id_user_id_key, so we just need to handle it in code)
