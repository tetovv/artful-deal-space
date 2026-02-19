import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { creators, contentItems } from "@/data/mockData";
import { ContentCard } from "@/components/content/ContentCard";
import { ArrowLeft, MapPin, Users, Star, CheckCircle, Eye, Package, Handshake, User, Crown, Trophy, Bookmark, Rss } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageTransition } from "@/components/layout/PageTransition";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CreatorProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dealSent, setDealSent] = useState(false);

  const isOwnProfile = id === user?.id || id === "me";
  const profileUserId = isOwnProfile ? user?.id : id;

  const mockCreator = creators.find((c) => c.userId === id);

  const { data: dbProfile, isLoading } = useQuery({
    queryKey: ["creator-profile", id],
    queryFn: async () => {
      if (!profileUserId) return null;
      const { data } = await supabase.from("profiles").select("*").eq("user_id", profileUserId).single();
      return data;
    },
    enabled: !mockCreator && !!profileUserId,
  });

  const { data: dbContent = [] } = useQuery({
    queryKey: ["creator-content", profileUserId],
    queryFn: async () => {
      if (!profileUserId) return [];
      const { data } = await supabase.from("content_items").select("*").eq("creator_id", profileUserId).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !mockCreator && !!profileUserId,
  });

  // Free subscription (follow)
  const { data: isFollowing } = useQuery({
    queryKey: ["is-following", user?.id, profileUserId],
    queryFn: async () => {
      if (!user?.id || !profileUserId || isOwnProfile) return false;
      const { data } = await supabase.from("subscriptions").select("id").eq("user_id", user.id).eq("creator_id", profileUserId).maybeSingle();
      return !!data;
    },
    enabled: !!user?.id && !!profileUserId && !isOwnProfile,
  });

  // Paid subscription
  const { data: hasPaidSub } = useQuery({
    queryKey: ["has-paid-sub", user?.id, profileUserId],
    queryFn: async () => {
      if (!user?.id || !profileUserId || isOwnProfile) return false;
      const { data } = await supabase.from("paid_subscriptions").select("id").eq("user_id", user.id).eq("creator_id", profileUserId).eq("status", "active").maybeSingle();
      return !!data;
    },
    enabled: !!user?.id && !!profileUserId && !isOwnProfile,
  });

  // Achievements
  const { data: achievements = [] } = useQuery({
    queryKey: ["achievements", profileUserId],
    queryFn: async () => {
      if (!profileUserId) return [];
      const { data } = await supabase.from("achievements").select("*").eq("user_id", profileUserId).order("earned_at", { ascending: false });
      return data || [];
    },
    enabled: !!profileUserId,
  });

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !profileUserId) throw new Error("Not authenticated");
      if (isFollowing) {
        await supabase.from("subscriptions").delete().eq("user_id", user.id).eq("creator_id", profileUserId);
      } else {
        await supabase.from("subscriptions").insert({ user_id: user.id, creator_id: profileUserId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["is-following"] });
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      toast.success(isFollowing ? "Вы отписались" : "Вы подписались!");
    },
  });

  const paidSubMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !profileUserId) throw new Error("Not authenticated");
      if (hasPaidSub) {
        await supabase.from("paid_subscriptions").update({ status: "cancelled" }).eq("user_id", user.id).eq("creator_id", profileUserId);
      } else {
        await supabase.from("paid_subscriptions").insert({ user_id: user.id, creator_id: profileUserId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["has-paid-sub"] });
      toast.success(hasPaidSub ? "Подписка отменена" : "Подписка оформлена!");
    },
  });

  if (isLoading) {
    return <div className="p-8 text-muted-foreground animate-pulse">Загрузка профиля...</div>;
  }

  const profileData = mockCreator
    ? { avatar: mockCreator.avatar, name: mockCreator.displayName, verified: mockCreator.verified, geo: mockCreator.geo, bio: mockCreator.bio, niche: mockCreator.niche, followers: mockCreator.followers, reach: mockCreator.reach, contentCount: mockCreator.contentCount, rating: mockCreator.rating }
    : dbProfile
    ? { avatar: dbProfile.avatar_url || "", name: dbProfile.display_name, verified: dbProfile.verified || false, geo: dbProfile.geo || "", bio: dbProfile.bio || "", niche: dbProfile.niche || [], followers: dbProfile.followers || 0, reach: dbProfile.reach || 0, contentCount: dbProfile.content_count || 0, rating: Number(dbProfile.rating) || 0 }
    : null;

  if (!profileData) {
    return <div className="p-8 text-muted-foreground">Автор не найден</div>;
  }

  const contentToShow = mockCreator
    ? contentItems.filter((c) => c.creatorId === mockCreator.userId)
    : dbContent.map((item) => ({
        id: item.id, title: item.title, description: item.description || "",
        type: item.type as any, thumbnail: item.thumbnail || "",
        creatorId: item.creator_id || "", creatorName: item.creator_name,
        creatorAvatar: item.creator_avatar || "", price: item.price,
        views: item.views || 0, likes: item.likes || 0,
        createdAt: item.created_at, tags: item.tags || [],
      }));

  return (
    <PageTransition>
      <div className="p-6 lg:p-8 max-w-5xl space-y-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Назад
        </button>

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <div className="h-20 w-20 rounded-2xl border-2 border-border bg-muted flex items-center justify-center overflow-hidden shrink-0">
            {profileData.avatar ? <img src={profileData.avatar} alt="" className="h-full w-full object-cover" /> : <User className="h-8 w-8 text-muted-foreground" />}
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">{profileData.name}</h1>
              {profileData.verified && <CheckCircle className="h-5 w-5 text-primary" />}
            </div>
            {profileData.geo && <p className="text-sm text-muted-foreground flex items-center gap-1"><MapPin className="h-4 w-4" />{profileData.geo}</p>}
            {profileData.bio && <p className="text-sm text-muted-foreground">{profileData.bio}</p>}
            {profileData.niche.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {profileData.niche.map((n) => <Badge key={n} variant="secondary" className="text-xs">{n}</Badge>)}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 shrink-0">
            {isOwnProfile ? (
              <Button variant="outline" onClick={() => navigate("/settings")}>Редактировать профиль</Button>
            ) : (
              <>
                <Button
                  variant={isFollowing ? "outline" : "default"}
                  onClick={() => followMutation.mutate()}
                  disabled={followMutation.isPending}
                  size="sm"
                >
                  <Rss className="h-4 w-4 mr-2" />
                  {isFollowing ? "Отписаться" : "Подписаться"}
                </Button>
                <Button
                  variant={hasPaidSub ? "outline" : "default"}
                  onClick={() => paidSubMutation.mutate()}
                  disabled={paidSubMutation.isPending}
                  size="sm"
                  className={cn(!hasPaidSub && "bg-gradient-to-r from-warning to-destructive/80 hover:from-warning/90 hover:to-destructive/70 text-primary-foreground border-0")}
                >
                  <Crown className="h-4 w-4 mr-2" />
                  {hasPaidSub ? "Отменить подписку" : "Платная подписка"}
                </Button>
                <Button className="glow-primary" size="sm" disabled={dealSent} onClick={() => setDealSent(true)}>
                  <Handshake className="h-4 w-4 mr-2" />
                  {dealSent ? "Заявка отправлена" : "Предложить сделку"}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Подписчики", value: profileData.followers > 1000 ? `${(profileData.followers / 1000).toFixed(0)}K` : String(profileData.followers), icon: Users },
            { label: "Охват", value: profileData.reach > 1000 ? `${(profileData.reach / 1000).toFixed(0)}K` : String(profileData.reach), icon: Eye },
            { label: "Контент", value: String(profileData.contentCount), icon: Package },
            { label: "Рейтинг", value: profileData.rating > 0 ? profileData.rating.toFixed(1) : "—", icon: Star },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4 text-center">
              <s.icon className="h-4 w-4 mx-auto mb-2 text-muted-foreground" />
              <p className="text-xl font-bold text-card-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Achievements */}
        {achievements.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2"><Trophy className="h-5 w-5 text-warning" /> Достижения</h2>
            <div className="flex flex-wrap gap-3">
              {achievements.map((a: any) => (
                <div key={a.id} className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 hover:border-primary/30 transition-colors">
                  <span className="text-xl">{a.icon || "🏆"}</span>
                  <div>
                    <p className="text-sm font-medium text-card-foreground">{a.title}</p>
                    {a.description && <p className="text-[11px] text-muted-foreground">{a.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Portfolio */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Портфолио</h2>
          {contentToShow.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {contentToShow.map((item) => (
                <ContentCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground rounded-xl border border-border bg-card">
              У автора пока нет опубликованного контента
            </div>
          )}
        </section>
      </div>
    </PageTransition>
  );
};

export default CreatorProfile;
