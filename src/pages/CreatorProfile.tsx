import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { creators, contentItems } from "@/data/mockData";
import { ArrowLeft } from "lucide-react";
import { PageTransition } from "@/components/layout/PageTransition";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useVideoViewCounts } from "@/hooks/useVideoViews";
import { usePostImpressionCounts } from "@/hooks/usePostImpressions";
import { useCreatorAnalytics } from "@/hooks/useCreatorAnalytics";
import { useExistingDraft } from "@/hooks/useDealProposals";
import { DealProposalForm } from "@/components/ad-studio/DealProposalForm";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import { ProfileHero } from "@/components/creator-profile/ProfileHero";
import { ProfileActionCard } from "@/components/creator-profile/ProfileActionCard";
import {
  BrandCard,
  OffersSection,
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
  const [proposalOpen, setProposalOpen] = useState(false);
  const [resumePromptOpen, setResumePromptOpen] = useState(false);

  const isOwnProfile = id === user?.id || id === "me";
  const profileUserId = isOwnProfile ? user?.id : id;
  const mockCreator = creators.find((c) => c.userId === id);

  /* ── Data queries ── */

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

  const { data: creatorOffers = [] } = useQuery({
    queryKey: ["creator-offers", profileUserId],
    queryFn: async () => {
      if (!profileUserId) return [];
      const { data } = await supabase.from("creator_offers").select("*").eq("creator_id", profileUserId).eq("is_active", true);
      return data || [];
    },
    enabled: !!profileUserId,
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

  const { data: hasActiveDeal } = useQuery({
    queryKey: ["has-active-deal", user?.id, profileUserId],
    queryFn: async () => {
      if (!user?.id || !profileUserId || isOwnProfile) return false;
      const { data } = await supabase.from("deals").select("id").or(`and(advertiser_id.eq.${user.id},creator_id.eq.${profileUserId}),and(advertiser_id.eq.${profileUserId},creator_id.eq.${user.id})`).in("status", ["in_progress", "review"]).limit(1);
      return data && data.length > 0;
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

  // Creator analytics for audience section
  const { data: analyticsData } = useCreatorAnalytics(profileUserId);

  // Existing draft check for proposal resume prompt
  const { data: existingDraft } = useExistingDraft(profileUserId);

  /* ── Mutations ── */

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

  /* ── Deal proposal CTA ── */
  const handleDealClick = () => {
    if (existingDraft) {
      setResumePromptOpen(true);
    } else {
      setProposalOpen(true);
    }
  };

  const [resumeDraft, setResumeDraft] = useState<any>(null);

  const handleResumeDraft = () => {
    setResumeDraft(existingDraft);
    setResumePromptOpen(false);
    setProposalOpen(true);
  };

  const handleStartNew = () => {
    setResumeDraft(null);
    setResumePromptOpen(false);
    setProposalOpen(true);
  };

  /* ── Derived ── */

  const profileData = isLoading ? null : mockCreator
    ? {
        avatar: mockCreator.avatar, name: mockCreator.displayName,
        verified: mockCreator.verified, bio: mockCreator.bio,
        niche: mockCreator.niche, responseHours: 24,
        dealsCount: 0, safeDeal: false,
      }
    : dbProfile
    ? {
        avatar: dbProfile.avatar_url || "", name: dbProfile.display_name,
        verified: dbProfile.verified || false, bio: dbProfile.bio || "",
        niche: dbProfile.niche || [],
        responseHours: dbProfile.response_hours,
        dealsCount: dbProfile.deals_count || 0,
        safeDeal: dbProfile.safe_deal || false,
      }
    : null;

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

  const turnaroundDays = creatorOffers.length > 0
    ? Math.max(...creatorOffers.map((o) => o.turnaround_days))
    : null;

  const videoIds = useMemo(() => contentToShow.filter(c => c.type === "video").map(c => c.id), [contentToShow]);
  const { data: videoViewCounts = {} } = useVideoViewCounts(videoIds);

  const postIds = useMemo(() => contentToShow.filter(c => c.type === "post").map(c => c.id), [contentToShow]);
  const { data: postImpressionCounts = {} } = usePostImpressionCounts(postIds);

  // Build creator info for proposal form
  const creatorInfo = profileUserId ? {
    userId: profileUserId,
    displayName: profileData?.name || "",
    avatarUrl: profileData?.avatar || null,
    offers: creatorOffers.map(o => ({
      type: o.offer_type === "video" ? "Видео-интеграция" : o.offer_type === "post" ? "Пост" : o.offer_type === "podcast" ? "Подкаст" : o.offer_type,
      price: o.price,
    })),
    platforms: [] as { name: string; metric: string }[],
  } : null;

  if (isLoading) {
    return <div className="p-8 text-muted-foreground animate-pulse">Загрузка профиля...</div>;
  }

  if (!profileData) {
    return <div className="p-8 text-muted-foreground">Автор не найден</div>;
  }

  return (
    <PageTransition>
      <div className="p-4 lg:p-8 max-w-[1200px] mx-auto space-y-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Назад
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
          {/* Left column */}
          <div className="space-y-6 min-w-0">
            <ProfileHero
              avatar={profileData.avatar}
              name={profileData.name}
              verified={profileData.verified}
              bio={profileData.bio}
              niche={profileData.niche}
            />

            {brandData && isAdvertiser && <BrandCard data={brandData} />}

            <OffersSection
              offers={creatorOffers}
              onDeal={!isOwnProfile ? handleDealClick : undefined}
            />

            <PortfolioSection items={contentToShow} videoViewCounts={videoViewCounts} postImpressionCounts={postImpressionCounts} />

            <AudienceCard connected={!!analyticsData} data={analyticsData} />

            <WorkingTermsCard />

            <AchievementsSection
              achievements={achievements}
              onViewAll={() => navigate("/achievements")}
            />
          </div>

          {/* Right column — sticky action card */}
          <ProfileActionCard
            isOwnProfile={isOwnProfile}
            isFollowing={!!isFollowing}
            hasPaidSub={!!hasPaidSub}
            dealSent={false}
            followPending={followMutation.isPending}
            paidSubPending={paidSubMutation.isPending}
            onFollow={() => followMutation.mutate()}
            onPaidSub={() => paidSubMutation.mutate()}
            onDeal={handleDealClick}
            onEditProfile={() => navigate("/settings")}
            responseHours={profileData.responseHours}
            dealsCount={profileData.dealsCount}
            turnaroundDays={turnaroundDays}
            safeDeal={profileData.safeDeal}
            hasActiveDeal={!!hasActiveDeal}
          />
        </div>
      </div>

      {/* Resume draft prompt */}
      <Dialog open={resumePromptOpen} onOpenChange={setResumePromptOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">У вас есть черновик</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Найден сохранённый черновик предложения для этого автора. Продолжить редактирование или начать заново?
          </p>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={handleStartNew}>Начать заново</Button>
            <Button onClick={handleResumeDraft}>Продолжить черновик</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Proposal form modal */}
      {creatorInfo && (
        <DealProposalForm
          open={proposalOpen}
          onClose={() => { setProposalOpen(false); setResumeDraft(null); }}
          creator={creatorInfo}
          resumeDraft={resumeDraft}
        />
      )}
    </PageTransition>
  );
};

export default CreatorProfile;
