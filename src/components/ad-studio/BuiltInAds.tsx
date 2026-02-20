import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, BarChart3, Eye, MousePointerClick, TrendingUp, AlertTriangle } from "lucide-react";

interface BuiltInAdsProps {
  isVerified: boolean;
  onGoToSettings: () => void;
}

const mockCampaigns = [
  { id: 1, name: "Баннер в каталоге", status: "active", impressions: 12400, clicks: 340, ctr: 2.7, budget: 15000, spent: 4800 },
  { id: 2, name: "Промо в ленте подписок", status: "paused", impressions: 8200, clicks: 190, ctr: 2.3, budget: 10000, spent: 7200 },
  { id: 3, name: "Рекомендации — карточка", status: "draft", impressions: 0, clicks: 0, ctr: 0, budget: 5000, spent: 0 },
];

export function BuiltInAds({ isVerified, onGoToSettings }: BuiltInAdsProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      {/* Verification banner */}
      {!isVerified && (
        <div className="mx-4 mt-4 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Пройдите верификацию</p>
            <p className="text-xs text-muted-foreground">Для создания рекламных кампаний необходимо подтвердить реквизиты ИП/ООО и подключить ОРД</p>
          </div>
          <Button size="sm" variant="outline" onClick={onGoToSettings} className="shrink-0">
            Настроить
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="p-4 border-b border-border bg-card flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Встроенная реклама</h2>
          <p className="text-xs text-muted-foreground">Размещайте рекламу на платформе без участия авторов</p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button size="sm" disabled={!isVerified}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Новая кампания
              </Button>
            </span>
          </TooltipTrigger>
          {!isVerified && (
            <TooltipContent><p className="text-xs">Пройдите верификацию в Настройках</p></TooltipContent>
          )}
        </Tooltip>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-4 gap-3 p-4">
        {[
          { label: "Показы", value: "20.6K", icon: Eye, color: "text-blue-500" },
          { label: "Клики", value: "530", icon: MousePointerClick, color: "text-green-500" },
          { label: "CTR", value: "2.5%", icon: TrendingUp, color: "text-purple-500" },
          { label: "Потрачено", value: "12 000 ₽", icon: BarChart3, color: "text-orange-500" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-3 flex items-center gap-3">
              <stat.icon className={`h-5 w-5 ${stat.color} shrink-0`} />
              <div>
                <p className="text-lg font-bold text-foreground">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Campaign list */}
      <div className="px-4 pb-4 space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Кампании</p>
        {mockCampaigns.map((c) => (
          <Card key={c.id} className="hover:border-primary/30 transition-colors">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{c.name}</p>
                  <Badge variant={c.status === "active" ? "default" : "secondary"} className="text-[10px]">
                    {c.status === "active" ? "Активна" : c.status === "paused" ? "Пауза" : "Черновик"}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {c.impressions.toLocaleString()}</span>
                  <span className="flex items-center gap-1"><MousePointerClick className="h-3 w-3" /> {c.clicks}</span>
                  <span>CTR: {c.ctr}%</span>
                  <span>{c.spent.toLocaleString()} / {c.budget.toLocaleString()} ₽</span>
                </div>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button size="sm" variant="outline" disabled={!isVerified} className="text-xs">
                      Управлять
                    </Button>
                  </span>
                </TooltipTrigger>
                {!isVerified && (
                  <TooltipContent><p className="text-xs">Пройдите верификацию</p></TooltipContent>
                )}
              </Tooltip>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
