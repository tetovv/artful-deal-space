import { contentItems, purchasedItems } from "@/data/mockData";
import { ContentCard } from "@/components/content/ContentCard";
import {
  Plus, DollarSign, BarChart3, Package, Eye, Heart, TrendingUp, Clock, Star,
  Trash2, Edit, PieChart, Activity, ArrowUpRight, ArrowDownRight, Crown, Flame,
  FileText, Video, Image, Music, Mic, BookOpen, Layout, ChevronRight, ArrowUpDown, Filter, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useContentItems } from "@/hooks/useDbData";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart as RePieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(var(--accent))", "hsl(var(--warning))", "hsl(var(--success))", "hsl(var(--info))"];
const TYPE_LABELS: Record<string, string> = { video: "Видео", post: "Пост", image: "Фото", music: "Музыка", podcast: "Подкаст", book: "Книга", template: "Шаблон" };
const TYPE_ICONS: Record<string, React.ElementType> = { video: Video, post: FileText, image: Image, music: Music, podcast: Mic, book: BookOpen, template: Layout };

const tooltipStyle = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 };

function mapItem(item: any) {
  return {
    id: item.id, title: item.title, description: item.description || "", type: item.type,
    thumbnail: item.thumbnail || "", creatorId: item.creator_id || item.creatorId || "",
    creatorName: item.creator_name || item.creatorName || "", creatorAvatar: item.creator_avatar || item.creatorAvatar || "",
    price: item.price ?? null, views: item.views || 0, likes: item.likes || 0,
    createdAt: item.created_at || item.createdAt || "", tags: item.tags || [],
  };
}

