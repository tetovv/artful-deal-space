import { contentItems as mockItems, deals as mockDeals, contentTypeLabels } from "@/data/mockData";
import { ContentCard } from "@/components/content/ContentCard";
import {
  TrendingUp, Users, DollarSign, Zap, Sparkles, ArrowRight, BarChart3, Target,
  Loader2, Plus, FileText, Image, Music, Video, Mic, BookOpen, Layout, Eye, Heart,
  Handshake, Clock, CheckCircle2, AlertTriangle, Star, Wallet, PieChart, Activity,
  Search,
} from "lucide-react";
import { useContentItems } from "@/hooks/useDbData";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { PageTransition } from "@/components/layout/PageTransition";
import { OnboardingWizard } from "@/components/layout/OnboardingWizard";
import { useState, useEffect, useMemo } from "react";
import { ChartTypeSelector, ChartType } from "@/components/ChartTypeSelector";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ContentType } from "@/types";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart as RePieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";

const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.06 } } },
  item: { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } },
};

const contentTypeOptions = [
  { type: "video", label: "Видео", icon: Video, color: "text-destructive" },
  { type: "post", label: "Пост", icon: FileText, color: "text-primary" },
  { type: "music", label: "Музыка", icon: Music, color: "text-warning" },
  { type: "podcast", label: "Подкаст", icon: Mic, color: "text-info" },
  { type: "book", label: "Книга", icon: BookOpen, color: "text-success" },
  { type: "template", label: "Шаблон", icon: Layout, color: "text-muted-foreground" },
];

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
    duration: item.duration ?? null,
  };
}

