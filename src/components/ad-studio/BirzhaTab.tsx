import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  Handshake, Zap, ExternalLink, ShieldCheck, Tag, Lock, Sparkles, ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BriefWizard, type BriefData } from "./BriefWizard";
import { DealProposalForm } from "./DealProposalForm";

const NICHES = ["Образование", "Технологии", "Дизайн", "Фото", "Музыка", "Подкасты", "Бизнес", "Видео", "Motion"];
const GEOS = ["Россия", "Беларусь", "Казахстан", "Украина"];
const PLATFORMS = ["Telegram", "YouTube", "Instagram", "VK", "TikTok"];
const OFFER_TYPES = ["Видео-интеграция", "Пост", "Подкаст"] as const;
const BUSINESS_CATEGORIES: Record<string, string> = {
  ecommerce: "E-commerce", saas: "SaaS / IT", finance: "Финансы", education: "Образование",
  health: "Здоровье", food: "Еда / FMCG", fashion: "Мода / Красота", travel: "Путешествия",
  entertainment: "Развлечения", realty: "Недвижимость", auto: "Авто", other: "Другое",
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
}

interface FilterState {
  niches: string[];
  geos: string[];
  platforms: string[];
  categories: string[];
  verifiedOnly: boolean;
  reachRange: [number, number];
}

const defaultFilters: FilterState = {
  niches: [], geos: [], platforms: [], categories: [],
  verifiedOnly: false, reachRange: [0, 1000000],
};

function hasActiveFilters(f: FilterState): boolean {
  return f.niches.length > 0 || f.geos.length > 0 || f.platforms.length > 0 ||
    f.categories.length > 0 || f.verifiedOnly || f.reachRange[0] > 0 || f.reachRange[1] < 1000000;
}