function MiniStat({ icon: Icon, label, value, trend, trendUp }: { icon: React.ElementType; label: string; value: string | number; trend?: string; trendUp?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 hover:shadow-lg hover:border-primary/20 transition-all duration-300">
      <div className="flex items-center justify-between mb-2">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        {trend && (
          <span className={cn("text-[11px] font-medium flex items-center gap-0.5", trendUp ? "text-success" : "text-destructive")}>
            {trendUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {trend}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-card-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

const CreatorStudio = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: dbItems } = useContentItems();
  const [analyticsItemId, setAnalyticsItemId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string>("date");
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const allItems = (dbItems && dbItems.length > 0 ? dbItems : contentItems).map(mapItem);
  const myItems = allItems.filter((i) => i.creatorId === user?.id || i.creatorId === "u1");

  // Deals
  const { data: dbDeals = [] } = useQuery({
    queryKey: ["creator-studio-deals", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase.from("deals").select("*").or(`creator_id.eq.${user.id}`).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Stats
  const totalViews = myItems.reduce((s, i) => s + i.views, 0);
  const totalLikes = myItems.reduce((s, i) => s + i.likes, 0);
  const totalRevenue = myItems.reduce((s, i) => s + (i.price || 0), 0);
  const completedDeals = dbDeals.filter((d: any) => d.status === "completed");
  const dealsEarned = completedDeals.reduce((s: number, d: any) => s + (d.budget || 0), 0);

  // Top products by views
  const topByViews = useMemo(() => [...myItems].sort((a, b) => b.views - a.views).slice(0, 5), [myItems]);
  // Top products by revenue
  const topByRevenue = useMemo(() => [...myItems].filter(i => i.price).sort((a, b) => (b.price || 0) - (a.price || 0)).slice(0, 5), [myItems]);
  // Recent publications
  const recentItems = useMemo(() => [...myItems].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 6), [myItems]);

  // Content by type
  const contentByType = useMemo(() => {
    const types: Record<string, number> = {};
    myItems.forEach((i) => { types[i.type] = (types[i.type] || 0) + 1; });
    if (Object.keys(types).length === 0) return [{ name: "Видео", value: 3 }, { name: "Пост", value: 2 }, { name: "Фото", value: 1 }];
    return Object.entries(types).map(([k, v]) => ({ name: TYPE_LABELS[k] || k, value: v }));
  }, [myItems]);

  // Views chart data (6 months trend)
  const viewsChartData = useMemo(() => {
    const months = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн"];
    return months.map((m, i) => ({
      name: m,
      views: Math.max(0, totalViews > 0 ? Math.round(totalViews * (0.4 + i * 0.12)) : Math.round(800 + i * 350)),
      likes: Math.max(0, totalLikes > 0 ? Math.round(totalLikes * (0.3 + i * 0.14)) : Math.round(50 + i * 40)),
    }));
  }, [totalViews, totalLikes]);

  // Engagement rate chart
  const engagementData = useMemo(() => {
    const months = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн"];
    return months.map((m, i) => ({
      name: m,
      rate: +(2.4 + i * 0.35 + Math.random() * 0.5).toFixed(1),
      subscribers: Math.round(1200 + i * 450 + Math.random() * 200),
    }));
  }, []);

  // Revenue chart
  const revenueChartData = useMemo(() => {
    const months = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн"];
    return months.map((m, i) => ({
      name: m,
      revenue: Math.max(0, totalRevenue > 0 ? Math.round(totalRevenue * (0.15 + i * 0.17)) : Math.round(3000 + i * 5000)),
      deals: Math.max(0, dealsEarned > 0 ? Math.round(dealsEarned * (0.1 + i * 0.18)) : Math.round(2000 + i * 4000)),
    }));
  }, [totalRevenue, dealsEarned]);

  // Top categories by views
  const topCategories = useMemo(() => {
    const cats: Record<string, { views: number; likes: number; count: number }> = {};
    myItems.forEach((i) => {
      i.tags.forEach((t) => {
        if (!cats[t]) cats[t] = { views: 0, likes: 0, count: 0 };
        cats[t].views += i.views;
        cats[t].likes += i.likes;
        cats[t].count += 1;
      });
    });
    return Object.entries(cats).sort((a, b) => b[1].views - a[1].views).slice(0, 6).map(([name, d]) => ({ name, ...d }));
  }, [myItems]);

  const engagementRate = totalViews > 0 ? ((totalLikes / totalViews) * 100).toFixed(1) : "0";
  const avgViews = myItems.length > 0 ? Math.round(totalViews / myItems.length) : 0;

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("content_items").delete().eq("id", id);
    if (error) { toast.error("Ошибка при удалении"); return; }
    toast.success("Контент удалён");
  };

  const analyticsItem = analyticsItemId ? myItems.find(i => i.id === analyticsItemId) : null;

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Студия автора</h1>
          <p className="text-sm text-muted-foreground">Контент, аналитика и монетизация</p>
        </div>
        <Button><Plus className="h-4 w-4 mr-2" /> Создать</Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <MiniStat icon={Package} label="Публикаций" value={myItems.length} trend="+3" trendUp />
        <MiniStat icon={Eye} label="Просмотров" value={totalViews > 1000 ? `${(totalViews / 1000).toFixed(1)}K` : totalViews} trend="+12%" trendUp />
        <MiniStat icon={Heart} label="Лайков" value={totalLikes} trend="+8%" trendUp />
        <MiniStat icon={DollarSign} label="Доход" value={`₽${totalRevenue > 1000 ? `${(totalRevenue / 1000).toFixed(0)}K` : totalRevenue}`} trend="+15%" trendUp />
        <MiniStat icon={Activity} label="Engagement" value={`${engagementRate}%`} trend="+0.3%" trendUp />
        <MiniStat icon={BarChart3} label="Ср. просмотры" value={avgViews > 1000 ? `${(avgViews / 1000).toFixed(1)}K` : avgViews} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="analytics" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="analytics">📊 Аналитика</TabsTrigger>
          <TabsTrigger value="content">📦 Контент</TabsTrigger>
          <TabsTrigger value="top">🏆 Топы</TabsTrigger>
          <TabsTrigger value="library">📚 Библиотека</TabsTrigger>
        </TabsList>

        {/* ===== ANALYTICS TAB ===== */}
        <TabsContent value="analytics" className="space-y-6">
          {/* Views & Likes dynamics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Динамика просмотров и лайков</span>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={viewsChartData}>
                    <defs>
                      <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="views" stroke="hsl(var(--primary))" fill="url(#viewsGrad)" strokeWidth={2} name="Просмотры" />
                    <Area type="monotone" dataKey="likes" stroke="hsl(var(--destructive))" fill="transparent" strokeWidth={2} strokeDasharray="4 4" name="Лайки" />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Контент по типам</span>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <RePieChart>
                    <Pie data={contentByType} cx="50%" cy="45%" innerRadius={40} outerRadius={70} paddingAngle={4} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {contentByType.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </RePieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Revenue & Engagement */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-success" />
                  <span className="text-sm font-semibold">Динамика доходов</span>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={revenueChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `₽${v.toLocaleString()}`} />
                    <Bar dataKey="revenue" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} name="Продажи" />
                    <Bar dataKey="deals" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Сделки" />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-accent-foreground" />
                  <span className="text-sm font-semibold">Engagement Rate & Подписчики</span>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={engagementData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line yAxisId="left" type="monotone" dataKey="rate" stroke="hsl(var(--warning))" strokeWidth={2} name="ER %" dot={{ r: 3 }} />
                    <Line yAxisId="right" type="monotone" dataKey="subscribers" stroke="hsl(var(--primary))" strokeWidth={2} name="Подписчики" dot={{ r: 3 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Top Categories */}
          <Card>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-warning" />
                <span className="text-sm font-semibold">Топ категорий по охвату</span>
              </div>
              {topCategories.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {topCategories.map((cat, i) => (
                    <div key={cat.name} className="rounded-lg border border-border p-3 text-center space-y-1 hover:border-primary/30 transition-colors">
                      <Badge variant="secondary" className="text-[10px]">#{i + 1}</Badge>
                      <p className="text-sm font-semibold text-foreground">{cat.name}</p>
                      <p className="text-xs text-muted-foreground">{cat.views > 1000 ? `${(cat.views / 1000).toFixed(1)}K` : cat.views} просм.</p>
                      <p className="text-[11px] text-muted-foreground">{cat.count} публ. · {cat.likes} ❤</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">Нет данных по категориям</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== CONTENT MANAGEMENT TAB ===== */}
        <TabsContent value="content" className="space-y-6">
          {/* Item analytics modal */}
          {analyticsItem && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-primary/20">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img src={analyticsItem.thumbnail} className="h-12 w-12 rounded-lg object-cover" alt="" />
                      <div>
                        <h3 className="text-sm font-semibold">{analyticsItem.title}</h3>
                        <p className="text-xs text-muted-foreground">{TYPE_LABELS[analyticsItem.type] || analyticsItem.type}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setAnalyticsItemId(null)}>✕</Button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-lg bg-muted/50 p-3 text-center">
                      <p className="text-lg font-bold">{analyticsItem.views > 1000 ? `${(analyticsItem.views / 1000).toFixed(1)}K` : analyticsItem.views}</p>
                      <p className="text-[11px] text-muted-foreground">Просмотров</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3 text-center">
                      <p className="text-lg font-bold">{analyticsItem.likes}</p>
                      <p className="text-[11px] text-muted-foreground">Лайков</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3 text-center">
                      <p className="text-lg font-bold">{analyticsItem.views > 0 ? ((analyticsItem.likes / analyticsItem.views) * 100).toFixed(1) : 0}%</p>
                      <p className="text-[11px] text-muted-foreground">ER</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3 text-center">
                      <p className="text-lg font-bold">{analyticsItem.price ? `₽${analyticsItem.price.toLocaleString()}` : "Бесплатно"}</p>
                      <p className="text-[11px] text-muted-foreground">Цена</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          <h2 className="text-lg font-semibold text-foreground">Управление контентом</h2>
          {/* Filters & Sort */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Поиск по названию..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[140px]"><Filter className="h-3.5 w-3.5 mr-1.5" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все типы</SelectItem>
                <SelectItem value="video">Видео</SelectItem>
                <SelectItem value="post">Пост</SelectItem>
                <SelectItem value="image">Фото</SelectItem>
                <SelectItem value="music">Музыка</SelectItem>
                <SelectItem value="podcast">Подкаст</SelectItem>
                <SelectItem value="book">Книга</SelectItem>
                <SelectItem value="template">Шаблон</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[160px]"><ArrowUpDown className="h-3.5 w-3.5 mr-1.5" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="date">По дате</SelectItem>
                <SelectItem value="views">По просмотрам</SelectItem>
                <SelectItem value="likes">По лайкам</SelectItem>
                <SelectItem value="price">По цене</SelectItem>
                <SelectItem value="title">По названию</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(() => {
            let filtered = myItems.filter((i) => filterType === "all" || i.type === filterType);
            if (searchQuery.trim()) {
              const q = searchQuery.toLowerCase();
              filtered = filtered.filter((i) => i.title.toLowerCase().includes(q));
            }
            filtered = [...filtered].sort((a, b) => {
              switch (sortBy) {
                case "views": return b.views - a.views;
                case "likes": return b.likes - a.likes;
                case "price": return (b.price || 0) - (a.price || 0);
                case "title": return a.title.localeCompare(b.title);
                default: return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
              }
            });
            if (filtered.length === 0) return <div className="text-center py-12 text-muted-foreground">Ничего не найдено</div>;
            return (
            <div className="space-y-3">
              {filtered.map((item) => {
                const TypeIcon = TYPE_ICONS[item.type] || FileText;
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 hover:border-primary/20 hover:shadow-md transition-all"
                  >
                    <img src={item.thumbnail} alt="" className="h-14 w-14 rounded-lg object-cover shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <TypeIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <h3 className="text-sm font-medium text-foreground truncate">{item.title}</h3>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{item.views > 1000 ? `${(item.views / 1000).toFixed(1)}K` : item.views}</span>
                        <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{item.likes}</span>
                        {item.price && <span className="font-medium text-primary">₽{item.price.toLocaleString()}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setAnalyticsItemId(item.id)} title="Аналитика">
                        <BarChart3 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/product/${item.id}`)} title="Просмотр">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Редактировать">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Удалить">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Удалить контент?</AlertDialogTitle>
                            <AlertDialogDescription>«{item.title}» будет удалён навсегда.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Отмена</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(item.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Удалить</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </motion.div>
                );
              })}
            </div>
            );
          })()}
        </TabsContent>

        {/* ===== TOP TAB ===== */}
        <TabsContent value="top" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top by views */}
            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Crown className="h-4 w-4 text-warning" />
                  <span className="text-sm font-semibold">Топ по просмотрам</span>
                </div>
                {topByViews.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Нет данных</p>
                ) : (
                  <div className="space-y-3">
                    {topByViews.map((item, i) => (
                      <div key={item.id} className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors" onClick={() => navigate(`/product/${item.id}`)}>
                        <span className={cn("text-xs font-bold w-5 text-center", i === 0 ? "text-warning" : "text-muted-foreground")}>
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                        </span>
                        <img src={item.thumbnail} alt="" className="h-9 w-9 rounded-md object-cover" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.title}</p>
                          <p className="text-[11px] text-muted-foreground">{TYPE_LABELS[item.type]}</p>
                        </div>
                        <span className="text-sm font-semibold text-primary">{item.views > 1000 ? `${(item.views / 1000).toFixed(1)}K` : item.views}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top by revenue */}
            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-success" />
                  <span className="text-sm font-semibold">Топ по доходу</span>
                </div>
                {topByRevenue.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Нет платного контента</p>
                ) : (
                  <div className="space-y-3">
                    {topByRevenue.map((item, i) => (
                      <div key={item.id} className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors" onClick={() => navigate(`/product/${item.id}`)}>
                        <span className={cn("text-xs font-bold w-5 text-center", i === 0 ? "text-warning" : "text-muted-foreground")}>
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                        </span>
                        <img src={item.thumbnail} alt="" className="h-9 w-9 rounded-md object-cover" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.title}</p>
                          <p className="text-[11px] text-muted-foreground">{item.views > 1000 ? `${(item.views / 1000).toFixed(1)}K` : item.views} просм.</p>
                        </div>
                        <span className="text-sm font-semibold text-success">₽{item.price?.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent publications */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Последние публикации</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentItems.map((item) => (
                <ContentCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        </TabsContent>

        {/* ===== LIBRARY TAB ===== */}
        <TabsContent value="library" className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Библиотека покупок</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {allItems.filter((c) => purchasedItems.includes(c.id)).map((item) => (
              <ContentCard key={item.id} item={item} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CreatorStudio;
