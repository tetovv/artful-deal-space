
-- Add new rating criteria columns for creator-to-advertiser ratings
ALTER TABLE public.ratings
ADD COLUMN IF NOT EXISTS payment_timeliness integer,
ADD COLUMN IF NOT EXISTS brief_adequacy integer,
ADD COLUMN IF NOT EXISTS agreement_compliance integer,
ADD COLUMN IF NOT EXISTS repeat_willingness integer;

-- Drop old INSERT policy
DROP POLICY IF EXISTS "Participants can rate" ON public.ratings;

-- Only creators can rate advertisers (after completed deal)
CREATE POLICY "Creators can rate advertisers"
ON public.ratings
FOR INSERT
WITH CHECK (
  auth.uid() = from_id
  AND public.has_role(auth.uid(), 'creator')
  AND EXISTS (
    SELECT 1 FROM deals
    WHERE deals.id = ratings.deal_id
      AND deals.status = 'completed'
      AND deals.creator_id = auth.uid()
      AND deals.advertiser_id = ratings.to_id
  )
);
