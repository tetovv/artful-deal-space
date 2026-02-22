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
  ArrowLeft, ListMusic, Play, Video, Music, FileText,
  BookOpen, Layout, Clock, AlertTriangle,
} from "lucide-react";

const TYPE_ICONS: Record<string, React.ElementType> = {
  video: Video, audio: Music, podcast: Music, post: FileText, book: BookOpen, template: Layout,
};

const GOAL_LABELS: Record<string, string> = {
  understand: "Разобраться в теме",
  practical: "Получить шаги",
  background: "Фоновое прослушивание",
  overview: "Быстрый обзор",
};

const formatTime = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const formatMinutes = (sec: number) => {
  const m = Math.round(sec / 60);
  return m < 1 ? "<1 мин" : `${m} мин`;
};

interface PlaylistItem {
  id: string;
  content_type: string;
  content_id: string | null;
  est_time: number;
  reason: string;
  sort_order: number;
  title?: string;
}

export default function GoalPlaylistDetail() {
  const { playlistId } = useParams<{ playlistId: string }>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [playlist, setPlaylist] = useState<any>(null);
  const [items, setItems] = useState<PlaylistItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!playlistId || !user) return;
    let cancelled = false;

    const load = async () => {
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/goal-playlists/${playlistId}`,
          {
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
            },
          }
        );

        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        if (cancelled) return;

        setPlaylist(data.playlist);

        // Enrich items with titles
        const rawItems = data.items || [];
        const contentIds = rawItems.map((i: any) => i.content_id).filter(Boolean);
        let titleMap: Record<string, string> = {};

        if (contentIds.length > 0) {
          const { data: contents } = await supabase
            .from("content_items")
            .select("id, title")
            .in("id", contentIds);
          if (contents) {
            titleMap = Object.fromEntries(contents.map(c => [c.id, c.title]));
          }
        }

        setItems(rawItems.map((i: any) => ({
          ...i,
          title: i.content_id ? titleMap[i.content_id] || "Контент" : "Контент",
        })));
      } catch {
        if (!cancelled) setError("Не удалось загрузить плейлист");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [playlistId, user]);

  const totalTime = useMemo(() => items.reduce((s, i) => s + i.est_time, 0), [items]);
  const budgetSec = (playlist?.time_budget || 20) * 60;
  const pct = Math.min((totalTime / budgetSec) * 100, 100);
  const isOver = totalTime > budgetSec;

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    );
  }

  if (error || !playlist) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-3">
        <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
        <p className="text-sm font-medium">{error || "Плейлист не найден"}</p>
        <Button asChild variant="outline" size="sm"><Link to="/">На главную</Link></Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <Link to="/playlists/new" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Новый плейлист
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <ListMusic className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {GOAL_LABELS[playlist.goal_type] || "Плейлист"}
          </h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>{playlist.time_budget} мин</span>
            <span>·</span>
            <span>{items.length} элементов</span>
          </div>
        </div>
      </div>

      {/* Duration bar */}
      <Card className="p-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {formatMinutes(totalTime)} из {playlist.time_budget} мин
          </span>
          {isOver && (
            <span className="text-destructive text-xs">
              +{formatMinutes(totalTime - budgetSec)} сверх бюджета
            </span>
          )}
        </div>
        <Progress
          value={pct}
          className={`h-2 ${isOver ? "[&>div]:bg-destructive" : ""}`}
        />
      </Card>

      {/* Items */}
      <div className="space-y-2">
        {items.map((item, i) => {
          const Icon = TYPE_ICONS[item.content_type] || FileText;
          const link = item.content_id ? `/product/${item.content_id}` : "#";

          return (
            <Card key={item.id} className="p-4 hover:bg-muted/30 transition-colors">
              <div className="flex items-start gap-3">
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-mono text-muted-foreground w-5 text-right">{i + 1}</span>
                  <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground truncate">{item.title}</span>
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {formatMinutes(item.est_time)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.reason}</p>
                  <Link
                    to={link}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Play className="h-3 w-3" /> Смотреть
                  </Link>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {items.length === 0 && (
        <Card className="p-6 text-center space-y-2">
          <AlertTriangle className="h-6 w-6 text-warning mx-auto" />
          <p className="text-sm text-muted-foreground">Плейлист пуст. Попробуйте расширить источники.</p>
        </Card>
      )}
    </div>
  );
}
