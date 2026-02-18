
-- Content items
CREATE TABLE public.content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  type TEXT NOT NULL CHECK (type IN ('video','music','post','podcast','book','template','image')),
  thumbnail TEXT DEFAULT '',
  creator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_name TEXT NOT NULL DEFAULT '',
  creator_avatar TEXT DEFAULT '',
  price INTEGER, -- null = free
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view content" ON public.content_items FOR SELECT USING (true);
CREATE POLICY "Creators can insert own content" ON public.content_items FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Creators can update own content" ON public.content_items FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "Creators can delete own content" ON public.content_items FOR DELETE USING (auth.uid() = creator_id);

-- Purchases
CREATE TABLE public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, content_id)
);

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own purchases" ON public.purchases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own purchases" ON public.purchases FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Deals
CREATE TABLE public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  advertiser_name TEXT NOT NULL DEFAULT '',
  creator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  creator_name TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  budget INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','briefing','in_progress','review','completed','disputed')),
  deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deal participants can view" ON public.deals FOR SELECT USING (auth.uid() = advertiser_id OR auth.uid() = creator_id);
CREATE POLICY "Advertisers can create deals" ON public.deals FOR INSERT WITH CHECK (auth.uid() = advertiser_id);
CREATE POLICY "Participants can update deals" ON public.deals FOR UPDATE USING (auth.uid() = advertiser_id OR auth.uid() = creator_id);

-- Milestones
CREATE TABLE public.milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  due_date TIMESTAMPTZ,
  sort_order INTEGER DEFAULT 0
);

ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Milestone access via deal" ON public.milestones FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.deals WHERE deals.id = milestones.deal_id AND (deals.advertiser_id = auth.uid() OR deals.creator_id = auth.uid())));
CREATE POLICY "Milestone update via deal" ON public.milestones FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.deals WHERE deals.id = milestones.deal_id AND (deals.advertiser_id = auth.uid() OR deals.creator_id = auth.uid())));
CREATE POLICY "Milestone insert via deal" ON public.milestones FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.deals WHERE deals.id = milestones.deal_id AND (deals.advertiser_id = auth.uid() OR deals.creator_id = auth.uid())));

-- Messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_name TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  attachment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Message access via deal" ON public.messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.deals WHERE deals.id = messages.deal_id AND (deals.advertiser_id = auth.uid() OR deals.creator_id = auth.uid())));
CREATE POLICY "Message insert via deal" ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.deals WHERE deals.id = messages.deal_id AND (deals.advertiser_id = auth.uid() OR deals.creator_id = auth.uid())));

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Ratings
CREATE TABLE public.ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  from_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  to_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  communication INTEGER CHECK (communication BETWEEN 1 AND 5),
  payment INTEGER CHECK (payment BETWEEN 1 AND 5),
  professionalism INTEGER CHECK (professionalism BETWEEN 1 AND 5),
  overall NUMERIC(3,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view ratings" ON public.ratings FOR SELECT USING (true);
CREATE POLICY "Participants can rate" ON public.ratings FOR INSERT
  WITH CHECK (auth.uid() = from_id AND EXISTS (SELECT 1 FROM public.deals WHERE deals.id = ratings.deal_id AND deals.status = 'completed' AND (deals.advertiser_id = auth.uid() OR deals.creator_id = auth.uid())));

-- Disputes
CREATE TABLE public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  raised_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL DEFAULT '',
  status TEXT DEFAULT 'open' CHECK (status IN ('open','in_review','resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dispute participants can view" ON public.disputes FOR SELECT
  USING (auth.uid() = raised_by OR EXISTS (SELECT 1 FROM public.deals WHERE deals.id = disputes.deal_id AND (deals.advertiser_id = auth.uid() OR deals.creator_id = auth.uid())));
CREATE POLICY "Participants can create disputes" ON public.disputes FOR INSERT
  WITH CHECK (auth.uid() = raised_by);

-- AI Courses
CREATE TABLE public.ai_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading','processing','generating','completed','failed')),
  progress INTEGER DEFAULT 0,
  modules JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own courses" ON public.ai_courses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create courses" ON public.ai_courses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own courses" ON public.ai_courses FOR UPDATE USING (auth.uid() = user_id);
