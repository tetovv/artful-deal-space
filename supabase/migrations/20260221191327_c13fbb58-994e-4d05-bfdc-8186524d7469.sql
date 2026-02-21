
-- Create invoices table for deal payment flow
CREATE TABLE public.deal_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.deals(id),
  invoice_number TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  comment TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_by UUID NOT NULL,
  paid_at TIMESTAMP WITH TIME ZONE,
  paid_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deal_invoices ENABLE ROW LEVEL SECURITY;

-- Deal participants can view invoices
CREATE POLICY "Deal participants can view invoices"
ON public.deal_invoices
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM deals
  WHERE deals.id = deal_invoices.deal_id
    AND (deals.advertiser_id = auth.uid() OR deals.creator_id = auth.uid())
));

-- Deal participants can insert invoices
CREATE POLICY "Deal participants can insert invoices"
ON public.deal_invoices
FOR INSERT
WITH CHECK (
  auth.uid() = created_by
  AND EXISTS (
    SELECT 1 FROM deals
    WHERE deals.id = deal_invoices.deal_id
      AND (deals.advertiser_id = auth.uid() OR deals.creator_id = auth.uid())
  )
);

-- Deal participants can update invoices
CREATE POLICY "Deal participants can update invoices"
ON public.deal_invoices
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM deals
  WHERE deals.id = deal_invoices.deal_id
    AND (deals.advertiser_id = auth.uid() OR deals.creator_id = auth.uid())
));

-- Trigger for updated_at
CREATE TRIGGER update_deal_invoices_updated_at
BEFORE UPDATE ON public.deal_invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for invoices
ALTER PUBLICATION supabase_realtime ADD TABLE public.deal_invoices;
