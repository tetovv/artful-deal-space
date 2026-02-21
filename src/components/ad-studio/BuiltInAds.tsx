import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Plus, BarChart3, Eye, MousePointerClick, TrendingUp, AlertTriangle, Search,
  ChevronDown, CheckCircle2, ShieldCheck, Landmark, MoreVertical, Pause, Play,
  Copy, Archive, Settings, CalendarDays, HelpCircle, ArrowUpDown, FileEdit, Trash2,
} from "lucide-react";
import { CampaignManageView } from "./CampaignManageView";
import type { Campaign, CampaignStatus, Placement } from "./CampaignManageView";
import { ContractImportWizard } from "./ContractImportWizard";
import { ManualCampaignWizard } from "./ManualCampaignWizard";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileText } from "lucide-react";
import { loadDrafts, deleteDraft, type CampaignDraft } from "./campaignDrafts";
import { toast } from "sonner";

interface BuiltInAdsProps {
  isVerified: boolean;
  onGoToSettings: () => void;
}

type DateRange = "today" | "7d" | "30d" | "custom";

const placementLabels: Record<Placement, string> = {
  banner: "Баннер в каталоге",
  feed: "Промо в ленте подписок",
  recommendations: "Рекомендации — карточка",
};

const statusLabels: Record<CampaignStatus, string> = {
  active: "Активна",
  paused: "Пауза",
  draft: "Черновик",
  completed: "Завершена",
  error: "Ошибка",
  finalizing: "Завершение…",
  ord_error: "Ошибка ОРД",
};

const statusStyles: Record<CampaignStatus, string> = {
  active: "bg-success/15 text-success border-success/30",
  paused: "bg-warning/15 text-warning border-warning/30",
  draft: "bg-muted text-muted-foreground border-muted-foreground/20",
  completed: "bg-primary/15 text-primary border-primary/30",
  error: "bg-destructive/15 text-destructive border-destructive/30",
  finalizing: "bg-warning/15 text-warning border-warning/30",
  ord_error: "bg-destructive/15 text-destructive border-destructive/30",
};

const dateRangeLabels: Record<DateRange, string> = {
  today: "Сегодня",
  "7d": "7 дней",
  "30d": "30 дней",
  custom: "Период",
};

const mockCampaigns: Campaign[] = [
  { id: 1, name: "Весенняя распродажа", placement: "banner", status: "active", impressions: 12400, clicks: 340, ctr: 2.7, budget: 15000, spent: 4800, startDate: "2026-02-01", endDate: "2026-03-01" },
  { id: 2, name: "Подписки — новинки", placement: "feed", status: "paused", impressions: 8200, clicks: 190, ctr: 2.3, budget: 10000, spent: 7200, startDate: "2026-01-15", endDate: "2026-02-15" },
  { id: 3, name: "Рекомендации IT", placement: "recommendations", status: "draft", impressions: 0, clicks: 0, ctr: 0, budget: 5000, spent: 0, startDate: "", endDate: "" },
  { id: 4, name: "Летний курс", placement: "banner", status: "completed", impressions: 45200, clicks: 1230, ctr: 2.72, budget: 30000, spent: 29800, startDate: "2025-06-01", endDate: "2025-08-31" },
];

function formatNum(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toLocaleString("ru-RU");
}

function formatTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "только что";
  if (mins < 60) return `${mins} мин. назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч. назад`;
  const days = Math.floor(hours / 24);
  return `${days} дн. назад`;
}

