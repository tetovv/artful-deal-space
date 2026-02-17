import { contentItems, purchasedItems } from "@/data/mockData";
import { ContentCard } from "@/components/content/ContentCard";
import { Plus, DollarSign, BarChart3, Package } from "lucide-react";
import { Button } from "@/components/ui/button";

const myContent = contentItems.filter((c) => c.creatorId === "u1");

const CreatorStudio = () => {
  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Студия автора</h1>
          <p className="text-sm text-muted-foreground">Управляйте контентом и монетизацией</p>
        </div>
        <Button><Plus className="h-4 w-4 mr-2" /> Создать</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><Package className="h-4 w-4 text-primary" /></div>
            <span className="text-sm text-muted-foreground">Мой контент</span>
          </div>
          <p className="text-2xl font-bold text-card-foreground">{myContent.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-lg bg-success/10 flex items-center justify-center"><DollarSign className="h-4 w-4 text-success" /></div>
            <span className="text-sm text-muted-foreground">Доход (мес.)</span>
          </div>
          <p className="text-2xl font-bold text-card-foreground">45 200 ₽</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-lg bg-info/10 flex items-center justify-center"><BarChart3 className="h-4 w-4 text-info" /></div>
            <span className="text-sm text-muted-foreground">Просмотры (мес.)</span>
          </div>
          <p className="text-2xl font-bold text-card-foreground">12.4K</p>
        </div>
      </div>

      {/* My content */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Мой контент</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {myContent.map((item) => (
            <ContentCard key={item.id} item={item} />
          ))}
        </div>
        {myContent.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">У вас пока нет контента</div>
        )}
      </section>

      {/* Purchased / Library */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Библиотека покупок</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {contentItems.filter((c) => purchasedItems.includes(c.id)).map((item) => (
            <ContentCard key={item.id} item={item} />
          ))}
        </div>
      </section>
    </div>
  );
};

export default CreatorStudio;
