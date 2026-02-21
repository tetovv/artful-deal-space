import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useAdvertiserScores } from "@/hooks/useAdvertiserScores";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { creators } from "@/data/mockData";
import {
  Search, MapPin, Users, Star, CheckCircle, Clock, Briefcase, ShieldAlert,
  Check, X, SlidersHorizontal, Shield, AlertTriangle, Eye, EyeOff,
  ChevronDown, ChevronUp, ChevronRight, Send, RefreshCw, FileText, MessageSquare, Handshake, Filter,
  CalendarDays, ShieldCheck,
} from "lucide-react";
import { IncomingProposalDetail } from "@/components/ad-studio/IncomingProposalDetail";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Slider } from "@/components/ui/slider";
import { motion } from "framer-motion";
import { PageTransition } from "@/components/layout/PageTransition";
import { toast } from "sonner";

/* ─── Status helpers ─── */
const statusLabels: Record<string, string> = {
  pending: "Ожидание", briefing: "Бриф", in_progress: "В работе",
  review: "На проверке", completed: "Завершено", disputed: "Спор", rejected: "Отклонено",
};
const statusColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning", briefing: "bg-primary/10 text-primary",
  in_progress: "bg-primary/10 text-primary", review: "bg-accent/10 text-accent-foreground",
  completed: "bg-green-500/10 text-green-500", disputed: "bg-destructive/10 text-destructive",
  rejected: "bg-muted text-muted-foreground",
};

/* ─── Rating criteria ─── */
const CRITERIA = [
  { key: "payment_timeliness", label: "Соблюдение сроков оплаты", icon: Clock },
  { key: "brief_adequacy", label: "Адекватность ТЗ", icon: FileText },
  { key: "communication", label: "Коммуникация", icon: MessageSquare },
  { key: "agreement_compliance", label: "Соответствие договорённостям", icon: Handshake },
  { key: "repeat_willingness", label: "Готовность к повт. сотрудничеству", icon: RefreshCw },
] as const;

/* ─── Score helpers ─── */
const getScoreColor = (score: number) => {
  if (score >= 4.5) return "text-green-500";
  if (score >= 3.5) return "text-yellow-500";
  if (score >= 2.5) return "text-orange-500";
  return "text-destructive";
};
const getScoreBadge = (score: number, total: number) => {
  if (total === 0) return { label: "🟡 Новый", variant: "outline" as const };
  if (score >= 4.5) return { label: "Отличный партнёр", variant: "default" as const };
  if (score >= 3.5) return { label: "Хороший партнёр", variant: "secondary" as const };
  if (score >= 2.5) return { label: "Средний", variant: "outline" as const };
  return { label: "Низкий рейтинг", variant: "destructive" as const };
};

/* ═══════════════════════════════════════════════════
   Advertiser score data (shared between tabs)
   ═══════════════════════════════════════════════════ */
interface AdvertiserScore {
  advertiserId: string; advertiserName: string;
  avgPaymentTimeliness: number; avgBriefAdequacy: number; avgCommunication: number;
  avgAgreementCompliance: number; avgRepeatWillingness: number;
  partnerScore: number; completedDeals: number; totalRatings: number;
}

