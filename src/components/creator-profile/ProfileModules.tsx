import {
  Trophy, Briefcase, BarChart3, FileText, Handshake, Building2, Globe,
  ShieldCheck, Tag, Mail, Video, FileEdit, Mic, AlertCircle, Eye,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ContentCard } from "@/components/content/ContentCard";

const CATEGORY_LABELS: Record<string, string> = {
  ecommerce: "E-commerce", saas: "SaaS / IT", finance: "Финансы",
  education: "Образование", health: "Здоровье", food: "Еда и напитки",
  fashion: "Мода и красота", travel: "Путешествия", entertainment: "Развлечения",
  realestate: "Недвижимость", auto: "Авто", other: "Другое",
};

const OFFER_ICONS: Record<string, React.ElementType> = {
  "Видео-интеграция": Video,
  "Пост": FileEdit,
  "Подкаст": Mic,
};

/* ─── Brand Card ─── */
interface BrandData {
  brand_name: string;
  brand_website?: string;
  brand_description?: string;
  brand_logo_url?: string;
  business_verified?: boolean;
  ord_verified?: boolean;
  business_category?: string;
  contact_email?: string;
}

export const BrandCard = ({ data }: { data: BrandData }) => (
  <section className="rounded-xl border border-border bg-card p-5 space-y-3">
    <div className="flex items-center gap-3">
      {data.brand_logo_url ? (
        <div className="h-10 w-10 rounded-lg border border-border overflow-hidden flex-shrink-0">
          <img src={data.brand_logo_url} alt={data.brand_name} className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="h-10 w-10 rounded-lg border border-border bg-muted flex items-center justify-center flex-shrink-0">
          <Building2 className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-card-foreground truncate">{data.brand_name}</h3>
          {data.business_verified && data.ord_verified && (
            <Badge variant="outline" className="text-[9px] gap-0.5 border-success/30 text-success bg-success/10 flex-shrink-0">
              <ShieldCheck className="h-2.5 w-2.5" /> Верифицирован
            </Badge>
          )}
        </div>
        {data.brand_website && (
          <a href={data.brand_website} target="_blank" rel="noopener noreferrer"
            className="text-[11px] text-primary hover:underline flex items-center gap-1">
            <Globe className="h-2.5 w-2.5" /> {data.brand_website.replace(/^https?:\/\//, "")}
          </a>
        )}
      </div>
      <Badge variant="secondary" className="text-[10px] flex-shrink-0">Рекламодатель</Badge>
    </div>
    {(data.business_category || data.contact_email) && (
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {data.business_category && (
          <span className="flex items-center gap-1">
            <Tag className="h-3 w-3" /> {CATEGORY_LABELS[data.business_category] || data.business_category}
          </span>
        )}
        {data.contact_email && (
          <a href={`mailto:${data.contact_email}`} className="flex items-center gap-1 text-primary hover:underline">
            <Mail className="h-3 w-3" /> {data.contact_email}
          </a>
        )}
      </div>
    )}
    {data.brand_description && <p className="text-xs text-muted-foreground">{data.brand_description}</p>}
  </section>
);

/* ─── Offers Section (must-have) ─── */
interface OfferData {
  id: string;
  offer_type: string;
  price: number;
  turnaround_days: number;
  is_active: boolean;
}

export const OffersSection = ({ offers, onDeal }: { offers: OfferData[]; onDeal?: () => void }) => {
  const activeOffers = offers.filter((o) => o.is_active);
  const ALL_TYPES = ["Видео-интеграция", "Пост", "Подкаст"];

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Briefcase className="h-4 w-4 text-muted-foreground" /> Услуги и цены
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {ALL_TYPES.map((type) => {
          const offer = activeOffers.find((o) => o.offer_type === type);
          const Icon = OFFER_ICONS[type] || FileEdit;
          return (
            <div
              key={type}
              className={`rounded-xl border p-4 space-y-2 ${
                offer ? "border-border bg-card" : "border-border/50 bg-muted/20 opacity-60"
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-[13px] font-semibold text-foreground">{type}</span>
              </div>
              {offer ? (
                <>
                  <p className="text-lg font-bold text-foreground">
                    от {offer.price.toLocaleString("ru-RU")} <span className="text-[13px] font-normal text-muted-foreground">₽</span>
                  </p>
                  <div className="space-y-1 text-[12px] text-muted-foreground">
                    <p>Срок: {offer.turnaround_days} дн</p>
                    <p>Правки: по договорённости</p>
                  </div>
                </>
              ) : (
                <p className="text-[12px] text-muted-foreground">Не предлагается</p>
              )}
            </div>
          );
        })}
      </div>
      {activeOffers.length > 0 && onDeal && (
        <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={onDeal}>
          <Handshake className="h-3.5 w-3.5" /> Предложить сделку по выбранному типу
        </Button>
      )}
    </section>
  );
};

/* ─── Portfolio Section ─── */
export const PortfolioSection = ({ items, videoViewCounts = {}, postImpressionCounts = {} }: { items: any[]; videoViewCounts?: Record<string, number>; postImpressionCounts?: Record<string, number> }) => {
  const fmtNum = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Briefcase className="h-4 w-4 text-muted-foreground" /> Портфолио
      </h2>
      {items.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.slice(0, 6).map((item) => (
            <div key={item.id} className="space-y-1">
              <ContentCard item={item} />
              {item.type === "video" && videoViewCounts[item.id] !== undefined && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1 text-[11px] text-primary/80 cursor-help px-1">
                      <Eye className="h-3 w-3" />{fmtNum(videoViewCounts[item.id])} просм. (30%)
                    </span>
                  </TooltipTrigger>
                  <TooltipContent><p className="text-xs">Просмотры: пользователь посмотрел ≥30% видео</p></TooltipContent>
                </Tooltip>
              )}
              {item.type === "post" && postImpressionCounts[item.id] !== undefined && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1 text-[11px] text-primary/80 cursor-help px-1">
                      <Eye className="h-3 w-3" />{fmtNum(postImpressionCounts[item.id])} показов
                    </span>
                  </TooltipTrigger>
                  <TooltipContent><p className="text-xs">Показы: пост был виден ≥50% в области просмотра ≥1 сек</p></TooltipContent>
                </Tooltip>
              )}
            </div>
          ))}
        </div>
      ) : (
        <CompactEmpty text="Автор пока не добавил примеры работ" />
      )}
    </section>
  );
};

/* ─── Audience Card ─── */
export const AudienceCard = ({ connected = false }: { connected?: boolean }) => (
  <section className="space-y-3">
    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
      <BarChart3 className="h-4 w-4 text-muted-foreground" /> Аудитория
    </h2>
    {connected ? (
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-xs text-muted-foreground">Данные об аудитории будут здесь</p>
      </div>
    ) : (
      <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-4 py-3">
        <AlertCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-[12px] text-muted-foreground">Аналитика не подключена</span>
      </div>
    )}
  </section>
);

/* ─── Working Terms ─── */
export const WorkingTermsCard = () => (
  <section className="space-y-3">
    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
      <FileText className="h-4 w-4 text-muted-foreground" /> Условия работы
    </h2>
    <div className="rounded-xl border border-border bg-card p-4">
      <ul className="space-y-1.5 text-[13px] text-muted-foreground list-disc list-inside">
        <li>Оплата и коммуникация — только через платформу</li>
        <li>Маркировка рекламы (ОРД) — по умолчанию платформа</li>
        <li>Приёмка: утверждение рекламодателем перед публикацией</li>
        <li>Темы-исключения и ограничения — обсуждаются в сделке</li>
      </ul>
    </div>
  </section>
);

/* ─── Achievements ─── */
export const AchievementsSection = ({ achievements, onViewAll }: { achievements: any[]; onViewAll: () => void }) => {
  if (achievements.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Trophy className="h-4 w-4 text-warning" /> Достижения
        </h2>
        <Button variant="ghost" size="sm" onClick={onViewAll} className="text-[11px] text-muted-foreground hover:text-primary h-auto py-1">
          Все →
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {achievements.slice(0, 6).map((a: any) => (
          <div key={a.id} className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 hover:border-primary/30 transition-colors">
            <span className="text-base">{a.icon || "🏆"}</span>
            <span className="text-xs font-medium text-card-foreground">{a.title}</span>
          </div>
        ))}
      </div>
    </section>
  );
};

/* ─── Compact Empty ─── */
const CompactEmpty = ({ text }: { text: string }) => (
  <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-4 py-3">
    <AlertCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
    <span className="text-[12px] text-muted-foreground">{text}</span>
  </div>
);
