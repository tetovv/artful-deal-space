import { useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageTransition } from "@/components/layout/PageTransition";
import { ContentCard } from "@/components/content/ContentCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search, UserPlus, UserCheck, Star, Eye, FileText, Rss, Sparkles, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ContentType } from "@/types";
import { contentTypeLabels } from "@/data/mockData";

const types: ContentType[] = ["video", "music", "post", "podcast", "book", "template"];

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
    duration: item.duration ?? null,
  };
}

type Tab = "feed" | "authors";

export default function Subscriptions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("feed");
  const [search, setSearch] = useState("");
  const [activeType, setActiveType] = useState<ContentType | null>(null);

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
  const { data: feedItems = [], isLoading: feedLoading } = useQuery({
    queryKey: ["subscription-feed", creatorIds],
    queryFn: async () => {
      if (!creatorIds.length) return [];
      const { data } = await supabase
        .from("content_items")
        .select("*")
        .in("creator_id", creatorIds)
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(50);
      return (data || []).map(mapItem);
    },
    enabled: creatorIds.length > 0,
  });

  // All creators for "authors" tab
  const { data: allCreators = [], isLoading: creatorsLoading } = useQuery({
    queryKey: ["all-creators"],
    queryFn: async () => {
      // Authors = users who published at least 1 content item
      const { data: contentData } = await supabase
        .from("content_items")
        .select("creator_id")
        .eq("status", "published")
        .not("creator_id", "is", null);
      if (!contentData?.length) return [];
      const ids = [...new Set(contentData.map((c) => c.creator_id!))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", ids);
      return profiles || [];
    },
  });

  const subscriptions = subscribedCreators.map((c: any) => c.user_id);

  const toggleSubscribe = async (creatorId: string) => {
    if (!user) return;
    const isSubbed = subscriptions.includes(creatorId);
    if (isSubbed) {
      await supabase.from("subscriptions").delete().eq("user_id", user.id).eq("creator_id", creatorId);
      toast.success("Отписка выполнена");
    } else {
      await supabase.from("subscriptions").insert({ user_id: user.id, creator_id: creatorId });
      toast.success("Вы подписались!");
    }
    refetchSubs();
  };

  const unsubscribe = async (creatorId: string) => {
    if (!user) return;
    await supabase.from("subscriptions").delete().eq("user_id", user.id).eq("creator_id", creatorId);
    toast.success("Отписка выполнена");
    refetchSubs();
  };

  // Filter feed items
  const filteredFeed = feedItems.filter((item: any) => {
    const matchSearch = item.title.toLowerCase().includes(search.toLowerCase()) || (item.tags || []).some((t: string) => t.toLowerCase().includes(search.toLowerCase()));
    const matchType = !activeType || item.type === activeType;
    return matchSearch && matchType;
  });

  // Filter authors
  const filteredAuthors = allCreators.filter((c: any) =>
    c.display_name?.toLowerCase().includes(search.toLowerCase()) ||
    (c.niche || []).some((n: string) => n.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <PageTransition>
      <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Tabs */}
        <div className="flex gap-1.5">
          <button
            onClick={() => { setTab("feed"); setSearch(""); setActiveType(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "feed" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            Лента
          </button>
          <button
            onClick={() => { setTab("authors"); setSearch(""); setActiveType(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "authors" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            Авторы
          </button>
        </div>

        {/* Search + type filters */}
        <div className="space-y-3">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={tab === "feed" ? "Поиск по ленте подписок..." : "Поиск авторов..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-card border-border"
            />
          </div>
          {tab === "feed" && (
            <div className="flex gap-1.5 flex-wrap">
              {types.map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveType(activeType === t ? null : t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeType === t ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"
                  }`}
                >
                  {contentTypeLabels[t] || t}
                </button>
              ))}
            </div>
          )}
        </div>


        {/* Feed tab */}
        {tab === "feed" && (
          <>
            {subscribedCreators.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="flex flex-col items-center justify-center py-20 space-y-6"
              >
                <div className="relative">
                  <motion.div
                    animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-0 rounded-full bg-primary/10 -m-4"
                  />
                  <motion.div
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                    className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center relative"
                  >
                    <UserPlus className="h-8 w-8 text-primary" />
                  </motion.div>
                </div>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.4 }}
                  className="text-center space-y-2 max-w-sm"
                >
                  <h3 className="text-xl font-bold text-foreground">Нет подписок</h3>
                  <p className="text-sm text-muted-foreground">
                    Подпишитесь на авторов, чтобы видеть их новый контент в этой ленте
                  </p>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.4 }}
                >
                  <Button onClick={() => setTab("authors")} size="lg" className="gap-2">
                    <UserPlus className="h-4 w-4" />Найти авторов
                  </Button>
                </motion.div>
              </motion.div>
            ) : feedLoading ? (
              <div className="text-center py-16 text-muted-foreground">Загрузка ленты...</div>
            ) : filteredFeed.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">Ничего не найдено</div>
            ) : activeType === "post" ? (
              <motion.div variants={stagger.container} initial="hidden" animate="show" className="space-y-4 max-w-2xl mx-auto">
                {filteredFeed.map((item: any) => (
                  <motion.div key={item.id} variants={stagger.item}>
                    <ContentCard item={item} />
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <motion.div variants={stagger.container} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredFeed.map((item: any) => (
                  <motion.div key={item.id} variants={stagger.item}>
                    <ContentCard item={item} />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </>
        )}

        {/* Authors tab */}
        {tab === "authors" && (
          <>
            {creatorsLoading ? (
              <div className="text-center py-16 text-muted-foreground">Загрузка...</div>
            ) : filteredAuthors.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">Авторы не найдены</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAuthors.map((creator: any) => {
                  const isSubbed = subscriptions.includes(creator.user_id);
                  return (
                    <Card key={creator.id} className="overflow-hidden hover:shadow-lg hover:border-primary/20 transition-all duration-300 group">
                      <CardContent className="p-5 space-y-4">
                        <div className="flex items-start gap-4">
                          <div
                            onClick={() => navigate(`/creator/${creator.user_id}`)}
                            className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary shrink-0 cursor-pointer overflow-hidden"
                          >
                            {creator.avatar_url ? (
                              <img src={creator.avatar_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              creator.display_name?.charAt(0)?.toUpperCase() || "A"
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3
                              onClick={() => navigate(`/creator/${creator.user_id}`)}
                              className="font-semibold text-foreground truncate cursor-pointer hover:text-primary transition-colors"
                            >
                              {creator.display_name || "Автор"}
                              {creator.verified && <span className="ml-1 text-primary">✓</span>}
                            </h3>
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{creator.bio || "Нет описания"}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{creator.content_count || 0}</span>
                          <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{((creator.reach || 0) / 1000).toFixed(0)}K</span>
                          <span className="flex items-center gap-1"><Star className="h-3 w-3" />{Number(creator.rating || 0).toFixed(1)}</span>
                        </div>

                        {(creator.niche || []).length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {(creator.niche as string[]).slice(0, 3).map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
                            ))}
                          </div>
                        )}

                        <Button
                          variant={isSubbed ? "outline" : "default"}
                          size="sm"
                          className="w-full"
                          onClick={() => toggleSubscribe(creator.user_id)}
                        >
                          {isSubbed ? <><UserCheck className="h-4 w-4 mr-2" />Подписан</> : <><UserPlus className="h-4 w-4 mr-2" />Подписаться</>}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </PageTransition>
  );
}

