
-- Drop the security definer view and use a function instead
DROP VIEW IF EXISTS public.advertiser_brand_public;

-- Create a security definer function to safely expose brand data
CREATE OR REPLACE FUNCTION public.get_advertiser_brand(p_user_id uuid)
RETURNS TABLE (
  user_id uuid,
  brand_name text,
  brand_website text,
  brand_description text,
  brand_logo_url text,
  business_verified boolean,
  ord_verified boolean
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
    ss.ord_verified
  FROM public.studio_settings ss
  WHERE ss.user_id = p_user_id
    AND ss.brand_name IS NOT NULL
    AND ss.brand_name != '';
$$;
