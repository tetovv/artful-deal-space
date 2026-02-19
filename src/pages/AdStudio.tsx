import { useState, useMemo } from "react";
import { deals, messages as allMessages, creators } from "@/data/mockData";
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";
import { useAdvertiserScores } from "@/hooks/useAdvertiserScores";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Send, Paperclip, CheckCircle2, AlertTriangle, ShieldAlert, Palette,
  Search, Star, MapPin, Users, Filter, MessageSquarePlus, Eye, Megaphone,
} from "lucide-react";
import { Deal, DealStatus } from "@/types";
import { cn } from "@/lib/utils";

const statusColors: Record<DealStatus, string> = {
  pending: "bg-warning/10 text-warning",
  briefing: "bg-info/10 text-info",
  in_progress: "bg-primary/10 text-primary",
  review: "bg-accent/10 text-accent",
  completed: "bg-success/10 text-success",
  disputed: "bg-destructive/10 text-destructive",
};

const statusLabels: Record<DealStatus, string> = {
  pending: "Ожидание",
  briefing: "Бриф",
  in_progress: "В работе",
  review: "На проверке",
  completed: "Завершено",
  disputed: "Спор",
};

const MESSAGE_COLOR_PRESETS = [
  { name: "Синий", outgoing: "210 100% 52%", incoming: "220 14% 20%" },
  { name: "Бирюзовый", outgoing: "175 80% 40%", incoming: "180 10% 18%" },
  { name: "Зелёный", outgoing: "142 70% 42%", incoming: "145 10% 18%" },
  { name: "Фиолетовый", outgoing: "270 70% 55%", incoming: "275 12% 20%" },
  { name: "Оранжевый", outgoing: "25 95% 53%", incoming: "20 10% 18%" },
  { name: "Розовый", outgoing: "330 80% 55%", incoming: "335 10% 18%" },
];

const CHAT_BG_PRESETS = [
  { name: "Стандарт", className: "bg-background" },
  { name: "Тёмный", className: "bg-[hsl(220,15%,8%)]" },
  { name: "Синий", className: "bg-gradient-to-b from-[hsl(220,30%,12%)] to-[hsl(220,20%,8%)]" },
  { name: "Зелёный", className: "bg-gradient-to-b from-[hsl(160,20%,10%)] to-[hsl(160,15%,6%)]" },
  { name: "Фиолетовый", className: "bg-gradient-to-b from-[hsl(270,20%,12%)] to-[hsl(270,15%,8%)]" },
  { name: "Тёплый", className: "bg-gradient-to-b from-[hsl(30,15%,10%)] to-[hsl(20,12%,7%)]" },
];

const NICHES = ["Образование", "Технологии", "Дизайн", "Фото", "Музыка", "Подкасты", "Бизнес", "Видео", "Motion"];
const GEOS = ["Россия", "Беларусь", "Казахстан", "Украина"];

