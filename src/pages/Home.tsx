import { contentItems as mockItems, deals, creators } from "@/data/mockData";
import { ContentCard } from "@/components/content/ContentCard";
import { TrendingUp, Users, DollarSign, Zap, Sparkles, ArrowRight, BarChart3, Target, Loader2 } from "lucide-react";
import { useContentItems } from "@/hooks/useDbData";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { PageTransition } from "@/components/layout/PageTransition";
import { OnboardingWizard } from "@/components/layout/OnboardingWizard";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const statsByRole: Record<string, { label: string; value: string; icon: React.ElementType; change: string }[]> = {
  user: [
    { label: "Контент", value: "2.4K", icon: Zap, change: "+12%" },
    { label: "Авторы", value: "580", icon: Users, change: "+8%" },
    { label: "Сделки", value: "156", icon: DollarSign, change: "+24%" },
    { label: "Охват", value: "1.8M", icon: TrendingUp, change: "+15%" },
  ],
  creator: [
    { label: "Подписчики", value: "12.4K", icon: Users, change: "+18%" },
    { label: "Продажи", value: "₽84K", icon: DollarSign, change: "+32%" },
    { label: "Контент", value: "47", icon: Zap, change: "+5" },
    { label: "Охват", value: "340K", icon: TrendingUp, change: "+22%" },
  ],
  advertiser: [
    { label: "Кампании", value: "12", icon: Target, change: "+3" },
    { label: "Бюджет", value: "₽450K", icon: DollarSign, change: "−12%" },
    { label: "Охват", value: "2.1M", icon: TrendingUp, change: "+45%" },
    { label: "ROI", value: "3.2x", icon: BarChart3, change: "+0.4" },
  ],
};

const greetings: Record<string, string> = {
  user: "Что нового для вас",
  creator: "Ваша студия",
  advertiser: "Ваши кампании",
  moderator: "Панель управления",
};

const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.06 } } },
  item: { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } },
};

function mapItem(item: any) {
  return {
    id: item.id,
    title: item.title,
    description: item.description || "",
    type: item.type,
    thumbnail: item.thumbnail || "",
    creatorId: item.creator_id || item.creatorId || "",
    creatorName: item.creator_name || item.creatorName || "",
    creatorAvatar: item.creator_avatar || item.creatorAvatar || "",
    price: item.price ?? null,
    views: item.views || 0,
    likes: item.likes || 0,
    createdAt: item.created_at || item.createdAt || "",
    tags: item.tags || [],
  };
}

const Home = () => {
  const { data: dbItems } = useContentItems();
  const { primaryRole } = useUserRole();
  const { profile } = useAuth();

  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem("mediaos-onboarded");
    if (!done) setShowOnboarding(true);
  }, []);

  const handleOnboardingComplete = (role: string, interests: string[]) => {
    localStorage.setItem("mediaos-onboarded", "true");
    localStorage.setItem("mediaos-interests", JSON.stringify(interests));
    localStorage.setItem("mediaos-selected-role", role);
    setShowOnboarding(false);
  };

  const allItems = (dbItems && dbItems.length > 0 ? dbItems : mockItems).map(mapItem);

  // AI recommendations
  const interests = JSON.parse(localStorage.getItem("mediaos-interests") || "[]");
  const { data: aiRecommendations, isLoading: aiLoading } = useQuery({
    queryKey: ["ai-recommendations", interests, primaryRole],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("recommend-content", {
        body: { interests, userRole: primaryRole },
      });
      if (error) throw error;
      return (data?.recommendations || []) as string[];
    },
    staleTime: 10 * 60 * 1000,
    enabled: interests.length > 0,
  });

  // Sort items by AI recommendations
  const recommendedItems = aiRecommendations
    ? allItems
        .filter((item) => aiRecommendations.some((t: string) => t.toLowerCase() === item.title.toLowerCase()))
        .slice(0, 6)
    : [];

  const fallbackItems = allItems.slice(0, 4);
  const displayItems = recommendedItems.length > 0 ? recommendedItems : fallbackItems;

  const stats = statsByRole[primaryRole] || statsByRole.user;
  const displayName = profile?.display_name || "друг";
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? "Доброе утро" : hour < 18 ? "Добрый день" : "Добрый вечер";

  return (
    <PageTransition>
      {showOnboarding && <OnboardingWizard onComplete={handleOnboardingComplete} />}

      <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">
            {timeGreeting}, <span className="gradient-text">{displayName}</span> 👋
          </h1>
          <p className="text-muted-foreground">{greetings[primaryRole] || greetings.user}</p>
        </motion.div>

        <motion.div variants={stagger.container} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => (
            <motion.div
              key={s.label}
              variants={stagger.item}
              className="rounded-xl border border-border bg-card p-4 hover:shadow-lg hover:border-primary/20 transition-all duration-300 group cursor-default"
            >
              <div className="flex items-center justify-between mb-2">
                <s.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className={cn("text-xs font-medium", s.change.startsWith("+") || s.change.startsWith("−") ? "text-success" : "text-muted-foreground")}>{s.change}</span>
              </div>
              <p className="text-2xl font-bold text-card-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* AI recommendation banner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 p-5 flex items-center gap-4"
        >
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            {aiLoading ? <Loader2 className="h-5 w-5 text-primary animate-spin" /> : <Sparkles className="h-5 w-5 text-primary" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              {aiLoading ? "AI подбирает контент..." : recommendedItems.length > 0 ? "Персональная AI-подборка" : "Персональная подборка"}
            </p>
            <p className="text-xs text-muted-foreground">
              {recommendedItems.length > 0
                ? `AI подобрал ${recommendedItems.length} рекомендаций на основе ваших интересов`
                : "На основе ваших интересов и активности мы подобрали контент специально для вас"}
            </p>
          </div>
          <button onClick={() => window.location.href = "/explore"} className="hidden sm:flex items-center gap-1 text-xs font-medium text-primary hover:underline shrink-0">
            Смотреть <ArrowRight className="h-3 w-3" />
          </button>
        </motion.div>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              {recommendedItems.length > 0 ? "🤖 AI рекомендации для вас" : "Рекомендации для вас"}
            </h2>
            <button onClick={() => window.location.href = "/explore"} className="text-xs text-primary hover:underline flex items-center gap-1">
              Все <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <motion.div variants={stagger.container} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {displayItems.map((item: any) => (
              <motion.div key={item.id} variants={stagger.item}>
                <ContentCard item={item} />
              </motion.div>
            ))}
          </motion.div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Активные сделки</h2>
          <motion.div variants={stagger.container} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {deals.map((deal) => (
              <motion.div
                key={deal.id}
                variants={stagger.item}
                className="rounded-xl border border-border bg-card p-4 space-y-3 hover:shadow-lg hover:border-primary/20 transition-all duration-300"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium px-2 py-1 rounded-md bg-primary/10 text-primary">{deal.status}</span>
                  <span className="text-xs text-muted-foreground">{deal.budget.toLocaleString()} ₽</span>
                </div>
                <h3 className="font-medium text-sm text-card-foreground">{deal.title}</h3>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{deal.advertiserName}</span><span>→</span><span>{deal.creatorName}</span>
                </div>
                <div className="flex gap-1">
                  {deal.milestones.map((m) => (
                    <div key={m.id} className={`h-1.5 flex-1 rounded-full transition-colors ${m.completed ? "bg-success" : "bg-muted"}`} />
                  ))}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>
      </div>
    </PageTransition>
  );
};

export default Home;