function useRatingData() {
  const { user } = useAuth();
  const { isCreator, isModerator } = useUserRole();
  const queryClient = useQueryClient();

  const { data: ratings = [] } = useQuery({
    queryKey: ["ratings-full"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ratings").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: completedDeals = [] } = useQuery({
    queryKey: ["completed-deals-for-rating", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from("deals").select("*").eq("creator_id", user.id).eq("status", "completed");
      if (error) throw error;
      return data;
    },
    enabled: !!user && isCreator,
  });

  const unratedDeals = useMemo(() => {
    const ratedDealIds = new Set(ratings.filter((r) => r.from_id === user?.id).map((r) => r.deal_id));
    return completedDeals.filter((d) => !ratedDealIds.has(d.id));
  }, [completedDeals, ratings, user?.id]);

  const advertiserScores = useMemo<AdvertiserScore[]>(() => {
    const map = new Map<string, typeof ratings>();
    for (const r of ratings) { if (!r.to_id) continue; const arr = map.get(r.to_id) || []; arr.push(r); map.set(r.to_id, arr); }
    return Array.from(map.entries()).map(([advId, advRatings]) => {
      const avg = (key: string) => { const vals = advRatings.map((r: any) => r[key]).filter((v: any) => v != null); return vals.length ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : 0; };
      const pt = avg("payment_timeliness"), ba = avg("brief_adequacy"), c = avg("communication"), ac = avg("agreement_compliance"), rw = avg("repeat_willingness");
      const hasNew = pt > 0 || ba > 0 || ac > 0 || rw > 0;
      const partnerScore = hasNew ? pt * 0.25 + ba * 0.2 + c * 0.2 + ac * 0.2 + rw * 0.15 : avg("overall") || 0;
      return { advertiserId: advId, advertiserName: advId.slice(0, 8), avgPaymentTimeliness: pt, avgBriefAdequacy: ba, avgCommunication: c, avgAgreementCompliance: ac, avgRepeatWillingness: rw, partnerScore, completedDeals: advRatings.length, totalRatings: advRatings.length };
    }).sort((a, b) => b.partnerScore - a.partnerScore);
  }, [ratings]);

  const advIds = useMemo(() => advertiserScores.map((a) => a.advertiserId), [advertiserScores]);
  const { data: profiles = [] } = useQuery({
    queryKey: ["advertiser-profiles", advIds],
    queryFn: async () => { if (!advIds.length) return []; const { data } = await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", advIds); return data || []; },
    enabled: advIds.length > 0,
  });
  const profileMap = useMemo(() => { const m = new Map<string, { display_name: string; avatar_url: string | null }>(); for (const p of profiles) m.set(p.user_id, p); return m; }, [profiles]);

  return { ratings, advertiserScores, profileMap, unratedDeals, completedDeals, queryClient, isCreator, isModerator };
}

/* ═══════════════════════════════════════════════════
   Sub-tab: Public Rating
   ═══════════════════════════════════════════════════ */
function PublicRating({ advertiserScores, profileMap }: { advertiserScores: AdvertiserScore[]; profileMap: Map<string, any> }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (advertiserScores.length === 0) {
    return (
      <Card><CardContent className="py-12 text-center text-muted-foreground">
        <Star className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p>Ещё нет оценок. Рейтинг появится после первых завершённых сделок.</p>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-3">
      {advertiserScores.map((adv, idx) => {
        const prof = profileMap.get(adv.advertiserId);
        const badge = getScoreBadge(adv.partnerScore, adv.totalRatings);
        const isExpanded = expanded === adv.advertiserId;
        return (
          <Card key={adv.advertiserId} className="overflow-hidden">
            <button className="w-full text-left" onClick={() => setExpanded(isExpanded ? null : adv.advertiserId)}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border border-border">
                      {prof?.avatar_url ? <img src={prof.avatar_url} alt="" className="h-full w-full object-cover" /> : <span className="text-sm font-bold text-primary">#{idx + 1}</span>}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-card-foreground">{prof?.display_name || "Рекламодатель"}</p>
                      <p className="text-xs text-muted-foreground">{adv.totalRatings === 0 ? "Нет оценок" : `${adv.completedDeals} ${adv.completedDeals === 1 ? "оценка" : "оценок"}`}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className={`text-2xl font-bold ${adv.totalRatings === 0 ? "text-muted-foreground" : getScoreColor(adv.partnerScore)}`}>{adv.totalRatings === 0 ? "—" : adv.partnerScore.toFixed(1)}</p>
                      <Badge variant={badge.variant} className="text-[10px]">{badge.label}</Badge>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>
              </CardHeader>
            </button>
            {isExpanded && (
              <CardContent className="pt-0 space-y-3 animate-fade-in">
                <div className="grid gap-2">
                  {CRITERIA.map((c) => {
                    const val = adv[`avg${c.key.charAt(0).toUpperCase()}${c.key.slice(1).replace(/_([a-z])/g, (_, l) => l.toUpperCase())}` as keyof AdvertiserScore] as number;
                    const Icon = c.icon;
                    return (
                      <div key={c.key} className="flex items-center gap-3">
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-xs text-muted-foreground w-48 shrink-0">{c.label}</span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(val / 5) * 100}%` }} /></div>
                        <span className={`text-sm font-semibold w-8 text-right ${getScoreColor(val)}`}>{val > 0 ? val.toFixed(1) : "—"}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-1 pt-1">
                  {[1, 2, 3, 4, 5].map((s) => <Star key={s} className={`h-4 w-4 ${s <= Math.round(adv.partnerScore) ? "text-primary fill-primary" : "text-muted"}`} />)}
                  <span className="text-xs text-muted-foreground ml-2">Partner Score</span>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Sub-tab: Internal Analytics
   ═══════════════════════════════════════════════════ */
function InternalAnalytics({ advertiserScores, profileMap }: { advertiserScores: AdvertiserScore[]; profileMap: Map<string, any> }) {
  if (advertiserScores.length === 0) return <p className="text-sm text-muted-foreground py-6">Нет данных</p>;
  return (
    <div className="space-y-3">
      {advertiserScores.map((adv) => {
        const prof = profileMap.get(adv.advertiserId);
        const lowPayment = adv.avgPaymentTimeliness > 0 && adv.avgPaymentTimeliness < 3;
        return (
          <div key={adv.advertiserId} className={`rounded-xl border p-4 space-y-2 ${lowPayment ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"}`}>
            <div className="flex items-center justify-between">
              <p className="font-medium text-sm text-card-foreground">{prof?.display_name || "Рекламодатель"}</p>
              {lowPayment && <Badge variant="destructive" className="text-[10px]">⚠️ Задерживает оплату</Badge>}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div><p className="text-muted-foreground">Сделок</p><p className="font-semibold">{adv.completedDeals}</p></div>
              <div><p className="text-muted-foreground">Partner Score</p><p className={`font-semibold ${getScoreColor(adv.partnerScore)}`}>{adv.partnerScore.toFixed(1)}</p></div>
              <div><p className="text-muted-foreground">Оплата вовремя</p><p className={`font-semibold ${getScoreColor(adv.avgPaymentTimeliness)}`}>{adv.avgPaymentTimeliness > 0 ? adv.avgPaymentTimeliness.toFixed(1) : "—"}</p></div>
              <div><p className="text-muted-foreground">Повт. авторы</p><p className={`font-semibold ${getScoreColor(adv.avgRepeatWillingness)}`}>{adv.avgRepeatWillingness > 0 ? adv.avgRepeatWillingness.toFixed(1) : "—"}</p></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Sub-tab: Rate Advertiser
   ═══════════════════════════════════════════════════ */
function RateAdvertiser({ unratedDeals, completedDeals }: { unratedDeals: any[]; completedDeals: any[] }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [ratingDealId, setRatingDealId] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!ratingDealId || !user) return;
    const deal = completedDeals.find((d: any) => d.id === ratingDealId);
    if (!deal) return;
    const allFilled = CRITERIA.every((c) => scores[c.key] && scores[c.key] >= 1 && scores[c.key] <= 5);
    if (!allFilled) { toast.error("Оцените все критерии (1-5)"); return; }
    setSubmitting(true);
    const overall = scores.payment_timeliness * 0.25 + scores.brief_adequacy * 0.2 + scores.communication * 0.2 + scores.agreement_compliance * 0.2 + scores.repeat_willingness * 0.15;
    const { error } = await supabase.from("ratings").insert({
      deal_id: ratingDealId, from_id: user.id, to_id: deal.advertiser_id,
      communication: scores.communication, payment: scores.payment_timeliness, professionalism: scores.brief_adequacy,
      payment_timeliness: scores.payment_timeliness, brief_adequacy: scores.brief_adequacy,
      agreement_compliance: scores.agreement_compliance, repeat_willingness: scores.repeat_willingness,
      overall: parseFloat(overall.toFixed(2)),
    });
    if (error) toast.error("Ошибка при сохранении оценки");
    else { toast.success("Оценка отправлена!"); setRatingDealId(null); setScores({}); queryClient.invalidateQueries({ queryKey: ["ratings-full"] }); }
    setSubmitting(false);
  };

  if (unratedDeals.length === 0) {
    return <p className="text-sm text-muted-foreground py-6">Нет завершённых сделок для оценки. Оценка доступна после завершения сделки.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Выберите сделку</label>
        <select value={ratingDealId || ""} onChange={(e) => { setRatingDealId(e.target.value || null); setScores({}); }} className="w-full p-2.5 rounded-lg bg-background border border-border text-sm text-foreground">
          <option value="">— Выберите —</option>
          {unratedDeals.map((d: any) => <option key={d.id} value={d.id}>{d.title} — {d.advertiser_name}</option>)}
        </select>
      </div>
      {ratingDealId && (
        <div className="space-y-4 animate-fade-in">
          {CRITERIA.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.key} className="space-y-1.5">
                <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-medium">{c.label}</span></div>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((v) => <button key={v} onClick={() => setScores((p) => ({ ...p, [c.key]: v }))} className="transition-all"><Star className={`h-7 w-7 ${v <= (scores[c.key] || 0) ? "text-primary fill-primary" : "text-muted hover:text-muted-foreground"}`} /></button>)}
                  <span className="text-xs text-muted-foreground self-center ml-2">{scores[c.key] ? `${scores[c.key]}/5` : ""}</span>
                </div>
              </div>
            );
          })}
          <Button onClick={handleSubmit} disabled={submitting} className="w-full mt-2"><Send className="h-4 w-4 mr-2" />{submitting ? "Отправка..." : "Отправить оценку"}</Button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Creator view: Offers + Rating in tabs
   ═══════════════════════════════════════════════════ */
/* ─── Placement type from deal title ─── */
const placementFromTitle = (title: string): string | null => {
  const t = title.toLowerCase();
  if (t.includes("видео") || t.includes("video")) return "Видео";
  if (t.includes("пост") || t.includes("post")) return "Пост";
  if (t.includes("подкаст") || t.includes("podcast")) return "Подкаст";
  return null;
};

/* ─── Deal status config for creator view ─── */
type ProposalStatus = "new" | "active" | "archived";
const getProposalStatus = (dbStatus: string): ProposalStatus => {
  if (dbStatus === "pending") return "new";
  if (["briefing", "in_progress", "review", "needs_changes", "accepted"].includes(dbStatus)) return "active";
  return "archived";
};
const proposalStatusConfig: Record<ProposalStatus, { label: string; cls: string }> = {
  new: { label: "Новое", cls: "bg-warning/15 text-warning border-warning/30" },
  active: { label: "Активно", cls: "bg-primary/15 text-primary border-primary/30" },
  archived: { label: "В архиве", cls: "bg-muted text-muted-foreground border-muted-foreground/20" },
};

/* ─── Time ago helper ─── */
const timeAgo = (dateStr: string): string => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "только что";
  if (mins < 60) return `${mins} мин назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} дн назад`;
  return new Date(dateStr).toLocaleDateString("ru-RU");
};

function CreatorOffers() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { scores: advScoresMap } = useAdvertiserScores();
  const rating = useRatingData();

  const [filter, setFilter] = useState<"all" | "new" | "active" | "archived">("all");
  const [showFilters, setShowFilters] = useState(false);
  const [minBudget, setMinBudget] = useState(0);
  const [minPartnerScore, setMinPartnerScore] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<typeof deals[0] | null>(null);

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ["creator-incoming-deals", user?.id],
    queryFn: async () => { if (!user) return []; const { data, error } = await supabase.from("deals").select("*").eq("creator_id", user.id).order("created_at", { ascending: false }); if (error) throw error; return data; },
    enabled: !!user,
  });

  const maxBudget = useMemo(() => Math.max(...deals.map((d) => d.budget || 0), 100000), [deals]);
  const advertiserIds = useMemo(() => [...new Set(deals.map((d) => d.advertiser_id).filter(Boolean))], [deals]);
  const { data: offerProfiles = [] } = useQuery({
    queryKey: ["advertiser-profiles-offers", advertiserIds],
    queryFn: async () => { if (!advertiserIds.length) return []; const { data } = await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", advertiserIds); return data || []; },
    enabled: advertiserIds.length > 0,
  });
  const offerProfileMap = useMemo(() => { const m = new Map<string, { display_name: string; avatar_url: string | null }>(); for (const p of offerProfiles) m.set(p.user_id, p); return m; }, [offerProfiles]);

  /* Fetch brand info for advertisers */
  const { data: brandData = [] } = useQuery({
    queryKey: ["advertiser-brands-offers", advertiserIds],
    queryFn: async () => {
      if (!advertiserIds.length) return [];
      const results = [];
      for (const id of advertiserIds) {
        const { data } = await supabase.rpc("get_advertiser_brand", { p_user_id: id });
        if (data && data.length > 0) results.push(data[0]);
      }
      return results;
    },
    enabled: advertiserIds.length > 0,
  });
  const brandMap = useMemo(() => {
    const m = new Map<string, { brand_name: string; brand_logo_url: string; business_verified: boolean; business_category: string }>();
    for (const b of brandData) m.set(b.user_id, b);
    return m;
  }, [brandData]);

  const filteredDeals = useMemo(() => {
    let result = deals;
    if (filter === "new") result = deals.filter((d) => getProposalStatus(d.status) === "new");
    if (filter === "active") result = deals.filter((d) => getProposalStatus(d.status) === "active");
    if (filter === "archived") result = deals.filter((d) => getProposalStatus(d.status) === "archived");
    if (minBudget > 0) result = result.filter((d) => (d.budget || 0) >= minBudget);
    if (minPartnerScore > 0) result = result.filter((d) => { const score = advScoresMap.get(d.advertiser_id || ""); if (!score || score.partnerScore === 0) return true; return score.partnerScore >= minPartnerScore; });
    return [...result].sort((a, b) => {
      const aLow = advScoresMap.get(a.advertiser_id || "")?.isLowScore ? 1 : 0;
      const bLow = advScoresMap.get(b.advertiser_id || "")?.isLowScore ? 1 : 0;
      if (aLow !== bLow) return aLow - bLow;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [deals, filter, advScoresMap, minBudget, minPartnerScore]);

  const sendNotification = async (deal: typeof deals[0], accepted: boolean) => {
    if (!deal.advertiser_id || !user) return;
    const creatorName = profile?.display_name || "Автор";
    await supabase.from("notifications").insert({ user_id: deal.advertiser_id, title: accepted ? "Предложение принято" : "Предложение отклонено", message: accepted ? `${creatorName} принял(а) ваше предложение «${deal.title}»` : `${creatorName} отклонил(а) ваше предложение «${deal.title}»`, type: "deal", link: "/ad-studio" });
  };

  const handleAccept = async (dealId: string, e: React.MouseEvent) => {
    e.stopPropagation(); setActionLoading(dealId);
    const deal = deals.find((d) => d.id === dealId);
    const { error } = await supabase.from("deals").update({ status: "briefing" }).eq("id", dealId);
    if (error) toast.error("Не удалось принять предложение");
    else {
      if (deal) await sendNotification(deal, true);
      toast.success("Сделка создана. Ожидайте резервирования средств.");
      queryClient.invalidateQueries({ queryKey: ["creator-incoming-deals"] });
      queryClient.invalidateQueries({ queryKey: ["my_deals"] });
      navigate("/ad-studio", { state: { openDealId: dealId } });
    }
    setActionLoading(null);
  };

  const handleReject = async (dealId: string, e: React.MouseEvent) => {
    e.stopPropagation(); setActionLoading(dealId);
    const deal = deals.find((d) => d.id === dealId);
    const { error } = await supabase.from("deals").update({ status: "disputed" }).eq("id", dealId);
    if (error) toast.error("Не удалось отклонить предложение");
    else { if (deal) await sendNotification(deal, false); toast.success("Предложение отклонено"); queryClient.invalidateQueries({ queryKey: ["creator-incoming-deals"] }); }
    setActionLoading(null);
  };

  const newCount = deals.filter((d) => d.status === "pending").length;
  const activeCount = deals.filter((d) => getProposalStatus(d.status) === "active").length;

  return (
    <PageTransition>
      <div className="p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary" />
            Предложения
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Входящие предложения и рейтинг партнёров</p>
        </div>

        <Tabs defaultValue="offers" className="space-y-4">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="offers" className="gap-1.5">
              <Briefcase className="h-3.5 w-3.5" />
              Предложения
              {newCount > 0 && <Badge variant="destructive" className="ml-1 text-[10px] h-4 px-1">{newCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="rating" className="gap-1.5">
              <Shield className="h-3.5 w-3.5" /> Индекс партнёра
            </TabsTrigger>
            {(rating.isModerator || rating.isCreator) && (
              <TabsTrigger value="internal" className="gap-1.5">
                <EyeOff className="h-3.5 w-3.5" /> Аналитика
              </TabsTrigger>
            )}
            {rating.isCreator && (
              <TabsTrigger value="rate" className="gap-1.5">
                <Star className="h-3.5 w-3.5" /> Оценить
              </TabsTrigger>
            )}
          </TabsList>

          {/* ── Offers tab ── */}
          <TabsContent value="offers" className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              {([
                { key: "all" as const, label: "Все", count: deals.length },
                { key: "new" as const, label: "Новые", count: newCount },
                { key: "active" as const, label: "Активные", count: activeCount },
                { key: "archived" as const, label: "Архив", count: deals.filter((d) => getProposalStatus(d.status) === "archived").length },
              ]).map((f) => (
                <button key={f.key} onClick={() => setFilter(f.key)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f.key ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"}`}>
                  {f.label}
                  {f.count > 0 && <span className="ml-1 opacity-70">({f.count})</span>}
                </button>
              ))}
              <button onClick={() => setShowFilters(!showFilters)} className={`ml-auto px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${showFilters ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"}`}>
                <SlidersHorizontal className="h-3.5 w-3.5" /> Фильтры
              </button>
            </div>

            {showFilters && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="rounded-xl border border-border bg-card p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between"><label className="text-xs font-medium text-muted-foreground">Мин. бюджет</label><span className="text-xs font-semibold text-card-foreground">{minBudget > 0 ? `от ${minBudget.toLocaleString()} ₽` : "Любой"}</span></div>
                    <Slider value={[minBudget]} onValueChange={([v]) => setMinBudget(v)} max={maxBudget} step={5000} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between"><label className="text-xs font-medium text-muted-foreground">Мин. Partner Score</label><span className="text-xs font-semibold text-card-foreground">{minPartnerScore > 0 ? `от ${minPartnerScore.toFixed(1)}` : "Любой"}</span></div>
                    <Slider value={[minPartnerScore]} onValueChange={([v]) => setMinPartnerScore(v)} max={5} step={0.5} />
                  </div>
                </div>
                {(minBudget > 0 || minPartnerScore > 0) && <Button variant="ghost" size="sm" onClick={() => { setMinBudget(0); setMinPartnerScore(0); }} className="text-xs">Сбросить фильтры</Button>}
              </motion.div>
            )}

            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground animate-pulse">Загрузка...</div>
            ) : filteredDeals.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center space-y-3">
                  <Briefcase className="h-10 w-10 mx-auto text-muted-foreground/30" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Пока нет предложений</p>
                    <p className="text-xs text-muted-foreground mt-1">Когда рекламодатели захотят сотрудничать, их предложения появятся здесь.</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 border border-border px-4 py-3 max-w-sm mx-auto">
                    <p className="text-xs text-muted-foreground">
                      💡 <span className="font-medium text-foreground">Совет:</span> Заполните свои офферы (Видео / Пост / Подкаст) в настройках студии, чтобы получать более точные предложения.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredDeals.map((deal) => {
                  const advScore = advScoresMap.get(deal.advertiser_id || "");
                  const isLow = advScore?.isLowScore;
                  const advProfile = offerProfileMap.get(deal.advertiser_id || "");
                  const brand = brandMap.get(deal.advertiser_id || "");
                  const pStatus = getProposalStatus(deal.status);
                  const statusCfg = proposalStatusConfig[pStatus];
                  const placement = placementFromTitle(deal.title);
                  const isNew = pStatus === "new";

                  const briefHook = deal.description
                    ? deal.description.length > 80
                      ? deal.description.slice(0, 80).trimEnd() + "…"
                      : deal.description
                    : null;

                  return (
                    <Card
                      key={deal.id}
                      className={`overflow-hidden transition-all cursor-pointer ${isLow ? "opacity-60 border-destructive/20" : isNew ? "border-primary/25 hover:border-primary/50 hover:shadow-md" : "hover:border-border hover:shadow-sm"}`}
                      onClick={() => setSelectedDeal(deal)}
                    >
                      <CardContent className="p-4 space-y-2.5">
                        {/* Row 1: Brand/name + status pill */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border border-border shrink-0">
                              {brand?.brand_logo_url
                                ? <img src={brand.brand_logo_url} alt="" className="h-full w-full object-cover" />
                                : advProfile?.avatar_url
                                  ? <img src={advProfile.avatar_url} alt="" className="h-full w-full object-cover" />
                                  : <Briefcase className="h-4 w-4 text-primary" />}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[15px] font-semibold text-card-foreground truncate leading-tight">
                                  {brand?.brand_name || advProfile?.display_name || deal.advertiser_name}
                                </span>
                                {brand?.business_verified && (
                                  <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />
                                )}
                                {isLow && (
                                  <Tooltip><TooltipTrigger><ShieldAlert className="h-3.5 w-3.5 text-destructive shrink-0" /></TooltipTrigger><TooltipContent><p className="text-xs">Низкий Partner Score: {advScore!.partnerScore.toFixed(1)}</p></TooltipContent></Tooltip>
                                )}
                              </div>
                              {brand?.brand_name && advProfile?.display_name && brand.brand_name !== advProfile.display_name && (
                                <p className="text-[12px] text-muted-foreground truncate leading-tight">{advProfile.display_name}</p>
                              )}
                            </div>
                          </div>
                          <Badge variant="outline" className={`text-[11px] shrink-0 border font-medium ${statusCfg.cls}`}>
                            {statusCfg.label}
                          </Badge>
                        </div>

                        {/* Row 2: Summary — placement + budget + deadline */}
                        <div className="flex items-center gap-2 text-[14px] flex-wrap">
                          {placement && (
                            <span className="font-medium text-card-foreground">{placement}</span>
                          )}
                          {placement && <span className="text-muted-foreground">·</span>}
                          <span className="font-bold text-card-foreground">{(deal.budget || 0).toLocaleString()} ₽</span>
                          {deal.deadline && (
                            <>
                              <span className="text-muted-foreground">·</span>
                              <span className="text-muted-foreground text-[13px] flex items-center gap-1">
                                <CalendarDays className="h-3 w-3" />
                                до {new Date(deal.deadline).toLocaleDateString("ru-RU")}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Row 3: Brief hook */}
                        {briefHook && (
                          <p className="text-[13px] text-foreground/70 leading-snug line-clamp-1">
                            «{briefHook}»
                          </p>
                        )}

                        {/* Row 4: Icons row + timestamp + CTA */}
                        <div className="flex items-center justify-between pt-1.5 border-t border-border">
                          <div className="flex items-center gap-3">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
                                  <ShieldCheck className="h-3.5 w-3.5" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent><p className="text-xs">Маркировка через платформу</p></TooltipContent>
                            </Tooltip>
                            {brand?.business_category && (
                              <span className="text-[12px] text-muted-foreground">{brand.business_category}</span>
                            )}
                            {advScore && advScore.partnerScore > 0 && !isLow && (
                              <span className="text-[12px] text-muted-foreground flex items-center gap-0.5">
                                <Star className="h-3 w-3 text-warning fill-warning" />
                                {advScore.partnerScore.toFixed(1)}
                              </span>
                            )}
                            <span className="text-[12px] text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {timeAgo(deal.created_at)}
                            </span>
                          </div>

                          {isNew ? (
                            <Button
                              size="sm"
                              className="h-8 text-[13px] font-medium"
                              onClick={(e) => { e.stopPropagation(); setSelectedDeal(deal); }}
                            >
                              Открыть предложение
                            </Button>
                          ) : pStatus === "active" ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-8 text-[13px] font-medium"
                              onClick={(e) => { e.stopPropagation(); setSelectedDeal(deal); }}
                            >
                              Продолжить
                              <ChevronRight className="h-3 w-3 ml-1" />
                            </Button>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Detail view modal */}
            {selectedDeal && (
              <IncomingProposalDetail
                open={!!selectedDeal}
                onClose={() => setSelectedDeal(null)}
                deal={selectedDeal}
                advertiserProfile={offerProfileMap.get(selectedDeal.advertiser_id || "") || null}
                brand={brandMap.get(selectedDeal.advertiser_id || "") || null}
              />
            )}
          </TabsContent>

          {/* ── Rating tab ── */}
          <TabsContent value="rating"><PublicRating advertiserScores={rating.advertiserScores} profileMap={rating.profileMap} /></TabsContent>

          {/* ── Internal tab ── */}
          {(rating.isModerator || rating.isCreator) && (
            <TabsContent value="internal">
              <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" />Внутренняя аналитика (не видна рекламодателям)</CardTitle></CardHeader>
              <CardContent><InternalAnalytics advertiserScores={rating.advertiserScores} profileMap={rating.profileMap} /></CardContent></Card>
            </TabsContent>
          )}

          {/* ── Rate tab ── */}
          {rating.isCreator && (
            <TabsContent value="rate">
              <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><Star className="h-4 w-4 text-primary" />Оценить рекламодателя</CardTitle></CardHeader>
              <CardContent><RateAdvertiser unratedDeals={rating.unratedDeals} completedDeals={rating.completedDeals} /></CardContent></Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </PageTransition>
  );
}

/* ═══════════════════════════════════════════════════
   Advertiser view: Browse creators + Rating
   ═══════════════════════════════════════════════════ */
const niches = ["Все", "Образование", "Технологии", "Дизайн", "Фото", "Музыка", "Подкасты", "Бизнес", "Видео", "Motion"];

function AdvertiserMarketplace() {
  const [search, setSearch] = useState("");
  const [activeNiche, setActiveNiche] = useState("Все");
  const navigate = useNavigate();
  const rating = useRatingData();

  const filtered = creators.filter((c) => {
    const matchSearch = c.displayName.toLowerCase().includes(search.toLowerCase());
    const matchNiche = activeNiche === "Все" || c.niche.includes(activeNiche);
    return matchSearch && matchNiche;
  });

  return (
    <PageTransition>
      <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary" />
            Предложения
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Биржа размещений и рейтинг партнёров</p>
        </div>

        <Tabs defaultValue="marketplace" className="space-y-4">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="marketplace" className="gap-1.5"><Store className="h-3.5 w-3.5" /> Биржа</TabsTrigger>
            <TabsTrigger value="rating" className="gap-1.5"><Shield className="h-3.5 w-3.5" /> Индекс партнёра</TabsTrigger>
          </TabsList>

          <TabsContent value="marketplace" className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Поиск авторов..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-card" />
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {niches.map((n) => (
                <button key={n} onClick={() => setActiveNiche(n)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeNiche === n ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"}`}>{n}</button>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((creator) => (
                <motion.div key={creator.userId} onClick={() => navigate(`/creator/${creator.userId}`)} whileHover={{ y: -3 }} className="cursor-pointer rounded-xl border border-border bg-card p-5 space-y-4 hover:border-primary/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <img src={creator.avatar} alt="" className="h-12 w-12 rounded-full" />
                    <div className="flex-1"><div className="flex items-center gap-1.5"><h3 className="font-semibold text-sm text-card-foreground">{creator.displayName}</h3>{creator.verified && <CheckCircle className="h-3.5 w-3.5 text-primary" />}</div><p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{creator.geo}</p></div>
                    <div className="flex items-center gap-1 text-warning"><Star className="h-3.5 w-3.5 fill-current" /><span className="text-sm font-bold">{creator.rating}</span></div>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{creator.bio}</p>
                  <div className="flex flex-wrap gap-1.5">{creator.niche.map((n) => <Badge key={n} variant="secondary" className="text-[10px]">{n}</Badge>)}</div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-3">
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{(creator.followers / 1000).toFixed(0)}K подписчиков</span>
                    <span>Охват: {(creator.reach / 1000).toFixed(0)}K</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="rating"><PublicRating advertiserScores={rating.advertiserScores} profileMap={rating.profileMap} /></TabsContent>
        </Tabs>
      </div>
    </PageTransition>
  );
}

/* ═══════════════════════════════════════════════════
   Missing import for Store icon (used in advertiser tabs)
   ═══════════════════════════════════════════════════ */
import { Store } from "lucide-react";

/* ═══════════════════════════════════════════════════
   Main export: role-based rendering
   ═══════════════════════════════════════════════════ */
export default function Marketplace() {
  const { isCreator } = useUserRole();
  if (isCreator) return <CreatorOffers />;
  return <AdvertiserMarketplace />;
}
