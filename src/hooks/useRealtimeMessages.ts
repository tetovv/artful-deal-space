import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export function useRealtimeMessages(dealId?: string) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`deal-messages-${dealId || "all"}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          ...(dealId ? { filter: `deal_id=eq.${dealId}` } : {}),
        },
        (payload) => {
          const msg = payload.new as {
            sender_id: string;
            sender_name: string;
            content: string;
          };
          // Don't notify for own messages
          if (msg.sender_id !== user.id) {
            toast.info(`${msg.sender_name}: ${msg.content.slice(0, 80)}`, {
              description: "Новое сообщение в сделке",
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dealId, user]);
}
