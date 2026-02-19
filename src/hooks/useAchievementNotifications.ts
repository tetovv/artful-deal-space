import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useAchievementNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;

    // Check if achievements notifications are enabled
    const settings = JSON.parse(localStorage.getItem("mediaos-settings") || "{}");
    if (settings.achievementNotifications === false) return;

    const channel = supabase
      .channel("achievements-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "achievements",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const achievement = payload.new as any;
          toast.success(`🏆 Новое достижение: ${achievement.title}`, {
            description: achievement.description || undefined,
            duration: 5000,
          });
          queryClient.invalidateQueries({ queryKey: ["my-achievements"] });
          queryClient.invalidateQueries({ queryKey: ["achievements"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);
}
