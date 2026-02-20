
-- 1. Creator Offers — replaces simulated getCreatorMeta().offers
CREATE TABLE public.creator_offers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id uuid NOT NULL,
  offer_type text NOT NULL CHECK (offer_type IN ('video', 'post', 'podcast')),
  price integer NOT NULL DEFAULT 0,
  turnaround_days integer NOT NULL DEFAULT 7,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (creator_id, offer_type)
);

ALTER TABLE public.creator_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active offers"
  ON public.creator_offers FOR SELECT
  USING (is_active = true);

CREATE POLICY "Creators can manage own offers"
  ON public.creator_offers FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update own offers"
  ON public.creator_offers FOR UPDATE
  USING (auth.uid() = creator_id);

CREATE POLICY "Creators can delete own offers"
  ON public.creator_offers FOR DELETE
  USING (auth.uid() = creator_id);

CREATE TRIGGER update_creator_offers_updated_at
  BEFORE UPDATE ON public.creator_offers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Creator Platforms — replaces simulated getCreatorMeta().platforms
CREATE TABLE public.creator_platforms (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id uuid NOT NULL,
  platform_name text NOT NULL,
  subscriber_count integer NOT NULL DEFAULT 0,
  avg_views integer DEFAULT 0,
  channel_url text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (creator_id, platform_name)
);

ALTER TABLE public.creator_platforms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view platforms"
  ON public.creator_platforms FOR SELECT
  USING (true);

CREATE POLICY "Creators can manage own platforms"
  ON public.creator_platforms FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update own platforms"
  ON public.creator_platforms FOR UPDATE
  USING (auth.uid() = creator_id);

CREATE POLICY "Creators can delete own platforms"
  ON public.creator_platforms FOR DELETE
  USING (auth.uid() = creator_id);

CREATE TRIGGER update_creator_platforms_updated_at
  BEFORE UPDATE ON public.creator_platforms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. User Balances — for escrow flow
CREATE TABLE public.user_balances (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  available integer NOT NULL DEFAULT 0,
  reserved integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own balance"
  ON public.user_balances FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own balance"
  ON public.user_balances FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own balance"
  ON public.user_balances FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_user_balances_updated_at
  BEFORE UPDATE ON public.user_balances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add response_hours and safe_deal to profiles for marketplace metadata
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS response_hours integer DEFAULT 24,
  ADD COLUMN IF NOT EXISTS safe_deal boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS deals_count integer DEFAULT 0;
