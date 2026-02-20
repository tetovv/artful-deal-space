
-- Add new columns first
ALTER TABLE public.studio_settings
  ADD COLUMN IF NOT EXISTS business_category text DEFAULT '',
  ADD COLUMN IF NOT EXISTS contact_email text DEFAULT '';

-- Now recreate the function with new return type
DROP FUNCTION IF EXISTS public.get_advertiser_brand(uuid);

CREATE OR REPLACE FUNCTION public.get_advertiser_brand(p_user_id uuid)
RETURNS TABLE (
  user_id uuid,
  brand_name text,
  brand_website text,
  brand_description text,
  brand_logo_url text,
  business_verified boolean,
  ord_verified boolean,
  business_category text,
  contact_email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ss.user_id,
    ss.brand_name,
    ss.brand_website,
    ss.brand_description,
    ss.brand_logo_url,
    ss.business_verified,
    ss.ord_verified,
    ss.business_category,
    ss.contact_email
  FROM public.studio_settings ss
  WHERE ss.user_id = p_user_id
    AND ss.brand_name IS NOT NULL
    AND ss.brand_name != '';
$$;
