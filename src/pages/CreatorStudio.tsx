import { contentItems, purchasedItems } from "@/data/mockData";
import { ContentCard } from "@/components/content/ContentCard";
import {
  Plus, DollarSign, BarChart3, Package, Eye, Heart, TrendingUp,
  Trash2, Edit, PieChart, Activity, ArrowUpRight, Crown, Flame,
  FileText, Video, Image, Music, Mic, BookOpen, Layout,
  ArrowUpDown, Filter, Search, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { useContentItems } from "@/hooks/useDbData";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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

/* ── constants ── */
const PIE_COLORS = [
  "hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--warning))",
  "hsl(var(--destructive))", "hsl(var(--success))", "hsl(var(--info))",
];
const TYPE_LABELS: Record<string, string> = {
  video: "Видео", post: "Пост", image: "Фото", music: "Музыка",
  podcast: "Подкаст", book: "Книга", template: "Шаблон",
};
const TYPE_ICONS: Record<string, React.ElementType> = {
  video: Video, post: FileText, image: Image, music: Music,
  podcast: Mic, book: BookOpen, template: Layout,
};
const TT = {
  contentStyle: {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    fontSize: 12,
  },
};

function mapItem(item: any) {
  return {
    id: item.id, title: item.title, description: item.description || "",
    type: item.type, thumbnail: item.thumbnail || "",
    creatorId: item.creator_id || item.creatorId || "",
    creatorName: item.creator_name || item.creatorName || "",
    creatorAvatar: item.creator_avatar || item.creatorAvatar || "",
    price: item.price ?? null, views: item.views || 0, likes: item.likes || 0,
    createdAt: item.created_at || item.createdAt || "", tags: item.tags || [],
  };
}

const fade = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };

/* ══════════════════════════════════════════ */

