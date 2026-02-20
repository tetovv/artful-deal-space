
-- Create a public view for advertiser brand info (non-sensitive fields only)
CREATE OR REPLACE VIEW public.advertiser_brand_public
WITH (security_invoker = false) AS
SELECT
  user_id,
  brand_name,
  brand_website,
  brand_description,
  brand_logo_url,
  business_verified,
  ord_verified
FROM public.studio_settings
WHERE brand_name IS NOT NULL AND brand_name != '';

-- Allow anyone to read the public brand view
GRANT SELECT ON public.advertiser_brand_public TO anon, authenticated;
