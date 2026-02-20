import { useState } from "react";
import { contentItems as mockItems, contentTypeLabels } from "@/data/mockData";
import { ContentCard } from "@/components/content/ContentCard";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { ContentType } from "@/types";
import { useContentItems } from "@/hooks/useDbData";
import { PageTransition } from "@/components/layout/PageTransition";
import { SelectTabPrompt } from "@/pages/Home";

const types: ContentType[] = ["video", "music", "post", "podcast", "book", "template"];

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
      <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">

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
          <SelectTabPrompt />
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

export default Explore;

