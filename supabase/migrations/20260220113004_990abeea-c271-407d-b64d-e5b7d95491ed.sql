
ALTER TABLE public.studio_settings
  ADD COLUMN IF NOT EXISTS brand_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS brand_website text DEFAULT '',
  ADD COLUMN IF NOT EXISTS brand_description text DEFAULT '',
  ADD COLUMN IF NOT EXISTS brand_logo_url text DEFAULT '';
