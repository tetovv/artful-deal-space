import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Film, Clock, Play, Video, Music, FileText, BookOpen, Layout,
  CheckCircle2, Lock, AlertTriangle, User,
} from "lucide-react";

const SOURCE_ICONS: Record<string, React.ElementType> = {
  video: Video, audio: Music, podcast: Music, post: FileText, book: BookOpen, template: Layout,
};

interface Segment {
  id: string;
  source_type: string;
  source_id: string | null;
  start_sec: number;
  end_sec: number;
  deep_link: string | null;
  rationale: string;
  sort_order: number;
  access: "allowed" | "locked";
}

interface ShareData {
  montage: {
    id: string;
    target_duration: number;
    status: string;
  };
  segments: Segment[];
  creatorName: string;
}

const formatTime = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export default function SharedMontage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug || !user) return;
    let cancelled = false;

    const load = async () => {
      try {
        // 1. Resolve share → montage
        const { data: share, error: shareErr } = await supabase
          .from("montage_shares" as any)
          .select("id, montage_id, created_by")
          .eq("slug", slug)
          .single();

        if (shareErr || !share) {
          setError("Монтаж не найден или ссылка недействительна.");
          setLoading(false);
          return;
        }

        const shareRow = share as any;

        // 2. Get montage project
        const { data: project } = await supabase
          .from("montage_projects")
          .select("id, target_duration, status")
          .eq("id", shareRow.montage_id)
          .single();

        if (!project) {
          setError("Монтаж не найден.");
          setLoading(false);
          return;
        }

        // 3. Get segments
        const { data: rawSegments } = await supabase
          .from("montage_segments")
          .select("*")
          .eq("montage_id", project.id)
          .neq("segment_status", "REMOVED")
          .order("sort_order");

        const segments = (rawSegments || []) as any[];

        // 4. Check entitlements
        const sourceIds = segments.map(s => s.source_id).filter(Boolean);
        const { data: paidContent } = await supabase
          .from("content_items")
          .select("id, monetization_type, price, creator_id, creator_name")
          .in("id", sourceIds);

        const { data: purchases } = await supabase
          .from("purchases" as any)
          .select("content_id")
          .eq("user_id", user.id);
        const purchasedIds = new Set((purchases || []).map((p: any) => p.content_id));

        const { data: subs } = await supabase
          .from("subscriptions" as any)
          .select("creator_id")
          .eq("user_id", user.id);
        const subscribedIds = new Set((subs || []).map((s: any) => s.creator_id));

        let allowedCount = 0;
        let lockedCount = 0;

        const enriched: Segment[] = segments.map(seg => {
          const content = (paidContent || []).find(c => c.id === seg.source_id);
          let access: "allowed" | "locked" = "allowed";

          if (content && content.monetization_type !== "free" && content.price && content.price > 0) {
            if (!purchasedIds.has(seg.source_id) && !subscribedIds.has(content.creator_id)) {
              access = "locked";
              lockedCount++;
              console.log("[analytics] paywall_hit_on_montage");
            } else {
              allowedCount++;
            }
          } else {
            allowedCount++;
          }

          return {
            id: seg.id,
            source_type: seg.source_type,
            source_id: seg.source_id,
            start_sec: seg.start_sec,
            end_sec: seg.end_sec,
            deep_link: seg.deep_link,
            rationale: seg.rationale,
            sort_order: seg.sort_order,
            access,
          };
        });

        // 5. Log access
        await supabase.from("montage_viewer_access_log" as any).insert({
          share_id: shareRow.id,
          viewer_id: user.id,
          allowed_count: allowedCount,
          locked_count: lockedCount,
        });

        // 6. Get creator name
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", shareRow.created_by)
          .single();

        console.log("[analytics] montage_opened");

        if (!cancelled) {
          setData({
            montage: project,
            segments: enriched,
            creatorName: profile?.display_name || "Автор",
          });
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("Ошибка загрузки монтажа.");
          setLoading(false);
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, [slug, user]);

  const activeSegments = useMemo(
    () => data?.segments.filter(s => s.access === "allowed") || [],
    [data]
  );
  const lockedSegments = useMemo(
    () => data?.segments.filter(s => s.access === "locked") || [],
    [data]
  );
  const totalDuration = useMemo(
    () => activeSegments.reduce((sum, s) => sum + (s.end_sec - s.start_sec), 0),
    [activeSegments]
  );

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        <Lock className="h-10 w-10 text-muted-foreground mx-auto" />
        <h1 className="text-xl font-semibold">Авторизация необходима</h1>
        <p className="text-sm text-muted-foreground">Войдите, чтобы посмотреть этот монтаж.</p>
        <Button asChild><Link to="/auth">Войти</Link></Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-3">
        <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
        <p className="text-sm font-medium">{error || "Монтаж не найден"}</p>
        <Button asChild variant="outline" size="sm"><Link to="/">На главную</Link></Button>
      </div>
    );
  }

  const targetDuration = data.montage.target_duration || 30;
  const durationPercent = Math.min((totalDuration / targetDuration) * 100, 100);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Film className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Монтаж</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-3.5 w-3.5" />
            <span>{data.creatorName}</span>
            <span>·</span>
            <span>{data.segments.length} сегментов</span>
          </div>
        </div>
      </div>

      {/* Duration overview */}
      <Card className="p-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {activeSegments.length} доступно · {formatTime(totalDuration)}
          </span>
          {lockedSegments.length > 0 && (
            <span className="text-destructive text-xs flex items-center gap-1">
              <Lock className="h-3 w-3" /> {lockedSegments.length} заблокировано
            </span>
          )}
        </div>
        <Progress value={durationPercent} className="h-2" />
      </Card>

      {/* Segments */}
      <div className="space-y-2">
        {data.segments.map((seg, i) => {
          const Icon = SOURCE_ICONS[seg.source_type] || FileText;
          const isLocked = seg.access === "locked";
          const segDuration = Math.round(seg.end_sec - seg.start_sec);
          const link = seg.deep_link || (seg.source_id ? `/product/${seg.source_id}` : "#");

          return (
            <Card
              key={seg.id}
              className={`p-4 transition-colors ${isLocked ? "border-destructive/30 bg-destructive/5" : "hover:bg-muted/30"}`}
            >
              <div className="flex items-start gap-3">
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-mono text-muted-foreground w-5 text-right">{i + 1}</span>
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                    isLocked ? "bg-destructive/10" : "bg-muted"
                  }`}>
                    {isLocked
                      ? <Lock className="h-4 w-4 text-destructive" />
                      : <Icon className="h-4 w-4 text-muted-foreground" />
                    }
                  </div>
                </div>

                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-[10px] font-mono">
                      {formatTime(seg.start_sec)} — {formatTime(seg.end_sec)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">({segDuration}с)</span>
                    {isLocked && (
                      <Badge variant="destructive" className="text-[10px]">
                        <Lock className="h-2.5 w-2.5 mr-0.5" /> Недоступен
                      </Badge>
                    )}
                  </div>

                  {isLocked ? (
                    <p className="text-xs text-muted-foreground italic">
                      Требуется подписка или покупка для просмотра этого фрагмента.
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground leading-relaxed">{seg.rationale}</p>
                      <Link
                        to={link}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Play className="h-3 w-3" /> Смотреть фрагмент
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Attribution */}
      <p className="text-[10px] text-muted-foreground text-center pt-2">
        Монтаж создан на основе контента авторов платформы. Все права принадлежат правообладателям.
      </p>
    </div>
  );
}
