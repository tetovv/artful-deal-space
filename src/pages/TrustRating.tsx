import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Star,
  TrendingUp,
  AlertTriangle,
  Shield,
  Clock,
  FileText,
  MessageSquare,
  Handshake,
  RefreshCw,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Send,
} from "lucide-react";

interface AdvertiserScore {
  advertiserId: string;
  advertiserName: string;
  avgPaymentTimeliness: number;
  avgBriefAdequacy: number;
  avgCommunication: number;
  avgAgreementCompliance: number;
  avgRepeatWillingness: number;
  partnerScore: number;
  completedDeals: number;
  totalRatings: number;
}

const CRITERIA = [
  { key: "payment_timeliness", label: "Соблюдение сроков оплаты", icon: Clock },
  { key: "brief_adequacy", label: "Адекватность ТЗ", icon: FileText },
  { key: "communication", label: "Коммуникация", icon: MessageSquare },
  { key: "agreement_compliance", label: "Соответствие договорённостям", icon: Handshake },
  { key: "repeat_willingness", label: "Готовность к повт. сотрудничеству", icon: RefreshCw },
] as const;

export default function TrustRating() {
  const { user } = useAuth();
  const { isCreator, isModerator } = useUserRole();
  const queryClient = useQueryClient();

  const [ratingDealId, setRatingDealId] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [expandedAdvertiser, setExpandedAdvertiser] = useState<string | null>(null);

  // Fetch ratings with deal info
  const { data: ratings = [] } = useQuery({
    queryKey: ["ratings-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ratings")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch completed deals for current creator
  const { data: completedDeals = [] } = useQuery({
    queryKey: ["completed-deals-for-rating", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("deals")
        .select("*")
        .eq("creator_id", user.id)
        .eq("status", "completed");
      if (error) throw error;
      return data;
    },
    enabled: !!user && isCreator,
  });

  // Deals not yet rated by this creator
  const unratedDeals = useMemo(() => {
    const ratedDealIds = new Set(
      ratings.filter((r) => r.from_id === user?.id).map((r) => r.deal_id)
    );
    return completedDeals.filter((d) => !ratedDealIds.has(d.id));
  }, [completedDeals, ratings, user?.id]);

  // Aggregate advertiser scores
  const advertiserScores = useMemo<AdvertiserScore[]>(() => {
    const map = new Map<string, { ratings: typeof ratings; name: string; deals: number }>();

    // Group ratings by advertiser (to_id)
    for (const r of ratings) {
      if (!r.to_id) continue;
      const existing = map.get(r.to_id) || { ratings: [], name: "", deals: 0 };
      existing.ratings.push(r);
      map.set(r.to_id, existing);
    }

    // Get advertiser names from deals
    for (const r of ratings) {
      if (!r.to_id) continue;
      const entry = map.get(r.to_id);
      if (entry && !entry.name) {
        // We'll use deal data to find name
      }
    }

    return Array.from(map.entries()).map(([advId, { ratings: advRatings }]) => {
      const avg = (key: string) => {
        const vals = advRatings.map((r: any) => r[key]).filter((v: any) => v != null);
        return vals.length ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : 0;
      };

      const avgPT = avg("payment_timeliness");
      const avgBA = avg("brief_adequacy");
      const avgC = avg("communication");
      const avgAC = avg("agreement_compliance");
      const avgRW = avg("repeat_willingness");

      // If new criteria are empty, fallback to overall
      const hasNewCriteria = avgPT > 0 || avgBA > 0 || avgAC > 0 || avgRW > 0;
      const partnerScore = hasNewCriteria
        ? (avgPT * 0.25 + avgBA * 0.2 + avgC * 0.2 + avgAC * 0.2 + avgRW * 0.15)
        : avg("overall") || 0;

      return {
        advertiserId: advId,
        advertiserName: advId.slice(0, 8),
        avgPaymentTimeliness: avgPT,
        avgBriefAdequacy: avgBA,
        avgCommunication: avgC,
        avgAgreementCompliance: avgAC,
        avgRepeatWillingness: avgRW,
        partnerScore,
        completedDeals: advRatings.length,
        totalRatings: advRatings.length,
      };
    }).sort((a, b) => b.partnerScore - a.partnerScore);
  }, [ratings]);

  // Fetch profiles for advertiser names
  const { data: profiles = [] } = useQuery({
    queryKey: ["advertiser-profiles", advertiserScores.map((a) => a.advertiserId)],
    queryFn: async () => {
      const ids = advertiserScores.map((a) => a.advertiserId);
      if (!ids.length) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", ids);
      return data || [];
    },
    enabled: advertiserScores.length > 0,
  });

  const profileMap = useMemo(() => {
    const m = new Map<string, { display_name: string; avatar_url: string | null }>();
    for (const p of profiles) m.set(p.user_id, p);
    return m;
  }, [profiles]);

  const handleSubmitRating = async () => {
    if (!ratingDealId || !user) return;
    const deal = completedDeals.find((d) => d.id === ratingDealId);
    if (!deal) return;

    const allFilled = CRITERIA.every((c) => scores[c.key] && scores[c.key] >= 1 && scores[c.key] <= 5);
    if (!allFilled) {
      toast.error("Оцените все критерии (1-5)");
      return;
    }

    setSubmitting(true);
    const overall =
      (scores.payment_timeliness * 0.25) +
      (scores.brief_adequacy * 0.2) +
      (scores.communication * 0.2) +
      (scores.agreement_compliance * 0.2) +
      (scores.repeat_willingness * 0.15);

    const { error } = await supabase.from("ratings").insert({
      deal_id: ratingDealId,
      from_id: user.id,
      to_id: deal.advertiser_id,
      communication: scores.communication,
      payment: scores.payment_timeliness,
      professionalism: scores.brief_adequacy,
      payment_timeliness: scores.payment_timeliness,
      brief_adequacy: scores.brief_adequacy,
      agreement_compliance: scores.agreement_compliance,
      repeat_willingness: scores.repeat_willingness,
      overall: parseFloat(overall.toFixed(2)),
    });

    if (error) {
      toast.error("Ошибка при сохранении оценки");
    } else {
      toast.success("Оценка отправлена!");
      setRatingDealId(null);
      setScores({});
      queryClient.invalidateQueries({ queryKey: ["ratings-full"] });
    }
    setSubmitting(false);
  };

  const getScoreColor = (score: number) => {
    if (score >= 4.5) return "text-green-500";
    if (score >= 3.5) return "text-yellow-500";
    if (score >= 2.5) return "text-orange-500";
    return "text-destructive";
  };

  const getScoreBadge = (score: number) => {
    if (score >= 4.5) return { label: "Отличный партнёр", variant: "default" as const };
    if (score >= 3.5) return { label: "Хороший партнёр", variant: "secondary" as const };
    if (score >= 2.5) return { label: "Средний", variant: "outline" as const };
    return { label: "Низкий рейтинг", variant: "destructive" as const };
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          Индекс партнёра
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Рейтинг рекламодателей на основе оценок авторов после завершённых сделок
        </p>
      </div>

      <Tabs defaultValue="public" className="space-y-4">
        <TabsList>
          <TabsTrigger value="public" className="gap-1.5">
            <Eye className="h-3.5 w-3.5" /> Публичный рейтинг
          </TabsTrigger>
          {(isModerator || isCreator) && (
            <TabsTrigger value="internal" className="gap-1.5">
              <EyeOff className="h-3.5 w-3.5" /> Внутренняя аналитика
            </TabsTrigger>
          )}
          {isCreator && (
            <TabsTrigger value="rate" className="gap-1.5">
              <Star className="h-3.5 w-3.5" /> Оценить
            </TabsTrigger>
          )}
        </TabsList>

        {/* PUBLIC TAB */}
        <TabsContent value="public" className="space-y-4">
          {advertiserScores.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Star className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>Ещё нет оценок. Рейтинг появится после первых завершённых сделок.</p>
              </CardContent>
            </Card>
          ) : (
            advertiserScores.map((adv, idx) => {
              const prof = profileMap.get(adv.advertiserId);
              const badge = getScoreBadge(adv.partnerScore);
              const isExpanded = expandedAdvertiser === adv.advertiserId;

              return (
                <Card key={adv.advertiserId} className="animate-fade-in overflow-hidden">
                  <button
                    className="w-full text-left"
                    onClick={() => setExpandedAdvertiser(isExpanded ? null : adv.advertiserId)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border-2 border-border">
                              {prof?.avatar_url ? (
                                <img src={prof.avatar_url} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <span className="text-lg font-bold text-primary">#{idx + 1}</span>
                              )}
                            </div>
                          </div>
                          <div>
                            <p className="font-semibold text-card-foreground">
                              {prof?.display_name || `Рекламодатель`}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {adv.completedDeals} {adv.completedDeals === 1 ? "оценка" : "оценок"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className={`text-3xl font-bold ${getScoreColor(adv.partnerScore)}`}>
                              {adv.partnerScore.toFixed(1)}
                            </p>
                            <Badge variant={badge.variant} className="text-[10px]">{badge.label}</Badge>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </button>

                  {isExpanded && (
                    <CardContent className="pt-0 space-y-3 animate-fade-in">
                      <div className="grid gap-2">
                        {CRITERIA.map((c) => {
                          const val = adv[
                            `avg${c.key.charAt(0).toUpperCase()}${c.key
                              .slice(1)
                              .replace(/_([a-z])/g, (_, l) => l.toUpperCase())}` as keyof AdvertiserScore
                          ] as number;
                          const Icon = c.icon;
                          return (
                            <div key={c.key} className="flex items-center gap-3">
                              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="text-xs text-muted-foreground w-48 shrink-0">{c.label}</span>
                              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-primary transition-all"
                                  style={{ width: `${(val / 5) * 100}%` }}
                                />
                              </div>
                              <span className={`text-sm font-semibold w-8 text-right ${getScoreColor(val)}`}>
                                {val > 0 ? val.toFixed(1) : "—"}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Star display */}
                      <div className="flex items-center gap-1 pt-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`h-4 w-4 ${
                              s <= Math.round(adv.partnerScore)
                                ? "text-primary fill-primary"
                                : "text-muted"
                            }`}
                          />
                        ))}
                        <span className="text-xs text-muted-foreground ml-2">Partner Score</span>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* INTERNAL TAB — moderators + creators */}
        {(isModerator || isCreator) && (
          <TabsContent value="internal" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Внутренняя аналитика (не видна рекламодателям)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {advertiserScores.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Нет данных</p>
                ) : (
                  advertiserScores.map((adv) => {
                    const prof = profileMap.get(adv.advertiserId);
                    const lowPayment = adv.avgPaymentTimeliness > 0 && adv.avgPaymentTimeliness < 3;
                    return (
                      <div
                        key={adv.advertiserId}
                        className={`rounded-lg border p-4 space-y-2 ${
                          lowPayment ? "border-destructive/40 bg-destructive/5" : "border-border"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm">
                            {prof?.display_name || "Рекламодатель"}
                          </p>
                          {lowPayment && (
                            <Badge variant="destructive" className="text-[10px]">
                              ⚠️ Задерживает оплату — сниженная видимость
                            </Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div>
                            <p className="text-muted-foreground">Сделок</p>
                            <p className="font-semibold">{adv.completedDeals}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Partner Score</p>
                            <p className={`font-semibold ${getScoreColor(adv.partnerScore)}`}>
                              {adv.partnerScore.toFixed(1)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Оплата вовремя</p>
                            <p className={`font-semibold ${getScoreColor(adv.avgPaymentTimeliness)}`}>
                              {adv.avgPaymentTimeliness > 0 ? adv.avgPaymentTimeliness.toFixed(1) : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Повт. авторы</p>
                            <p className={`font-semibold ${getScoreColor(adv.avgRepeatWillingness)}`}>
                              {adv.avgRepeatWillingness > 0 ? adv.avgRepeatWillingness.toFixed(1) : "—"}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* RATE TAB — creators only */}
        {isCreator && (
          <TabsContent value="rate" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Star className="h-4 w-4 text-primary" />
                  Оценить рекламодателя
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {unratedDeals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Нет завершённых сделок для оценки. Оценка доступна после завершения сделки.
                  </p>
                ) : (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Выберите сделку</label>
                      <select
                        value={ratingDealId || ""}
                        onChange={(e) => {
                          setRatingDealId(e.target.value || null);
                          setScores({});
                        }}
                        className="w-full p-2.5 rounded-lg bg-background border border-border text-sm text-foreground"
                      >
                        <option value="">— Выберите —</option>
                        {unratedDeals.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.title} — {d.advertiser_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {ratingDealId && (
                      <div className="space-y-4 animate-fade-in">
                        {CRITERIA.map((c) => {
                          const Icon = c.icon;
                          return (
                            <div key={c.key} className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">{c.label}</span>
                              </div>
                              <div className="flex gap-1.5">
                                {[1, 2, 3, 4, 5].map((v) => (
                                  <button
                                    key={v}
                                    onClick={() => setScores((p) => ({ ...p, [c.key]: v }))}
                                    className="transition-all"
                                  >
                                    <Star
                                      className={`h-7 w-7 ${
                                        v <= (scores[c.key] || 0)
                                          ? "text-primary fill-primary"
                                          : "text-muted hover:text-muted-foreground"
                                      }`}
                                    />
                                  </button>
                                ))}
                                <span className="text-xs text-muted-foreground self-center ml-2">
                                  {scores[c.key] ? `${scores[c.key]}/5` : ""}
                                </span>
                              </div>
                            </div>
                          );
                        })}

                        <Button
                          onClick={handleSubmitRating}
                          disabled={submitting}
                          className="w-full mt-2"
                        >
                          <Send className="h-4 w-4 mr-2" />
                          {submitting ? "Отправка..." : "Отправить оценку"}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
