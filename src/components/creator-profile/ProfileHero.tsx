import { CheckCircle, MapPin, Globe, Clock, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ProfileHeroProps {
  avatar: string;
  name: string;
  verified: boolean;
  geo: string;
  bio: string;
  niche: string[];
  rating: number;
  integrationSummary?: string;
}

export const ProfileHero = ({ avatar, name, verified, geo, bio, niche, rating, integrationSummary }: ProfileHeroProps) => (
  <div className="flex flex-col sm:flex-row items-start gap-5">
    <div className="h-20 w-20 rounded-2xl border-2 border-border bg-muted flex items-center justify-center overflow-hidden shrink-0">
      {avatar ? (
        <img src={avatar} alt={name} className="h-full w-full object-cover" />
      ) : (
        <User className="h-8 w-8 text-muted-foreground" />
      )}
    </div>
    <div className="flex-1 space-y-2 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-2xl font-bold text-foreground">{name}</h1>
        {verified && (
          <Badge variant="outline" className="text-[10px] gap-1 border-primary/30 text-primary bg-primary/10">
            <CheckCircle className="h-3 w-3" /> Верифицирован
          </Badge>
        )}
        {rating > 0 && (
          <Badge variant="secondary" className="text-[10px] gap-1">
            ⭐ {rating.toFixed(1)}
          </Badge>
        )}
      </div>

      {bio && <p className="text-sm text-muted-foreground leading-relaxed">{bio}</p>}

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {geo && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {geo}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Globe className="h-3 w-3" /> Русский
        </span>
      </div>

      {niche.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {niche.map((n) => (
            <Badge key={n} variant="secondary" className="text-[11px]">
              {n}
            </Badge>
          ))}
        </div>
      )}

      {integrationSummary && (
        <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 border border-border/50 mt-1">
          <Clock className="h-3 w-3 inline mr-1 -mt-0.5" />
          {integrationSummary}
        </p>
      )}
    </div>
  </div>
);
