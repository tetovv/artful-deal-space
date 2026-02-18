import { contentItems as mockItems, deals, creators } from "@/data/mockData";
import { ContentCard } from "@/components/content/ContentCard";
import { TrendingUp, Users, DollarSign, Zap } from "lucide-react";
import { useContentItems } from "@/hooks/useDbData";
import { PageTransition } from "@/components/layout/PageTransition";

const stats = [
  { label: "Контент", value: "2.4K", icon: Zap, change: "+12%" },
  { label: "Авторы", value: "580", icon: Users, change: "+8%" },
  { label: "Сделки", value: "156", icon: DollarSign, change: "+24%" },
  { label: "Охват", value: "1.8M", icon: TrendingUp, change: "+15%" },
];

const Home = () => {
  const { data: dbItems } = useContentItems();

  const items = (dbItems && dbItems.length > 0 ? dbItems : mockItems).slice(0, 4).map((item: any) => ({
    id: item.id,
    title: item.title,
    description: item.description || "",
    type: item.type,
    thumbnail: item.thumbnail || "",
    creatorId: item.creator_id || item.creatorId || "",
    creatorName: item.creator_name || item.creatorName || "",
    creatorAvatar: item.creator_avatar || item.creatorAvatar || "",
    price: item.price ?? null,
    views: item.views || 0,
    likes: item.likes || 0,
    createdAt: item.created_at || item.createdAt || "",
    tags: item.tags || [],
  }));

  return (
    <PageTransition>
      <div className="p-6 lg:p-8 space-y-8 max-w-7xl">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">Добро пожаловать в <span className="gradient-text">MediaOS</span></h1>
          <p className="text-muted-foreground">Единая цифровая медиа-экосистема для авторов, рекламодателей и пользователей</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4 animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <s.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-success font-medium">{s.change}</span>
              </div>
              <p className="text-2xl font-bold text-card-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Популярное</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {items.map((item: any) => (
              <ContentCard key={item.id} item={item} />
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Активные сделки</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {deals.map((deal) => (
              <div key={deal.id} className="rounded-xl border border-border bg-card p-4 space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium px-2 py-1 rounded-md bg-primary/10 text-primary">{deal.status}</span>
                  <span className="text-xs text-muted-foreground">{deal.budget.toLocaleString()} ₽</span>
                </div>
                <h3 className="font-medium text-sm text-card-foreground">{deal.title}</h3>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{deal.advertiserName}</span><span>→</span><span>{deal.creatorName}</span>
                </div>
                <div className="flex gap-1">
                  {deal.milestones.map((m) => (
                    <div key={m.id} className={`h-1.5 flex-1 rounded-full ${m.completed ? "bg-success" : "bg-muted"}`} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PageTransition>
  );
};

export default Home;