function StatCard({ icon: Icon, label, value, sub, color }: { icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 hover:shadow-lg hover:border-primary/20 transition-all duration-300 group">
      <div className="flex items-center gap-3 mb-2">
        <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", color || "bg-primary/10")}>
          <Icon className={cn("h-4 w-4", color ? "text-card-foreground" : "text-primary")} />
        </div>
      </div>
      <p className="text-2xl font-bold text-card-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function DealMiniCard({ deal, navigate }: { deal: any; navigate: (path: string) => void }) {
  const statusLabels: Record<string, string> = {
    pending: "Ожидает", briefing: "Бриф", in_progress: "В работе", review: "Ревью",
    completed: "Завершена", disputed: "Спор",
  };
  const statusColors: Record<string, string> = {
    pending: "bg-warning/10 text-warning", in_progress: "bg-primary/10 text-primary",
    completed: "bg-success/10 text-success", disputed: "bg-destructive/10 text-destructive",
    briefing: "bg-accent/10 text-accent-foreground", review: "bg-info/10 text-info",
  };
  return (
    <div
      onClick={() => navigate("/marketplace")}
      className="rounded-xl border border-border bg-card p-4 space-y-2 hover:shadow-lg hover:border-primary/20 transition-all duration-300 cursor-pointer"
    >
      <div className="flex items-center justify-between">
        <span className={cn("text-xs font-medium px-2 py-1 rounded-md", statusColors[deal.status] || statusColors.pending)}>
          {statusLabels[deal.status] || deal.status}
        </span>
        <span className="text-xs text-muted-foreground">{(deal.budget || 0).toLocaleString()} ₽</span>
      </div>
      <h3 className="font-medium text-sm text-card-foreground truncate">{deal.title}</h3>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{deal.advertiser_name || deal.advertiserName}</span><span>→</span><span>{deal.creator_name || deal.creatorName}</span>
      </div>
    </div>
  );
}

function AdvertiserCharts({ spendingChartData, dealStatusPie, PIE_COLORS }: { spendingChartData: any[]; dealStatusPie: any[]; PIE_COLORS: string[] }) {
  const [spendingChartType, setSpendingChartType] = useState<ChartType>("bar");
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Динамика расходов</span>
            </div>
            <ChartTypeSelector value={spendingChartType} onChange={setSpendingChartType} />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            {spendingChartType === "line" ? (
              <LineChart data={spendingChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => `₽${v.toLocaleString()}`} />
                <Line type="monotone" dataKey="spent" stroke="hsl(var(--primary))" strokeWidth={2.5} name="Расходы" dot={{ r: 4, fill: "hsl(var(--primary))" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </LineChart>
            ) : spendingChartType === "area" ? (
              <AreaChart data={spendingChartData}>
                <defs>
                  <linearGradient id="sg1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => `₽${v.toLocaleString()}`} />
                <Area type="monotone" dataKey="spent" stroke="hsl(var(--primary))" fill="url(#sg1)" strokeWidth={2.5} name="Расходы" />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </AreaChart>
            ) : (
              <BarChart data={spendingChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => `₽${v.toLocaleString()}`} />
                <Bar dataKey="spent" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Расходы" />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <PieChart className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Статусы сделок</span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <RePieChart>
              <Pie data={dealStatusPie} cx="50%" cy="45%" innerRadius={45} outerRadius={75} paddingAngle={4} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                {dealStatusPie.map((_: any, i: number) => {
                  const colors = ["hsl(var(--warning))", "hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--destructive))"];
                  return <Cell key={i} fill={colors[i % colors.length]} />;
                })}
              </Pie>
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </RePieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

const Home = () => {
  const { data: dbItems } = useContentItems();
  const { primaryRole, isCreator, isAdvertiser } = useUserRole();
  const { profile, user } = useAuth();
  const navigate = useNavigate();

  // Redirect creators to studio
  useEffect(() => {
    if (isCreator) {
      navigate("/creator-studio", { replace: true });
      return;
    }
    // Start page redirect — only on first session load
    const alreadyRedirected = sessionStorage.getItem("mediaos-start-redirected");
    if (alreadyRedirected) return;
    try {
      const saved = localStorage.getItem("mediaos-settings");
      if (saved) {
        const s = JSON.parse(saved);
        if (s.startPage && s.startPage !== "/") {
          sessionStorage.setItem("mediaos-start-redirected", "true");
          navigate(s.startPage, { replace: true });
          return;
        }
      }
    } catch {}
  }, [isCreator]);

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

  // DB deals
  const { data: dbDeals = [] } = useQuery({
    queryKey: ["my-deals-dashboard", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase.from("deals").select("*").order("created_at", { ascending: false });
      return data || [];
    },
    enabled: (isCreator || isAdvertiser) && !!user?.id,
  });

  // DB ratings for advertiser
  const { data: dbRatings = [] } = useQuery({
    queryKey: ["my-ratings-dashboard", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase.from("ratings").select("*");
      return data || [];
    },
    enabled: isAdvertiser && !!user?.id,
  });

  // DB notifications count
  const { data: notifCount = 0 } = useQuery({
    queryKey: ["notif-count-dashboard", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count } = await supabase.from("notifications").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("read", false);
      return count || 0;
    },
    enabled: !!user?.id,
  });

  const allItems = (dbItems && dbItems.length > 0 ? dbItems : mockItems).map(mapItem);

  // Creator stats
  const myItems = allItems.filter((i) => i.creatorId === user?.id);
  const totalViews = myItems.reduce((s, i) => s + i.views, 0);
  const totalLikes = myItems.reduce((s, i) => s + i.likes, 0);
  const totalRevenue = myItems.reduce((s, i) => s + (i.price || 0), 0);

  const creatorDeals = dbDeals.filter((d: any) => d.creator_id === user?.id);
  const creatorPending = creatorDeals.filter((d: any) => d.status === "pending").length;
  const creatorActive = creatorDeals.filter((d: any) => ["briefing", "in_progress", "review"].includes(d.status)).length;
  const creatorCompleted = creatorDeals.filter((d: any) => d.status === "completed").length;
  const creatorTotalBudget = creatorDeals.filter((d: any) => d.status === "completed").reduce((s: number, d: any) => s + (d.budget || 0), 0);

  // Advertiser stats
  const advDeals = dbDeals.filter((d: any) => d.advertiser_id === user?.id);
  const advPending = advDeals.filter((d: any) => d.status === "pending").length;
  const advActive = advDeals.filter((d: any) => ["briefing", "in_progress", "review"].includes(d.status)).length;
  const advCompleted = advDeals.filter((d: any) => d.status === "completed").length;
  const advDisputed = advDeals.filter((d: any) => d.status === "disputed").length;
  const advTotalSpent = advDeals.reduce((s: number, d: any) => s + (d.budget || 0), 0);
  const advCompletedBudget = advDeals.filter((d: any) => d.status === "completed").reduce((s: number, d: any) => s + (d.budget || 0), 0);

  const myRatings = dbRatings.filter((r: any) => r.to_id === user?.id);
  const avgRating = myRatings.length > 0 ? (myRatings.reduce((s: number, r: any) => s + (Number(r.overall) || 0), 0) / myRatings.length).toFixed(1) : "—";

  const recentDeals = (isCreator ? creatorDeals : advDeals).slice(0, 4);

  // User stats & AI recommendations
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
    enabled: interests.length > 0 && !isCreator && !isAdvertiser,
  });
  const recommendedItems = aiRecommendations
    ? allItems.filter((item) => aiRecommendations.some((t: string) => t.toLowerCase() === item.title.toLowerCase())).slice(0, 6)
    : [];
  const fallbackItems = allItems.slice(0, 4);
  const displayItems = recommendedItems.length > 0 ? recommendedItems : fallbackItems;

  const displayName = profile?.display_name || "друг";
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? "Доброе утро" : hour < 18 ? "Добрый день" : "Добрый вечер";

  // Chart data - creator (moved to CreatorStudio)

  // Chart data - advertiser
  const spendingChartData = useMemo(() => {
    const months = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн"];
    return months.map((m, i) => ({
      name: m,
      spent: Math.max(0, advTotalSpent > 0 ? Math.round(advTotalSpent * (0.1 + i * 0.18)) : Math.round(5000 + i * 8000)),
      deals: Math.max(0, advDeals.length > 0 ? Math.round(advDeals.length * (0.2 + i * 0.16)) : Math.round(1 + i)),
    }));
  }, [advTotalSpent, advDeals.length]);

  const dealStatusPie = useMemo(() => {
    return [
      { name: "Ожидают", value: advPending || 1 },
      { name: "В работе", value: advActive || 1 },
      { name: "Завершено", value: advCompleted || 1 },
      { name: "Споры", value: advDisputed || 0 },
    ].filter(d => d.value > 0);
  }, [advPending, advActive, advCompleted, advDisputed]);

  const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(var(--accent))", "hsl(var(--warning))", "hsl(var(--success))", "hsl(var(--info))"];

  return (
    <PageTransition>
      {showOnboarding && <OnboardingWizard onComplete={handleOnboardingComplete} />}
      <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">

        {/* ============ CREATOR DASHBOARD ============ */}
        {isCreator && (
          <>
            {/* Main stats */}
            <motion.div variants={stagger.container} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <motion.div variants={stagger.item}><StatCard icon={Zap} label="Публикаций" value={myItems.length} color="bg-primary/10" /></motion.div>
              <motion.div variants={stagger.item}><StatCard icon={Eye} label="Просмотров" value={totalViews > 1000 ? `${(totalViews / 1000).toFixed(1)}K` : totalViews} color="bg-accent/10" /></motion.div>
              <motion.div variants={stagger.item}><StatCard icon={Heart} label="Лайков" value={totalLikes} color="bg-destructive/10" /></motion.div>
              <motion.div variants={stagger.item}><StatCard icon={DollarSign} label="Общий прайс" value={`₽${totalRevenue > 1000 ? `${(totalRevenue / 1000).toFixed(0)}K` : totalRevenue}`} color="bg-success/10" /></motion.div>
            </motion.div>

            {/* Deal stats */}
            <motion.div variants={stagger.container} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <motion.div variants={stagger.item}><StatCard icon={Clock} label="Ожидают ответа" value={creatorPending} sub="входящие предложения" color="bg-warning/10" /></motion.div>
              <motion.div variants={stagger.item}><StatCard icon={Activity} label="В работе" value={creatorActive} sub="активные сделки" color="bg-primary/10" /></motion.div>
              <motion.div variants={stagger.item}><StatCard icon={CheckCircle2} label="Завершено" value={creatorCompleted} sub="успешные сделки" color="bg-success/10" /></motion.div>
              <motion.div variants={stagger.item}><StatCard icon={Wallet} label="Заработано" value={`₽${creatorTotalBudget > 1000 ? `${(creatorTotalBudget / 1000).toFixed(0)}K` : creatorTotalBudget}`} sub="по сделкам" color="bg-accent/10" /></motion.div>
            </motion.div>


            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="border-b border-border px-5 py-3 flex items-center gap-2">
                    <Plus className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">Быстрое создание</span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 divide-x divide-border">
                    {contentTypeOptions.map((ct) => (
                      <button key={ct.type} onClick={() => navigate("/creator-studio", { state: { openEditor: true, contentType: ct.type } })} className="flex flex-col items-center gap-2 py-5 hover:bg-muted/50 transition-colors group">
                        <ct.icon className={cn("h-6 w-6 transition-transform group-hover:scale-110", ct.color)} />
                        <span className="text-[11px] text-muted-foreground group-hover:text-foreground">{ct.label}</span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Recent deals */}
            {recentDeals.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Последние сделки</h2>
                  <button onClick={() => navigate("/marketplace")} className="text-xs text-primary hover:underline flex items-center gap-1">Все <ArrowRight className="h-3 w-3" /></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {recentDeals.map((d: any) => <DealMiniCard key={d.id} deal={d} navigate={navigate} />)}
                </div>
              </section>
            )}
          </>
        )}

        {/* ============ ADVERTISER DASHBOARD ============ */}
        {isAdvertiser && !isCreator && (
          <>
            {/* Campaign stats */}
            <motion.div variants={stagger.container} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <motion.div variants={stagger.item}><StatCard icon={Target} label="Всего кампаний" value={advDeals.length} color="bg-primary/10" /></motion.div>
              <motion.div variants={stagger.item}><StatCard icon={Wallet} label="Общий бюджет" value={`₽${advTotalSpent > 1000 ? `${(advTotalSpent / 1000).toFixed(0)}K` : advTotalSpent}`} color="bg-accent/10" /></motion.div>
              <motion.div variants={stagger.item}><StatCard icon={Star} label="Ваш рейтинг" value={avgRating} sub={`${myRatings.length} отзывов`} color="bg-warning/10" /></motion.div>
              <motion.div variants={stagger.item}><StatCard icon={DollarSign} label="Потрачено" value={`₽${advCompletedBudget > 1000 ? `${(advCompletedBudget / 1000).toFixed(0)}K` : advCompletedBudget}`} sub="завершённые сделки" color="bg-success/10" /></motion.div>
            </motion.div>

            {/* Deal pipeline */}
            <motion.div variants={stagger.container} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <motion.div variants={stagger.item}><StatCard icon={Clock} label="Ожидают ответа" value={advPending} sub="отправленные" color="bg-warning/10" /></motion.div>
              <motion.div variants={stagger.item}><StatCard icon={Activity} label="В работе" value={advActive} sub="активные" color="bg-primary/10" /></motion.div>
              <motion.div variants={stagger.item}><StatCard icon={CheckCircle2} label="Завершено" value={advCompleted} color="bg-success/10" /></motion.div>
              <motion.div variants={stagger.item}><StatCard icon={AlertTriangle} label="Споры" value={advDisputed} color="bg-destructive/10" /></motion.div>
            </motion.div>

            {/* Advertiser Charts */}
            <AdvertiserCharts spendingChartData={spendingChartData} dealStatusPie={dealStatusPie} PIE_COLORS={PIE_COLORS} />

            {notifCount > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 p-5 flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">У вас {notifCount} непрочитанных уведомлений</p>
                  <p className="text-xs text-muted-foreground">Проверьте ответы от авторов на ваши предложения</p>
                </div>
              </motion.div>
            )}

            {/* Recent deals */}
            {recentDeals.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Последние кампании</h2>
                  <button onClick={() => navigate("/ad-studio")} className="text-xs text-primary hover:underline flex items-center gap-1">Все <ArrowRight className="h-3 w-3" /></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {recentDeals.map((d: any) => <DealMiniCard key={d.id} deal={d} navigate={navigate} />)}
                </div>
              </section>
            )}
          </>
        )}

        {/* ============ USER — show catalog as main page ============ */}
        {!isCreator && !isAdvertiser && (
          <UserCatalog allItems={allItems} navigate={navigate} />
        )}
      </div>
    </PageTransition>
  );
};

const types: ContentType[] = ["video", "music", "post", "podcast", "book", "template"];

function UserCatalog({ allItems, navigate }: { allItems: any[]; navigate: (p: string) => void }) {
  const [search, setSearch] = useState("");
  const [activeType, setActiveType] = useState<ContentType | null>(null);

  const filtered = allItems.filter((item: any) => {
    const matchSearch = item.title.toLowerCase().includes(search.toLowerCase()) || (item.tags || []).some((t: string) => t.toLowerCase().includes(search.toLowerCase()));
    const matchType = !activeType || item.type === activeType;
    return matchSearch && matchType;
  });

  return (
    <>
      <div className="space-y-3">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Что посмотреть? Поиск по названию, теме, описанию..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-card border-border" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {types.map((t) => (
            <button key={t} onClick={() => setActiveType(activeType === t ? null : t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeType === t ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"
              }`}>
              {contentTypeLabels[t] || t}
            </button>
          ))}
        </div>
      </div>

      {activeType === null ? (
        <SelectTabPrompt onSelectType={setActiveType} />
      ) : activeType === "post" ? (
        <div className="space-y-4 max-w-2xl mx-auto">
          {filtered.map((item: any) => (
            <ContentCard key={item.id} item={item} />
          ))}
          {filtered.length === 0 && <div className="text-center py-16 text-muted-foreground">Ничего не найдено</div>}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((item: any) => (
              <ContentCard key={item.id} item={item} />
            ))}
          </div>
          {filtered.length === 0 && <div className="text-center py-16 text-muted-foreground">Ничего не найдено</div>}
        </>
      )}
    </>
  );
}

export function SelectTabPrompt({ onSelectType }: { onSelectType?: (type: ContentType) => void } = {}) {
  const icons: { Icon: React.ElementType; label: string; type: ContentType; color: string; bg: string }[] = [
    { Icon: Video, label: "Видео", type: "video", color: "text-destructive", bg: "bg-destructive/10" },
    { Icon: Music, label: "Музыка", type: "music", color: "text-primary", bg: "bg-primary/10" },
    { Icon: FileText, label: "Посты", type: "post", color: "text-accent-foreground", bg: "bg-accent/10" },
    { Icon: Mic, label: "Подкасты", type: "podcast", color: "text-primary", bg: "bg-primary/10" },
    { Icon: BookOpen, label: "Книги", type: "book", color: "text-foreground", bg: "bg-muted" },
    { Icon: Layout, label: "Шаблоны", type: "template", color: "text-muted-foreground", bg: "bg-muted" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="flex flex-col items-center justify-center py-16 space-y-8"
    >
      {/* Animated icon ring */}
      <div className="relative h-40 w-40">
        {icons.map(({ Icon, bg, color, label, type }, i) => {
          const angle = (360 / icons.length) * i - 90;
          const rad = (angle * Math.PI) / 180;
          const x = Math.cos(rad) * 64;
          const y = Math.sin(rad) * 64;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 + i * 0.08, duration: 0.4, type: "spring", stiffness: 200 }}
              className="absolute z-10"
              style={{ left: `calc(50% + ${x}px - 20px)`, top: `calc(50% + ${y}px - 20px)` }}
            >
              <motion.button
                type="button"
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.3, ease: "easeInOut" }}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.95 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectType?.(type);
                }}
                className={cn("h-10 w-10 rounded-xl flex items-center justify-center shadow-sm border border-border cursor-pointer hover:shadow-md transition-shadow", bg)}
                title={label}
              >
                <Icon className={cn("h-5 w-5", color)} />
              </motion.button>
            </motion.div>
          );
        })}
        {/* Center sparkle */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center"
          >
            <Sparkles className="h-7 w-7 text-primary" />
          </motion.div>
        </div>
      </div>

      {/* Text */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.4 }}
        className="text-center space-y-2 max-w-md"
      >
        <h3 className="text-xl font-bold text-foreground">Выберите тип контента</h3>
        <p className="text-sm text-muted-foreground">
          Нажмите на категорию выше — видео, музыка, посты, подкасты и другое ждут вас
        </p>
      </motion.div>

      <motion.div
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="flex items-center gap-2 text-xs text-muted-foreground"
      >
        <ArrowRight className="h-3.5 w-3.5 rotate-[-90deg]" />
        <span>Нажмите на вкладку</span>
      </motion.div>
    </motion.div>
  );
}

export default Home;
