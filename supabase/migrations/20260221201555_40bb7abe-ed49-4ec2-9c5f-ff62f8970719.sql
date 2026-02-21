
-- Allow deal participants to delete deals (for hard-delete of rejected proposals)
CREATE POLICY "Creator can delete rejected deals"
ON public.deals
FOR DELETE
USING (auth.uid() = creator_id AND status = 'rejected');

-- Allow cascade deletion of related records
CREATE POLICY "Deal participants can delete invoices"
ON public.deal_invoices
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM deals
  WHERE deals.id = deal_invoices.deal_id
  AND (deals.advertiser_id = auth.uid() OR deals.creator_id = auth.uid())
));

-- Allow deletion of milestones
CREATE POLICY "Deal participants can delete milestones"
ON public.milestones
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM deals
  WHERE deals.id = milestones.deal_id
  AND (deals.advertiser_id = auth.uid() OR deals.creator_id = auth.uid())
));

-- Allow deletion of messages for deal cleanup
CREATE POLICY "Deal participants can delete messages"
ON public.messages
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM deals
  WHERE deals.id = messages.deal_id
  AND (deals.advertiser_id = auth.uid() OR deals.creator_id = auth.uid())
));

-- Allow deletion of escrow records for rejected deals
CREATE POLICY "Deal participants can delete escrow"
ON public.deal_escrow
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM deals
  WHERE deals.id = deal_escrow.deal_id
  AND (deals.advertiser_id = auth.uid() OR deals.creator_id = auth.uid())
));
