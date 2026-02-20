import { Trophy, Briefcase, BarChart3, FileText, Handshake, Building2, Globe, ShieldCheck, Tag, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ContentCard } from "@/components/content/ContentCard";

const CATEGORY_LABELS: Record<string, string> = {
  ecommerce: "E-commerce", saas: "SaaS / IT", finance: "Финансы",
  education: "Образование", health: "Здоровье", food: "Еда и напитки",
  fashion: "Мода и красота", travel: "Путешествия", entertainment: "Развлечения",
  realestate: "Недвижимость", auto: "Авто", other: "Другое",
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

/* ─── Portfolio Section ─── */
export const PortfolioSection = ({ items, onRequestDeal }: { items: any[]; onRequestDeal?: () => void }) => (
  <section className="space-y-3">
    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
      <Briefcase className="h-4 w-4 text-muted-foreground" /> Портфолио и кампании
    </h2>
    {items.length > 0 ? (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((item) => (
          <ContentCard key={item.id} item={item} />
        ))}
      </div>
    ) : (
      <EmptyModule
        text="Автор пока не добавил примеры работ"
        actionLabel={onRequestDeal ? "Предложить сделку" : undefined}
        onAction={onRequestDeal}
      />
    )}
  </section>
);

/* ─── Audience Card ─── */
export const AudienceCard = () => (
  <section className="space-y-3">
    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
      <BarChart3 className="h-4 w-4 text-muted-foreground" /> Аудитория
    </h2>
    <EmptyModule text="Аналитика аудитории не подключена" />
  </section>
);

/* ─── Working Terms ─── */
export const WorkingTermsCard = () => (
  <section className="space-y-3">
    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
      <FileText className="h-4 w-4 text-muted-foreground" /> Условия работы
    </h2>
    <EmptyModule text="Условия сотрудничества не указаны" actionLabel="Запросить медиакит" />
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

/* ─── Empty Module ─── */
const EmptyModule = ({ text, actionLabel, onAction }: { text: string; actionLabel?: string; onAction?: () => void }) => (
  <div className="rounded-xl border border-border bg-card p-5 text-center space-y-2">
    <p className="text-xs text-muted-foreground">{text}</p>
    {actionLabel && (
      <Button variant="outline" size="sm" className="text-xs" onClick={onAction}>
        <Handshake className="h-3.5 w-3.5 mr-1" />
        {actionLabel}
      </Button>
    )}
  </div>
);
