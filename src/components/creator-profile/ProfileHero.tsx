import { CheckCircle, Globe, User, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ProfileHeroProps {
  avatar: string;
  name: string;
  verified: boolean;
  bio: string;
  niche: string[];
  language?: string;
}

export const ProfileHero = ({ avatar, name, verified, bio, niche, language = "RU" }: ProfileHeroProps) => (
  <div className="flex flex-col sm:flex-row items-start gap-5">
    <div className="h-20 w-20 rounded-2xl border-2 border-border bg-muted flex items-center justify-center overflow-hidden shrink-0">
      {avatar ? (
        <img src={avatar} alt={name} className="h-full w-full object-cover" />
      ) : (
        <User className="h-8 w-8 text-muted-foreground" />
      )}
    </div>
    <div className="flex-1 space-y-2.5 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-2xl font-bold text-foreground">{name}</h1>
        {verified && (
          <Badge variant="outline" className="text-[10px] gap-1 border-primary/30 text-primary bg-primary/10">
            <CheckCircle className="h-3 w-3" /> Верифицирован
          </Badge>
        )}
      </div>

      {/* Chips row: niches + language + platform-only */}
      <div className="flex flex-wrap items-center gap-1.5">
        {niche.map((n) => (
          <Badge key={n} variant="secondary" className="text-[11px]">{n}</Badge>
        ))}
        <Badge variant="outline" className="text-[10px] gap-1 border-border">
          <Globe className="h-2.5 w-2.5" /> {language}
        </Badge>
        <Badge variant="outline" className="text-[10px] gap-1 border-primary/30 text-primary bg-primary/5">
          <Lock className="h-2.5 w-2.5" /> Platform-only
        </Badge>
      </div>

      {bio && <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">{bio}</p>}
    </div>
  </div>
);
