import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { creators, contentItems } from "@/data/mockData";
import { ArrowLeft } from "lucide-react";
import { PageTransition } from "@/components/layout/PageTransition";
import { useState } from "react";
import { toast } from "sonner";

import { ProfileHero } from "@/components/creator-profile/ProfileHero";
import { ProfileActionCard } from "@/components/creator-profile/ProfileActionCard";
import {
  BrandCard,
  PortfolioSection,
  AudienceCard,
  WorkingTermsCard,
  AchievementsSection,
} from "@/components/creator-profile/ProfileModules";

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

  const { data: isFollowing } = useQuery({
    queryKey: ["is-following", user?.id, profileUserId],
    queryFn: async () => {
      if (!user?.id || !profileUserId || isOwnProfile) return false;
      const { data } = await supabase.from("subscriptions").select("id").eq("user_id", user.id).eq("creator_id", profileUserId).maybeSingle();
      return !!data;
    },
    enabled: !!user?.id && !!profileUserId && !isOwnProfile,
  });

  const { data: hasPaidSub } = useQuery({
    queryKey: ["has-paid-sub", user?.id, profileUserId],
    queryFn: async () => {
      if (!user?.id || !profileUserId || isOwnProfile) return false;
      const { data } = await supabase.from("paid_subscriptions").select("id").eq("user_id", user.id).eq("creator_id", profileUserId).eq("status", "active").maybeSingle();
      return !!data;
    },
    enabled: !!user?.id && !!profileUserId && !isOwnProfile,
  });

  const { data: achievements = [] } = useQuery({
    queryKey: ["achievements", profileUserId],
    queryFn: async () => {
      if (!profileUserId) return [];
      const { data } = await supabase.from("achievements").select("*").eq("user_id", profileUserId).order("earned_at", { ascending: false });
      return data || [];
    },
    enabled: !!profileUserId,
  });

  const { data: brandData } = useQuery({
    queryKey: ["advertiser-brand", profileUserId],
    queryFn: async () => {
      if (!profileUserId) return null;
      const { data } = await supabase.rpc("get_advertiser_brand", { p_user_id: profileUserId });
      return data && data.length > 0 ? data[0] : null;
    },
    enabled: !!profileUserId,
  });

  const { data: isAdvertiser } = useQuery({
    queryKey: ["is-advertiser", profileUserId],
    queryFn: async () => {
      if (!profileUserId) return false;
      const { data } = await supabase.rpc("has_role", { _user_id: profileUserId, _role: "advertiser" });
      return !!data;
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
      <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Назад
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
          <div className="space-y-6 min-w-0">
            <ProfileHero
              avatar={profileData.avatar}
              name={profileData.name}
              verified={profileData.verified}
              geo={profileData.geo}
              bio={profileData.bio}
              niche={profileData.niche}
              rating={profileData.rating}
            />

            {brandData && isAdvertiser && <BrandCard data={brandData} />}

            <PortfolioSection
              items={contentToShow}
              onRequestDeal={!isOwnProfile ? () => setDealSent(true) : undefined}
            />

            <AudienceCard />

            <WorkingTermsCard />

            <AchievementsSection
              achievements={achievements}
              onViewAll={() => navigate("/achievements")}
            />
          </div>

          <ProfileActionCard
            isOwnProfile={isOwnProfile}
            isFollowing={!!isFollowing}
            hasPaidSub={!!hasPaidSub}
            dealSent={dealSent}
            followPending={followMutation.isPending}
            paidSubPending={paidSubMutation.isPending}
            onFollow={() => followMutation.mutate()}
            onPaidSub={() => paidSubMutation.mutate()}
            onDeal={() => setDealSent(true)}
            onEditProfile={() => navigate("/settings")}
            followers={profileData.followers}
            reach={profileData.reach}
            contentCount={profileData.contentCount}
          />
        </div>
      </div>
    </PageTransition>
  );
};

export default CreatorProfile;
