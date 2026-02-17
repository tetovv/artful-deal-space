import { useState } from "react";
import { contentItems, contentTypeLabels } from "@/data/mockData";
import { ContentCard } from "@/components/content/ContentCard";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { ContentType } from "@/types";

const types: (ContentType | "all")[] = ["all", "video", "music", "post", "podcast", "book", "template", "image"];

const Explore = () => {
  const [search, setSearch] = useState("");
  const [activeType, setActiveType] = useState<ContentType | "all">("all");

  const filtered = contentItems.filter((item) => {
    const matchSearch = item.title.toLowerCase().includes(search.toLowerCase()) || item.tags.some(t => t.toLowerCase().includes(search.toLowerCase()));
    const matchType = activeType === "all" || item.type === activeType;
    return matchSearch && matchType;
  });

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Каталог контента</h1>
        <p className="text-sm text-muted-foreground">Видео, музыка, книги, шаблоны и многое другое</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск контента..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setActiveType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeType === t
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-accent"
              }`}
            >
              {t === "all" ? "Все" : contentTypeLabels[t] || t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((item) => (
          <ContentCard key={item.id} item={item} />
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">Ничего не найдено</div>
      )}
    </div>
  );
};

export default Explore;
