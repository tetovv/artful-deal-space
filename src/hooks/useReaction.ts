import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type Reaction = "like" | "dislike" | null;

interface ReactionState {
  likes: number;
  dislikes: number;
  userReaction: Reaction;
  toggleReaction: (type: "like" | "dislike") => Promise<void>;
  loading: boolean;
}

export function useReaction(contentId: string | undefined): ReactionState {
  const { user } = useAuth();
  const [likes, setLikes] = useState(0);
  const [dislikes, setDislikes] = useState(0);
  const [userReaction, setUserReaction] = useState<Reaction>(null);
  const [loading, setLoading] = useState(false);

  // Fetch initial counts + user reaction
  useEffect(() => {
    if (!contentId) return;

    // Get counts from content_items
    supabase
      .from("content_items")
      .select("likes, dislikes")
      .eq("id", contentId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setLikes(data.likes || 0);
          setDislikes((data as any).dislikes || 0);
        }
      });

    // Get user's reaction
    if (user) {
      supabase
        .from("content_reactions" as any)
        .select("reaction")
        .eq("user_id", user.id)
        .eq("content_id", contentId)
        .maybeSingle()
        .then(({ data }: any) => {
          if (data) setUserReaction(data.reaction as Reaction);
          else setUserReaction(null);
        });
    }
  }, [contentId, user]);

  // Realtime subscription for count updates
  useEffect(() => {
    if (!contentId) return;

    const channel = supabase
      .channel(`content-reactions-${contentId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "content_items",
          filter: `id=eq.${contentId}`,
        },
        (payload: any) => {
          if (payload.new) {
            setLikes(payload.new.likes || 0);
            setDislikes(payload.new.dislikes || 0);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [contentId]);

  const toggleReaction = useCallback(
    async (type: "like" | "dislike") => {
      if (!user) {
        toast.error("Войдите, чтобы оценить");
        return;
      }
      if (!contentId || loading) return;
      setLoading(true);

      try {
        if (userReaction === type) {
          // Remove reaction
          await (supabase.from("content_reactions" as any) as any)
            .delete()
            .eq("user_id", user.id)
            .eq("content_id", contentId);
          setUserReaction(null);
          // Optimistic
          if (type === "like") setLikes((l) => Math.max(0, l - 1));
          else setDislikes((d) => Math.max(0, d - 1));
        } else {
          // Upsert reaction
          const { error } = await (supabase.from("content_reactions" as any) as any)
            .upsert(
              { user_id: user.id, content_id: contentId, reaction: type },
              { onConflict: "user_id,content_id" }
            );
          if (error) throw error;

          // Optimistic
          if (userReaction === "like") setLikes((l) => Math.max(0, l - 1));
          if (userReaction === "dislike") setDislikes((d) => Math.max(0, d - 1));
          if (type === "like") setLikes((l) => l + 1);
          else setDislikes((d) => d + 1);
          setUserReaction(type);
        }
      } catch (e) {
        console.error("Reaction error:", e);
        toast.error("Ошибка при оценке");
      }
      setLoading(false);
    },
    [user, contentId, userReaction, loading]
  );

  return { likes, dislikes, userReaction, toggleReaction, loading };
}
