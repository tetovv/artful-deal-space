
-- Function to award achievement (idempotent)
CREATE OR REPLACE FUNCTION public.award_achievement(
  _user_id uuid,
  _type text,
  _title text,
  _description text,
  _icon text DEFAULT '🏆'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.achievements (user_id, type, title, description, icon)
  VALUES (_user_id, _type, _title, _description, _icon)
  ON CONFLICT DO NOTHING;
END;
$$;

-- Create unique index to prevent duplicate achievements
CREATE UNIQUE INDEX IF NOT EXISTS idx_achievements_user_type ON public.achievements (user_id, type);

-- ==========================================
-- 1. CONTENT MILESTONES
-- ==========================================
CREATE OR REPLACE FUNCTION public.check_content_achievements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cnt int;
BEGIN
  IF NEW.creator_id IS NULL THEN RETURN NEW; END IF;

  SELECT count(*) INTO cnt FROM content_items WHERE creator_id = NEW.creator_id AND status = 'published';

  IF cnt = 1 THEN
    PERFORM award_achievement(NEW.creator_id, 'first_content', 'Первый контент', 'Опубликовал первый контент', '🎬');
  END IF;
  IF cnt >= 10 THEN
    PERFORM award_achievement(NEW.creator_id, 'content_10', '10 публикаций', 'Опубликовал 10 единиц контента', '📚');
  END IF;
  IF cnt >= 50 THEN
    PERFORM award_achievement(NEW.creator_id, 'content_50', '50 публикаций', 'Опубликовал 50 единиц контента', '🗂️');
  END IF;
  IF cnt >= 100 THEN
    PERFORM award_achievement(NEW.creator_id, 'content_100', '100 публикаций', 'Опубликовал 100 единиц контента', '🏛️');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_content_achievements
AFTER INSERT OR UPDATE ON public.content_items
FOR EACH ROW
EXECUTE FUNCTION public.check_content_achievements();

-- ==========================================
-- 2. FREE SUBSCRIBER MILESTONES
-- ==========================================
CREATE OR REPLACE FUNCTION public.check_subscriber_achievements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cnt int;
BEGIN
  SELECT count(*) INTO cnt FROM subscriptions WHERE creator_id = NEW.creator_id;

  IF cnt = 1 THEN
    PERFORM award_achievement(NEW.creator_id, 'first_subscriber', 'Первый подписчик', 'Получил первого подписчика', '👤');
  END IF;
  IF cnt >= 10 THEN
    PERFORM award_achievement(NEW.creator_id, 'subscribers_10', '10 подписчиков', 'Набрал 10 подписчиков', '👥');
  END IF;
  IF cnt >= 100 THEN
    PERFORM award_achievement(NEW.creator_id, 'subscribers_100', '100 подписчиков', 'Набрал 100 подписчиков', '🔥');
  END IF;
  IF cnt >= 1000 THEN
    PERFORM award_achievement(NEW.creator_id, 'subscribers_1k', '1000 подписчиков', 'Набрал 1000 подписчиков', '⭐');
  END IF;
  IF cnt >= 10000 THEN
    PERFORM award_achievement(NEW.creator_id, 'subscribers_10k', '10K подписчиков', 'Набрал 10 000 подписчиков', '💎');
  END IF;

  -- Achievement for the subscriber too
  DECLARE sub_cnt int;
  BEGIN
    SELECT count(*) INTO sub_cnt FROM subscriptions WHERE user_id = NEW.user_id;
    IF sub_cnt = 1 THEN
      PERFORM award_achievement(NEW.user_id, 'first_follow', 'Первая подписка', 'Подписался на первого автора', '🔔');
    END IF;
  END;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_subscriber_achievements
AFTER INSERT ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.check_subscriber_achievements();

-- ==========================================
-- 3. PAID SUBSCRIBER MILESTONES
-- ==========================================
CREATE OR REPLACE FUNCTION public.check_paid_sub_achievements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cnt int;
BEGIN
  SELECT count(*) INTO cnt FROM paid_subscriptions WHERE creator_id = NEW.creator_id AND status = 'active';

  IF cnt = 1 THEN
    PERFORM award_achievement(NEW.creator_id, 'first_paid_sub', 'Первый платный подписчик', 'Получил первого платного подписчика', '💰');
  END IF;
  IF cnt >= 10 THEN
    PERFORM award_achievement(NEW.creator_id, 'paid_subs_10', '10 платных подписчиков', 'Набрал 10 платных подписчиков', '💳');
  END IF;
  IF cnt >= 100 THEN
    PERFORM award_achievement(NEW.creator_id, 'paid_subs_100', '100 платных подписчиков', 'Набрал 100 платных подписчиков', '🤑');
  END IF;

  -- For subscriber
  PERFORM award_achievement(NEW.user_id, 'first_premium', 'Премиум-подписчик', 'Оформил первую платную подписку', '👑');

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_paid_sub_achievements
AFTER INSERT ON public.paid_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.check_paid_sub_achievements();

-- ==========================================
-- 4. DEAL MILESTONES
-- ==========================================
CREATE OR REPLACE FUNCTION public.check_deal_achievements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  creator_deals int;
  adv_deals int;
BEGIN
  -- First deal created
  IF TG_OP = 'INSERT' THEN
    PERFORM award_achievement(NEW.advertiser_id, 'first_deal_adv', 'Первая сделка', 'Создал первую рекламную сделку', '🤝');
  END IF;

  -- Completed deal milestones
  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status <> 'completed') THEN
    IF NEW.creator_id IS NOT NULL THEN
      SELECT count(*) INTO creator_deals FROM deals WHERE creator_id = NEW.creator_id AND status = 'completed';
      IF creator_deals = 1 THEN
        PERFORM award_achievement(NEW.creator_id, 'first_completed_deal', 'Первая завершённая сделка', 'Успешно завершил первую сделку', '✅');
      END IF;
      IF creator_deals >= 10 THEN
        PERFORM award_achievement(NEW.creator_id, 'completed_deals_10', '10 сделок', 'Завершил 10 сделок', '📈');
      END IF;
      IF creator_deals >= 50 THEN
        PERFORM award_achievement(NEW.creator_id, 'completed_deals_50', '50 сделок', 'Завершил 50 сделок', '🚀');
      END IF;
    END IF;

    IF NEW.advertiser_id IS NOT NULL THEN
      SELECT count(*) INTO adv_deals FROM deals WHERE advertiser_id = NEW.advertiser_id AND status = 'completed';
      IF adv_deals >= 10 THEN
        PERFORM award_achievement(NEW.advertiser_id, 'adv_deals_10', '10 рекламных кампаний', 'Провёл 10 рекламных кампаний', '📊');
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_deal_achievements
AFTER INSERT OR UPDATE ON public.deals
FOR EACH ROW
EXECUTE FUNCTION public.check_deal_achievements();

