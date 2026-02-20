
ALTER TABLE public.studio_settings
  ADD COLUMN business_type text DEFAULT NULL,
  ADD COLUMN business_name text DEFAULT '',
  ADD COLUMN business_inn text DEFAULT '',
  ADD COLUMN business_ogrn text DEFAULT '',
  ADD COLUMN business_verified boolean DEFAULT false,
  ADD COLUMN bank_name text DEFAULT '',
  ADD COLUMN bank_bik text DEFAULT '',
  ADD COLUMN bank_account text DEFAULT '',
  ADD COLUMN bank_corr_account text DEFAULT '',
  ADD COLUMN bank_verified boolean DEFAULT false,
  ADD COLUMN ord_identifier text DEFAULT '',
  ADD COLUMN ord_token text DEFAULT '',
  ADD COLUMN ord_verified boolean DEFAULT false;
