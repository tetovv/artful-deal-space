import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdvertiserScores } from "@/hooks/useAdvertiserScores";
import { DealWorkspace } from "@/components/ad-studio/DealWorkspace";
import { useAdvertiserVerification } from "@/components/ad-studio/AdvertiserSettings";
import { AdvertiserSettings } from "@/components/ad-studio/AdvertiserSettings";
import { BuiltInAds } from "@/components/ad-studio/BuiltInAds";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CheckCircle2, AlertTriangle,
  Search, MapPin, Users, Filter, MessageSquarePlus, Eye, Megaphone, MonitorPlay, Settings, Tag, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";


const NICHES = ["Образование", "Технологии", "Дизайн", "Фото", "Музыка", "Подкасты", "Бизнес", "Видео", "Motion"];
const GEOS = ["Россия", "Беларусь", "Казахстан", "Украина"];
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

/* ── Soft-block banner ── */
function VerificationBanner({ onGoToSettings }: { onGoToSettings: () => void }) {
  return (
    <div className="mx-4 mt-4 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 flex items-center gap-3">
      <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">Пройдите верификацию</p>
        <p className="text-xs text-muted-foreground">Для связи с авторами подтвердите реквизиты ИП/ООО и подключите ОРД</p>
      </div>
      <Button size="sm" variant="outline" onClick={onGoToSettings} className="shrink-0">
        Настроить
      </Button>
    </div>
  );
}

/* ── Биржа (Marketplace) Tab ── */
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
}

