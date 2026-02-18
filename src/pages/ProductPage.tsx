import { useParams, useNavigate } from "react-router-dom";
import { contentItems as mockItems, contentTypeLabels, purchasedItems } from "@/data/mockData";
import { ArrowLeft, Eye, Heart, ShoppingCart, Check, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useContentItem } from "@/hooks/useDbData";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PageTransition } from "@/components/layout/PageTransition";

const ProductPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: dbItem, isLoading } = useContentItem(id);
  const mockItem = mockItems.find((c) => c.id === id);
  const [bought, setBought] = useState(purchasedItems.includes(id || ""));
  const [buying, setBuying] = useState(false);

  // Normalize item from DB or mock
  const raw = dbItem || mockItem;
  if (isLoading) return <div className="p-8 text-muted-foreground">Загрузка...</div>;
  if (!raw) return <div className="p-8 text-muted-foreground">Продукт не найден</div>;

  const item = {
    id: raw.id,
    title: raw.title,
    description: (raw as any).description || "",
    type: (raw as any).type || "",
    thumbnail: (raw as any).thumbnail || (raw as any).thumbnail || "",
    creatorName: (raw as any).creator_name || (raw as any).creatorName || "",
    creatorAvatar: (raw as any).creator_avatar || (raw as any).creatorAvatar || "",
    price: (raw as any).price ?? null,
    views: (raw as any).views || 0,
    likes: (raw as any).likes || 0,
    tags: (raw as any).tags || [],
  };

  const handleBuy = async () => {
    if (!user) return;
    setBuying(true);
    try {
      await supabase.from("purchases").insert({ user_id: user.id, content_id: item.id });
      setBought(true);
    } catch (e) {
      console.error(e);
    }
    setBuying(false);
  };

  return (
    <PageTransition>
      <div className="p-6 lg:p-8 max-w-5xl space-y-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Назад
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3 rounded-xl overflow-hidden border border-border">
            <img src={item.thumbnail} alt={item.title} className="w-full aspect-video object-cover" />
          </div>

          <div className="lg:col-span-2 space-y-5">
            <div className="space-y-2">
              <Badge variant="outline" className="text-xs">{contentTypeLabels[item.type] || item.type}</Badge>
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
                    <Button className="w-full glow-primary" onClick={handleBuy} disabled={buying}>
                      <ShoppingCart className="h-4 w-4 mr-2" /> {buying ? "Покупка..." : "Купить"}
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
              {item.tags.map((tag: string) => (
                <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
};

export default ProductPage;