/* ── Биржа (Marketplace) Tab ── */
function BirzhaTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNiche, setSelectedNiche] = useState<string>("all");
  const [selectedGeo, setSelectedGeo] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("rating");

  const filtered = useMemo(() => {
    let result = [...creators];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.displayName.toLowerCase().includes(q) ||
          c.bio.toLowerCase().includes(q) ||
          c.niche.some((n) => n.toLowerCase().includes(q))
      );
    }
    if (selectedNiche !== "all") {
      result = result.filter((c) => c.niche.includes(selectedNiche));
    }
    if (selectedGeo !== "all") {
      result = result.filter((c) => c.geo === selectedGeo);
    }
    result.sort((a, b) => {
      if (sortBy === "rating") return b.rating - a.rating;
      if (sortBy === "followers") return b.followers - a.followers;
      if (sortBy === "reach") return b.reach - a.reach;
      return 0;
    });
    return result;
  }, [searchQuery, selectedNiche, selectedGeo, sortBy]);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Filters */}
      <div className="p-4 border-b border-border bg-card space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
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
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Сортировка" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rating">По рейтингу</SelectItem>
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
        {filtered.map((creator) => (
          <Card key={creator.userId} className="overflow-hidden hover:border-primary/30 transition-colors">
            <CardContent className="p-4 flex items-start gap-4">
              <img
                src={creator.avatar}
                alt={creator.displayName}
                className="h-14 w-14 rounded-full bg-muted shrink-0"
              />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{creator.displayName}</p>
                  {creator.verified && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1">{creator.bio}</p>
                <div className="flex flex-wrap gap-1.5">
                  {creator.niche.map((n) => (
                    <Badge key={n} variant="secondary" className="text-[10px]">{n}</Badge>
                  ))}
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                  <span className="flex items-center gap-1">
                    <Star className="h-3 w-3 text-warning" /> {creator.rating.toFixed(1)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" /> {(creator.followers / 1000).toFixed(0)}K
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" /> {(creator.reach / 1000).toFixed(0)}K охват
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {creator.geo}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <Button size="sm" className="text-xs">
                  <MessageSquarePlus className="h-3.5 w-3.5 mr-1.5" />
                  Предложить сделку
                </Button>
                <Button size="sm" variant="outline" className="text-xs" asChild>
                  <a href={`/creator/${creator.userId}`}>
                    <Eye className="h-3.5 w-3.5 mr-1.5" />
                    Профиль
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-16 text-sm text-muted-foreground">
            Авторы не найдены. Попробуйте изменить параметры поиска.
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Deals Chat Tab ── */
function DealsTab() {
  const [selectedDeal, setSelectedDeal] = useState<Deal>(deals[0]);
  useRealtimeMessages(selectedDeal?.id);
  const dealMessages = allMessages.filter((m) => m.dealId === selectedDeal.id);
  const [newMsg, setNewMsg] = useState("");
  const { scores: advertiserScores } = useAdvertiserScores();
  const [chatColorIdx, setChatColorIdx] = useState(0);
  const [chatBgIdx, setChatBgIdx] = useState(0);

  const sortedDeals = useMemo(() => {
    return [...deals].sort((a, b) => {
      const aLow = advertiserScores.get(a.advertiserId)?.isLowScore ? 1 : 0;
      const bLow = advertiserScores.get(b.advertiserId)?.isLowScore ? 1 : 0;
      return aLow - bLow;
    });
  }, [advertiserScores]);

  const selectedAdvertiserScore = advertiserScores.get(selectedDeal.advertiserId);
  const currentColors = MESSAGE_COLOR_PRESETS[chatColorIdx];
  const currentBg = CHAT_BG_PRESETS[chatBgIdx];

  return (
    <div className="flex-1 flex">
      {/* Deals list */}
      <div className="w-72 border-r border-border bg-card overflow-y-auto shrink-0">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-foreground text-sm">Сделки</h2>
        </div>
        {sortedDeals.map((deal) => {
          const advScore = advertiserScores.get(deal.advertiserId);
          const isLow = advScore?.isLowScore;
          return (
            <div
              key={deal.id}
              onClick={() => setSelectedDeal(deal)}
              className={`p-4 border-b border-border cursor-pointer hover:bg-muted/50 transition-colors ${
                selectedDeal.id === deal.id ? "bg-muted/80" : ""
              } ${isLow ? "opacity-60" : ""}`}
            >
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-card-foreground truncate flex-1">{deal.title}</p>
                {isLow && (
                  <Tooltip>
                    <TooltipTrigger>
                      <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Низкий Partner Score ({advScore!.partnerScore.toFixed(1)})</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{deal.advertiserName} → {deal.creatorName}</p>
              <div className="flex items-center justify-between mt-2">
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${statusColors[deal.status]}`}>
                  {statusLabels[deal.status]}
                </span>
                <span className="text-[10px] text-muted-foreground">{deal.budget.toLocaleString()} ₽</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Chat + Deal details */}
      <div className="flex-1 flex flex-col">
        {/* Deal header */}
        <div className="p-4 border-b border-border bg-card">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">{selectedDeal.title}</h3>
              <p className="text-xs text-muted-foreground">{selectedDeal.description}</p>
            </div>
            <div className="flex items-center gap-2">
              {selectedAdvertiserScore?.isLowScore && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-destructive/10 text-destructive text-xs font-medium">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Partner Score: {selectedAdvertiserScore.partnerScore.toFixed(1)}
                </div>
              )}
              <span className={`text-xs font-medium px-2 py-1 rounded ${statusColors[selectedDeal.status]}`}>
                {statusLabels[selectedDeal.status]}
              </span>
              {selectedDeal.status === "in_progress" && (
                <Button size="sm" variant="outline"><CheckCircle2 className="h-3 w-3 mr-1" />Подтвердить</Button>
              )}
            </div>
          </div>

          {/* Milestones */}
          <div className="flex gap-2 mt-3">
            {selectedDeal.milestones.map((m, i) => (
              <div key={m.id} className="flex items-center gap-1.5">
                <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  m.completed ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  {m.completed ? "✓" : i + 1}
                </div>
                <span className="text-[11px] text-muted-foreground hidden lg:inline">{m.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className={cn("flex-1 overflow-y-auto p-4 space-y-4", currentBg.className)}>
          {dealMessages.map((msg) => {
            const isMe = msg.senderId === "u1";
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[70%] rounded-xl p-3 text-sm"
                  style={{
                    backgroundColor: `hsl(${isMe ? currentColors.outgoing : currentColors.incoming})`,
                    color: "white",
                  }}
                >
                  <p className="text-[10px] font-medium mb-1 opacity-70">{msg.senderName}</p>
                  <p>{msg.content}</p>
                  {msg.attachment && (
                    <div className="mt-2 flex items-center gap-1 text-[10px] opacity-70">
                      <Paperclip className="h-3 w-3" /> {msg.attachment}
                    </div>
                  )}
                  <p className="text-[10px] opacity-50 mt-1 text-right">
                    {new Date(msg.timestamp).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })}
          {dealMessages.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-12">Нет сообщений</div>
          )}
        </div>

        {/* Input + Settings */}
        <div className="p-3 border-t border-border bg-card flex gap-2 items-center">
          <Button size="icon" variant="ghost"><Paperclip className="h-4 w-4" /></Button>
          <Input
            value={newMsg}
            onChange={(e) => setNewMsg(e.target.value)}
            placeholder="Написать сообщение..."
            className="flex-1 bg-background"
          />
          <Button size="icon"><Send className="h-4 w-4" /></Button>

          {/* Chat customization */}
          <Popover>
            <PopoverTrigger asChild>
              <Button size="icon" variant="ghost" className="shrink-0">
                <Palette className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-4 space-y-4">
              <p className="text-sm font-semibold text-foreground">Оформление чата</p>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Цвет сообщений</p>
                <div className="grid grid-cols-6 gap-2">
                  {MESSAGE_COLOR_PRESETS.map((preset, i) => (
                    <Tooltip key={preset.name}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setChatColorIdx(i)}
                          className={cn(
                            "h-8 w-8 rounded-full border-2 transition-all",
                            chatColorIdx === i ? "border-foreground scale-110" : "border-transparent hover:scale-105"
                          )}
                          style={{ backgroundColor: `hsl(${preset.outgoing})` }}
                        />
                      </TooltipTrigger>
                      <TooltipContent><p className="text-xs">{preset.name}</p></TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Фон чата</p>
                <div className="grid grid-cols-3 gap-2">
                  {CHAT_BG_PRESETS.map((bg, i) => (
                    <button
                      key={bg.name}
                      onClick={() => setChatBgIdx(i)}
                      className={cn(
                        "h-12 rounded-lg border-2 transition-all text-[10px] font-medium text-muted-foreground flex items-end justify-center pb-1",
                        bg.className,
                        chatBgIdx === i ? "border-foreground" : "border-border hover:border-primary/30"
                      )}
                    >
                      {bg.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Превью</p>
                <div className={cn("rounded-lg p-3 space-y-2 border border-border", currentBg.className)}>
                  <div className="flex justify-end">
                    <div className="rounded-lg px-3 py-1.5 text-[11px] text-white" style={{ backgroundColor: `hsl(${currentColors.outgoing})` }}>
                      Привет! 👋
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="rounded-lg px-3 py-1.5 text-[11px] text-white" style={{ backgroundColor: `hsl(${currentColors.incoming})` }}>
                      Здравствуйте!
                    </div>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}

/* ── Main AdStudio Page ── */
const AdStudio = () => {
  const [activeTab, setActiveTab] = useState<"birzha" | "deals">("birzha");

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] max-h-[calc(100vh-3.5rem)]">
      {/* Tab switcher */}
      <div className="px-4 pt-3 pb-0 bg-card border-b border-border">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "birzha" | "deals")}>
          <TabsList className="bg-muted/50">
            <TabsTrigger value="birzha" className="text-sm gap-1.5">
              <Search className="h-3.5 w-3.5" />
              Биржа авторов
            </TabsTrigger>
            <TabsTrigger value="deals" className="text-sm gap-1.5">
              <Megaphone className="h-3.5 w-3.5" />
              Мои сделки
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tab content */}
      {activeTab === "birzha" ? <BirzhaTab /> : <DealsTab />}
    </div>
  );
};

export default AdStudio;
