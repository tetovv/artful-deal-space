import { useState } from "react";
import { creators } from "@/data/mockData";
import { Search, MapPin, Users, Star, CheckCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const niches = ["Все", "Образование", "Технологии", "Дизайн", "Фото", "Музыка", "Подкасты", "Бизнес", "Видео", "Motion"];

const Marketplace = () => {
  const [search, setSearch] = useState("");
  const [activeNiche, setActiveNiche] = useState("Все");

  const filtered = creators.filter((c) => {
    const matchSearch = c.displayName.toLowerCase().includes(search.toLowerCase());
    const matchNiche = activeNiche === "Все" || c.niche.includes(activeNiche);
    return matchSearch && matchNiche;
  });

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Биржа размещений</h1>
        <p className="text-sm text-muted-foreground">Найдите идеального автора для рекламной интеграции</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Поиск авторов..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-card" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {niches.map((n) => (
            <button key={n} onClick={() => setActiveNiche(n)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeNiche === n ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"
              }`}>{n}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((creator) => (
          <div key={creator.userId} className="rounded-xl border border-border bg-card p-5 space-y-4 hover:border-primary/30 transition-colors animate-fade-in">
            <div className="flex items-center gap-3">
              <img src={creator.avatar} alt="" className="h-12 w-12 rounded-full" />
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-semibold text-sm text-card-foreground">{creator.displayName}</h3>
                  {creator.verified && <CheckCircle className="h-3.5 w-3.5 text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{creator.geo}</p>
              </div>
              <div className="flex items-center gap-1 text-warning">
                <Star className="h-3.5 w-3.5 fill-current" />
                <span className="text-sm font-bold">{creator.rating}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{creator.bio}</p>
            <div className="flex flex-wrap gap-1.5">
              {creator.niche.map((n) => (
                <Badge key={n} variant="secondary" className="text-[10px]">{n}</Badge>
              ))}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-3">
              <span className="flex items-center gap-1"><Users className="h-3 w-3" />{(creator.followers / 1000).toFixed(0)}K подписчиков</span>
              <span>Охват: {(creator.reach / 1000).toFixed(0)}K</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Marketplace;
