import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useAdvertiserScores } from "@/hooks/useAdvertiserScores";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { creators } from "@/data/mockData";
import { Search, MapPin, Users, Star, CheckCircle, Clock, Briefcase, ShieldAlert, ArrowRight, Check, X, SlidersHorizontal, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Slider } from "@/components/ui/slider";
import { motion } from "framer-motion";
import { PageTransition } from "@/components/layout/PageTransition";
import { toast } from "sonner";

const statusLabels: Record<string, string> = {
  pending: "Ожидание",
  briefing: "Бриф",
  in_progress: "В работе",
  review: "На проверке",
  completed: "Завершено",
  disputed: "Спор",
  rejected: "Отклонено",
};

const statusColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning",
  briefing: "bg-primary/10 text-primary",
  in_progress: "bg-primary/10 text-primary",
  review: "bg-accent/10 text-accent-foreground",
  completed: "bg-green-500/10 text-green-500",
  disputed: "bg-destructive/10 text-destructive",
  rejected: "bg-muted text-muted-foreground",
};

// Creator view: incoming offers from advertisers
function CreatorOffers() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { scores: advertiserScores } = useAdvertiserScores();
  const [filter, setFilter] = useState<"all" | "pending" | "active">("all");
  const [showFilters, setShowFilters] = useState(false);
  const [minBudget, setMinBudget] = useState(0);
  const [minPartnerScore, setMinPartnerScore] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ["creator-incoming-deals", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("deals")
        .select("*")
        .eq("creator_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const maxBudget = useMemo(() => Math.max(...deals.map((d) => d.budget || 0), 100000), [deals]);

  // Fetch advertiser profiles
  const advertiserIds = useMemo(() => [...new Set(deals.map((d) => d.advertiser_id).filter(Boolean))], [deals]);
  const { data: profiles = [] } = useQuery({
    queryKey: ["advertiser-profiles-offers", advertiserIds],
    queryFn: async () => {
      if (!advertiserIds.length) return [];
      const { data } = await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", advertiserIds);
      return data || [];
    },
    enabled: advertiserIds.length > 0,
  });
  const profileMap = useMemo(() => {
    const m = new Map<string, { display_name: string; avatar_url: string | null }>();
    for (const p of profiles) m.set(p.user_id, p);
    return m;
  }, [profiles]);

  const filteredDeals = useMemo(() => {
    let result = deals;
    if (filter === "pending") result = deals.filter((d) => d.status === "pending" || d.status === "briefing");
    if (filter === "active") result = deals.filter((d) => d.status === "in_progress" || d.status === "review");

    // Budget filter
    if (minBudget > 0) result = result.filter((d) => (d.budget || 0) >= minBudget);

    // Partner Score filter
    if (minPartnerScore > 0) {
      result = result.filter((d) => {
        const score = advertiserScores.get(d.advertiser_id || "");
        if (!score || score.partnerScore === 0) return true; // no score = show
        return score.partnerScore >= minPartnerScore;
      });
    }

    // Sort: low-score advertisers go to bottom
    return [...result].sort((a, b) => {
      const aLow = advertiserScores.get(a.advertiser_id || "")?.isLowScore ? 1 : 0;
      const bLow = advertiserScores.get(b.advertiser_id || "")?.isLowScore ? 1 : 0;
      if (aLow !== bLow) return aLow - bLow;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [deals, filter, advertiserScores, minBudget, minPartnerScore]);

  const handleAccept = async (dealId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionLoading(dealId);
    const { error } = await supabase
      .from("deals")
      .update({ status: "briefing" })
      .eq("id", dealId);
    if (error) {
      toast.error("Не удалось принять предложение");
    } else {
      toast.success("Предложение принято!");
      queryClient.invalidateQueries({ queryKey: ["creator-incoming-deals"] });
    }
    setActionLoading(null);
  };

  const handleReject = async (dealId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionLoading(dealId);
    const { error } = await supabase
      .from("deals")
      .update({ status: "disputed" })
      .eq("id", dealId);
    if (error) {
      toast.error("Не удалось отклонить предложение");
    } else {
      toast.success("Предложение отклонено");
      queryClient.invalidateQueries({ queryKey: ["creator-incoming-deals"] });
    }
    setActionLoading(null);
  };

  return (
    <PageTransition>
      <div className="p-6 lg:p-8 space-y-6 max-w-5xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary" />
            Входящие предложения
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Предложения от рекламодателей для сотрудничества
          </p>
        </div>

        {/* Status filters + advanced toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          {([
            { key: "all", label: "Все" },
            { key: "pending", label: "Новые" },
            { key: "active", label: "Активные" },
          ] as const).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f.key ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"
              }`}
            >
              {f.label}
            </button>
          ))}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`ml-auto px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
              showFilters ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Фильтры
          </button>
        </div>

        {/* Advanced filters */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl border border-border bg-card p-4 space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">Минимальный бюджет</label>
                  <span className="text-xs font-semibold text-card-foreground">{minBudget > 0 ? `от ${minBudget.toLocaleString()} ₽` : "Любой"}</span>
                </div>
                <Slider
                  value={[minBudget]}
                  onValueChange={([v]) => setMinBudget(v)}
                  max={maxBudget}
                  step={5000}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">Мин. Partner Score</label>
                  <span className="text-xs font-semibold text-card-foreground">{minPartnerScore > 0 ? `от ${minPartnerScore.toFixed(1)}` : "Любой"}</span>
                </div>
                <Slider
                  value={[minPartnerScore]}
                  onValueChange={([v]) => setMinPartnerScore(v)}
                  max={5}
                  step={0.5}
                  className="w-full"
                />
              </div>
            </div>
            {(minBudget > 0 || minPartnerScore > 0) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setMinBudget(0); setMinPartnerScore(0); }}
                className="text-xs"
              >
                Сбросить фильтры
              </Button>
            )}
          </motion.div>
        )}

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground animate-pulse">Загрузка...</div>
        ) : filteredDeals.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Briefcase className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Пока нет предложений.</p>
              <p className="text-xs mt-1">Когда рекламодатели захотят сотрудничать, их предложения появятся здесь.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredDeals.map((deal) => {
              const advScore = advertiserScores.get(deal.advertiser_id || "");
              const isLow = advScore?.isLowScore;
              const advProfile = profileMap.get(deal.advertiser_id || "");
              const isPending = deal.status === "pending";
              const isActioning = actionLoading === deal.id;

              return (
                <motion.div
                  key={deal.id}
                  whileHover={{ y: -2 }}
                  className={`rounded-xl border bg-card p-5 transition-all ${
                    isLow ? "opacity-60 border-destructive/20" : "border-border hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div
                      className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                      onClick={() => navigate("/ad-studio")}
                    >
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border border-border shrink-0">
                        {advProfile?.avatar_url ? (
                          <img src={advProfile.avatar_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Briefcase className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-card-foreground truncate">{deal.title}</h3>
                          {isLow && (
                            <Tooltip>
                              <TooltipTrigger>
                                <ShieldAlert className="h-3.5 w-3.5 text-destructive shrink-0" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">Низкий Partner Score: {advScore!.partnerScore.toFixed(1)}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {advProfile?.display_name || deal.advertiser_name}
                          {advScore && advScore.partnerScore > 0 && !isLow && (
                            <span className="ml-2 text-primary">⭐ {advScore.partnerScore.toFixed(1)}</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-bold text-card-foreground">{(deal.budget || 0).toLocaleString()} ₽</p>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${statusColors[deal.status] || "bg-muted text-muted-foreground"}`}>
                          {statusLabels[deal.status] || deal.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {deal.description && (
                    <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{deal.description}</p>
                  )}

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(deal.created_at).toLocaleDateString("ru-RU")}
                      </span>
                      {deal.deadline && (
                        <span>Дедлайн: {new Date(deal.deadline).toLocaleDateString("ru-RU")}</span>
                      )}
                    </div>

                    {/* Accept / Reject buttons for pending deals */}
                    {isPending && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-destructive border-destructive/30 hover:bg-destructive/10"
                          disabled={isActioning}
                          onClick={(e) => handleReject(deal.id, e)}
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          Отклонить
                        </Button>
                        <Button
                          size="sm"
                          className="h-8"
                          disabled={isActioning}
                          onClick={(e) => handleAccept(deal.id, e)}
                        >
                          <Check className="h-3.5 w-3.5 mr-1" />
                          Принять
                        </Button>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
const niches = ["Все", "Образование", "Технологии", "Дизайн", "Фото", "Музыка", "Подкасты", "Бизнес", "Видео", "Motion"];

// Advertiser view: browse creators (original marketplace)
function AdvertiserMarketplace() {
  const [search, setSearch] = useState("");
  const [activeNiche, setActiveNiche] = useState("Все");
  const navigate = useNavigate();

  const filtered = creators.filter((c) => {
    const matchSearch = c.displayName.toLowerCase().includes(search.toLowerCase());
    const matchNiche = activeNiche === "Все" || c.niche.includes(activeNiche);
    return matchSearch && matchNiche;
  });

  return (
    <PageTransition>
      <div className="p-6 lg:p-8 space-y-6 max-w-7xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Биржа размещений</h1>
          <p className="text-sm text-muted-foreground">Найдите идеального автора для рекламной интеграции</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Поиск авторов..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-card" />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {niches.map((n) => (
              <button key={n} onClick={() => setActiveNiche(n)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeNiche === n ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"
                }`}>{n}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((creator) => (
            <motion.div
              key={creator.userId}
              onClick={() => navigate(`/creator/${creator.userId}`)}
              whileHover={{ y: -3 }}
              className="cursor-pointer rounded-xl border border-border bg-card p-5 space-y-4 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <img src={creator.avatar} alt="" className="h-12 w-12 rounded-full" />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-semibold text-sm text-card-foreground">{creator.displayName}</h3>
                    {creator.verified && <CheckCircle className="h-3.5 w-3.5 text-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{creator.geo}</p>
                </div>
                <div className="flex items-center gap-1 text-warning">
                  <Star className="h-3.5 w-3.5 fill-current" />
                  <span className="text-sm font-bold">{creator.rating}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{creator.bio}</p>
              <div className="flex flex-wrap gap-1.5">
                {creator.niche.map((n) => (
                  <Badge key={n} variant="secondary" className="text-[10px]">{n}</Badge>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-3">
                <span className="flex items-center gap-1"><Users className="h-3 w-3" />{(creator.followers / 1000).toFixed(0)}K подписчиков</span>
                <span>Охват: {(creator.reach / 1000).toFixed(0)}K</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </PageTransition>
  );
}

export default function Marketplace() {
  const { isCreator } = useUserRole();

  if (isCreator) {
    return <CreatorOffers />;
  }

  return <AdvertiserMarketplace />;
}