// ─── KPI Card ───
function KpiCard({ label, value, icon: Icon, colorClass, trend }: {
  label: string; value: string; icon: any; colorClass: string; trend?: string;
}) {
  return (
    <Card className="flex-1 min-w-0">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold text-card-foreground leading-tight">{value}</p>
          <div className="flex items-center gap-1.5">
            <p className="text-xs text-muted-foreground">{label}</p>
            {trend && <span className="text-[10px] text-success font-medium">{trend}</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Verification Readiness Card ───
function ReadinessCard({ isVerified, onGoToSettings }: { isVerified: boolean; onGoToSettings: () => void }) {
  const [open, setOpen] = useState(!isVerified);

  if (isVerified) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-xl border border-warning/30 bg-warning/5 overflow-hidden">
        <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-3 hover:bg-warning/10 transition-colors cursor-pointer">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
            <div className="text-left">
              <span className="text-sm font-semibold text-card-foreground">Требуется верификация</span>
              <p className="text-xs text-muted-foreground">Для создания кампаний подтвердите данные</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={(e) => { e.stopPropagation(); onGoToSettings(); }} className="h-8 text-sm gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              Пройти верификацию
            </Button>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-1 border-t border-warning/20 space-y-2">
            {[
              { label: "Реквизиты (ИП/ООО)", done: false, icon: ShieldCheck },
              { label: "ОРД — маркировка рекламы", done: false, icon: ShieldCheck },
              { label: "Банковские реквизиты", done: false, optional: true, icon: Landmark },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-sm">
                {item.done
                  ? <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                  : <div className="h-4 w-4 rounded-full border border-muted-foreground/40 flex-shrink-0" />}
                <span className={item.done ? "text-card-foreground" : "text-muted-foreground"}>{item.label}</span>
                {item.optional && <Badge variant="outline" className="text-[10px] border-muted-foreground/20 text-muted-foreground ml-1">Опционально</Badge>}
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ─── Campaign Row ───
function CampaignRow({ campaign, isVerified, onManage }: {
  campaign: Campaign; isVerified: boolean; onManage: (c: Campaign) => void;
}) {
  const budgetPercent = campaign.budget > 0 ? Math.min((campaign.spent / campaign.budget) * 100, 100) : 0;

  return (
    <div className="rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors">
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0 space-y-2">
          {/* Name + placement + status */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-card-foreground">{campaign.name}</span>
            <Badge variant="outline" className={`text-[10px] ${statusStyles[campaign.status]}`}>
              {statusLabels[campaign.status]}
            </Badge>
            <span className="text-xs text-muted-foreground">• {placementLabels[campaign.placement]}</span>
          </div>

          {/* Dates */}
          {campaign.startDate && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="h-3 w-3" />
              <span>{campaign.startDate} — {campaign.endDate || "∞"}</span>
            </div>
          )}

          {/* Metrics row */}
          <div className="flex items-center gap-5 text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Eye className="h-3.5 w-3.5" />
              <span className="font-medium text-card-foreground">{formatNum(campaign.impressions)}</span>
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <MousePointerClick className="h-3.5 w-3.5" />
              <span className="font-medium text-card-foreground">{formatNum(campaign.clicks)}</span>
            </span>
            <span className="text-muted-foreground">
              CTR: <span className="font-medium text-card-foreground">{campaign.ctr}%</span>
            </span>
          </div>

          {/* Budget bar */}
          <div className="space-y-1 max-w-sm">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Бюджет</span>
              <span className="text-card-foreground font-medium">
                {formatNum(campaign.spent)} / {formatNum(campaign.budget)} ₽
              </span>
            </div>
            <Progress value={budgetPercent} className="h-1.5" />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0 pt-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button size="sm" variant="outline" className="text-sm h-9" disabled={!isVerified}
                  onClick={() => onManage(campaign)}>
                  <Settings className="h-3.5 w-3.5 mr-1.5" />
                  Управлять
                </Button>
              </span>
            </TooltipTrigger>
            {!isVerified && <TooltipContent><p className="text-xs">Пройдите верификацию</p></TooltipContent>}
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-9 w-9 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {campaign.status === "active" ? (
                <DropdownMenuItem className="text-sm gap-2"><Pause className="h-3.5 w-3.5" /> Приостановить</DropdownMenuItem>
              ) : campaign.status === "paused" ? (
                <DropdownMenuItem className="text-sm gap-2"><Play className="h-3.5 w-3.5" /> Возобновить</DropdownMenuItem>
              ) : null}
              <DropdownMenuItem className="text-sm gap-2"><Copy className="h-3.5 w-3.5" /> Дублировать</DropdownMenuItem>
              <DropdownMenuItem className="text-sm gap-2 text-destructive"><Archive className="h-3.5 w-3.5" /> Архивировать</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}


// ─── Main Component ───
export function BuiltInAds({ isVerified, onGoToSettings }: BuiltInAdsProps) {
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [placementFilter, setPlacementFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("spent");
  const [managingCampaign, setManagingCampaign] = useState<Campaign | null>(null);
  const [showContractWizard, setShowContractWizard] = useState(false);
  const [showManualWizard, setShowManualWizard] = useState(false);
  const [activeDraft, setActiveDraft] = useState<CampaignDraft | undefined>();
  const [campaigns, setCampaigns] = useState<Campaign[]>(mockCampaigns);
  const [drafts, setDrafts] = useState<CampaignDraft[]>(() => loadDrafts());

  const refreshDrafts = () => setDrafts(loadDrafts());

  const filtered = useMemo(() => {
    let result = [...campaigns];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) => c.name.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") {
      result = result.filter((c) => c.status === statusFilter);
    }
    if (placementFilter !== "all") {
      result = result.filter((c) => c.placement === placementFilter);
    }
    result.sort((a, b) => {
      switch (sortBy) {
        case "spent": return b.spent - a.spent;
        case "ctr": return b.ctr - a.ctr;
        case "clicks": return b.clicks - a.clicks;
        case "date": return (b.startDate || "").localeCompare(a.startDate || "");
        default: return 0;
      }
    });
    return result;
  }, [campaigns, searchQuery, statusFilter, placementFilter, sortBy]);

  // Totals for KPIs
  const totals = useMemo(() => {
    const active = campaigns.filter((c) => c.status !== "draft");
    return {
      impressions: active.reduce((s, c) => s + c.impressions, 0),
      clicks: active.reduce((s, c) => s + c.clicks, 0),
      ctr: active.length > 0
        ? (active.reduce((s, c) => s + c.clicks, 0) / Math.max(active.reduce((s, c) => s + c.impressions, 0), 1) * 100).toFixed(1)
        : "0",
      spent: active.reduce((s, c) => s + c.spent, 0),
    };
  }, [campaigns]);

  if (showManualWizard) {
    return (
      <ManualCampaignWizard
        isVerified={isVerified}
        ordConnected={isVerified}
        onBack={() => {
          setShowManualWizard(false);
          setActiveDraft(undefined);
          refreshDrafts();
        }}
        onComplete={(campaign) => {
          setCampaigns(prev => [campaign, ...prev]);
          setShowManualWizard(false);
          setActiveDraft(undefined);
          refreshDrafts();
        }}
        onGoToSettings={onGoToSettings}
        initialDraft={activeDraft}
      />
    );
  }

  if (showContractWizard) {
    return (
      <ContractImportWizard
        onBack={() => setShowContractWizard(false)}
        onComplete={() => {
          setShowContractWizard(false);
        }}
      />
    );
  }

  if (managingCampaign) {
    return <CampaignManageView campaign={managingCampaign} onBack={() => setManagingCampaign(null)} />;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="w-full max-w-[1040px] mx-auto px-6 py-6 space-y-5">
        {/* Header row */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-bold text-foreground tracking-tight">Встроенная реклама</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Размещайте рекламу на платформе без участия авторов · Кампаний: {campaigns.length}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Date range */}
            <div className="flex items-center rounded-lg border border-border bg-card overflow-hidden">
              {(["today", "7d", "30d"] as DateRange[]).map((range) => (
                <button key={range} type="button"
                  onClick={() => setDateRange(range)}
                  className={`px-3 py-1.5 text-sm transition-colors ${
                    dateRange === range
                      ? "bg-primary/15 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  }`}>
                  {dateRangeLabels[range]}
                </button>
              ))}
            </div>

            {isVerified ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="h-9 text-sm gap-1.5">
                    <Plus className="h-4 w-4" />
                    Новая кампания
                    <ChevronDown className="h-3 w-3 ml-0.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem className="text-sm gap-2 py-2.5" onClick={() => setShowManualWizard(true)}>
                    <Plus className="h-3.5 w-3.5" />
                    <div>
                      <p className="font-medium">Вручную</p>
                      <p className="text-[10px] text-muted-foreground">Создать кампанию с нуля</p>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-sm gap-2 py-2.5" onClick={() => setShowContractWizard(true)}>
                    <FileText className="h-3.5 w-3.5" />
                    <div>
                      <p className="font-medium">Из договора</p>
                      <p className="text-[10px] text-muted-foreground">Импорт из PDF/DOCX</p>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button size="sm" disabled className="h-9 text-sm gap-1.5">
                      <Plus className="h-4 w-4" />
                      Новая кампания
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent><p className="text-xs">Пройдите верификацию в Настройках</p></TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="ghost" className="h-9 w-9 p-0">
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[240px]">
                <p className="text-xs">Встроенная реклама позволяет размещать баннеры, промо-карточки и рекомендации без участия авторов.</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Readiness card */}
        <ReadinessCard isVerified={isVerified} onGoToSettings={onGoToSettings} />

        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label={`Показы · ${dateRangeLabels[dateRange]}`} value={formatNum(totals.impressions)} icon={Eye}
            colorClass="bg-info/15 text-info" trend="+12%" />
          <KpiCard label={`Клики · ${dateRangeLabels[dateRange]}`} value={formatNum(totals.clicks)} icon={MousePointerClick}
            colorClass="bg-success/15 text-success" trend="+8%" />
          <KpiCard label={`CTR · ${dateRangeLabels[dateRange]}`} value={`${totals.ctr}%`} icon={TrendingUp}
            colorClass="bg-accent/15 text-accent" />
          <KpiCard label={`Потрачено · ${dateRangeLabels[dateRange]}`} value={`${formatNum(totals.spent)} ₽`} icon={BarChart3}
            colorClass="bg-warning/15 text-warning" />
        </div>

        {/* Filter bar */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по названию…" className="pl-9 h-10" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 h-10"><SelectValue placeholder="Статус" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                <SelectItem value="active">Активна</SelectItem>
                <SelectItem value="paused">Пауза</SelectItem>
                <SelectItem value="draft">Черновик</SelectItem>
                <SelectItem value="completed">Завершена</SelectItem>
              </SelectContent>
            </Select>
            <Select value={placementFilter} onValueChange={setPlacementFilter}>
              <SelectTrigger className="w-52 h-10"><SelectValue placeholder="Размещение" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все размещения</SelectItem>
                <SelectItem value="banner">Баннер в каталоге</SelectItem>
                <SelectItem value="feed">Промо в ленте подписок</SelectItem>
                <SelectItem value="recommendations">Рекомендации — карточка</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40 h-10">
                <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Сортировка" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="spent">По расходам</SelectItem>
                <SelectItem value="ctr">По CTR</SelectItem>
                <SelectItem value="clicks">По кликам</SelectItem>
                <SelectItem value="date">По дате</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(searchQuery.trim() || statusFilter !== "all" || placementFilter !== "all") && (
            <p className="text-xs text-muted-foreground">
              Показано кампаний: <span className="font-medium text-card-foreground">{filtered.length}</span>
            </p>
          )}
        </div>

        {/* Drafts */}
        {drafts.length > 0 && (
          <Collapsible defaultOpen={drafts.length <= 3}>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer">
                <div className="flex items-center gap-2">
                  <FileEdit className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-card-foreground">Черновики</span>
                  <Badge variant="outline" className="text-[10px]">{drafts.length}</Badge>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t border-border divide-y divide-border">
                  {drafts.map((d) => {
                    const stepLabel = d.step <= 5 ? ["Размещение", "Креатив", "Бюджет", "ОРД", "Обзор"][d.step - 1] : "";
                    const name = d.creativeTitle || (d.placement ? placementLabels[d.placement] : "Без названия");
                    const updated = new Date(d.updatedAt);
                    const timeAgo = formatTimeAgo(updated);
                    return (
                      <div key={d.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-card-foreground truncate">{name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            Шаг {d.step}: {stepLabel} · {timeAgo}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] px-2.5"
                          onClick={() => {
                            setActiveDraft(d);
                            setShowManualWizard(true);
                          }}
                        >
                          Продолжить
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            deleteDraft(d.id);
                            refreshDrafts();
                            toast.success("Черновик удалён");
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        )}

        <div className="space-y-3">
          {filtered.map((c) => (
            <CampaignRow key={c.id} campaign={c} isVerified={isVerified} onManage={setManagingCampaign} />
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-16 text-sm text-muted-foreground rounded-xl border border-border bg-card">
              {campaigns.length === 0
                ? "Создайте первую рекламную кампанию"
                : "Кампании не найдены. Попробуйте изменить фильтры."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
