import { Handshake, MessageSquare, Rss, Crown, Clock, ShieldCheck, Briefcase, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  responseHours?: number | null;
  dealsCount?: number | null;
  turnaroundDays?: number | null;
  safeDeal?: boolean;
  hasActiveDeal?: boolean;
}

export const ProfileActionCard = ({
  isOwnProfile, isFollowing, hasPaidSub, dealSent,
  followPending, paidSubPending,
  onFollow, onPaidSub, onDeal, onEditProfile,
  responseHours, dealsCount, turnaroundDays, safeDeal, hasActiveDeal,
}: ProfileActionCardProps) => (
  <div className="rounded-xl border border-border bg-card p-5 space-y-4 lg:sticky lg:top-6">
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

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Button
                  variant="outline"
                  className="w-full"
                  size="sm"
                  disabled={!hasActiveDeal}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Написать
                </Button>
              </div>
            </TooltipTrigger>
            {!hasActiveDeal && (
              <TooltipContent side="bottom" className="text-[12px] max-w-[220px]">
                Сообщения доступны после принятия предложения о сделке
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>

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

    {/* Quick facts */}
    {!isOwnProfile && (
      <>
        <div className="h-px bg-border" />
        <div className="space-y-2.5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Быстрые факты</p>
          <QuickFact
            icon={Clock}
            label="Среднее время ответа"
            value={responseHours ? `≤ ${responseHours} ч` : "Не указано"}
            muted={!responseHours}
          />
          <QuickFact
            icon={Briefcase}
            label="Завершённых сделок"
            value={dealsCount != null ? String(dealsCount) : "0"}
          />
          <QuickFact
            icon={Zap}
            label="Типичный срок выполнения"
            value={turnaroundDays ? `${turnaroundDays} дн` : "Не указано"}
            muted={!turnaroundDays}
          />
          <QuickFact
            icon={ShieldCheck}
            label="Safe Deal"
            value={safeDeal ? "Да" : "Нет"}
            highlight={!!safeDeal}
          />
        </div>
      </>
    )}
  </div>
);

function QuickFact({ icon: Icon, label, value, muted, highlight }: {
  icon: React.ElementType; label: string; value: string; muted?: boolean; highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" /> {label}
      </span>
      <span className={`text-[12px] font-medium ${highlight ? "text-primary" : muted ? "text-muted-foreground/60" : "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}
