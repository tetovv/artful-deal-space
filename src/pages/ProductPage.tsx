import { useParams, useNavigate } from "react-router-dom";
import { contentItems as mockItems, contentTypeLabels, purchasedItems } from "@/data/mockData";
import { ArrowLeft, Eye, Heart, ShoppingCart, Check, Play, ThumbsUp, ThumbsDown, Share2, Bookmark, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useRef } from "react";
import { useContentItem, useContentItems } from "@/hooks/useDbData";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PageTransition } from "@/components/layout/PageTransition";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

const ProductPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: dbItem, isLoading } = useContentItem(id);
  const { data: allItems } = useContentItems();
  const mockItem = mockItems.find((c) => c.id === id);
  const [bought, setBought] = useState(purchasedItems.includes(id || ""));
  const [buying, setBuying] = useState(false);
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const raw = dbItem || mockItem;
  if (isLoading) return <div className="p-8 text-muted-foreground">Загрузка...</div>;
  if (!raw) return <div className="p-8 text-muted-foreground">Продукт не найден</div>;

  const item = {
    id: raw.id,
    title: raw.title,
    description: (raw as any).description || "",
    type: (raw as any).type || "",
    thumbnail: (raw as any).thumbnail || "",
    video_url: (raw as any).video_url || "",
    creatorName: (raw as any).creator_name || (raw as any).creatorName || "",
    creatorAvatar: (raw as any).creator_avatar || (raw as any).creatorAvatar || "",
    creatorId: (raw as any).creator_id || (raw as any).creatorId || "",
    price: (raw as any).price ?? null,
    views: (raw as any).views || 0,
    likes: (raw as any).likes || 0,
    tags: (raw as any).tags || [],
    monetization_type: (raw as any).monetization_type || "free",
  };

  // Related videos (same creator or same tags, excluding current)
  const related = (allItems || [])
    .filter((i) => i.id !== item.id && i.status === "published")
    .slice(0, 10);

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

  const isFree = item.price === null || item.monetization_type === "free";

  return (
    <PageTransition>
      <div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-4 space-y-0">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="h-4 w-4" /> Назад
        </button>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: Video + Info */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Video Player / Thumbnail */}
            <div className="rounded-xl overflow-hidden bg-black aspect-video relative">
              {item.video_url ? (
                <video
                  ref={videoRef}
                  src={item.video_url}
                  poster={item.thumbnail}
                  controls
                  className="w-full h-full object-contain"
                />
              ) : (
                <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
              )}
            </div>

            {/* Title */}
            <h1 className="text-xl font-bold text-foreground leading-tight">{item.title}</h1>

            {/* Author + Actions row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div
                className="flex items-center gap-3 cursor-pointer"
                onClick={() => item.creatorId && navigate(`/creator/${item.creatorId}`)}
              >
                {item.creatorAvatar ? (
                  <img src={item.creatorAvatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    {item.creatorName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.creatorName}</p>
                  <p className="text-xs text-muted-foreground">Автор</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center rounded-lg overflow-hidden border border-border">
                  <Button
                    variant={liked ? "default" : "ghost"}
                    size="sm"
                    onClick={() => { setLiked(!liked); if (disliked) setDisliked(false); }}
                    className="gap-1.5 rounded-none border-0"
                  >
                    <ThumbsUp className={cn("h-4 w-4", liked && "fill-current")} />
                    {item.likes.toLocaleString()}
                  </Button>
                  <Separator orientation="vertical" className="h-5" />
                  <Button
                    variant={disliked ? "default" : "ghost"}
                    size="sm"
                    onClick={() => { setDisliked(!disliked); if (liked) setLiked(false); }}
                    className="rounded-none border-0"
                  >
                    <ThumbsDown className={cn("h-4 w-4", disliked && "fill-current")} />
                  </Button>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Share2 className="h-4 w-4" /> Поделиться
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Bookmark className="h-4 w-4" /> Сохранить
                </Button>
              </div>
            </div>

            {/* Views + Date inline */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Eye className="h-4 w-4" /> {item.views.toLocaleString()} просмотров</span>
              <span>·</span>
              <span>{new Date((raw as any).created_at || Date.now()).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}</span>
              <Badge variant="outline" className="text-[10px] ml-1">{contentTypeLabels[item.type] || item.type}</Badge>
            </div>

            {/* Description */}
            <div className="rounded-xl bg-muted/50 p-4 space-y-2">
              {item.description && (
                <p className="text-sm text-foreground whitespace-pre-wrap">{item.description}</p>
              )}
              {item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {item.tags.map((tag: string) => (
                    <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Price / Buy section */}
            {!isFree && (
              <div className="rounded-xl border border-border p-4 flex items-center justify-between">
                <p className="text-2xl font-bold text-foreground">{item.price?.toLocaleString()} ₽</p>
                {bought ? (
                  <Button variant="outline" disabled>
                    <Check className="h-4 w-4 mr-2" /> Куплено
                  </Button>
                ) : (
                  <Button className="glow-primary" onClick={handleBuy} disabled={buying}>
                    <ShoppingCart className="h-4 w-4 mr-2" /> {buying ? "Покупка..." : "Купить"}
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Right sidebar: Related videos */}
          <aside className="w-full lg:w-[420px] shrink-0 space-y-3">
            {related.length === 0 ? (
              <p className="text-xs text-muted-foreground">Нет рекомендаций</p>
            ) : (
              related.map((r) => (
                <div
                  key={r.id}
                  className="flex gap-3 cursor-pointer group"
                  onClick={() => navigate(`/product/${r.id}`)}
                >
                  <div className="w-44 shrink-0 rounded-lg overflow-hidden aspect-video bg-muted">
                    {r.thumbnail ? (
                      <img src={r.thumbnail} alt={r.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <Play className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">{r.title}</p>
                    <p className="text-xs text-muted-foreground">{r.creator_name}</p>
                    <p className="text-xs text-muted-foreground">{(r.views || 0).toLocaleString()} просм.</p>
                  </div>
                </div>
              ))
            )}
          </aside>
        </div>
      </div>
    </PageTransition>
  );
};

export default ProductPage;
