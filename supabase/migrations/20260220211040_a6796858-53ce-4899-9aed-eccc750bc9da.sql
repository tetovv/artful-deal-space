
-- 1. Deal audit log
CREATE TABLE public.deal_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  action text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deal participants can view audit log"
  ON public.deal_audit_log FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM deals
    WHERE deals.id = deal_audit_log.deal_id
      AND (deals.advertiser_id = auth.uid() OR deals.creator_id = auth.uid())
  ));

CREATE POLICY "Deal participants can insert audit log"
  ON public.deal_audit_log FOR INSERT
  WITH CHECK (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM deals
    WHERE deals.id = deal_audit_log.deal_id
      AND (deals.advertiser_id = auth.uid() OR deals.creator_id = auth.uid())
  ));

-- 2. Deal escrow payments
CREATE TABLE public.deal_escrow (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  milestone_id uuid REFERENCES public.milestones(id) ON DELETE SET NULL,
  label text NOT NULL,
  amount integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  reserved_at timestamptz,
  released_at timestamptz,
  released_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_escrow ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deal participants can view escrow"
  ON public.deal_escrow FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM deals
    WHERE deals.id = deal_escrow.deal_id
      AND (deals.advertiser_id = auth.uid() OR deals.creator_id = auth.uid())
  ));

CREATE POLICY "Deal participants can insert escrow"
  ON public.deal_escrow FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM deals
    WHERE deals.id = deal_escrow.deal_id
      AND (deals.advertiser_id = auth.uid() OR deals.creator_id = auth.uid())
  ));

CREATE POLICY "Deal participants can update escrow"
  ON public.deal_escrow FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM deals
    WHERE deals.id = deal_escrow.deal_id
      AND (deals.advertiser_id = auth.uid() OR deals.creator_id = auth.uid())
  ));

-- 3. Deal files
CREATE TABLE public.deal_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  file_size integer DEFAULT 0,
  file_type text DEFAULT 'application/octet-stream',
  category text NOT NULL DEFAULT 'draft',
  storage_path text NOT NULL,
  pinned boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deal participants can view files"
  ON public.deal_files FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM deals
    WHERE deals.id = deal_files.deal_id
      AND (deals.advertiser_id = auth.uid() OR deals.creator_id = auth.uid())
  ));

CREATE POLICY "Deal participants can insert files"
  ON public.deal_files FOR INSERT
  WITH CHECK (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM deals
    WHERE deals.id = deal_files.deal_id
      AND (deals.advertiser_id = auth.uid() OR deals.creator_id = auth.uid())
  ));

CREATE POLICY "Deal participants can update files"
  ON public.deal_files FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Deal participants can delete files"
  ON public.deal_files FOR DELETE
  USING (auth.uid() = user_id);

-- 4. Deal terms acceptance
CREATE TABLE public.deal_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deal participants can view terms"
  ON public.deal_terms FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM deals
    WHERE deals.id = deal_terms.deal_id
      AND (deals.advertiser_id = auth.uid() OR deals.creator_id = auth.uid())
  ));

CREATE POLICY "Deal participants can insert terms"
  ON public.deal_terms FOR INSERT
  WITH CHECK (auth.uid() = created_by AND EXISTS (
    SELECT 1 FROM deals
    WHERE deals.id = deal_terms.deal_id
      AND (deals.advertiser_id = auth.uid() OR deals.creator_id = auth.uid())
  ));

CREATE POLICY "Deal participants can update terms"
  ON public.deal_terms FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM deals
    WHERE deals.id = deal_terms.deal_id
      AND (deals.advertiser_id = auth.uid() OR deals.creator_id = auth.uid())
  ));

CREATE TABLE public.deal_terms_acceptance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terms_id uuid NOT NULL REFERENCES public.deal_terms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(terms_id, user_id)
);

ALTER TABLE public.deal_terms_acceptance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deal participants can view acceptance"
  ON public.deal_terms_acceptance FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM deal_terms dt
    JOIN deals d ON d.id = dt.deal_id
    WHERE dt.id = deal_terms_acceptance.terms_id
      AND (d.advertiser_id = auth.uid() OR d.creator_id = auth.uid())
  ));

CREATE POLICY "Users can accept terms"
  ON public.deal_terms_acceptance FOR INSERT
  WITH CHECK (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM deal_terms dt
    JOIN deals d ON d.id = dt.deal_id
    WHERE dt.id = deal_terms_acceptance.terms_id
      AND (d.advertiser_id = auth.uid() OR d.creator_id = auth.uid())
  ));

-- 5. Storage bucket for deal files
INSERT INTO storage.buckets (id, name, public) VALUES ('deal-files', 'deal-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Deal file upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'deal-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Deal file download"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'deal-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Deal file delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'deal-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Updated_at triggers
CREATE TRIGGER update_deal_escrow_updated_at BEFORE UPDATE ON public.deal_escrow
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_deal_terms_updated_at BEFORE UPDATE ON public.deal_terms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
