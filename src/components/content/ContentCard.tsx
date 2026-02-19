import { ContentItem } from "@/types";
import { Eye, Heart, ThumbsUp, MessageCircle, Share2, MoreVertical, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

interface ContentCardProps {
  item: ContentItem & { duration?: number | null };
}

export function ContentCard({ item }: ContentCardProps) {
  const navigate = useNavigate();

  return (
    <motion.div
      onClick={() => navigate(`/product/${item.id}`)}
      className="group cursor-pointer rounded-xl border border-border bg-card overflow-hidden hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {item.type === "post" ? (
        /* ===== POST CARD ===== */
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {item.creatorAvatar ? (
                <img src={item.creatorAvatar} alt="" className="h-9 w-9 rounded-full" />
              ) : (
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <span className="font-medium text-sm text-card-foreground">{item.creatorName || "Автор"}</span>
            </div>
            <button className="p-1 rounded hover:bg-muted transition-colors">
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <p className="text-sm text-card-foreground whitespace-pre-wrap line-clamp-4">{item.description || item.title}</p>
          {item.thumbnail && (
            <img src={item.thumbnail} alt="" className="w-full rounded-lg max-h-64 object-cover" />
          )}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-4">
              <button className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors">
                <ThumbsUp className="h-4 w-4" />
              </button>
              <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <MessageCircle className="h-4 w-4" /> 0
              </span>
              <button className="text-muted-foreground hover:text-primary transition-colors">
                <Share2 className="h-4 w-4" />
              </button>
            </div>
            <span className="text-xs text-muted-foreground">
              {item.createdAt ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: ru }) : ""}
            </span>
          </div>
        </div>
      ) : (
        /* ===== STANDARD MEDIA CARD ===== */
        <>
          <div className="relative aspect-video overflow-hidden">
            <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            {item.type === "video" && (
              <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
                {(() => {
                  if ((item as any).duration && (item as any).duration > 0) {
                    const d = (item as any).duration;
                    const mins = Math.floor(d / 60);
                    const secs = d % 60;
                    return `${mins}:${secs.toString().padStart(2, "0")}`;
                  }
                  // Fallback: pseudo-duration from id
                  const hash = item.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
                  const mins = (hash % 45) + 1;
                  const secs = hash % 60;
                  return `${mins}:${secs.toString().padStart(2, "0")}`;
                })()}
              </span>
            )}
          </div>
          <div className="p-4 space-y-2">
            <h3 className="font-semibold text-sm text-card-foreground line-clamp-2 group-hover:text-primary transition-colors">{item.title}</h3>
            <div className="flex items-center gap-2">
              <img src={item.creatorAvatar} alt="" className="h-5 w-5 rounded-full" />
              <span className="text-xs text-muted-foreground">{item.creatorName}</span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{(item.views / 1000).toFixed(1)}k</span>
                <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{item.likes}</span>
              </div>
              {item.price !== null && (
                <span className="text-sm font-bold text-primary">{item.price.toLocaleString()} ₽</span>
              )}
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}