function getActiveChips(f: FilterState): { key: string; label: string }[] {
  const chips: { key: string; label: string }[] = [];
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

// Simulated data helpers (would come from DB in production)
function getCreatorMeta(userId: string) {
  const hash = userId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const responseHours = [2, 4, 6, 8, 12, 24][(hash) % 6];
  const dealsCount = (hash % 20);
  const safeDeal = hash % 3 !== 0;

  // Only 3 offer types: Video integration, Post, Podcast
  const offers: { type: string; price: number; turnaroundDays: number }[] = [];
  const priceBase = [5000, 10000, 15000, 25000, 50000][(hash) % 5];
  if (hash % 3 !== 0) offers.push({ type: "Видео-интеграция", price: priceBase, turnaroundDays: [5, 7, 10, 14][(hash) % 4] });
  if (hash % 4 !== 0) offers.push({ type: "Пост", price: Math.round(priceBase * 0.4), turnaroundDays: [1, 2, 3, 5][(hash) % 4] });
  if (hash % 5 === 0) offers.push({ type: "Подкаст", price: Math.round(priceBase * 0.7), turnaroundDays: [7, 10, 14][(hash) % 3] });

  const minPrice = offers.length > 0 ? Math.min(...offers.map((o) => o.price)) : null;

  const platforms: { name: string; metric: string }[] = [];
  if (hash % 3 !== 0) platforms.push({ name: "TG", metric: fmt(((hash * 137) % 50000) + 1000) || "1K" });
  if (hash % 4 !== 0) platforms.push({ name: "YT", metric: fmt(((hash * 89) % 100000) + 500) || "500" });
  if (hash % 5 === 0) platforms.push({ name: "Подкаст", metric: fmt(((hash * 53) % 30000) + 2000) || "2K" });

  return { responseHours, dealsCount, safeDeal, offers, minPrice, platforms: platforms.slice(0, 3) };
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
function QuickViewModal({ creator, open, onClose, isVerified, categoryLabel, onPropose }: {
  creator: ProfileRow; open: boolean; onClose: () => void; isVerified: boolean; categoryLabel?: string;
  onPropose: () => void;
}) {
  const meta = getCreatorMeta(creator.user_id);

  // Build metrics that have data
  const metrics: { icon: React.ReactNode; label: string; value: string }[] = [];
  const tgPlatform = meta.platforms.find((p) => p.name === "TG");
  const ytPlatform = meta.platforms.find((p) => p.name === "YT");
  if (tgPlatform) metrics.push({ icon: <Users className="h-4 w-4" />, label: "TG подписчики", value: tgPlatform.metric });
  if (ytPlatform) metrics.push({ icon: <Eye className="h-4 w-4" />, label: "YT avg views", value: ytPlatform.metric });
  if (meta.dealsCount > 0) metrics.push({ icon: <Handshake className="h-4 w-4" />, label: "Сделки завершены", value: String(meta.dealsCount) });
  if (meta.responseHours > 0) metrics.push({ icon: <Clock className="h-4 w-4" />, label: "Среднее время ответа", value: `~${meta.responseHours} ч` });

  // Turnaround from offer data
  const turnaroundMap = new Map<string, string>();
  for (const o of meta.offers) {
    turnaroundMap.set(o.type, `${o.turnaroundDays} дн`);
  }

  // Best fit line from niches
  const niches = (creator.niche || []).slice(0, 4);
  const bestFitLine = niches.length > 0 ? `Подходит для: ${niches.join(" / ")}` : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[760px]">
        {/* 1) Header */}
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
          {/* 2) Metrics grid — only cells with data */}
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

          {/* 3) Offers preview — Video / Post / Podcast only */}
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

          {/* 4) Best fit line */}
          {bestFitLine && (
            <p className="text-[13px] text-muted-foreground italic">{bestFitLine}</p>
          )}

          {/* Footer actions */}
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

function MetricCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null }) {
  return (
    <div className="flex items-center gap-2 bg-muted/30 rounded-md px-2.5 py-1.5">
      <span className="text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
        <p className="text-sm font-medium text-foreground leading-tight">{value || "—"}</p>
      </div>
    </div>
  );
}

/* ── Creator Card ── */
function CreatorCard({ creator, isVerified, categoryLabel, matchReasons }: {
  creator: ProfileRow; isVerified: boolean; categoryLabel?: string; matchReasons?: string[];
}) {
  const [quickView, setQuickView] = useState(false);
  const [proposalOpen, setProposalOpen] = useState(false);
  const meta = getCreatorMeta(creator.user_id);
  const hasNiche = (creator.niche || []).length > 0;

  return (
    <>
      <Card className="overflow-hidden hover:border-primary/30 transition-colors group">
        <CardContent className="p-3.5 space-y-2.5">
          {/* Header: Avatar + Name + Response time */}
          <div className="flex items-start gap-3">
            <img
              src={creator.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${creator.user_id}`}
              alt={creator.display_name}
              className="h-10 w-10 rounded-full bg-muted shrink-0 object-cover"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-[16px] font-semibold text-foreground truncate leading-tight">{creator.display_name}</p>
                {creator.verified && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
              </div>
              {creator.bio && (
                <p className="text-[13px] text-muted-foreground line-clamp-1">{creator.bio}</p>
              )}
            </div>
            {meta.responseHours > 0 && (
              <span className="text-[11px] text-muted-foreground whitespace-nowrap flex items-center gap-1 shrink-0">
                <Clock className="h-3 w-3" />~{meta.responseHours}ч
              </span>
            )}
          </div>

          {/* Badges: Safe deal + Platform-only + niche tags */}
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 gap-0.5 border-primary/40 text-primary">
              <Lock className="h-2.5 w-2.5" />Platform-only
            </Badge>
            {meta.safeDeal && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 gap-0.5 border-green-500/40 text-green-400">
                <ShieldCheck className="h-2.5 w-2.5" />Safe deal
              </Badge>
            )}
            {hasNiche && (creator.niche || []).slice(0, 3).map((n) => (
              <Badge key={n} variant="secondary" className="text-[11px] px-1.5 py-0 h-5">{n}</Badge>
            ))}
            {categoryLabel && <Badge variant="outline" className="text-[11px] px-1.5 py-0 h-5">{categoryLabel}</Badge>}
          </div>

          {/* Platforms mini-row */}
          {meta.platforms.length > 0 ? (
            <div className="flex gap-2">
              {meta.platforms.map((p) => (
                <span key={p.name} className="inline-flex items-center gap-1 text-[12px] bg-muted/50 rounded px-1.5 py-0.5">
                  <span className="font-semibold text-foreground">{p.name}</span>
                  <span className="text-muted-foreground">{p.metric}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-muted-foreground/60 italic">Аналитика не подключена</p>
          )}

          {/* Offers row (only Video / Post / Podcast) */}
          {meta.offers.length > 0 ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
              {meta.offers.map((o) => (
                <span key={o.type} className="text-foreground">
                  <span className="text-muted-foreground">{o.type}:</span>{" "}
                  <span className="font-medium">от {o.price.toLocaleString("ru-RU")} ₽</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">Цена по запросу</p>
          )}

          {/* Reliability signals (no rating) */}
          {(meta.dealsCount > 0 || meta.responseHours > 0) && (
            <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
              {meta.dealsCount > 0 && (
                <span className="flex items-center gap-1"><Handshake className="h-3 w-3" />Сделки: {meta.dealsCount}</span>
              )}
            </div>
          )}

          {/* Match reasons (brief results mode) */}
          {matchReasons && matchReasons.length > 0 && (
            <div className="bg-primary/5 border border-primary/20 rounded-md px-3 py-2 space-y-0.5">
              {matchReasons.map((reason, i) => (
                <p key={i} className="text-[12px] text-primary flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 shrink-0" />{reason}
                </p>
              ))}
            </div>
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-between pt-1.5 border-t border-border/50">
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="ghost" className="text-[12px] h-7 px-2" asChild>
                <a href={`/creator/${creator.user_id}`}>Профиль</a>
              </Button>
              <Button size="sm" variant="ghost" className="text-[12px] h-7 px-2" onClick={() => setQuickView(true)}>
                <Eye className="h-3 w-3 mr-1" />Быстрый просмотр
              </Button>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button size="sm" className="text-[12px] h-7" disabled={!isVerified} onClick={() => setProposalOpen(true)}>
                    <MessageSquarePlus className="h-3.5 w-3.5 mr-1" />Предложить сделку
                  </Button>
                </span>
              </TooltipTrigger>
              {!isVerified && <TooltipContent><p className="text-xs">Пройдите верификацию</p></TooltipContent>}
            </Tooltip>
          </div>
        </CardContent>
      </Card>

      <QuickViewModal creator={creator} open={quickView} onClose={() => setQuickView(false)}
        isVerified={isVerified} categoryLabel={categoryLabel} onPropose={() => setProposalOpen(true)} />

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

function getMatchReasons(creator: ProfileRow, brief: BriefData): string[] {
  const meta = getCreatorMeta(creator.user_id);
  const reasons: string[] = [];
  const targetType = PLACEMENT_TYPE_MAP[brief.placementType];

  // Check if creator has the requested offer type within budget
  const matchingOffer = meta.offers.find((o) => o.type === targetType);
  if (matchingOffer) {
    if (brief.budgetMax > 0 && matchingOffer.price <= brief.budgetMax) {
      reasons.push(`${targetType} в рамках бюджета (от ${matchingOffer.price.toLocaleString("ru-RU")} ₽)`);
    } else {
      reasons.push(`Предлагает ${targetType}`);
    }
  }

  // Niche match
  if (brief.niches.length > 0) {
    const matching = (creator.niche || []).filter((n) => brief.niches.includes(n));
    if (matching.length > 0) reasons.push(`Ниша совпадает: ${matching.slice(0, 2).join(", ")}`);
  }

  // Geo match
  if (brief.geos.length > 0 && creator.geo && brief.geos.includes(creator.geo)) {
    reasons.push(`Регион: ${creator.geo}`);
  }

  // Response time match
  if (brief.turnaroundDays > 0 && meta.responseHours <= brief.turnaroundDays * 24) {
    if (meta.responseHours <= 12) reasons.push(`Быстрый ответ (~${meta.responseHours} ч)`);
  }

  return reasons.slice(0, 2); // max 2 reasons
}

function matchesBrief(creator: ProfileRow, brief: BriefData): boolean {
  const meta = getCreatorMeta(creator.user_id);
  const targetType = PLACEMENT_TYPE_MAP[brief.placementType];

  // Must have the requested offer type
  const hasOffer = meta.offers.some((o) => o.type === targetType);
  if (!hasOffer && meta.offers.length > 0) return false; // has offers but not the right type — skip
  // If no offers at all, still include (price on request)

  // Budget filter
  if (brief.budgetMax > 0 && brief.budgetMax < 500000) {
    const matchingOffer = meta.offers.find((o) => o.type === targetType);
    if (matchingOffer && matchingOffer.price > brief.budgetMax) return false;
  }

  // Niche filter
  if (brief.niches.length > 0) {
    const match = (creator.niche || []).some((n) => brief.niches.includes(n));
    if (!match) return false;
  }

  // Geo filter
  if (brief.geos.length > 0) {
    if (!creator.geo || !brief.geos.includes(creator.geo)) return false;
  }

  // Audience size
  if (brief.audienceMin > 0 && (creator.followers || 0) < brief.audienceMin) return false;
  if (brief.audienceMax < 1000000 && (creator.followers || 0) > brief.audienceMax) return false;

  // Exclude no analytics
  if (brief.excludeNoAnalytics && meta.platforms.length === 0) return false;

  return true;
}

/* ── Main BirzhaTab ── */
export function BirzhaTab({ isVerified, onGoToSettings }: { isVerified: boolean; onGoToSettings: () => void }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("recommended");
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [brandCategories, setBrandCategories] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState<FilterState>({ ...defaultFilters });
  const [appliedFilters, setAppliedFilters] = useState<FilterState>({ ...defaultFilters });
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Brief wizard state
  const [briefOpen, setBriefOpen] = useState(false);
  const [activeBrief, setActiveBrief] = useState<BriefData | null>(null);

  useEffect(() => {
    const fetchProfiles = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name, bio, avatar_url, niche, followers, reach, geo, verified, content_count");
      if (!error && data) setProfiles(data as ProfileRow[]);
      setLoading(false);
    };
    fetchProfiles();
  }, []);

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

  const applyFilters = () => { setAppliedFilters({ ...filters }); setDrawerOpen(false); };
  const resetFilters = () => { setFilters({ ...defaultFilters }); setAppliedFilters({ ...defaultFilters }); };

  const removeChip = (key: string) => {
    const updater = (prev: FilterState) => {
      const next = { ...prev };
      if (key.startsWith("niche-")) next.niches = prev.niches.filter((n) => `niche-${n}` !== key);
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

  // Normal filtered list
  const filtered = useMemo(() => {
    let result = [...profiles];
    const f = appliedFilters;
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
      if (sortBy === "cheapest") {
        const pa = getCreatorMeta(a.user_id).minPrice || Infinity;
        const pb = getCreatorMeta(b.user_id).minPrice || Infinity;
        return pa - pb;
      }
      if (sortBy === "response") {
        return getCreatorMeta(a.user_id).responseHours - getCreatorMeta(b.user_id).responseHours;
      }
      if (sortBy === "deals") {
        return getCreatorMeta(b.user_id).dealsCount - getCreatorMeta(a.user_id).dealsCount;
      }
      if (sortBy === "audience") {
        return (b.followers || 0) - (a.followers || 0);
      }
      return (b.reach || 0) - (a.reach || 0);
    });
    return result;
  }, [searchQuery, appliedFilters, sortBy, profiles, brandCategories]);

  // Brief-matched list
  const briefResults = useMemo(() => {
    if (!activeBrief) return [];
    return profiles
      .filter((c) => matchesBrief(c, activeBrief))
      .sort((a, b) => {
        // Sort by number of match reasons (most relevant first)
        return getMatchReasons(b, activeBrief!).length - getMatchReasons(a, activeBrief!).length;
      });
  }, [activeBrief, profiles]);

  const activeChips = getActiveChips(appliedFilters);
  const filtersActive = hasActiveFilters(appliedFilters);
  const filterCount = activeChips.length;

  const showBriefResults = activeBrief !== null;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1200px] mx-auto px-4 py-4 space-y-3">
        {!isVerified && <VerificationBanner onGoToSettings={onGoToSettings} />}

        {/* Brief results header */}
        {showBriefResults ? (
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

            {/* Brief results grid */}
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
                    isVerified={isVerified}
                    categoryLabel={brandCategories[creator.user_id] ? BUSINESS_CATEGORIES[brandCategories[creator.user_id]] || brandCategories[creator.user_id] : undefined}
                    matchReasons={getMatchReasons(creator, activeBrief)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Search bar */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск по имени, нише, платформе..." className="pl-9 bg-background h-10" />
              </div>
              <Button variant="outline" className="h-10 gap-1.5 shrink-0" onClick={() => setBriefOpen(true)}>
                <Sparkles className="h-4 w-4" />Подобрать по брифу
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

            {/* Result count + chips */}
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

            {/* Grid */}
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
                  <CreatorCard key={creator.user_id} creator={creator} isVerified={isVerified}
                    categoryLabel={brandCategories[creator.user_id] ? BUSINESS_CATEGORIES[brandCategories[creator.user_id]] || brandCategories[creator.user_id] : undefined} />
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
