
-- Contracts table: stores original contracts and addendums with versioning
CREATE TABLE public.contracts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  campaign_id text, -- local campaign reference (not FK since campaigns are client-side for now)
  version integer NOT NULL DEFAULT 1,
  document_type text NOT NULL DEFAULT 'original', -- 'original' or 'addendum'
  file_name text,
  file_size integer,
  stored_text text, -- full document text if user opted to store
  extracted_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence_map jsonb DEFAULT '{}'::jsonb, -- field -> confidence scores
  source_snippets jsonb DEFAULT '{}'::jsonb, -- field -> source text snippets
  status text NOT NULL DEFAULT 'extracted', -- extracted, confirmed, superseded
  confirmed_by uuid,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own contracts" ON public.contracts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own contracts" ON public.contracts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own contracts" ON public.contracts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own contracts" ON public.contracts FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_contracts_user_id ON public.contracts (user_id);
CREATE INDEX idx_contracts_campaign_id ON public.contracts (campaign_id);

CREATE TRIGGER update_contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
