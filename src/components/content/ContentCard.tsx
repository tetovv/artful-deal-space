import { ContentItem } from "@/types";
import { Eye, Heart, ThumbsUp, ThumbsDown, MessageCircle, Share2, MoreVertical, User, Send } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { useReaction } from "@/hooks/useReaction";

interface ContentCardProps {
  item: ContentItem & { duration?: number | null };
}

export function ContentCard({ item }: ContentCardProps) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Like/dislike state (real-time, persisted)
  const { likes, dislikes, userReaction, toggleReaction } = useReaction(item.id);

  // Comments
  const { data: comments = [] } = useQuery({
    queryKey: ["post-comments", item.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("comments")
        .select("*")
        .eq("content_id", item.id)
        .order("created_at", { ascending: true })
        .limit(20);
      return data || [];
    },
    enabled: item.type === "post",
  });

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleReaction("like");
  };

  const handleDislike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleReaction("dislike");
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user || !commentText.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("comments").insert({
      content_id: item.id,
      user_id: user.id,
      user_name: profile?.display_name || "Пользователь",
      user_avatar: profile?.avatar_url || "",
      content: commentText.trim(),
    });
    if (error) { toast.error("Ошибка"); }
    else { setCommentText(""); queryClient.invalidateQueries({ queryKey: ["post-comments", item.id] }); }
    setSubmitting(false);
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(window.location.origin + `/product/${item.id}`);
    toast.success("Ссылка скопирована");
  };

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
        <div className="p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/product/${item.id}`)}>
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
          <p className="text-sm text-card-foreground whitespace-pre-wrap line-clamp-4 cursor-pointer" onClick={() => navigate(`/product/${item.id}`)}>
            {item.description || item.title}
          </p>
          {item.thumbnail && (
            <img src={item.thumbnail} alt="" className="w-full rounded-lg max-h-64 object-cover" />
          )}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-4">
              <button
                onClick={handleLike}
                className={`flex items-center gap-1.5 text-xs transition-colors ${userReaction === "like" ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
              >
                <ThumbsUp className="h-4 w-4" fill={userReaction === "like" ? "currentColor" : "none"} />
                {likes > 0 && <span>{likes}</span>}
              </button>
              <button
                onClick={handleDislike}
                className={`flex items-center gap-1.5 text-xs transition-colors ${userReaction === "dislike" ? "text-destructive" : "text-muted-foreground hover:text-destructive"}`}
              >
                <ThumbsDown className="h-4 w-4" fill={userReaction === "dislike" ? "currentColor" : "none"} />
                {dislikes > 0 && <span>{dislikes}</span>}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }}
                className="flex items-center gap-1.5 text-muted-foreground hover:text-primary text-xs transition-colors"
              >
                <MessageCircle className="h-4 w-4" /> {comments.length}
              </button>
              <button onClick={handleShare} className="text-muted-foreground hover:text-primary transition-colors">
                <Share2 className="h-4 w-4" />
              </button>
            </div>
            <span className="text-xs text-muted-foreground">
              {item.createdAt ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: ru }) : ""}
            </span>
          </div>

          {/* Comments section */}
          {showComments && (
            <div className="space-y-3 pt-2 border-t border-border" onClick={(e) => e.stopPropagation()}>
              {comments.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {comments.map((c: any) => (
                    <div key={c.id} className="flex gap-2">
                      {c.user_avatar ? (
                        <img src={c.user_avatar} alt="" className="h-6 w-6 rounded-full shrink-0 mt-0.5" />
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                          <User className="h-3 w-3 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-card-foreground">{c.user_name}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ru })}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{c.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <form onSubmit={handleComment} className="flex gap-2">
                <Input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Написать комментарий..."
                  className="h-8 text-xs"
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  type="submit"
                  disabled={submitting || !commentText.trim()}
                  className="text-primary hover:text-primary/80 disabled:text-muted-foreground transition-colors shrink-0"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          )}
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
                <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" />{likes}</span>
                {dislikes > 0 && <span className="flex items-center gap-1"><ThumbsDown className="h-3 w-3" />{dislikes}</span>}
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
