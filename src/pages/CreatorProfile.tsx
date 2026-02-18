import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { creators, contentItems } from "@/data/mockData";
import { ContentCard } from "@/components/content/ContentCard";
import { ArrowLeft, MapPin, Users, Star, CheckCircle, Eye, Package, Handshake, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageTransition } from "@/components/layout/PageTransition";
import { useState, useMemo } from "react";

const CreatorProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dealSent, setDealSent] = useState(false);

  // Check if it's current user's own profile
  const isOwnProfile = id === user?.id || id === "me";

  // Try mock data first
  const mockCreator = creators.find((c) => c.userId === id);

  // Load from DB if not in mocks
  const { data: dbProfile, isLoading } = useQuery({
    queryKey: ["creator-profile", id],
    queryFn: async () => {
      const userId = isOwnProfile ? user?.id : id;
      if (!userId) return null;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();
      return data;
    },
    enabled: !mockCreator && !!id,
  });

  // Load creator's content from DB
  const profileUserId = isOwnProfile ? user?.id : id;
  const { data: dbContent = [] } = useQuery({
    queryKey: ["creator-content", profileUserId],
    queryFn: async () => {
      if (!profileUserId) return [];
      const { data } = await supabase
        .from("content_items")
        .select("*")
        .eq("creator_id", profileUserId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !mockCreator && !!profileUserId,
  });

  if (isLoading) {
    return (
      <div className="p-8 text-muted-foreground animate-pulse">Загрузка профиля...</div>
    );
  }

  // Use mock data if available, otherwise DB
  if (mockCreator) {
    const creatorContent = contentItems.filter((c) => c.creatorId === mockCreator.userId);
    return (
      <PageTransition>
        <div className="p-6 lg:p-8 max-w-5xl space-y-8">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Назад
          </button>
          <ProfileHeader
            avatar={mockCreator.avatar}
            name={mockCreator.displayName}
            verified={mockCreator.verified}
            geo={mockCreator.geo}
            bio={mockCreator.bio}
            niche={mockCreator.niche}
            isOwn={false}
            dealSent={dealSent}
            onDeal={() => setDealSent(true)}
          />
          <StatsGrid
            followers={mockCreator.followers}
            reach={mockCreator.reach}
            contentCount={mockCreator.contentCount}
            rating={mockCreator.rating}
          />
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Портфолио</h2>
            {creatorContent.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {creatorContent.map((item) => (
                  <ContentCard key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <EmptyPortfolio />
            )}
          </section>
        </div>
      </PageTransition>
    );
  }

  if (!dbProfile) {
    return <div className="p-8 text-muted-foreground">Автор не найден</div>;
  }

  return (
    <PageTransition>
      <div className="p-6 lg:p-8 max-w-5xl space-y-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Назад
        </button>
        <ProfileHeader
          avatar={dbProfile.avatar_url || ""}
          name={dbProfile.display_name}
          verified={dbProfile.verified || false}
          geo={dbProfile.geo || ""}
          bio={dbProfile.bio || ""}
          niche={dbProfile.niche || []}
          isOwn={isOwnProfile}
          dealSent={dealSent}
          onDeal={() => setDealSent(true)}
        />
        <StatsGrid
          followers={dbProfile.followers || 0}
          reach={dbProfile.reach || 0}
          contentCount={dbProfile.content_count || 0}
          rating={Number(dbProfile.rating) || 0}
        />
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Портфолио</h2>
          {dbContent.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {dbContent.map((item) => (
                <ContentCard key={item.id} item={{
                  id: item.id,
                  title: item.title,
                  description: item.description || "",
                  type: item.type as any,
                  thumbnail: item.thumbnail || "",
                  creatorId: item.creator_id || "",
                  creatorName: item.creator_name,
                  creatorAvatar: item.creator_avatar || "",
                  price: item.price,
                  views: item.views || 0,
                  likes: item.likes || 0,
                  createdAt: item.created_at,
                  tags: item.tags || [],
                }} />
              ))}
            </div>
          ) : (
            <EmptyPortfolio />
          )}
        </section>
      </div>
    </PageTransition>
  );
};

function ProfileHeader({
  avatar, name, verified, geo, bio, niche, isOwn, dealSent, onDeal,
}: {
  avatar: string; name: string; verified: boolean; geo: string;
  bio: string; niche: string[]; isOwn: boolean; dealSent: boolean; onDeal: () => void;
}) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col sm:flex-row items-start gap-6">
      <div className="h-20 w-20 rounded-2xl border-2 border-border bg-muted flex items-center justify-center overflow-hidden shrink-0">
        {avatar ? (
          <img src={avatar} alt="" className="h-full w-full object-cover" />
        ) : (
          <User className="h-8 w-8 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-foreground">{name}</h1>
          {verified && <CheckCircle className="h-5 w-5 text-primary" />}
        </div>
        {geo && <p className="text-sm text-muted-foreground flex items-center gap-1"><MapPin className="h-4 w-4" />{geo}</p>}
        {bio && <p className="text-sm text-muted-foreground">{bio}</p>}
        {niche.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {niche.map((n) => (
              <Badge key={n} variant="secondary" className="text-xs">{n}</Badge>
            ))}
          </div>
        )}
      </div>
      {isOwn ? (
        <Button variant="outline" className="shrink-0" onClick={() => navigate("/settings")}>
          Редактировать профиль
        </Button>
      ) : (
        <Button className="shrink-0 glow-primary" disabled={dealSent} onClick={onDeal}>
          <Handshake className="h-4 w-4 mr-2" />
          {dealSent ? "Заявка отправлена" : "Предложить сделку"}
        </Button>
      )}
    </div>
  );
}

function StatsGrid({ followers, reach, contentCount, rating }: {
  followers: number; reach: number; contentCount: number; rating: number;
}) {
  const stats = [
    { label: "Подписчики", value: followers > 1000 ? `${(followers / 1000).toFixed(0)}K` : String(followers), icon: Users },
    { label: "Охват", value: reach > 1000 ? `${(reach / 1000).toFixed(0)}K` : String(reach), icon: Eye },
    { label: "Контент", value: String(contentCount), icon: Package },
    { label: "Рейтинг", value: rating > 0 ? rating.toFixed(1) : "—", icon: Star },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {stats.map((s) => (
        <div key={s.label} className="rounded-xl border border-border bg-card p-4 text-center">
          <s.icon className="h-4 w-4 mx-auto mb-2 text-muted-foreground" />
          <p className="text-xl font-bold text-card-foreground">{s.value}</p>
          <p className="text-xs text-muted-foreground">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

function EmptyPortfolio() {
  return (
    <div className="text-center py-12 text-muted-foreground rounded-xl border border-border bg-card">
      У автора пока нет опубликованного контента
    </div>
  );
}

export default CreatorProfile;
