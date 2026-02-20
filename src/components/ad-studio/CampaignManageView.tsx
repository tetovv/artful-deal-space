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
  ImagePlus, ExternalLink, RefreshCw, Send, Info, Globe, Link2, Pencil, Save,
} from "lucide-react";

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

// ─── Mock chart data ───
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

// ─── Mock creatives ───
interface Creative {
  id: number;
  title: string;
  url: string;
  status: "approved" | "pending" | "rejected";
  reason?: string;
}

const mockCreatives: Creative[] = [
  { id: 1, title: "Баннер весна 728×90", url: "https://example.com/promo", status: "approved" },
  { id: 2, title: "Карточка подписка", url: "https://example.com/sub", status: "pending" },
  { id: 3, title: "Баннер летний", url: "https://example.com/summer", status: "rejected", reason: "Текст перекрывает логотип, некорректная маркировка" },
];

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
  { date: "2026-02-19 14:32", action: "Отправка креатива #1 в ОРД", status: "ok" },
  { date: "2026-02-19 14:33", action: "Получен erid для креатива #1", status: "ok" },
  { date: "2026-02-18 09:10", action: "Отправка статистики за 17.02", status: "ok" },
  { date: "2026-02-17 09:11", action: "Отправка статистики за 16.02", status: "error" },
  { date: "2026-02-16 14:00", action: "Регистрация кампании в ОРД", status: "ok" },
];