-- ==========================================
-- 5. PURCHASE / SALES MILESTONES
-- ==========================================
CREATE OR REPLACE FUNCTION public.check_purchase_achievements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  buyer_cnt int;
  seller_id uuid;
  sales_cnt int;
BEGIN
  -- Buyer achievements
  SELECT count(*) INTO buyer_cnt FROM purchases WHERE user_id = NEW.user_id;
  IF buyer_cnt = 1 THEN
    PERFORM award_achievement(NEW.user_id, 'first_purchase', 'Первая покупка', 'Купил первый контент', '🛒');
  END IF;
  IF buyer_cnt >= 10 THEN
    PERFORM award_achievement(NEW.user_id, 'purchases_10', '10 покупок', 'Совершил 10 покупок', '🛍️');
  END IF;

  -- Seller achievements
  SELECT creator_id INTO seller_id FROM content_items WHERE id = NEW.content_id;
  IF seller_id IS NOT NULL THEN
    SELECT count(*) INTO sales_cnt FROM purchases p JOIN content_items c ON c.id = p.content_id WHERE c.creator_id = seller_id;
    IF sales_cnt = 1 THEN
      PERFORM award_achievement(seller_id, 'first_sale', 'Первая продажа', 'Совершил первую продажу', '💵');
    END IF;
    IF sales_cnt >= 10 THEN
      PERFORM award_achievement(seller_id, 'sales_10', '10 продаж', 'Продал 10 единиц контента', '💹');
    END IF;
    IF sales_cnt >= 100 THEN
      PERFORM award_achievement(seller_id, 'sales_100', '100 продаж', 'Продал 100 единиц контента', '🏆');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_purchase_achievements
AFTER INSERT ON public.purchases
FOR EACH ROW
EXECUTE FUNCTION public.check_purchase_achievements();

