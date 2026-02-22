import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Film, Clock, Play, ExternalLink, Video, Music, FileText,
  BookOpen, Layout, CheckCircle2, AlertTriangle, XCircle,
} from "lucide-react";

const SOURCE_ICONS: Record<string, React.ElementType> = {
  video: Video, audio: Music, podcast: Music, post: FileText, book: BookOpen, template: Layout,
};

const STATUS_META: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  pending: { label: "В очереди", icon: Clock, className: "text-muted-foreground" },
  processing: { label: "Генерация…", icon: Clock, className: "text-warning" },
  ready: { label: "Готов", icon: CheckCircle2, className: "text-success" },
  empty: { label: "Нет контента", icon: AlertTriangle, className: "text-warning" },
  error: { label: "Ошибка", icon: XCircle, className: "text-destructive" },
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
}

export default function MontageDetail() {
  const { montageId } = useParams<{ montageId: string }>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const [segments, setSegments] = useState<Segment[]>([]);

  useEffect(() => {
    if (!montageId || !user) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        };
        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`;
        }

        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/montage/${montageId}`,
          { headers }
        );
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();

        if (cancelled) return;
        setProject(data.project);
        setSegments(data.segments || []);
        console.log("[analytics] montage_opened");

        if (data.project.status === "processing" || data.project.status === "pending") {
          setTimeout(poll, 2000);
        } else {
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    };

    poll();
    return () => { cancelled = true; };
  }, [montageId, user]);

  const totalDuration = segments.reduce((sum, s) => sum + (s.end_sec - s.start_sec), 0);
  const statusMeta = STATUS_META[project?.status] || STATUS_META.pending;
  const StatusIcon = statusMeta.icon;

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <Link to="/ask" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Назад
      </Link>

      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Film className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Монтаж</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <StatusIcon className={`h-3.5 w-3.5 ${statusMeta.className}`} />
            <span>{statusMeta.label}</span>
            {project && (
              <>
                <span>·</span>
                <span>Цель: {project.target_duration}с</span>
              </>
            )}
          </div>
        </div>
      </div>

      {(loading || project?.status === "processing" || project?.status === "pending") && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 animate-pulse" /> Генерируем сегменты…
          </div>
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      )}

      {!loading && project?.status === "ready" && segments.length > 0 && (
        <>
          <Card className="p-4 border-primary/20 bg-primary/5">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <span className="font-medium text-foreground">{segments.length} сегментов</span>
                <span className="text-muted-foreground ml-2">· Общая длительность: {formatTime(totalDuration)}</span>
              </div>
              <Badge variant="outline" className="text-xs">Референсный монтаж</Badge>
            </div>
          </Card>

          <div className="space-y-2">
            {segments.map((seg, i) => {
              const Icon = SOURCE_ICONS[seg.source_type] || FileText;
              const link = seg.deep_link || (seg.source_id ? `/product/${seg.source_id}` : "#");
              return (
                <Card key={seg.id} className="p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono text-muted-foreground w-5 text-right">{i + 1}</span>
                      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant="secondary" className="text-[10px] font-mono">
                          {formatTime(seg.start_sec)} — {formatTime(seg.end_sec)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          ({Math.round(seg.end_sec - seg.start_sec)}с)
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{seg.rationale}</p>
                      <Link
                        to={link}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Play className="h-3 w-3" /> Перейти к фрагменту
                      </Link>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {!loading && project?.status === "empty" && (
        <Card className="p-6 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-warning mx-auto" />
          <p className="text-sm font-medium text-foreground">Нет доступного контента для монтажа</p>
          <p className="text-xs text-muted-foreground">Попробуйте расширить область источников или подписаться на больше авторов.</p>
          <Button asChild variant="outline" size="sm">
            <Link to="/ask">Назад</Link>
          </Button>
        </Card>
      )}

      {!loading && project?.status === "error" && (
        <Card className="p-6 text-center space-y-3">
          <XCircle className="h-8 w-8 text-destructive mx-auto" />
          <p className="text-sm font-medium text-foreground">Ошибка генерации монтажа</p>
          <Button asChild variant="outline" size="sm">
            <Link to="/ask">Попробовать снова</Link>
          </Button>
        </Card>
      )}
    </div>
  );
}
