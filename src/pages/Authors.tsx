import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageTransition } from "@/components/layout/PageTransition";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search, UserPlus, UserCheck, Star, Eye, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function Authors() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  // Fetch all creator profiles
  const { data: creators = [], isLoading } = useQuery({
    queryKey: ["all-creators"],
    queryFn: async () => {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "creator");
      if (!roleData?.length) return [];
      const creatorIds = roleData.map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", creatorIds);
      return profiles || [];
    },
  });

  // Fetch user's subscriptions
  const { data: subscriptions = [], refetch: refetchSubs } = useQuery({
    queryKey: ["my-subscriptions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("subscriptions")
        .select("creator_id")
        .eq("user_id", user.id);
      return (data || []).map((s) => s.creator_id);
    },
    enabled: !!user,
  });

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

  const filtered = creators.filter((c: any) =>
    c.display_name?.toLowerCase().includes(search.toLowerCase()) ||
    (c.niche || []).some((n: string) => n.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <PageTransition>
      <div className="p-6 lg:p-8 space-y-6 max-w-7xl">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Авторы</h1>
          <p className="text-sm text-muted-foreground">Находите и подписывайтесь на интересных авторов</p>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Поиск авторов..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-card border-border" />
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Загрузка...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">Авторы не найдены</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((creator: any) => {
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
      </div>
    </PageTransition>
  );
}