const CreatorStudio = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { data: dbItems } = useContentItems();

  const [sortBy, setSortBy] = useState("date");
  const [filterType, setFilterType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [detailItem, setDetailItem] = useState<string | null>(null);

  const allItems = (dbItems && dbItems.length > 0 ? dbItems : contentItems).map(mapItem);
  const myItems = allItems.filter((i) => i.creatorId === user?.id || i.creatorId === "u1");

  /* deals */
  const { data: dbDeals = [] } = useQuery({
    queryKey: ["creator-studio-deals", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("deals").select("*")
        .or(`creator_id.eq.${user.id}`)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user?.id,
  });

  /* ── derived stats ── */
  const totalViews = myItems.reduce((s, i) => s + i.views, 0);
  const totalLikes = myItems.reduce((s, i) => s + i.likes, 0);
  const totalRevenue = myItems.reduce((s, i) => s + (i.price || 0), 0);
  const completedDeals = dbDeals.filter((d: any) => d.status === "completed");
  const dealsEarned = completedDeals.reduce((s: number, d: any) => s + (d.budget || 0), 0);
  const engagementRate = totalViews > 0 ? ((totalLikes / totalViews) * 100).toFixed(1) : "0";

  /* ── chart data ── */
  const viewsChart = useMemo(() => {
    const m = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн"];
    return m.map((n, i) => ({
      name: n,
      views: totalViews > 0 ? Math.round(totalViews * (0.4 + i * 0.12)) : 800 + i * 350,
      likes: totalLikes > 0 ? Math.round(totalLikes * (0.3 + i * 0.14)) : 50 + i * 40,
    }));
  }, [totalViews, totalLikes]);

  const revenueChart = useMemo(() => {
    const m = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн"];
    return m.map((n, i) => ({
      name: n,
      sales: totalRevenue > 0 ? Math.round(totalRevenue * (0.15 + i * 0.17)) : 3000 + i * 5000,
      deals: dealsEarned > 0 ? Math.round(dealsEarned * (0.1 + i * 0.18)) : 2000 + i * 4000,
    }));
  }, [totalRevenue, dealsEarned]);

  const engagementChart = useMemo(() => {
    const m = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн"];
    return m.map((n, i) => ({
      name: n,
      er: +(2.4 + i * 0.35 + Math.random() * 0.5).toFixed(1),
      subs: Math.round(1200 + i * 450 + Math.random() * 200),
    }));
  }, []);

  const typePie = useMemo(() => {
    const t: Record<string, number> = {};
    myItems.forEach((i) => { t[i.type] = (t[i.type] || 0) + 1; });
    if (!Object.keys(t).length) return [{ name: "Видео", value: 3 }, { name: "Пост", value: 2 }, { name: "Фото", value: 1 }];
    return Object.entries(t).map(([k, v]) => ({ name: TYPE_LABELS[k] || k, value: v }));
  }, [myItems]);

  /* tops */
  const topByViews = useMemo(() => [...myItems].sort((a, b) => b.views - a.views).slice(0, 5), [myItems]);
  const topByRevenue = useMemo(() => [...myItems].filter(i => i.price).sort((a, b) => (b.price || 0) - (a.price || 0)).slice(0, 5), [myItems]);

  const topCategories = useMemo(() => {
    const c: Record<string, { views: number; likes: number; count: number }> = {};
    myItems.forEach((i) => i.tags.forEach((t) => {
      if (!c[t]) c[t] = { views: 0, likes: 0, count: 0 };
      c[t].views += i.views; c[t].likes += i.likes; c[t].count += 1;
    }));
    return Object.entries(c).sort((a, b) => b[1].views - a[1].views).slice(0, 6).map(([n, d]) => ({ name: n, ...d }));
  }, [myItems]);

  /* filtered content list */
  const filteredItems = useMemo(() => {
    let f = myItems.filter((i) => filterType === "all" || i.type === filterType);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      f = f.filter((i) => i.title.toLowerCase().includes(q));
    }
    return [...f].sort((a, b) => {
      switch (sortBy) {
        case "views": return b.views - a.views;
        case "likes": return b.likes - a.likes;
        case "price": return (b.price || 0) - (a.price || 0);
        case "title": return a.title.localeCompare(b.title);
        default: return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
  }, [myItems, filterType, searchQuery, sortBy]);

  const openItem = detailItem ? myItems.find((i) => i.id === detailItem) : null;

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("content_items").delete().eq("id", id);
    if (error) { toast.error("Ошибка при удалении"); return; }
    toast.success("Контент удалён");
    setDetailItem(null);
  };

  const fmtNum = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));

  /* ════════════════ RENDER ════════════════ */
  return (
    <div className="p-6 lg:p-8 max-w-7xl space-y-10">

      {/* ─── HEADER ─── */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-end justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">
            Студия <span className="text-primary">{profile?.display_name || "автора"}</span>
          </h1>
          <p className="text-sm text-muted-foreground">Обзор канала, управление контентом и аналитика</p>
        </div>
        <Button className="shrink-0"><Plus className="h-4 w-4 mr-2" /> Создать контент</Button>
      </motion.div>

      {/* ─── KEY METRICS ─── */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: Package, label: "Публикации", value: myItems.length, trend: "+3", color: "bg-primary/10 text-primary" },
          { icon: Eye, label: "Просмотры", value: fmtNum(totalViews), trend: "+12%", color: "bg-accent/10 text-accent-foreground" },
          { icon: Heart, label: "Лайки", value: fmtNum(totalLikes), trend: "+8%", color: "bg-destructive/10 text-destructive" },
          { icon: DollarSign, label: "Доход", value: `₽${fmtNum(totalRevenue)}`, trend: "+15%", color: "bg-success/10 text-success" },
        ].map((s) => (
          <motion.div key={s.label} variants={fade} className="rounded-xl border border-border bg-card p-5 space-y-3 hover:border-primary/20 transition-all">
            <div className="flex items-center justify-between">
              <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", s.color.split(" ")[0])}>
                <s.icon className={cn("h-5 w-5", s.color.split(" ")[1])} />
              </div>
              <span className="text-[11px] font-medium text-success flex items-center gap-0.5">
                <ArrowUpRight className="h-3 w-3" />{s.trend}
              </span>
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground tracking-tight">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* ─── SECTION: CHANNEL ANALYTICS ─── */}
      <section className="space-y-5">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Аналитика канала</h2>
        </div>

        {/* Row 1: Main chart + Pie */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2 pt-5 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" /> Просмотры и лайки
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={viewsChart}>
                  <defs>
                    <linearGradient id="vg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip {...TT} />
                  <Area type="monotone" dataKey="views" stroke="hsl(var(--primary))" fill="url(#vg)" strokeWidth={2} name="Просмотры" />
                  <Area type="monotone" dataKey="likes" stroke="hsl(var(--destructive))" fill="transparent" strokeWidth={2} strokeDasharray="4 4" name="Лайки" />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 pt-5 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <PieChart className="h-4 w-4 text-primary" /> По типам
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <ResponsiveContainer width="100%" height={240}>
                <RePieChart>
                  <Pie data={typePie} cx="50%" cy="45%" innerRadius={42} outerRadius={72} paddingAngle={3} dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`} labelLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 0.5 }}>
                    {typePie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip {...TT} />
                  <Legend wrapperStyle={{ fontSize: 10, lineHeight: "18px" }} />
                </RePieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Row 2: Revenue + Engagement */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2 pt-5 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-success" /> Доходы
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={revenueChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip {...TT} formatter={(v: number) => `₽${v.toLocaleString()}`} />
                  <Bar dataKey="sales" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} name="Продажи" />
                  <Bar dataKey="deals" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Сделки" />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 pt-5 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-warning" /> Engagement & Аудитория
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={engagementChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis yAxisId="l" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip {...TT} />
                  <Line yAxisId="l" type="monotone" dataKey="er" stroke="hsl(var(--warning))" strokeWidth={2} name="ER %" dot={{ r: 3 }} />
                  <Line yAxisId="r" type="monotone" dataKey="subs" stroke="hsl(var(--primary))" strokeWidth={2} name="Подписчики" dot={{ r: 3 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Categories */}
        {topCategories.length > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-5 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Flame className="h-4 w-4 text-warning" /> Топ категорий
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {topCategories.map((cat, i) => (
                  <div key={cat.name} className="rounded-lg border border-border p-3 text-center space-y-1.5 hover:border-primary/30 hover:bg-muted/30 transition-all">
                    <span className="text-xs font-bold text-muted-foreground">#{i + 1}</span>
                    <p className="text-sm font-semibold text-foreground leading-tight">{cat.name}</p>
                    <div className="text-[11px] text-muted-foreground space-y-0.5">
                      <p>{fmtNum(cat.views)} просм.</p>
                      <p>{cat.count} публ. · {fmtNum(cat.likes)} ❤</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      <Separator />

      {/* ─── SECTION: CONTENT MANAGEMENT ─── */}
      <section className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Мой контент</h2>
            <Badge variant="secondary" className="ml-1">{myItems.length}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Поиск…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 w-44 text-sm" />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-9 w-32 text-sm"><Filter className="h-3 w-3 mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все типы</SelectItem>
                {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-9 w-36 text-sm"><ArrowUpDown className="h-3 w-3 mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="date">По дате</SelectItem>
                <SelectItem value="views">По просмотрам</SelectItem>
                <SelectItem value="likes">По лайкам</SelectItem>
                <SelectItem value="price">По цене</SelectItem>
                <SelectItem value="title">По названию</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Detail panel */}
        <AnimatePresence>
          {openItem && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <Card className="border-primary/20 bg-gradient-to-r from-primary/[0.03] to-transparent">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <img src={openItem.thumbnail} className="h-16 w-24 rounded-lg object-cover" alt="" />
                      <div>
                        <h3 className="font-semibold text-foreground">{openItem.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{TYPE_LABELS[openItem.type]} · {new Date(openItem.createdAt).toLocaleDateString("ru")}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setDetailItem(null)}><X className="h-4 w-4" /></Button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Просмотров", value: fmtNum(openItem.views) },
                      { label: "Лайков", value: fmtNum(openItem.likes) },
                      { label: "ER", value: openItem.views > 0 ? `${((openItem.likes / openItem.views) * 100).toFixed(1)}%` : "0%" },
                      { label: "Цена", value: openItem.price ? `₽${openItem.price.toLocaleString()}` : "Бесплатно" },
                    ].map((m) => (
                      <div key={m.label} className="rounded-lg bg-card border border-border p-3 text-center">
                        <p className="text-lg font-bold text-card-foreground">{m.value}</p>
                        <p className="text-[11px] text-muted-foreground">{m.label}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content list */}
        {filteredItems.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            {myItems.length === 0 ? "У вас пока нет контента — создайте первую публикацию!" : "Ничего не найдено по фильтрам"}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredItems.map((item) => {
              const Icon = TYPE_ICONS[item.type] || FileText;
              const isOpen = detailItem === item.id;
              return (
                <motion.div
                  key={item.id}
                  layout
                  className={cn(
                    "flex items-center gap-4 rounded-xl border bg-card p-3 sm:p-4 transition-all cursor-pointer group",
                    isOpen ? "border-primary/30 shadow-md" : "border-border hover:border-primary/15 hover:shadow-sm",
                  )}
                  onClick={() => setDetailItem(isOpen ? null : item.id)}
                >
                  <img src={item.thumbnail} alt="" className="h-12 w-16 sm:h-14 sm:w-20 rounded-lg object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <h3 className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">{item.title}</h3>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{fmtNum(item.views)}</span>
                      <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{fmtNum(item.likes)}</span>
                      {item.price ? <span className="font-medium text-primary">₽{item.price.toLocaleString()}</span> : <span className="text-success">Бесплатно</span>}
                      <span className="hidden sm:inline text-muted-foreground/60">{new Date(item.createdAt).toLocaleDateString("ru")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/product/${item.id}`)} title="Открыть"><Eye className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Редактировать"><Edit className="h-4 w-4" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Удалить"><Trash2 className="h-4 w-4" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Удалить «{item.title}»?</AlertDialogTitle>
                          <AlertDialogDescription>Это действие необратимо.</AlertDialogDescription>
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
        )}
      </section>

      <Separator />

      {/* ─── SECTION: TOPS ─── */}
      <section className="space-y-5">
        <div className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-warning" />
          <h2 className="text-lg font-semibold text-foreground">Лучший контент</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top Views */}
          <Card>
            <CardHeader className="pb-3 pt-5 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" /> По просмотрам
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-1">
              {topByViews.map((item, i) => (
                <div key={item.id} onClick={() => navigate(`/product/${item.id}`)}
                  className="flex items-center gap-3 rounded-lg p-2.5 -mx-1 hover:bg-muted/50 cursor-pointer transition-colors">
                  <span className="text-sm font-bold w-6 text-center shrink-0">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : <span className="text-muted-foreground">#{i + 1}</span>}
                  </span>
                  <img src={item.thumbnail} alt="" className="h-9 w-12 rounded-md object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <p className="text-[11px] text-muted-foreground">{TYPE_LABELS[item.type]}</p>
                  </div>
                  <span className="text-sm font-semibold text-primary tabular-nums">{fmtNum(item.views)}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Top Revenue */}
          <Card>
            <CardHeader className="pb-3 pt-5 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-success" /> По доходу
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-1">
              {topByRevenue.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Нет платного контента</p>
              ) : topByRevenue.map((item, i) => (
                <div key={item.id} onClick={() => navigate(`/product/${item.id}`)}
                  className="flex items-center gap-3 rounded-lg p-2.5 -mx-1 hover:bg-muted/50 cursor-pointer transition-colors">
                  <span className="text-sm font-bold w-6 text-center shrink-0">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : <span className="text-muted-foreground">#{i + 1}</span>}
                  </span>
                  <img src={item.thumbnail} alt="" className="h-9 w-12 rounded-md object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <p className="text-[11px] text-muted-foreground">{fmtNum(item.views)} просм.</p>
                  </div>
                  <span className="text-sm font-semibold text-success tabular-nums">₽{item.price?.toLocaleString()}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default CreatorStudio;