-- ==========================================
-- 6. VIEWS MILESTONES (per content item)
-- ==========================================
CREATE OR REPLACE FUNCTION public.check_views_achievements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_views bigint;
BEGIN
  IF NEW.creator_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.views IS NULL THEN RETURN NEW; END IF;

  -- Per-item milestones
  IF NEW.views >= 1000 THEN
    PERFORM award_achievement(NEW.creator_id, 'views_1k_' || NEW.id, '1K просмотров', 'Контент набрал 1 000 просмотров', '👁️');
  END IF;
  IF NEW.views >= 10000 THEN
    PERFORM award_achievement(NEW.creator_id, 'views_10k_' || NEW.id, '10K просмотров', 'Контент набрал 10 000 просмотров', '🔭');
  END IF;

  -- Total views across all content
  SELECT coalesce(sum(views), 0) INTO total_views FROM content_items WHERE creator_id = NEW.creator_id;
  IF total_views >= 10000 THEN
    PERFORM award_achievement(NEW.creator_id, 'total_views_10k', '10K суммарных просмотров', 'Суммарно набрал 10 000 просмотров', '📺');
  END IF;
  IF total_views >= 100000 THEN
    PERFORM award_achievement(NEW.creator_id, 'total_views_100k', '100K суммарных просмотров', 'Суммарно набрал 100 000 просмотров', '🌟');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_views_achievements
AFTER UPDATE OF views ON public.content_items
FOR EACH ROW
EXECUTE FUNCTION public.check_views_achievements();

-- ==========================================
-- 7. RATING MILESTONES
-- ==========================================
CREATE OR REPLACE FUNCTION public.check_rating_achievements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cnt int;
BEGIN
  IF NEW.to_id IS NULL THEN RETURN NEW; END IF;

  SELECT count(*) INTO cnt FROM ratings WHERE to_id = NEW.to_id;
  IF cnt = 1 THEN
    PERFORM award_achievement(NEW.to_id, 'first_rating', 'Первый отзыв', 'Получил первый отзыв', '⭐');
  END IF;
  IF cnt >= 10 THEN
    PERFORM award_achievement(NEW.to_id, 'ratings_10', '10 отзывов', 'Получил 10 отзывов', '🌟');
  END IF;

  -- Reviewer achievement
  IF NEW.from_id IS NOT NULL THEN
    PERFORM award_achievement(NEW.from_id, 'first_review', 'Критик', 'Оставил первый отзыв', '✍️');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_rating_achievements
AFTER INSERT ON public.ratings
FOR EACH ROW
EXECUTE FUNCTION public.check_rating_achievements();

-- ==========================================
-- 8. BOOKMARK MILESTONES
-- ==========================================
CREATE OR REPLACE FUNCTION public.check_bookmark_achievements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cnt int;
BEGIN
  SELECT count(*) INTO cnt FROM bookmarks WHERE user_id = NEW.user_id;
  IF cnt = 1 THEN
    PERFORM award_achievement(NEW.user_id, 'first_bookmark', 'Коллекционер', 'Добавил первый контент в закладки', '📌');
  END IF;
  IF cnt >= 50 THEN
    PERFORM award_achievement(NEW.user_id, 'bookmarks_50', 'Библиотекарь', 'Добавил 50 единиц в закладки', '📖');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bookmark_achievements
AFTER INSERT ON public.bookmarks
FOR EACH ROW
EXECUTE FUNCTION public.check_bookmark_achievements();

-- ==========================================
-- 9. VIEW HISTORY (listening/watching)
-- ==========================================
CREATE OR REPLACE FUNCTION public.check_watch_achievements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cnt int;
  total_sec bigint;
BEGIN
  SELECT count(*) INTO cnt FROM view_history WHERE user_id = NEW.user_id;
  IF cnt = 1 THEN
    PERFORM award_achievement(NEW.user_id, 'first_view', 'Первый просмотр', 'Просмотрел первый контент', '▶️');
  END IF;
  IF cnt >= 100 THEN
    PERFORM award_achievement(NEW.user_id, 'views_100', '100 просмотров', 'Просмотрел 100 единиц контента', '📱');
  END IF;

  -- Total watch time milestones
  SELECT coalesce(sum(watched_seconds), 0) INTO total_sec FROM view_history WHERE user_id = NEW.user_id;
  IF total_sec >= 3600 THEN
    PERFORM award_achievement(NEW.user_id, 'watch_1h', '1 час просмотра', 'Суммарно провёл 1 час за просмотром', '⏱️');
  END IF;
  IF total_sec >= 36000 THEN
    PERFORM award_achievement(NEW.user_id, 'watch_10h', '10 часов просмотра', 'Суммарно провёл 10 часов за просмотром', '🕐');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_watch_achievements
AFTER INSERT OR UPDATE ON public.view_history
FOR EACH ROW
EXECUTE FUNCTION public.check_watch_achievements();
