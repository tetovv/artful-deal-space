import { useParams, useNavigate } from "react-router-dom";
import { creators, contentItems } from "@/data/mockData";
import { ContentCard } from "@/components/content/ContentCard";
import { ArrowLeft, MapPin, Users, Star, CheckCircle, Eye, Package, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageTransition } from "@/components/layout/PageTransition";
import { useState } from "react";

const CreatorProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const creator = creators.find((c) => c.userId === id);
  const [dealSent, setDealSent] = useState(false);

  if (!creator) return <div className="p-8 text-muted-foreground">Автор не найден</div>;

  const creatorContent = contentItems.filter((c) => c.creatorId === creator.userId);

  const stats = [
    { label: "Подписчики", value: `${(creator.followers / 1000).toFixed(0)}K`, icon: Users },
    { label: "Охват", value: `${(creator.reach / 1000).toFixed(0)}K`, icon: Eye },
    { label: "Контент", value: creator.contentCount.toString(), icon: Package },
    { label: "Рейтинг", value: creator.rating.toFixed(1), icon: Star },
  ];

  return (
    <PageTransition>
      <div className="p-6 lg:p-8 max-w-5xl space-y-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Назад
        </button>

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <img src={creator.avatar} alt="" className="h-20 w-20 rounded-2xl border-2 border-border" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">{creator.displayName}</h1>
              {creator.verified && <CheckCircle className="h-5 w-5 text-primary" />}
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1"><MapPin className="h-4 w-4" />{creator.geo}</p>
            <p className="text-sm text-muted-foreground">{creator.bio}</p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {creator.niche.map((n) => (
                <Badge key={n} variant="secondary" className="text-xs">{n}</Badge>
              ))}
            </div>
          </div>
          <Button
            className="shrink-0 glow-primary"
            disabled={dealSent}
            onClick={() => setDealSent(true)}
          >
            <Handshake className="h-4 w-4 mr-2" />
            {dealSent ? "Заявка отправлена" : "Предложить сделку"}
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4 text-center">
              <s.icon className="h-4 w-4 mx-auto mb-2 text-muted-foreground" />
              <p className="text-xl font-bold text-card-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Portfolio */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Портфолио</h2>
          {creatorContent.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {creatorContent.map((item) => (
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
