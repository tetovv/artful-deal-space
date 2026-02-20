import { Handshake, MessageSquare, Rss, Crown, Users, Eye, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ProfileActionCardProps {
  isOwnProfile: boolean;
  isFollowing: boolean;
  hasPaidSub: boolean;
  dealSent: boolean;
  followPending: boolean;
  paidSubPending: boolean;
  onFollow: () => void;
  onPaidSub: () => void;
  onDeal: () => void;
  onEditProfile: () => void;
  followers: number;
  reach: number;
  contentCount: number;
}

const formatNum = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : String(n));

export const ProfileActionCard = ({
  isOwnProfile, isFollowing, hasPaidSub, dealSent,
  followPending, paidSubPending,
  onFollow, onPaidSub, onDeal, onEditProfile,
  followers, reach, contentCount,
}: ProfileActionCardProps) => (
  <div className="rounded-xl border border-border bg-card p-5 space-y-4 lg:sticky lg:top-6">
    {/* Stats row */}
    <div className="grid grid-cols-3 gap-3">
      {[
        { label: "Подписчики", value: formatNum(followers), icon: Users },
        { label: "Охват", value: formatNum(reach), icon: Eye },
        { label: "Контент", value: String(contentCount), icon: Package },
      ].map((s) => (
        <div key={s.label} className="text-center">
          <s.icon className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
          <p className="text-lg font-bold text-card-foreground leading-none">{s.value}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
        </div>
      ))}
    </div>

    <div className="h-px bg-border" />

    {/* CTAs */}
    {isOwnProfile ? (
      <Button variant="outline" className="w-full" onClick={onEditProfile}>
        Редактировать профиль
      </Button>
    ) : (
      <div className="space-y-2">
        <Button
          className="w-full glow-primary"
          size="lg"
          disabled={dealSent}
          onClick={onDeal}
        >
          <Handshake className="h-4 w-4 mr-2" />
          {dealSent ? "Заявка отправлена" : "Предложить сделку"}
        </Button>

        <Button
          variant="outline"
          className="w-full"
          size="sm"
          disabled
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          Написать
          <span className="text-[10px] text-muted-foreground ml-1">(через сделку)</span>
        </Button>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={isFollowing ? "secondary" : "ghost"}
            onClick={onFollow}
            disabled={followPending}
            size="sm"
            className="text-xs"
          >
            <Rss className="h-3.5 w-3.5 mr-1" />
            {isFollowing ? "Отписаться" : "Подписаться"}
          </Button>

          <Button
            variant="outline"
            onClick={onPaidSub}
            disabled={paidSubPending}
            size="sm"
            className="text-xs"
          >
            <Crown className="h-3.5 w-3.5 mr-1" />
            {hasPaidSub ? "Отменить" : "Премиум"}
          </Button>
        </div>
      </div>
    )}
  </div>
);
