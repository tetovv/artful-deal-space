import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle2, AlertTriangle,
  Search, MapPin, Users, Filter, MessageSquarePlus, Eye, X, Loader2, RotateCcw, Globe, Clock,
  Handshake, Zap, ExternalLink, ShieldCheck, Tag, Lock, Sparkles, ArrowLeft, UserPlus, UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BriefWizard, type BriefData } from "./BriefWizard";
import { DealProposalForm } from "./DealProposalForm";
import { useCreatorsAvgViews } from "@/hooks/useCreatorAnalytics";
import { useMyDrafts } from "@/hooks/useDealProposals";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const NICHES = ["Образование", "Технологии", "Дизайн", "Фото", "Музыка", "Подкасты", "Бизнес", "Видео", "Motion"];
const GEOS = ["Россия", "Беларусь", "Казахстан", "Украина"];
const PLATFORMS = ["Telegram", "YouTube", "Instagram", "VK", "TikTok"];
const OFFER_TYPES = ["Видео-интеграция", "Пост", "Подкаст"] as const;
const BUSINESS_CATEGORIES: Record<string, string> = {
  ecommerce: "E-commerce", saas: "SaaS / IT", finance: "Финансы", education: "Образование",
  health: "Здоровье", food: "Еда / FMCG", fashion: "Мода / Красота", travel: "Путешествия",
  entertainment: "Развлечения", realty: "Недвижимость", auto: "Авто", other: "Другое",
};

const OFFER_TYPE_LABELS: Record<string, string> = {
  video: "Видео-интеграция",
  post: "Пост",
  podcast: "Подкаст",
};

const SORT_OPTIONS = [
  { value: "recommended", label: "Рекомендовано" },
  { value: "cheapest", label: "По цене (↑)" },
  { value: "response", label: "По скорости ответа" },
  { value: "deals", label: "По сделкам" },
  { value: "audience", label: "По аудитории" },
];

interface ProfileRow {
  user_id: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  niche: string[] | null;
  followers: number | null;
  reach: number | null;
  geo: string | null;
  verified: boolean | null;
  content_count: number | null;
  response_hours: number | null;
  safe_deal: boolean | null;
  deals_count: number | null;
}

interface OfferRow {
  creator_id: string;
  offer_type: string;
  price: number;
  turnaround_days: number;
}

interface PlatformRow {
  creator_id: string;
  platform_name: string;
  subscriber_count: number;
  avg_views: number | null;
}

interface CreatorMeta {
  responseHours: number;
  dealsCount: number;
  safeDeal: boolean;
  offers: { type: string; price: number; turnaroundDays: number }[];
  minPrice: number | null;
  platforms: { name: string; metric: string }[];
}

interface FilterState {
  niches: string[];
  geos: string[];
  platforms: string[];
  categories: string[];
  verifiedOnly: boolean;
  reachRange: [number, number];
  followingOnly: boolean;
}

const defaultFilters: FilterState = {
  niches: [], geos: [], platforms: [], categories: [],
  verifiedOnly: false, reachRange: [0, 1000000], followingOnly: false,
};

function hasActiveFilters(f: FilterState): boolean {
  return f.niches.length > 0 || f.geos.length > 0 || f.platforms.length > 0 ||
    f.categories.length > 0 || f.verifiedOnly || f.reachRange[0] > 0 || f.reachRange[1] < 1000000 || f.followingOnly;
}

function getActiveChips(f: FilterState): { key: string; label: string }[] {
  const chips: { key: string; label: string }[] = [];
  if (f.followingOnly) chips.push({ key: "following", label: "Подписки" });
  f.niches.forEach((n) => chips.push({ key: `niche-${n}`, label: n }));
  f.geos.forEach((g) => chips.push({ key: `geo-${g}`, label: g }));
  f.platforms.forEach((p) => chips.push({ key: `platform-${p}`, label: p }));
  f.categories.forEach((c) => chips.push({ key: `cat-${c}`, label: BUSINESS_CATEGORIES[c] || c }));
  if (f.verifiedOnly) chips.push({ key: "verified", label: "Верифицированные" });
  if (f.reachRange[0] > 0 || f.reachRange[1] < 1000000)
    chips.push({ key: "reach", label: `Охват ${(f.reachRange[0] / 1000).toFixed(0)}K–${(f.reachRange[1] / 1000).toFixed(0)}K` });
  return chips;
}

const fmt = (n: number | null) => {
  if (!n || n === 0) return null;
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return String(n);
};

