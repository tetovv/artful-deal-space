import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, AreaChart, Area, PieChart, Pie, Cell } from "recharts";
import { ChartTypeSelector, type ChartType } from "@/components/ChartTypeSelector";
import { TrendingUp, Hash, Percent, Target, Trophy, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PromoCode {
  id: string;
  code: string;
  discount_percent: number;
  used_count: number;
  max_uses: number | null;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
}

interface PromoAnalyticsProps {
  promos: PromoCode[];
}

const PIE_COLORS = [
  "hsl(210, 100%, 52%)",
  "hsl(170, 80%, 44%)",
  "hsl(38, 92%, 50%)",
  "hsl(280, 60%, 55%)",
  "hsl(0, 72%, 51%)",
  "hsl(152, 60%, 42%)",
];

const usageChartConfig: ChartConfig = {
  used_count: { label: "Использований", color: "hsl(var(--primary))" },
};

const conversionChartConfig: ChartConfig = {
  conversion: { label: "Конверсия %", color: "hsl(var(--accent))" },
};

export function PromoAnalytics({ promos }: PromoAnalyticsProps) {
  const [chartType, setChartType] = useState<ChartType>("bar");

  const stats = useMemo(() => {
    const totalUses = promos.reduce((s, p) => s + p.used_count, 0);
    const activeCount = promos.filter((p) => p.is_active).length;
    const avgDiscount =
      promos.length > 0
        ? Math.round(promos.reduce((s, p) => s + p.discount_percent, 0) / promos.length)
        : 0;
    const avgConversion =
      promos.filter((p) => p.max_uses).length > 0
        ? Math.round(
            (promos
              .filter((p) => p.max_uses)
              .reduce((s, p) => s + (p.used_count / p.max_uses!) * 100, 0) /
              promos.filter((p) => p.max_uses).length)
          )
        : 0;
    return { totalUses, activeCount, avgDiscount, avgConversion };
  }, [promos]);

  const topCodes = useMemo(
    () => [...promos].sort((a, b) => b.used_count - a.used_count).slice(0, 6),
    [promos]
  );

  const pieData = useMemo(
    () =>
      topCodes
        .filter((p) => p.used_count > 0)
        .map((p) => ({ name: p.code, value: p.used_count })),
    [topCodes]
  );

  const conversionData = useMemo(
    () =>
      promos
        .filter((p) => p.max_uses && p.max_uses > 0)
        .sort((a, b) => b.used_count / b.max_uses! - a.used_count / a.max_uses!)
        .slice(0, 8)
        .map((p) => ({
          code: p.code,
          conversion: Math.round((p.used_count / p.max_uses!) * 100),
        })),
    [promos]
  );

  const usageByMonth = useMemo(() => {
    const months: Record<string, number> = {};
    promos.forEach((p) => {
      const d = new Date(p.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months[key] = (months[key] || 0) + p.used_count;
    });
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, used_count]) => ({
        month: new Date(month + "-01").toLocaleDateString("ru-RU", {
          month: "short",
        }),
        used_count,
      }));
  }, [promos]);

  if (promos.length === 0) return null;

  const STAT_CARDS = [
    { label: "Всего использований", value: stats.totalUses, icon: Hash, color: "text-primary" },
    { label: "Активных кодов", value: stats.activeCount, icon: Target, color: "text-success" },
    { label: "Средняя скидка", value: `${stats.avgDiscount}%`, icon: Percent, color: "text-warning" },
    { label: "Ср. конверсия", value: `${stats.avgConversion}%`, icon: TrendingUp, color: "text-accent" },
  ];

  return (
    <div className="space-y-4">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {STAT_CARDS.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0")}>
                <s.icon className={cn("h-4 w-4", s.color)} />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold text-foreground leading-tight">{s.value}</p>
                <p className="text-[11px] text-muted-foreground truncate">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Usage Over Time Chart */}
        {usageByMonth.length > 0 && (
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold">Использование по месяцам</CardTitle>
              <ChartTypeSelector value={chartType} onChange={setChartType} />
            </CardHeader>
            <CardContent className="pb-4">
              <ChartContainer config={usageChartConfig} className="h-[200px] w-full">
                {chartType === "bar" ? (
                  <BarChart data={usageByMonth}>
                    <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis tickLine={false} axisLine={false} fontSize={11} width={30} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="used_count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                ) : chartType === "area" ? (
                  <AreaChart data={usageByMonth}>
                    <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis tickLine={false} axisLine={false} fontSize={11} width={30} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="used_count"
                      fill="hsl(var(--primary) / 0.2)"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                    />
                  </AreaChart>
                ) : (
                  <AreaChart data={usageByMonth}>
                    <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis tickLine={false} axisLine={false} fontSize={11} width={30} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="used_count"
                      fill="transparent"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                    />
                  </AreaChart>
                )}
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        {/* Pie: Distribution */}
        {pieData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Распределение использований</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 flex items-center gap-4">
              <ChartContainer config={usageChartConfig} className="h-[200px] w-1/2">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="space-y-1.5 flex-1 min-w-0">
                {pieData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <div
                      className="h-2.5 w-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    <span className="truncate text-muted-foreground">{d.name}</span>
                    <span className="ml-auto font-medium text-foreground">{d.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Conversion Chart */}
        {conversionData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Конверсия промокодов</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <ChartContainer config={conversionChartConfig} className="h-[200px] w-full">
                <BarChart data={conversionData} layout="vertical">
                  <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} domain={[0, 100]} />
                  <YAxis type="category" dataKey="code" tickLine={false} axisLine={false} fontSize={11} width={70} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="conversion" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        {/* Top Codes Table */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center gap-2">
            <Trophy className="h-4 w-4 text-warning" />
            <CardTitle className="text-sm font-semibold">Топ промокоды</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="space-y-2">
              {topCodes.map((p, i) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-muted/50 transition-colors"
                >
                  <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <code className="text-sm font-semibold tracking-wide">{p.code}</code>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="secondary" className="text-[10px]">
                        -{p.discount_percent}%
                      </Badge>
                      {p.is_active ? (
                        <Badge className="bg-success/10 text-success text-[10px]">Активен</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Отключён</Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-foreground">{p.used_count}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {p.max_uses ? `из ${p.max_uses}` : "∞"}
                    </p>
                  </div>
                </div>
              ))}
              {topCodes.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Нет данных</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