function BirzhaTab({ isVerified, onGoToSettings }: { isVerified: boolean; onGoToSettings: () => void }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNiche, setSelectedNiche] = useState<string>("all");
  const [selectedGeo, setSelectedGeo] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("followers");
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [brandCategories, setBrandCategories] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchProfiles = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name, bio, avatar_url, niche, followers, reach, geo, verified");
      if (!error && data) {
        setProfiles(data as ProfileRow[]);
      }
      setLoading(false);
    };
    fetchProfiles();
  }, []);

  // Fetch brand categories for all profiles to enable filtering
  useEffect(() => {
    if (profiles.length === 0) return;
    const fetchCategories = async () => {
      const { data } = await supabase
        .from("studio_settings")
        .select("user_id, business_category");
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

  const filtered = useMemo(() => {
    let result = [...profiles];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.display_name.toLowerCase().includes(q) ||
          (c.bio || "").toLowerCase().includes(q) ||
          (c.niche || []).some((n) => n.toLowerCase().includes(q))
      );
    }
    if (selectedNiche !== "all") {
      result = result.filter((c) => (c.niche || []).includes(selectedNiche));
    }
    if (selectedGeo !== "all") {
      result = result.filter((c) => c.geo === selectedGeo);
    }
    if (selectedCategory !== "all") {
      result = result.filter((c) => brandCategories[c.user_id] === selectedCategory);
    }
    result.sort((a, b) => {
      if (sortBy === "followers") return (b.followers || 0) - (a.followers || 0);
      if (sortBy === "reach") return (b.reach || 0) - (a.reach || 0);
      return 0;
    });
    return result;
  }, [searchQuery, selectedNiche, selectedGeo, selectedCategory, sortBy, profiles, brandCategories]);

  return (
    <div className="flex-1 overflow-y-auto">
      {!isVerified && <VerificationBanner onGoToSettings={onGoToSettings} />}

      {/* Filters */}
      <div className="p-4 border-b border-border bg-card space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск авторов по имени, нише..."
              className="pl-9 bg-background"
            />
          </div>
          <Select value={selectedNiche} onValueChange={setSelectedNiche}>
            <SelectTrigger className="w-44">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Ниша" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все ниши</SelectItem>
              {NICHES.map((n) => (
                <SelectItem key={n} value={n}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedGeo} onValueChange={setSelectedGeo}>
            <SelectTrigger className="w-40">
              <MapPin className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Гео" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все регионы</SelectItem>
              {GEOS.map((g) => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-44">
              <Tag className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Категория" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все категории</SelectItem>
              {Object.entries(BUSINESS_CATEGORIES).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Сортировка" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="followers">По подписчикам</SelectItem>
              <SelectItem value="reach">По охвату</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">
          Найдено авторов: <span className="font-medium text-foreground">{filtered.length}</span>
        </p>
      </div>

      {/* Creator cards */}
      <div className="p-4 grid gap-3">
        {loading && (
          <div className="text-center py-16 flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-sm">Загрузка авторов...</span>
          </div>
        )}
        {!loading && filtered.map((creator) => (
          <Card key={creator.user_id} className="overflow-hidden hover:border-primary/30 transition-colors">
            <CardContent className="p-4 flex items-start gap-4">
              <img
                src={creator.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${creator.user_id}`}
                alt={creator.display_name}
                className="h-14 w-14 rounded-full bg-muted shrink-0"
              />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{creator.display_name}</p>
                  {creator.verified && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1">{creator.bio || "Нет описания"}</p>
                <div className="flex flex-wrap gap-1.5">
                  {(creator.niche || []).map((n) => (
                    <Badge key={n} variant="secondary" className="text-[10px]">{n}</Badge>
                  ))}
                  {brandCategories[creator.user_id] && (
                    <Badge variant="outline" className="text-[10px]">
                      {BUSINESS_CATEGORIES[brandCategories[creator.user_id]] || brandCategories[creator.user_id]}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" /> {((creator.followers || 0) / 1000).toFixed(0)}K
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" /> {((creator.reach || 0) / 1000).toFixed(0)}K охват
                  </span>
                  {creator.geo && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {creator.geo}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button size="sm" className="text-xs" disabled={!isVerified}>
                        <MessageSquarePlus className="h-3.5 w-3.5 mr-1.5" />
                        Предложить сделку
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!isVerified && (
                    <TooltipContent><p className="text-xs">Пройдите верификацию в Настройках</p></TooltipContent>
                  )}
                </Tooltip>
                <Button size="sm" variant="outline" className="text-xs" asChild>
                  <a href={`/creator/${creator.user_id}`}>
                    <Eye className="h-3.5 w-3.5 mr-1.5" />
                    Профиль
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-16 text-sm text-muted-foreground">
            Авторы не найдены. Попробуйте изменить параметры поиска.
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Deals Tab — now uses DealWorkspace ── */

/* ── Main AdStudio Page ── */
type AdStudioTab = "birzha" | "deals" | "builtin" | "settings";

const AdStudio = () => {
  const [activeTab, setActiveTab] = useState<AdStudioTab>("birzha");
  const { isVerified } = useAdvertiserVerification();

  const goToSettings = () => setActiveTab("settings");

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] max-h-[calc(100vh-3.5rem)]">
      {/* Tab switcher */}
      <div className="px-4 pt-3 pb-0 bg-card border-b border-border">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AdStudioTab)}>
          <TabsList className="bg-muted/50">
            <TabsTrigger value="birzha" className="text-sm gap-1.5">
              <Search className="h-3.5 w-3.5" />
              Биржа авторов
            </TabsTrigger>
            <TabsTrigger value="deals" className="text-sm gap-1.5">
              <Megaphone className="h-3.5 w-3.5" />
              Мои сделки
            </TabsTrigger>
            <TabsTrigger value="builtin" className="text-sm gap-1.5">
              <MonitorPlay className="h-3.5 w-3.5" />
              Встроенная реклама
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-sm gap-1.5 relative">
              <Settings className="h-3.5 w-3.5" />
              Настройки
              {!isVerified && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-yellow-500" />
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tab content */}
      {activeTab === "birzha" && <BirzhaTab isVerified={isVerified} onGoToSettings={goToSettings} />}
      {activeTab === "deals" && <DealWorkspace />}
      {activeTab === "builtin" && <BuiltInAds isVerified={isVerified} onGoToSettings={goToSettings} />}
      {activeTab === "settings" && <AdvertiserSettings />}
    </div>
  );
};

export default AdStudio;