function buildCreatorMeta(
  profile: ProfileRow,
  offersMap: Map<string, OfferRow[]>,
  platformsMap: Map<string, PlatformRow[]>,
): CreatorMeta {
  const offers = (offersMap.get(profile.user_id) || []).map((o) => ({
    type: OFFER_TYPE_LABELS[o.offer_type] || o.offer_type,
    price: o.price,
    turnaroundDays: o.turnaround_days,
  }));
  const platforms = (platformsMap.get(profile.user_id) || []).map((p) => ({
    name: p.platform_name,
    metric: fmt(p.subscriber_count) || "0",
  }));
  const minPrice = offers.length > 0 ? Math.min(...offers.map((o) => o.price)) : null;
  return {
    responseHours: profile.response_hours || 24,
    dealsCount: profile.deals_count || 0,
    safeDeal: profile.safe_deal || false,
    offers,
    minPrice,
    platforms: platforms.slice(0, 3),
  };
}

/* ── Verification Banner ── */
function VerificationBanner({ onGoToSettings }: { onGoToSettings: () => void }) {
  return (
    <div className="p-3 rounded-lg border border-warning/30 bg-warning/5 flex items-center gap-3">
      <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">Пройдите верификацию</p>
        <p className="text-xs text-muted-foreground">Для связи с авторами подтвердите реквизиты и подключите ОРД</p>
      </div>
      <Button size="sm" variant="outline" onClick={onGoToSettings} className="shrink-0">Настроить</Button>
    </div>
  );
}

/* ── Filter Drawer Content ── */
function FilterDrawerContent({ filters, setFilters, onApply, onReset }: {
  filters: FilterState; setFilters: React.Dispatch<React.SetStateAction<FilterState>>; onApply: () => void; onReset: () => void;
}) {
  const toggle = (field: keyof FilterState, value: string) => {
    setFilters((prev) => {
      const arr = prev[field] as string[];
      return { ...prev, [field]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value] };
    });
  };
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="space-y-2.5">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
      {children}
    </div>
  );
  const CheckItem = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) => (
    <label className="flex items-center gap-2 cursor-pointer py-0.5">
      <Checkbox checked={checked} onCheckedChange={onChange} />
      <span className="text-sm text-foreground">{label}</span>
    </label>
  );
  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 pr-1">
        <div className="space-y-5 pb-4">
          <Section title="Ниша / Категория">
            {NICHES.map((n) => <CheckItem key={n} label={n} checked={filters.niches.includes(n)} onChange={() => toggle("niches", n)} />)}
          </Section>
          <Separator />
          <Section title="Регион">
            {GEOS.map((g) => <CheckItem key={g} label={g} checked={filters.geos.includes(g)} onChange={() => toggle("geos", g)} />)}
          </Section>
          <Separator />
          <Section title="Платформы">
            {PLATFORMS.map((p) => <CheckItem key={p} label={p} checked={filters.platforms.includes(p)} onChange={() => toggle("platforms", p)} />)}
          </Section>
          <Separator />
          <Section title="Категория бизнеса">
            {Object.entries(BUSINESS_CATEGORIES).map(([key, label]) => (
              <CheckItem key={key} label={label} checked={filters.categories.includes(key)} onChange={() => toggle("categories", key)} />
            ))}
          </Section>
          <Separator />
          <Section title="Охват аудитории">
            <div className="px-1 pt-2">
              <Slider min={0} max={1000000} step={10000} value={filters.reachRange}
                onValueChange={(v) => setFilters((prev) => ({ ...prev, reachRange: v as [number, number] }))} />
              <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
                <span>{(filters.reachRange[0] / 1000).toFixed(0)}K</span>
                <span>{filters.reachRange[1] >= 1000000 ? "1M+" : `${(filters.reachRange[1] / 1000).toFixed(0)}K`}</span>
              </div>
            </div>
          </Section>
          <Separator />
          <Section title="Доверие">
            <CheckItem label="Только верифицированные" checked={filters.verifiedOnly}
              onChange={() => setFilters((prev) => ({ ...prev, verifiedOnly: !prev.verifiedOnly }))} />
          </Section>
        </div>
      </ScrollArea>
      <div className="flex gap-2 pt-3 border-t border-border">
        <Button variant="outline" className="flex-1" onClick={onReset}><RotateCcw className="h-3.5 w-3.5 mr-1.5" />Сбросить</Button>
        <Button className="flex-1" onClick={onApply}>Применить</Button>
      </div>
    </div>
  );
}

