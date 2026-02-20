
-- Promo codes table
CREATE TABLE public.promo_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id uuid NOT NULL,
  code text NOT NULL,
  discount_percent integer NOT NULL DEFAULT 10,
  max_uses integer DEFAULT NULL,
  used_count integer NOT NULL DEFAULT 0,
  expires_at timestamp with time zone DEFAULT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_promo_codes_code ON public.promo_codes (code);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators can view own promos"
  ON public.promo_codes FOR SELECT
  USING (auth.uid() = creator_id);

CREATE POLICY "Creators can insert own promos"
  ON public.promo_codes FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update own promos"
  ON public.promo_codes FOR UPDATE
  USING (auth.uid() = creator_id);

CREATE POLICY "Creators can delete own promos"
  ON public.promo_codes FOR DELETE
  USING (auth.uid() = creator_id);

-- Studio settings table
CREATE TABLE public.studio_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  channel_name text DEFAULT '',
  channel_description text DEFAULT '',
  default_language text DEFAULT 'ru',
  default_monetization text DEFAULT 'free',
  auto_publish boolean DEFAULT false,
  watermark_enabled boolean DEFAULT false,
  notify_new_subscriber boolean DEFAULT true,
  notify_new_comment boolean DEFAULT true,
  notify_new_deal boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.studio_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings"
  ON public.studio_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON public.studio_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON public.studio_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_studio_settings_updated_at
  BEFORE UPDATE ON public.studio_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
