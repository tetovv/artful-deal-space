import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageTransition } from "@/components/layout/PageTransition";
import { ContentCard } from "@/components/content/ContentCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UserCheck, Rss, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";

const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.06 } } },
  item: { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } },
};

function mapItem(item: any) {
  return {
    id: item.id,
    title: item.title,
    description: item.description || "",
    type: item.type,
    thumbnail: item.thumbnail || "",
    creatorId: item.creator_id || "",
    creatorName: item.creator_name || "",
    creatorAvatar: item.creator_avatar || "",
    price: item.price ?? null,
    views: item.views || 0,
    likes: item.likes || 0,
    createdAt: item.created_at || "",
    tags: item.tags || [],
  };
}

export default function Subscriptions() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Subscribed creators
  const { data: subscribedCreators = [], refetch: refetchSubs } = useQuery({
    queryKey: ["subscribed-creators", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: subs } = await supabase
        .from("subscriptions")
        .select("creator_id")
        .eq("user_id", user.id);
      if (!subs?.length) return [];
      const ids = subs.map((s) => s.creator_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", ids);
      return profiles || [];
    },
    enabled: !!user,
  });

  // Content from subscribed creators
  const creatorIds = subscribedCreators.map((c: any) => c.user_id);
  const { data: feedItems = [], isLoading } = useQuery({
    queryKey: ["subscription-feed", creatorIds],
    queryFn: async () => {
      if (!creatorIds.length) return [];
      const { data } = await supabase
        .from("content_items")
        .select("*")
        .in("creator_id", creatorIds)
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(20);
      return (data || []).map(mapItem);
    },
    enabled: creatorIds.length > 0,
  });

  const unsubscribe = async (creatorId: string) => {
    if (!user) return;
    await supabase.from("subscriptions").delete().eq("user_id", user.id).eq("creator_id", creatorId);
    toast.success("Отписка выполнена");
    refetchSubs();
  };

  return (
    <PageTransition>
      <div className="p-6 lg:p-8 space-y-8 max-w-7xl">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Подписки</h1>
          <p className="text-sm text-muted-foreground">Контент от ваших любимых авторов</p>
        </div>

        {/* Subscribed authors bar */}
        {subscribedCreators.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Мои авторы</h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {subscribedCreators.map((creator: any) => (
                <Card key={creator.id} className="shrink-0 w-48 hover:border-primary/20 transition-all">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div
                      onClick={() => navigate(`/creator/${creator.user_id}`)}
                      className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0 cursor-pointer overflow-hidden"
                    >
                      {creator.avatar_url ? (
                        <img src={creator.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        creator.display_name?.charAt(0)?.toUpperCase() || "A"
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{creator.display_name}</p>
                      <button onClick={() => unsubscribe(creator.user_id)} className="text-[10px] text-destructive hover:underline">Отписаться</button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Feed */}
        {subscribedCreators.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <Rss className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <h3 className="text-lg font-semibold">Нет подписок</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">Подпишитесь на авторов, чтобы видеть их новый контент в этой ленте</p>
            <Button onClick={() => navigate("/authors")}>
              <UserCheck className="h-4 w-4 mr-2" />Найти авторов
            </Button>
          </div>
        ) : isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Загрузка ленты...</div>
        ) : feedItems.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p>У ваших авторов пока нет публикаций</p>
          </div>
        ) : (
          <motion.div variants={stagger.container} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {feedItems.map((item: any) => (
              <motion.div key={item.id} variants={stagger.item}>
                <ContentCard item={item} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </PageTransition>
  );
}
