import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ThumbsUp, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Comment {
  id: string;
  content_id: string;
  user_id: string;
  user_name: string;
  user_avatar: string;
  content: string;
  parent_id: string | null;
  likes: number;
  created_at: string;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "только что";
  if (mins < 60) return `${mins} мин. назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч. назад`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} дн. назад`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} мес. назад`;
  return `${Math.floor(months / 12)} г. назад`;
}

function CommentItem({
  comment,
  replies,
  contentId,
}: {
  comment: Comment;
  replies: Comment[];
  contentId: string;
}) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [showReplies, setShowReplies] = useState(false);

  const replyMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("comments").insert({
        content_id: contentId,
        user_id: user.id,
        user_name: profile?.display_name || user.email?.split("@")[0] || "Аноним",
        user_avatar: profile?.avatar_url || "",
        content: text,
        parent_id: comment.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", contentId] });
      setReplyText("");
      setShowReplyInput(false);
      setShowReplies(true);
    },
    onError: () => toast.error("Не удалось отправить ответ"),
  });

  return (
    <div className="flex gap-3">
      {comment.user_avatar ? (
        <img src={comment.user_avatar} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
      ) : (
        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
          {comment.user_name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-foreground">{comment.user_name}</span>
          <span className="text-xs text-muted-foreground">{timeAgo(comment.created_at)}</span>
        </div>
        <p className="text-sm text-foreground whitespace-pre-wrap">{comment.content}</p>
        <div className="flex items-center gap-3 -ml-1">
          <Button variant="ghost" size="sm" className="h-7 px-1.5 text-muted-foreground gap-1">
            <ThumbsUp className="h-3.5 w-3.5" />
            {comment.likes > 0 && <span className="text-xs">{comment.likes}</span>}
          </Button>
          {user && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-1.5 text-muted-foreground text-xs"
              onClick={() => setShowReplyInput(!showReplyInput)}
            >
              Ответить
            </Button>
          )}
        </div>

        {showReplyInput && (
          <div className="flex gap-2 items-end pt-1">
            <Textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Ваш ответ..."
              className="min-h-[36px] text-sm resize-none"
              rows={1}
            />
            <div className="flex gap-1 shrink-0">
              <Button variant="ghost" size="sm" onClick={() => { setShowReplyInput(false); setReplyText(""); }}>
                Отмена
              </Button>
              <Button
                size="sm"
                disabled={!replyText.trim() || replyMutation.isPending}
                onClick={() => replyMutation.mutate(replyText.trim())}
              >
                Ответить
              </Button>
            </div>
          </div>
        )}

        {replies.length > 0 && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="text-primary text-xs gap-1 h-7 -ml-1"
              onClick={() => setShowReplies(!showReplies)}
            >
              {showReplies ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {replies.length} {replies.length === 1 ? "ответ" : replies.length < 5 ? "ответа" : "ответов"}
            </Button>
            {showReplies && (
              <div className="space-y-3 pt-2">
                {replies.map((r) => (
                  <CommentItem key={r.id} comment={r} replies={[]} contentId={contentId} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function CommentsSection({ contentId }: { contentId: string }) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);

  const { data: comments = [] } = useQuery({
    queryKey: ["comments", contentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("*")
        .eq("content_id", contentId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Comment[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("comments").insert({
        content_id: contentId,
        user_id: user.id,
        user_name: profile?.display_name || user.email?.split("@")[0] || "Аноним",
        user_avatar: profile?.avatar_url || "",
        content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", contentId] });
      setText("");
      setFocused(false);
    },
    onError: () => toast.error("Не удалось отправить комментарий"),
  });

  const topLevel = comments.filter((c) => !c.parent_id);
  const repliesMap = comments.reduce<Record<string, Comment[]>>((acc, c) => {
    if (c.parent_id) {
      acc[c.parent_id] = acc[c.parent_id] || [];
      acc[c.parent_id].push(c);
    }
    return acc;
  }, {});

  return (
    <div className="space-y-5 mt-6">
      <h2 className="text-base font-semibold text-foreground">
        {comments.length} {comments.length === 1 ? "комментарий" : comments.length < 5 ? "комментария" : "комментариев"}
      </h2>

      {/* Add comment */}
      {user ? (
        <div className="flex gap-3">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
          ) : (
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
              {(profile?.display_name || "U").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 space-y-2">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onFocus={() => setFocused(true)}
              placeholder="Введите комментарий..."
              className="min-h-[36px] text-sm resize-none"
              rows={focused ? 3 : 1}
            />
            {focused && (
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setFocused(false); setText(""); }}>
                  Отмена
                </Button>
                <Button
                  size="sm"
                  disabled={!text.trim() || addMutation.isPending}
                  onClick={() => addMutation.mutate(text.trim())}
                >
                  Оставить комментарий
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Войдите, чтобы оставить комментарий</p>
      )}

      {/* Comments list */}
      <div className="space-y-5">
        {topLevel.map((c) => (
          <CommentItem key={c.id} comment={c} replies={repliesMap[c.id] || []} contentId={contentId} />
        ))}
      </div>
    </div>
  );
}
