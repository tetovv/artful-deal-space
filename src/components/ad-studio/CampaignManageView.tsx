import { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useSaveContract, useConfirmContract, useContractsByCampaign } from "@/hooks/useContracts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft, Eye, MousePointerClick, TrendingUp, BarChart3, Pause, Play,
  MoreVertical, Copy, Archive, Ban, CalendarDays, AlertTriangle, CheckCircle2,
  ImagePlus, ExternalLink, RefreshCw, Send, Info, Globe, Link2, Save,
  Lock, PlusCircle, XCircle, ShieldCheck, ClipboardCopy, Loader2, Download, StopCircle,
  FileText, History, User, Upload, FilePlus, ArrowUpRight, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ───
export type CampaignStatus = "active" | "paused" | "draft" | "completed" | "error" | "finalizing" | "ord_error";
export type Placement = "banner" | "feed" | "recommendations";

export interface Campaign {
  id: number;
  name: string;
  placement: Placement;
  status: CampaignStatus;
  impressions: number;
  clicks: number;
  ctr: number;
  budget: number;
  spent: number;
  startDate: string;
  endDate: string;
  erid?: string;
  ordProvider?: string;
  ordStatus?: "connected" | "error" | "pending";
  ordLastSync?: string;
  creativeLocked?: boolean;
  // Contract-linked fields
  contractLinked?: boolean;
  contractNumber?: string;
  contractDate?: string;
  contractParty?: string;
  contractBudgetFixed?: boolean;
  addenda?: Addendum[];
  auditLog?: AuditLogEntry[];
}

export interface Addendum {
  id: number;
  title: string;
  fileName: string;
  date: string;
  budgetDelta: number;
  dateDelta?: string;
  status: "pending" | "confirmed";
}

export interface AuditLogEntry {
  timestamp: string;
  action: string;
  user: string;
  details?: string;
}

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

function formatNum(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toLocaleString("ru-RU");
}

type DateRange = "today" | "7d" | "30d";
const dateRangeLabels: Record<DateRange, string> = { today: "Сегодня", "7d": "7 дней", "30d": "30 дней" };

// ─── Helpers ───
function isStarted(campaign: Campaign): boolean {
  return ["active", "paused", "completed", "finalizing", "ord_error"].includes(campaign.status);
}

function isTerminal(campaign: Campaign): boolean {
  return ["completed", "finalizing", "ord_error"].includes(campaign.status);
}

function hasErid(campaign: Campaign): boolean {
  return !!campaign.erid;
}

function isLocked(campaign: Campaign): boolean {
  return isStarted(campaign) || hasErid(campaign);
}

function isFullyLocked(campaign: Campaign): boolean {
  return isTerminal(campaign);
}

// ─── ERID Badge (single instance in header) ───
function EridBadge({ erid }: { erid?: string }) {
  if (!erid) return null;
  return (
    <div className="flex items-center gap-1.5 rounded-md bg-primary/10 border border-primary/20 px-2 py-1">
      <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">ERID</span>
      <span className="text-[13px] font-mono font-semibold text-primary">{erid}</span>
      <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => {
        navigator.clipboard.writeText(erid);
        toast.success("ERID скопирован");
      }}>
        <ClipboardCopy className="h-3 w-3 text-primary" />
      </Button>
    </div>
  );
}

