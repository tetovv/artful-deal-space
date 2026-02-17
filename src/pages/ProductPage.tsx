import { useParams, useNavigate } from "react-router-dom";
import { contentItems, contentTypeLabels, purchasedItems } from "@/data/mockData";
import { ArrowLeft, Eye, Heart, ShoppingCart, Check, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

const ProductPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const item = contentItems.find((c) => c.id === id);
  const [bought, setBought] = useState(purchasedItems.includes(id || ""));

  if (!item) return <div className="p-8 text-muted-foreground">Продукт не найден</div>;

  return (
    <div className="p-6 lg:p-8 max-w-5xl space-y-6 animate-fade-in">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Назад
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Image */}
        <div className="lg:col-span-3 rounded-xl overflow-hidden border border-border">
          <img src={item.thumbnail} alt={item.title} className="w-full aspect-video object-cover" />
        </div>

        {/* Info */}
        <div className="lg:col-span-2 space-y-5">
          <div className="space-y-2">
            <Badge variant="outline" className="text-xs">{contentTypeLabels[item.type]}</Badge>
            <h1 className="text-2xl font-bold text-foreground">{item.title}</h1>
            <p className="text-sm text-muted-foreground">{item.description}</p>
          </div>

          <div className="flex items-center gap-3">
            <img src={item.creatorAvatar} alt="" className="h-8 w-8 rounded-full" />
            <div>
              <p className="text-sm font-medium text-foreground">{item.creatorName}</p>
              <p className="text-xs text-muted-foreground">Автор</p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Eye className="h-4 w-4" />{item.views.toLocaleString()}</span>
            <span className="flex items-center gap-1"><Heart className="h-4 w-4" />{item.likes.toLocaleString()}</span>
          </div>

          <div className="border-t border-border pt-4 space-y-3">
            {item.price !== null ? (
              <>
                <p className="text-3xl font-bold text-foreground">{item.price.toLocaleString()} ₽</p>
                {bought ? (
                  <Button className="w-full" variant="outline" disabled>
                    <Check className="h-4 w-4 mr-2" /> Куплено
                  </Button>
                ) : (
                  <Button className="w-full glow-primary" onClick={() => setBought(true)}>
                    <ShoppingCart className="h-4 w-4 mr-2" /> Купить
                  </Button>
                )}
              </>
            ) : (
              <>
                <p className="text-lg font-semibold text-success">Бесплатно</p>
                <Button className="w-full" variant="outline">
                  <Play className="h-4 w-4 mr-2" /> Смотреть
                </Button>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductPage;
