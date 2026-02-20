import { useState } from "react";
import { contentItems as mockItems, contentTypeLabels } from "@/data/mockData";
import { ContentCard } from "@/components/content/ContentCard";
import { Input } from "@/components/ui/input";
import { Search, Video, Music, FileText, Mic, BookOpen, Layout, Image, Sparkles, ArrowRight } from "lucide-react";
import { ContentType } from "@/types";
import { useContentItems } from "@/hooks/useDbData";
import { PageTransition } from "@/components/layout/PageTransition";
import { motion } from "framer-motion";

const types: ContentType[] = ["video", "music", "post", "podcast", "book", "template", "image"];

const Explore = () => {
  const [search, setSearch] = useState("");
  const [activeType, setActiveType] = useState<ContentType | null>(null);
  const { data: dbItems, isLoading } = useContentItems();

  // Use DB data, fallback to mock
  const items = (dbItems && dbItems.length > 0 ? dbItems : mockItems).map((item: any) => ({
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
    duration: item.duration ?? null,
  }));

  const filtered = items.filter((item: any) => {
    const matchSearch = item.title.toLowerCase().includes(search.toLowerCase()) || (item.tags || []).some((t: string) => t.toLowerCase().includes(search.toLowerCase()));
    const matchType = !activeType || item.type === activeType;
    return matchSearch && matchType;
  });

  return (
    <PageTransition>
      <div className="p-6 lg:p-8 space-y-6 max-w-7xl">

        <div className="space-y-3">
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Что посмотреть? Поиск по названию, теме, описанию..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-card border-border" />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {types.map((t) => (
              <button key={t} onClick={() => setActiveType(activeType === t ? null : t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeType === t ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"
                }`}>
                {contentTypeLabels[t] || t}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Загрузка...</div>
        ) : activeType === null ? (
          <ExploreSelectTabPrompt />
        ) : activeType === "post" ? (
          <div className="space-y-4 max-w-2xl mx-auto">
            {filtered.map((item: any) => (
              <ContentCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((item: any) => (
              <ContentCard key={item.id} item={item} />
            ))}
          </div>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">Ничего не найдено</div>
        )}
      </div>
    </PageTransition>
  );
};

function ExploreSelectTabPrompt() {
  const icons = [
    { Icon: Video, label: "Видео", color: "text-destructive", bg: "bg-destructive/10" },
    { Icon: Music, label: "Музыка", color: "text-warning", bg: "bg-warning/10" },
    { Icon: FileText, label: "Посты", color: "text-primary", bg: "bg-primary/10" },
    { Icon: Mic, label: "Подкасты", color: "text-info", bg: "bg-info/10" },
    { Icon: BookOpen, label: "Книги", color: "text-success", bg: "bg-success/10" },
    { Icon: Image, label: "Фото", color: "text-accent", bg: "bg-accent/10" },
    { Icon: Layout, label: "Шаблоны", color: "text-muted-foreground", bg: "bg-muted" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="flex flex-col items-center justify-center py-16 gap-8"
    >
      <div className="relative w-40 h-40 flex items-center justify-center">
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 rounded-full bg-primary/10"
        />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0"
        >
          {icons.map(({ Icon, color, bg }, i) => {
            const angle = (360 / icons.length) * i - 90;
            const rad = (angle * Math.PI) / 180;
            const x = Math.cos(rad) * 64;
            const y = Math.sin(rad) * 64;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1, y: [0, -4, 0] }}
                transition={{
                  opacity: { delay: 0.1 * i, duration: 0.4 },
                  scale: { delay: 0.1 * i, duration: 0.4, type: "spring" },
                  y: { delay: 0.1 * i + 0.5, duration: 2, repeat: Infinity, ease: "easeInOut" },
                }}
                className={`absolute ${bg} rounded-lg p-1.5`}
                style={{ left: `calc(50% + ${x}px - 14px)`, top: `calc(50% + ${y}px - 14px)` }}
              >
                <Icon className={`h-4 w-4 ${color}`} />
              </motion.div>
            );
          })}
        </motion.div>
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <Sparkles className="h-7 w-7 text-primary" />
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="text-center space-y-2 max-w-md"
      >
        <h3 className="text-xl font-bold text-foreground">Выберите тип контента</h3>
        <p className="text-sm text-muted-foreground">
          Нажмите на категорию выше — видео, музыка, посты, подкасты и другое ждут вас
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, y: [0, -6, 0] }}
        transition={{ delay: 0.6, y: { duration: 1.5, repeat: Infinity, ease: "easeInOut" } }}
        className="flex items-center gap-2 text-xs text-primary font-medium"
      >
        <ArrowRight className="h-3.5 w-3.5 rotate-[-90deg]" />
        <span>Выберите тип контента</span>
      </motion.div>
    </motion.div>
  );
}

export default Explore;

