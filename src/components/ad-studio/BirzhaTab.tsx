import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle2, AlertTriangle,
  Search, MapPin, Users, Filter, MessageSquarePlus, Eye, Star, X, Loader2, RotateCcw, Globe, Clock,
  Handshake,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NICHES = ["Образование", "Технологии", "Дизайн", "Фото", "Музыка", "Подкасты", "Бизнес", "Видео", "Motion"];
const GEOS = ["Россия", "Беларусь", "Казахстан", "Украина"];
const PLATFORMS = ["Telegram", "YouTube", "Instagram", "VK", "TikTok"];
const FORMATS = ["Пост", "Сторис", "Интеграция", "Баннер", "Обзор", "Подкаст"];
const BUSINESS_CATEGORIES: Record<string, string> = {
  ecommerce: "E-commerce",
  saas: "SaaS / IT",
  finance: "Финансы",
  education: "Образование",
  health: "Здоровье",
  food: "Еда / FMCG",
  fashion: "Мода / Красота",
  travel: "Путешествия",
  entertainment: "Развлечения",
  realty: "Недвижимость",
  auto: "Авто",
  other: "Другое",
};

const SORT_OPTIONS = [
  { value: "recommended", label: "Рекомендовано" },
  { value: "followers", label: "По охвату" },
  { value: "rating", label: "По рейтингу" },
  { value: "deals", label: "По сделкам" },
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
  rating: number | null;
}

interface FilterState {
  niches: string[];
  geos: string[];
  platforms: string[];
  formats: string[];
  categories: string[];
  verifiedOnly: boolean;
  reachRange: [number, number];
}

const defaultFilters: FilterState = {
  niches: [],
  geos: [],
  platforms: [],
  formats: [],
  categories: [],
  verifiedOnly: false,
  reachRange: [0, 1000000],
};

function hasActiveFilters(f: FilterState): boolean {
  return (
    f.niches.length > 0 ||
    f.geos.length > 0 ||
    f.platforms.length > 0 ||
    f.formats.length > 0 ||
    f.categories.length > 0 ||
    f.verifiedOnly ||
    f.reachRange[0] > 0 ||
    f.reachRange[1] < 1000000
  );
}

function getActiveChips(f: FilterState): { key: string; label: string }[] {
  const chips: { key: string; label: string }[] = [];
  f.niches.forEach((n) => chips.push({ key: `niche-${n}`, label: n }));
  f.geos.forEach((g) => chips.push({ key: `geo-${g}`, label: g }));
  f.platforms.forEach((p) => chips.push({ key: `platform-${p}`, label: p }));
  f.formats.forEach((fm) => chips.push({ key: `format-${fm}`, label: fm }));
  f.categories.forEach((c) => chips.push({ key: `cat-${c}`, label: BUSINESS_CATEGORIES[c] || c }));
  if (f.verifiedOnly) chips.push({ key: "verified", label: "Верифицированные" });
  if (f.reachRange[0] > 0 || f.reachRange[1] < 1000000) {
    chips.push({ key: "reach", label: `Охват ${(f.reachRange[0] / 1000).toFixed(0)}K–${(f.reachRange[1] / 1000).toFixed(0)}K` });
  }
  return chips;
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
      <Button size="sm" variant="outline" onClick={onGoToSettings} className="shrink-0">
        Настроить
      </Button>
    </div>
  );
}

