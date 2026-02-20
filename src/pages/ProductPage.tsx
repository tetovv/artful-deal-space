import { useParams, useNavigate } from "react-router-dom";
import { contentItems as mockItems, contentTypeLabels, purchasedItems } from "@/data/mockData";
import { Eye, Heart, ShoppingCart, Check, Play, ThumbsUp, ThumbsDown, Share2, Bookmark, Tag, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useRef, useEffect } from "react";
import { useContentItem, useContentItems } from "@/hooks/useDbData";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PageTransition } from "@/components/layout/PageTransition";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { VideoPlayer } from "@/components/VideoPlayer";
import { useReaction } from "@/hooks/useReaction";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const ProductPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: dbItem, isLoading } = useContentItem(id);
  const { data: allItems } = useContentItems();
  const mockItem = mockItems.find((c) => c.id === id);
  const [bought, setBought] = useState(purchasedItems.includes(id || ""));
  const [buying, setBuying] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);
  const { likes, dislikes, userReaction, toggleReaction } = useReaction(id);
  const [bouncing, setBouncing] = useState<"like" | "dislike" | null>(null);
  
  // Promo code state
  const [promoCode, setPromoCode] = useState("");
  const [promoChecking, setPromoChecking] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discount_percent: number; id: string } | null>(null);
  const [promoError, setPromoError] = useState("");

  const animatedReaction = (type: "like" | "dislike") => {
    setBouncing(type);
    setTimeout(() => setBouncing(null), 300);
    toggleReaction(type);
  };

  // Check if bookmarked
  useEffect(() => {
    if (!user || !id) return;
    supabase.from("bookmarks").select("id").eq("user_id", user.id).eq("content_id", id).maybeSingle()
      .then(({ data }) => { if (data) setBookmarked(true); });
  }, [user, id]);

  const toggleBookmark = async () => {
    if (!user || !id) return;
    setBookmarking(true);
    try {
      if (bookmarked) {
        await supabase.from("bookmarks").delete().eq("user_id", user.id).eq("content_id", id);
        setBookmarked(false);
      } else {
        await supabase.from("bookmarks").insert({ user_id: user.id, content_id: id });
        setBookmarked(true);
      }
    } catch {}
    setBookmarking(false);
  };

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

  const related = (allItems || [])
    .filter((i) => i.id !== item.id && i.status === "published")
    .slice(0, 10);

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    setPromoError("");
    setPromoChecking(true);
    try {
      const { data, error } = await supabase
        .from("promo_codes")
        .select("id, code, discount_percent, is_active, max_uses, used_count, expires_at")
        .eq("code", promoCode.trim().toUpperCase())
        .maybeSingle();
      
      if (error || !data) {
        setPromoError("Промокод не найден");
      } else if (!data.is_active) {
        setPromoError("Промокод неактивен");
      } else if (data.max_uses && data.used_count >= data.max_uses) {
        setPromoError("Лимит использований исчерпан");
      } else if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setPromoError("Промокод истёк");
      } else {
        setAppliedPromo({ code: data.code, discount_percent: data.discount_percent, id: data.id });
        toast.success(`Промокод применён: -${data.discount_percent}%`);
      }
    } catch {
      setPromoError("Ошибка проверки");
    }
    setPromoChecking(false);
  };

  const handleBuy = async () => {
    if (!user) return;
    setBuying(true);
    try {
      await supabase.from("purchases").insert({ user_id: user.id, content_id: item.id });
      // Increment promo usage
      if (appliedPromo) {
        await supabase.from("promo_codes").update({ used_count: (await supabase.from("promo_codes").select("used_count").eq("id", appliedPromo.id).single()).data?.used_count! + 1 }).eq("id", appliedPromo.id);
      }
      setBought(true);
      toast.success("Покупка успешна!");
    } catch (e) {
      console.error(e);
    }
    setBuying(false);
  };

  const isFree = item.price === null || item.monetization_type === "free";
  const discountedPrice = appliedPromo && item.price
    ? Math.round(item.price * (1 - appliedPromo.discount_percent / 100))
    : null;

  return (
    <PageTransition>
      <div className="max-w-full mx-auto px-6 lg:px-10 py-4 space-y-0">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: Video + Info */}
          <div className="flex-1 min-w-0">
            {/* Video Player / Thumbnail */}
            <div className="rounded-xl overflow-hidden bg-black relative" style={{ height: 'calc(100vh - 210px)', minHeight: '250px' }}>
              {item.video_url ? (
                <VideoPlayer
                  src={item.video_url}
                  poster={item.thumbnail}
                  className="w-full h-full"
                />
              ) : (
                <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
              )}
            </div>

            {/* Title */}
            <h1 className="text-xl font-bold text-foreground leading-tight mt-3">{item.title}</h1>

            {/* Author + Actions row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
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
                <p className="text-sm font-semibold text-foreground">{item.creatorName}</p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center rounded-lg overflow-hidden border border-border">
                  <Button
                    variant={userReaction === "like" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => animatedReaction("like")}
                    className={cn("gap-1.5 rounded-none border-0 transition-transform", bouncing === "like" && "scale-125")}
                    style={{ transition: "transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
                  >
                    <ThumbsUp className={cn("h-4 w-4", userReaction === "like" && "fill-current")} />
                    {likes.toLocaleString()}
                  </Button>
                  <Separator orientation="vertical" className="h-5" />
                  <Button
                    variant={userReaction === "dislike" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => animatedReaction("dislike")}
                    className={cn("rounded-none border-0 transition-transform", bouncing === "dislike" && "scale-125")}
                    style={{ transition: "transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
                  >
                    <ThumbsDown className={cn("h-4 w-4", userReaction === "dislike" && "fill-current")} />
                  </Button>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Share2 className="h-4 w-4" /> Поделиться
                </Button>
                <Button
                  variant={bookmarked ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5"
                  onClick={toggleBookmark}
                  disabled={bookmarking}
                >
                  <Bookmark className={cn("h-4 w-4", bookmarked && "fill-current")} />
                  {bookmarked ? "В закладках" : "Сохранить"}
                </Button>
              </div>
            </div>

            {/* Views + Date */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
              <span>{item.views.toLocaleString()} просмотров</span>
              <span>·</span>
              <span>{new Date((raw as any).created_at || Date.now()).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}</span>
            </div>

            {/* Description */}
            <div className="rounded-xl bg-muted/50 p-4 space-y-2 mt-3">
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

            <CommentsSection contentId={item.id} />

            {!isFree && (
              <div className="rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {discountedPrice !== null ? (
                      <>
                        <p className="text-2xl font-bold text-foreground">{discountedPrice.toLocaleString()} ₽</p>
                        <p className="text-lg text-muted-foreground line-through">{item.price?.toLocaleString()} ₽</p>
                        <Badge variant="secondary" className="text-xs">-{appliedPromo!.discount_percent}%</Badge>
                      </>
                    ) : (
                      <p className="text-2xl font-bold text-foreground">{item.price?.toLocaleString()} ₽</p>
                    )}
                  </div>
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
                {!bought && (
                  <div className="space-y-1.5">
                    {appliedPromo ? (
                      <div className="flex items-center gap-2 text-sm">
                        <Tag className="h-4 w-4 text-primary" />
                        <span className="text-primary font-medium">{appliedPromo.code}</span>
                        <button onClick={() => { setAppliedPromo(null); setPromoCode(""); }} className="text-muted-foreground hover:text-destructive transition-colors">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          placeholder="Промокод"
                          value={promoCode}
                          onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoError(""); }}
                          className="h-9 text-sm max-w-[200px]"
                        />
                        <Button variant="outline" size="sm" onClick={handleApplyPromo} disabled={promoChecking || !promoCode.trim()}>
                          {promoChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Применить"}
                        </Button>
                      </div>
                    )}
                    {promoError && <p className="text-xs text-destructive">{promoError}</p>}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right sidebar: Related videos */}
          <aside className="w-full lg:w-[480px] shrink-0 space-y-1">
            {related.length === 0 ? (
              <p className="text-xs text-muted-foreground">Нет рекомендаций</p>
            ) : (
              related.map((r) => (
                <div
                  key={r.id}
                  className="cursor-pointer group space-y-0.5"
                  onClick={() => navigate(`/product/${r.id}`)}
                >
                  <div
                    className="w-full rounded-lg overflow-hidden bg-muted relative" style={{ aspectRatio: '16/7' }}
                    onMouseEnter={(e) => {
                      const video = e.currentTarget.querySelector("video");
                      if (video) { video.currentTime = 0; video.play().catch(() => {}); }
                    }}
                    onMouseLeave={(e) => {
                      const video = e.currentTarget.querySelector("video");
                      if (video) { video.pause(); video.currentTime = 0; }
                    }}
                  >
                    {r.video_url ? (
                      <>
                        {r.thumbnail ? (
                          <img src={r.thumbnail} alt={r.title} className="w-full h-full object-cover group-hover:opacity-0 transition-opacity duration-300" />
                        ) : (
                          <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground group-hover:opacity-0 transition-opacity duration-300">
                            <Play className="h-5 w-5" />
                          </div>
                        )}
                        <video
                          src={r.video_url}
                          muted
                          playsInline
                          preload="metadata"
                          className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        />
                      </>
                    ) : r.thumbnail ? (
                      <img src={r.thumbnail} alt={r.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <Play className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-2">{r.title}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span>{r.creator_name}</span>
                      <span>·</span>
                      <span>{(r.views || 0).toLocaleString()} просм.</span>
                      <span>·</span>
                      <span>{new Date(r.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}</span>
                    </div>
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