// ─── ORD Status Indicator ───
function OrdStatusIndicator({ campaign }: { campaign: Campaign }) {
  const status = campaign.ordStatus || "pending";
  const styles: Record<string, { bg: string; icon: any; label: string }> = {
    connected: { bg: "bg-success/15 text-success", icon: CheckCircle2, label: "ОРД подключён" },
    error: { bg: "bg-destructive/15 text-destructive", icon: XCircle, label: "Ошибка ОРД" },
    pending: { bg: "bg-warning/15 text-warning", icon: Info, label: "ОРД ожидает" },
  };
  const s = styles[status];
  const Icon = s.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${s.bg}`}>
          <Icon className="h-3 w-3" />
          <span>{s.label}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">
          {campaign.ordLastSync ? `Последняя синхронизация: ${campaign.ordLastSync}` : "Синхронизация не выполнялась"}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

// ─── Locked field wrapper ───
function LockedField({ locked, reason, children }: { locked: boolean; reason: string; children: React.ReactNode }) {
  if (!locked) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="relative">
          {children}
          <div className="absolute inset-0 bg-muted/5 rounded-md cursor-not-allowed" />
          <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-[260px]">
        <p className="text-xs">{reason}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// ─── Metric mini card ───
function MetricCard({ label, value, icon: Icon, colorClass }: {
  label: string; value: string; icon: any; colorClass: string;
}) {
  return (
    <Card className="flex-1 min-w-0">
      <CardContent className="p-3 flex items-center gap-2.5">
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold text-card-foreground leading-tight">{value}</p>
          <p className="text-[14px] text-foreground/70">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Mock chart ───
function MiniChart({ metric }: { metric: string }) {
  const bars = useMemo(() => Array.from({ length: 14 }, () => 20 + Math.random() * 80), []);
  return (
    <div className="flex items-end gap-[3px] h-28 w-full">
      {bars.map((v, i) => (
        <div key={i} className="flex-1 rounded-t bg-primary/60 hover:bg-primary transition-colors"
          style={{ height: `${v}%` }} />
      ))}
    </div>
  );
}

// ─── Mock creative ───
interface Creative {
  id: number;
  title: string;
  url: string;
  status: "approved" | "pending" | "rejected";
  reason?: string;
}

const mockCreative: Creative = {
  id: 1, title: "Баннер весна 728×90", url: "https://example.com/promo", status: "approved",
};

const creativeStatusLabels: Record<Creative["status"], string> = {
  approved: "Одобрен", pending: "На модерации", rejected: "Отклонён",
};
const creativeStatusStyles: Record<Creative["status"], string> = {
  approved: "bg-success/15 text-success border-success/30",
  pending: "bg-warning/15 text-warning border-warning/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
};

// ─── Mock ORD events ───
interface OrdEvent {
  date: string;
  action: string;
  status: "ok" | "error";
}
const mockOrdEvents: OrdEvent[] = [
  { date: "2026-02-19 14:32", action: "Отправка креатива в ОРД", status: "ok" },
  { date: "2026-02-19 14:33", action: "Получен ERID для кампании", status: "ok" },
  { date: "2026-02-18 09:10", action: "Отправка статистики за 17.02", status: "ok" },
  { date: "2026-02-17 09:11", action: "Отправка статистики за 16.02", status: "error" },
  { date: "2026-02-16 14:00", action: "Регистрация кампании в ОРД", status: "ok" },
];

// ═══════════════════════════════════════════════════════
// ─── Overview Tab ───
// ═══════════════════════════════════════════════════════
function OverviewTab({ campaign }: { campaign: Campaign }) {
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [chartMetric, setChartMetric] = useState<string>("impressions");

  const budgetPercent = campaign.budget > 0 ? Math.min((campaign.spent / campaign.budget) * 100, 100) : 0;
  const daysTotal = campaign.startDate && campaign.endDate
    ? Math.max(1, Math.ceil((new Date(campaign.endDate).getTime() - new Date(campaign.startDate).getTime()) / 86400000))
    : 0;
  const daysElapsed = campaign.startDate
    ? Math.max(0, Math.ceil((Date.now() - new Date(campaign.startDate).getTime()) / 86400000))
    : 0;
  const dailyPace = daysElapsed > 0 ? Math.round(campaign.spent / daysElapsed) : 0;
  const daysRemaining = daysTotal > 0 ? Math.max(0, daysTotal - daysElapsed) : null;

  const hasIssues = campaign.impressions === 0 || campaign.status === "error" || campaign.status === "ord_error" || budgetPercent >= 100;

  return (
    <div className="space-y-3">
      {/* KPI row with period selector top-right */}
      <div className="flex items-center justify-between mb-1">
        <p className="text-[15px] font-semibold text-card-foreground">Метрики</p>
        <div className="flex items-center gap-1 text-[13px]">
          {(["today", "7d", "30d"] as DateRange[]).map((r) => (
            <button key={r} type="button" onClick={() => setDateRange(r)}
              className={`px-2 py-0.5 rounded-md transition-colors ${dateRange === r
                ? "bg-primary/15 text-primary font-medium"
                : "text-muted-foreground hover:text-foreground"
              }`}>
              {dateRangeLabels[r]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricCard label="Показы" value={formatNum(campaign.impressions)} icon={Eye} colorClass="bg-info/15 text-info" />
        <MetricCard label="Клики" value={formatNum(campaign.clicks)} icon={MousePointerClick} colorClass="bg-success/15 text-success" />
        <MetricCard label="CTR" value={`${campaign.ctr}%`} icon={TrendingUp} colorClass="bg-accent/15 text-accent" />
        <MetricCard label="Потрачено" value={`${formatNum(campaign.spent)} ₽`} icon={BarChart3} colorClass="bg-warning/15 text-warning" />
      </div>

      {/* Chart — single block, minimal metric toggle */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[15px] font-semibold text-card-foreground">Динамика</p>
            <div className="flex items-center gap-1 text-[13px]">
              {[
                { key: "impressions", label: "Показы" },
                { key: "clicks", label: "Клики" },
                { key: "spend", label: "Расходы" },
              ].map((m) => (
                <button key={m.key} type="button" onClick={() => setChartMetric(m.key)}
                  className={`px-2 py-0.5 rounded-md transition-colors ${chartMetric === m.key
                    ? "bg-primary/15 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground"
                  }`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <MiniChart metric={chartMetric} />
        </CardContent>
      </Card>

      {/* Budget & pacing — compact, no top-up controls */}
      <Card>
        <CardContent className="p-4 space-y-1.5">
          <p className="text-[15px] font-semibold text-card-foreground">Бюджет</p>
          <div className="flex items-center justify-between text-[14px]">
            <span className="text-foreground/70">Потрачено</span>
            <span className="font-medium text-card-foreground">{formatNum(campaign.spent)} / {formatNum(campaign.budget)} ₽</span>
          </div>
          <Progress value={budgetPercent} className="h-1.5" />
          <div className="flex items-center gap-5 text-[13px] text-foreground/60">
            <span>Темп: <span className="font-medium text-card-foreground">{formatNum(dailyPace)} ₽/день</span></span>
            {daysRemaining !== null && (
              <span>Осталось: <span className="font-medium text-card-foreground">{daysRemaining} дн.</span></span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Diagnostics */}
      {hasIssues && (
        <Card className="border-warning/30">
          <CardContent className="p-3 space-y-1">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
              <p className="text-[14px] font-semibold text-card-foreground">Почему кампания не откручивается?</p>
            </div>
            <ul className="space-y-0.5 text-[13px] text-muted-foreground pl-6">
              {budgetPercent >= 100 && <li className="flex items-center gap-2"><Ban className="h-3.5 w-3.5 text-destructive" /> Бюджет исчерпан</li>}
              {campaign.impressions === 0 && campaign.status === "draft" && <li className="flex items-center gap-2"><Info className="h-3.5 w-3.5 text-warning" /> Кампания в черновике</li>}
              {campaign.impressions === 0 && campaign.status === "active" && <li className="flex items-center gap-2"><Info className="h-3.5 w-3.5 text-warning" /> Нет модерации или ERID</li>}
              {campaign.status === "error" && <li className="flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5 text-destructive" /> Ошибка ОРД</li>}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ─── Settings Tab ───
// ═══════════════════════════════════════════════════════
// ─── Read-only summary row ───
function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-[14px] text-foreground/60 flex-shrink-0">{label}</span>
      <span className="text-[14px] font-medium text-card-foreground text-right">{value}</span>
    </div>
  );
}

function SettingsTab({ campaign }: { campaign: Campaign }) {
  const fullyLocked = isFullyLocked(campaign);

  // ── Read-only summary for completed/finalizing campaigns ──
  if (fullyLocked) {
    return (
      <div className="space-y-3">
        {/* Compact lock notice */}
        <div className="flex items-center gap-2 rounded-md bg-muted/40 border border-muted-foreground/15 px-3 py-1.5">
          <Lock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <span className="text-[13px] text-muted-foreground">Кампания завершена — настройки доступны только для просмотра</span>
        </div>

        {/* Placement */}
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-[15px] font-semibold text-card-foreground">Параметры размещения</p>
            <SummaryRow label="Тип размещения" value={placementLabels[campaign.placement] || campaign.placement} />
            <SummaryRow label="Формат" value="Все устройства" />
          </CardContent>
        </Card>

        {/* Dates */}
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-[15px] font-semibold text-card-foreground">Сроки</p>
            <SummaryRow label="Начало" value={campaign.startDate || "—"} />
            <SummaryRow label="Окончание" value={campaign.endDate || "—"} />
          </CardContent>
        </Card>

        {/* Budget */}
        <Card>
          <CardContent className="p-4 space-y-1.5">
            <p className="text-[15px] font-semibold text-card-foreground">Бюджет</p>
            <SummaryRow label="Лимит" value={`${formatNum(campaign.budget)} ₽`} />
            <SummaryRow label="Потрачено" value={`${formatNum(campaign.spent)} ₽`} />
            <p className="text-[12px] text-foreground/50 mt-1">Бюджет зафиксирован договором, редактирование недоступно</p>
          </CardContent>
        </Card>

        {/* Targeting */}
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-[15px] font-semibold text-card-foreground">Таргетинг</p>
            <div className="flex items-center gap-2 text-[14px]">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="text-card-foreground font-medium">Все пользователи</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Editable settings for active/draft/paused campaigns ──
  return <SettingsTabEditable campaign={campaign} />;
}

function SettingsTabEditable({ campaign }: { campaign: Campaign }) {
  const [hasChanges, setHasChanges] = useState(false);
  const [budgetValue, setBudgetValue] = useState(String(campaign.budget));
  const [startDate, setStartDate] = useState(campaign.startDate);
  const [endDate, setEndDate] = useState(campaign.endDate);
  const [utm, setUtm] = useState({ source: "", medium: "", campaign: "" });

  const started = isStarted(campaign);
  const budgetDecreaseBlocked = started;
  const minBudget = campaign.spent;

  const handleBudgetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const num = Number(val);
    if (budgetDecreaseBlocked && num < campaign.budget) {
      toast.error("Уменьшение бюджета запрещено после старта кампании.");
      return;
    }
    if (num < minBudget) {
      toast.error(`Бюджет не может быть ниже уже потраченного (${formatNum(minBudget)} ₽)`);
      return;
    }
    setBudgetValue(val);
    setHasChanges(true);
  };

  const handleChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    setHasChanges(true);
  };

  return (
    <div className="space-y-3 relative">
      {hasChanges && (
        <div className="sticky top-0 z-10 flex items-center justify-between bg-warning/10 border border-warning/30 rounded-lg px-3 py-2">
          <span className="text-[14px] text-warning font-medium">Есть несохранённые изменения</span>
          <Button size="sm" className="h-7 text-[13px] gap-1.5" onClick={() => setHasChanges(false)}>
            <Save className="h-3.5 w-3.5" />
            Сохранить
          </Button>
        </div>
      )}

      {/* Budget & schedule */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-[15px] font-semibold text-card-foreground">Бюджет и расписание</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <label className="text-[14px] text-muted-foreground">Общий бюджет (₽)</label>
                {budgetDecreaseBlocked && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Lock className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[240px]">
                      <p className="text-xs">Уменьшение бюджета запрещено после старта кампании.</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              <Input value={budgetValue} onChange={handleBudgetChange} type="number"
                min={budgetDecreaseBlocked ? campaign.budget : 0} className="h-10" />
              {budgetDecreaseBlocked && (
                <p className="text-[11px] text-muted-foreground">Мин. значение: {formatNum(campaign.budget)} ₽</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-[14px] text-muted-foreground">Дневной лимит (₽)</label>
              <Input placeholder="Без ограничений" className="h-9" onChange={() => setHasChanges(true)} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <label className="text-[14px] text-muted-foreground">Дата начала</label>
                {started && <Lock className="h-3 w-3 text-muted-foreground" />}
              </div>
              <LockedField locked={started} reason="Дата начала не может быть изменена после запуска кампании">
                <Input type="date" value={startDate} onChange={handleChange(setStartDate)} className="h-10" readOnly={started} />
              </LockedField>
            </div>
            <div className="space-y-1.5">
              <label className="text-[14px] text-muted-foreground">Дата окончания</label>
              <Input type="date" value={endDate} onChange={handleChange(setEndDate)} className="h-10" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Targeting */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="text-[15px] font-semibold text-card-foreground">Таргетинг</p>
          <div className="flex items-center gap-2 text-[14px]">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span className="text-card-foreground font-medium">Все пользователи</span>
            <Badge variant="outline" className="text-[11px] border-muted-foreground/20 text-muted-foreground ml-1">По умолчанию</Badge>
          </div>
          <p className="text-[13px] text-muted-foreground">Сегментация по аудиториям станет доступна в следующих обновлениях.</p>
        </CardContent>
      </Card>

      {/* UTM */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-[15px] font-semibold text-card-foreground">Трекинг (UTM-параметры)</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-[14px] text-muted-foreground">utm_source</label>
              <Input placeholder="mediaos" value={utm.source}
                onChange={(e) => { setUtm({ ...utm, source: e.target.value }); setHasChanges(true); }} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[14px] text-muted-foreground">utm_medium</label>
              <Input placeholder="cpc" value={utm.medium}
                onChange={(e) => { setUtm({ ...utm, medium: e.target.value }); setHasChanges(true); }} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[14px] text-muted-foreground">utm_campaign</label>
              <Input placeholder={campaign.name.toLowerCase().replace(/\s/g, "_")} value={utm.campaign}
                onChange={(e) => { setUtm({ ...utm, campaign: e.target.value }); setHasChanges(true); }} className="h-10" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Policies */}
      <Card className="border-muted-foreground/10">
        <CardContent className="p-4 space-y-1.5">
          <p className="text-[15px] font-semibold text-card-foreground">Правила и ограничения</p>
          <ul className="space-y-1 text-[13px] text-muted-foreground leading-relaxed">
            <li>• Одна кампания = один креатив = один ERID</li>
            <li>• Креатив нельзя заменить после получения ERID — создайте новую версию</li>
            <li>• Бюджет нельзя уменьшить после старта (для корректного учёта в ОРД)</li>
            <li>• Все креативы должны содержать маркировку «Реклама» и ERID</li>
            <li>• Статистика передаётся в ОРД автоматически ежедневно</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ─── Creative Tab (clean, action-light) ───
// ═══════════════════════════════════════════════════════
function CreativeTab({ campaign }: { campaign: Campaign }) {
  const locked = isLocked(campaign);
  const creative = mockCreative;
  const [previewOpen, setPreviewOpen] = useState(false);

  // Mock file metadata
  const fileMeta = { name: "banner_728x90.png", format: "PNG", size: "84 KB", uploaded: "18.02.2026" };

  return (
    <div className="space-y-3">
      {/* Compact lock notice */}
      {locked && (
        <div className="flex items-center gap-2 rounded-md bg-muted/40 border border-muted-foreground/15 px-3 py-1.5">
          <Lock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <span className="text-[13px] text-muted-foreground">
            Креатив заблокирован{hasErid(campaign) ? " — ERID выдан" : " — кампания запущена"}. Для нового креатива дублируйте кампанию.
          </span>
        </div>
      )}

      {/* Creative file card */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-[15px] font-semibold text-card-foreground">Файл креатива</p>
          <div className="flex items-center gap-3">
            <div className="h-14 w-20 rounded-lg bg-muted/30 border border-border flex items-center justify-center flex-shrink-0">
              <ImagePlus className="h-5 w-5 text-muted-foreground/40" />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[14px] font-semibold text-card-foreground">{fileMeta.name}</span>
                <Badge variant="outline" className={`text-[11px] ${creativeStatusStyles[creative.status]}`}>
                  {creativeStatusLabels[creative.status]}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-[13px] text-foreground/60">
                <span>{fileMeta.format}</span>
                <span>·</span>
                <span>{fileMeta.size}</span>
                <span>·</span>
                <span>Загружен {fileMeta.uploaded}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button size="sm" variant="ghost" className="h-7 text-[13px] gap-1 text-primary hover:text-primary"
                onClick={() => window.open("#", "_blank")}>
                <ExternalLink className="h-3 w-3" />
                Открыть
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-[13px] gap-1 text-muted-foreground hover:text-foreground">
                <Download className="h-3 w-3" />
                Скачать
              </Button>
            </div>
          </div>
          {/* Inline ERID — small, no big block */}
          {campaign.erid && (
            <p className="text-[12px] text-foreground/50">ERID: <span className="font-mono">{campaign.erid}</span></p>
          )}
        </CardContent>
      </Card>

      {/* Landing URL */}
      <Card>
        <CardContent className="p-4 space-y-1.5">
          <p className="text-[15px] font-semibold text-card-foreground">Целевая ссылка</p>
          <a href={creative.url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[14px] text-primary hover:underline font-medium break-all">
            {creative.url}
            <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
          </a>
        </CardContent>
      </Card>

      {/* Compact collapsible preview */}
      <Card>
        <CardContent className="p-0">
          <button type="button" onClick={() => setPreviewOpen(!previewOpen)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-muted/20 transition-colors rounded-lg">
            <span className="text-[14px] font-medium text-card-foreground">Как будет выглядеть на Главной</span>
            <ArrowRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${previewOpen ? "rotate-90" : ""}`} />
          </button>
          {previewOpen && (
            <div className="px-4 pb-3">
              <div className="rounded-lg border border-border bg-muted/10 p-3 max-w-xs">
                <div className="h-10 w-full rounded bg-primary/10 border border-primary/20 flex items-center justify-center mb-1.5">
                  <span className="text-[12px] text-primary font-medium">{fileMeta.name}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">Реклама · {placementLabels[campaign.placement]}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subtle duplicate hint — only if not already in header kebab */}
      {locked && (
        <p className="text-[13px] text-foreground/50 flex items-center gap-1.5">
          Нужен другой креатив? Используйте «Дублировать» в меню кампании <MoreVertical className="h-3 w-3 inline" />.
        </p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ─── ORD / Marking Tab ───
// ═══════════════════════════════════════════════════════
function OrdTab({ campaign }: { campaign: Campaign }) {
  const ordStatus = campaign.ordStatus || "connected";
  const [techOpen, setTechOpen] = useState(false);

  return (
    <div className="space-y-3">
      {/* Connection status — compact, no reconnect */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                ordStatus === "connected" ? "bg-success/15" : ordStatus === "error" ? "bg-destructive/15" : "bg-warning/15"
              }`}>
                {ordStatus === "connected" ? <CheckCircle2 className="h-4 w-4 text-success" /> :
                 ordStatus === "error" ? <XCircle className="h-4 w-4 text-destructive" /> :
                 <Info className="h-4 w-4 text-warning" />}
              </div>
              <div>
                <p className="text-[14px] font-medium text-card-foreground">ОРД: Яндекс <span className="text-foreground/40 font-normal">(фиксировано)</span></p>
                <p className="text-[13px] text-foreground/60">
                  {ordStatus === "connected" && <>Активно · синхр. {campaign.ordLastSync || "—"}</>}
                  {ordStatus === "error" && "Ошибка соединения"}
                  {ordStatus === "pending" && "Ожидает первой синхронизации"}
                </p>
              </div>
            </div>
            {ordStatus === "error" && (
              <Button size="sm" variant="outline" className="h-7 text-[13px] gap-1.5"
                onClick={() => toast.info("Повторная синхронизация запущена")}>
                <RefreshCw className="h-3.5 w-3.5" />
                Повторить синхронизацию
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ERID — prominent, single copy */}
      <Card>
        <CardContent className="p-4 space-y-1.5">
          <p className="text-[15px] font-semibold text-card-foreground">Маркировка (ERID)</p>
          {campaign.erid ? (
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-success flex-shrink-0" />
              <span className="text-[15px] font-mono font-bold text-card-foreground tracking-wide">{campaign.erid}</span>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => {
                navigator.clipboard.writeText(campaign.erid!);
                toast.success("ERID скопирован");
              }}>
                <ClipboardCopy className="h-3.5 w-3.5 text-primary" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[13px] text-foreground/60">
              <Info className="h-4 w-4 text-warning flex-shrink-0" />
              <span>ERID будет получен после отправки креатива в ОРД.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync history */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="text-[15px] font-semibold text-card-foreground">История синхронизации</p>
          <div className="space-y-1">
            {mockOrdEvents.map((ev, i) => (
              <div key={i} className="flex items-center gap-2.5 py-1 text-[13px]">
                {ev.status === "ok"
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-success flex-shrink-0" />
                  : <XCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />}
                <span className="text-foreground/50 flex-shrink-0 w-32 font-mono text-[12px]">{ev.date}</span>
                <span className="text-card-foreground">{ev.action}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Technical data — collapsible */}
      <Card>
        <CardContent className="p-0">
          <button type="button" onClick={() => setTechOpen(!techOpen)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-muted/20 transition-colors rounded-lg">
            <span className="text-[14px] font-medium text-card-foreground">Технические данные</span>
            <ArrowRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${techOpen ? "rotate-90" : ""}`} />
          </button>
          {techOpen && (
            <div className="px-4 pb-3 space-y-2">
              <SummaryRow label="ID кампании в ОРД" value={<span className="font-mono text-[13px]">ord-camp-2026-0219-a1b2</span>} />
              <SummaryRow label="Провайдер" value="Яндекс ОРД" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Contract Badge ───
function ContractBadge({ campaign }: { campaign: Campaign }) {
  if (!campaign.contractLinked) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5 rounded-lg bg-accent/10 border border-accent/20 px-2.5 py-1">
          <FileText className="h-3 w-3 text-accent" />
          <span className="text-[10px] font-semibold text-accent">Договор {campaign.contractNumber}</span>
          <Lock className="h-2.5 w-2.5 text-accent/60" />
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-[280px]">
        <p className="text-xs">Кампания создана из договора {campaign.contractNumber} от {campaign.contractDate}. Бюджет зафиксирован по договору — изменение только через доп. соглашение.</p>
      </TooltipContent>
    </Tooltip>
  );
}

// ─── Diff Item ───
interface DiffField {
  label: string;
  oldValue: string;
  newValue: string;
  changed: boolean;
}

function DiffView({ diffs, onConfirm, onCancel }: {
  diffs: DiffField[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const changedCount = diffs.filter((d) => d.changed).length;
  return (
    <Card className="border-primary/30">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ArrowUpRight className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold text-card-foreground">Изменения из доп. соглашения</p>
          <Badge variant="outline" className="text-[10px] border-primary/30 text-primary ml-auto">
            {changedCount} изменений
          </Badge>
        </div>

        <div className="space-y-2">
          {diffs.map((d, i) => (
            <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
              d.changed ? "border-primary/30 bg-primary/5" : "border-border bg-muted/10"
            }`}>
              <span className="text-xs text-muted-foreground w-36 flex-shrink-0">{d.label}</span>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {d.changed ? (
                  <>
                    <span className="text-xs text-destructive line-through bg-destructive/10 rounded px-1.5 py-0.5 truncate max-w-[180px]">
                      {d.oldValue || "—"}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs text-success font-medium bg-success/10 rounded px-1.5 py-0.5 truncate max-w-[180px]">
                      {d.newValue || "—"}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">{d.oldValue}</span>
                )}
              </div>
              {d.changed && (
                <Badge variant="outline" className="text-[9px] border-primary/20 text-primary flex-shrink-0">
                  Изменено
                </Badge>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2">
          <p className="text-[10px] text-muted-foreground">Подтвердите изменения для обновления кампании</p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="h-8 text-sm" onClick={onCancel}>Отмена</Button>
            <Button size="sm" className="h-8 text-sm gap-1.5" onClick={onConfirm}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              Подтвердить изменения
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Addendum Upload with Diff ───
function AddendumSection({ campaign }: { campaign: Campaign }) {
  const [uploading, setUploading] = useState(false);
  const [extractingAddendum, setExtractingAddendum] = useState(false);
  const [diffData, setDiffData] = useState<DiffField[] | null>(null);
  const [pendingAddendumFields, setPendingAddendumFields] = useState<Record<string, any> | null>(null);
  const [pendingFileName, setPendingFileName] = useState<string>("");
  const [pendingFileSize, setPendingFileSize] = useState<number>(0);
  const saveContract = useSaveContract();
  const confirmContract = useConfirmContract();
  const campaignId = campaign.contractLinked ? String(campaign.id) : undefined;
  const { data: contractVersions } = useContractsByCampaign(campaignId);
  const addenda = campaign.addenda || [
    { id: 1, title: "Доп. соглашение №1", fileName: "addendum_01.pdf", date: "2026-02-18", budgetDelta: 50000, status: "confirmed" as const },
  ];

  const handleAddendumUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setExtractingAddendum(true);

    try {
      // Extract text from the addendum file
      let text = "";
      if (file.name.endsWith(".docx")) {
        const mammoth = await import("mammoth");
        const ab = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: ab });
        text = result.value;
      } else if (file.type === "application/pdf") {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
        const ab = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: ab }).promise;
        const pages: string[] = [];
        for (let i = 1; i <= Math.min(pdf.numPages, 15); i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          pages.push(content.items.map((item: any) => item.str).join(" "));
        }
        text = pages.join("\n\n");
      }

      if (!text || text.trim().length < 20) {
        toast.error("Не удалось извлечь текст из документа");
        setUploading(false);
        setExtractingAddendum(false);
        return;
      }

      // Call AI to extract addendum fields
      const { data, error } = await supabase.functions.invoke("extract-contract", {
        body: { text, redactSensitive: true },
      });

      if (error || data?.error) {
        toast.error(data?.error || error?.message || "Ошибка извлечения данных");
        setUploading(false);
        setExtractingAddendum(false);
        return;
      }

      const newFields = data.fields;
      setPendingAddendumFields(newFields);
      setPendingFileName(file.name);
      setPendingFileSize(file.size);
      const diffItems: DiffField[] = [
        {
          label: "Бюджет",
          oldValue: `${formatNum(campaign.budget)} ₽`,
          newValue: newFields.budget?.value ? `${Number(newFields.budget.value).toLocaleString("ru-RU")} ₽` : "",
          changed: !!newFields.budget?.value && Number(newFields.budget.value) !== campaign.budget,
        },
        {
          label: "Дата начала",
          oldValue: campaign.startDate,
          newValue: newFields.startDate?.value || "",
          changed: !!newFields.startDate?.value && newFields.startDate.value !== campaign.startDate,
        },
        {
          label: "Дата окончания",
          oldValue: campaign.endDate,
          newValue: newFields.endDate?.value || "",
          changed: !!newFields.endDate?.value && newFields.endDate.value !== campaign.endDate,
        },
        {
          label: "Тип контента",
          oldValue: placementLabels[campaign.placement] || campaign.placement,
          newValue: newFields.contentType?.value || "",
          changed: !!newFields.contentType?.value,
        },
        {
          label: "Условия оплаты",
          oldValue: campaign.contractParty || "—",
          newValue: newFields.paymentTerms?.value || "",
          changed: !!newFields.paymentTerms?.value,
        },
        {
          label: "Условия расторжения",
          oldValue: "—",
          newValue: newFields.cancellationClause?.value || "",
          changed: !!newFields.cancellationClause?.value,
        },
      ].filter((d) => d.newValue); // Only show fields that have values in addendum

      setDiffData(diffItems);
      setExtractingAddendum(false);
      setUploading(false);
      toast.success("Изменения из доп. соглашения извлечены");
    } catch (err: any) {
      console.error("Addendum extraction error:", err);
      toast.error("Ошибка обработки доп. соглашения");
      setUploading(false);
      setExtractingAddendum(false);
    }
  }, [campaign]);

  return (
    <div className="space-y-4">
      {/* Extracting banner */}
      {extractingAddendum && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 text-primary animate-spin flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-card-foreground">Извлекаем данные из доп. соглашения…</p>
                <p className="text-xs text-muted-foreground">AI анализирует документ и ищет изменения</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Diff view */}
      {diffData && (
        <DiffView
          diffs={diffData}
          onConfirm={async () => {
            if (pendingAddendumFields && campaignId) {
              try {
                const nextVersion = (contractVersions?.length || 0) + 1;
                const saved = await saveContract.mutateAsync({
                  campaignId,
                  version: nextVersion,
                  documentType: "addendum",
                  fileName: pendingFileName,
                  fileSize: pendingFileSize,
                  extractedFields: pendingAddendumFields,
                  status: "extracted",
                });
                await confirmContract.mutateAsync(saved.id);
                toast.success("Доп. соглашение сохранено в базу данных");
              } catch (err: any) {
                console.error("Save addendum error:", err);
                toast.error("Ошибка сохранения: " + (err.message || ""));
              }
            } else {
              toast.success("Изменения из доп. соглашения применены");
            }
            setDiffData(null);
            setPendingAddendumFields(null);
          }}
          onCancel={() => { setDiffData(null); setPendingAddendumFields(null); }}
        />
      )}

      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FilePlus className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold text-card-foreground">Дополнительные соглашения</p>
            </div>
            <label>
              <input
                type="file"
                accept=".pdf,.docx"
                className="hidden"
                onChange={handleAddendumUpload}
                disabled={uploading}
              />
              <Button size="sm" variant="outline" className="h-8 text-sm gap-1.5 cursor-pointer" asChild disabled={uploading}>
                <span>
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Загрузить доп. соглашение
                </span>
              </Button>
            </label>
          </div>
          {addenda.length > 0 ? (
            <div className="space-y-2">
              {addenda.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 text-sm py-2 px-3 rounded-lg border border-border bg-muted/10">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-card-foreground truncate">{a.title}</p>
                      <p className="text-[10px] text-muted-foreground">{a.fileName} · {a.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {a.budgetDelta > 0 && (
                      <Badge variant="outline" className="text-[10px] border-success/30 text-success bg-success/10">
                        +{formatNum(a.budgetDelta)} ₽
                      </Badge>
                    )}
                    <Badge variant="outline" className={`text-[10px] ${
                      a.status === "confirmed" ? "border-success/30 text-success" : "border-warning/30 text-warning"
                    }`}>
                      {a.status === "confirmed" ? "Подтверждено" : "На проверке"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Дополнительных соглашений нет</p>
          )}
          <p className="text-[10px] text-muted-foreground">
            Изменение бюджета или сроков по договорной кампании возможно только через доп. соглашение.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Audit Log Tab ───
function AuditLogTab({ campaign }: { campaign: Campaign }) {
  const campaignId = campaign.contractLinked ? String(campaign.id) : undefined;
  const { data: contractVersions, isLoading: loadingVersions } = useContractsByCampaign(campaignId);

  const mockAudit: AuditLogEntry[] = campaign.auditLog || [
    { timestamp: "20.02.2026 10:15", action: "Договор загружен", user: "Иванов А.С.", details: "contract_v1.pdf" },
    { timestamp: "20.02.2026 10:16", action: "AI-извлечение данных", user: "Система" },
    { timestamp: "20.02.2026 10:18", action: "Данные подтверждены пользователем", user: "Иванов А.С." },
    { timestamp: "20.02.2026 10:18", action: "Кампания создана из договора", user: "Иванов А.С.", details: "Договор РК-2026/042" },
    { timestamp: "20.02.2026 14:30", action: "Креатив загружен", user: "Иванов А.С.", details: "banner_728x90.png" },
    { timestamp: "20.02.2026 14:32", action: "Креатив отправлен в ОРД", user: "Система" },
    { timestamp: "20.02.2026 14:33", action: "ERID получен", user: "Система", details: "2VfnxxYzBs8" },
    { timestamp: "21.02.2026 09:00", action: "Кампания запущена", user: "Иванов А.С." },
  ];

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4 space-y-1.5">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <p className="text-[15px] font-semibold text-card-foreground">Журнал действий</p>
          </div>
          <p className="text-[13px] text-muted-foreground">Все действия с кампанией, включая импорт договора, изменения и отправки в ОРД.</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="space-y-0">
            {mockAudit.map((entry, i) => (
              <div key={i} className="flex items-start gap-2.5 py-2 border-b border-border/50 last:border-0">
                <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle2 className="h-3 w-3 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] text-card-foreground">{entry.action}</p>
                  {entry.details && (
                    <p className="text-[12px] text-muted-foreground mt-0.5">{entry.details}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 text-right">
                  <span className="text-[12px] text-muted-foreground flex items-center gap-1">
                    <User className="h-2.5 w-2.5" />
                    {entry.user}
                  </span>
                  <span className="text-[12px] text-muted-foreground">{entry.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Version history from DB */}
      {campaign.contractLinked && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold text-card-foreground">Версии документов</p>
              {loadingVersions && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
            <div className="space-y-2">
              {contractVersions && contractVersions.length > 0 ? (
                contractVersions.map((cv) => (
                  <div key={cv.id} className="flex items-center justify-between gap-3 text-sm py-2 px-3 rounded-lg border border-border bg-muted/10">
                    <div className="flex items-center gap-3">
                      {cv.document_type === "original" ? (
                        <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                      ) : (
                        <FilePlus className="h-4 w-4 text-accent flex-shrink-0" />
                      )}
                      <div>
                        <p className="text-xs font-medium text-card-foreground">
                          {cv.document_type === "original" ? "Основной договор" : `Доп. соглашение №${cv.version - 1}`}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {cv.file_name || "—"} · {new Date(cv.created_at).toLocaleDateString("ru-RU")}
                          {cv.confirmed_at && ` · Подтверждён ${new Date(cv.confirmed_at).toLocaleDateString("ru-RU")}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] ${
                        cv.status === "confirmed" ? "border-success/30 text-success" : "border-warning/30 text-warning"
                      }`}>
                        {cv.status === "confirmed" ? "Подтверждён" : "Извлечён"}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] ${
                        cv.document_type === "original" ? "border-primary/30 text-primary" : "border-accent/30 text-accent"
                      }`}>
                        {cv.document_type === "original" ? "Оригинал" : "Доп. соглашение"}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : !loadingVersions ? (
                <>
                  <div className="flex items-center justify-between gap-3 text-sm py-2 px-3 rounded-lg border border-border bg-muted/10">
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-card-foreground">Основной договор</p>
                        <p className="text-[10px] text-muted-foreground">{campaign.contractNumber} · {campaign.contractDate}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">Оригинал</Badge>
                  </div>
                  {(campaign.addenda || []).map((a, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 text-sm py-2 px-3 rounded-lg border border-border bg-muted/10">
                      <div className="flex items-center gap-3">
                        <FilePlus className="h-4 w-4 text-accent flex-shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-card-foreground">{a.title}</p>
                          <p className="text-[10px] text-muted-foreground">{a.fileName} · {a.date}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] border-accent/30 text-accent">Доп. соглашение</Badge>
                    </div>
                  ))}
                </>
              ) : null}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ─── Main CampaignManageView ───
// ═══════════════════════════════════════════════════════
export function CampaignManageView({ campaign: initialCampaign, onBack }: { campaign: Campaign; onBack: () => void }) {
  const [terminateOpen, setTerminateOpen] = useState(false);
  const [campaignStatus, setCampaignStatus] = useState<CampaignStatus>(initialCampaign.status);
  const [changeRequestOpen, setChangeRequestOpen] = useState(false);

  // Enrich campaign with mock ORD data for demo
  const campaign: Campaign = {
    ...initialCampaign,
    status: campaignStatus,
    erid: initialCampaign.erid || (isStarted({ ...initialCampaign, status: campaignStatus }) ? "2VfnxxYzBs8" : undefined),
    ordProvider: initialCampaign.ordProvider || "ОРД Яндекс",
    ordStatus: campaignStatus === "ord_error" ? "error" : initialCampaign.ordStatus || (isStarted({ ...initialCampaign, status: campaignStatus }) ? "connected" : "pending"),
    ordLastSync: initialCampaign.ordLastSync || (isStarted({ ...initialCampaign, status: campaignStatus }) ? "19.02.2026 14:33" : undefined),
    creativeLocked: isStarted({ ...initialCampaign, status: campaignStatus }) || !!initialCampaign.erid,
    // Mock contract data for first campaign
    contractLinked: initialCampaign.contractLinked ?? (initialCampaign.id === 1),
    contractNumber: initialCampaign.contractNumber || (initialCampaign.id === 1 ? "РК-2026/042" : undefined),
    contractDate: initialCampaign.contractDate || (initialCampaign.id === 1 ? "15.02.2026" : undefined),
    contractParty: initialCampaign.contractParty || (initialCampaign.id === 1 ? "ООО «Технологии Будущего»" : undefined),
    contractBudgetFixed: initialCampaign.contractBudgetFixed ?? (initialCampaign.id === 1),
  };

  const canTerminate = campaignStatus === "active" || campaignStatus === "paused";
  const isFinalizing = campaignStatus === "finalizing";
  const isOrdError = campaignStatus === "ord_error";
  const isCompleted = campaignStatus === "completed";
  const fullyLocked = isTerminal(campaign);

  const handleTerminate = () => {
    setTerminateOpen(false);
    setCampaignStatus("finalizing");
    toast.info("Отправляем финальную статистику в ОРД…");
    // Simulate async ORD sync
    setTimeout(() => {
      // Simulate success (80%) or failure (20%)
      if (Math.random() > 0.2) {
        setCampaignStatus("completed");
        toast.success("Кампания завершена. Данные отправлены в ОРД.");
      } else {
        setCampaignStatus("ord_error");
        toast.error("Ошибка отправки данных в ОРД. Повторите попытку.");
      }
    }, 3000);
  };

  const handleRetryOrd = () => {
    setCampaignStatus("finalizing");
    toast.info("Повторная отправка данных в ОРД…");
    setTimeout(() => {
      if (Math.random() > 0.3) {
        setCampaignStatus("completed");
        toast.success("Кампания завершена. Данные отправлены в ОРД.");
      } else {
        setCampaignStatus("ord_error");
        toast.error("Ошибка отправки данных в ОРД. Повторите попытку.");
      }
    }, 3000);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="w-full max-w-[1160px] mx-auto px-6 py-4 space-y-3">

        {/* Compact status banners */}
        {isFinalizing && (
          <div className="flex items-center gap-2.5 rounded-md border border-warning/30 bg-warning/10 px-3 py-2">
            <Loader2 className="h-4 w-4 text-warning animate-spin flex-shrink-0" />
            <p className="text-[14px] text-card-foreground"><span className="font-semibold">Завершение кампании…</span> <span className="text-muted-foreground">Отправляем статистику в ОРД, редактирование недоступно.</span></p>
          </div>
        )}

        {isOrdError && (
          <div className="flex items-center justify-between gap-2.5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
              <p className="text-[14px] text-card-foreground"><span className="font-semibold">Ошибка ОРД</span> <span className="text-muted-foreground">— финальная статистика не доставлена.</span></p>
            </div>
            <Button size="sm" variant="outline" className="h-7 text-[13px] gap-1 border-destructive/30 text-destructive hover:bg-destructive/10" onClick={handleRetryOrd}>
              <RefreshCw className="h-3 w-3" />
              Повторить
            </Button>
          </div>
        )}

        {isCompleted && (
          <div className="flex items-center gap-2.5 rounded-md border border-primary/30 bg-primary/10 px-3 py-2">
            <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
            <p className="text-[14px] text-card-foreground"><span className="font-semibold">Кампания завершена.</span> <span className="text-muted-foreground">Доступны просмотр, экспорт, архивация и дублирование.</span></p>
          </div>
        )}

        {/* Sticky header — Back + title + kebab only */}
        <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-sm -mx-6 px-6 py-2.5 -mt-4 mb-0.5 border-b border-border/50">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Button size="sm" variant="ghost" onClick={onBack} className="h-8 w-8 p-0 flex-shrink-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-[17px] font-bold text-foreground tracking-tight truncate">{campaign.name}</h2>
                  <EridBadge erid={campaign.erid} />
                  <ContractBadge campaign={campaign} />
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className={`text-[11px] ${statusStyles[campaign.status]}`}>
                    {campaign.status === "finalizing" && <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />}
                    {statusLabels[campaign.status]}
                  </Badge>
                  <span className="text-[13px] text-muted-foreground">{placementLabels[campaign.placement]}</span>
                  {campaign.startDate && (
                    <>
                      <Separator orientation="vertical" className="h-3" />
                      <span className="text-[13px] text-muted-foreground flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {campaign.startDate} — {campaign.endDate || "∞"}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Kebab menu — all actions consolidated */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 flex-shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {campaign.status === "active" && (
                  <DropdownMenuItem className="text-[14px] gap-2" disabled={isFinalizing}>
                    <Pause className="h-3.5 w-3.5" /> Приостановить
                  </DropdownMenuItem>
                )}
                {campaign.status === "paused" && (
                  <DropdownMenuItem className="text-[14px] gap-2" disabled={isFinalizing}>
                    <Play className="h-3.5 w-3.5" /> Возобновить
                  </DropdownMenuItem>
                )}
                {campaign.status === "draft" && (
                  <DropdownMenuItem className="text-[14px] gap-2">
                    <Play className="h-3.5 w-3.5" /> Запустить
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className="text-[14px] gap-2">
                  <Copy className="h-3.5 w-3.5" /> Дублировать (новый ERID)
                </DropdownMenuItem>
                {isCompleted && (
                  <DropdownMenuItem className="text-[14px] gap-2">
                    <Download className="h-3.5 w-3.5" /> Экспорт отчёта
                  </DropdownMenuItem>
                )}
                {campaign.contractLinked && !fullyLocked && (
                  <DropdownMenuItem className="text-[14px] gap-2" onClick={() => setChangeRequestOpen(true)}>
                    <ArrowUpRight className="h-3.5 w-3.5" /> Запросить изменение
                  </DropdownMenuItem>
                )}
                {isOrdError && (
                  <DropdownMenuItem className="text-[14px] gap-2 text-destructive" onClick={handleRetryOrd}>
                    <RefreshCw className="h-3.5 w-3.5" /> Повторить ОРД
                  </DropdownMenuItem>
                )}
                {canTerminate && (
                  <DropdownMenuItem className="text-[14px] gap-2 text-destructive" onClick={() => setTerminateOpen(true)}>
                    <StopCircle className="h-3.5 w-3.5" /> Завершить досрочно
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className="text-[14px] gap-2 text-destructive" disabled={isFinalizing}>
                  <Archive className="h-3.5 w-3.5" /> Архивировать
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-3">
          <TabsList>
            <TabsTrigger value="overview" className="text-[14px]">Обзор</TabsTrigger>
            <TabsTrigger value="settings" className="text-[14px]">Настройки</TabsTrigger>
            <TabsTrigger value="creative" className="text-[14px]">Креатив</TabsTrigger>
            <TabsTrigger value="ord" className="text-[14px]">ОРД / Маркировка</TabsTrigger>
            {campaign.contractLinked && <TabsTrigger value="contract" className="text-[14px]">Договор</TabsTrigger>}
            <TabsTrigger value="audit" className="text-[14px]">Аудит</TabsTrigger>
          </TabsList>

          <TabsContent value="overview"><OverviewTab campaign={campaign} /></TabsContent>
          <TabsContent value="settings">
            {fullyLocked ? (
              <div className="flex items-center gap-2.5 rounded-lg border border-muted-foreground/20 bg-muted/10 p-4">
                <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-[14px] font-semibold text-card-foreground">Настройки заблокированы</p>
                  <p className="text-[13px] text-muted-foreground">Кампания {campaign.status === "completed" ? "завершена" : "в процессе завершения"}. Редактирование невозможно.</p>
                </div>
              </div>
            ) : (
              <SettingsTab campaign={campaign} />
            )}
          </TabsContent>
          <TabsContent value="creative"><CreativeTab campaign={campaign} /></TabsContent>
          <TabsContent value="ord"><OrdTab campaign={campaign} /></TabsContent>
          {campaign.contractLinked && (
            <TabsContent value="contract">
              <div className="space-y-4">
                {/* Contract info card */}
                <Card className="border-accent/20 bg-accent/5">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-accent/15 flex items-center justify-center flex-shrink-0">
                        <FileText className="h-5 w-5 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-card-foreground">Договор {campaign.contractNumber}</p>
                          <Badge variant="outline" className="text-[10px] border-accent/30 text-accent bg-accent/10">
                            <Lock className="h-2.5 w-2.5 mr-1" />
                            Зафиксирован
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          от {campaign.contractDate} · {campaign.contractParty}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Budget lock notice */}
                <Card className="border-warning/20">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Lock className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-card-foreground">Бюджет зафиксирован по договору</p>
                        <p className="text-xs text-muted-foreground">
                          Бюджет {formatNum(campaign.budget)} ₽ установлен согласно договору. Уменьшение невозможно.
                          Увеличение допускается только через загрузку дополнительного соглашения.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <AddendumSection campaign={campaign} />
              </div>
            </TabsContent>
          )}
          <TabsContent value="audit"><AuditLogTab campaign={campaign} /></TabsContent>
        </Tabs>
      </div>

      {/* ─── Termination Confirmation Modal ─── */}
      <Dialog open={terminateOpen} onOpenChange={setTerminateOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <StopCircle className="h-5 w-5" />
              Завершить кампанию досрочно?
            </DialogTitle>
            <DialogDescription className="pt-2 space-y-3 text-sm">
              <p>Это действие <strong className="text-card-foreground">необратимо</strong>. После подтверждения:</p>
              <ul className="space-y-2 pl-1">
                <li className="flex items-start gap-2">
                  <Ban className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                  <span>Показ рекламы будет <strong className="text-card-foreground">немедленно остановлен</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <span><strong className="text-card-foreground">Возобновить кампанию будет невозможно</strong> — статус станет «Завершена»</span>
                </li>
                <li className="flex items-start gap-2">
                  <Send className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <span>Финальная статистика будет <strong className="text-card-foreground">отправлена в ОРД</strong> для закрытия маркировки</span>
                </li>
              </ul>
              <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 mt-2">
                <p className="text-xs text-muted-foreground">
                  Чтобы запустить рекламу с другим креативом или настройками, используйте «Дублировать кампанию» — будет создана новая кампания с новым ERID.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button variant="outline" className="text-sm">Отмена</Button>
            </DialogClose>
            <Button variant="destructive" className="text-sm gap-1.5" onClick={handleTerminate}>
              <StopCircle className="h-3.5 w-3.5" />
              Завершить кампанию
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