/* ── Filter Drawer Content ── */
function FilterDrawerContent({
  filters,
  setFilters,
  onApply,
  onReset,
}: {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  onApply: () => void;
  onReset: () => void;
}) {
  const toggle = (field: keyof FilterState, value: string) => {
    setFilters((prev) => {
      const arr = prev[field] as string[];
      return {
        ...prev,
        [field]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      };
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
            {NICHES.map((n) => (
              <CheckItem key={n} label={n} checked={filters.niches.includes(n)} onChange={() => toggle("niches", n)} />
            ))}
          </Section>
          <Separator />
          <Section title="Регион">
            {GEOS.map((g) => (
              <CheckItem key={g} label={g} checked={filters.geos.includes(g)} onChange={() => toggle("geos", g)} />
            ))}
          </Section>
          <Separator />
          <Section title="Платформы">
            {PLATFORMS.map((p) => (
              <CheckItem key={p} label={p} checked={filters.platforms.includes(p)} onChange={() => toggle("platforms", p)} />
            ))}
          </Section>
          <Separator />
          <Section title="Форматы">
            {FORMATS.map((f) => (
              <CheckItem key={f} label={f} checked={filters.formats.includes(f)} onChange={() => toggle("formats", f)} />
            ))}
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
              <Slider
                min={0}
                max={1000000}
                step={10000}
                value={filters.reachRange}
                onValueChange={(v) => setFilters((prev) => ({ ...prev, reachRange: v as [number, number] }))}
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
                <span>{(filters.reachRange[0] / 1000).toFixed(0)}K</span>
                <span>{filters.reachRange[1] >= 1000000 ? "1M+" : `${(filters.reachRange[1] / 1000).toFixed(0)}K`}</span>
              </div>
            </div>
          </Section>
          <Separator />
          <Section title="Доверие">
            <CheckItem
              label="Только верифицированные"
              checked={filters.verifiedOnly}
              onChange={() => setFilters((prev) => ({ ...prev, verifiedOnly: !prev.verifiedOnly }))}
            />
          </Section>
        </div>
      </ScrollArea>
      <div className="flex gap-2 pt-3 border-t border-border">
        <Button variant="outline" className="flex-1" onClick={onReset}>
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Сбросить
        </Button>
        <Button className="flex-1" onClick={onApply}>
          Применить
        </Button>
      </div>
    </div>
  );
}

/* ── Creator Card ── */
function CreatorCard({
  creator,
  isVerified,
  categoryLabel,
}: {
  creator: ProfileRow;
  isVerified: boolean;
  categoryLabel?: string;
}) {
  const fmt = (n: number | null) => {
    if (!n || n === 0) return null;
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
    return String(n);
  };

  const reachStr = fmt(creator.reach);
  const followersStr = fmt(creator.followers);
  const hasMetrics = reachStr || followersStr;

  return (
    <Card className="overflow-hidden hover:border-primary/30 transition-colors group">
      <CardContent className="p-4 space-y-3">
        {/* Row 1: Avatar + Name + Fav */}
        <div className="flex items-start gap-3">
          <img
            src={creator.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${creator.user_id}`}
            alt={creator.display_name}
            className="h-11 w-11 rounded-full bg-muted shrink-0 object-cover"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[15px] font-semibold text-foreground truncate">{creator.display_name}</p>
              {creator.verified && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
            </div>
            <p className="text-[13px] text-muted-foreground line-clamp-1 mt-0.5">
              {creator.bio || "Автор на платформе"}
            </p>
          </div>
          <button className="p-1.5 rounded-md hover:bg-muted transition-colors opacity-0 group-hover:opacity-100" title="В избранное">
            <Star className="h-4 w-4 text-muted-foreground hover:text-warning" />
          </button>
        </div>

        {/* Row 2: Tags */}
        <div className="flex flex-wrap gap-1">
          {(creator.niche || []).slice(0, 3).map((n) => (
            <Badge key={n} variant="secondary" className="text-[11px] px-2 py-0">{n}</Badge>
          ))}
          {categoryLabel && (
            <Badge variant="outline" className="text-[11px] px-2 py-0">{categoryLabel}</Badge>
          )}
        </div>

        {/* Row 3: Metrics */}
        <div className="flex items-center gap-4 text-[13px] text-muted-foreground">
          {followersStr && (
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> {followersStr}
            </span>
          )}
          {reachStr && (
            <span className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" /> {reachStr} охват
            </span>
          )}
          {creator.geo && (
            <span className="flex items-center gap-1">
              <Globe className="h-3.5 w-3.5" /> {creator.geo}
            </span>
          )}
          {creator.rating && creator.rating > 0 && (
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-warning text-warning" /> {Number(creator.rating).toFixed(1)}
            </span>
          )}
          {!hasMetrics && (
            <span className="text-muted-foreground/60 italic">Статистика не подключена</span>
          )}
        </div>

        {/* Row 4: Price hint + Actions */}
        <div className="flex items-center justify-between pt-1 border-t border-border/50">
          <span className="text-[13px] text-muted-foreground">Цена по запросу</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="text-xs h-8 px-2.5" asChild>
              <a href={`/creator/${creator.user_id}`}>Профиль</a>
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button size="sm" className="text-xs h-8" disabled={!isVerified}>
                    <MessageSquarePlus className="h-3.5 w-3.5 mr-1" />
                    Предложить сделку
                  </Button>
                </span>
              </TooltipTrigger>
              {!isVerified && (
                <TooltipContent><p className="text-xs">Пройдите верификацию</p></TooltipContent>
              )}
            </Tooltip>
          </div>
        </div>
      </CardContent>
    </Card>
  );
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

  useEffect(() => {
    const fetchProfiles = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name, bio, avatar_url, niche, followers, reach, geo, verified, rating");
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

  const applyFilters = () => {
    setAppliedFilters({ ...filters });
    setDrawerOpen(false);
  };

  const resetFilters = () => {
    setFilters({ ...defaultFilters });
    setAppliedFilters({ ...defaultFilters });
  };

  const removeChip = (key: string) => {
    setAppliedFilters((prev) => {
      const next = { ...prev };
      if (key.startsWith("niche-")) next.niches = prev.niches.filter((n) => `niche-${n}` !== key);
      else if (key.startsWith("geo-")) next.geos = prev.geos.filter((g) => `geo-${g}` !== key);
      else if (key.startsWith("platform-")) next.platforms = prev.platforms.filter((p) => `platform-${p}` !== key);
      else if (key.startsWith("format-")) next.formats = prev.formats.filter((f) => `format-${f}` !== key);
      else if (key.startsWith("cat-")) next.categories = prev.categories.filter((c) => `cat-${c}` !== key);
      else if (key === "verified") next.verifiedOnly = false;
      else if (key === "reach") next.reachRange = [0, 1000000];
      return next;
    });
    setFilters((prev) => {
      const next = { ...prev };
      if (key.startsWith("niche-")) next.niches = prev.niches.filter((n) => `niche-${n}` !== key);
      else if (key.startsWith("geo-")) next.geos = prev.geos.filter((g) => `geo-${g}` !== key);
      else if (key.startsWith("platform-")) next.platforms = prev.platforms.filter((p) => `platform-${p}` !== key);
      else if (key.startsWith("format-")) next.formats = prev.formats.filter((f) => `format-${f}` !== key);
      else if (key.startsWith("cat-")) next.categories = prev.categories.filter((c) => `cat-${c}` !== key);
      else if (key === "verified") next.verifiedOnly = false;
      else if (key === "reach") next.reachRange = [0, 1000000];
      return next;
    });
  };

  const filtered = useMemo(() => {
    let result = [...profiles];
    const f = appliedFilters;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.display_name.toLowerCase().includes(q) ||
          (c.bio || "").toLowerCase().includes(q) ||
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
      if (sortBy === "followers") return (b.followers || 0) - (a.followers || 0);
      if (sortBy === "rating") return (Number(b.rating) || 0) - (Number(a.rating) || 0);
      return (b.reach || 0) - (a.reach || 0);
    });
    return result;
  }, [searchQuery, appliedFilters, sortBy, profiles, brandCategories]);

  const activeChips = getActiveChips(appliedFilters);
  const filtersActive = hasActiveFilters(appliedFilters);
  const filterCount = activeChips.length;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1200px] mx-auto px-4 py-4 space-y-4">
        {/* Verification banner */}
        {!isVerified && <VerificationBanner onGoToSettings={onGoToSettings} />}

        {/* Search bar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по имени, нише, платформе..."
              className="pl-9 bg-background h-10"
            />
          </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-48 h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="h-10 gap-1.5 relative">
                <Filter className="h-4 w-4" />
                Фильтры
                {filterCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-semibold">
                    {filterCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[340px] sm:w-[380px] flex flex-col">
              <SheetHeader>
                <SheetTitle>Фильтры</SheetTitle>
              </SheetHeader>
              <FilterDrawerContent
                filters={filters}
                setFilters={setFilters}
                onApply={applyFilters}
                onReset={resetFilters}
              />
            </SheetContent>
          </Sheet>
        </div>

        {/* Result count + filter chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] text-muted-foreground">
            Найдено: <span className="font-medium text-foreground">{filtered.length}</span>
          </span>
          {activeChips.map((chip) => (
            <Badge
              key={chip.key}
              variant="secondary"
              className="text-[11px] gap-1 pr-1 cursor-pointer hover:bg-destructive/10"
              onClick={() => removeChip(chip.key)}
            >
              {chip.label}
              <X className="h-3 w-3" />
            </Badge>
          ))}
          {filtersActive && (
            <button className="text-[12px] text-primary hover:underline ml-1" onClick={resetFilters}>
              Сбросить все
            </button>
          )}
        </div>

        {/* Creator grid */}
        {loading ? (
          <div className="text-center py-20 flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-sm">Загрузка авторов...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <p className="text-sm text-muted-foreground">Авторы не найдены по вашим критериям.</p>
            {filtersActive && (
              <Button variant="outline" size="sm" onClick={resetFilters}>
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Сбросить фильтры
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {filtered.map((creator) => (
              <CreatorCard
                key={creator.user_id}
                creator={creator}
                isVerified={isVerified}
                categoryLabel={
                  brandCategories[creator.user_id]
                    ? BUSINESS_CATEGORIES[brandCategories[creator.user_id]] || brandCategories[creator.user_id]
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