/* ── Quick View Modal ── */
function QuickViewModal({ creator, meta, open, onClose, isVerified, categoryLabel, onPropose, avgViews }: {
  creator: ProfileRow; meta: CreatorMeta; open: boolean; onClose: () => void; isVerified: boolean; categoryLabel?: string;
  onPropose: () => void; avgViews?: { avgViews: number; videoCount: number } | null;
}) {
  const metrics: { icon: React.ReactNode; label: string; value: string }[] = [];
  const tgPlatform = meta.platforms.find((p) => p.name === "TG" || p.name === "Telegram");
  const ytPlatform = meta.platforms.find((p) => p.name === "YT" || p.name === "YouTube");
  if (tgPlatform) metrics.push({ icon: <Users className="h-4 w-4" />, label: "TG подписчики", value: tgPlatform.metric });
  if (ytPlatform) metrics.push({ icon: <Eye className="h-4 w-4" />, label: "YT avg views", value: ytPlatform.metric });
  if (avgViews && avgViews.videoCount >= 3) metrics.push({ icon: <Eye className="h-4 w-4" />, label: "Avg views (30%)", value: fmt(avgViews.avgViews) || "—" });
  if (meta.dealsCount > 0) metrics.push({ icon: <Handshake className="h-4 w-4" />, label: "Сделки завершены", value: String(meta.dealsCount) });
  if (meta.responseHours > 0) metrics.push({ icon: <Clock className="h-4 w-4" />, label: "Среднее время ответа", value: `~${meta.responseHours} ч` });

  const turnaroundMap = new Map<string, string>();
  for (const o of meta.offers) {
    turnaroundMap.set(o.type, `${o.turnaroundDays} дн`);
  }
  const niches = (creator.niche || []).slice(0, 4);
  const bestFitLine = niches.length > 0 ? `Подходит для: ${niches.join(" / ")}` : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[760px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <img
              src={creator.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${creator.user_id}`}
              alt="" className="h-12 w-12 rounded-full bg-muted object-cover shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg font-semibold leading-tight">{creator.display_name}</span>
                {creator.verified && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                <Badge variant="outline" className="text-[11px] gap-1 border-primary/40 text-primary h-5">
                  <Lock className="h-3 w-3" />Platform-only
                </Badge>
                {meta.safeDeal && (
                  <Badge variant="outline" className="text-[11px] gap-1 border-green-500/40 text-green-400 h-5">
                    <ShieldCheck className="h-3 w-3" />Safe deal
                  </Badge>
                )}
              </div>
              {creator.bio && (
                <p className="text-[13px] text-muted-foreground font-normal mt-0.5 line-clamp-1">{creator.bio}</p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {niches.slice(0, 3).map((n) => (
                  <Badge key={n} variant="secondary" className="text-[12px]">{n}</Badge>
                ))}
                {categoryLabel && <Badge variant="outline" className="text-[12px]">{categoryLabel}</Badge>}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 mt-3">
          {metrics.length > 0 ? (
            <div className="grid grid-cols-2 gap-2.5">
              {metrics.map((m) => (
                <div key={m.label} className="flex items-center gap-3 bg-muted/30 rounded-lg px-3 py-2.5">
                  <span className="text-muted-foreground">{m.icon}</span>
                  <div className="min-w-0">
                    <p className="text-[12px] text-muted-foreground leading-tight">{m.label}</p>
                    <p className="text-[15px] font-semibold text-foreground leading-tight">{m.value}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground/60 italic">Аналитика не подключена</p>
          )}
          <div className="space-y-2">
            <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">Размещения</p>
            {meta.offers.length > 0 ? (
              <div className="space-y-1.5">
                {meta.offers.map((o) => (
                  <div key={o.type} className="flex items-center justify-between bg-muted/30 rounded-lg px-4 py-2.5">
                    <span className="text-[15px] text-foreground font-medium">{o.type}</span>
                    <div className="flex items-center gap-4">
                      {turnaroundMap.get(o.type) && (
                        <span className="text-[13px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />{turnaroundMap.get(o.type)}
                        </span>
                      )}
                      <span className="text-[15px] font-semibold text-foreground">от {o.price.toLocaleString("ru-RU")} ₽</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-muted/30 rounded-lg px-4 py-3 text-[15px] text-muted-foreground">Цена по запросу</div>
            )}
          </div>
          {bestFitLine && <p className="text-[13px] text-muted-foreground italic">{bestFitLine}</p>}
          <div className="flex gap-3 pt-3 border-t border-border">
            <Button className="flex-1 h-10 text-[15px]" disabled={!isVerified} onClick={() => { onClose(); onPropose(); }}>
              <MessageSquarePlus className="h-4 w-4 mr-2" />Предложить сделку
            </Button>
            <Button variant="outline" className="flex-1 h-10 text-[15px]" asChild>
              <a href={`/creator/${creator.user_id}`}>Открыть профиль</a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Creator Card (polished v1) ── */
function CreatorCard({ creator, meta, isVerified, categoryLabel, matchReasons, avgViews, isFollowing, onToggleFollow }: {
  creator: ProfileRow; meta: CreatorMeta; isVerified: boolean; categoryLabel?: string; matchReasons?: string[];
  avgViews?: { avgViews: number; videoCount: number } | null;
  isFollowing?: boolean; onToggleFollow?: () => void;
}) {
  const [quickView, setQuickView] = useState(false);
  const [proposalOpen, setProposalOpen] = useState(false);
  const niches = (creator.niche || []).slice(0, 2);

  /* ── 2) Metrics row data ── */
  const metricsItems: { icon: React.ReactNode; value: string; label: string }[] = [];
  const tgP = meta.platforms.find((p) => p.name === "TG" || p.name === "Telegram");
  if (tgP) metricsItems.push({ icon: <Users className="h-3.5 w-3.5" />, value: tgP.metric, label: "TG" });
  if (avgViews && avgViews.videoCount >= 3) metricsItems.push({ icon: <Eye className="h-3.5 w-3.5" />, value: fmt(avgViews.avgViews) || "—", label: "Avg views 30%" });
  if (meta.dealsCount > 0) metricsItems.push({ icon: <Handshake className="h-3.5 w-3.5" />, value: String(meta.dealsCount), label: "Сделки" });

  /* ── 3) Commercial row ── */
  const commercialParts = meta.offers.map((o) => `${o.type} от ${o.price.toLocaleString("ru-RU")} ₽`);

  /* ── 4) Analytics status ── */
  const hasAnalytics = meta.platforms.length > 0;

  return (
    <>
      <Card className="overflow-hidden hover:border-primary/30 transition-colors group">
        <CardContent className="p-4 space-y-3">
          {/* ═══ 1) Header ═══ */}
          <div className="flex items-start gap-3">
            <img
              src={creator.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${creator.user_id}`}
              alt={creator.display_name}
              className="h-11 w-11 rounded-full bg-muted shrink-0 object-cover"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-[16px] font-semibold text-foreground truncate leading-snug">{creator.display_name}</p>
                {creator.verified && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
                <Badge variant="outline" className="text-[9px] px-1 py-0 h-[18px] gap-0.5 border-primary/30 text-primary/80 ml-0.5">
                  <Lock className="h-2.5 w-2.5" />Platform
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {niches.map((n) => (
                  <Badge key={n} variant="secondary" className="text-[11px] px-1.5 py-0 h-[18px]">{n}</Badge>
                ))}
              </div>
            </div>
            {/* Right side: response time + follow icon */}
            <div className="flex items-center gap-1.5 shrink-0">
              {meta.responseHours > 0 && (
                <span className="text-[12px] text-muted-foreground/80 whitespace-nowrap flex items-center gap-0.5">
                  <Clock className="h-3 w-3" />~{meta.responseHours}ч
                </span>
              )}
              {onToggleFollow && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn("h-7 w-7 shrink-0", isFollowing && "text-primary")}
                      onClick={(e) => { e.stopPropagation(); onToggleFollow(); }}
                    >
                      {isFollowing ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p className="text-xs">{isFollowing ? "Отписаться" : "Подписаться"}</p></TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          {/* ═══ 2) Metrics row ═══ */}
          {metricsItems.length > 0 && (
            <div className="flex items-center gap-3">
              {metricsItems.map((m, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 text-[13px]">
                  <span className="text-muted-foreground/70">{m.icon}</span>
                  <span className="font-semibold text-foreground">{m.value}</span>
                  <span className="text-muted-foreground/70">{m.label}</span>
                </span>
              ))}
            </div>
          )}

          {/* ═══ 3) Commercial row ═══ */}
          <div className="text-[14px] leading-snug">
            {commercialParts.length > 0 ? (
              <p className="text-foreground/90">
                {commercialParts.map((part, i) => (
                  <span key={i}>
                    {i > 0 && <span className="text-muted-foreground/50 mx-1.5">|</span>}
                    <span className="font-medium">{part}</span>
                  </span>
                ))}
              </p>
            ) : (
              <p className="text-muted-foreground italic">Цена по запросу</p>
            )}
          </div>

          {/* ═══ 4) Analytics status (subtle) ═══ */}
          <p className={cn("text-[12px] flex items-center gap-1", hasAnalytics ? "text-muted-foreground/70" : "text-muted-foreground/50")}>
            {hasAnalytics ? (
              <><CheckCircle2 className="h-3 w-3 text-green-500/70" />Аналитика подключена</>
            ) : (
              <><AlertTriangle className="h-3 w-3" />Аналитика не подключена</>
            )}
          </p>

          {/* Match reasons */}
          {matchReasons && matchReasons.length > 0 && (
            <div className="bg-primary/5 border border-primary/20 rounded-md px-3 py-2 space-y-0.5">
              {matchReasons.map((reason, i) => (
                <p key={i} className="text-[12px] text-primary flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 shrink-0" />{reason}
                </p>
              ))}
            </div>
          )}

          {/* ═══ 5) Footer ═══ */}
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <div className="flex items-center gap-2">
              <a href={`/creator/${creator.user_id}`} className="text-[13px] text-muted-foreground hover:text-foreground transition-colors">
                Профиль
              </a>
              <button onClick={() => setQuickView(true)} className="text-[13px] text-muted-foreground hover:text-foreground transition-colors">
                Quick view
              </button>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button size="sm" className="text-[13px] h-8 px-3" disabled={!isVerified} onClick={() => setProposalOpen(true)}>
                    <MessageSquarePlus className="h-3.5 w-3.5 mr-1.5" />Предложить сделку
                  </Button>
                </span>
              </TooltipTrigger>
              {!isVerified && <TooltipContent><p className="text-xs">Пройдите верификацию</p></TooltipContent>}
            </Tooltip>
          </div>
        </CardContent>
      </Card>

      <QuickViewModal creator={creator} meta={meta} open={quickView} onClose={() => setQuickView(false)}
        isVerified={isVerified} categoryLabel={categoryLabel} onPropose={() => setProposalOpen(true)} avgViews={avgViews} />

      <DealProposalForm
        open={proposalOpen}
        onClose={() => setProposalOpen(false)}
        creator={{
          userId: creator.user_id,
          displayName: creator.display_name,
          avatarUrl: creator.avatar_url,
          offers: meta.offers,
          platforms: meta.platforms,
        }}
      />
    </>
  );
}

/* ── Brief matching logic ── */
const PLACEMENT_TYPE_MAP: Record<string, string> = {
  video: "Видео-интеграция",
  post: "Пост",
  podcast: "Подкаст",
};

function getMatchReasons(creator: ProfileRow, brief: BriefData, meta: CreatorMeta): string[] {
  const reasons: string[] = [];
  const targetType = PLACEMENT_TYPE_MAP[brief.placementType];

  const matchingOffer = meta.offers.find((o) => o.type === targetType);
  if (matchingOffer) {
    if (brief.budgetMax > 0 && matchingOffer.price <= brief.budgetMax) {
      reasons.push(`Бюджет: ${targetType} от ${matchingOffer.price.toLocaleString("ru-RU")} ₽ (в рамках)`);
    } else {
      reasons.push(`Есть оффер: ${targetType}`);
    }
  }

  if (brief.niches.length > 0) {
    const matching = (creator.niche || []).filter((n) => brief.niches.includes(n));
    if (matching.length > 0) reasons.push(`Ниша: ${matching.slice(0, 2).join(", ")}`);
  }

  if (brief.turnaroundDays > 0 && meta.responseHours <= 12) {
    reasons.push(`Быстрый ответ: ~${meta.responseHours} ч`);
  }

  return reasons.slice(0, 3);
}

function matchesBrief(creator: ProfileRow, brief: BriefData, meta: CreatorMeta): boolean {
  const targetType = PLACEMENT_TYPE_MAP[brief.placementType];
  const hasOffer = meta.offers.some((o) => o.type === targetType);
  if (!hasOffer && meta.offers.length > 0) return false;
  if (brief.budgetMax > 0 && brief.budgetMax < 500000) {
    const matchingOffer = meta.offers.find((o) => o.type === targetType);
    if (matchingOffer && matchingOffer.price > brief.budgetMax) return false;
  }
  if (brief.niches.length > 0) {
    const match = (creator.niche || []).some((n) => brief.niches.includes(n));
    if (!match) return false;
  }
  if (brief.audienceMin > 0 && (creator.followers || 0) < brief.audienceMin) return false;
  if (brief.audienceMax < 1000000 && (creator.followers || 0) > brief.audienceMax) return false;
  if (brief.excludeNoAnalytics && meta.platforms.length === 0) return false;
  return true;
}

/* ── My Drafts Panel ── */
function MyDraftsPanel({ onClose }: { onClose: () => void }) {
  const { data: drafts = [], isLoading } = useMyDrafts();
  const navigate = useNavigate();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onClose} className="gap-1.5 text-[13px] h-8">
            <ArrowLeft className="h-3.5 w-3.5" />Назад к каталогу
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <p className="text-[15px] font-semibold text-foreground">Мои черновики</p>
        </div>
        <span className="text-[13px] text-muted-foreground">{drafts.length} черновиков</span>
      </div>
      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground flex flex-col items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">Загрузка...</span>
        </div>
      ) : drafts.length === 0 ? (
        <div className="text-center py-16 text-sm text-muted-foreground">У вас нет сохранённых черновиков</div>
      ) : (
        <div className="space-y-2">
          {drafts.map((draft) => (
            <Card key={draft.id} className="hover:border-primary/30 transition-colors cursor-pointer"
              onClick={() => navigate(`/creator/${draft.creator_id}`)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{draft.placement_type || "Без типа"}</p>
                  <p className="text-xs text-muted-foreground">
                    Автор: {draft.creator_id.slice(0, 8)}...
                    {draft.budget_value && ` • ${draft.budget_value.toLocaleString("ru-RU")} ₽`}
                  </p>
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                    Обновлено: {new Date(draft.updated_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <Badge variant="secondary" className="text-[10px]">Черновик</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main BirzhaTab ── */
export function BirzhaTab({ isVerified, onGoToSettings }: { isVerified: boolean; onGoToSettings: () => void }) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("recommended");
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [brandCategories, setBrandCategories] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState<FilterState>({ ...defaultFilters });
  const [appliedFilters, setAppliedFilters] = useState<FilterState>({ ...defaultFilters });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showDrafts, setShowDrafts] = useState(false);

  // Real data from DB
  const [offersMap, setOffersMap] = useState<Map<string, OfferRow[]>>(new Map());
  const [platformsMap, setPlatformsMap] = useState<Map<string, PlatformRow[]>>(new Map());

  // Brief wizard state
  const [briefOpen, setBriefOpen] = useState(false);
  const [activeBrief, setActiveBrief] = useState<BriefData | null>(null);

  // Follow state
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());

  // Avg views for marketplace cards
  const creatorIds = useMemo(() => profiles.map(p => p.user_id), [profiles]);
  const { data: avgViewsMap = {} } = useCreatorsAvgViews(creatorIds);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const [profilesRes, offersRes, platformsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name, bio, avatar_url, niche, followers, reach, geo, verified, content_count, response_hours, safe_deal, deals_count"),
        supabase.from("creator_offers").select("creator_id, offer_type, price, turnaround_days").eq("is_active", true),
        supabase.from("creator_platforms").select("creator_id, platform_name, subscriber_count, avg_views"),
      ]);
      if (profilesRes.data) setProfiles(profilesRes.data as ProfileRow[]);
      const oMap = new Map<string, OfferRow[]>();
      if (offersRes.data) {
        for (const row of offersRes.data) {
          const arr = oMap.get(row.creator_id) || [];
          arr.push(row as OfferRow);
          oMap.set(row.creator_id, arr);
        }
      }
      setOffersMap(oMap);
      const pMap = new Map<string, PlatformRow[]>();
      if (platformsRes.data) {
        for (const row of platformsRes.data) {
          const arr = pMap.get(row.creator_id) || [];
          arr.push(row as PlatformRow);
          pMap.set(row.creator_id, arr);
        }
      }
      setPlatformsMap(pMap);
      setLoading(false);
    };
    fetchAll();
  }, []);

  // Fetch subscriptions
  useEffect(() => {
    if (!user?.id) return;
    supabase.from("subscriptions").select("creator_id").eq("user_id", user.id).then(({ data }) => {
      if (data) setFollowedIds(new Set(data.map((s) => s.creator_id)));
    });
  }, [user?.id]);

  useEffect(() => {
    if (profiles.length === 0) return;
    const fetchCategories = async () => {
      const { data } = await supabase.from("studio_settings").select("user_id, business_category");
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((row: { user_id: string; business_category: string | null }) => {
          if (row.business_category) map[row.user_id] = row.business_category;
        });
        setBrandCategories(map);
      }
    };
    fetchCategories();
  }, [profiles]);

  const getMeta = (profile: ProfileRow): CreatorMeta => buildCreatorMeta(profile, offersMap, platformsMap);

  const toggleFollow = async (creatorId: string) => {
    if (!user?.id) return;
    const isFollowing = followedIds.has(creatorId);
    if (isFollowing) {
      await supabase.from("subscriptions").delete().eq("user_id", user.id).eq("creator_id", creatorId);
      setFollowedIds(prev => { const n = new Set(prev); n.delete(creatorId); return n; });
      toast.success("Отписка выполнена");
    } else {
      await supabase.from("subscriptions").insert({ user_id: user.id, creator_id: creatorId });
      setFollowedIds(prev => new Set(prev).add(creatorId));
      toast.success("Вы подписались!");
    }
  };

  const applyFilters = () => { setAppliedFilters({ ...filters }); setDrawerOpen(false); };
  const resetFilters = () => { setFilters({ ...defaultFilters }); setAppliedFilters({ ...defaultFilters }); };

  const removeChip = (key: string) => {
    const updater = (prev: FilterState) => {
      const next = { ...prev };
      if (key === "following") next.followingOnly = false;
      else if (key.startsWith("niche-")) next.niches = prev.niches.filter((n) => `niche-${n}` !== key);
      else if (key.startsWith("geo-")) next.geos = prev.geos.filter((g) => `geo-${g}` !== key);
      else if (key.startsWith("platform-")) next.platforms = prev.platforms.filter((p) => `platform-${p}` !== key);
      else if (key.startsWith("cat-")) next.categories = prev.categories.filter((c) => `cat-${c}` !== key);
      else if (key === "verified") next.verifiedOnly = false;
      else if (key === "reach") next.reachRange = [0, 1000000];
      return next;
    };
    setAppliedFilters(updater);
    setFilters(updater);
  };

  const handleBriefSubmit = (brief: BriefData) => {
    setActiveBrief(brief);
    setBriefOpen(false);
  };
  const clearBrief = () => setActiveBrief(null);

  const filtered = useMemo(() => {
    let result = [...profiles];
    const f = appliedFilters;
    if (f.followingOnly) result = result.filter(c => followedIds.has(c.user_id));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) =>
        c.display_name.toLowerCase().includes(q) || (c.bio || "").toLowerCase().includes(q) ||
        (c.niche || []).some((n) => n.toLowerCase().includes(q))
      );
    }
    if (f.niches.length > 0) result = result.filter((c) => (c.niche || []).some((n) => f.niches.includes(n)));
    if (f.geos.length > 0) result = result.filter((c) => c.geo && f.geos.includes(c.geo));
    if (f.categories.length > 0) result = result.filter((c) => brandCategories[c.user_id] && f.categories.includes(brandCategories[c.user_id]));
    if (f.verifiedOnly) result = result.filter((c) => c.verified);
    if (f.reachRange[0] > 0) result = result.filter((c) => (c.reach || 0) >= f.reachRange[0]);
    if (f.reachRange[1] < 1000000) result = result.filter((c) => (c.reach || 0) <= f.reachRange[1]);
    result.sort((a, b) => {
      if (sortBy === "cheapest") return (getMeta(a).minPrice || Infinity) - (getMeta(b).minPrice || Infinity);
      if (sortBy === "response") return (a.response_hours || 24) - (b.response_hours || 24);
      if (sortBy === "deals") return (b.deals_count || 0) - (a.deals_count || 0);
      if (sortBy === "audience") return (b.followers || 0) - (a.followers || 0);
      return (b.reach || 0) - (a.reach || 0);
    });
    return result;
  }, [searchQuery, appliedFilters, sortBy, profiles, brandCategories, offersMap, platformsMap, followedIds]);

  const briefResults = useMemo(() => {
    if (!activeBrief) return [];
    return profiles
      .filter((c) => matchesBrief(c, activeBrief, getMeta(c)))
      .sort((a, b) => getMatchReasons(b, activeBrief!, getMeta(b)).length - getMatchReasons(a, activeBrief!, getMeta(a)).length);
  }, [activeBrief, profiles, offersMap, platformsMap]);

  const activeChips = getActiveChips(appliedFilters);
  const filtersActive = hasActiveFilters(appliedFilters);
  const filterCount = activeChips.length;
  const showBriefResults = activeBrief !== null;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1200px] mx-auto px-4 py-4 space-y-3">
        {!isVerified && <VerificationBanner onGoToSettings={onGoToSettings} />}

        {showDrafts ? (
          <MyDraftsPanel onClose={() => setShowDrafts(false)} />
        ) : showBriefResults ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={clearBrief} className="gap-1.5 text-[13px] h-8">
                  <ArrowLeft className="h-3.5 w-3.5" />Назад к каталогу
                </Button>
                <Separator orientation="vertical" className="h-5" />
                <div>
                  <p className="text-[15px] font-semibold text-foreground flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Результаты по брифу
                  </p>
                  <p className="text-[12px] text-muted-foreground">
                    {PLACEMENT_TYPE_MAP[activeBrief.placementType]}
                    {activeBrief.budgetMax < 500000 && ` • до ${activeBrief.budgetMax.toLocaleString("ru-RU")} ₽`}
                    {activeBrief.niches.length > 0 && ` • ${activeBrief.niches.slice(0, 2).join(", ")}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-muted-foreground">
                  Найдено: <span className="font-medium text-foreground">{briefResults.length}</span>
                </span>
                <Button variant="outline" size="sm" onClick={() => { clearBrief(); setBriefOpen(true); }} className="text-[12px] h-8">
                  Изменить бриф
                </Button>
              </div>
            </div>

            {briefResults.length === 0 ? (
              <div className="text-center py-20 space-y-3">
                <p className="text-sm text-muted-foreground">Авторы не найдены по вашему брифу.</p>
                <Button variant="outline" size="sm" onClick={() => { clearBrief(); setBriefOpen(true); }}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />Изменить критерии
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {briefResults.map((creator) => (
                  <CreatorCard
                    key={creator.user_id}
                    creator={creator}
                    meta={getMeta(creator)}
                    isVerified={isVerified}
                    categoryLabel={brandCategories[creator.user_id] ? BUSINESS_CATEGORIES[brandCategories[creator.user_id]] || brandCategories[creator.user_id] : undefined}
                    matchReasons={getMatchReasons(creator, activeBrief, getMeta(creator))}
                    avgViews={avgViewsMap[creator.user_id] || null}
                    isFollowing={followedIds.has(creator.user_id)}
                    onToggleFollow={() => toggleFollow(creator.user_id)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск по имени, нише, платформе..." className="pl-9 bg-background h-10" />
              </div>
              <Button variant="outline" className="h-10 gap-1.5 shrink-0" onClick={() => setBriefOpen(true)}>
                <Sparkles className="h-4 w-4" />Подобрать по брифу
              </Button>
              <Button variant="outline" className="h-10 gap-1.5 shrink-0" onClick={() => setShowDrafts(true)}>
                <Tag className="h-4 w-4" />Черновики
              </Button>
              {/* Following quick filter */}
              <Button
                variant={appliedFilters.followingOnly ? "default" : "outline"}
                className="h-10 gap-1.5 shrink-0"
                onClick={() => {
                  const val = !appliedFilters.followingOnly;
                  setAppliedFilters(prev => ({ ...prev, followingOnly: val }));
                  setFilters(prev => ({ ...prev, followingOnly: val }));
                }}
              >
                <UserCheck className="h-4 w-4" />Подписки
              </Button>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-48 h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" className="h-10 gap-1.5 relative">
                    <Filter className="h-4 w-4" />Фильтры
                    {filterCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-semibold">
                        {filterCount}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-[340px] sm:w-[380px] flex flex-col">
                  <SheetHeader><SheetTitle>Фильтры</SheetTitle></SheetHeader>
                  <FilterDrawerContent filters={filters} setFilters={setFilters} onApply={applyFilters} onReset={resetFilters} />
                </SheetContent>
              </Sheet>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13px] text-muted-foreground">
                Найдено: <span className="font-medium text-foreground">{filtered.length}</span>
              </span>
              {activeChips.map((chip) => (
                <Badge key={chip.key} variant="secondary" className="text-[11px] gap-1 pr-1 cursor-pointer hover:bg-destructive/10"
                  onClick={() => removeChip(chip.key)}>
                  {chip.label}<X className="h-3 w-3" />
                </Badge>
              ))}
              {filtersActive && (
                <button className="text-[12px] text-primary hover:underline ml-1" onClick={resetFilters}>Сбросить все</button>
              )}
            </div>

            {loading ? (
              <div className="text-center py-20 flex flex-col items-center gap-2 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" /><span className="text-sm">Загрузка авторов...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 space-y-3">
                <p className="text-sm text-muted-foreground">Авторы не найдены по вашим критериям.</p>
                {filtersActive && (
                  <Button variant="outline" size="sm" onClick={resetFilters}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />Сбросить фильтры
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {filtered.map((creator) => (
                  <CreatorCard
                    key={creator.user_id}
                    creator={creator}
                    meta={getMeta(creator)}
                    isVerified={isVerified}
                    categoryLabel={brandCategories[creator.user_id] ? BUSINESS_CATEGORIES[brandCategories[creator.user_id]] || brandCategories[creator.user_id] : undefined}
                    avgViews={avgViewsMap[creator.user_id] || null}
                    isFollowing={followedIds.has(creator.user_id)}
                    onToggleFollow={() => toggleFollow(creator.user_id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <BriefWizard open={briefOpen} onClose={() => setBriefOpen(false)} onSubmit={handleBriefSubmit} />
    </div>
  );
}