// ─── Overview Tab ───
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

  const hasIssues = campaign.impressions === 0 || campaign.status === "error" || budgetPercent >= 100;

  return (
    <div className="space-y-4">
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
          <p className="text-sm font-semibold text-card-foreground">Бюджет и пейсинг</p>
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
              {budgetPercent >= 100 && <li className="flex items-center gap-2"><Ban className="h-3.5 w-3.5 text-destructive" /> Бюджет исчерпан</li>}
              {campaign.impressions === 0 && campaign.status === "draft" && <li className="flex items-center gap-2"><Info className="h-3.5 w-3.5 text-warning" /> Кампания в черновике — запустите для показа</li>}
              {campaign.impressions === 0 && campaign.status === "active" && <li className="flex items-center gap-2"><Info className="h-3.5 w-3.5 text-warning" /> Нет креативов или креатив не прошёл модерацию</li>}
              {campaign.status === "error" && <li className="flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5 text-destructive" /> Ошибка верификации/ОРД — проверьте вкладку ОРД</li>}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Placement preview */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <p className="text-sm font-semibold text-card-foreground">Предпросмотр размещения</p>
          <div className="rounded-lg border border-border bg-muted/20 p-4 flex flex-col items-center justify-center gap-2 min-h-[120px]">
            <div className="rounded-lg bg-primary/10 border border-primary/20 px-6 py-3 text-center max-w-xs">
              <p className="text-xs font-semibold text-primary">{campaign.name}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Реклама · {placementLabels[campaign.placement]}</p>
            </div>
            <p className="text-[10px] text-muted-foreground">Примерный вид {placementLabels[campaign.placement].toLowerCase()}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Settings Tab ───
function SettingsTab({ campaign }: { campaign: Campaign }) {
  const [hasChanges, setHasChanges] = useState(false);
  const [budgetValue, setBudgetValue] = useState(String(campaign.budget));
  const [startDate, setStartDate] = useState(campaign.startDate);
  const [endDate, setEndDate] = useState(campaign.endDate);
  const [utm, setUtm] = useState({ source: "", medium: "", campaign: "" });

  const handleChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    setHasChanges(true);
  };

  return (
    <div className="space-y-4 relative">
      {/* Unsaved indicator */}
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
              <label className="text-xs text-muted-foreground">Общий бюджет (₽)</label>
              <Input value={budgetValue} onChange={handleChange(setBudgetValue)} type="number" className="h-10" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Дневной лимит (₽)</label>
              <Input placeholder="Без ограничений" className="h-10" onChange={() => setHasChanges(true)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Дата начала</label>
              <Input type="date" value={startDate} onChange={handleChange(setStartDate)} className="h-10" />
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

      {/* UTM tracking */}
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
          <p className="text-sm font-semibold text-card-foreground">Требования и политики</p>
          <ul className="space-y-1.5 text-xs text-muted-foreground leading-relaxed">
            <li>• Все креативы должны содержать маркировку «Реклама» и erid</li>
            <li>• Максимальный размер баннера: 2 МБ (PNG, JPG, GIF)</li>
            <li>• Запрещён контент, нарушающий законодательство РФ о рекламе</li>
            <li>• Статистика передаётся в ОРД автоматически ежедневно</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Creatives Tab ───
function CreativesTab() {
  const [showAddForm, setShowAddForm] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-card-foreground">Креативы кампании</p>
        <Button size="sm" variant="outline" className="h-8 text-sm gap-1.5" onClick={() => setShowAddForm(!showAddForm)}>
          <ImagePlus className="h-3.5 w-3.5" />
          Добавить креатив
        </Button>
      </div>

      {/* Add creative form */}
      {showAddForm && (
        <Card className="border-primary/30">
          <CardContent className="p-5 space-y-4">
            <p className="text-sm font-semibold text-card-foreground">Новый креатив</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Название</label>
                <Input placeholder="Баннер 728×90" className="h-10" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Целевой URL</label>
                <Input placeholder="https://example.com/landing" className="h-10" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Изображение</label>
              <div className="rounded-lg border border-dashed border-border bg-muted/20 h-28 flex items-center justify-center cursor-pointer hover:border-primary/40 transition-colors">
                <div className="text-center">
                  <ImagePlus className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">Перетащите файл или нажмите для загрузки</p>
                  <p className="text-[10px] text-muted-foreground/60">PNG, JPG, GIF · макс. 2 МБ</p>
                </div>
              </div>
            </div>
            {/* Live preview */}
            <div className="rounded-lg border border-border bg-muted/10 p-3">
              <p className="text-[10px] text-muted-foreground mb-2">Предпросмотр</p>
              <div className="rounded bg-primary/10 border border-primary/20 px-4 py-2 text-center">
                <p className="text-xs font-medium text-primary">Ваш баннер</p>
                <p className="text-[10px] text-muted-foreground">Реклама</p>
              </div>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <Button size="sm" variant="ghost" className="h-8 text-sm" onClick={() => setShowAddForm(false)}>Отмена</Button>
              <Button size="sm" className="h-8 text-sm">Добавить</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Creative list */}
      <div className="space-y-3">
        {mockCreatives.map((cr) => (
          <Card key={cr.id}>
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                {/* Thumbnail placeholder */}
                <div className="h-16 w-24 rounded-lg bg-muted/30 border border-border flex items-center justify-center flex-shrink-0">
                  <ImagePlus className="h-5 w-5 text-muted-foreground/40" />
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-card-foreground">{cr.title}</span>
                    <Badge variant="outline" className={`text-[10px] ${creativeStatusStyles[cr.status]}`}>
                      {creativeStatusLabels[cr.status]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Link2 className="h-3 w-3" />
                    <span className="truncate">{cr.url}</span>
                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  </div>
                  {cr.status === "rejected" && cr.reason && (
                    <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-2 py-1">
                      Причина: {cr.reason}
                    </p>
                  )}
                </div>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 flex-shrink-0">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── ORD Tab ───
function OrdTab() {
  return (
    <div className="space-y-4">
      {/* Connection status */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <p className="text-sm font-semibold text-card-foreground">Подключение к ОРД</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-success/15 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-success" />
              </div>
              <div>
                <p className="text-sm font-medium text-card-foreground">ОРД Яндекс</p>
                <p className="text-xs text-muted-foreground">Активно · последняя синхронизация 19.02.2026 14:33</p>
              </div>
            </div>
            <Button size="sm" variant="outline" className="h-8 text-sm gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Переподключить
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Marking identifiers */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <p className="text-sm font-semibold text-card-foreground">Идентификаторы маркировки</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">ID кампании в ОРД</span>
              <p className="font-mono text-card-foreground text-xs bg-muted/30 rounded px-2 py-1.5 border border-border">
                ord-camp-2026-0219-a1b2
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">erid</span>
              <p className="font-mono text-card-foreground text-xs bg-muted/30 rounded px-2 py-1.5 border border-border">
                2VfnxxYzBs8
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
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main CampaignManageView ───
export function CampaignManageView({ campaign, onBack }: { campaign: Campaign; onBack: () => void }) {
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
                <h2 className="text-base font-bold text-foreground tracking-tight truncate">{campaign.name}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className={`text-[10px] ${statusStyles[campaign.status]}`}>
                    {statusLabels[campaign.status]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{placementLabels[campaign.placement]}</span>
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
                  <DropdownMenuItem className="text-sm gap-2"><Copy className="h-3.5 w-3.5" /> Дублировать</DropdownMenuItem>
                  <DropdownMenuItem className="text-sm gap-2"><Ban className="h-3.5 w-3.5" /> Завершить</DropdownMenuItem>
                  <DropdownMenuItem className="text-sm gap-2 text-destructive"><Archive className="h-3.5 w-3.5" /> Архивировать</DropdownMenuItem>
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
            <TabsTrigger value="creatives" className="text-sm">Креативы</TabsTrigger>
            <TabsTrigger value="ord" className="text-sm">ОРД / Маркировка</TabsTrigger>
          </TabsList>

          <TabsContent value="overview"><OverviewTab campaign={campaign} /></TabsContent>
          <TabsContent value="settings"><SettingsTab campaign={campaign} /></TabsContent>
          <TabsContent value="creatives"><CreativesTab /></TabsContent>
          <TabsContent value="ord"><OrdTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
