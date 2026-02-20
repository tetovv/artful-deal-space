import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft, Eye, MousePointerClick, TrendingUp, BarChart3, Pause, Play,
  MoreVertical, Copy, Archive, Ban, CalendarDays, AlertTriangle, CheckCircle2,
  ImagePlus, ExternalLink, RefreshCw, Send, Info, Globe, Link2, Save,
  Lock, PlusCircle, XCircle, ShieldCheck, ClipboardCopy,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ───
export type CampaignStatus = "active" | "paused" | "draft" | "completed" | "error";
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
};

const statusStyles: Record<CampaignStatus, string> = {
  active: "bg-success/15 text-success border-success/30",
  paused: "bg-warning/15 text-warning border-warning/30",
  draft: "bg-muted text-muted-foreground border-muted-foreground/20",
  completed: "bg-primary/15 text-primary border-primary/30",
  error: "bg-destructive/15 text-destructive border-destructive/30",
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
  return campaign.status === "active" || campaign.status === "paused" || campaign.status === "completed";
}

function hasErid(campaign: Campaign): boolean {
  return !!campaign.erid;
}

function isLocked(campaign: Campaign): boolean {
  return isStarted(campaign) || hasErid(campaign);
}

// ─── ERID Badge ───
function EridBadge({ erid }: { erid?: string }) {
  if (!erid) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 px-3 py-1.5">
      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">ERID</span>
      <span className="text-xs font-mono font-semibold text-primary">{erid}</span>
      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => {
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
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold text-card-foreground leading-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Mock chart ───
function MiniChart({ metric }: { metric: string }) {
  const bars = useMemo(() => Array.from({ length: 14 }, () => 20 + Math.random() * 80), []);
  return (
    <div className="flex items-end gap-[3px] h-32 w-full">
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
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");

  const budgetPercent = campaign.budget > 0 ? Math.min((campaign.spent / campaign.budget) * 100, 100) : 0;
  const daysTotal = campaign.startDate && campaign.endDate
    ? Math.max(1, Math.ceil((new Date(campaign.endDate).getTime() - new Date(campaign.startDate).getTime()) / 86400000))
    : 0;
  const daysElapsed = campaign.startDate
    ? Math.max(0, Math.ceil((Date.now() - new Date(campaign.startDate).getTime()) / 86400000))
    : 0;
  const dailyPace = daysElapsed > 0 ? Math.round(campaign.spent / daysElapsed) : 0;
  const daysRemaining = daysTotal > 0 ? Math.max(0, daysTotal - daysElapsed) : null;

  const hasIssues = campaign.impressions === 0 || campaign.status === "error" || budgetPercent >= 100;

  return (
    <div className="space-y-4">
      {/* ERID + ORD status */}
      {(campaign.erid || campaign.ordStatus) && (
        <div className="flex items-center gap-3 flex-wrap">
          <EridBadge erid={campaign.erid} />
          <OrdStatusIndicator campaign={campaign} />
        </div>
      )}

      {/* Period selector + KPIs */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-card-foreground">Метрики за период</p>
        <div className="flex items-center rounded-lg border border-border bg-card overflow-hidden">
          {(["today", "7d", "30d"] as DateRange[]).map((r) => (
            <button key={r} type="button" onClick={() => setDateRange(r)}
              className={`px-3 py-1.5 text-xs transition-colors ${dateRange === r
                ? "bg-primary/15 text-primary font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              }`}>
              {dateRangeLabels[r]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Показы" value={formatNum(campaign.impressions)} icon={Eye} colorClass="bg-info/15 text-info" />
        <MetricCard label="Клики" value={formatNum(campaign.clicks)} icon={MousePointerClick} colorClass="bg-success/15 text-success" />
        <MetricCard label="CTR" value={`${campaign.ctr}%`} icon={TrendingUp} colorClass="bg-accent/15 text-accent" />
        <MetricCard label="Потрачено" value={`${formatNum(campaign.spent)} ₽`} icon={BarChart3} colorClass="bg-warning/15 text-warning" />
      </div>

      {/* Chart */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-card-foreground">Динамика</p>
            <div className="flex items-center rounded-lg border border-border bg-card overflow-hidden">
              {[
                { key: "impressions", label: "Показы" },
                { key: "clicks", label: "Клики" },
                { key: "spend", label: "Расходы" },
              ].map((m) => (
                <button key={m.key} type="button" onClick={() => setChartMetric(m.key)}
                  className={`px-3 py-1 text-xs transition-colors ${chartMetric === m.key
                    ? "bg-primary/15 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  }`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <MiniChart metric={chartMetric} />
        </CardContent>
      </Card>

      {/* Budget & pacing */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-card-foreground">Бюджет и пейсинг</p>
            {isStarted(campaign) && campaign.status !== "completed" && (
              <Button size="sm" variant="outline" className="h-8 text-sm gap-1.5" onClick={() => setTopUpOpen(!topUpOpen)}>
                <PlusCircle className="h-3.5 w-3.5" />
                Пополнить бюджет
              </Button>
            )}
          </div>

          {topUpOpen && (
            <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
              <Input
                type="number"
                placeholder="Сумма пополнения (₽)"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                className="h-9 flex-1 max-w-[200px]"
              />
              <Button size="sm" className="h-9 text-sm" onClick={() => {
                toast.success(`Бюджет пополнен на ${topUpAmount} ₽`);
                setTopUpOpen(false);
                setTopUpAmount("");
              }}>
                Подтвердить
              </Button>
              <Button size="sm" variant="ghost" className="h-9 text-sm" onClick={() => setTopUpOpen(false)}>
                Отмена
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Потрачено</span>
              <span className="font-medium text-card-foreground">{formatNum(campaign.spent)} / {formatNum(campaign.budget)} ₽</span>
            </div>
            <Progress value={budgetPercent} className="h-2" />
            <div className="flex items-center gap-6 text-xs text-muted-foreground pt-1">
              <span>Дневной темп: <span className="font-medium text-card-foreground">{formatNum(dailyPace)} ₽/день</span></span>
              {daysRemaining !== null && (
                <span>Осталось: <span className="font-medium text-card-foreground">{daysRemaining} дн.</span></span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Diagnostics */}
      {hasIssues && (
        <Card className="border-warning/30">
          <CardContent className="p-5 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
              <p className="text-sm font-semibold text-card-foreground">Почему кампания не откручивается?</p>
            </div>
            <ul className="space-y-1.5 text-sm text-muted-foreground pl-6">
              {budgetPercent >= 100 && <li className="flex items-center gap-2"><Ban className="h-3.5 w-3.5 text-destructive" /> Бюджет исчерпан — пополните бюджет для продолжения</li>}
              {campaign.impressions === 0 && campaign.status === "draft" && <li className="flex items-center gap-2"><Info className="h-3.5 w-3.5 text-warning" /> Кампания в черновике — запустите для показа</li>}
              {campaign.impressions === 0 && campaign.status === "active" && <li className="flex items-center gap-2"><Info className="h-3.5 w-3.5 text-warning" /> Креатив не прошёл модерацию или отсутствует ERID</li>}
              {campaign.status === "error" && <li className="flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5 text-destructive" /> Ошибка ОРД — проверьте вкладку ОРД / Маркировка</li>}
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
function SettingsTab({ campaign }: { campaign: Campaign }) {
  const [hasChanges, setHasChanges] = useState(false);
  const [budgetValue, setBudgetValue] = useState(String(campaign.budget));
  const [startDate, setStartDate] = useState(campaign.startDate);
  const [endDate, setEndDate] = useState(campaign.endDate);
  const [utm, setUtm] = useState({ source: "", medium: "", campaign: "" });

  const started = isStarted(campaign);
  const budgetDecreaseBlocked = started;
  const minBudget = campaign.spent; // Never allow below spent

  const handleBudgetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const num = Number(val);
    if (budgetDecreaseBlocked && num < campaign.budget) {
      toast.error("Уменьшение бюджета запрещено после старта кампании. Используйте «Пополнить бюджет» на вкладке Обзор.");
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
    <div className="space-y-4 relative">
      {hasChanges && (
        <div className="sticky top-0 z-10 flex items-center justify-between bg-warning/10 border border-warning/30 rounded-lg px-4 py-2.5">
          <span className="text-sm text-warning font-medium">Есть несохранённые изменения</span>
          <Button size="sm" className="h-8 text-sm gap-1.5" onClick={() => setHasChanges(false)}>
            <Save className="h-3.5 w-3.5" />
            Сохранить изменения
          </Button>
        </div>
      )}

      {/* Budget & schedule */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <p className="text-sm font-semibold text-card-foreground">Бюджет и расписание</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-muted-foreground">Общий бюджет (₽)</label>
                {budgetDecreaseBlocked && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Lock className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[240px]">
                      <p className="text-xs">Уменьшение бюджета запрещено после старта кампании для обеспечения корректности учёта и маркировки в ОРД. Бюджет можно только увеличить.</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              <Input
                value={budgetValue}
                onChange={handleBudgetChange}
                type="number"
                min={budgetDecreaseBlocked ? campaign.budget : 0}
                className="h-10"
              />
              {budgetDecreaseBlocked && (
                <p className="text-[10px] text-muted-foreground">Мин. значение: {formatNum(campaign.budget)} ₽ (только увеличение)</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Дневной лимит (₽)</label>
              <Input placeholder="Без ограничений" className="h-10" onChange={() => setHasChanges(true)} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-muted-foreground">Дата начала</label>
                {started && <Lock className="h-3 w-3 text-muted-foreground" />}
              </div>
              <LockedField locked={started} reason="Дата начала не может быть изменена после запуска кампании">
                <Input type="date" value={startDate} onChange={handleChange(setStartDate)} className="h-10" readOnly={started} />
              </LockedField>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Дата окончания</label>
              <Input type="date" value={endDate} onChange={handleChange(setEndDate)} className="h-10" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Targeting */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <p className="text-sm font-semibold text-card-foreground">Таргетинг</p>
          <div className="flex items-center gap-2 text-sm">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span className="text-card-foreground font-medium">Все пользователи</span>
            <Badge variant="outline" className="text-[10px] border-muted-foreground/20 text-muted-foreground ml-1">По умолчанию</Badge>
          </div>
          <p className="text-xs text-muted-foreground">Сегментация по аудиториям станет доступна в следующих обновлениях.</p>
        </CardContent>
      </Card>

      {/* UTM */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <p className="text-sm font-semibold text-card-foreground">Трекинг (UTM-параметры)</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">utm_source</label>
              <Input placeholder="mediaos" value={utm.source}
                onChange={(e) => { setUtm({ ...utm, source: e.target.value }); setHasChanges(true); }} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">utm_medium</label>
              <Input placeholder="cpc" value={utm.medium}
                onChange={(e) => { setUtm({ ...utm, medium: e.target.value }); setHasChanges(true); }} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">utm_campaign</label>
              <Input placeholder={campaign.name.toLowerCase().replace(/\s/g, "_")} value={utm.campaign}
                onChange={(e) => { setUtm({ ...utm, campaign: e.target.value }); setHasChanges(true); }} className="h-10" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Policies */}
      <Card className="border-muted-foreground/10">
        <CardContent className="p-5 space-y-2">
          <p className="text-sm font-semibold text-card-foreground">Правила и ограничения</p>
          <ul className="space-y-1.5 text-xs text-muted-foreground leading-relaxed">
            <li>• Одна кампания = один креатив = один ERID</li>
            <li>• Креатив нельзя заменить после получения ERID — создайте новую версию кампании</li>
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
// ─── Creative Tab (read-only after ERID / start) ───
// ═══════════════════════════════════════════════════════
function CreativeTab({ campaign }: { campaign: Campaign }) {
  const locked = isLocked(campaign);
  const creative = mockCreative;

  return (
    <div className="space-y-4">
      {/* Lock notice */}
      {locked && (
        <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <Lock className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-card-foreground">Креатив заблокирован</p>
            <p className="text-xs text-muted-foreground">
              {hasErid(campaign)
                ? "ERID уже выдан для этого креатива. По закону о маркировке рекламы изменение креатива после получения ERID невозможно."
                : "Кампания запущена — изменение креатива невозможно."}
              {" "}Чтобы использовать другой креатив, создайте новую версию кампании.
            </p>
          </div>
        </div>
      )}

      {/* ERID display */}
      {campaign.erid && (
        <EridBadge erid={campaign.erid} />
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-card-foreground">Креатив кампании</p>
        <span className="text-[10px] text-muted-foreground bg-muted/30 rounded px-2 py-1">1 кампания = 1 креатив = 1 ERID</span>
      </div>

      {/* Creative card — read-only */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className="h-20 w-28 rounded-lg bg-muted/30 border border-border flex items-center justify-center flex-shrink-0">
              <ImagePlus className="h-5 w-5 text-muted-foreground/40" />
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-card-foreground">{creative.title}</span>
                <Badge variant="outline" className={`text-[10px] ${creativeStatusStyles[creative.status]}`}>
                  {creativeStatusLabels[creative.status]}
                </Badge>
                {locked && (
                  <Badge variant="outline" className="text-[10px] border-primary/30 text-primary bg-primary/10">
                    <Lock className="h-2.5 w-2.5 mr-1" />
                    Заблокирован
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Link2 className="h-3 w-3" />
                <span className="truncate">{creative.url}</span>
                <ExternalLink className="h-3 w-3 flex-shrink-0" />
              </div>
              {campaign.erid && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck className="h-3 w-3" />
                  <span>ERID: <span className="font-mono font-medium text-card-foreground">{campaign.erid}</span></span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <p className="text-sm font-semibold text-card-foreground">Предпросмотр размещения</p>
          <div className="rounded-lg border border-border bg-muted/20 p-4 flex flex-col items-center justify-center gap-2 min-h-[120px]">
            <div className="rounded-lg bg-primary/10 border border-primary/20 px-6 py-3 text-center max-w-xs">
              <p className="text-xs font-semibold text-primary">{creative.title}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Реклама · {placementLabels[campaign.placement]}</p>
              {campaign.erid && (
                <p className="text-[9px] text-muted-foreground/60 mt-0.5">erid: {campaign.erid}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Duplicate CTA */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-card-foreground">Нужен другой креатив?</p>
              <p className="text-xs text-muted-foreground">
                Создайте новую версию кампании с новым креативом. Будет зарегистрирован новый ERID.
              </p>
            </div>
            <Button size="sm" variant="outline" className="h-9 text-sm gap-1.5 flex-shrink-0 border-primary/30 text-primary hover:bg-primary/10">
              <Copy className="h-3.5 w-3.5" />
              Дублировать кампанию
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ─── ORD / Marking Tab ───
// ═══════════════════════════════════════════════════════
function OrdTab({ campaign }: { campaign: Campaign }) {
  const ordStatus = campaign.ordStatus || "connected";
  const ordProvider = campaign.ordProvider || "ОРД Яндекс";

  return (
    <div className="space-y-4">
      {/* Connection status */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <p className="text-sm font-semibold text-card-foreground">Подключение к ОРД</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                ordStatus === "connected" ? "bg-success/15" : ordStatus === "error" ? "bg-destructive/15" : "bg-warning/15"
              }`}>
                {ordStatus === "connected" ? <CheckCircle2 className="h-4 w-4 text-success" /> :
                 ordStatus === "error" ? <XCircle className="h-4 w-4 text-destructive" /> :
                 <Info className="h-4 w-4 text-warning" />}
              </div>
              <div>
                <p className="text-sm font-medium text-card-foreground">{ordProvider}</p>
                <p className="text-xs text-muted-foreground">
                  {ordStatus === "connected" && `Активно · последняя синхронизация ${campaign.ordLastSync || "—"}`}
                  {ordStatus === "error" && "Ошибка соединения — повторите попытку"}
                  {ordStatus === "pending" && "Ожидает подключения"}
                </p>
              </div>
            </div>
            <Button size="sm" variant="outline" className="h-8 text-sm gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Переподключить
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ERID */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <p className="text-sm font-semibold text-card-foreground">Идентификатор маркировки (ERID)</p>
          {campaign.erid ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-border">
                <ShieldCheck className="h-5 w-5 text-success flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">ERID</p>
                  <p className="text-base font-mono font-bold text-card-foreground tracking-wide">{campaign.erid}</p>
                </div>
                <Button size="sm" variant="outline" className="h-8 text-sm gap-1.5" onClick={() => {
                  navigator.clipboard.writeText(campaign.erid!);
                  toast.success("ERID скопирован в буфер обмена");
                }}>
                  <ClipboardCopy className="h-3.5 w-3.5" />
                  Копировать
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                ERID привязан к креативу этой кампании. Для нового креатива потребуется новый ERID (через дублирование кампании).
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
              <Info className="h-4 w-4 text-warning flex-shrink-0" />
              <p className="text-xs text-muted-foreground">ERID будет получен автоматически после отправки креатива в ОРД и его одобрения.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Campaign ORD ID */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <p className="text-sm font-semibold text-card-foreground">Идентификаторы в ОРД</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">ID кампании в ОРД</span>
              <p className="font-mono text-card-foreground text-xs bg-muted/30 rounded px-2 py-1.5 border border-border">
                ord-camp-2026-0219-a1b2
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Провайдер</span>
              <p className="text-card-foreground text-xs bg-muted/30 rounded px-2 py-1.5 border border-border">
                {ordProvider}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delivery log */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-card-foreground">Журнал отправок</p>
            <Button size="sm" variant="ghost" className="h-8 text-sm gap-1.5 text-muted-foreground">
              <Send className="h-3.5 w-3.5" />
              Повторить отправку
            </Button>
          </div>
          <div className="space-y-2">
            {mockOrdEvents.map((ev, i) => (
              <div key={i} className="flex items-center gap-3 text-sm py-1.5 border-b border-border/50 last:border-0">
                {ev.status === "ok"
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-success flex-shrink-0" />
                  : <AlertTriangle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />}
                <span className="flex-1 text-card-foreground text-xs">{ev.action}</span>
                <span className="text-[10px] text-muted-foreground flex-shrink-0">{ev.date}</span>
                {ev.status === "error" && (
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-destructive">
                    Повторить
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ─── Main CampaignManageView ───
// ═══════════════════════════════════════════════════════
export function CampaignManageView({ campaign: initialCampaign, onBack }: { campaign: Campaign; onBack: () => void }) {
  // Enrich campaign with mock ORD data for demo
  const campaign: Campaign = {
    ...initialCampaign,
    erid: initialCampaign.erid || (isStarted(initialCampaign) ? "2VfnxxYzBs8" : undefined),
    ordProvider: initialCampaign.ordProvider || "ОРД Яндекс",
    ordStatus: initialCampaign.ordStatus || (isStarted(initialCampaign) ? "connected" : "pending"),
    ordLastSync: initialCampaign.ordLastSync || (isStarted(initialCampaign) ? "19.02.2026 14:33" : undefined),
    creativeLocked: isStarted(initialCampaign) || !!initialCampaign.erid,
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="w-full max-w-[1120px] mx-auto px-6 py-6 space-y-5">
        {/* Sticky header */}
        <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-sm -mx-6 px-6 py-3 -mt-6 mb-1 border-b border-border/50">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Button size="sm" variant="ghost" onClick={onBack} className="h-9 w-9 p-0 flex-shrink-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-foreground tracking-tight truncate">{campaign.name}</h2>
                  <EridBadge erid={campaign.erid} />
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className={`text-[10px] ${statusStyles[campaign.status]}`}>
                    {statusLabels[campaign.status]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{placementLabels[campaign.placement]}</span>
                  <OrdStatusIndicator campaign={campaign} />
                  {campaign.startDate && (
                    <>
                      <Separator orientation="vertical" className="h-3" />
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {campaign.startDate} — {campaign.endDate || "∞"}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {campaign.status === "active" && (
                <Button size="sm" variant="outline" className="h-9 text-sm gap-1.5">
                  <Pause className="h-3.5 w-3.5" />
                  Приостановить
                </Button>
              )}
              {campaign.status === "paused" && (
                <Button size="sm" className="h-9 text-sm gap-1.5">
                  <Play className="h-3.5 w-3.5" />
                  Возобновить
                </Button>
              )}
              {campaign.status === "draft" && (
                <Button size="sm" className="h-9 text-sm gap-1.5">
                  <Play className="h-3.5 w-3.5" />
                  Запустить
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-9 w-9 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="text-sm gap-2">
                    <Copy className="h-3.5 w-3.5" /> Дублировать (новый ERID)
                  </DropdownMenuItem>
                  {(campaign.status === "active" || campaign.status === "paused") && (
                    <DropdownMenuItem className="text-sm gap-2">
                      <Ban className="h-3.5 w-3.5" /> Завершить досрочно
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem className="text-sm gap-2 text-destructive">
                    <Archive className="h-3.5 w-3.5" /> Архивировать
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-5">
          <TabsList>
            <TabsTrigger value="overview" className="text-sm">Обзор</TabsTrigger>
            <TabsTrigger value="settings" className="text-sm">Настройки</TabsTrigger>
            <TabsTrigger value="creative" className="text-sm">Креатив</TabsTrigger>
            <TabsTrigger value="ord" className="text-sm">ОРД / Маркировка</TabsTrigger>
          </TabsList>

          <TabsContent value="overview"><OverviewTab campaign={campaign} /></TabsContent>
          <TabsContent value="settings"><SettingsTab campaign={campaign} /></TabsContent>
          <TabsContent value="creative"><CreativeTab campaign={campaign} /></TabsContent>
          <TabsContent value="ord"><OrdTab campaign={campaign} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
