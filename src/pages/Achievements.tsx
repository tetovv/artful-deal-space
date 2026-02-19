import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageTransition } from "@/components/layout/PageTransition";
import { Trophy, Lock, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const ALL_ACHIEVEMENTS = [
  // Content
  { type: "first_content", title: "Первый контент", description: "Опубликуйте первый контент", icon: "🎬", category: "Контент" },
  { type: "content_10", title: "10 публикаций", description: "Опубликуйте 10 единиц контента", icon: "📚", category: "Контент" },
  { type: "content_50", title: "50 публикаций", description: "Опубликуйте 50 единиц контента", icon: "🗂️", category: "Контент" },
  { type: "content_100", title: "100 публикаций", description: "Опубликуйте 100 единиц контента", icon: "🏛️", category: "Контент" },
  // Subscribers
  { type: "first_subscriber", title: "Первый подписчик", description: "Получите первого подписчика", icon: "👤", category: "Подписчики" },
  { type: "subscribers_10", title: "10 подписчиков", description: "Наберите 10 подписчиков", icon: "👥", category: "Подписчики" },
  { type: "subscribers_100", title: "100 подписчиков", description: "Наберите 100 подписчиков", icon: "🔥", category: "Подписчики" },
  { type: "subscribers_1k", title: "1000 подписчиков", description: "Наберите 1000 подписчиков", icon: "⭐", category: "Подписчики" },
  { type: "subscribers_10k", title: "10K подписчиков", description: "Наберите 10 000 подписчиков", icon: "💎", category: "Подписчики" },
  { type: "first_follow", title: "Первая подписка", description: "Подпишитесь на первого автора", icon: "🔔", category: "Подписчики" },
  // Paid subs
  { type: "first_paid_sub", title: "Первый платный подписчик", description: "Получите первого платного подписчика", icon: "💰", category: "Монетизация" },
  { type: "paid_subs_10", title: "10 платных подписчиков", description: "Наберите 10 платных подписчиков", icon: "💳", category: "Монетизация" },
  { type: "paid_subs_100", title: "100 платных подписчиков", description: "Наберите 100 платных подписчиков", icon: "🤑", category: "Монетизация" },
  { type: "first_premium", title: "Премиум-подписчик", description: "Оформите первую платную подписку", icon: "👑", category: "Монетизация" },
  // Deals
  { type: "first_deal_adv", title: "Первая сделка", description: "Создайте первую рекламную сделку", icon: "🤝", category: "Сделки" },
  { type: "first_completed_deal", title: "Первая завершённая сделка", description: "Успешно завершите первую сделку", icon: "✅", category: "Сделки" },
  { type: "completed_deals_10", title: "10 сделок", description: "Завершите 10 сделок", icon: "📈", category: "Сделки" },
  { type: "completed_deals_50", title: "50 сделок", description: "Завершите 50 сделок", icon: "🚀", category: "Сделки" },
  { type: "adv_deals_10", title: "10 рекламных кампаний", description: "Проведите 10 рекламных кампаний", icon: "📊", category: "Сделки" },
  // Purchases / Sales
  { type: "first_purchase", title: "Первая покупка", description: "Купите первый контент", icon: "🛒", category: "Покупки и продажи" },
  { type: "purchases_10", title: "10 покупок", description: "Совершите 10 покупок", icon: "🛍️", category: "Покупки и продажи" },
  { type: "first_sale", title: "Первая продажа", description: "Совершите первую продажу", icon: "💵", category: "Покупки и продажи" },
  { type: "sales_10", title: "10 продаж", description: "Продайте 10 единиц контента", icon: "💹", category: "Покупки и продажи" },
  { type: "sales_100", title: "100 продаж", description: "Продайте 100 единиц контента", icon: "🏆", category: "Покупки и продажи" },
  // Views
  { type: "total_views_10k", title: "10K суммарных просмотров", description: "Наберите 10 000 суммарных просмотров", icon: "📺", category: "Просмотры" },
  { type: "total_views_100k", title: "100K суммарных просмотров", description: "Наберите 100 000 суммарных просмотров", icon: "🌟", category: "Просмотры" },
  // Ratings
  { type: "first_rating", title: "Первый отзыв", description: "Получите первый отзыв", icon: "⭐", category: "Отзывы" },
  { type: "ratings_10", title: "10 отзывов", description: "Получите 10 отзывов", icon: "🌟", category: "Отзывы" },
  { type: "first_review", title: "Критик", description: "Оставьте первый отзыв", icon: "✍️", category: "Отзывы" },
  // Bookmarks
  { type: "first_bookmark", title: "Коллекционер", description: "Добавьте первый контент в закладки", icon: "📌", category: "Активность" },
  { type: "bookmarks_50", title: "Библиотекарь", description: "Добавьте 50 единиц в закладки", icon: "📖", category: "Активность" },
  // Watch
  { type: "first_view", title: "Первый просмотр", description: "Просмотрите первый контент", icon: "▶️", category: "Активность" },
  { type: "views_100", title: "100 просмотров", description: "Просмотрите 100 единиц контента", icon: "📱", category: "Активность" },
  { type: "watch_1h", title: "1 час просмотра", description: "Проведите 1 час за просмотром", icon: "⏱️", category: "Активность" },
  { type: "watch_10h", title: "10 часов просмотра", description: "Проведите 10 часов за просмотром", icon: "🕐", category: "Активность" },
];

const CATEGORIES = [...new Set(ALL_ACHIEVEMENTS.map((a) => a.category))];

export default function Achievements() {
  const { user } = useAuth();

  const { data: earned = [] } = useQuery({
    queryKey: ["my-achievements", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("achievements")
        .select("type, earned_at")
        .eq("user_id", user.id);
      return data || [];
    },
    enabled: !!user?.id,
  });

  const earnedMap = new Map(earned.map((a) => [a.type, a.earned_at]));
  const earnedCount = earned.length;
  const totalCount = ALL_ACHIEVEMENTS.length;
  const progress = totalCount > 0 ? Math.round((earnedCount / totalCount) * 100) : 0;

  return (
    <PageTransition>
      <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Trophy className="h-6 w-6 text-warning" /> Достижения
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Получено {earnedCount} из {totalCount}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-foreground">{progress}%</p>
            <div className="w-32 h-2 bg-muted rounded-full mt-1 overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        {CATEGORIES.map((cat) => {
          const items = ALL_ACHIEVEMENTS.filter((a) => a.category === cat);
          const catEarned = items.filter((a) => earnedMap.has(a.type)).length;
          return (
            <section key={cat} className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">{cat}</h2>
                <span className="text-xs text-muted-foreground">{catEarned}/{items.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {items.map((a) => {
                  const isEarned = earnedMap.has(a.type);
                  const earnedAt = earnedMap.get(a.type);
                  return (
                    <div
                      key={a.type}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border p-4 transition-colors",
                        isEarned
                          ? "border-primary/30 bg-primary/5"
                          : "border-border bg-card opacity-60"
                      )}
                    >
                      <span className="text-2xl">{a.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-card-foreground truncate">{a.title}</p>
                          {isEarned && <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground">{a.description}</p>
                        {isEarned && earnedAt && (
                          <p className="text-[10px] text-primary mt-0.5">
                            {new Date(earnedAt).toLocaleDateString("ru-RU")}
                          </p>
                        )}
                      </div>
                      {!isEarned && <Lock className="h-4 w-4 text-muted-foreground shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </PageTransition>
  );
}
